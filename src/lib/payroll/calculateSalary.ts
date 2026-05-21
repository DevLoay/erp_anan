import { determinePayrollLevel, normalizeLevelRules, type PayrollLevelRules } from "./levels";

export type BonusRules = {
  extraOrdersBonus: boolean;
  performanceBonus: boolean;
  targetAchievementBonus: number;
  noCancellationBonus: number;
  highOnTimeBonus: number;
  customBonuses: { name: string; amount: number }[];
};

export type DeductionRules = {
  appDeductions: boolean;
  advances: boolean;
  violations: boolean;
  fuel: boolean;
  damages: boolean;
  accidents: boolean;
  absenceDeductions: boolean;
  customDeductions: { name: string; amount: number }[];
};

export type CarRentRule = {
  enabled: boolean;
  defaultMonthlyRent: number;
  calculateByRentalDays: boolean;
  fixedMonthlyDeduction: boolean;
  graceDays: number;
  maxMonthlyDeduction: number;
};

export type SalaryCalculationInput = {
  orders: number;
  workingHours: number;
  workingDays: number;
  onTimeRate: number;
  cancellationRate: number;
  rejectionRate: number;
  hasVehicle: boolean;
  rentalDays: number;
  advancesTotal: number;
  violationsTotal: number;
  fuelTotal: number;
  appDeductionsTotal: number;
  damagesTotal: number;
  accidentDeduction: number;
  otherDeductions: number;
};

export type SalarySettingLike = {
  basicSalary: unknown;
  targetOrders: unknown;
  extraOrderPrice: unknown;
  levelRules: unknown;
  bonusRules: unknown;
  deductionRules: unknown;
  carRentRule: unknown;
};

export type SalaryCalculationResult = {
  level: "A" | "B" | "C";
  basicSalary: number;
  extraOrders: number;
  extraOrdersBonus: number;
  performanceBonus: number;
  targetAchievementBonus: number;
  noCancellationBonus: number;
  highOnTimeBonus: number;
  customBonusTotal: number;
  totalEarnings: number;
  carRent: number;
  advancesTotal: number;
  violationsTotal: number;
  fuelTotal: number;
  appDeductionsTotal: number;
  damagesTotal: number;
  accidentDeduction: number;
  otherDeductions: number;
  customDeductionsTotal: number;
  totalDeductions: number;
  netSalary: number;
  warnings: string[];
};

function numberValue(value: unknown, fallback = 0) {
  if (typeof value === "object" && value !== null && "toNumber" in value && typeof value.toNumber === "function") {
    return Number(value.toNumber());
  }
  const numeric = Number(value ?? fallback);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function boolValue(value: unknown, fallback = true) {
  if (typeof value === "boolean") return value;
  if (value === "false") return false;
  if (value === "true") return true;
  return fallback;
}

function normalizeAmountRows(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const record = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    return { name: String(record.name ?? "Custom"), amount: numberValue(record.amount) };
  });
}

export function normalizeBonusRules(value: unknown): BonusRules {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    extraOrdersBonus: boolValue(record.extraOrdersBonus, true),
    performanceBonus: boolValue(record.performanceBonus, true),
    targetAchievementBonus: numberValue(record.targetAchievementBonus),
    noCancellationBonus: numberValue(record.noCancellationBonus),
    highOnTimeBonus: numberValue(record.highOnTimeBonus),
    customBonuses: normalizeAmountRows(record.customBonuses),
  };
}

export function normalizeDeductionRules(value: unknown): DeductionRules {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    appDeductions: boolValue(record.appDeductions, true),
    advances: boolValue(record.advances, true),
    violations: boolValue(record.violations, true),
    fuel: boolValue(record.fuel, true),
    damages: boolValue(record.damages, true),
    accidents: boolValue(record.accidents, true),
    absenceDeductions: boolValue(record.absenceDeductions, true),
    customDeductions: normalizeAmountRows(record.customDeductions),
  };
}

export function normalizeCarRentRule(value: unknown): CarRentRule {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    enabled: boolValue(record.enabled, false),
    defaultMonthlyRent: numberValue(record.defaultMonthlyRent),
    calculateByRentalDays: boolValue(record.calculateByRentalDays, true),
    fixedMonthlyDeduction: boolValue(record.fixedMonthlyDeduction, false),
    graceDays: numberValue(record.graceDays),
    maxMonthlyDeduction: numberValue(record.maxMonthlyDeduction),
  };
}

function carRentAmount(input: SalaryCalculationInput, rule: CarRentRule) {
  if (!input.hasVehicle || !rule.enabled) return 0;
  const raw = rule.fixedMonthlyDeduction || !rule.calculateByRentalDays
    ? rule.defaultMonthlyRent
    : (rule.defaultMonthlyRent / 30) * Math.max(0, input.rentalDays - rule.graceDays);
  return rule.maxMonthlyDeduction > 0 ? Math.min(raw, rule.maxMonthlyDeduction) : raw;
}

export function calculateSalary(input: SalaryCalculationInput, setting: SalarySettingLike): SalaryCalculationResult {
  const levelRules: PayrollLevelRules = normalizeLevelRules(setting.levelRules);
  const bonusRules = normalizeBonusRules(setting.bonusRules);
  const deductionRules = normalizeDeductionRules(setting.deductionRules);
  const carRentRule = normalizeCarRentRule(setting.carRentRule);
  const targetOrders = numberValue(setting.targetOrders);
  const baseExtraOrderPrice = numberValue(setting.extraOrderPrice);

  const level = determinePayrollLevel(input, levelRules);
  const levelRule = levelRules[level];
  const basicSalary = levelRule.basicSalary || numberValue(setting.basicSalary);
  const extraOrderPrice = levelRule.extraOrderPrice || baseExtraOrderPrice;
  const extraOrders = Math.max(0, input.orders - targetOrders);
  const extraOrdersBonus = bonusRules.extraOrdersBonus ? extraOrders * extraOrderPrice : 0;
  const performanceBonus = bonusRules.performanceBonus ? levelRule.performanceBonus : 0;
  const targetAchievementBonus = input.orders >= targetOrders ? bonusRules.targetAchievementBonus : 0;
  const noCancellationBonus = input.cancellationRate === 0 ? bonusRules.noCancellationBonus : 0;
  const highOnTimeBonus = input.onTimeRate >= 99 ? bonusRules.highOnTimeBonus : 0;
  const customBonusTotal = bonusRules.customBonuses.reduce((sum, item) => sum + item.amount, 0);
  const totalEarnings = basicSalary + extraOrdersBonus + performanceBonus + targetAchievementBonus + noCancellationBonus + highOnTimeBonus + customBonusTotal;

  const carRent = carRentAmount(input, carRentRule);
  const advancesTotal = deductionRules.advances ? input.advancesTotal : 0;
  const violationsTotal = deductionRules.violations ? input.violationsTotal : 0;
  const fuelTotal = deductionRules.fuel ? input.fuelTotal : 0;
  const appDeductionsTotal = deductionRules.appDeductions ? input.appDeductionsTotal : 0;
  const damagesTotal = deductionRules.damages ? input.damagesTotal : 0;
  const accidentDeduction = deductionRules.accidents ? input.accidentDeduction : 0;
  const otherDeductions = input.otherDeductions;
  const customDeductionsTotal = deductionRules.customDeductions.reduce((sum, item) => sum + item.amount, 0);
  const totalDeductions = carRent + advancesTotal + violationsTotal + fuelTotal + appDeductionsTotal + damagesTotal + accidentDeduction + otherDeductions + customDeductionsTotal;
  const netSalary = totalEarnings - totalDeductions;

  const warnings: string[] = [];
  if (targetOrders > 0 && input.orders < targetOrders) warnings.push("عدد الطلبات أقل من التارجت.");
  if (input.onTimeRate < levelRules.B.minimumOnTime) warnings.push("نسبة On Time منخفضة.");
  if (input.cancellationRate > levelRules.B.maxCancellation) warnings.push("نسبة الإلغاء أعلى من الحد المسموح.");
  if (input.rejectionRate > levelRules.B.maxRejection) warnings.push("نسبة الرفض أعلى من الحد المسموح.");
  if (levelRules.meta?.minimumWorkingDays && input.workingDays < levelRules.meta.minimumWorkingDays) warnings.push("أيام العمل أقل من الحد الأدنى.");
  if (levelRules.meta?.minimumWorkingHoursPerDay && input.workingHours / Math.max(1, input.workingDays) < levelRules.meta.minimumWorkingHoursPerDay) warnings.push("متوسط ساعات العمل اليومي أقل من المطلوب.");
  if (netSalary < 0) warnings.push("صافي الراتب سالب ويحتاج مراجعة مالية.");

  return {
    level,
    basicSalary,
    extraOrders,
    extraOrdersBonus,
    performanceBonus,
    targetAchievementBonus,
    noCancellationBonus,
    highOnTimeBonus,
    customBonusTotal,
    totalEarnings,
    carRent,
    advancesTotal,
    violationsTotal,
    fuelTotal,
    appDeductionsTotal,
    damagesTotal,
    accidentDeduction,
    otherDeductions,
    customDeductionsTotal,
    totalDeductions,
    netSalary,
    warnings,
  };
}

