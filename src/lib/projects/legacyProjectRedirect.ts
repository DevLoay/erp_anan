import { redirect } from "next/navigation";

const LEGACY_PROJECT_SLUGS = new Set(["keeta", "hungerstation", "talabat", "ninja", "toyou"]);

function one(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export function redirectLegacyProjectSlug(projectId: string, params: Record<string, string | string[] | undefined> = {}) {
  const application = projectId.trim().toLowerCase();
  if (!LEGACY_PROJECT_SLUGS.has(application)) return;

  const query = new URLSearchParams({ application });
  for (const key of ["type", "importType", "fileType", "mode", "dateFrom", "dateTo", "month", "runId"]) {
    const value = one(params, key);
    if (!value) continue;
    query.set(key === "importType" || key === "fileType" ? "type" : key, value);
  }

  redirect(`/projects?${query.toString()}`);
}
