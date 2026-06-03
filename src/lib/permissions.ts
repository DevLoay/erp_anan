export type AppRole =
  | "ADMIN"
  | "OPERATION_MANAGER"
  | "SUPERVISOR"
  | "ACCOUNTANT"
  | "HR"
  | "VIEWER";

export const appRoles: AppRole[] = ["ADMIN", "OPERATION_MANAGER", "SUPERVISOR", "ACCOUNTANT", "HR", "VIEWER"];

export const roleLabels: Record<AppRole, string> = {
  ADMIN: "مدير النظام",
  OPERATION_MANAGER: "مدير التشغيل",
  SUPERVISOR: "مشرف",
  ACCOUNTANT: "محاسب / مالية",
  HR: "موارد بشرية",
  VIEWER: "مشاهد فقط",
};

export const permissionModules = [
  { section: "الإدارة العامة", resource: "users", label: "المستخدمون والصلاحيات", route: "/users" },
  { section: "الإدارة العامة", resource: "audit-logs", label: "سجل العمليات", route: "/audit-log" },
  { section: "الإدارة العامة", resource: "system-settings", label: "إعدادات النظام", route: "/settings" },
  { section: "المدن والمشاريع", resource: "applications", label: "مركز التطبيقات", route: "/applications" },
  { section: "المدن والمشاريع", resource: "application-accounts", label: "حسابات التطبيقات", route: "/settings/application-account-review" },
  { section: "المدن والمشاريع", resource: "projects", label: "المشاريع", route: "/projects" },
  { section: "المدن والمشاريع", resource: "cities", label: "المدن", route: "/cities" },
  { section: "التشغيل", resource: "import-batches", label: "الاستيراد", route: "/imports" },
  { section: "التشغيل", resource: "daily-reports", label: "التقارير اليومية", route: "/daily-reports" },
  { section: "التشغيل", resource: "tasks", label: "مهام المشرفين", route: "/supervisor-tasks" },
  { section: "التشغيل", resource: "attendance", label: "الحضور والانصراف", route: "/attendance" },
  { section: "المناديب والموارد البشرية", resource: "drivers", label: "المناديب", route: "/drivers" },
  { section: "المناديب والموارد البشرية", resource: "supervisors", label: "المشرفون", route: "/supervisors" },
  { section: "المناديب والموارد البشرية", resource: "driver-documents", label: "مستندات المناديب", route: "/rider-documents" },
  { section: "المناديب والموارد البشرية", resource: "driver-contracts", label: "العقود والكفالة", route: "/contracts-sponsorship" },
  { section: "السيارات والحركة", resource: "vehicles", label: "السيارات", route: "/vehicles" },
  { section: "السيارات والحركة", resource: "vehicle-movements", label: "حركة السيارات", route: "/vehicle-movements" },
  { section: "السيارات والحركة", resource: "vehicle-costs", label: "تكلفة السيارات", route: "/vehicle-cost" },
  { section: "السيارات والحركة", resource: "violations", label: "المخالفات", route: "/violations" },
  { section: "الماليات", resource: "payroll", label: "مسير الرواتب", route: "/payroll" },
  { section: "الماليات", resource: "payroll-settings", label: "إعدادات المسير", route: "/payroll/settings" },
  { section: "الماليات", resource: "advances", label: "السلف", route: "/advances" },
  { section: "الماليات", resource: "deductions", label: "الخصومات", route: "/deductions" },
  { section: "الماليات", resource: "invoices", label: "الفواتير", route: "/invoices" },
  { section: "التقارير", resource: "notifications", label: "الإشعارات والتنبيهات", route: "/notifications" },
  { section: "التقارير", resource: "report-templates", label: "قوالب التقارير", route: "/report-templates" },
] as const;

const adminOnlyResources = new Set(["users", "audit-logs", "system-settings", "import-templates", "payroll-settings"]);

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
  if (role === "ADMIN") return true;
  if (adminOnlyResources.has(resource)) return false;
  if (role === "OPERATION_MANAGER") return true;
  if (role === "ACCOUNTANT") return financeResources.has(resource) || resource === "daily-reports";
  if (role === "HR") return hrResources.has(resource) || resource === "cities" || resource === "projects";
  if (role === "SUPERVISOR") {
    return supervisorResources.has(resource);
  }
  return !financeResources.has(resource);
}

export function canWriteResource(role: AppRole, resource: string) {
  if (role === "ADMIN") return true;
  if (adminOnlyResources.has(resource)) return false;
  if (role === "OPERATION_MANAGER") return true;
  if (role === "ACCOUNTANT") return financeResources.has(resource);
  if (role === "HR") return hrResources.has(resource);
  if (role === "SUPERVISOR") return resource === "tasks" || resource === "attendance";
  return false;
}

export function permissionState(role: AppRole, resource: string) {
  const read = canReadResource(role, resource);
  const write = canWriteResource(role, resource);
  return {
    read,
    write,
    approve: role === "ADMIN" || (role === "OPERATION_MANAGER" && !adminOnlyResources.has(resource) && ["payroll", "invoices", "import-batches"].includes(resource)),
    delete: role === "ADMIN",
    adminOnly: adminOnlyResources.has(resource),
  };
}
