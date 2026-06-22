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
  { section: "الرئيسية والتقارير", resource: "dashboard", label: "لوحة الإدارة", route: "/dashboard" },
  { section: "الرئيسية والتقارير", resource: "reports", label: "التقارير العامة", route: "/reports" },
  { section: "الرئيسية والتقارير", resource: "management-reports", label: "التقارير الإدارية", route: "/management-reports" },
  { section: "الرئيسية والتقارير", resource: "operations-alerts", label: "تنبيهات العمليات", route: "/operations-alerts" },
  { section: "الرئيسية والتقارير", resource: "uploaded-reports", label: "التقارير المرفوعة", route: "/uploaded-reports" },
  { section: "الإدارة العامة", resource: "users", label: "المستخدمون والصلاحيات", route: "/users" },
  { section: "الإدارة العامة", resource: "permissions", label: "مصفوفة الصلاحيات", route: "/permissions" },
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
  { section: "التشغيل", resource: "shifts", label: "الشفتات", route: "/shifts" },
  { section: "المناديب والموارد البشرية", resource: "drivers", label: "المناديب", route: "/drivers" },
  { section: "المناديب والموارد البشرية", resource: "supervisors", label: "المشرفون", route: "/supervisors" },
  { section: "المناديب والموارد البشرية", resource: "interviews", label: "المقابلات", route: "/interviews" },
  { section: "المناديب والموارد البشرية", resource: "driver-documents", label: "مستندات المناديب", route: "/rider-documents" },
  { section: "المناديب والموارد البشرية", resource: "driver-housing", label: "سكن المناديب", route: "/rider-housing" },
  { section: "المناديب والموارد البشرية", resource: "driver-contracts", label: "العقود والكفالة", route: "/contracts-sponsorship" },
  { section: "السيارات والحركة", resource: "vehicles", label: "السيارات", route: "/vehicles" },
  { section: "السيارات والحركة", resource: "vehicle-movements", label: "حركة السيارات", route: "/vehicle-movements" },
  { section: "السيارات والحركة", resource: "vehicle-maintenance", label: "الصيانة", route: "/vehicle-maintenance" },
  { section: "السيارات والحركة", resource: "vehicle-authorizations", label: "التفويضات", route: "/authorizations" },
  { section: "السيارات والحركة", resource: "vehicle-accidents", label: "الحوادث", route: "/vehicle-accidents" },
  { section: "السيارات والحركة", resource: "vehicle-damages", label: "التلفيات", route: "/vehicle-damages" },
  { section: "السيارات والحركة", resource: "vehicle-cleaning", label: "نظافة السيارات", route: "/vehicle-cleaning" },
  { section: "السيارات والحركة", resource: "vehicle-costs", label: "تكلفة السيارات", route: "/vehicle-cost" },
  { section: "السيارات والحركة", resource: "violations", label: "المخالفات", route: "/violations" },
  { section: "الماليات", resource: "finance", label: "مركز الماليات", route: "/finance" },
  { section: "الماليات", resource: "payroll", label: "مسير الرواتب", route: "/payroll" },
  { section: "الماليات", resource: "payroll-settings", label: "إعدادات المسير", route: "/payroll/settings" },
  { section: "الماليات", resource: "advances", label: "السلف", route: "/advances" },
  { section: "الماليات", resource: "deductions", label: "الخصومات", route: "/deductions" },
  { section: "الماليات", resource: "invoices", label: "الفواتير", route: "/invoices" },
  { section: "الماليات", resource: "receivables", label: "المستحقات", route: "/receivables" },
  { section: "الماليات", resource: "payments", label: "المدفوعات", route: "/payments" },
  { section: "الماليات", resource: "expenses", label: "المصروفات", route: "/expenses" },
  { section: "الماليات", resource: "revenues", label: "الإيرادات", route: "/revenues" },
  { section: "الماليات", resource: "supplier-accounts", label: "حسابات الموردين", route: "/supplier-accounts" },
  { section: "الماليات", resource: "cashbox-entries", label: "العهدة والصندوق", route: "/custody-cashbox" },
  { section: "الماليات", resource: "bank-accounts", label: "الحسابات البنكية", route: "/bank-accounts" },
  { section: "الماليات", resource: "vat-records", label: "ضريبة القيمة المضافة", route: "/vat" },
  { section: "الماليات", resource: "profit-loss", label: "الأرباح والخسائر", route: "/profit-loss" },
  { section: "الماليات", resource: "financial-reports", label: "التقارير المالية", route: "/financial-reports" },
  { section: "التقارير", resource: "notifications", label: "الإشعارات والتنبيهات", route: "/notifications" },
  { section: "التقارير", resource: "report-templates", label: "قوالب التقارير", route: "/report-templates" },
] as const;

const adminOnlyResources = new Set([
  "users",
  "permissions",
  "audit-logs",
  "system-settings",
  "import-templates",
  "payroll-settings",
]);

const financeResources = new Set([
  "finance",
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
  "financial-reports",
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

  "shifts",


]);

const supervisorResources = new Set([
  "drivers",
  "daily-reports",
  "tasks",
  "notifications",
  "violations",
  "driver-warnings",
  "attendance",
  "shifts",



]);


const reportResources = new Set([
  "dashboard",
  "reports",
  "management-reports",
  "daily-reports",
  "notifications",
  "operations-alerts",
  "uploaded-reports",
  "report-templates",
]);

const viewerResources = new Set(["home", "notifications"]);

export function roleFromHeaders(headers: Headers): AppRole {
  const cookieRole = headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("erp-user-role="))
    ?.split("=")[1];
  const raw = decodeURIComponent(headers.get("x-user-role") || cookieRole || "").toUpperCase().replace(/\s+/g, "_");
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
  if (reportResources.has(resource)) return true;
  if (role === "ACCOUNTANT") return financeResources.has(resource) || resource === "daily-reports";
  if (role === "HR") return hrResources.has(resource) || resource === "cities" || resource === "projects";
  if (role === "SUPERVISOR") return supervisorResources.has(resource);
  return viewerResources.has(resource);
}

export function canWriteResource(role: AppRole, resource: string) {
  if (role === "ADMIN") return true;
  if (adminOnlyResources.has(resource)) return false;
  if (role === "OPERATION_MANAGER") return true;
  if (role === "ACCOUNTANT") return financeResources.has(resource);
  if (role === "HR") return hrResources.has(resource);
  if (role === "SUPERVISOR") return resource === "tasks" || resource === "attendance" || resource === "violations" || resource === "driver-warnings";
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

const routeResourceMap: Array<[string, string]> = [
  ["/settings/application-account-review", "application-accounts"],
  ["/settings/payroll", "payroll-settings"],
  ["/settings/templates", "system-settings"],
  ["/settings", "system-settings"],
  ["/user-management", "users"],
  ["/users", "users"],
  ["/permissions", "permissions"],
  ["/audit-log", "audit-logs"],
  ["/finance", "finance"],
  ["/financial-reports", "financial-reports"],
  ["/profit-loss", "profit-loss"],
  ["/supplier-accounts", "supplier-accounts"],
  ["/custody-cashbox", "cashbox-entries"],
  ["/bank-accounts", "bank-accounts"],
  ["/receivables", "receivables"],
  ["/payments", "payments"],
  ["/expenses", "expenses"],
  ["/revenues", "revenues"],
  ["/invoices", "invoices"],
  ["/advances", "advances"],
  ["/deductions", "deductions"],
  ["/vat", "vat-records"],
  ["/payroll/settings", "payroll-settings"],
  ["/payroll", "payroll"],
  ["/vehicle-cost", "vehicle-costs"],
  ["/vehicle-finance", "vehicle-costs"],
  ["/vehicle-movements", "vehicle-movements"],
  ["/vehicle-maintenance", "vehicle-maintenance"],
  ["/vehicle-accidents", "vehicle-accidents"],
  ["/vehicle-damages", "vehicle-damages"],
  ["/vehicle-cleaning", "vehicle-cleaning"],
  ["/authorizations", "vehicle-authorizations"],
  ["/vehicles", "vehicles"],
  ["/drivers", "drivers"],
  ["/supervisors", "supervisors"],
  ["/attendance", "attendance"],
  ["/supervisor-tasks", "tasks"],  ["/shifts", "shifts"],  ["/interviews", "interviews"],  ["/rider-housing", "driver-housing"],  ["/rider-documents", "driver-documents"],




  ["/violations", "violations"],
  ["/notifications", "notifications"],
];

const apiResourceAliases: Record<string, string> = {
  "user-management": "users",
  "users": "users",
  "settings": "system-settings",
  "audit-log": "audit-logs",
  "invoices": "invoices",
  "receivables": "receivables",
  "payments": "payments",
  "expenses": "expenses",
  "revenues": "revenues",
  "advances": "advances",
  "deductions": "deductions",
  "supplier-accounts": "supplier-accounts",
  "cashbox-entries": "cashbox-entries",
  "bank-accounts": "bank-accounts",
  "vat-records": "vat-records",
  "profit-loss": "profit-loss",
  "vehicle-costs": "vehicle-costs",
  "vehicles": "vehicles",
  "vehicle-movements": "vehicle-movements",
  "vehicle-maintenance": "vehicle-maintenance",
  "vehicle-authorizations": "vehicle-authorizations",
  "vehicle-accidents": "vehicle-accidents",
  "vehicle-damages": "vehicle-damages",
  "vehicle-cleaning": "vehicle-cleaning",
  "violations": "violations",
  "drivers": "drivers",
  "supervisors": "supervisors",
  "attendance": "attendance",
  "supervisor-tasks": "tasks",
  "rider-documents": "driver-documents",
  "rider-housing": "driver-housing",
  "interviews": "interviews",
  "shifts": "shifts",
};

export function resourceFromPath(pathname: string): string | null {
  if (pathname === "/") return "home";

  if (pathname.startsWith("/api/")) {
    const [, , rawResource] = pathname.split("/");
    return apiResourceAliases[rawResource] ?? null;
  }

  const normalized = pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname;
  const match = [...routeResourceMap]
    .sort((a, b) => b[0].length - a[0].length)
    .find(([route]) => normalized === route || normalized.startsWith(`${route}/`));

  return match?.[1] ?? null;
}
