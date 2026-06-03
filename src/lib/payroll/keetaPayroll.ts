import { PayrollStatus, Prisma, RecordStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveKeetaApplicationProject } from "@/lib/templates/templateConfig";

type GenerateKeetaPayrollInput = {
  month: string;
  cityId?: string;
  requestedBy?: string;
};

type KeetaPlanLike = {
  id: string;
  name: string;
  relationshipType: string;
  level: string | null;
  cityId: string | null;
  baseSalary: unknown;
  fixedAllowance: unknown;
  monthlyTargetOrders: number;
  workingDaysBase: number;
  shortageThresholdOrders: number;
  shortageDeductionRate: unknown;
  carAllowanceAmount: unknown;
  companyCarMonthlyRent: unknown;
  fuelAllowanceAmount: unknown;
  housingAllowanceAmount: unknown;
  communicationAllowanceAmount: unknown;
  extraOrderRate: unknown;
  bonusAmount: unknown;
  bonusCondition: unknown;
  carRentDeduction: unknown;
  fuelDeduction: unknown;
  internalPenaltyEnabled: boolean;
  salaryCalculationSource: string;
  useKeetaInvoiceAsSalaryBase: boolean;
  enableFreelancerUserDeduction?: boolean;
  freelancerUserDeductionAmount?: unknown;
  enableKafalaDeduction?: boolean;
  keetaDeductionSource?: string;
};

const APPROVED_TEXT = ["approved", "locked", "paid", "reviewed", "APPROVED", "LOCKED", "PAID", "Reviewed"];
const KEETA_WORKING_DAYS_BASE = 28;
const SALARY_PRORATION_DAYS = 30;
const VEHICLE_RENT_DAYS_BASE = 30;
const KEETA_SHORTAGE_THRESHOLD = 460;
const KEETA_SHORTAGE_RATE = 8;
const KEETA_CAR_AMOUNT = 1500;

function numberValue(value: unknown) {
  if (value instanceof Prisma.Decimal) return value.toNumber();
  if (typeof value === "object" && value && "toNumber" in value && typeof value.toNumber === "function") return Number(value.toNumber()) || 0;
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeLevel(value: unknown) {
  const text = clean(value).toUpperCase();
  if (text.includes("A")) return "A";
  if (text.includes("B")) return "B";
  if (text.includes("C")) return "C";
  return "";
}

function normalizeRelationship(value: unknown) {
  const text = clean(value).toLowerCase();
  if (!text) return "";
  if (["all", "default", "any"].includes(text)) return "all";
  if (text.includes("free") || text.includes("freelancer") || text.includes("حر")) return "freelancer";
  if (text.includes("ajeer") || text.includes("اجير") || text.includes("أجير")) return "ajeer";
  if (text.includes("sponsor") || text.includes("sponsorship") || text.includes("كفالة")) return "sponsorship";
  return text;
}

function normalizeVehicleOwnership(value: unknown, hasVehicle: boolean) {
  const text = clean(value).toLowerCase();
  if (text.includes("personal") || text.includes("own") || text.includes("شخص") || text.includes("خاص")) return "personal_car";
  if (text.includes("company") || text.includes("شركة") || text.includes("company_car")) return "company_car";
  if (text.includes("none") || text.includes("no_vehicle") || text.includes("بدون")) return "no_vehicle";
  return hasVehicle ? "company_car" : "no_vehicle";
}

function monthParts(month: string) {
  const safeMonth = /^\d{4}-\d{2}$/.test(month) ? month : "2026-04";
  const year = Number(safeMonth.slice(0, 4));
  const monthNumber = Number(safeMonth.slice(5, 7));
  const start = new Date(Date.UTC(year, monthNumber - 1, 1));
  const end = new Date(Date.UTC(year, monthNumber, 0, 23, 59, 59, 999));
  return { safeMonth, year, monthNumber, start, end };
}

function statusWhere(): Prisma.StringFilter {
  return { in: APPROVED_TEXT };
}

function isBonusDue(plan: KeetaPlanLike, metrics: { deliveredOrders: number; monthlyTargetOrders: number; onTimeRate: number; cancellationRate: number; rejectionRate: number }) {
  const rule = plan.bonusCondition && typeof plan.bonusCondition === "object" ? (plan.bonusCondition as Record<string, unknown>) : {};
  const needsTarget = rule.targetOrders === true;
  const minOnTime = numberValue(rule.minimumOnTime);
  const maxCancellation = numberValue(rule.maxCancellation);
  const maxRejection = numberValue(rule.maxRejection);
  if (needsTarget && metrics.monthlyTargetOrders > 0 && metrics.deliveredOrders < metrics.monthlyTargetOrders) return false;
  if (minOnTime > 0 && metrics.onTimeRate < minOnTime) return false;
  if (maxCancellation > 0 && metrics.cancellationRate > maxCancellation) return false;
  if (maxRejection > 0 && metrics.rejectionRate > maxRejection) return false;
  return true;
}

function average(values: number[]) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) return 0;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function sumBy<T>(rows: T[], selector: (row: T) => number) {
  return rows.reduce((sum, row) => sum + selector(row), 0);
}

function groupByDriver<T extends { driverId: string | null }>(rows: T[]) {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    if (!row.driverId) continue;
    const current = map.get(row.driverId) ?? [];
    current.push(row);
    map.set(row.driverId, current);
  }
  return map;
}

function pickLatestByDriver<T extends { driverId: string | null; approvedAt: Date | null; updatedAt: Date }>(rows: T[]) {
  const map = new Map<string, T>();
  for (const row of rows) {
    if (!row.driverId) continue;
    const existing = map.get(row.driverId);
    const rowTime = (row.approvedAt ?? row.updatedAt).getTime();
    const existingTime = existing ? (existing.approvedAt ?? existing.updatedAt).getTime() : 0;
    if (!existing || rowTime >= existingTime) map.set(row.driverId, row);
  }
  return map;
}

function selectBestPlan(plans: KeetaPlanLike[], deliveredOrders: number) {
  const sorted = plans.slice().sort((a, b) => a.monthlyTargetOrders - b.monthlyTargetOrders);
  const eligible = sorted.filter((plan) => plan.monthlyTargetOrders > 0 && deliveredOrders >= plan.monthlyTargetOrders);
  if (eligible.length) return eligible[eligible.length - 1];
  return sorted.find((plan) => plan.monthlyTargetOrders >= KEETA_SHORTAGE_THRESHOLD) ?? sorted[0] ?? null;
}

function findPlan(plans: KeetaPlanLike[], args: { relationshipType: string; level: string; cityId?: string | null; deliveredOrders: number }) {
  const relationship = normalizeRelationship(args.relationshipType);
  const level = normalizeLevel(args.level);
  const relationshipMatches = (plan: KeetaPlanLike) => {
    const planRelationship = normalizeRelationship(plan.relationshipType);
    return planRelationship === relationship || planRelationship === "all";
  };
  const buckets = [
    plans.filter((plan) => relationshipMatches(plan) && normalizeLevel(plan.level) === level && plan.cityId && plan.cityId === args.cityId),
    plans.filter((plan) => relationshipMatches(plan) && normalizeLevel(plan.level) === level && !plan.cityId),
    plans.filter((plan) => relationshipMatches(plan) && !plan.level && plan.cityId && plan.cityId === args.cityId),
    plans.filter((plan) => relationshipMatches(plan) && !plan.level && !plan.cityId),
  ];
  for (const bucket of buckets) {
    const plan = selectBestPlan(bucket, args.deliveredOrders);
    if (plan) return plan;
  }
  return null;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function prorateBaseSalary(baseSalary: number, workedDays: number, workingDaysBase: number) {
  const fullMonthThreshold = Math.max(1, workingDaysBase || KEETA_WORKING_DAYS_BASE);
  const days = Math.max(0, Math.round(workedDays || 0));
  if (days >= fullMonthThreshold) return roundMoney(baseSalary);
  return roundMoney(baseSalary * (days / SALARY_PRORATION_DAYS));
}

function safeDays(value: number) {
  return Math.max(0, Math.min(Math.round(value || 0), 31));
}

function startOfUtcDate(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function endOfUtcDate(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 23, 59, 59, 999));
}

function inclusiveOverlapDays(rangeStart: Date, rangeEnd: Date, itemStart?: Date | null, itemEnd?: Date | null) {
  if (!itemStart) return 0;
  const start = startOfUtcDate(new Date(Math.max(startOfUtcDate(rangeStart).getTime(), startOfUtcDate(itemStart).getTime())));
  const endLimit = itemEnd ? endOfUtcDate(itemEnd) : endOfUtcDate(rangeEnd);
  const end = endOfUtcDate(new Date(Math.min(endOfUtcDate(rangeEnd).getTime(), endLimit.getTime())));
  if (end.getTime() < start.getTime()) return 0;
  return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
}

function planAllowances(plan: KeetaPlanLike) {
  const fuel = numberValue(plan.fuelAllowanceAmount);
  const housing = numberValue(plan.housingAllowanceAmount);
  const communication = numberValue(plan.communicationAllowanceAmount);
  if (fuel || housing || communication) return { fuel, housing, communication };
  return { fuel: 0, housing: numberValue(plan.fixedAllowance), communication: 0 };
}

function deductionBucket(row: { type?: string | null; notes?: string | null }) {
  const text = `${row.type ?? ""} ${row.notes ?? ""}`.toLowerCase();
  if (text.includes("kafala") || text.includes("sponsor") || text.includes("خصم كفالة") || text.includes("كفالة") || /\bk\b/.test(text)) return "kafala";
  if (text.includes("housing") || text.includes("سكن")) return "housing";
  if (text.includes("vehicle") || text.includes("car") || text.includes("سيارة") || text.includes("مرحل السيارات")) return "vehicle";
  if (text.includes("bike") || text.includes("دباب")) return "bike";
  if (text.includes("damage") || text.includes("تلف")) return "vehicleDamage";
  if (text.includes("accident") || text.includes("حادث")) return "accident";
  if (text.includes("admin") || text.includes("اداري") || text.includes("إداري") || text.includes("مرحل")) return "admin";
  return "manual";
}

export async function ensureKeetaPayrollFieldRules(applicationProjectId?: string, applicationId?: string) {
  return prisma.payrollFieldRule.upsert({
    where: { fieldKey_applicationProjectId: { fieldKey: "totalPayableAmount", applicationProjectId: applicationProjectId ?? "" } },
    update: {
      labelAr: "مستحق الشركة من كيتا",
      labelEn: "Keeta Payable to Company",
      category: "invoice",
      calculationRole: "company_revenue",
      projectId: "keeta",
      applicationId,
      applicationProjectId,
      affectsPayroll: false,
      affectsFinalSalary: false,
      visibleInPayroll: true,
      visibleInDetails: true,
      visibleInReports: true,
      includedInBaseAmount: false,
      active: true,
    },
    create: {
      fieldKey: "totalPayableAmount",
      labelAr: "مستحق الشركة من كيتا",
      labelEn: "Keeta Payable to Company",
      category: "invoice",
      calculationRole: "company_revenue",
      projectId: "keeta",
      applicationId,
      applicationProjectId,
      affectsPayroll: false,
      affectsFinalSalary: false,
      visibleInPayroll: true,
      visibleInDetails: true,
      visibleInReports: true,
      includedInBaseAmount: false,
      active: true,
    },
  });
}

async function ensureDefaultKeetaPayrollPlans(applicationProjectId: string) {
  const defaults = [
    { target: 560, level: "A", baseSalary: 2000, fuel: 1100, bonus: 1800 },
    { target: 560, level: "B", baseSalary: 2000, fuel: 1100, bonus: 1300 },
    { target: 560, level: "C", baseSalary: 2000, fuel: 1100, bonus: 800 },
    { target: 460, level: "A", baseSalary: 1500, fuel: 900, bonus: 1200 },
    { target: 460, level: "B", baseSalary: 1500, fuel: 900, bonus: 700 },
    { target: 460, level: "C", baseSalary: 1500, fuel: 900, bonus: 200 },
  ];

  for (const item of defaults) {
    const name = `Keeta ${item.target} Level ${item.level}`;
    const existing = await prisma.keetaPayrollPlan.findFirst({
      where: { projectId: "keeta", applicationProjectId, relationshipType: "all", level: item.level, monthlyTargetOrders: item.target },
      select: { id: true },
    });
    if (existing) continue;
    await prisma.keetaPayrollPlan.create({
      data: {
        projectId: "keeta",
        applicationProjectId,
        name,
        relationshipType: "all",
        level: item.level,
        baseSalary: item.baseSalary,
        fixedAllowance: 0,
        monthlyTargetOrders: item.target,
        workingDaysBase: KEETA_WORKING_DAYS_BASE,
        shortageThresholdOrders: KEETA_SHORTAGE_THRESHOLD,
        shortageDeductionRate: KEETA_SHORTAGE_RATE,
        carAllowanceAmount: KEETA_CAR_AMOUNT,
        companyCarMonthlyRent: KEETA_CAR_AMOUNT,
        fuelAllowanceAmount: item.fuel,
        housingAllowanceAmount: 300,
        communicationAllowanceAmount: 100,
        extraOrderRate: KEETA_SHORTAGE_RATE,
        bonusAmount: item.bonus,
        bonusCondition: { targetOrders: false },
        carRentDeduction: 0,
        fuelDeduction: 0,
        internalPenaltyEnabled: true,
        salaryCalculationSource: "payroll_plan",
        useKeetaInvoiceAsSalaryBase: false,
        enableFreelancerUserDeduction: true,
        freelancerUserDeductionAmount: 300,
        enableKafalaDeduction: true,
        keetaDeductionSource: "riderDetail",
        active: true,
      },
    });
  }
}

export async function generateKeetaPayroll(input: GenerateKeetaPayrollInput) {
  const { safeMonth, year, monthNumber, start, end } = monthParts(input.month);
  const applicationProject = await resolveKeetaApplicationProject();
  await ensureKeetaPayrollFieldRules(applicationProject.id, applicationProject.applicationId);
  await ensureDefaultKeetaPayrollPlans(applicationProject.id);

  const recordScope = {
    applicationProjectId: applicationProject.id,
    month: safeMonth,
    ...(input.cityId ? { cityId: input.cityId } : {}),
    status: statusWhere(),
  };

  const [rankRecords, performanceRecords, invoiceRecords, plans] = await Promise.all([
    prisma.keetaRankRecord.findMany({ where: recordScope, orderBy: [{ approvedAt: "desc" }, { updatedAt: "desc" }] }),
    prisma.keetaPerformanceRecord.findMany({ where: recordScope, orderBy: [{ reportDate: "asc" }] }),
    prisma.keetaInvoiceRecord.findMany({ where: recordScope, orderBy: [{ approvedAt: "desc" }, { updatedAt: "desc" }] }),
    prisma.keetaPayrollPlan.findMany({
      where: { active: true, projectId: "keeta", OR: [{ applicationProjectId: applicationProject.id }, { applicationProjectId: null }] },
      orderBy: [{ cityId: "desc" }, { relationshipType: "asc" }, { level: "asc" }],
    }),
  ]);

  const rankByDriver = pickLatestByDriver(rankRecords);
  const performanceByDriver = groupByDriver(performanceRecords);
  const invoiceByDriver = pickLatestByDriver(invoiceRecords);
  const driverIds = Array.from(new Set([...rankByDriver.keys(), ...performanceByDriver.keys(), ...invoiceByDriver.keys()]));

  const unmatchedCourierIds = [
    ...rankRecords.filter((row) => !row.driverId).map((row) => row.courierId),
    ...performanceRecords.filter((row) => !row.driverId).map((row) => row.courierId),
    ...invoiceRecords.filter((row) => !row.driverId).map((row) => row.courierId),
  ].filter(Boolean);

  if (!rankRecords.length || !performanceRecords.length || !invoiceRecords.length) {
    return {
      ok: false as const,
      status: 422,
      error: "لا يمكن إنشاء مسير Keeta قبل اعتماد Rank وتقرير أداء وفاتورة Keeta لنفس الفترة.",
      details: {
        missingRank: !rankRecords.length,
        missingPerformanceReport: !performanceRecords.length,
        missingInvoice: !invoiceRecords.length,
      },
    };
  }

  if (unmatchedCourierIds.length) {
    return {
      ok: false as const,
      status: 422,
      error: "لا يمكن إنشاء مسير Keeta قبل حل Courier ID غير المتطابق.",
      details: { unmatchedCourierIds: Array.from(new Set(unmatchedCourierIds)).slice(0, 50) },
    };
  }

  if (!driverIds.length) {
    return { ok: false as const, status: 422, error: "لا توجد مناديب متطابقة لإنشاء مسير Keeta.", details: {} };
  }

  const [drivers, advances, deductions, violations, fuelRecords] = await Promise.all([
    prisma.driver.findMany({
      where: { id: { in: driverIds }, ...(input.cityId ? { cityId: input.cityId } : {}) },
      include: {
        city: true,
        project: true,
        supervisor: true,
        vehicle: true,
        vehicleAssignments: {
          where: {
            startDate: { lte: end },
            OR: [{ endDate: null }, { endDate: { gte: start } }],
            status: RecordStatus.ACTIVE,
          },
          include: { vehicle: true },
          orderBy: { startDate: "desc" },
        },
        applicationAccounts: { where: { applicationProjectId: applicationProject.id }, take: 1 },
        account: true,
      },
    }),
    prisma.advance.findMany({ where: { driverId: { in: driverIds }, deductionMonth: safeMonth, status: RecordStatus.APPROVED }, select: { driverId: true, amount: true } }),
    prisma.deduction.findMany({ where: { driverId: { in: driverIds }, month: safeMonth, status: RecordStatus.APPROVED }, select: { driverId: true, amount: true, type: true, notes: true } }),
    prisma.violation.findMany({ where: { driverId: { in: driverIds }, occurredAt: { gte: start, lte: end }, status: { in: [RecordStatus.APPROVED, RecordStatus.PENDING] } }, select: { driverId: true, amount: true, type: true, notes: true } }),
    prisma.fuelRecord.findMany({ where: { driverId: { in: driverIds }, fuelDate: { gte: start, lte: end }, status: { in: [RecordStatus.APPROVED, RecordStatus.PENDING] } }, select: { driverId: true, amount: true } }),
  ]);

  const driverMap = new Map(drivers.map((driver) => [driver.id, driver]));
  const amountMap = <T extends { driverId: string; amount: unknown }>(rows: T[]) => {
    const map = new Map<string, number>();
    rows.forEach((row) => map.set(row.driverId, (map.get(row.driverId) ?? 0) + numberValue(row.amount)));
    return map;
  };
  const classifiedDeductionMap = new Map<string, Record<string, number>>();
  for (const row of deductions) {
    const bucket = deductionBucket(row);
    const current = classifiedDeductionMap.get(row.driverId) ?? {};
    current[bucket] = (current[bucket] ?? 0) + numberValue(row.amount);
    classifiedDeductionMap.set(row.driverId, current);
  }
  const advanceMap = amountMap(advances);
  const violationMap = amountMap(violations);
  const fuelMap = amountMap(fuelRecords);

  const planProblems: string[] = [];
  const rows: Array<{ values: Record<string, any> }> = [];

  for (const driverId of driverIds) {
    const driver = driverMap.get(driverId);
    const rank = rankByDriver.get(driverId);
    const reportRows = performanceByDriver.get(driverId) ?? [];
    const invoice = invoiceByDriver.get(driverId);
    if (!driver) {
      planProblems.push(`driverId غير موجود: ${driverId}`);
      continue;
    }

    const level = normalizeLevel(rank?.currentEstimatedLevel);
    const relationshipType = normalizeRelationship(driver.contractType || driver.sponsorshipType);
    if (!level) planProblems.push(`${driver.actualName || driver.name}: لا يوجد Level معتمد.`);
    if (!relationshipType) planProblems.push(`${driver.actualName || driver.name}: لا يوجد نوع علاقة/عقد.`);

    const deliveredOrders = sumBy(reportRows, (row) => row.deliveredTasks ?? 0);
    const validDaysRaw = reportRows.filter((row) => row.validDay).length || Math.round(numberValue(invoice?.onlineDaysValid));
    const validDays = safeDays(validDaysRaw);
    const onlineHours = sumBy(reportRows, (row) => numberValue(row.validOnlineTime || row.courierAppOnlineTime));
    const onTimeRate = average(reportRows.map((row) => numberValue(row.onTimeRate)));
    const cancellationRate = average(reportRows.map((row) => numberValue(row.cancellationRateFromDeliveryIssues)));
    const rejectedTasks = sumBy(reportRows, (row) => (row.rejectedTasks ?? 0) + (row.rejectedTasksCourier ?? 0) + (row.rejectedTasksAuto ?? 0));
    const acceptedTasks = sumBy(reportRows, (row) => row.acceptedTasks ?? 0);
    const rejectionRate = acceptedTasks > 0 ? (rejectedTasks / acceptedTasks) * 100 : 0;

    const plan = findPlan(plans, { relationshipType, level, cityId: driver.cityId, deliveredOrders });
    if (!plan) {
      planProblems.push(`${driver.actualName || driver.name}: لا توجد Payroll Plan مناسبة (${relationshipType || "بدون علاقة"} / ${level || "بدون Level"}).`);
      continue;
    }
    if (plan.useKeetaInvoiceAsSalaryBase || plan.salaryCalculationSource !== "payroll_plan") {
      planProblems.push(`${plan.name}: إعداد غير آمن، مستحق Keeta لا يجوز استخدامه كأساس راتب.`);
      continue;
    }

    const monthlyTargetOrders = plan.monthlyTargetOrders;
    const extraOrders = Math.max(0, deliveredOrders - monthlyTargetOrders);
    const extraOrderRate = numberValue(plan.extraOrderRate);
    const baseSalaryBeforeProration = numberValue(plan.baseSalary);
    const salaryBaseWorkingDays = Math.max(1, plan.workingDaysBase || KEETA_WORKING_DAYS_BASE);
    const workedDaysForSalary = safeDays(validDays);
    const baseSalary = prorateBaseSalary(baseSalaryBeforeProration, workedDaysForSalary, salaryBaseWorkingDays);
    const allowances = planAllowances(plan);
    const fuelAllowance = allowances.fuel;
    const manualBonus = allowances.housing + allowances.communication;
    const hasLinkedVehicle = Boolean(driver.vehicleId || driver.vehicle);
    const vehicleOwnershipType = normalizeVehicleOwnership(driver.vehicleOwnershipType, hasLinkedVehicle);
    const activeAssignment = driver.vehicleAssignments[0];
    const activeVehicle = activeAssignment?.vehicle || driver.vehicle;
    const vehicleId = activeVehicle?.id || driver.vehicleId || null;
    const vehicleMonthlyRent =
      numberValue(activeVehicle?.monthlyRent) || numberValue(plan.companyCarMonthlyRent) || numberValue(plan.carRentDeduction) || KEETA_CAR_AMOUNT;
    const vehicleDailyRent = numberValue(activeVehicle?.dailyRent) || vehicleMonthlyRent / VEHICLE_RENT_DAYS_BASE;
    const vehicleRentDays = vehicleOwnershipType === "company_car" ? inclusiveOverlapDays(start, end, activeAssignment?.startDate, activeAssignment?.endDate) : 0;
    const carAllowance = vehicleOwnershipType === "personal_car" ? numberValue(plan.carAllowanceAmount) || KEETA_CAR_AMOUNT : 0;
    const vehicleRentDisplayAmount = vehicleOwnershipType === "company_car" ? roundMoney(vehicleDailyRent * vehicleRentDays) : 0;
    const carRentDeduction = 0;
    const shortageThresholdOrders = plan.shortageThresholdOrders || KEETA_SHORTAGE_THRESHOLD;
    const shortageOrders = Math.max(0, shortageThresholdOrders - deliveredOrders);
    const shortageDeduction = shortageOrders * (numberValue(plan.shortageDeductionRate) || KEETA_SHORTAGE_RATE);
    const levelBonus = isBonusDue(plan, { deliveredOrders, monthlyTargetOrders, onTimeRate, cancellationRate, rejectionRate }) ? numberValue(plan.bonusAmount) : 0;
    const extraOrdersBonus = extraOrders * extraOrderRate;
    const grossSalary = baseSalary + fuelAllowance + carAllowance + manualBonus + levelBonus + extraOrdersBonus;

    const deductionBuckets = classifiedDeductionMap.get(driverId) ?? {};
    const adminCarryoverDeduction = deductionBuckets.admin ?? 0;
    const housingDeduction = deductionBuckets.housing ?? 0;
    const vehicleCarryoverDeduction = deductionBuckets.vehicle ?? 0;
    const vehicleDamageDeduction = deductionBuckets.vehicleDamage ?? 0;
    const accidentLiabilityDeduction = deductionBuckets.accident ?? 0;
    const bikeRentDeduction = deductionBuckets.bike ?? 0;
    const kafalaDeduction = plan.enableKafalaDeduction === false ? 0 : (deductionBuckets.kafala ?? 0);
    const manualInternalDeduction = deductionBuckets.manual ?? 0;
    const internalAdvances = advanceMap.get(driverId) ?? 0;
    const advanceDeduction = internalAdvances;
    const trafficViolationDeduction = plan.internalPenaltyEnabled ? (violationMap.get(driverId) ?? 0) : 0;
    const internalPenalties = plan.internalPenaltyEnabled
      ? adminCarryoverDeduction + housingDeduction + vehicleCarryoverDeduction + vehicleDamageDeduction + accidentLiabilityDeduction + bikeRentDeduction + manualInternalDeduction + trafficViolationDeduction
      : 0;
    const fuelDeduction = numberValue(plan.fuelDeduction) + (fuelMap.get(driverId) ?? 0);
    const keetaDeduction = numberValue(invoice?.deduction);
    const keetaFoodCompensation = numberValue(invoice?.foodCompensation);
    const keetaTgaDeduction = numberValue(invoice?.tgaDeductionVatExcluded);
    const totalAppDeductions = roundMoney(keetaDeduction + keetaFoodCompensation + keetaTgaDeduction);
    const userDeduction =
      relationshipType === "freelancer" && plan.enableFreelancerUserDeduction !== false
        ? numberValue(plan.freelancerUserDeductionAmount) || 300
        : 0;
    const manualDeduction = shortageDeduction + manualInternalDeduction;
    const totalDeductions = roundMoney(
      adminCarryoverDeduction +
        housingDeduction +
        trafficViolationDeduction +
        fuelDeduction +
        advanceDeduction +
        totalAppDeductions +
        vehicleCarryoverDeduction +
        vehicleDamageDeduction +
        accidentLiabilityDeduction +
        bikeRentDeduction +
        kafalaDeduction +
        userDeduction +
        manualInternalDeduction +
        shortageDeduction,
    );
    const finalSalary = roundMoney(grossSalary - totalDeductions);
    const companyRevenueFromKeeta = numberValue(invoice?.totalPayableAmount);
    const keetaDeductions = totalAppDeductions;
    const keetaIncentives =
      numberValue(invoice?.validDaCapacityIncentives) +
      numberValue(invoice?.experienceIncentive) +
      numberValue(invoice?.dxgy) +
      numberValue(invoice?.subsidy) +
      numberValue(invoice?.activitiesAndOtherRewards) +
      numberValue(invoice?.tipsExcludingTax);
    const companyGrossRevenue = companyRevenueFromKeeta;
    const estimatedCompanyProfit = roundMoney(companyRevenueFromKeeta - finalSalary - vehicleRentDisplayAmount - fuelDeduction);
    const costPerOrder = deliveredOrders > 0 ? finalSalary / deliveredOrders : 0;
    const warnings = [];
    if (!invoice || companyRevenueFromKeeta === 0) warnings.push("لا يوجد إيراد كيتا معتمد لهذا المندوب، راجع الفاتورة قبل اعتماد المسير.");
    if (!rank) warnings.push("لا يوجد Rank معتمد لهذا المندوب في الفترة المحددة.");
    if (!reportRows.length) warnings.push("لا يوجد تقرير أداء Keeta معتمد لهذا المندوب في الفترة المحددة.");

    rows.push({
      values: {
        driverId,
        applicationAccountId: invoice?.applicationAccountId || rank?.applicationAccountId || driver.applicationAccounts[0]?.id || driver.accountId || null,
        vehicleId,
        vehicleOwnershipType,
        vehicleRentDays,
        vehicleDailyRent,
        vehicleMonthlyRent,
        vehicleRentDisplayAmount,
        orders: deliveredOrders,
        deliveredOrders,
        extraOrders,
        workingHours: onlineHours,
        onTimeRate,
        cancellationRate,
        rejectionRate,
        level,
        salaryBaseWorkingDays,
        workedDaysForSalary,
        baseSalaryBeforeProration,
        shortageOrders,
        shortageDeduction,
        basicSalary: baseSalary,
        extraOrdersBonus,
        performanceBonus: levelBonus,
        totalEarnings: grossSalary,
        rentalDays: vehicleRentDays || validDays,
        carRent: carAllowance,
        advancesTotal: internalAdvances,
        violationsTotal: internalPenalties,
        fuelTotal: fuelAllowance,
        appDeductionsTotal: totalAppDeductions,
        adminCarryoverDeduction,
        housingDeduction,
        trafficViolationDeduction,
        advanceDeduction,
        keetaDeduction,
        keetaFoodCompensation,
        keetaTgaDeduction,
        totalAppDeductions,
        vehicleCarryoverDeduction,
        vehicleDamageDeduction,
        accidentLiabilityDeduction,
        bikeRentDeduction,
        kafalaDeduction,
        kafalaDeductionNotes: kafalaDeduction ? "خصم كفالة من الخصومات المعتمدة" : null,
        kafalaDeductionSource: kafalaDeduction ? "KAFALA_DEDUCTION" : null,
        userDeduction,
        userDeductionApplied: userDeduction > 0,
        userDeductionReason: userDeduction > 0 ? "خصم يوزر فريلانسر من PayrollPlan" : null,
        damagesTotal: 0,
        accidentDeduction: 0,
        otherDeductions: manualDeduction,
        totalDeductions,
        netSalary: finalSalary,
        salaryPlanId: plan.id,
        relationshipType,
        monthlyTargetOrders,
        extraOrderRate,
        levelBonus,
        manualBonus,
        grossSalary,
        internalAdvances,
        internalPenalties,
        carRentDeduction,
        fuelDeduction,
        manualDeduction,
        finalSalary,
        companyRevenueFromKeeta,
        keetaTotalPayableAmount: companyRevenueFromKeeta,
        keetaDeductions,
        keetaIncentives,
        companyGrossRevenue,
        estimatedCompanyProfit,
        costPerOrder,
        status: warnings.length ? "review" : "draft",
        notes: warnings.join(" | "),
      },
    });
  }

  if (planProblems.length) {
    await prisma.auditLog.create({
      data: {
        user: input.requestedBy || "Admin",
        action: "BLOCK_KEETA_PAYROLL_WITHOUT_PLAN",
        entityType: "PayrollRun",
        entityId: safeMonth,
        newValue: { month: safeMonth, problems: planProblems.slice(0, 100) },
      },
    });
    return {
      ok: false as const,
      status: 422,
      error: "لا يمكن إنشاء مسير Keeta قبل إعداد Payroll Plan وحل مشاكل Level/نوع العلاقة.",
      details: { problems: planProblems.slice(0, 100) },
    };
  }

  const totals = {
    totalDrivers: rows.length,
    totalOrders: rows.reduce((sum, row) => sum + row.values.deliveredOrders, 0),
    totalEarnings: rows.reduce((sum, row) => sum + row.values.grossSalary, 0),
    totalDeductions: rows.reduce((sum, row) => sum + row.values.totalDeductions, 0),
    netTotal: rows.reduce((sum, row) => sum + row.values.finalSalary, 0),
    totalCompanyRevenue: rows.reduce((sum, row) => sum + row.values.companyRevenueFromKeeta, 0),
    estimatedCompanyProfit: rows.reduce((sum, row) => sum + row.values.estimatedCompanyProfit, 0),
  };

  const existingRun = await prisma.payrollRun.findFirst({
    where: {
      applicationProjectId: applicationProject.id,
      cityId: input.cityId || applicationProject.cityId,
      year,
      month: monthNumber,
      status: { notIn: [PayrollStatus.APPROVED, PayrollStatus.PAID, PayrollStatus.LOCKED] },
    },
    orderBy: { updatedAt: "desc" },
  });

  const run = await prisma.$transaction(async (tx) => {
    const payrollRun = existingRun
      ? await tx.payrollRun.update({
          where: { id: existingRun.id },
          data: {
            status: PayrollStatus.DRAFT,
            totalDrivers: totals.totalDrivers,
            totalOrders: totals.totalOrders,
            totalEarnings: totals.totalEarnings,
            totalDeductions: totals.totalDeductions,
            netTotal: totals.netTotal,
            totalCompanyRevenue: totals.totalCompanyRevenue,
            estimatedCompanyProfit: totals.estimatedCompanyProfit,
          },
        })
      : await tx.payrollRun.create({
          data: {
            month: monthNumber,
            year,
            applicationId: applicationProject.applicationId,
            applicationProjectId: applicationProject.id,
            cityId: input.cityId || applicationProject.cityId,
            status: PayrollStatus.DRAFT,
            totalDrivers: totals.totalDrivers,
            totalOrders: totals.totalOrders,
            totalEarnings: totals.totalEarnings,
            totalDeductions: totals.totalDeductions,
            netTotal: totals.netTotal,
            totalCompanyRevenue: totals.totalCompanyRevenue,
            estimatedCompanyProfit: totals.estimatedCompanyProfit,
          },
        });

    if (existingRun) await tx.payrollItem.deleteMany({ where: { payrollRunId: payrollRun.id } });

    for (const row of rows) {
      await tx.payrollItem.create({ data: { payrollRunId: payrollRun.id, ...row.values } as Prisma.PayrollItemUncheckedCreateInput });
    }

    await tx.auditLog.create({
      data: {
        user: input.requestedBy || "Admin",
        action: "GENERATE_KEETA_PAYROLL_FROM_PLAN",
        entityType: "PayrollRun",
        entityId: payrollRun.id,
        newValue: {
          month: safeMonth,
          formula: "finalSalary = payrollPlan base/fixed/bonus/extraOrders - internal deductions. totalPayableAmount is company_revenue only.",
          totals,
        },
      },
    });

    return payrollRun;
  });

  return {
    ok: true as const,
    data: {
      month: safeMonth,
      payrollRunId: run.id,
      created: rows.length,
      updated: existingRun ? rows.length : 0,
      skippedLocked: 0,
      totalNet: totals.netTotal,
      companyRevenueFromKeeta: totals.totalCompanyRevenue,
      estimatedCompanyProfit: totals.estimatedCompanyProfit,
    },
  };
}

export function isKeetaPayrollRequest(args: { appName?: string; projectName?: string; projectId?: string }) {
  const text = `${args.appName ?? ""} ${args.projectName ?? ""} ${args.projectId ?? ""}`.toLowerCase();
  return text.includes("keeta") || text.includes("kita") || args.projectId === "keeta";
}
