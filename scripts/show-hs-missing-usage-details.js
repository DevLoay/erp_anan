const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function n(value) {
  const x = Number(value || 0);
  return Number.isFinite(x) ? x : 0;
}

async function main() {
  const month = "2026-04";

  const rows = await prisma.hungerStationInvoiceRecord.findMany({
    where: {
      month,
      matchingStatus: "NEEDS_REVIEW",
      reviewReason: "driver_not_linked",
    },
    select: {
      riderIdFromFile: true,
      completedOrders: true,
      basicPayment: true,
      distancePayment: true,
      riderBalance: true,
      applicationAccountId: true,
      applicationProjectId: true,
    },
    orderBy: {
      riderIdFromFile: "asc",
    },
  });

  const accountIds = rows.map(r => r.applicationAccountId).filter(Boolean);

  const accounts = await prisma.applicationAccount.findMany({
    where: {
      id: { in: accountIds },
    },
    select: {
      id: true,
      appName: true,
      appUserId: true,
      appUsername: true,
      status: true,
      driverId: true,
      applicationProjectId: true,
      cityId: true,
      needsReview: true,
      unmatchedReason: true,
    },
  });

  const driverIds = accounts.map(a => a.driverId).filter(Boolean);

  const drivers = driverIds.length
    ? await prisma.driver.findMany({
        where: {
          id: { in: driverIds },
        },
        select: {
          id: true,
          name: true,
          driverCode: true,
          internalCode: true,
        },
      })
    : [];

  const accountMap = new Map(accounts.map(a => [a.id, a]));
  const driverMap = new Map(drivers.map(d => [d.id, d]));

  const output = rows.map(r => {
    const a = accountMap.get(r.applicationAccountId);
    const d = a?.driverId ? driverMap.get(a.driverId) : null;

    const orders = n(r.completedOrders);
    const basic = n(r.basicPayment);

    return {
      riderId: r.riderIdFromFile,
      accountName: a?.appUsername || a?.appName || null,
      appUserId: a?.appUserId || null,
      accountStatus: a?.status || null,
      accountNeedsReview: a?.needsReview || false,
      unmatchedReason: a?.unmatchedReason || null,
      linkedDriver: d ? `${d.name} (${d.driverCode || d.internalCode || ""})` : null,
      completedOrders: r.completedOrders,
      basicPayment: r.basicPayment,
      orderRate: orders ? Number((basic / orders).toFixed(2)) : null,
      distancePayment: r.distancePayment,
      riderBalance: r.riderBalance,
      applicationAccountId: r.applicationAccountId,
    };
  });

  console.table(output);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
