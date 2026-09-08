import { DriverStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type SafeDeleteDriverResult = {
  driver: unknown;
  before: unknown;
  deleted: boolean;
  linkedRecords: number;
  linkSummary: Record<string, number>;
  deleteError?: string;
};

export async function getDriverLinkedRecordSummary(driverId: string) {
  const entries = await Promise.all([
    ["users", prisma.user.count({ where: { driverId } })],
    ["currentVehicles", prisma.vehicle.count({ where: { currentDriverId: driverId } })],
    ["applicationAccounts", prisma.applicationAccount.count({ where: { driverId } })],
    ["accountUsages", prisma.accountUsage.count({ where: { OR: [{ ownerDriverId: driverId }, { actualDriverId: driverId }] } })],
    ["hungerStationAccountUsages", prisma.hungerStationAccountUsage.count({ where: { driverId } })],
    ["dailyReports", prisma.dailyReport.count({ where: { driverId } })],
    ["payrolls", prisma.payroll.count({ where: { driverId } })],
    ["payrollItems", prisma.payrollItem.count({ where: { driverId } })],
    ["advances", prisma.advance.count({ where: { driverId } })],
    ["deductions", prisma.deduction.count({ where: { driverId } })],
    ["violations", prisma.violation.count({ where: { driverId } })],
    ["fuelRecords", prisma.fuelRecord.count({ where: { driverId } })],
    ["driverDocuments", prisma.driverDocument.count({ where: { driverId } })],
    ["driverContracts", prisma.driverContract.count({ where: { driverId } })],
    ["driverHousing", prisma.driverHousing.count({ where: { driverId } })],
    ["driverWarnings", prisma.driverWarning.count({ where: { driverId } })],
    ["attendanceRecords", prisma.attendanceRecord.count({ where: { driverId } })],
    ["shifts", prisma.shift.count({ where: { driverId } })],
    ["vehicleAssignments", prisma.vehicleAssignment.count({ where: { driverId } })],
    ["vehicleMovements", prisma.vehicleMovement.count({ where: { OR: [{ fromDriverId: driverId }, { toDriverId: driverId }] } })],
    ["vehicleCleaning", prisma.vehicleCleaning.count({ where: { driverId } })],
    ["vehicleMaintenance", prisma.vehicleMaintenance.count({ where: { driverId } })],
    ["vehicleAuthorizations", prisma.vehicleAuthorization.count({ where: { driverId } })],
    ["vehicleAccidents", prisma.vehicleAccident.count({ where: { driverId } })],
    ["vehicleDamages", prisma.vehicleDamage.count({ where: { driverId } })],
    ["applicationImportRows", prisma.applicationImportRow.count({ where: { driverId } })],
    ["financeEntries", prisma.financeEntry.count({ where: { driverId } })],
    ["tasks", prisma.task.count({ where: { driverId } })],
    ["notifications", prisma.notification.count({ where: { driverId } })],
    ["keetaRankRecords", prisma.keetaRankRecord.count({ where: { driverId } })],
    ["keetaPerformanceRecords", prisma.keetaPerformanceRecord.count({ where: { driverId } })],
    ["keetaInvoiceRecords", prisma.keetaInvoiceRecord.count({ where: { driverId } })],
    ["keetaInvoiceDetailRecords", prisma.keetaInvoiceDetailRecord.count({ where: { driverId } })],
    ["hungerStationDailyPerformanceRecords", prisma.hungerStationDailyPerformanceRecord.count({ where: { driverId } })],
    ["hungerStationInvoiceRecords", prisma.hungerStationInvoiceRecord.count({ where: { driverId } })],
  ]);

  return Object.fromEntries(entries) as Record<string, number>;
}

export async function safeDeleteDriver(driverId: string): Promise<SafeDeleteDriverResult | null> {
  const before = await prisma.driver.findUnique({ where: { id: driverId } });
  if (!before) return null;

  const linkSummary = await getDriverLinkedRecordSummary(driverId);
  const linkedRecords = Object.values(linkSummary).reduce((sum, count) => sum + count, 0);

  if (linkedRecords > 0) {
    const driver = await prisma.driver.update({
      where: { id: driverId },
      data: { status: DriverStatus.INACTIVE, needsReview: true },
    });
    return { before, driver, deleted: false, linkedRecords, linkSummary };
  }

  try {
    const driver = await prisma.driver.delete({ where: { id: driverId } });
    return { before, driver, deleted: true, linkedRecords, linkSummary };
  } catch (error) {
    const driver = await prisma.driver.update({
      where: { id: driverId },
      data: { status: DriverStatus.INACTIVE, needsReview: true },
    });
    return {
      before,
      driver,
      deleted: false,
      linkedRecords,
      linkSummary,
      deleteError: error instanceof Error ? error.message : "تعذر الحذف الفعلي، وتم تعطيل المندوب بدلًا من ذلك.",
    };
  }
}

export function safeDeleteDriverMessage(result: SafeDeleteDriverResult) {
  if (result.deleted) return "تم حذف المندوب نهائيًا لأنه لا يملك أي بيانات تشغيلية مرتبطة.";
  if (result.linkedRecords > 0) return `تم إيقاف المندوب بدل حذفه لوجود ${result.linkedRecords} سجل تشغيلي مرتبط به.`;
  return "تعذر الحذف الفعلي بسبب ارتباط غير مباشر، وتم إيقاف المندوب وحفظ بياناته للمراجعة.";
}
