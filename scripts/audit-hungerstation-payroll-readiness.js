/* eslint-disable no-console */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function getArg(name, fallback = null) {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function n(value) {
  if (value && typeof value.toNumber === "function") return Number(value.toNumber()) || 0;
  const x = Number(value || 0);
  return Number.isFinite(x) ? x : 0;
}

function abs(value) {
  return Math.abs(n(value));
}

function classifyTier(record) {
  const orders = n(record.completedOrders);
  if (!orders) return "NEEDS_REVIEW";

  const rate = n(record.basicPayment) / orders;

  // HungerStation invoice is the source of truth for performance.
  // Around 10 SAR/order = HIGH. Any positive lower invoice rate is LOW / weak performance.
  if (rate >= 9.65) return "HIGH";
  if (rate > 0) return "LOW";

  return "NEEDS_REVIEW";
}


function appDeductions(record) {
  return (
    abs(record.acceptanceRatePenalties) +
    abs(record.contactRatePenalties) +
    abs(record.stackingDeduction) +
    abs(record.declinedPenaltiesDayLogic) +
    abs(record.latePenalty) +
    abs(record.noShowPenalty) +
    abs(record.noShowPenaltySpecialCities) +
    abs(record.dailyAcceptanceRatePenalty) +
    abs(record.missedDaysPenalty) +
    abs(record.riderBalance)
  );
}

async function main() {
  const month = getArg("month", "2026-04");
  const projectCode = getArg("projectCode", null);

  const hunger = await prisma.application.findFirst({
    where: {
      OR: [{ code: { contains: "HUNGER", mode: "insensitive" } }, { name: { contains: "Hunger", mode: "insensitive" } }],
    },
  });

  if (!hunger) {
    console.log(JSON.stringify({ ok: false, error: "HungerStation application not found" }, null, 2));
    return;
  }

  const projects = await prisma.applicationProject.findMany({
    where: {
      applicationId: hunger.id,
      ...(projectCode ? { code: projectCode } : {}),
    },
    select: { id: true, code: true, name: true, cityId: true },
    orderBy: { code: "asc" },
  });

  const projectIds = projects.map((p) => p.id);

  const invoices = await prisma.hungerStationInvoiceRecord.findMany({
    where: {
      month,
      applicationId: hunger.id,
      ...(projectCode ? { applicationProjectId: { in: projectIds } } : {}),
    },
  });

  const accountIds = [...new Set(invoices.map((r) => r.applicationAccountId).filter(Boolean))];

  const usages = accountIds.length
    ? await prisma.accountUsage.findMany({
        where: { month, applicationAccountId: { in: accountIds } },
        select: {
          id: true,
          applicationAccountId: true,
          actualDriverId: true,
          ownerDriverId: true,
          status: true,
          usageType: true,
          dateFrom: true,
          dateTo: true,
          reviewReason: true,
        },
      })
    : [];

  const approvedUsages = usages.filter((u) => String(u.status).toUpperCase() === "APPROVED");

  const usageByAccount = new Map();
  for (const usage of usages) {
    const list = usageByAccount.get(usage.applicationAccountId) || [];
    list.push(usage);
    usageByAccount.set(usage.applicationAccountId, list);
  }

  const tierCounts = { HIGH: 0, LOW: 0, NEEDS_REVIEW: 0 };
  let completedOrders = 0;
  let basicPayment = 0;
  let distancePayment = 0;
  let cityPayment = 0;
  let appDeductionTotal = 0;

  const missingAccount = [];
  const missingApprovedUsage = [];
  const needsReviewTier = [];

  for (const inv of invoices) {
    const tier = classifyTier(inv);
    tierCounts[tier] += 1;

    completedOrders += n(inv.completedOrders);
    basicPayment += n(inv.basicPayment);
    distancePayment += n(inv.distancePayment);
    cityPayment += n(inv.cityPayment);
    appDeductionTotal += appDeductions(inv);

    if (!inv.applicationAccountId) {
      missingAccount.push({ riderId: inv.riderIdFromFile, projectId: inv.applicationProjectId, orders: inv.completedOrders });
      continue;
    }

    const accountUsages = usageByAccount.get(inv.applicationAccountId) || [];
    const hasApproved = accountUsages.some((u) => String(u.status).toUpperCase() === "APPROVED");

    if (!hasApproved) {
      missingApprovedUsage.push({
        riderId: inv.riderIdFromFile,
        accountId: inv.applicationAccountId,
        projectId: inv.applicationProjectId,
        orders: inv.completedOrders,
        matchingStatus: inv.matchingStatus,
        reviewReason: inv.reviewReason,
      });
    }

    if (tier === "NEEDS_REVIEW") {
      needsReviewTier.push({
        riderId: inv.riderIdFromFile,
        orders: inv.completedOrders,
        basicPayment: inv.basicPayment,
        orderRate: n(inv.completedOrders) ? n(inv.basicPayment) / n(inv.completedOrders) : null,
      });
    }
  }

  const sharedAccounts = [...usageByAccount.entries()]
    .map(([accountId, list]) => ({
      accountId,
      usagesCount: list.length,
      actualDrivers: [...new Set(list.map((u) => u.actualDriverId).filter(Boolean))],
      statuses: [...new Set(list.map((u) => u.status).filter(Boolean))],
    }))
    .filter((x) => x.usagesCount > 1 || x.actualDrivers.length > 1);

  const byProject = projects
    .map((project) => {
      const rows = invoices.filter((r) => r.applicationProjectId === project.id);
      return {
        code: project.code,
        name: project.name,
        invoiceRecords: rows.length,
        completedOrders: rows.reduce((s, r) => s + n(r.completedOrders), 0),
        basicPayment: rows.reduce((s, r) => s + n(r.basicPayment), 0),
        distancePayment: rows.reduce((s, r) => s + n(r.distancePayment), 0),
        cityPayment: rows.reduce((s, r) => s + n(r.cityPayment), 0),
      };
    })
    .filter((p) => p.invoiceRecords > 0);

  console.log(
    JSON.stringify(
      {
        ok: true,
        month,
        filter: projectCode ? { projectCode } : { application: "HungerStation all projects" },
        hunger,
        projectsWithInvoices: byProject,
        invoiceRecords: invoices.length,
        accountIds: accountIds.length,
        accountUsages: usages.length,
        approvedUsages: approvedUsages.length,
        completedOrders,
        basicPayment,
        distancePayment,
        cityPayment,
        appDeductionTotal,
        tierCounts,
        sharedAccountsCount: sharedAccounts.length,
        missingAccountCount: missingAccount.length,
        missingApprovedUsageCount: missingApprovedUsage.length,
        needsReviewTierCount: needsReviewTier.length,
        missingAccount: missingAccount.slice(0, 30),
        missingApprovedUsage: missingApprovedUsage.slice(0, 30),
        needsReviewTier: needsReviewTier.slice(0, 30),
        sharedAccounts: sharedAccounts.slice(0, 30),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
