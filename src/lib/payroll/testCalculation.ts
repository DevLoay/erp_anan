import { calculateSalary, type SalaryCalculationInput, type SalaryCalculationResult, type SalarySettingLike } from "./calculateSalary";

export type TestCalculationPayload = Partial<SalaryCalculationInput> & {
  settingId?: string;
};

function numberValue(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function boolValue(value: unknown) {
  if (typeof value === "boolean") return value;
  return String(value ?? "").toLowerCase() === "true";
}

export function normalizeTestCalculationInput(payload: TestCalculationPayload): SalaryCalculationInput {
  return {
    orders: numberValue(payload.orders),
    workingHours: numberValue(payload.workingHours),
    workingDays: numberValue(payload.workingDays),
    onTimeRate: numberValue(payload.onTimeRate),
    cancellationRate: numberValue(payload.cancellationRate),
    rejectionRate: numberValue(payload.rejectionRate),
    hasVehicle: boolValue(payload.hasVehicle),
    rentalDays: numberValue(payload.rentalDays),
    advancesTotal: numberValue(payload.advancesTotal),
    violationsTotal: numberValue(payload.violationsTotal),
    fuelTotal: numberValue(payload.fuelTotal),
    appDeductionsTotal: numberValue(payload.appDeductionsTotal),
    damagesTotal: numberValue(payload.damagesTotal),
    accidentDeduction: numberValue(payload.accidentDeduction),
    otherDeductions: numberValue(payload.otherDeductions),
  };
}

export function testSalaryCalculation(payload: TestCalculationPayload, setting: SalarySettingLike): SalaryCalculationResult {
  return calculateSalary(normalizeTestCalculationInput(payload), setting);
}

