export function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "boolean") return value ? "نعم" : "لا";
  if (typeof value === "object" && "toString" in value) return String(value);
  return String(value);
}

export function money(value: unknown) {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}
