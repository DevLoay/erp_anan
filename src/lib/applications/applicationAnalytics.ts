export type ApplicationTone = "emerald" | "amber" | "red" | "blue" | "slate";

export type ApplicationChartDatum = {
  name: string;
  value: number;
};

export const applicationCatalog = [
  { key: "keeta", code: "KEETA", name: "Keeta" },
  { key: "hungerstation", code: "HUNGERSTATION", name: "HungerStation" },
  { key: "talabat", code: "TALABAT", name: "Talabat" },
  { key: "other", code: "OTHER", name: "Other Applications" },
] as const;

export function numberValue(value: unknown) {
  if (typeof value === "object" && value !== null && "toNumber" in value && typeof value.toNumber === "function") {
    return value.toNumber();
  }
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function moneyValue(value: unknown) {
  return new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 0,
  }).format(numberValue(value));
}

export function formatDate(value: unknown) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "-";
  return date.toISOString().slice(0, 10);
}

export function normalizeAppKey(value: unknown) {
  const raw = String(value ?? "").trim().toLowerCase();
  const compact = raw.replace(/[\s_-]+/g, "");
  if (!compact) return "other";
  if (compact.includes("keeta")) return "keeta";
  if (compact.includes("hungerstation") || compact.includes("hunger")) return "hungerstation";
  if (compact.includes("talabat")) return "talabat";
  return "other";
}

export function applicationDisplayName(key: string) {
  return applicationCatalog.find((item) => item.key === key)?.name ?? key;
}

export function recordStatusText(status: unknown) {
  const value = String(status ?? "").toUpperCase();
  if (value === "ACTIVE" || value === "active") return "نشط";
  if (value === "INACTIVE" || value === "inactive") return "غير نشط";
  if (value === "APPROVED" || value === "approved") return "معتمد";
  if (value === "LOCKED" || value === "locked") return "مغلق";
  if (value === "PENDING" || value === "pending") return "قيد المراجعة";
  if (value === "DRAFT" || value === "draft") return "مسودة";
  if (value === "preview") return "معاينة";
  return String(status ?? "-");
}

export function statusTone(status: unknown): ApplicationTone {
  const value = String(status ?? "").toUpperCase();
  if (["ACTIVE", "APPROVED", "PAID"].includes(value)) return "emerald";
  if (["PENDING", "DRAFT", "UNDER_REVIEW", "PREVIEW"].includes(value)) return "amber";
  if (["INACTIVE", "REJECTED", "LOCKED"].includes(value)) return "red";
  return "slate";
}

export function buildInsight(appName: string, projectsCount: number, activeAccounts: number, unlinkedAccounts: number) {
  if (!projectsCount && !activeAccounts && !unlinkedAccounts) {
    return "لا توجد بيانات كافية لتحليل هذا التطبيق حاليًا.";
  }

  return `تطبيق ${appName} يحتوي على ${projectsCount} مشاريع و ${activeAccounts} حساب نشط، ويوجد ${unlinkedAccounts} حسابات غير مربوطة بمناديب.`;
}

