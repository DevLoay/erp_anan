export type ModuleItem = {
  href: string;
  label: string;
  oldKey?: string;
  status: "connected" | "migration";
  resource?: string;
  description: string;
};

export type ModuleSection = {
  title: string;
  items: ModuleItem[];
};

export const moduleSections: ModuleSection[] = [
  {
    title: "الإدارة العامة",
    items: [
      { href: "/dashboard", label: "لوحة الإدارة", oldKey: "dashboard", status: "connected", description: "مؤشرات الإدارة من قاعدة PostgreSQL." },
      { href: "/supervisors", label: "المشرفين", oldKey: "supervisors", status: "connected", resource: "supervisors", description: "ملف المشرفين وربطهم بالمدن والمناديب." },
      { href: "/reports", label: "التقارير العامة", oldKey: "reports", status: "connected", description: "مركز تقارير أولي للتقارير اليومية والتنبيهات والمهام." },
      { href: "/notifications", label: "الإشعارات والتنبيهات", oldKey: "notifications", status: "migration", resource: "notifications", description: "تنبيهات تشغيلية مرتبطة بالأداء والحضور والحسابات." },
      { href: "/settings", label: "إعدادات البرنامج", oldKey: "settings", status: "connected", description: "الأدوار وإعدادات النظام والـ KPI." },
      { href: "/audit-log", label: "سجل العمليات", oldKey: "auditLog", status: "migration", resource: "audit-logs", description: "سجل التغييرات الحساسة والاستيراد والصلاحيات." },
      { href: "/user-management", label: "المستخدمين والصلاحيات", oldKey: "userManagement", status: "migration", resource: "users", description: "المستخدمين والأدوار ونطاق المدن والمشرفين." },
    ],
  },
  {
    title: "المدن والمشاريع",
    items: [
      { href: "/applications", label: "مركز التطبيقات", oldKey: "projects", status: "connected", resource: "applications", description: "حسابات التطبيقات وربطها بالمشاريع والمناديب." },
      { href: "/cities", label: "المدن", oldKey: "cities", status: "connected", resource: "cities", description: "المدن التشغيلية ونطاق البيانات." },
      { href: "/city-targets", label: "تارجت المدن", oldKey: "cityTargets", status: "migration", resource: "city-targets", description: "أهداف شهرية لكل مدينة وتطبيق." },
      { href: "/city-ranking", label: "ترتيب المدن", oldKey: "cityRanking", status: "migration", resource: "city-targets", description: "ترتيب المدن حسب الأداء والتحقيق والتنبيهات." },
      { href: "/projects", label: "المشاريع", oldKey: "projects", status: "connected", resource: "projects", description: "المشاريع والتطبيقات وربطها بالمدن." },
    ],
  },
  {
    title: "التشغيل",
    items: [
      { href: "/imports", label: "استيراد تقارير التطبيقات", oldKey: "importReports", status: "connected", description: "معاينة الملفات قبل الحفظ." },
      { href: "/uploaded-reports", label: "تقارير مرفوعة", oldKey: "reportManager", status: "migration", resource: "uploaded-reports", description: "سجل التقارير المستوردة وحالتها." },
      { href: "/account-movement", label: "حركة الحسابات", oldKey: "appAccountMovements", status: "migration", resource: "app-account-movements", description: "تتبع الحسابات الفارغة والمرتبطة والمنقولة." },
      { href: "/daily-reports", label: "التقارير اليومية", oldKey: "dailyReports", status: "connected", resource: "daily-reports", description: "الأداء اليومي من التقارير المعتمدة." },
      { href: "/supervisor-tasks", label: "مهام المشرفين", oldKey: "tasks", status: "migration", resource: "tasks", description: "مهام مرتبطة بالتنبيهات والمشرفين والمناديب." },
      { href: "/attendance", label: "الحضور والانصراف", oldKey: "attendance", status: "migration", resource: "attendance", description: "الحضور والساعات وربطها بالـ KPI." },
      { href: "/rider-kpi", label: "KPI المناديب", oldKey: "driverKpi", status: "migration", resource: "daily-reports", description: "مؤشرات المناديب من قواعد النظام." },
      { href: "/rider-reports", label: "تقارير المناديب", oldKey: "driverReports", status: "migration", resource: "daily-reports", description: "تقرير مندوب شامل للأداء والحضور والتنبيهات." },
      { href: "/rider-violations", label: "مخالفات المناديب", oldKey: "driverViolations", status: "migration", resource: "violations", description: "مخالفات تشغيلية ومالية." },
      { href: "/operations-alerts", label: "تنبيهات التشغيل", oldKey: "operationAlerts", status: "migration", resource: "notifications", description: "تنبيهات مولدة من مشاكل التشغيل." },
      { href: "/shifts", label: "الشفتات", oldKey: "shiftManagement", status: "migration", resource: "shifts", description: "إدارة الشفتات وربطها بالحضور." },
      { href: "/quality-audit", label: "الجودة والتدقيق", oldKey: "qualityControl", status: "migration", resource: "quality-audits", description: "تدقيق التقارير والمهام والمخالفات." },
    ],
  },
  {
    title: "المناديب والموارد البشرية",
    items: [
      { href: "/drivers", label: "إدارة المناديب", oldKey: "drivers", status: "connected", resource: "drivers", description: "ملف المندوب الأساسي." },
      { href: "/human-resources", label: "الموارد البشرية", oldKey: "hrDrivers", status: "migration", resource: "drivers", description: "ملف HR الموسع للمناديب." },
      { href: "/interviews", label: "المقابلات", oldKey: "interviews", status: "migration", resource: "interviews", description: "إدارة المقابلات وتحويل المقبولين لمناديب." },
      { href: "/rider-documents", label: "مستندات المناديب", oldKey: "driverDocuments", status: "migration", resource: "driver-documents", description: "الإقامة والرخصة والعقود وأجير والتأمين." },
      { href: "/contracts-sponsorship", label: "العقود والكفالة", oldKey: "driverContracts", status: "migration", resource: "driver-contracts", description: "العقود والكفالة وأجير والفريلانسر." },
      { href: "/rider-housing", label: "سكن المناديب", oldKey: "driverHousing", status: "migration", resource: "driver-housing", description: "سكن الشركة أو السكن الخارجي والخصومات." },
      { href: "/rider-advances", label: "سلف المناديب", oldKey: "driverAdvances", status: "migration", resource: "advances", description: "سلف مرتبطة بالرواتب." },
      { href: "/rider-warnings", label: "إنذارات المناديب", oldKey: "driverWarnings", status: "migration", resource: "driver-warnings", description: "إنذارات أداء وحضور ومستندات ومخالفات." },
    ],
  },
  {
    title: "السيارات والحركة",
    items: [
      { href: "/vehicles", label: "السيارات", oldKey: "vehicles", status: "connected", resource: "vehicles", description: "السيارات وحالتها والمدينة والتكلفة." },
      { href: "/vehicle-movement", label: "حركة السيارات", oldKey: "vehicleMovements", status: "migration", resource: "vehicle-movements", description: "تسليم واستلام ونقل السيارات." },
      { href: "/vehicle-cleaning", label: "نظافة السيارات", oldKey: "vehicleCleanliness", status: "migration", resource: "vehicle-cleaning", description: "سجلات النظافة والتكلفة." },
      { href: "/maintenance", label: "الصيانة", oldKey: "vehicleMaintenance", status: "migration", resource: "vehicle-maintenance", description: "الصيانة والتكلفة والحالة." },
      { href: "/authorizations", label: "التفويضات", oldKey: "vehicleAuthorizations", status: "migration", resource: "vehicle-authorizations", description: "تفويضات السيارات والتنبيهات." },
      { href: "/rental-companies", label: "شركات التأجير", oldKey: "vehicleRentals", status: "migration", resource: "rental-companies", description: "شركات التأجير والتكلفة الشهرية." },
      { href: "/vehicle-cost", label: "تكلفة السيارات", oldKey: "vehicleCosts", status: "migration", resource: "vehicle-costs", description: "إيجار وصيانة ونظافة وحوادث وتلفيات." },
      { href: "/vehicle-accidents", label: "حوادث السيارات", oldKey: "vehicleAccidents", status: "migration", resource: "vehicle-accidents", description: "الحوادث والتكلفة والمسؤولية." },
      { href: "/vehicle-damages", label: "تلفيات السيارات", oldKey: "vehicleDamages", status: "migration", resource: "vehicle-damages", description: "التلفيات والتقدير والخصومات." },
    ],
  },
  {
    title: "الماليات",
    items: [
      { href: "/finance", label: "مركز الماليات", oldKey: "financeCenter", status: "connected", description: "مركز أولي للرواتب والسلف والخصومات." },
      { href: "/payroll", label: "مسير الرواتب", oldKey: "salaryRun", status: "connected", resource: "payroll", description: "مسير الرواتب وحالات الاعتماد والقفل." },
      { href: "/invoices", label: "الفواتير", oldKey: "invoices", status: "migration", resource: "invoices", description: "فواتير المشاريع والتطبيقات." },
      { href: "/receivables", label: "المستحقات", oldKey: "receivables", status: "migration", resource: "receivables", description: "المستحقات والتحصيل." },
      { href: "/payments", label: "المدفوعات", oldKey: "payments", status: "migration", resource: "payments", description: "المدفوعات وطرق الدفع." },
      { href: "/expenses", label: "المصروفات", oldKey: "expenses", status: "migration", resource: "expenses", description: "مصروفات التشغيل والسيارات والسكن." },
      { href: "/revenues", label: "الإيرادات", oldKey: "revenues", status: "migration", resource: "revenues", description: "إيرادات التطبيقات والفواتير." },
      { href: "/financial-advances", label: "السلف المالية", oldKey: "driverAdvancesFinance", status: "migration", resource: "advances", description: "السلف المالية وتأثيرها على الرواتب." },
      { href: "/deductions", label: "الخصومات", oldKey: "financeDeductions", status: "migration", resource: "deductions", description: "خصومات السلف والمخالفات والسيارات." },
      { href: "/vehicle-finance", label: "مالية السيارات", oldKey: "vehicleFinance", status: "migration", resource: "vehicle-costs", description: "تكلفة السيارات وربطها بالخصومات." },
      { href: "/supplier-accounts", label: "حسابات الموردين", oldKey: "supplierAccounts", status: "migration", resource: "supplier-accounts", description: "أرصدة الموردين والمدفوعات." },
      { href: "/custody-cashbox", label: "العهدة والصندوق", oldKey: "pettyCash", status: "migration", resource: "cashbox-entries", description: "العهدة وحركة الصندوق." },
      { href: "/bank-accounts", label: "الحسابات البنكية", oldKey: "bankAccounts", status: "migration", resource: "bank-accounts", description: "الحسابات والحركات البنكية." },
      { href: "/vat", label: "VAT", oldKey: "vatTax", status: "migration", resource: "vat-records", description: "ضريبة القيمة المضافة." },
      { href: "/profit-loss", label: "الأرباح والخسائر", oldKey: "profitLoss", status: "migration", resource: "profit-loss", description: "الإيرادات والمصروفات وصافي الربح." },
      { href: "/financial-reports", label: "التقارير المالية", oldKey: "financialReports", status: "migration", resource: "profit-loss", description: "تقارير الماليات الشهرية." },
    ],
  },
  {
    title: "التقارير والتحليلات",
    items: [
      { href: "/management-reports", label: "تقارير الإدارة", oldKey: "executiveReports", status: "migration", description: "ملخص الإدارة وأفضل/أضعف المدن والمناديب." },
      { href: "/performance-analysis", label: "تحليل الأداء", oldKey: "performanceAnalytics", status: "migration", description: "تحليل أداء المدن والمشاريع والمشرفين والمناديب." },
      { href: "/comparisons", label: "المقارنات", oldKey: "comparisonReports", status: "migration", description: "مقارنات مدينة/مشروع/مشرف/مندوب/شهر." },
      { href: "/export-center", label: "مركز التصدير", oldKey: "exportCenter", status: "migration", resource: "report-templates", description: "تصدير التقارير حسب الصلاحيات والفلاتر." },
      { href: "/report-templates", label: "قوالب التقارير", oldKey: "templatesCenter", status: "migration", resource: "report-templates", description: "قوالب أعمدة وفلاتر وتصدير." },
    ],
  },
  {
    title: "الأدوات والبيانات",
    items: [
      { href: "/excel-column-mapping", label: "ربط أعمدة Excel", oldKey: "excelMapping", status: "migration", resource: "excel-mappings", description: "خرائط الأعمدة للاستيراد." },
      { href: "/keeta-template", label: "قالب Keeta", oldKey: "keetaTemplate", status: "migration", resource: "excel-mappings", description: "قواعد قالب Keeta." },
      { href: "/hungerstation-template", label: "قالب HungerStation", oldKey: "hungerTemplate", status: "migration", resource: "excel-mappings", description: "قواعد قالب HungerStation." },
      { href: "/talabat-template", label: "قالب Talabat", oldKey: "talabatTemplate", status: "migration", resource: "excel-mappings", description: "قواعد قالب Talabat." },
      { href: "/api-integrations", label: "API Integrations", oldKey: "apiIntegrations", status: "migration", resource: "api-integrations", description: "التكاملات وحالة الربط." },
      { href: "/backup-restore", label: "Backup/Restore", oldKey: "backupRestore", status: "migration", resource: "backup-records", description: "نسخ واستعادة البيانات." },
      { href: "/data-cleaning", label: "تنظيف البيانات", oldKey: "dataCleaning", status: "migration", resource: "data-cleaning-issues", description: "كشف التكرارات والروابط المكسورة." },
    ],
  },
];

export function allModules() {
  return moduleSections.flatMap((section) => section.items.map((item) => ({ ...item, section: section.title })));
}

export function findModuleByPath(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return allModules().find((item) => item.href === normalized);
}
