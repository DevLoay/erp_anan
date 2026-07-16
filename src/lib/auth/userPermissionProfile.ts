import type { AppRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const USER_PERMISSION_PROFILE_PREFIX = "USER_PERMISSION_PROFILE:";
export const ADMIN_PROFILE_PREFIX = "ADMIN_PROFILE:";

export type PermissionAccessLevel = "view" | "create" | "edit" | "approve" | "export" | "delete";

export type UserPermissionProfile = {
  profileKey: string;
  labelAr: string;
  labelEn?: string;
  permissions: string[];
  scopeType: "ALL" | "CITY" | "APPLICATION" | "APPLICATION_PROJECT" | "SELF";
  cityIds: string[];
  applicationIds: string[];
  applicationProjectIds: string[];
  importBatchId?: string;
};

export const supervisorOperationalPermissions = [
  "dashboard.view",
  "projects.view",
  "cities.view",
  "applicationAccounts.view",
  "drivers.view",
  "supervisors.view",
  "driverDocuments.view",
  "driverHousing.view",
  "hr.view",
  "vehicles.view",
  "vehicleMovements.view",
  "vehicleMaintenance.view",
  "vehicleAuthorizations.view",
  "vehicleAccidents.view",
  "vehicleDamages.view",
  "vehicleCleaning.view",
  "vehicleCosts.view",
  "dailyReports.view",
  "managementReports.view",
  "reports.view",
  "payroll.view",
  "advances.view",
  "deductions.view",
  "violations.view",
  "invoices.view",
  "notifications.view",
  "tasks.view",
  "tasks.create",
  "tasks.edit",
  "attendance.view",
  "attendance.create",
] as const;

function splitTextScope(value?: string | null) {
  return [...new Set(String(value ?? "").split(/[;,|]/).map((item) => item.trim()).filter(Boolean))];
}

export function buildSupervisorPermissionProfile(input: {
  cityId?: string | null;
  cityScope?: string | null;
  projectScope?: string | null;
}) {
  const cityIds = [...new Set([input.cityId, ...splitTextScope(input.cityScope)].filter(Boolean) as string[])];
  const applicationProjectIds = splitTextScope(input.projectScope);
  const isProjectSupervisor = applicationProjectIds.length > 0;

  return {
    profileKey: isProjectSupervisor ? "project_supervisor" : "city_supervisor",
    labelAr: isProjectSupervisor ? "مشرف مشروع" : "مشرف مدينة",
    labelEn: isProjectSupervisor ? "Project Supervisor" : "City Supervisor",
    permissions: [...supervisorOperationalPermissions],
    scopeType: isProjectSupervisor ? "APPLICATION_PROJECT" : "CITY",
    cityIds,
    applicationIds: [],
    applicationProjectIds,
    source: "USER_MANAGEMENT",
  };
}

const resourcePrefixes: Record<string, string> = {
  users: "users",
  permissions: "permissions",
  "audit-logs": "auditLogs",
  "system-settings": "settings",
  dashboard: "dashboard",
  reports: "reports",
  "management-reports": "managementReports",
  "operations-alerts": "notifications",
  "uploaded-reports": "reports",
  applications: "projects",
  projects: "projects",
  cities: "cities",
  "application-accounts": "applicationAccounts",
  "import-batches": "importBatches",
  "import-templates": "importBatches",
  "template-configs": "settings",
  "daily-reports": "dailyReports",
  tasks: "tasks",
  attendance: "attendance",
  shifts: "attendance",
  drivers: "drivers",
  supervisors: "supervisors",
  interviews: "hr",
  "driver-documents": "driverDocuments",
  "driver-housing": "driverHousing",
  "driver-contracts": "hr",
  "driver-warnings": "drivers",
  vehicles: "vehicles",
  "vehicle-movements": "vehicleMovements",
  "vehicle-maintenance": "vehicleMaintenance",
  "vehicle-authorizations": "vehicleAuthorizations",
  "vehicle-accidents": "vehicleAccidents",
  "vehicle-damages": "vehicleDamages",
  "vehicle-cleaning": "vehicleCleaning",
  "vehicle-costs": "vehicleCosts",
  violations: "violations",
  finance: "finance",
  payroll: "payroll",
  "payroll-settings": "payroll",
  advances: "advances",
  deductions: "deductions",
  invoices: "invoices",
  receivables: "receivables",
  payments: "payments",
  expenses: "expenses",
  revenues: "revenues",
  "supplier-accounts": "finance",
  "cashbox-entries": "finance",
  "bank-accounts": "finance",
  "vat-records": "vatRecords",
  "profit-loss": "profitLoss",
  "financial-reports": "financeReports",
  notifications: "notifications",
  "report-templates": "reports"
};

function strings(value: unknown) {
  return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : [];
}

export function parseUserPermissionProfile(value: unknown): UserPermissionProfile | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const profileKey = String(raw.profileKey ?? "").trim();
  const permissions = strings(raw.permissions);
  if (!profileKey || !permissions.length) return null;
  const rawScope = String(raw.scopeType ?? "CITY").toUpperCase();
  const scopeType = ["ALL", "CITY", "APPLICATION", "APPLICATION_PROJECT", "SELF"].includes(rawScope)
    ? (rawScope as UserPermissionProfile["scopeType"])
    : "CITY";
  return {
    profileKey,
    labelAr: String(raw.labelAr ?? profileKey),
    labelEn: String(raw.labelEn ?? "") || undefined,
    permissions,
    scopeType,
    cityIds: strings(raw.cityIds),
    applicationIds: strings(raw.applicationIds),
    applicationProjectIds: strings(raw.applicationProjectIds),
    importBatchId: String(raw.importBatchId ?? "") || undefined,
  };
}

export async function loadUserPermissionProfile(userId: string) {
  if (!userId) return null;
  const setting = await prisma.systemSetting.findUnique({
    where: { key: `${USER_PERMISSION_PROFILE_PREFIX}${userId}` },
    select: { value: true },
  });
  return parseUserPermissionProfile(setting?.value);
}

export function accessLevelFromRequest(method: string, pathname: string): PermissionAccessLevel {
  const upper = method.toUpperCase();
  if (upper === "GET" || upper === "HEAD" || upper === "OPTIONS") return pathname.includes("/export") ? "export" : "view";
  if (upper === "DELETE") return "delete";
  if (/approve|confirm|lock/i.test(pathname)) return "approve";
  if (/export|download/i.test(pathname)) return "export";
  if (upper === "POST") return "create";
  return "edit";
}

export function profileAllows(profile: UserPermissionProfile, resource: string, accessLevel: PermissionAccessLevel) {
  const prefix = resourcePrefixes[resource] ?? resource.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
  const permissions = new Set(profile.permissions);
  if (permissions.has("*") || permissions.has(`${prefix}.*`) || permissions.has(`${prefix}.manage`)) return true;
  if (permissions.has(`${prefix}.${accessLevel}`)) return true;
  if (accessLevel === "view") return profile.permissions.some((permission) => permission.startsWith(`${prefix}.`));
  return false;
}

export function effectiveRoleForProfile(
  originalRole: AppRole,
  profile: UserPermissionProfile,
  resource: string,
  accessLevel: PermissionAccessLevel,
): AppRole {
  if (originalRole === "ADMIN" || profile.permissions.includes("*")) return "ADMIN";
  if (accessLevel === "delete" || ["users", "permissions", "audit-logs", "system-settings"].includes(resource)) return "ADMIN";
  return "OPERATION_MANAGER";
}

export function readableResources(profile: UserPermissionProfile) {
  if (profile.permissions.includes("*")) return ["*"];
  return Object.entries(resourcePrefixes)
    .filter(([resource]) => profileAllows(profile, resource, "view"))
    .map(([resource]) => resource);
}
