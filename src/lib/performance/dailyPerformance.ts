export const DAILY_MINIMUM_ORDERS = 10;

export type AttendanceStatusCode =
  | "WORKING"
  | "LEAVE"
  | "DAY_OFF"
  | "EXCUSED_ABSENCE"
  | "ABSENT"
  | "NOT_SCHEDULED";

export type DailyPerformanceStatusCode =
  | "ACHIEVED"
  | "BELOW_MINIMUM"
  | "LEAVE"
  | "DAY_OFF"
  | "EXCUSED_ABSENCE"
  | "ABSENT"
  | "NOT_SCHEDULED";

export type DailyPerformanceResult = {
  attendanceStatusCode: AttendanceStatusCode;
  attendanceStatusLabel: string;
  performanceStatusCode: DailyPerformanceStatusCode;
  performanceStatusLabel: string;
  warning: string;
  shouldEvaluate: boolean;
  achievedMinimum: boolean;
  tone: "green" | "amber" | "red" | "slate" | "blue";
};

type StatusHints = {
  orders?: unknown;
  workingHours?: unknown;
  onShift?: boolean | null;
  validDay?: boolean | null;
  noShows?: unknown;
};

function asNumber(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_\-./]+/g, "");
}

function hasAny(raw: string, values: string[]) {
  return values.some((value) => raw.includes(normalizeText(value)));
}

export function normalizeAttendanceStatus(value: unknown, hints: StatusHints = {}): AttendanceStatusCode {
  const raw = normalizeText(value);

  if (raw) {
    if (hasAny(raw, ["excused absence", "excused", "غياب بعذر", "غيابعذر", "عذر"])) return "EXCUSED_ABSENCE";
    if (hasAny(raw, ["not scheduled", "not-scheduled", "notscheduled", "غير مجدول", "غيرمجدول", "no shift", "noshift"])) return "NOT_SCHEDULED";
    if (hasAny(raw, ["day off", "dayoff", "rest day", "off day", "راحة", "راحه"])) return "DAY_OFF";
    if (hasAny(raw, ["leave", "vacation", "annual leave", "إجازة", "اجازة"])) return "LEAVE";
    if (hasAny(raw, ["absent", "absence", "no show", "noshow", "غياب", "غائب"])) return "ABSENT";
    if (hasAny(raw, ["working", "work", "on shift", "onshift", "present", "active", "حاضر", "دوام", "يعمل"])) return "WORKING";
  }

  const orders = asNumber(hints.orders);
  const workingHours = asNumber(hints.workingHours);
  const noShows = asNumber(hints.noShows);

  if (noShows > 0 && orders <= 0 && workingHours <= 0) return "ABSENT";
  if (hints.validDay === false && hints.onShift === false && orders <= 0 && workingHours <= 0) return "NOT_SCHEDULED";
  if (hints.validDay === false && orders <= 0 && workingHours <= 0) return "NOT_SCHEDULED";
  if (orders > 0 || workingHours > 0 || hints.onShift === true || hints.validDay === true) return "WORKING";

  return "WORKING";
}

export function attendanceStatusLabel(status: AttendanceStatusCode) {
  const labels: Record<AttendanceStatusCode, string> = {
    WORKING: "Working",
    LEAVE: "إجازة",
    DAY_OFF: "راحة",
    EXCUSED_ABSENCE: "غياب بعذر",
    ABSENT: "غياب",
    NOT_SCHEDULED: "غير مجدول",
  };
  return labels[status];
}

export function isWorkingAttendanceStatus(status: AttendanceStatusCode) {
  return status === "WORKING";
}

export function getDailyPerformanceStatus(args: {
  attendanceStatus?: unknown;
  orders: unknown;
  minimumOrders?: number;
  hints?: StatusHints;
}): DailyPerformanceResult {
  const minimumOrders = Math.max(1, Number(args.minimumOrders ?? DAILY_MINIMUM_ORDERS) || DAILY_MINIMUM_ORDERS);
  const orders = asNumber(args.orders);
  const attendanceStatusCode = normalizeAttendanceStatus(args.attendanceStatus, { ...args.hints, orders });
  const attendanceStatusText = attendanceStatusLabel(attendanceStatusCode);

  if (attendanceStatusCode !== "WORKING") {
    const performanceStatusLabel = attendanceStatusText;
    return {
      attendanceStatusCode,
      attendanceStatusLabel: attendanceStatusText,
      performanceStatusCode: attendanceStatusCode,
      performanceStatusLabel,
      warning: attendanceStatusCode === "ABSENT" ? "غياب" : "",
      shouldEvaluate: false,
      achievedMinimum: false,
      tone: attendanceStatusCode === "ABSENT" ? "red" : "slate",
    };
  }

  const achievedMinimum = orders >= minimumOrders;
  return {
    attendanceStatusCode,
    attendanceStatusLabel: attendanceStatusText,
    performanceStatusCode: achievedMinimum ? "ACHIEVED" : "BELOW_MINIMUM",
    performanceStatusLabel: achievedMinimum ? "محقق" : "أقل من الحد الأدنى",
    warning: achievedMinimum ? "" : "أقل من الحد الأدنى",
    shouldEvaluate: true,
    achievedMinimum,
    tone: achievedMinimum ? "green" : "amber",
  };
}

