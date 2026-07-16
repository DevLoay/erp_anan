export type PerformanceStatusCode = "GREEN" | "YELLOW" | "RED";

export type ExpectedTargetContext = {
  month: string;
  dateFrom: string;
  dateTo: string;
  effectiveDateTo: string;
  selectedDays: number;
  totalDaysInMonth: number;
  isFullMonth: boolean;
  isFinalPeriod: boolean;
  periodLabel: string;
  targetLabelSuffix: string;
  finalShortfallText: string;
  expectedShortfallText: string;
};

export type PerformanceStatus = {
  code: PerformanceStatusCode;
  label: string;
  severity: "good" | "warning" | "critical";
};

function isoDate(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function parseIsoDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundOne(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10) / 10;
}

export function monthStart(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) return "";
  return `${month}-01`;
}

export function monthEnd(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) return "";
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
}

export function daysInMonth(month: string) {
  const start = monthStart(month);
  const end = monthEnd(month);
  if (!start || !end) return 30;
  return inclusiveDays(start, end);
}

export function inclusiveDays(dateFrom: string, dateTo: string) {
  const from = parseIsoDate(dateFrom);
  const to = parseIsoDate(dateTo);
  if (!from || !to) return 1;
  const diff = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
  return Math.max(1, diff || 1);
}

export function resolveExpectedTargetContext(args: {
  month?: string;
  dateFrom?: string;
  dateTo?: string;
  today?: Date | string;
}): ExpectedTargetContext {
  const rawMonth = args.month && /^\d{4}-\d{2}$/.test(args.month) ? args.month : isoDate(args.dateFrom || args.today || new Date()).slice(0, 7);
  const fallbackStart = monthStart(rawMonth) || isoDate(args.today || new Date());
  const fallbackEnd = monthEnd(rawMonth) || fallbackStart;
  const today = isoDate(args.today || new Date());
  const monthFirst = fallbackStart;
  const monthLast = fallbackEnd;
  const from = clampDate(args.dateFrom || monthFirst, monthFirst, monthLast);
  const requestedTo = clampDate(args.dateTo || monthLast, monthFirst, monthLast);
  const monthHasEnded = Boolean(today && monthLast <= today);
  const effectiveTo = monthHasEnded ? requestedTo : minIsoDate(requestedTo, today || requestedTo);
  const totalDays = daysInMonth(rawMonth);
  const selectedDays = inclusiveDays(from, effectiveTo);
  const requestedDays = inclusiveDays(from, requestedTo);
  const isFullMonth = from === monthFirst && requestedTo === monthLast && requestedDays >= totalDays;
  const isFinalPeriod = isFullMonth && monthHasEnded;
  const targetLabelSuffix = isFinalPeriod ? "التارجت الشهري" : "المعدل المتوقع حتى اليوم";

  return {
    month: rawMonth,
    dateFrom: from,
    dateTo: requestedTo,
    effectiveDateTo: effectiveTo,
    selectedDays,
    totalDaysInMonth: totalDays,
    isFullMonth,
    isFinalPeriod,
    periodLabel: `${from} إلى ${effectiveTo}`,
    targetLabelSuffix,
    finalShortfallText: "لم يحقق التارجت الشهري",
    expectedShortfallText: "أقل من المعدل المتوقع حتى اليوم",
  };
}

function clampDate(value: string, min: string, max: string) {
  if (!value) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function minIsoDate(a: string, b: string) {
  if (!a) return b;
  if (!b) return a;
  return a <= b ? a : b;
}

export function calculateExpectedTarget(args: {
  monthlyTarget: number;
  month?: string;
  dateFrom?: string;
  dateTo?: string;
  today?: Date | string;
  precision?: "integer" | "decimal";
}) {
  const context = resolveExpectedTargetContext(args);
  const raw = (Math.max(0, Number(args.monthlyTarget) || 0) * context.selectedDays) / Math.max(1, context.totalDaysInMonth);
  const expected = args.precision === "decimal" ? roundOne(raw) : Math.ceil(raw);
  return { expected, rawExpected: raw, context };
}

export function calculatePerformancePercentage(actual: number, expected: number) {
  if (!Number.isFinite(expected) || expected <= 0) return 100;
  return roundOne((Math.max(0, Number(actual) || 0) / expected) * 100);
}

export function getPerformanceStatus(actualOrPercentage: number, expected?: number): PerformanceStatus {
  const percentage = expected === undefined ? actualOrPercentage : calculatePerformancePercentage(actualOrPercentage, expected);
  if (percentage >= 95) return { code: "GREEN", label: "على المسار الصحيح", severity: "good" };
  if (percentage >= 80) return { code: "YELLOW", label: "متأخر قليلًا عن المعدل المتوقع", severity: "warning" };
  return { code: "RED", label: "متأخر بشكل كبير عن المعدل المتوقع", severity: "critical" };
}

export function buildPerformanceWarning(args: {
  label: string;
  actual: number;
  expected: number;
  context: ExpectedTargetContext;
  unit?: string;
}) {
  const actual = roundOne(args.actual);
  const expected = roundOne(args.expected);
  const prefix = args.context.isFinalPeriod ? args.context.finalShortfallText : args.context.expectedShortfallText;
  const suffix = args.context.isFinalPeriod ? "مطلوب شهريًا" : "متوقع حتى اليوم";
  const unit = args.unit ? ` ${args.unit}` : "";
  return `${args.label}: ${prefix} - ${actual}${unit} من ${expected}${unit} ${suffix}`;
}

