const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const month = "2026-04";

const SETTINGS = {
  companyOrderRate: 10,
  companyKmRate: 1.25,

  normalDriverOrderRate: 8,
  normalDriverKmRate: 0.75,

  lowDriverOrderRate: 5,
  lowDriverKmRate: 0.50,
};

function n(value) {
  const x = Number(value || 0);
  return Number.isFinite(x) ? x : 0;
}

function money(value) {
  return Number(n(value).toFixed(2));
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

function daysInclusive(from, to) {
  const a = new Date(from);
  const b = new Date(to);
  const ms = b.getTime() - a.getTime();
  return Math.max(1, Math.floor(ms / 86400000) + 1);
}

async function main() {
  const invoices = await prisma.hungerStationInvoiceRecord.findMany({
    where: {
      month,
      application: {
        code: "HUNGERSTATION",
      },
    },
    include: {
      applicationProject: true,
      applicationAccount: true,
    },
    orderBy: {
      riderIdFromFile: "asc",
    },
  });

  const accountIds = [...new Set(invoices.map(i => i.applicationAccountId).filter(Boolean))];

  const usages = await prisma.accountUsage.findMany({
    where: {
      month,
      applicationAccountId: {
        in: accountIds,
      },
      status: "APPROVED",
    },
    include: {
      actualDriver: {
        select: {
          id: true,
          name: true,
          driverCode: true,
          internalCode: true,
        },
      },
    },
    orderBy: {
      dateFrom: "asc",
    },
  });

  const usageByAccount = new Map();

  for (const u of usages) {
    const list = usageByAccount.get(u.applicationAccountId) || [];
    list.push(u);
    usageByAccount.set(u.applicationAccountId, list);
  }

  const preview = [];
  const blocked = [];

  for (const inv of invoices) {
    const tier = classifyTier(inv);
    const orderRateFromInvoice = n(inv.completedOrders)
      ? n(inv.basicPayment) / n(inv.completedOrders)
      : 0;

    const accountUsages = usageByAccount.get(inv.applicationAccountId) || [];

    if (!accountUsages.length) {
      blocked.push({
        riderId: inv.riderIdFromFile,
        reason: "NO_APPROVED_USAGE",
      });
      continue;
    }

    if (tier === "NEEDS_REVIEW") {
      blocked.push({
        riderId: inv.riderIdFromFile,
        reason: "TIER_NEEDS_REVIEW",
        orderRateFromInvoice: money(orderRateFromInvoice),
        orders: inv.completedOrders,
        basicPayment: inv.basicPayment,
      });
      continue;
    }

    const totalUsageDays = accountUsages.reduce((sum, u) => {
      return sum + daysInclusive(u.dateFrom, u.dateTo);
    }, 0);

    const totalOrders = n(inv.completedOrders);
    const totalKm = n(inv.distancePayment) / SETTINGS.companyKmRate;
    const totalAppDeductions = appDeductions(inv);

    const driverOrderRate = tier === "HIGH"
      ? SETTINGS.normalDriverOrderRate
      : SETTINGS.lowDriverOrderRate;

    const driverKmRate = tier === "HIGH"
      ? SETTINGS.normalDriverKmRate
      : SETTINGS.lowDriverKmRate;

    for (const u of accountUsages) {
      const usageDays = daysInclusive(u.dateFrom, u.dateTo);
      const ratio = totalUsageDays ? usageDays / totalUsageDays : 1 / accountUsages.length;

      const driverOrders = totalOrders * ratio;
      const driverKm = totalKm * ratio;
      const driverAppDeduction = totalAppDeductions * ratio;

      const grossDriverSalary =
        driverOrders * driverOrderRate +
        driverKm * driverKmRate;

      const netDriverSalary = grossDriverSalary - driverAppDeduction;

      const companyRevenue =
        driverOrders * SETTINGS.companyOrderRate +
        driverKm * SETTINGS.companyKmRate;

      const companyNet = companyRevenue - grossDriverSalary;

      preview.push({
        riderId: inv.riderIdFromFile,
        project: inv.applicationProject?.name || "",
        account: inv.applicationAccount?.appUserId || inv.riderIdFromFile,
        driver: u.actualDriver
          ? `${u.actualDriver.name} (${u.actualDriver.driverCode || u.actualDriver.internalCode || ""})`
          : "NO_DRIVER",
        from: u.dateFrom.toISOString().slice(0, 10),
        to: u.dateTo.toISOString().slice(0, 10),
        usageType: u.usageType,
        tier,
        invoiceOrderRate: money(orderRateFromInvoice),
        usageDays,
        ratio: money(ratio),
        orders: money(driverOrders),
        km: money(driverKm),
        grossSalary: money(grossDriverSalary),
        appDeductions: money(driverAppDeduction),
        netSalary: money(netDriverSalary),
        companyRevenue: money(companyRevenue),
        companyNetBeforeOtherCosts: money(companyNet),
      });
    }
  }

  console.log("\n=== HUNGERSTATION PAYROLL PREVIEW ===");
  console.table(preview);

  console.log("\n=== BLOCKED / NEEDS REVIEW ===");
  console.table(blocked);

  const totals = preview.reduce((acc, r) => {
    acc.orders += n(r.orders);
    acc.km += n(r.km);
    acc.grossSalary += n(r.grossSalary);
    acc.appDeductions += n(r.appDeductions);
    acc.netSalary += n(r.netSalary);
    acc.companyRevenue += n(r.companyRevenue);
    acc.companyNetBeforeOtherCosts += n(r.companyNetBeforeOtherCosts);
    return acc;
  }, {
    orders: 0,
    km: 0,
    grossSalary: 0,
    appDeductions: 0,
    netSalary: 0,
    companyRevenue: 0,
    companyNetBeforeOtherCosts: 0,
  });

  console.log("\n=== TOTALS ===");
  console.table([{
    orders: money(totals.orders),
    km: money(totals.km),
    grossSalary: money(totals.grossSalary),
    appDeductions: money(totals.appDeductions),
    netSalary: money(totals.netSalary),
    companyRevenue: money(totals.companyRevenue),
    companyNetBeforeOtherCosts: money(totals.companyNetBeforeOtherCosts),
    blockedCount: blocked.length,
  }]);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
