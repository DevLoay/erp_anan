const {
  prisma,
  parseArgs,
  tagForMonth,
  loadTargetProjects,
  loadMissingCoverage,
  appCode,
  disconnect,
} = require("./full-payroll-test-data-common");

function toNumber(value) {
  if (value && typeof value === "object" && typeof value.toNumber === "function") return Number(value.toNumber()) || 0;
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

async function count(model, where) {
  return prisma[model].count({ where });
}

function sumField(rows, field) {
  return Number(rows.reduce((sum, row) => sum + toNumber(row[field]), 0).toFixed(2));
}

async function payrollHearing(driverIds) {
  if (!driverIds.length) {
    return {
      payrollItems: 0,
      status: "NO_TEST_DRIVERS",
    };
  }

  const items = await prisma.payrollItem.findMany({
    where: { driverId: { in: driverIds } },
    select: {
      id: true,
      driverId: true,
      advanceDeduction: true,
      advancesTotal: true,
      housingDeduction: true,
      trafficViolationDeduction: true,
      vehicleDamageDeduction: true,
      accidentLiabilityDeduction: true,
      fuelDeduction: true,
      userDeduction: true,
      kafalaDeduction: true,
      totalAppDeductions: true,
      keetaDeduction: true,
      keetaFoodCompensation: true,
      keetaTgaDeduction: true,
      totalDeductions: true,
      netSalary: true,
      finalSalary: true,
      companyRevenueFromKeeta: true,
      vehicleRentDays: true,
      vehicleRentDisplayAmount: true,
    },
  });

  if (!items.length) {
    return {
      payrollItems: 0,
      status: "PENDING_GENERATE_PAYROLL",
      message: "تم زرع مصادر الاختبار، لكن لا توجد PayrollItem بعد. شغل Generate Payroll ثم أعد audit.",
    };
  }

  return {
    payrollItems: items.length,
    status: "PAYROLL_ITEMS_FOUND",
    nonZeroColumns: {
      advanceDeduction: items.filter((item) => toNumber(item.advanceDeduction || item.advancesTotal) > 0).length,
      housingDeduction: items.filter((item) => toNumber(item.housingDeduction) > 0).length,
      trafficViolationDeduction: items.filter((item) => toNumber(item.trafficViolationDeduction) > 0).length,
      vehicleDamageDeduction: items.filter((item) => toNumber(item.vehicleDamageDeduction) > 0).length,
      accidentLiabilityDeduction: items.filter((item) => toNumber(item.accidentLiabilityDeduction) > 0).length,
      fuelDeduction: items.filter((item) => toNumber(item.fuelDeduction) > 0).length,
      userDeduction: items.filter((item) => toNumber(item.userDeduction) > 0).length,
      kafalaDeduction: items.filter((item) => toNumber(item.kafalaDeduction) > 0).length,
      totalAppDeductions: items.filter((item) => toNumber(item.totalAppDeductions) > 0).length,
      keetaAppDeductionBreakdown: items.filter((item) => toNumber(item.keetaDeduction) + toNumber(item.keetaFoodCompensation) + toNumber(item.keetaTgaDeduction) > 0).length,
      negativeNet: items.filter((item) => toNumber(item.finalSalary || item.netSalary) < 0).length,
      companyRevenueFromKeeta: items.filter((item) => toNumber(item.companyRevenueFromKeeta) > 0).length,
      vehicleRentDisplayAmount: items.filter((item) => toNumber(item.vehicleRentDisplayAmount) > 0 || toNumber(item.vehicleRentDays) > 0).length,
    },
    totals: {
      totalDeductions: sumField(items, "totalDeductions"),
      finalSalary: Number(items.reduce((sum, item) => sum + toNumber(item.finalSalary || item.netSalary), 0).toFixed(2)),
      companyRevenueFromKeeta: sumField(items, "companyRevenueFromKeeta"),
    },
  };
}

async function main() {
  const args = parseArgs();
  const tag = tagForMonth(args.month);
  const projects = await loadTargetProjects();
  const missingCoverage = await loadMissingCoverage();
  const drivers = await prisma.driver.findMany({
    where: { internalCode: { startsWith: tag } },
    select: { id: true, internalCode: true, contractType: true, vehicleOwnershipType: true, cityId: true },
  });
  const driverIds = drivers.map((driver) => driver.id);

  const projectBreakdown = [];
  for (const project of projects) {
    const app = appCode(project);
    const accounts = await count("applicationAccount", { username: { startsWith: `${tag}:${project.code}:` } });
    const hsInvoices = app === "HUNGERSTATION" ? await count("hungerStationInvoiceRecord", { applicationProjectId: project.id, month: args.month, reviewReason: { startsWith: tag } }) : 0;
    const hsUsage = app === "HUNGERSTATION" ? await count("accountUsage", { applicationProjectId: project.id, month: args.month, source: tag }) : 0;
    const keetaInvoices = app === "KEETA" ? await count("keetaInvoiceRecord", { applicationProjectId: project.id, month: args.month, approvedBy: tag }) : 0;
    const keetaRanks = app === "KEETA" ? await count("keetaRankRecord", { applicationProjectId: project.id, month: args.month, approvedBy: tag }) : 0;
    projectBreakdown.push({
      project: project.code,
      application: app,
      city: project.city?.nameAr || project.city?.nameEn || null,
      accounts,
      hsInvoices,
      hsUsage,
      keetaInvoices,
      keetaRanks,
    });
  }

  const [accounts, vehicles, vehicleAssignments, hsInvoices, hsDaily, accountUsage, keetaInvoices, keetaRanks, keetaPerformance, advances, deductions, violations, fuelRecords] =
    await Promise.all([
      count("applicationAccount", { username: { startsWith: tag } }),
      count("vehicle", { vehicleCode: { startsWith: tag } }),
      count("vehicleAssignment", { notes: { contains: tag } }),
      count("hungerStationInvoiceRecord", { month: args.month, reviewReason: { startsWith: tag } }),
      count("hungerStationDailyPerformanceRecord", { month: args.month, reviewReason: { startsWith: tag } }),
      count("accountUsage", { month: args.month, source: tag }),
      count("keetaInvoiceRecord", { month: args.month, approvedBy: tag }),
      count("keetaRankRecord", { month: args.month, approvedBy: tag }),
      count("keetaPerformanceRecord", { month: args.month, approvedBy: tag }),
      count("advance", { referenceNumber: { startsWith: tag } }),
      count("deduction", { month: args.month, notes: { contains: tag } }),
      count("violation", { notes: { contains: tag } }),
      count("fuelRecord", { notes: { contains: tag } }),
    ]);

  const deductionByType = await prisma.deduction.groupBy({
    by: ["type"],
    where: { month: args.month, notes: { contains: tag } },
    _count: { _all: true },
    _sum: { amount: true },
  });

  const payroll = await payrollHearing(driverIds);

  const report = {
    ok: true,
    tag,
    month: args.month,
    counts: {
      drivers: drivers.length,
      freelancerDrivers: drivers.filter((driver) => String(driver.contractType || "").toLowerCase().includes("free")).length,
      personalCarDrivers: drivers.filter((driver) => String(driver.vehicleOwnershipType || "").toLowerCase().includes("personal")).length,
      companyCarDrivers: drivers.filter((driver) => String(driver.vehicleOwnershipType || "").toLowerCase().includes("company")).length,
      accounts,
      vehicles,
      vehicleAssignments,
      hungerStationInvoices: hsInvoices,
      hungerStationDailyRecords: hsDaily,
      accountUsage,
      keetaInvoices,
      keetaRanks,
      keetaPerformanceRecords: keetaPerformance,
      advances,
      deductions,
      violations,
      fuelRecords,
    },
    deductionByType: deductionByType.map((row) => ({
      type: row.type,
      count: row._count._all,
      amount: toNumber(row._sum.amount),
    })),
    projectBreakdown,
    payrollHearing: payroll,
    missingCoverage,
  };

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(disconnect);
