export const LEVEL_NOT_AVAILABLE = "Not Available";

export function normalizeCurrentEstimatedLevel(value: unknown) {
  const level = String(value ?? "").trim();
  if (!level || level === "-" || /^n\/?a$/i.test(level) || /^not\s+available$/i.test(level)) return null;
  return level;
}

export function displayCurrentEstimatedLevel(value: unknown) {
  return normalizeCurrentEstimatedLevel(value) ?? LEVEL_NOT_AVAILABLE;
}

