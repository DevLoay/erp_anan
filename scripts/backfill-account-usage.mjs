import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function monthRange(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  return {
    start: new Date(Date.UTC(year, monthNumber - 1, 1)),
    end: new Date(Date.UTC(year, monthNumber, 0, 23, 59, 59, 999)),
  };
}

function usageType(ownerDriverId, actualDriverId) {
  if (!actualDriverId) return "NEEDS_REVIEW";
  if (!ownerDriverId) return "ACTUAL_WORKER";
  if (ownerDriverId === actualDriverId) return "OWNER";
  return "SHARED";
}

async function main() {
  const rows = await prisma.hungerStationAccountUsage.findMany({
    include: {
      applicationAccount: { select: { id: true, driverId: true, appName: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const accountId = row.applicationAccountId || row.applicationAccount?.id || null;
    if (!accountId || !row.month || !row.usageSource) {
      skipped += 1;
      continue;
    }

    const source = row.usageSource === "MONTHLY_INVOICE" ? "HUNGERSTATION_MONTHLY_INVOICE" : "HUNGERSTATION_DAILY_REPORT";
    const ownerDriverId = row.applicationAccount?.driverId || null;
    const actualDriverId = row.driverId || null;
    const { start, end } = monthRange(row.month);
    const data = {
      applicationAccountId: accountId,
      applicationId: row.applicationId,
      applicationProjectId: row.applicationProjectId,
      cityId: row.cityId,
      ownerDriverId,
      actualDriverId,
      month: row.month,
      usageDate: row.usageDate,
      dateFrom: row.usageDate || start,
      dateTo: row.usageDate || end,
      source,
      status: actualDriverId ? "APPROVED" : "PENDING",
      usageType: usageType(ownerDriverId, actualDriverId),
      reviewReason: row.reviewReason,
      rawData: {
        backfilledFrom: "HungerStationAccountUsage",
        legacyUsageId: row.id,
        riderIdFromFile: row.riderIdFromFile,
        completedDeliveries: row.completedDeliveries,
        actualWorkingHours: row.actualWorkingHours ? Number(row.actualWorkingHours) : null,
        workingDays: row.workingDays ? Number(row.workingDays) : null,
        invoiceCompletedOrders: row.invoiceCompletedOrders,
        invoiceRiderBalance: row.invoiceRiderBalance ? Number(row.invoiceRiderBalance) : null,
      },
    };

    const existing = await prisma.accountUsage.findFirst({
      where: {
        applicationAccountId: accountId,
        month: row.month,
        source,
        usageDate: row.usageDate,
        applicationProjectId: row.applicationProjectId,
        cityId: row.cityId,
      },
      select: { id: true },
    });

    if (existing) {
      await prisma.accountUsage.update({ where: { id: existing.id }, data });
      updated += 1;
    } else {
      await prisma.accountUsage.create({ data });
      created += 1;
    }
  }

  await prisma.auditLog.create({
    data: {
      action: "ACCOUNT_USAGE_BACKFILL",
      entityType: "AccountUsage",
      after: { scanned: rows.length, created, updated, skipped },
    },
  }).catch(() => null);

  console.log(JSON.stringify({ scanned: rows.length, created, updated, skipped }, null, 2));
}

main().finally(async () => {
  await prisma.$disconnect();
});
