export type PayrollLevelKey = "A" | "B" | "C";

export type PayrollLevelRule = {
  minimumOrders: number;
  minimumOnTime: number;
  maxCancellation: number;
  maxRejection: number;
  basicSalary: number;
  extraOrderPrice: number;
  performanceBonus: number;
};

export type PayrollLevelRules = Record<PayrollLevelKey, PayrollLevelRule> & {
  meta?: {
    contractType?: string;
    minimumWorkingDays?: number;
    minimumWorkingHoursPerDay?: number;
  };
};

export const defaultLevelRules: PayrollLevelRules = {
  A: {
    minimumOrders: 400,
    minimumOnTime: 99,
    maxCancellation: 0,
    maxRejection: 0,
    basicSalary: 0,
    extraOrderPrice: 0,
    performanceBonus: 0,
  },
  B: {
    minimumOrders: 300,
    minimumOnTime: 95,
    maxCancellation: 1,
    maxRejection: 1,
    basicSalary: 0,
    extraOrderPrice: 0,
    performanceBonus: 0,
  },
  C: {
    minimumOrders: 0,
    minimumOnTime: 0,
    maxCancellation: 100,
    maxRejection: 100,
    basicSalary: 0,
    extraOrderPrice: 0,
    performanceBonus: 0,
  },
  meta: {
    contractType: "",
    minimumWorkingDays: 0,
    minimumWorkingHoursPerDay: 0,
  },
};

function numberValue(value: unknown, fallback = 0) {
  const numeric = Number(value ?? fallback);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function levelRule(value: unknown, fallback: PayrollLevelRule): PayrollLevelRule {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    minimumOrders: numberValue(row.minimumOrders, fallback.minimumOrders),
    minimumOnTime: numberValue(row.minimumOnTime, fallback.minimumOnTime),
    maxCancellation: numberValue(row.maxCancellation, fallback.maxCancellation),
    maxRejection: numberValue(row.maxRejection, fallback.maxRejection),
    basicSalary: numberValue(row.basicSalary, fallback.basicSalary),
    extraOrderPrice: numberValue(row.extraOrderPrice, fallback.extraOrderPrice),
    performanceBonus: numberValue(row.performanceBonus, fallback.performanceBonus),
  };
}

export function normalizeLevelRules(value: unknown): PayrollLevelRules {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const meta = record.meta && typeof record.meta === "object" ? (record.meta as Record<string, unknown>) : {};
  return {
    A: levelRule(record.A, defaultLevelRules.A),
    B: levelRule(record.B, defaultLevelRules.B),
    C: levelRule(record.C, defaultLevelRules.C),
    meta: {
      contractType: String(meta.contractType ?? ""),
      minimumWorkingDays: numberValue(meta.minimumWorkingDays),
      minimumWorkingHoursPerDay: numberValue(meta.minimumWorkingHoursPerDay),
    },
  };
}

export function determinePayrollLevel(input: {
  orders: number;
  onTimeRate: number;
  cancellationRate: number;
  rejectionRate: number;
}, rules: PayrollLevelRules): PayrollLevelKey {
  if (
    input.orders >= rules.A.minimumOrders &&
    input.onTimeRate >= rules.A.minimumOnTime &&
    input.cancellationRate <= rules.A.maxCancellation &&
    input.rejectionRate <= rules.A.maxRejection
  ) {
    return "A";
  }

  if (
    input.orders >= rules.B.minimumOrders &&
    input.onTimeRate >= rules.B.minimumOnTime &&
    input.cancellationRate <= rules.B.maxCancellation &&
    input.rejectionRate <= rules.B.maxRejection
  ) {
    return "B";
  }

  return "C";
}

