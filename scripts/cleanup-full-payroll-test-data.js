const {
  prisma,
  parseArgs,
  tagForMonth,
  disconnect,
} = require("./full-payroll-test-data-common");

async function deleteMany(model, where, apply, report) {
  const count = await prisma[model].count({ where });
  report.operations.push({ model, count });
  if (apply && count > 0) {
    await prisma[model].deleteMany({ where });
  }
  return count;
}

async function cleanupPayrollItems(driverIds, apply, report) {
  if (!driverIds.length) {
    report.payroll = { testItems: 0, deletedRuns: 0, mixedRunsKept: 0 };
    return;
  }

  const items = await prisma.payrollItem.findMany({
    where: { driverId: { in: driverIds } },
    select: { id: true, payrollRunId: true, driverId: true },
  });
  const itemIds = items.map((item) => item.id);
  const runIds = [...new Set(items.map((item) => item.payrollRunId))];
  const testDriverSet = new Set(driverIds);
  let deletedRuns = 0;
  let mixedRunsKept = 0;

  if (itemIds.length) {
    await deleteMany("payrollAdjustment", { payrollItemId: { in: itemIds } }, apply, report);
  }

  for (const runId of runIds) {
    const runItems = await prisma.payrollItem.findMany({ where: { payrollRunId: runId }, select: { driverId: true } });
    const allTest = runItems.length > 0 && runItems.every((item) => testDriverSet.has(item.driverId));
    if (allTest) {
      if (apply) {
        await prisma.payrollItem.deleteMany({ where: { payrollRunId: runId } });
        await prisma.financeEntry.deleteMany({ where: { payrollRunId: runId } });
        await prisma.payrollRun.delete({ where: { id: runId } }).catch(() => null);
      }
      deletedRuns += 1;
    } else {
      if (apply) {
        await prisma.payrollItem.deleteMany({ where: { id: { in: items.filter((item) => item.payrollRunId === runId).map((item) => item.id) } } });
      }
      mixedRunsKept += 1;
    }
  }

  report.payroll = { testItems: items.length, deletedRuns, mixedRunsKept };
}

async function main() {
  const args = parseArgs();
  if (args.apply && args.confirm !== "DELETE_TEST_FULL_PAYROLL") {
    throw new Error("Apply requires --confirm=DELETE_TEST_FULL_PAYROLL");
  }
  const tag = tagForMonth(args.month);
  const report = { ok: true, tag, month: args.month, mode: args.apply ? "apply" : "dry-run", operations: [] };

  const drivers = await prisma.driver.findMany({ where: { internalCode: { startsWith: tag } }, select: { id: true } });
  const driverIds = drivers.map((driver) => driver.id);
  const accounts = await prisma.applicationAccount.findMany({ where: { username: { startsWith: tag } }, select: { id: true } });
  const accountIds = accounts.map((account) => account.id);
  const vehicles = await prisma.vehicle.findMany({ where: { vehicleCode: { startsWith: tag } }, select: { id: true } });
  const vehicleIds = vehicles.map((vehicle) => vehicle.id);

  await cleanupPayrollItems(driverIds, args.apply, report);

  await deleteMany("financeEntry", { description: { contains: tag } }, args.apply, report);
  await deleteMany("advance", { referenceNumber: { startsWith: tag } }, args.apply, report);
  await deleteMany("fuelRecord", { notes: { contains: tag } }, args.apply, report);
  await deleteMany("violation", { notes: { contains: tag } }, args.apply, report);
  await deleteMany("deduction", { notes: { contains: tag } }, args.apply, report);

  await deleteMany("keetaInvoiceDetailRecord", { rawData: { path: ["testTag"], equals: tag } }, args.apply, report);
  await deleteMany("keetaPerformanceRecord", { rawData: { path: ["testTag"], equals: tag } }, args.apply, report);
  await deleteMany("keetaInvoiceRecord", { rawData: { path: ["testTag"], equals: tag } }, args.apply, report);
  await deleteMany("keetaRankRecord", { rawData: { path: ["testTag"], equals: tag } }, args.apply, report);

  await deleteMany("hungerStationDailyPerformanceRecord", { reviewReason: { startsWith: tag } }, args.apply, report);
  await deleteMany("hungerStationInvoiceRecord", { reviewReason: { startsWith: tag } }, args.apply, report);
  await deleteMany("hungerStationAccountUsage", { reviewReason: { contains: tag } }, args.apply, report);
  await deleteMany("accountUsage", { source: tag }, args.apply, report);

  if (vehicleIds.length) {
    await deleteMany("vehicleAssignment", { OR: [{ vehicleId: { in: vehicleIds } }, { driverId: { in: driverIds } }, { notes: { contains: tag } }] }, args.apply, report);
    await deleteMany("vehicleMovement", { vehicleId: { in: vehicleIds } }, args.apply, report);
  } else {
    await deleteMany("vehicleAssignment", { notes: { contains: tag } }, args.apply, report);
  }

  if (accountIds.length) {
    await deleteMany("applicationImportRow", { applicationAccountId: { in: accountIds } }, args.apply, report).catch((error) => {
      report.operations.push({ model: "applicationImportRow", skipped: true, reason: error.message });
    });
  }

  if (driverIds.length) {
    await deleteMany("driverWarning", { driverId: { in: driverIds } }, args.apply, report).catch(() => null);
    await deleteMany("attendanceRecord", { driverId: { in: driverIds } }, args.apply, report).catch(() => null);
  }

  await deleteMany("applicationAccount", { username: { startsWith: tag } }, args.apply, report);
  if (vehicleIds.length) {
    const driverVehicleLinks = await prisma.driver.count({ where: { vehicleId: { in: vehicleIds } } });
    const vehicleDriverLinks = await prisma.vehicle.count({ where: { id: { in: vehicleIds }, currentDriverId: { not: null } } });
    report.operations.push({ model: "driverVehicleLinks", count: driverVehicleLinks + vehicleDriverLinks });
    if (args.apply) {
      await prisma.driver.updateMany({ where: { vehicleId: { in: vehicleIds } }, data: { vehicleId: null } });
      await prisma.vehicle.updateMany({ where: { id: { in: vehicleIds } }, data: { currentDriverId: null } });
    }
  }
  await deleteMany("vehicle", { vehicleCode: { startsWith: tag } }, args.apply, report);
  await deleteMany("driver", { internalCode: { startsWith: tag } }, args.apply, report);

  await deleteMany("auditLog", { entityId: tag }, args.apply, report);

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(disconnect);
