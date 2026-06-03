import { determinePayrollLevel, normalizeLevelRules, type PayrollLevelRules } from "./levels";

export type VehicleOwnershipType = "company_car" | "personal_car" | "no_vehicle";

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

  // Legacy fields kept for backwards compatibility.
  hasVehicle: boolean;
  rentalDays: number;

  // New vehicle policy fields.
  vehicleOwnershipType?: VehicleOwnershipType | string;
  vehicleRentDays?: number;
  vehicleMonthlyRent?: number;
  vehicleDailyRent?: number;
  personalCarAllowance?: number;

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

  vehicleOwnershipType: VehicleOwnershipType;
  vehicleRentDays: number;
  vehicleDailyRent: number;
  vehicleMonthlyRent: number;
  vehicleRentDisplayAmount: number;
  carAllowance: number;
  carRentDeduction: number;

  totalEarnings: number;

  // Backwards-compatible field. Current policy keeps car rent deduction = 0.
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

function normalizeVehicleOwnership(value: unknown, hasVehicle: boolean): VehicleOwnershipType {
  const text = String(value ?? "").trim().toLowerCase();

  if (["company_car", "company", "company car", "شركة", "سيارة شركة"].some((token) => text.includes(token))) return "company_car";
  if (["personal_car", "personal", "own", "private", "شخصية", "خاص", "سيارة شخصية"].some((token) => text.includes(token))) return "personal_car";
  if (["no_vehicle", "none", "بدون", "بدون سيارة"].some((token) => text.includes(token))) return "no_vehicle";

  return hasVehicle ? "company_car" : "no_vehicle";
}

function isCarAllowanceBonus(name: string) {
  const text = name.trim().toLowerCase();
  return text.includes("بدل سيارة") || text.includes("بدل السياره") || text.includes("car allowance") || text.includes("personal car");
}

function splitCustomBonuses(customBonuses: { name: string; amount: number }[]) {
  let carAllowanceFromCustomBonus = 0;
  let regularCustomBonusTotal = 0;

  for (const bonus of customBonuses) {
    if (isCarAllowanceBonus(bonus.name)) {
      carAllowanceFromCustomBonus += bonus.amount;
    } else {
      regularCustomBonusTotal += bonus.amount;
    }
  }

  return { regularCustomBonusTotal, carAllowanceFromCustomBonus };
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

function resolveVehicleRentDays(input: SalaryCalculationInput) {
  return Math.max(0, numberValue(input.vehicleRentDays ?? input.rentalDays));
}

function resolveVehicleMonthlyRent(input: SalaryCalculationInput, rule: CarRentRule) {
  return Math.max(0, numberValue(input.vehicleMonthlyRent ?? rule.defaultMonthlyRent));
}

function resolveVehicleDailyRent(input: SalaryCalculationInput, monthlyRent: number) {
  const explicitDailyRent = numberValue(input.vehicleDailyRent);
  if (explicitDailyRent > 0) return explicitDailyRent;
  return monthlyRent > 0 ? monthlyRent / 30 : 0;
}

function vehicleRentDisplayAmount(input: SalaryCalculationInput, rule: CarRentRule, vehicleOwnershipType: VehicleOwnershipType) {
  if (vehicleOwnershipType !== "company_car") return 0;

  const rentDays = resolveVehicleRentDays(input);
  const monthlyRent = resolveVehicleMonthlyRent(input, rule);
  const dailyRent = resolveVehicleDailyRent(input, monthlyRent);

  return dailyRent * rentDays;
}

export function calculateSalary(input: SalaryCalculationInput, setting: SalarySettingLike): SalaryCalculationResult {
  const levelRules: PayrollLevelRules = normalizeLevelRules(setting.levelRules);
  const bonusRules = normalizeBonusRules(setting.bonusRules);
  const deductionRules = normalizeDeductionRules(setting.deductionRules);
  const carRentRule = normalizeCarRentRule(setting.carRentRule);
  const targetOrders = numberValue(setting.targetOrders);
  const baseExtraOrderPrice = numberValue(setting.extraOrderPrice);

  const vehicleOwnershipType = normalizeVehicleOwnership(input.vehicleOwnershipType, input.hasVehicle);
  const isPersonalCar = vehicleOwnershipType === "personal_car";
  const isCompanyCar = vehicleOwnershipType === "company_car";

  const vehicleRentDays = resolveVehicleRentDays(input);
  const vehicleMonthlyRent = resolveVehicleMonthlyRent(input, carRentRule);
  const vehicleDailyRent = resolveVehicleDailyRent(input, vehicleMonthlyRent);
  const vehicleRentAmountForDisplay = isCompanyCar ? vehicleRentDisplayAmount(input, carRentRule, vehicleOwnershipType) : 0;

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

  const { regularCustomBonusTotal, carAllowanceFromCustomBonus } = splitCustomBonuses(bonusRules.customBonuses);
  const personalCarAllowance =
    input.personalCarAllowance !== undefined
      ? numberValue(input.personalCarAllowance)
      : carAllowanceFromCustomBonus > 0
        ? carAllowanceFromCustomBonus
        : 1500;

  const carAllowance = isPersonalCar ? personalCarAllowance : 0;

  // Current approved policy: company car rent is display-only and never deducted from driver salary.
  const carRentDeduction = 0;
  const carRent = carRentDeduction;

  const customBonusTotal = regularCustomBonusTotal;
  const totalEarnings =
    basicSalary +
    extraOrdersBonus +
    performanceBonus +
    targetAchievementBonus +
    noCancellationBonus +
    highOnTimeBonus +
    customBonusTotal +
    carAllowance;

  const advancesTotal = deductionRules.advances ? input.advancesTotal : 0;
  const violationsTotal = deductionRules.violations ? input.violationsTotal : 0;
  const fuelTotal = deductionRules.fuel ? input.fuelTotal : 0;
  const appDeductionsTotal = deductionRules.appDeductions ? input.appDeductionsTotal : 0;
  const damagesTotal = deductionRules.damages ? input.damagesTotal : 0;
  const accidentDeduction = deductionRules.accidents ? input.accidentDeduction : 0;
  const otherDeductions = input.otherDeductions;
  const customDeductionsTotal = deductionRules.customDeductions.reduce((sum, item) => sum + item.amount, 0);

  const totalDeductions =
    advancesTotal +
    violationsTotal +
    fuelTotal +
    appDeductionsTotal +
    damagesTotal +
    accidentDeduction +
    otherDeductions +
    customDeductionsTotal;

  const netSalary = totalEarnings - totalDeductions;

  const warnings: string[] = [];
  if (targetOrders > 0 && input.orders < targetOrders) warnings.push("عدد الطلبات أقل من التارجت.");
  if (input.onTimeRate < levelRules.B.minimumOnTime) warnings.push("نسبة On Time منخفضة.");
  if (input.cancellationRate > levelRules.B.maxCancellation) warnings.push("نسبة الإلغاء أعلى من الحد المسموح.");
  if (input.rejectionRate > levelRules.B.maxRejection) warnings.push("نسبة الرفض أعلى من الحد المسموح.");
  if (levelRules.meta?.minimumWorkingDays && input.workingDays < levelRules.meta.minimumWorkingDays) warnings.push("أيام العمل أقل من الحد الأدنى.");
  if (levelRules.meta?.minimumWorkingHoursPerDay && input.workingHours / Math.max(1, input.workingDays) < levelRules.meta.minimumWorkingHoursPerDay) warnings.push("متوسط ساعات العمل اليومي أقل من المطلوب.");
  if (isCompanyCar && vehicleRentAmountForDisplay > 0) warnings.push("إيجار سيارة الشركة ظاهر للعرض فقط ولا يخصم من الراتب.");
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

    vehicleOwnershipType,
    vehicleRentDays,
    vehicleDailyRent,
    vehicleMonthlyRent,
    vehicleRentDisplayAmount: vehicleRentAmountForDisplay,
    carAllowance,
    carRentDeduction,

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
