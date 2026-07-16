/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function getArg(name, fallback = null) {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

const month = getArg("month", "2026-04");
const projectCode = getArg("projectCode", null);

const SETTINGS = {
  normalDriverOrderRate: 8,
  normalDriverKmRate: 0.75,
  lowDriverOrderRate: 5,
  lowDriverKmRate: 0.5,
  companyKmRateFromInvoice: 1.25,
};

function n(value) {
  if (value && typeof value.toNumber === "function") return Number(value.toNumber()) || 0;
  const x = Number(value || 0);
  return Number.isFinite(x) ? x : 0;
}

function money(value) {
  return Number(n(value).toFixed(2));
}

function abs(value) {
  return Math.abs(n(value));
}

function daysInclusive(from, to) {
  const a = new Date(from);
  const b = new Date(to);
  return Math.max(1, Math.floor((b.getTime() - a.getTime()) / 86400000) + 1);
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


function appDeductionBreakdown(record, ratio) {
  const acceptance = abs(record.acceptanceRatePenalties) * ratio;
  const contact = abs(record.contactRatePenalties) * ratio;
  const stacking = abs(record.stackingDeduction) * ratio;
  const declined = abs(record.declinedPenaltiesDayLogic) * ratio;
  const late = abs(record.latePenalty) * ratio;
  const noShow = abs(record.noShowPenalty) * ratio;
  const noShowSpecial = abs(record.noShowPenaltySpecialCities) * ratio;
  const dailyAcceptance = abs(record.dailyAcceptanceRatePenalty) * ratio;
  const missedDays = abs(record.missedDaysPenalty) * ratio;
  const riderBalance = abs(record.riderBalance) * ratio;

  const adminDeduction = acceptance + contact + late + dailyAcceptance;
  const total =
    acceptance +
    contact +
    stacking +
    declined +
    late +
    noShow +
    noShowSpecial +
    dailyAcceptance +
    missedDays +
    riderBalance;

  return {
    adminDeduction: money(adminDeduction),
    stackingDeduction: money(stacking),
    declinedDeduction: money(declined),
    noShowDeduction: money(noShow + noShowSpecial),
    missedDaysDeduction: money(missedDays),
    walletDeduction: money(riderBalance),
    total: money(total),
  };
}

function csvEscape(value) {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function monthEndDay(monthValue) {
  const [year, m] = String(monthValue).split("-").map(Number);
  return new Date(Date.UTC(year, m, 0)).getUTCDate();
}

async function main() {
  const invoiceWhere = {
    month,
    application: { code: "HUNGERSTATION" },
    ...(projectCode ? { applicationProject: { code: projectCode } } : {}),
  };

  const invoices = await prisma.hungerStationInvoiceRecord.findMany({
    where: invoiceWhere,
    include: {
      applicationProject: true,
      applicationAccount: true,
    },
    orderBy: [{ applicationProjectId: "asc" }, { riderIdFromFile: "asc" }],
  });

  const accountIds = [...new Set(invoices.map((i) => i.applicationAccountId).filter(Boolean))];

  const usages = accountIds.length
    ? await prisma.accountUsage.findMany({
        where: {
          month,
          applicationAccountId: { in: accountIds },
          status: "APPROVED",
        },
        include: {
          actualDriver: {
            select: {
              id: true,
              name: true,
              driverCode: true,
              internalCode: true,
              vehicleId: true,
              vehicle: {
                select: {
                  id: true,
                  plateAr: true,
                  plateArabic: true,
                  plateEn: true,
                  plateEnglish: true,
                },
              },
            },
          },
        },
        orderBy: [{ applicationAccountId: "asc" }, { dateFrom: "asc" }],
      })
    : [];

  const usageByAccount = new Map();

  for (const usage of usages) {
    const list = usageByAccount.get(usage.applicationAccountId) || [];
    list.push(usage);
    usageByAccount.set(usage.applicationAccountId, list);
  }

  const headers = [
    "المحصل",
    "متوسط سعر الطلب",
    "المحصل مع المخالفات",
    "الفايده",

    "الايدى",
    "اسم المندوب",
    "اسم المستخدم",
    "السياره",
    "ملاحظات",

    "عدد الطلبات",
    "الايام",
    "الكيلومترات",
    "سعر الكيلو",
    "سعر الطلب",

    "الراتب الاساسي بالطلب اقل من التارجت",
    "بدل انتقال",
    "بدلات اخري",
    "الإجمالي",
    "الراتب بالطلب",
    "الراتب بالكيلو",
    "الراتب الاجمالي",

    "خصم اداري",
    "مرحل",
    "سكن",
    "مخالفات مروريه",
    "بنزين",
    "شريحه",
    "غرامة عدم الحضور",
    "خصم الطلبات المتعدده",
    "رفض طلبات",
    "غرامه الغياب",
    "المحافظ",
    "سلفة",
    "مخالفة",
    "تلف طعام",
    "شريحه 2",
    "تلفيات سياره",
    "نسبه تحمل حادث",
    "يوزر",
    "مرحل سيارات",
    "ايجار سياره",
    "ايام السياره",
    "خصومات ك",

    "إجمالي الخصومات",
    "صافي الراتب",
    "السوالب",

    "rider_id",
    "project",
    "tier",
    "usage_from",
    "usage_to",
    "usage_type",
    "invoice_basic_payment",
    "invoice_distance_payment",
    "invoice_city_payment",
    "invoice_rider_balance",
  ];

  const rows = [];
  const blocked = [];

  for (const inv of invoices) {
    const accountUsages = usageByAccount.get(inv.applicationAccountId) || [];
    const tier = classifyTier(inv);

    if (!accountUsages.length) {
      blocked.push({ riderId: inv.riderIdFromFile, reason: "NO_APPROVED_USAGE" });
      continue;
    }

    if (tier === "NEEDS_REVIEW") {
      blocked.push({
        riderId: inv.riderIdFromFile,
        reason: "TIER_NEEDS_REVIEW",
        orderRate: n(inv.completedOrders) ? money(n(inv.basicPayment) / n(inv.completedOrders)) : 0,
      });
      continue;
    }

    const totalUsageDays = accountUsages.reduce((sum, usage) => sum + daysInclusive(usage.dateFrom, usage.dateTo), 0);

    for (const usage of accountUsages) {
      const usageDays = daysInclusive(usage.dateFrom, usage.dateTo);
      const ratio = totalUsageDays ? usageDays / totalUsageDays : 1 / accountUsages.length;

      const orders = n(inv.completedOrders) * ratio;

      const invoiceBasicPayment = n(inv.basicPayment) * ratio;
      const invoiceDistancePayment = n(inv.distancePayment) * ratio;
      const invoiceCityPayment = n(inv.cityPayment) * ratio;

      // This is intentionally from the invoice only. Rider Balance is NOT added here.
      const collected = invoiceBasicPayment + invoiceDistancePayment + invoiceCityPayment;

      const averageOrderRate = n(inv.completedOrders) ? n(inv.basicPayment) / n(inv.completedOrders) : 0;

      const km = n(inv.distancePayment) ? (n(inv.distancePayment) / SETTINGS.companyKmRateFromInvoice) * ratio : 0;

      const driverOrderRate = tier === "HIGH" ? SETTINGS.normalDriverOrderRate : SETTINGS.lowDriverOrderRate;
      const driverKmRate = tier === "HIGH" ? SETTINGS.normalDriverKmRate : SETTINGS.lowDriverKmRate;

      const orderSalary = orders * driverOrderRate;
      const kmSalary = km * driverKmRate;

      const transportAllowance = 0;
      const otherAllowances = 0;

      const grossSalary = orderSalary + kmSalary + transportAllowance + otherAllowances;

      const appDeductions = appDeductionBreakdown(inv, ratio);

      const internalDeductions = {
        carried: 0,
        housing: 0,
        trafficViolation: 0,
        fuel: 0,
        sim: 0,
        advance: 0,
        violation: 0,
        foodDamage: 0,
        sim2: 0,
        carDamage: 0,
        accidentShare: 0,
        user: 0,
        carCarry: 0,
        carRent: 0,
        carDays: 0,
        other: 0,
      };

      const totalInternalDeductions = Object.values(internalDeductions).reduce((s, v) => s + n(v), 0);
      const totalDeductions = appDeductions.total + totalInternalDeductions;
      const netSalary = grossSalary - totalDeductions;

      // This is the invoice net after app penalties, including Rider Balance as a deduction.
      const collectedAfterAppDeductions = collected - appDeductions.total;

      // Equivalent to collected - grossSalary when app deductions are passed to the driver.
      const profit = collectedAfterAppDeductions - netSalary;

      const driverCode = usage.actualDriver?.driverCode || usage.actualDriver?.internalCode || "";
      const driverName = usage.actualDriver?.name || "NO_DRIVER";
      const vehicle = usage.actualDriver?.vehicle
        ? usage.actualDriver.vehicle.plateAr || usage.actualDriver.vehicle.plateArabic || usage.actualDriver.vehicle.plateEn || usage.actualDriver.vehicle.plateEnglish || ""
        : "";

      const notes = [
        tier === "HIGH" ? "أداء عالي من الفاتورة" : "أداء منخفض من الفاتورة",
        usage.usageType === "SHARED" ? "حساب مشترك" : "",
        `Invoice rate=${money(averageOrderRate)}`,
      ]
        .filter(Boolean)
        .join(" - ");

      rows.push({
        "المحصل": money(collected),
        "متوسط سعر الطلب": money(averageOrderRate),
        "المحصل مع المخالفات": money(collectedAfterAppDeductions),
        "الفايده": money(profit),

        "الايدى": driverCode,
        "اسم المندوب": driverName,
        "اسم المستخدم": inv.applicationAccount?.appUserId || inv.riderIdFromFile,
        "السياره": vehicle,
        "ملاحظات": notes,

        "عدد الطلبات": money(orders),
        "الايام": usageDays,
        "الكيلومترات": money(km),
        "سعر الكيلو": driverKmRate,
        "سعر الطلب": driverOrderRate,

        "الراتب الاساسي بالطلب اقل من التارجت": tier === "LOW" ? money(orderSalary) : 0,
        "بدل انتقال": transportAllowance,
        "بدلات اخري": otherAllowances,
        "الإجمالي": money(grossSalary),
        "الراتب بالطلب": money(orderSalary),
        "الراتب بالكيلو": money(kmSalary),
        "الراتب الاجمالي": money(grossSalary),

        "خصم اداري": appDeductions.adminDeduction,
        "مرحل": internalDeductions.carried,
        "سكن": internalDeductions.housing,
        "مخالفات مروريه": internalDeductions.trafficViolation,
        "بنزين": internalDeductions.fuel,
        "شريحه": internalDeductions.sim,
        "غرامة عدم الحضور": appDeductions.noShowDeduction,
        "خصم الطلبات المتعدده": appDeductions.stackingDeduction,
        "رفض طلبات": appDeductions.declinedDeduction,
        "غرامه الغياب": appDeductions.missedDaysDeduction,
        "المحافظ": appDeductions.walletDeduction,
        "سلفة": internalDeductions.advance,
        "مخالفة": internalDeductions.violation,
        "تلف طعام": internalDeductions.foodDamage,
        "شريحه 2": internalDeductions.sim2,
        "تلفيات سياره": internalDeductions.carDamage,
        "نسبه تحمل حادث": internalDeductions.accidentShare,
        "يوزر": internalDeductions.user,
        "مرحل سيارات": internalDeductions.carCarry,
        "ايجار سياره": internalDeductions.carRent,
        "ايام السياره": internalDeductions.carDays,
        "خصومات ك": internalDeductions.other,

        "إجمالي الخصومات": money(totalDeductions),
        "صافي الراتب": money(netSalary),
        "السوالب": netSalary < 0 ? money(Math.abs(netSalary)) : 0,

        rider_id: inv.riderIdFromFile,
        project: inv.applicationProject?.name || "",
        tier,
        usage_from: usage.dateFrom ? usage.dateFrom.toISOString().slice(0, 10) : "",
        usage_to: usage.dateTo ? usage.dateTo.toISOString().slice(0, 10) : "",
        usage_type: usage.usageType || "",
        invoice_basic_payment: money(invoiceBasicPayment),
        invoice_distance_payment: money(invoiceDistancePayment),
        invoice_city_payment: money(invoiceCityPayment),
        invoice_rider_balance: money(n(inv.riderBalance) * ratio),
      });
    }
  }

  const outDir = path.join(process.cwd(), "exports");
  fs.mkdirSync(outDir, { recursive: true });

  const suffix = projectCode ? `${month}-${projectCode}` : month;
  const outPath = path.join(outDir, `hungerstation-company-payroll-${suffix}.csv`);

  const csv = [headers.join(","), ...rows.map((row) => headers.map((h) => csvEscape(row[h])).join(","))].join("\n");
  fs.writeFileSync(outPath, "\uFEFF" + csv, "utf8");

  console.log("\nExported:");
  console.log(outPath);

  console.log("\nRows:");
  console.table(
    rows.map((r) => ({
      rider_id: r.rider_id,
      driver: r["اسم المندوب"],
      user: r["اسم المستخدم"],
      tier: r.tier,
      orders: r["عدد الطلبات"],
      collected: r["المحصل"],
      collectedAfterDeductions: r["المحصل مع المخالفات"],
      grossSalary: r["الراتب الاجمالي"],
      deductions: r["إجمالي الخصومات"],
      netSalary: r["صافي الراتب"],
      profit: r["الفايده"],
      notes: r["ملاحظات"],
    })),
  );

  const totals = rows.reduce(
    (acc, row) => {
      acc.collected += n(row["المحصل"]);
      acc.collectedAfterDeductions += n(row["المحصل مع المخالفات"]);
      acc.grossSalary += n(row["الراتب الاجمالي"]);
      acc.deductions += n(row["إجمالي الخصومات"]);
      acc.netSalary += n(row["صافي الراتب"]);
      acc.profit += n(row["الفايده"]);
      acc.negative += n(row["السوالب"]);
      return acc;
    },
    { collected: 0, collectedAfterDeductions: 0, grossSalary: 0, deductions: 0, netSalary: 0, profit: 0, negative: 0 },
  );

  console.log("\nTotals:");
  console.table([
    {
      rows: rows.length,
      collected: money(totals.collected),
      collectedAfterDeductions: money(totals.collectedAfterDeductions),
      grossSalary: money(totals.grossSalary),
      deductions: money(totals.deductions),
      netSalary: money(totals.netSalary),
      profit: money(totals.profit),
      negatives: money(totals.negative),
      blocked: blocked.length,
    },
  ]);

  console.log("\nBlocked:");
  console.table(blocked);

  if (blocked.length) {
    console.log("\nNote: blocked rows are not exported until usage/performance review is resolved.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
