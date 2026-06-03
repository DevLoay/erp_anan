export type AppRole =
  | "ADMIN"
  | "OPERATION_MANAGER"
  | "SUPERVISOR"
  | "ACCOUNTANT"
  | "HR"
  | "VIEWER";

const financeResources = new Set([
  "payroll",
  "advances",
  "deductions",
  "invoices",
  "receivables",
  "payments",
  "expenses",
  "revenues",
  "supplier-accounts",
  "cashbox-entries",
  "bank-accounts",
  "vat-records",
  "profit-loss",
  "vehicle-costs",
]);

const hrResources = new Set([
  "drivers",
  "supervisors",
  "interviews",
  "driver-documents",
  "driver-contracts",
  "driver-housing",
  "driver-warnings",
  "advances",
]);

const supervisorResources = new Set(["drivers", "daily-reports", "tasks", "notifications", "violations", "attendance", "shifts"]);

export function roleFromHeaders(headers: Headers): AppRole {
  const cookieRole = headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("erp-user-role="))
    ?.split("=")[1];
  const raw = (headers.get("x-user-role") || cookieRole || "").toUpperCase().replace(/\s+/g, "_");
  if (
    raw === "ADMIN" ||
    raw === "OPERATION_MANAGER" ||
    raw === "SUPERVISOR" ||
    raw === "ACCOUNTANT" ||
    raw === "HR" ||
    raw === "VIEWER"
  ) {
    return raw;
  }
  return "VIEWER";
}

export function canReadResource(role: AppRole, resource: string) {
  if (role === "ADMIN" || role === "OPERATION_MANAGER") return true;
  if (role === "ACCOUNTANT") return financeResources.has(resource) || resource === "daily-reports";
  if (role === "HR") return hrResources.has(resource) || resource === "cities" || resource === "projects";
  if (role === "SUPERVISOR") {
    return supervisorResources.has(resource);
  }
  return !financeResources.has(resource);
}

export function canWriteResource(role: AppRole, resource: string) {
  if (role === "ADMIN" || role === "OPERATION_MANAGER") return true;
  if (role === "ACCOUNTANT") return financeResources.has(resource);
  if (role === "HR") return hrResources.has(resource);
  if (role === "SUPERVISOR") return resource === "tasks" || resource === "attendance";
  return false;
}
