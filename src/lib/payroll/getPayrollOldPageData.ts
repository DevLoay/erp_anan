import type { PayrollStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { databaseOfflineMessage } from "@/lib/imports/templates";
import { getFilterOptions } from "@/lib/reporting";

type SearchParams = Record<string, string | string[] | undefined>;

function one(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function toNumber(value: unknown) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") return Number(value.toNumber()) || 0;
  if (typeof value === "object" && "toString" in value) return Number(value.toString()) || 0;
  return Number(value) || 0;
}

function formatMonth(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

function monthRange(month: string) {
  const safeMonth = /^\d{4}-\d{2}$/.test(month) ? month : formatMonth();
  const start = new Date(`${safeMonth}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { safeMonth, start, end, year: start.getUTCFullYear(), monthNumber: start.getUTCMonth() + 1 };
}

function monthDays(year: number, monthNumber: number) {
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}

function capDays(value: number, maxDays: number) {
  return Math.max(0, Math.min(Math.round(value || 0), maxDays));
}


const COMPANY_CAR_FULL_MONTH_RENT = 2000;
const VEHICLE_RENT_DAYS_BASE = 30;
const COMPANY_CAR_DAILY_RENT = COMPANY_CAR_FULL_MONTH_RENT / VEHICLE_RENT_DAYS_BASE;
const PERSONAL_CAR_USER_DEDUCTION = 300;

function companyCarRentByDays(days: number) {
  const rentDays = capDays(days, VEHICLE_RENT_DAYS_BASE);
  if (rentDays <= 0) return 0;
  return Math.round(Math.min(COMPANY_CAR_FULL_MONTH_RENT, rentDays * COMPANY_CAR_DAILY_RENT) * 100) / 100;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "مسودة",
    DRAFT: "مسودة",
    under_review: "قيد المراجعة",
    UNDER_REVIEW: "قيد المراجعة",
    approved: "معتمد",
    APPROVED: "معتمد",
    paid: "مدفوع",
    PAID: "مدفوع",
    locked: "مقفل",
    LOCKED: "مقفل",
  };
  return labels[status] ?? status;
}

function statusTone(status: string): "slate" | "amber" | "emerald" | "blue" | "red" {
  if (["APPROVED", "approved", "PAID", "paid"].includes(status)) return "emerald";
  if (["LOCKED", "locked"].includes(status)) return "blue";
  if (["UNDER_REVIEW", "under_review"].includes(status)) return "amber";
  if (String(status).toLowerCase().includes("reject")) return "red";
  return "slate";
}

function levelTone(level: string): "slate" | "emerald" | "blue" | "red" | "amber" {
  if (level === "A") return "emerald";
  if (level === "B") return "blue";
  if (level === "C") return "red";
  return "slate";
}

function normalizeVehicleOwnership(value: unknown, hasVehicle = false) {
  const text = String(value ?? "").trim().toLowerCase();
  if (text.includes("شخص") || text.includes("خاص")) return "personal_car";
  if (text.includes("شركة") || text.includes("شركه")) return "company_car";
  if (text.includes("بدون")) return "no_vehicle";
  if (["company_car", "company", "شركة", "سيارة شركة"].some((token) => text.includes(token))) return "company_car";
  if (["personal_car", "personal", "own", "شخصية", "خاص"].some((token) => text.includes(token))) return "personal_car";
  if (["no_vehicle", "none", "بدون"].some((token) => text.includes(token))) return "no_vehicle";
  return hasVehicle ? "company_car" : "no_vehicle";
}

function vehicleOwnershipLabel(value: string) {
  if (value === "company_car") return "سيارة شركة";
  if (value === "personal_car") return "سيارة شخصية";
  return "بدون سيارة";
}

function effectiveVehicleOwnership(storedItem: unknown, storedDriver: unknown, hasVehicle: boolean) {
  const itemText = String(storedItem ?? "").trim();
  const driverText = String(storedDriver ?? "").trim();
  const meaningful = [itemText, driverText].find((value) => value && !["no_vehicle", "none", "بدون سيارة"].includes(value.toLowerCase()));
  return normalizeVehicleOwnership(meaningful, hasVehicle);
}

function groupSum<T extends { driverId: string; amount?: unknown }>(rows: T[]) {
  const map = new Map<string, number>();
  for (const row of rows) map.set(row.driverId, (map.get(row.driverId) ?? 0) + toNumber(row.amount));
  return map;
}

function noteNumber(notes: string, keys: string[]) {
  for (const key of keys) {
    const patterns = [
      new RegExp(`${key}\\s*=\\s*(-?\\d+(?:\\.\\d+)?)`, "i"),
      new RegExp(`${key}\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`, "i"),
      new RegExp(`"${key}"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`, "i"),
    ];

    for (const pattern of patterns) {
      const match = notes.match(pattern);
      if (match?.[1] !== undefined) return Number(match[1]) || 0;
    }
  }

  return 0;
}

function noteText(notes: string, keys: string[]) {
  for (const key of keys) {
    const patterns = [
      new RegExp(`${key}\\s*=\\s*([^|,}\\n]+)`, "i"),
      new RegExp(`${key}\\s*:\\s*([^|,}\\n]+)`, "i"),
      new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`, "i"),
    ];

    for (const pattern of patterns) {
      const match = notes.match(pattern);
      if (match?.[1]) return match[1].trim();
    }
  }

  return "";
}

function salarySlabLabelByOrders(orders: number) {
  if (orders < 350) return "أقل من 350";
  if (orders <= 409) return "350 - 409";
  if (orders <= 459) return "410 - 459";
  if (orders <= 509) return "460 - 509";
  return "510 فأكثر";
}

export type PayrollOldFilters = {
  month: string;
  cityId: string;
  projectId: string;
  vehicleOwnershipType: string;
  deductionFilter: string;
  status: string;
  q: string;
};

export type PayrollOldRow = {
  id: string;
  source: "payrollItem" | "legacyPayroll";
  payrollItemId: string;
  payrollId: string;
  payrollRunId: string;
  driverId: string;
  driverCode: string;
  driverName: string;
  nationalId: string;
  city: string;
  project: string;
  appName: string;
  supervisor: string;
  account: string;
  vehiclePlate: string;
  vehicleOwnershipType: string;
  vehicleOwnershipLabel: string;
  vehicleRentDays: number;
  vehicleDailyRent: number;
  vehicleMonthlyRent: number;
  vehicleRentDisplayAmount: number;
  month: string;
  level: string;
  levelTone: "slate" | "emerald" | "blue" | "red" | "amber";
  workDays: number;
  rentalDays: number;
  orders: number;
  extraOrders: number;
  workingHours: number;
  onTimeRate: number;
  cancellationRate: number;
  rejectionRate: number;
  invoiceIsValid: boolean | null;
  invoiceValidityReason: string;
  performanceValidDays: number;
  performanceValidRate: number;
  kpiScore: number;
  kpiStatus: string;
  basicSalary: number;
  extraOrdersBonus: number;
  performanceBonus: number;
  totalEarnings: number;
  carRent: number;
  advancesTotal: number;
  violationsTotal: number;
  fuelTotal: number;
  appDeductionsTotal: number;
  adminCarryoverDeduction: number;
  housingDeduction: number;
  trafficViolationDeduction: number;
  advanceDeduction: number;
  keetaDeduction: number;
  keetaFoodCompensation: number;
  keetaTgaDeduction: number;
  totalAppDeductions: number;
  vehicleCarryoverDeduction: number;
  vehicleDamageDeduction: number;
  accidentLiabilityDeduction: number;
  bikeRentDeduction: number;
  kafalaDeduction: number;
  kafalaDeductionNotes: string;
  kafalaDeductionSource: string;
  userDeduction: number;
  userDeductionApplied: boolean;
  userDeductionReason: string;
  otherDeductions: number;
  totalDeductions: number;
  netSalary: number;
  salaryPlanId: string;
  relationshipType: string;
  monthlyTargetOrders: number;
  deliveredOrders: number;
  extraOrderRate: number;
  shortageOrders: number;
  shortageDeduction: number;
  salaryBaseWorkingDays: number;
  workedDaysForSalary: number;
  baseSalaryBeforeProration: number;
  levelBonus: number;
  housingAllowance: number;
  manualBonus: number;
  grossSalary: number;
  internalAdvances: number;
  internalPenalties: number;
  carRentDeduction: number;
  fuelDeduction: number;
  manualDeduction: number;
  finalSalary: number;
  companyRevenueFromKeeta: number;
  keetaTotalPayableAmount: number;
  keetaDeductions: number;
  keetaIncentives: number;
  companyGrossRevenue: number;
  estimatedCompanyProfit: number;
  costPerOrder: number;
  lastEditedBy: string;
  status: string;
  statusLabel: string;
  statusTone: "slate" | "amber" | "emerald" | "blue" | "red";
  selectedSalarySlab: string;
  paidSalaryDays: number;
  eligiblePaidLeaveDays: number;
  invoiceExperienceIncentiveAmount: number;
  expectedExperienceIncentiveAmount: number;
  experienceIncentiveDifferenceDeduction: number;
  notes: string;
};

export type PayrollOldData = {
  databaseStatus: "online" | "offline";
  databaseMessage?: string;
  filters: PayrollOldFilters;
  options: Awaited<ReturnType<typeof getFilterOptions>>;
  summary: {
    totalRows: number;
    draft: number;
    approved: number;
    locked: number;
    levelA: number;
    levelB: number;
    levelC: number;
    basicSalary: number;
    bonuses: number;
    advances: number;
    violations: number;
    fuel: number;
    carRent: number;
    companyCarDrivers: number;
    personalCarDrivers: number;
    noVehicleDrivers: number;
    companyCarRentDeduction: number;
    deductions: number;
    netSalary: number;
    companyRevenueFromKeeta: number;
    estimatedCompanyProfit: number;
  };
  insight: string;
  rows: PayrollOldRow[];
};

export function resolvePayrollOldFilters(params: SearchParams, defaultMonth = formatMonth()): PayrollOldFilters {
  return {
    month: one(params, "month") || defaultMonth,
    cityId: one(params, "cityId"),
    projectId: one(params, "projectId"),
    vehicleOwnershipType: one(params, "vehicleOwnershipType"),
    deductionFilter: one(params, "deductionFilter"),
    status: one(params, "status"),
    q: one(params, "q").trim(),
  };
}

function emptyData(filters: PayrollOldFilters, options: Awaited<ReturnType<typeof getFilterOptions>>, message?: string): PayrollOldData {
  return {
    databaseStatus: message ? "offline" : "online",
    databaseMessage: message,
    filters,
    options,
    summary: {
      totalRows: 0,
      draft: 0,
      approved: 0,
      locked: 0,
      levelA: 0,
      levelB: 0,
      levelC: 0,
      basicSalary: 0,
      bonuses: 0,
      advances: 0,
      violations: 0,
      fuel: 0,
      carRent: 0,
      companyCarDrivers: 0,
      personalCarDrivers: 0,
      noVehicleDrivers: 0,
      companyCarRentDeduction: 0,
      deductions: 0,
      netSalary: 0,
      companyRevenueFromKeeta: 0,
      estimatedCompanyProfit: 0,
    },
    insight: "لا توجد بيانات مسير كافية لإظهار تحليل دقيق حالياً.",
    rows: [],
  };
}

function buildInsight(summary: PayrollOldData["summary"]) {
  if (!summary.totalRows) return "لا توجد سجلات مسير لهذا الشهر. يمكنك توليد مسير من KPI أو استيراد ملف مسير بعد المعاينة.";
  if (summary.netSalary < 0) return "صافي المسير سالب ويحتاج مراجعة مالية قبل الاعتماد.";
  if (summary.draft > 0) return `يوجد ${summary.draft} سجل مسودة يحتاج مراجعة قبل اعتماد المسير.`;
  return "المسير يحتوي على بيانات محفوظة وجاهزة للمراجعة حسب الفلاتر الحالية.";
}

function matches(row: PayrollOldRow, filters: PayrollOldFilters) {
  if (filters.status && row.status !== filters.status) return false;
  if (filters.vehicleOwnershipType && row.vehicleOwnershipType !== filters.vehicleOwnershipType) return false;
  if (filters.deductionFilter === "app_deductions" && !(row.totalAppDeductions || row.appDeductionsTotal || row.experienceIncentiveDifferenceDeduction)) return false;
  if (filters.deductionFilter === "car_rent" && !row.carRentDeduction) return false;
  if (filters.deductionFilter === "kafala" && !row.kafalaDeduction) return false;
  if (filters.deductionFilter === "user" && !row.userDeduction) return false;
  if (filters.deductionFilter === "advances" && !(row.advanceDeduction || row.internalAdvances || row.advancesTotal)) return false;
  if (filters.deductionFilter === "violations" && !(row.trafficViolationDeduction || row.internalPenalties || row.violationsTotal)) return false;
  if (filters.cityId && !row.id.includes(filters.cityId) && row.city === "-") return false;
  if (filters.projectId && row.project === "-") return false;
  if (filters.q) {
    const q = filters.q.toLowerCase();
    return [row.driverCode, row.driverName, row.nationalId, row.city, row.project, row.appName, row.supervisor, row.account, row.vehiclePlate, row.vehicleOwnershipLabel]
      .join(" ")
      .toLowerCase()
      .includes(q);
  }
  return true;
}

export async function getPayrollOldPageData(filters: PayrollOldFilters): Promise<PayrollOldData> {
  let options: Awaited<ReturnType<typeof getFilterOptions>>;
  try {
    options = await getFilterOptions();
  } catch (error) {
    const message = databaseOfflineMessage(error);
    options = { months: [], appNames: [], cities: [], projects: [], supervisors: [] };
    if (message) return emptyData(filters, options, message);
    throw error;
  }

  try {
    const { safeMonth, start, end, year, monthNumber } = monthRange(filters.month);
    const payrollStatus = filters.status ? (filters.status as PayrollStatus) : undefined;
    const selectedMonthDays = monthDays(year, monthNumber);

    const [items, payrolls, advances, deductions, violations, fuelRecords] = await Promise.all([
      prisma.payrollItem.findMany({
        where: {
          payrollRun: {
            year,
            month: monthNumber,
            ...(filters.cityId ? { cityId: filters.cityId } : {}),
            ...(filters.projectId ? { applicationProjectId: filters.projectId } : {}),
            ...(payrollStatus ? { status: payrollStatus } : {}),
          },
        },
        include: {
          payrollRun: { include: { application: { select: { name: true } }, applicationProject: { select: { name: true } }, city: { select: { nameAr: true, nameEn: true } } } },
          driver: {
            include: {
              city: true,
              project: true,
              supervisor: true,
              vehicle: true,
              applicationAccounts: {
                select: {
                  appUserId: true,
                  appUsername: true,
                  username: true,
                  application: { select: { name: true } },
                  applicationProject: { select: { name: true } },
                },
              },
            },
          },
          applicationAccount: { include: { application: { select: { name: true } }, applicationProject: { select: { name: true } } } },
          vehicle: true,
        },
        orderBy: [{ updatedAt: "desc" }],
        take: 500,
      }),
      prisma.payroll.findMany({
        where: {
          month: safeMonth,
          ...(payrollStatus ? { status: payrollStatus } : {}),
          ...(filters.projectId ? { projectId: filters.projectId } : {}),
          ...(filters.cityId ? { driver: { cityId: filters.cityId } } : {}),
        },
        include: {
          driver: {
            include: {
              city: true,
              project: true,
              supervisor: true,
              account: true,
              vehicle: true,
              applicationAccounts: {
                select: {
                  appUserId: true,
                  appUsername: true,
                  username: true,
                  application: { select: { name: true } },
                  applicationProject: { select: { name: true } },
                },
              },
            },
          },
          project: true,
        },
        orderBy: [{ updatedAt: "desc" }],
        take: 500,
      }),
      prisma.advance.findMany({
        where: {
          deductionMonth: safeMonth,
          status: "APPROVED",
          isDeducted: false,
          payrollItemId: null,
          deductedPayrollRunId: null,
        },
        select: { driverId: true, amount: true },
      }),
      prisma.deduction.findMany({ where: { month: safeMonth }, select: { driverId: true, amount: true } }),
      prisma.violation.findMany({ where: { occurredAt: { gte: start, lt: end } }, select: { driverId: true, amount: true } }),
      prisma.fuelRecord.findMany({ where: { fuelDate: { gte: start, lt: end } }, select: { driverId: true, amount: true } }),
    ]);

    const driverIds = Array.from(new Set([...items.map((item) => item.driverId), ...payrolls.map((payroll) => payroll.driverId)]));
    const [reports, activeAssignments] = driverIds.length
      ? await Promise.all([
          prisma.dailyReport.findMany({
            where: { month: safeMonth, driverId: { in: driverIds } },
            select: { driverId: true, orders: true, workingHours: true, onTimeRate: true, cancellationRate: true, rejectionRate: true },
          }),
          prisma.vehicleAssignment.findMany({
            where: { driverId: { in: driverIds }, status: "ACTIVE", endDate: null },
            include: { vehicle: true },
            orderBy: [{ startDate: "desc" }, { updatedAt: "desc" }],
          }),
        ])
      : [[], []];
    const activeAssignmentMap = new Map<string, (typeof activeAssignments)[number]>();
    for (const assignment of activeAssignments) {
      if (!activeAssignmentMap.has(assignment.driverId)) activeAssignmentMap.set(assignment.driverId, assignment);
    }

    const reportMap = new Map<string, { orders: number; workingHours: number; onTimeRate: number; cancellationRate: number; rejectionRate: number; count: number }>();
    for (const report of reports) {
      if (!report.driverId) continue;
      const current = reportMap.get(report.driverId) ?? { orders: 0, workingHours: 0, onTimeRate: 0, cancellationRate: 0, rejectionRate: 0, count: 0 };
      current.orders += report.orders;
      current.workingHours += toNumber(report.workingHours);
      current.onTimeRate += toNumber(report.onTimeRate);
      current.cancellationRate += toNumber(report.cancellationRate);
      current.rejectionRate += toNumber(report.rejectionRate);
      current.count += 1;
      reportMap.set(report.driverId, current);
    }

    const advanceMap = groupSum(advances);
    const deductionMap = groupSum(deductions);
    const violationMap = groupSum(violations);
    const fuelMap = groupSum(fuelRecords);

    const itemRows: PayrollOldRow[] = items.map((item) => {
      const driver = item.driver;
      const runMonth = `${item.payrollRun.year}-${String(item.payrollRun.month).padStart(2, "0")}`;
      const maxMonthDays = monthDays(item.payrollRun.year, item.payrollRun.month);
      const itemNotes = item.notes || "";
      const level = item.level || "-";
      const workingHours = toNumber(item.workingHours);
      const rentalDays = capDays(item.rentalDays || 0, maxMonthDays);
      const activeAssignment = activeAssignmentMap.get(item.driverId);
      const activeVehicle = item.vehicle || driver.vehicle || activeAssignment?.vehicle || null;
      const hasVehicle = Boolean(item.vehicleId || driver.vehicleId || activeVehicle);
      const vehicleOwnershipType = effectiveVehicleOwnership(item.vehicleOwnershipType, driver.vehicleOwnershipType, hasVehicle);
      // Keeta V2 policy: no personal car allowance is included in rider salary.
      // If old PayrollItems stored a car allowance in carRent, remove it from displayed totals.
      const rawCarAllowance = toNumber(item.carRent);
      const carAllowance = 0;
      const carAllowanceToRemove = rawCarAllowance;
      const vehicleRentDays = capDays(item.vehicleRentDays || rentalDays || activeAssignment?.rentalDays || 0, maxMonthDays);
      const vehicleDailyRent = vehicleOwnershipType === "company_car" ? COMPANY_CAR_DAILY_RENT : 0;
      const vehicleMonthlyRent = vehicleOwnershipType === "company_car" ? COMPANY_CAR_FULL_MONTH_RENT : 0;
      const computedVehicleRentDisplayAmount = vehicleOwnershipType === "company_car" ? companyCarRentByDays(vehicleRentDays) : 0;
      const vehicleRentDisplayAmount = computedVehicleRentDisplayAmount;
      const storedCarRentDeduction = toNumber(item.carRentDeduction);

      // سياسة المسير المعتمدة:
      // سيارة الشركة لا يتم خصم إيجارها من راتب المندوب.
      // يتم عرض أيام/سعر/قيمة الإيجار كمعلومة فقط.
      const carRentDeduction = 0;
      const totalEarnings = Math.max(0, toNumber(item.totalEarnings) - carAllowanceToRemove);
      const grossSalary = Math.max(0, toNumber(item.grossSalary || item.totalEarnings) - carAllowanceToRemove);
      const netSalary = toNumber(item.netSalary) + storedCarRentDeduction - carAllowanceToRemove;
      const finalSalary = toNumber(item.finalSalary || item.netSalary) + storedCarRentDeduction - carAllowanceToRemove;
      const fuelDeduction = toNumber(item.fuelDeduction);
      const companyRevenueFromKeeta = toNumber(item.companyRevenueFromKeeta);
      const deliveredOrdersForV2 = item.deliveredOrders || item.orders;
      const selectedSalarySlab =
        noteText(itemNotes, ["selectedSalarySlab", "slab", "salarySlab"]) ||
        salarySlabLabelByOrders(deliveredOrdersForV2);
      const eligiblePaidLeaveDays = noteNumber(itemNotes, ["eligiblePaidLeaveDays", "paidLeaveDays", "paidLeave"]);
      const paidSalaryDays =
        noteNumber(itemNotes, ["paidSalaryDays"]) ||
        capDays(toNumber(item.workedDaysForSalary || rentalDays || Math.round(workingHours / 10)) + eligiblePaidLeaveDays, maxMonthDays);
      const invoiceExperienceIncentiveAmount = noteNumber(itemNotes, ["invoiceExperienceIncentiveAmount", "invoiceExperience", "experienceIncentive"]);
      const expectedExperienceIncentiveAmount = noteNumber(itemNotes, ["expectedExperienceIncentiveAmount", "expectedExperience"]) || 2000;
      const experienceIncentiveDifferenceDeduction =
        noteNumber(itemNotes, ["experienceIncentiveDifferenceDeduction", "experienceDeduction"]) ||
        Math.max(expectedExperienceIncentiveAmount - invoiceExperienceIncentiveAmount, 0);
      const userDeductionForProfit = vehicleOwnershipType === "personal_car" ? Math.max(toNumber(item.userDeduction), PERSONAL_CAR_USER_DEDUCTION) : toNumber(item.userDeduction);
      const companyProfitRecoveredDeductions =
        experienceIncentiveDifferenceDeduction + toNumber(item.keetaDeduction) + toNumber(item.keetaFoodCompensation) + userDeductionForProfit;
      const estimatedCompanyProfit = companyRevenueFromKeeta
        ? companyRevenueFromKeeta - grossSalary + companyProfitRecoveredDeductions
        : toNumber(item.estimatedCompanyProfit);
      return {
        id: `item:${item.id}`,
        source: "payrollItem",
        payrollItemId: item.id,
        payrollId: "",
        payrollRunId: item.payrollRunId,
        driverId: item.driverId,
        driverCode: driver.internalCode || driver.driverCode || "-",
        driverName: driver.actualName || driver.name,
        nationalId: driver.nationalId || "-",
        city: driver.city?.nameAr || driver.city?.nameEn || item.payrollRun.city?.nameAr || "-",
        project: item.payrollRun.applicationProject?.name || item.applicationAccount?.applicationProject?.name || driver.applicationAccounts?.[0]?.applicationProject?.name || driver.project?.name || "-",
        appName: item.payrollRun.application?.name || item.applicationAccount?.application?.name || driver.applicationAccounts?.[0]?.application?.name || driver.project?.appName || "-",
        supervisor: driver.supervisor?.name || "-",
        account: item.applicationAccount?.appUserId || item.applicationAccount?.appUsername || item.applicationAccount?.username || driver.applicationAccounts?.[0]?.appUserId || driver.applicationAccounts?.[0]?.appUsername || driver.applicationAccounts?.[0]?.username || "-",
        vehiclePlate: activeVehicle?.plateArabic || activeVehicle?.plateAr || activeVehicle?.plateEnglish || activeVehicle?.plateEn || "-",
        vehicleOwnershipType,
        vehicleOwnershipLabel: vehicleOwnershipLabel(vehicleOwnershipType),
        vehicleRentDays,
        vehicleDailyRent,
        vehicleMonthlyRent,
        vehicleRentDisplayAmount,
        month: runMonth,
        level,
        levelTone: levelTone(level),
        workDays: capDays(item.workedDaysForSalary || rentalDays || Math.round(workingHours / 10), maxMonthDays),
        rentalDays,
        orders: item.orders,
        extraOrders: item.extraOrders,
        workingHours,
        onTimeRate: toNumber(item.onTimeRate),
        cancellationRate: toNumber(item.cancellationRate),
        rejectionRate: toNumber(item.rejectionRate),
        invoiceIsValid: item.invoiceIsValid,
        invoiceValidityReason: item.invoiceValidityReason || "",
        performanceValidDays: item.performanceValidDays,
        performanceValidRate: toNumber(item.performanceValidRate),
        kpiScore: toNumber(item.kpiScore),
        kpiStatus: item.kpiStatus || "",
        basicSalary: toNumber(item.basicSalary),
        extraOrdersBonus: toNumber(item.extraOrdersBonus),
        performanceBonus: toNumber(item.performanceBonus),
        totalEarnings,
        carRent: carAllowance,
        advancesTotal: toNumber(item.advancesTotal),
        violationsTotal: toNumber(item.violationsTotal),
        fuelTotal: toNumber(item.fuelTotal),
        appDeductionsTotal: toNumber(item.totalAppDeductions || item.appDeductionsTotal),
        adminCarryoverDeduction: toNumber(item.adminCarryoverDeduction),
        housingDeduction: toNumber(item.housingDeduction),
        trafficViolationDeduction: toNumber(item.trafficViolationDeduction),
        advanceDeduction: toNumber(item.advanceDeduction || item.internalAdvances || item.advancesTotal),
        keetaDeduction: toNumber(item.keetaDeduction),
        keetaFoodCompensation: toNumber(item.keetaFoodCompensation),
        keetaTgaDeduction: toNumber(item.keetaTgaDeduction),
        totalAppDeductions: toNumber(item.totalAppDeductions || item.appDeductionsTotal),
        vehicleCarryoverDeduction: toNumber(item.vehicleCarryoverDeduction),
        vehicleDamageDeduction: toNumber(item.vehicleDamageDeduction),
        accidentLiabilityDeduction: toNumber(item.accidentLiabilityDeduction),
        bikeRentDeduction: toNumber(item.bikeRentDeduction),
        kafalaDeduction: toNumber(item.kafalaDeduction),
        kafalaDeductionNotes: item.kafalaDeductionNotes || "",
        kafalaDeductionSource: item.kafalaDeductionSource || "",
        userDeduction: vehicleOwnershipType === "personal_car" ? Math.max(toNumber(item.userDeduction), PERSONAL_CAR_USER_DEDUCTION) : toNumber(item.userDeduction),
        userDeductionApplied: vehicleOwnershipType === "personal_car" || item.userDeductionApplied,
        userDeductionReason: vehicleOwnershipType === "personal_car" ? "خصم يوزر سيارة شخصية" : item.userDeductionReason || "",
        otherDeductions: toNumber(item.otherDeductions),
        totalDeductions: Math.max(0, toNumber(item.totalDeductions) - storedCarRentDeduction),
        netSalary,
        salaryPlanId: item.salaryPlanId || "",
        relationshipType: item.relationshipType || driver.contractType || driver.sponsorshipType || "",
        monthlyTargetOrders: item.monthlyTargetOrders,
        deliveredOrders: item.deliveredOrders || item.orders,
        extraOrderRate: toNumber(item.extraOrderRate),
        shortageOrders: item.shortageOrders,
        shortageDeduction: toNumber(item.shortageDeduction),
        salaryBaseWorkingDays: item.salaryBaseWorkingDays || 30,
        workedDaysForSalary: capDays(item.workedDaysForSalary || rentalDays || Math.round(workingHours / 10), maxMonthDays),
        baseSalaryBeforeProration: toNumber(item.baseSalaryBeforeProration || item.basicSalary),
        levelBonus: toNumber(item.levelBonus || item.performanceBonus),
        housingAllowance: toNumber(item.housingAllowance),
        manualBonus: toNumber(item.manualBonus),
        grossSalary,
        internalAdvances: toNumber(item.internalAdvances || item.advancesTotal),
        internalPenalties: toNumber(item.internalPenalties || item.violationsTotal),
        carRentDeduction,
        fuelDeduction,
        manualDeduction: toNumber(item.manualDeduction || item.otherDeductions),
        finalSalary,
        companyRevenueFromKeeta,
        keetaTotalPayableAmount: toNumber(item.keetaTotalPayableAmount),
        keetaDeductions: toNumber(item.keetaDeductions),
        keetaIncentives: toNumber(item.keetaIncentives),
        companyGrossRevenue: toNumber(item.companyGrossRevenue),
        estimatedCompanyProfit,
        costPerOrder: toNumber(item.costPerOrder),
        lastEditedBy: item.lastEditedBy || "-",
        status: item.status,
        statusLabel: statusLabel(item.status),
        statusTone: statusTone(item.status),
        selectedSalarySlab,
        paidSalaryDays,
        eligiblePaidLeaveDays,
        invoiceExperienceIncentiveAmount,
        expectedExperienceIncentiveAmount,
        experienceIncentiveDifferenceDeduction,
        notes: itemNotes,
      };
    });

    const legacyRows: PayrollOldRow[] = payrolls
      .filter((payroll) => !itemRows.some((row) => row.driverId === payroll.driverId && row.month === payroll.month))
      .map((payroll) => {
        const driver = payroll.driver;
        const report = reportMap.get(payroll.driverId);
        const count = report?.count || 1;
        const level = toNumber(payroll.netSalary) >= 0 ? "B" : "C";
        const advancesTotal = advanceMap.get(payroll.driverId) ?? 0;
        const violationsTotal = violationMap.get(payroll.driverId) ?? 0;
        const fuelTotal = fuelMap.get(payroll.driverId) ?? 0;
        const otherDeductions = deductionMap.get(payroll.driverId) ?? 0;
        const workingHours = report?.workingHours ?? 0;
        const activeAssignment = activeAssignmentMap.get(payroll.driverId);
        const activeVehicle = driver.vehicle || activeAssignment?.vehicle || null;
        const vehicleOwnershipType = effectiveVehicleOwnership("", driver.vehicleOwnershipType, Boolean(driver.vehicleId || activeVehicle));
        return {
          id: `legacy:${payroll.id}`,
          source: "legacyPayroll",
          payrollItemId: "",
          payrollId: payroll.id,
          payrollRunId: "",
          driverId: payroll.driverId,
          driverCode: driver.internalCode || driver.driverCode || "-",
          driverName: driver.actualName || driver.name,
          nationalId: driver.nationalId || "-",
          city: driver.city?.nameAr || driver.city?.nameEn || "-",
          project: driver.applicationAccounts?.[0]?.applicationProject?.name || payroll.project?.name || driver.project?.name || "-",
          appName: driver.applicationAccounts?.[0]?.application?.name || driver.account?.appName || driver.project?.appName || "-",
          supervisor: driver.supervisor?.name || "-",
          account: driver.applicationAccounts?.[0]?.appUserId || driver.applicationAccounts?.[0]?.appUsername || driver.applicationAccounts?.[0]?.username || driver.account?.appUserId || driver.account?.appUsername || driver.account?.username || "-",
          vehiclePlate: activeVehicle?.plateArabic || activeVehicle?.plateAr || activeVehicle?.plateEnglish || activeVehicle?.plateEn || "-",
          vehicleOwnershipType,
          vehicleOwnershipLabel: vehicleOwnershipLabel(vehicleOwnershipType),
          vehicleRentDays: activeAssignment?.rentalDays || 0,
          vehicleDailyRent: toNumber(activeVehicle?.dailyRent),
          vehicleMonthlyRent: toNumber(activeVehicle?.monthlyRent),
          vehicleRentDisplayAmount: 0,
          month: payroll.month,
          level,
          levelTone: levelTone(level),
          workDays: capDays(Math.round(workingHours / 10), selectedMonthDays),
          rentalDays: 0,
          orders: report?.orders ?? 0,
          extraOrders: 0,
          workingHours,
          onTimeRate: report ? report.onTimeRate / count : 0,
          cancellationRate: report ? report.cancellationRate / count : 0,
          rejectionRate: report ? report.rejectionRate / count : 0,
          invoiceIsValid: null,
          invoiceValidityReason: "",
          performanceValidDays: 0,
          performanceValidRate: 0,
          kpiScore: 0,
          kpiStatus: "",
          basicSalary: toNumber(payroll.basicSalary),
          extraOrdersBonus: 0,
          performanceBonus: toNumber(payroll.bonus),
          totalEarnings: toNumber(payroll.basicSalary) + toNumber(payroll.bonus),
          carRent: 0,
          advancesTotal,
          violationsTotal,
          fuelTotal,
          appDeductionsTotal: 0,
          adminCarryoverDeduction: 0,
          housingDeduction: 0,
          trafficViolationDeduction: violationsTotal,
          advanceDeduction: advancesTotal,
          keetaDeduction: 0,
          keetaFoodCompensation: 0,
          keetaTgaDeduction: 0,
          totalAppDeductions: 0,
          vehicleCarryoverDeduction: 0,
          vehicleDamageDeduction: 0,
          accidentLiabilityDeduction: 0,
          bikeRentDeduction: 0,
          kafalaDeduction: 0,
          kafalaDeductionNotes: "",
          kafalaDeductionSource: "",
          userDeduction: 0,
          userDeductionApplied: false,
          userDeductionReason: "",
          otherDeductions,
          totalDeductions: toNumber(payroll.deductions),
          netSalary: toNumber(payroll.netSalary),
          salaryPlanId: "",
          relationshipType: driver.contractType || driver.sponsorshipType || "",
          monthlyTargetOrders: 0,
          deliveredOrders: report?.orders ?? 0,
          extraOrderRate: 0,
          shortageOrders: 0,
          shortageDeduction: 0,
          salaryBaseWorkingDays: 30,
          workedDaysForSalary: capDays(Math.round(workingHours / 10), selectedMonthDays),
          baseSalaryBeforeProration: toNumber(payroll.basicSalary),
          levelBonus: toNumber(payroll.bonus),
          housingAllowance: 0,
          manualBonus: 0,
          grossSalary: toNumber(payroll.basicSalary) + toNumber(payroll.bonus),
          internalAdvances: advancesTotal,
          internalPenalties: violationsTotal + otherDeductions,
          carRentDeduction: 0,
          fuelDeduction: fuelTotal,
          manualDeduction: otherDeductions,
          finalSalary: toNumber(payroll.netSalary),
          companyRevenueFromKeeta: 0,
          keetaTotalPayableAmount: 0,
          keetaDeductions: 0,
          keetaIncentives: 0,
          companyGrossRevenue: 0,
          estimatedCompanyProfit: 0,
          costPerOrder: 0,
          lastEditedBy: "-",
          status: payroll.status,
          statusLabel: statusLabel(payroll.status),
          statusTone: statusTone(payroll.status),
          selectedSalarySlab: salarySlabLabelByOrders(report?.orders ?? 0),
          paidSalaryDays: capDays(Math.round(workingHours / 10), selectedMonthDays),
          eligiblePaidLeaveDays: 0,
          invoiceExperienceIncentiveAmount: 0,
          expectedExperienceIncentiveAmount: 2000,
          experienceIncentiveDifferenceDeduction: 0,
          notes: "",
        };
      });

    const rows = [...itemRows, ...legacyRows].filter((row) => matches(row, filters));
    const summary = {
      totalRows: rows.length,
      draft: rows.filter((row) => row.statusLabel === "مسودة").length,
      approved: rows.filter((row) => ["معتمد", "مدفوع"].includes(row.statusLabel)).length,
      locked: rows.filter((row) => row.statusLabel === "مقفل").length,
      levelA: rows.filter((row) => row.level === "A").length,
      levelB: rows.filter((row) => row.level === "B").length,
      levelC: rows.filter((row) => row.level === "C").length,
      basicSalary: rows.reduce((sum, row) => sum + row.basicSalary, 0),
      bonuses: rows.reduce((sum, row) => sum + row.extraOrdersBonus + row.performanceBonus + row.manualBonus, 0),
      advances: rows.reduce((sum, row) => sum + row.advancesTotal, 0),
      violations: rows.reduce((sum, row) => sum + row.violationsTotal, 0),
      fuel: rows.reduce((sum, row) => sum + row.fuelTotal, 0),
      carRent: rows.reduce((sum, row) => sum + row.carRent, 0),
      companyCarDrivers: rows.filter((row) => row.vehicleOwnershipType === "company_car").length,
      personalCarDrivers: rows.filter((row) => row.vehicleOwnershipType === "personal_car").length,
      noVehicleDrivers: rows.filter((row) => row.vehicleOwnershipType === "no_vehicle").length,
      companyCarRentDeduction: rows.reduce((sum, row) => sum + row.carRentDeduction, 0),
      deductions: rows.reduce((sum, row) => sum + row.totalDeductions, 0),
      netSalary: rows.reduce((sum, row) => sum + row.finalSalary, 0),
      companyRevenueFromKeeta: rows.reduce((sum, row) => sum + row.companyRevenueFromKeeta, 0),
      estimatedCompanyProfit: rows.reduce((sum, row) => sum + row.estimatedCompanyProfit, 0),
    };

    return {
      databaseStatus: "online",
      filters: { ...filters, month: safeMonth },
      options,
      summary,
      insight: buildInsight(summary),
      rows,
    };
  } catch (error) {
    const message = databaseOfflineMessage(error);
    if (message) return emptyData(filters, options, message);
    throw error;
  }
}
