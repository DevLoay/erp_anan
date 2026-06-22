import { Prisma, RecordStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { RiderSessionContext } from "@/lib/rider-app/riderAuth";

export type RiderSection =
  | "dashboard"
  | "notifications"
  | "violations"
  | "payroll"
  | "advances"
  | "attendance"
  | "vehicle"
  | "documents"
  | "tasks"
  | "profile"
  | "support";

export const riderSections: RiderSection[] = [
  "dashboard",
  "notifications",
  "violations",
  "payroll",
  "advances",
  "attendance",
  "vehicle",
  "documents",
  "tasks",
  "profile",
  "support",
];

function toNumber(value: unknown) {
  if (value instanceof Prisma.Decimal) return value.toNumber();
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function iso(value?: Date | null) {
  return value ? value.toISOString() : null;
}

function monthParts(month?: string | null) {
  const value = month && /^\d{4}-\d{2}$/.test(month) ? month : new Date().toISOString().slice(0, 7);
  const [yearRaw, monthRaw] = value.split("-");
  return { value, year: Number(yearRaw), month: Number(monthRaw) };
}

function monthRange(monthValue: string) {
  const [year, month] = monthValue.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start, end };
}

function driverName(context: RiderSessionContext) {
  return context.driver?.actualName || context.driver?.name || "مندوب";
}

function accountLabel(context: RiderSessionContext) {
  const account = context.driver?.applicationAccounts?.[0];
  if (!account) return "-";
  return [account.application?.name || account.appName, account.applicationProject?.name, account.appUserId].filter(Boolean).join(" - ");
}

function serializeDriver(context: RiderSessionContext) {
  const driver = context.driver;
  return {
    id: driver?.id,
    name: driverName(context),
    actualName: driver?.actualName || null,
    internalCode: driver?.internalCode || null,
    driverCode: driver?.driverCode || null,
    phone: driver?.phone || driver?.mobile || null,
    nationalId: driver?.nationalId ? `${driver.nationalId.slice(0, 3)}******${driver.nationalId.slice(-2)}` : null,
    nationality: driver?.nationality || null,
    city: driver?.city?.nameAr || driver?.city?.nameEn || "-",
    cityId: driver?.cityId || null,
    supervisor: driver?.supervisor?.name || "-",
    supervisorPhone: driver?.supervisor?.phone || null,
    contractType: driver?.contractType || null,
    sponsorshipType: driver?.sponsorshipType || null,
    accommodationType: driver?.accommodationType || null,
    housingStatus: driver?.housingStatus || null,
    vehicleOwnershipType: driver?.vehicleOwnershipType || "no_vehicle",
    status: driver?.status || null,
    joinDate: iso(driver?.joinDate),
    appAccountLabel: accountLabel(context),
    applicationAccounts: (driver?.applicationAccounts || []).map((account) => ({
      id: account.id,
      appName: account.application?.name || account.appName,
      applicationCode: account.application?.code || null,
      projectName: account.applicationProject?.name || null,
      city: account.city?.nameAr || account.applicationProject?.city?.nameAr || null,
      appUserId: account.appUserId,
      appUsername: account.appUsername || account.username,
      status: account.status,
      linkedAt: iso(account.linkedAt),
    })),
  };
}

function serializePayrollItem(item: NonNullable<Awaited<ReturnType<typeof latestPayrollItem>>>) {
  return {
    id: item.id,
    payrollRunId: item.payrollRunId,
    month: `${item.payrollRun.year}-${String(item.payrollRun.month).padStart(2, "0")}`,
    status: item.status,
    runStatus: item.payrollRun.status,
    application: item.payrollRun.application?.name || item.applicationAccount?.application?.name || "-",
    project: item.payrollRun.applicationProject?.name || item.applicationAccount?.applicationProject?.name || "-",
    city: item.payrollRun.city?.nameAr || "-",
    orders: item.orders,
    deliveredOrders: item.deliveredOrders,
    extraOrders: item.extraOrders,
    monthlyTargetOrders: item.monthlyTargetOrders,
    shortageOrders: item.shortageOrders,
    level: item.level,
    invoiceIsValid: item.invoiceIsValid,
    invoiceValidityReason: item.invoiceValidityReason,
    validDays: item.performanceValidDays,
    kpiScore: toNumber(item.kpiScore),
    basicSalary: toNumber(item.basicSalary),
    baseSalaryBeforeProration: toNumber(item.baseSalaryBeforeProration),
    grossSalary: toNumber(item.grossSalary),
    extraOrdersBonus: toNumber(item.extraOrdersBonus),
    performanceBonus: toNumber(item.performanceBonus),
    levelBonus: toNumber(item.levelBonus),
    housingAllowance: toNumber(item.housingAllowance),
    manualBonus: toNumber(item.manualBonus),
    advancesTotal: toNumber(item.advancesTotal),
    violationsTotal: toNumber(item.violationsTotal),
    fuelTotal: toNumber(item.fuelTotal),
    appDeductionsTotal: toNumber(item.totalAppDeductions || item.appDeductionsTotal),
    keetaDeduction: toNumber(item.keetaDeduction),
    keetaFoodCompensation: toNumber(item.keetaFoodCompensation),
    keetaTgaDeduction: toNumber(item.keetaTgaDeduction),
    kafalaDeduction: toNumber(item.kafalaDeduction),
    userDeduction: toNumber(item.userDeduction),
    carRentDeduction: toNumber(item.carRentDeduction),
    shortageDeduction: toNumber(item.shortageDeduction),
    totalDeductions: toNumber(item.totalDeductions),
    finalSalary: toNumber(item.finalSalary || item.netSalary),
    netSalary: toNumber(item.netSalary),
    companyRevenueFromKeeta: toNumber(item.companyRevenueFromKeeta || item.keetaTotalPayableAmount),
    vehicleOwnershipType: item.vehicleOwnershipType,
    vehicleRentDays: item.vehicleRentDays,
    vehicleRentDisplayAmount: toNumber(item.vehicleRentDisplayAmount),
    notes: item.notes,
  };
}

async function latestPayrollItem(driverId: string, monthValue?: string | null) {
  const parts = monthParts(monthValue);
  return prisma.payrollItem.findFirst({
    where: { driverId, payrollRun: { year: parts.year, month: parts.month } },
    include: {
      payrollRun: {
        include: {
          application: { select: { name: true } },
          applicationProject: { select: { name: true } },
          city: { select: { nameAr: true } },
        },
      },
      applicationAccount: {
        include: {
          application: { select: { name: true } },
          applicationProject: { select: { name: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getRiderDashboardData(context: RiderSessionContext, month?: string | null) {
  const driverId = context.driver?.id || "";
  const parts = monthParts(month);
  const { start, end } = monthRange(parts.value);
  const today = new Date();
  const dayStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayStart.getUTCDate() + 1);

  const [
    unreadNotifications,
    recentNotifications,
    pendingViolations,
    pendingWarnings,
    payrollItem,
    monthlyAdvances,
    attendanceToday,
    pendingDocuments,
    openTasks,
    latestViolation,
    latestWarning,
  ] = await Promise.all([
    prisma.notification.count({ where: { driverId, status: RecordStatus.PENDING } }),
    prisma.notification.findMany({ where: { driverId }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.violation.count({ where: { driverId, status: { in: [RecordStatus.PENDING, RecordStatus.APPROVED] } } }),
    prisma.driverWarning.count({ where: { driverId, status: RecordStatus.PENDING } }),
    latestPayrollItem(driverId, parts.value),
    prisma.advance.findMany({
      where: {
        driverId,
        OR: [{ deductionMonth: parts.value }, { advanceDate: { gte: start, lt: end } }],
      },
      orderBy: { advanceDate: "desc" },
    }),
    prisma.attendanceRecord.findFirst({ where: { driverId, workDate: { gte: dayStart, lt: dayEnd } }, orderBy: { updatedAt: "desc" } }),
    prisma.driverDocument.count({
      where: {
        driverId,
        OR: [{ status: RecordStatus.PENDING }, { verificationStatus: { not: "approved" } }, { expiryDate: { lte: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30) } }],
      },
    }),
    prisma.task.count({ where: { driverId, status: { in: [RecordStatus.PENDING, RecordStatus.ACTIVE] } } }),
    prisma.violation.findFirst({ where: { driverId }, orderBy: { occurredAt: "desc" } }),
    prisma.driverWarning.findFirst({ where: { driverId }, orderBy: { issuedAt: "desc" } }),
  ]);

  const activeAssignment = context.driver?.vehicleAssignments?.[0];
  return {
    driver: serializeDriver(context),
    month: parts.value,
    summary: {
      unreadNotifications,
      pendingViolations: pendingViolations + pendingWarnings,
      currentPayrollStatus: payrollItem?.payrollRun.status || "لم يتم التوليد",
      monthlyAdvances: monthlyAdvances.reduce((sum, advance) => sum + toNumber(advance.amount), 0),
      attendanceStatusToday: attendanceToday?.status || "لا يوجد تسجيل اليوم",
      assignedVehicle: activeAssignment?.vehicle?.plateArabic || activeAssignment?.vehicle?.plateAr || activeAssignment?.vehicle?.plateEn || context.driver?.vehicle?.plateEn || "-",
      pendingDocuments,
      openTasks,
    },
    recentNotifications: recentNotifications.map((notification) => ({
      id: notification.id,
      title: notification.title,
      body: notification.body,
      severity: notification.severity,
      status: notification.status,
      entityType: notification.entityType,
      entityId: notification.entityId,
      createdAt: iso(notification.createdAt),
    })),
    latestViolation: latestViolation
      ? { id: latestViolation.id, type: latestViolation.type, amount: toNumber(latestViolation.amount), status: latestViolation.status, date: iso(latestViolation.occurredAt), notes: latestViolation.notes }
      : null,
    latestWarning: latestWarning
      ? { id: latestWarning.id, type: latestWarning.type, status: latestWarning.status, date: iso(latestWarning.issuedAt), notes: latestWarning.notes }
      : null,
    payroll: payrollItem ? serializePayrollItem(payrollItem) : null,
  };
}

export async function getRiderNotifications(context: RiderSessionContext) {
  const rows = await prisma.notification.findMany({ where: { driverId: context.driver?.id }, orderBy: { createdAt: "desc" }, take: 100 });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    severity: row.severity,
    status: row.status,
    entityType: row.entityType,
    entityId: row.entityId,
    createdAt: iso(row.createdAt),
  }));
}

export async function getRiderViolations(context: RiderSessionContext) {
  const driverId = context.driver?.id || "";
  const [violations, warnings] = await Promise.all([
    prisma.violation.findMany({ where: { driverId }, include: { vehicle: true, payrollItem: { include: { payrollRun: true } } }, orderBy: { occurredAt: "desc" } }),
    prisma.driverWarning.findMany({ where: { driverId }, orderBy: { issuedAt: "desc" } }),
  ]);
  return [
    ...violations.map((row) => ({
      id: row.id,
      kind: "violation" as const,
      title: row.type,
      amount: toNumber(row.amount),
      status: row.status,
      date: iso(row.occurredAt),
      notes: row.notes,
      vehicle: row.vehicle?.plateArabic || row.vehicle?.plateEn || null,
      payrollImpact: row.payrollItem?.payrollRun ? `${row.payrollItem.payrollRun.year}-${String(row.payrollItem.payrollRun.month).padStart(2, "0")}` : null,
    })),
    ...warnings.map((row) => ({
      id: row.id,
      kind: "warning" as const,
      title: row.type,
      amount: 0,
      status: row.status,
      severity: row.severity,
      date: iso(row.issuedAt),
      notes: row.notes,
      payrollImpact: null,
    })),
  ].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
}

export async function getRiderPayroll(context: RiderSessionContext, month?: string | null) {
  const driverId = context.driver?.id || "";
  const parts = monthParts(month);
  const rows = await prisma.payrollItem.findMany({
    where: { driverId },
    include: {
      payrollRun: {
        include: {
          application: { select: { name: true } },
          applicationProject: { select: { name: true } },
          city: { select: { nameAr: true } },
        },
      },
      applicationAccount: {
        include: {
          application: { select: { name: true } },
          applicationProject: { select: { name: true } },
        },
      },
    },
    orderBy: [{ payrollRun: { year: "desc" } }, { payrollRun: { month: "desc" } }],
    take: 24,
  });
  const current = rows.find((row) => row.payrollRun.year === parts.year && row.payrollRun.month === parts.month) || rows[0] || null;
  return {
    month: parts.value,
    current: current ? serializePayrollItem(current) : null,
    history: rows.map(serializePayrollItem),
  };
}

export async function getRiderAdvances(context: RiderSessionContext) {
  const rows = await prisma.advance.findMany({
    where: { driverId: context.driver?.id },
    include: {
      applicationProject: { select: { name: true } },
      city: { select: { nameAr: true } },
      deductedPayrollRun: true,
    },
    orderBy: { advanceDate: "desc" },
    take: 100,
  });
  return rows.map((row) => ({
    id: row.id,
    referenceNumber: row.referenceNumber,
    project: row.applicationProject?.name || "-",
    city: row.city?.nameAr || "-",
    amount: toNumber(row.amount),
    remainingAmount: toNumber(row.remainingAmount),
    reason: row.reason,
    deductionMonth: row.deductionMonth,
    advanceDate: iso(row.advanceDate),
    status: row.status,
    isDeducted: row.isDeducted,
    payrollMonth: row.deductedPayrollRun ? `${row.deductedPayrollRun.year}-${String(row.deductedPayrollRun.month).padStart(2, "0")}` : null,
  }));
}

export async function getRiderAttendance(context: RiderSessionContext, month?: string | null) {
  const parts = monthParts(month);
  const { start, end } = monthRange(parts.value);
  const rows = await prisma.attendanceRecord.findMany({
    where: { driverId: context.driver?.id, workDate: { gte: start, lt: end } },
    orderBy: { workDate: "desc" },
  });
  return {
    month: parts.value,
    summary: {
      days: rows.length,
      checkedIn: rows.filter((row) => row.checkIn).length,
      checkedOut: rows.filter((row) => row.checkOut).length,
      hours: rows.reduce((sum, row) => sum + toNumber(row.workingHours), 0),
    },
    rows: rows.map((row) => ({
      id: row.id,
      workDate: iso(row.workDate),
      checkIn: iso(row.checkIn),
      checkOut: iso(row.checkOut),
      workingHours: toNumber(row.workingHours),
      status: row.status,
      hasCheckInPhoto: Boolean(row.checkInPhoto),
      hasCheckOutPhoto: Boolean(row.checkOutPhoto),
      notes: row.notes,
    })),
  };
}

export async function getRiderVehicle(context: RiderSessionContext) {
  const assignment = context.driver?.vehicleAssignments?.[0] || null;
  const vehicle = assignment?.vehicle || context.driver?.vehicle || null;
  return vehicle
    ? {
        id: vehicle.id,
        plate: vehicle.plateArabic || vehicle.plateAr || vehicle.plateEnglish || vehicle.plateEn,
        vehicleCode: vehicle.vehicleCode,
        brand: vehicle.brand,
        model: vehicle.model,
        year: vehicle.year,
        ownershipType: vehicle.ownershipType,
        rentalCompany: vehicle.rentalCompany,
        dailyRent: toNumber(vehicle.dailyRent),
        monthlyRent: toNumber(vehicle.monthlyRent),
        status: vehicle.status,
        assignmentStartDate: iso(assignment?.startDate),
        assignmentEndDate: iso(assignment?.endDate),
        notes: assignment?.notes || null,
      }
    : null;
}

export async function getRiderDocuments(context: RiderSessionContext) {
  const rows = await prisma.driverDocument.findMany({ where: { driverId: context.driver?.id }, orderBy: [{ expiryDate: "asc" }, { updatedAt: "desc" }] });
  return rows.map((row) => ({
    id: row.id,
    type: row.documentType || row.type,
    documentNumber: row.documentNumber,
    issueDate: iso(row.issueDate),
    expiryDate: iso(row.expiryDate),
    status: row.status,
    verificationStatus: row.verificationStatus,
    fileUrl: row.fileUrl,
    notes: row.notes,
  }));
}

export async function getRiderTasks(context: RiderSessionContext) {
  const rows = await prisma.task.findMany({ where: { driverId: context.driver?.id }, orderBy: [{ status: "asc" }, { dueDate: "asc" }], take: 100 });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    priority: row.priority,
    status: row.status,
    dueDate: iso(row.dueDate),
    notes: row.notes,
    createdAt: iso(row.createdAt),
  }));
}

export async function getRiderProfile(context: RiderSessionContext) {
  const [documents, housing, contracts] = await Promise.all([
    getRiderDocuments(context),
    prisma.driverHousing.findMany({ where: { driverId: context.driver?.id }, orderBy: { updatedAt: "desc" }, take: 10 }),
    prisma.driverContract.findMany({ where: { driverId: context.driver?.id }, orderBy: { updatedAt: "desc" }, take: 10 }),
  ]);
  return {
    driver: serializeDriver(context),
    documents,
    housing: housing.map((row) => ({
      id: row.id,
      housingType: row.housingType,
      accommodationType: row.accommodationType,
      location: row.location,
      roomNumber: row.roomNumber,
      monthlyCost: toNumber(row.monthlyCost),
      status: row.status,
      startDate: iso(row.startDate),
      endDate: iso(row.endDate),
    })),
    contracts: contracts.map((row) => ({
      id: row.id,
      contractType: row.contractType,
      sponsor: row.sponsor,
      status: row.status,
      startDate: iso(row.startDate),
      endDate: iso(row.endDate),
    })),
  };
}

export async function getRiderPageData(context: RiderSessionContext, section: RiderSection, month?: string | null) {
  const dashboard = await getRiderDashboardData(context, month);
  switch (section) {
    case "notifications":
      return { dashboard, section, notifications: await getRiderNotifications(context) };
    case "violations":
      return { dashboard, section, violations: await getRiderViolations(context) };
    case "payroll":
      return { dashboard, section, payrollPage: await getRiderPayroll(context, month) };
    case "advances":
      return { dashboard, section, advances: await getRiderAdvances(context) };
    case "attendance":
      return { dashboard, section, attendance: await getRiderAttendance(context, month) };
    case "vehicle":
      return { dashboard, section, vehicle: await getRiderVehicle(context) };
    case "documents":
      return { dashboard, section, documents: await getRiderDocuments(context) };
    case "tasks":
      return { dashboard, section, tasks: await getRiderTasks(context) };
    case "profile":
      return { dashboard, section, profile: await getRiderProfile(context) };
    case "support":
      return { dashboard, section };
    default:
      return { dashboard, section: "dashboard" as const };
  }
}
