export type ModuleStatus = "connected" | "migration";

export type ModuleItem = {
  href: string;
  label: string;
  oldKey?: string;
  status: ModuleStatus;
  resource?: string;
  description: string;
  children?: ModuleItem[];
};

export type ModuleSection = {
  title: string;
  items: ModuleItem[];
};

const connected = "connected" as const;
const migration = "migration" as const;

export const moduleSections: ModuleSection[] = [
  {
    title: "الإدارة العامة",
    items: [
      { href: "/dashboard", label: "لوحة الإدارة", oldKey: "dashboard", status: connected, description: "ملخص تشغيلي شامل من بيانات PostgreSQL المعتمدة." },
      {
        href: "/management-reports",
        label: "التقارير العامة",
        oldKey: "executiveReports",
        status: migration,
        description: "تقارير الإدارة والتنبيهات والتحليلات من البيانات المعتمدة فقط.",
        children: [
          { href: "/reports", label: "مركز التقارير", oldKey: "reports", status: connected, description: "مركز التقارير العام القديم بعد ربطه بالبيانات." },
          { href: "/performance-analysis", label: "تحليل الأداء", oldKey: "performanceAnalytics", status: migration, description: "تحليل أداء المدن والمشاريع والمشرفين والمناديب." },
          { href: "/comparisons", label: "المقارنات", oldKey: "comparisonReports", status: migration, description: "مقارنات بين المدن والمشاريع والمشرفين والمناديب." },
          { href: "/export-center", label: "مركز التصدير", oldKey: "exportCenter", status: migration, resource: "report-templates", description: "تصدير التقارير حسب الصلاحيات والفلاتر." },
          { href: "/report-templates", label: "قوالب التقارير", oldKey: "templatesCenter", status: migration, resource: "report-templates", description: "إدارة قوالب التقارير." },
        ],
      },
      { href: "/notifications", label: "الإشعارات والتنبيهات", oldKey: "notifications", status: migration, resource: "notifications", description: "تنبيهات تشغيلية ومالية مرتبطة بالمشاكل الفعلية." },
      { href: "/users", label: "المستخدمين والصلاحيات", oldKey: "userManagement", status: migration, resource: "users", description: "إدارة المستخدمين والأدوار ونطاق المدن والمشرفين." },
      { href: "/permissions", label: "إدارة الصلاحيات", oldKey: "permissionsMatrix", status: connected, resource: "users", description: "مصفوفة الأدوار والصلاحيات وحماية الموارد الحساسة على الواجهة والـ API." },
      { href: "/audit-log", label: "سجل العمليات", oldKey: "auditLog", status: migration, resource: "audit-logs", description: "تتبع العمليات الحساسة والتغييرات." },
      {
        href: "/settings",
        label: "إعدادات البرنامج",
        oldKey: "settings",
        status: connected,
        description: "إعدادات النظام والتارجت والقوالب وقواعد الرواتب.",
        children: [
          { href: "/settings/templates", label: "إعدادات القوالب", oldKey: "templateSettings", status: migration, resource: "import-templates", description: "التحكم في ظهور القوالب حسب المشروع والصلاحية." },
          { href: "/settings/payroll", label: "إعدادات المسير", oldKey: "payrollSettings", status: migration, resource: "payroll-settings", description: "قواعد الرواتب والخطط حسب التطبيق والمشروع." },
        ],
      },
    ],
  },
  {
    title: "المدن والمشاريع",
    items: [
      {
        href: "/applications",
        label: "مركز التطبيقات",
        oldKey: "applications",
        status: connected,
        resource: "applications",
        description: "إدارة التطبيقات والمشاريع والحسابات والقوالب والمسيرات.",
        children: [
          { href: "/applications/templates", label: "قوالب التطبيقات", oldKey: "applicationTemplates", status: migration, resource: "import-templates", description: "قوالب الاستيراد الخاصة بالتطبيقات." },
          { href: "/applications/imports", label: "استيراد التطبيقات", oldKey: "applicationImports", status: migration, resource: "import-batches", description: "عمليات استيراد ملفات التطبيقات." },
          { href: "/settings/application-account-review", label: "مراجعة ربط الحسابات", oldKey: "applicationAccountReview", status: connected, resource: "application-accounts", description: "مراجعة حسابات التطبيقات غير المرتبطة بمشروع تشغيل أو مدينة أو مندوب." },
          { href: "/applications/invoice-settings", label: "إعدادات الفواتير", oldKey: "invoiceSettings", status: migration, resource: "applications", description: "قواعد قراءة فواتير التطبيقات." },
          { href: "/applications/rank-settings", label: "إعدادات الرانك", oldKey: "rankSettings", status: migration, resource: "applications", description: "قواعد الرانك والتقييم حسب التطبيق." },
          { href: "/applications/keeta/rank", label: "Keeta Rank", oldKey: "keetaRank", status: migration, resource: "applications", description: "استيراد وتحليل Rank Keeta." },
        ],
      },
      {
        href: "/cities",
        label: "المدن",
        oldKey: "cities",
        status: connected,
        resource: "cities",
        description: "متابعة المدن والمناديب والأداء والتنبيهات.",
        children: [
          { href: "/city-targets", label: "تارجت المدن", oldKey: "cityTargets", status: migration, resource: "city-targets", description: "أهداف المدن الشهرية لكل تطبيق ومشروع." },
          { href: "/city-ranking", label: "ترتيب المدن", oldKey: "cityRanking", status: migration, resource: "city-targets", description: "ترتيب المدن حسب الطلبات والإنجاز والتنبيهات." },
        ],
      },
      {
        href: "/projects",
        label: "المشاريع",
        oldKey: "projects",
        status: connected,
        resource: "projects",
        description: "إدارة المشاريع وربطها بالتطبيقات والمدن.",
        children: [
          { href: "/projects/keeta/dashboard", label: "لوحة Keeta", oldKey: "keetaProject", status: migration, resource: "projects", description: "لوحة مشروع Keeta المستقلة." },
          { href: "/projects/keeta/imports", label: "استيراد Keeta", oldKey: "keetaImports", status: migration, resource: "import-batches", description: "استيراد Rank وتقارير وفواتير Keeta داخل مشروع Keeta فقط." },
          { href: "/projects/keeta/invoices", label: "فواتير Keeta", oldKey: "keetaInvoices", status: migration, resource: "invoices", description: "فواتير Keeta ومراجعتها واعتمادها." },
          { href: "/projects/keeta/payroll", label: "مسير Keeta", oldKey: "keetaPayroll", status: migration, resource: "payroll", description: "مسير Keeta من الرانك والتقرير والفاتورة وخطط الرواتب." },
          { href: "/projects/keeta/reports", label: "تقارير Keeta", oldKey: "keetaReports", status: migration, resource: "daily-reports", description: "تقارير مشروع Keeta المعتمدة." },
          { href: "/projects/keeta/accounts", label: "حسابات Keeta", oldKey: "keetaAccounts", status: migration, resource: "application-accounts", description: "حسابات مناديب Keeta وربطها." },
          { href: "/projects/keeta/settings", label: "إعدادات Keeta", oldKey: "keetaSettings", status: migration, resource: "applications", description: "قواعد المشروع والقوالب والمسير." },
        ],
      },
    ],
  },
  {
    title: "التشغيل",
    items: [
      {
        href: "/imports",
        label: "استيراد البيانات العامة",
        oldKey: "importReports",
        status: connected,
        resource: "import-batches",
        description: "استيراد البيانات الأساسية مع Preview قبل الحفظ.",
        children: [
          { href: "/imports/templates", label: "قوالب الاستيراد", oldKey: "importTemplates", status: migration, resource: "import-templates", description: "قوالب رفع البيانات العامة." },
          { href: "/imports/history", label: "تاريخ الاستيراد", oldKey: "importHistory", status: migration, resource: "import-batches", description: "متابعة عمليات الاستيراد السابقة." },
          { href: "/imports/preview", label: "معاينة الاستيراد", oldKey: "importPreview", status: migration, resource: "import-batches", description: "معاينة الملفات قبل الاعتماد." },
          { href: "/uploaded-reports", label: "تقارير مرفوعة", oldKey: "reportManager", status: migration, resource: "uploaded-reports", description: "متابعة الملفات والتقارير التي تم رفعها." },
          { href: "/excel-column-mapping", label: "ربط أعمدة Excel", oldKey: "excelMapping", status: migration, resource: "excel-mappings", description: "حفظ خرائط الأعمدة للاستيراد." },
          { href: "/account-movement", label: "حركة الحسابات", oldKey: "appAccountMovements", status: migration, resource: "app-account-movements", description: "تتبع ربط ونقل حسابات التطبيقات بين المناديب." },
        ],
      },
      { href: "/daily-reports", label: "التقارير اليومية", oldKey: "dailyReports", status: connected, resource: "daily-reports", description: "أداء المناديب اليومي حسب التاريخ والتطبيق والمدينة." },
      { href: "/supervisor-tasks", label: "مهام المشرفين", oldKey: "tasks", status: migration, resource: "tasks", description: "مهام مرتبطة بالتنبيهات ومشاكل المناديب." },
      { href: "/attendance", label: "الحضور والانصراف", oldKey: "attendance", status: migration, resource: "attendance", description: "تسجيل حضور وانصراف المناديب والمشرفين وتأثيره على KPI." },
      { href: "/rider-kpi", label: "KPI المناديب", oldKey: "driverKpi", status: migration, resource: "daily-reports", description: "مؤشرات أداء المناديب من التقارير اليومية." },
      { href: "/rider-reports", label: "تقارير المناديب", oldKey: "driverReports", status: migration, resource: "daily-reports", description: "تقرير تفصيلي لكل مندوب من بيانات الأداء." },
      { href: "/violations", label: "مخالفات المناديب", oldKey: "driverViolations", status: migration, resource: "violations", description: "إدارة المخالفات وربطها بالمسير." },
      { href: "/operations-alerts", label: "تنبيهات التشغيل", oldKey: "operationAlerts", status: migration, resource: "notifications", description: "تنبيهات الأداء والمخاطر التشغيلية." },
      { href: "/shifts", label: "الشفتات", oldKey: "shiftManagement", status: migration, resource: "shifts", description: "إدارة شفتات المناديب وربطها بالحضور." },
      { href: "/quality-audit", label: "الجودة والتدقيق", oldKey: "qualityControl", status: migration, resource: "quality-audits", description: "مراجعة جودة البيانات والتقارير والمهام." },
    ],
  },
  {
    title: "المناديب والموارد البشرية",
    items: [
      {
        href: "/drivers",
        label: "إدارة المناديب",
        oldKey: "drivers",
        status: connected,
        resource: "drivers",
        description: "بيانات المناديب وربطهم بالمشرف والمدينة والمشروع.",
        children: [
          { href: "/drivers/new", label: "إضافة مندوب", oldKey: "newDriver", status: connected, resource: "drivers", description: "تسجيل مندوب جديد وربطه بالنظام." },
        ],
      },
      { href: "/hr", label: "الموارد البشرية", oldKey: "hrDrivers", status: migration, resource: "drivers", description: "ملف HR شامل للمناديب والعقود والمستندات." },
      { href: "/interviews", label: "المقابلات", oldKey: "interviews", status: migration, resource: "interviews", description: "إدارة مقابلات المرشحين وتحويل المقبولين إلى مناديب." },
      { href: "/rider-documents", label: "مستندات المناديب", oldKey: "driverDocuments", status: migration, resource: "driver-documents", description: "مستندات المناديب وحالات الانتهاء والتنبيهات." },
      { href: "/contracts-sponsorship", label: "العقود والكفالة", oldKey: "driverContracts", status: migration, resource: "driver-contracts", description: "عقود المناديب والكفالة وأجير والفريلانسر." },
      { href: "/rider-housing", label: "سكن المناديب", oldKey: "driverHousing", status: migration, resource: "driver-housing", description: "سكن المناديب وتكاليفه وحالته." },
      { href: "/advances", label: "سلف المناديب", oldKey: "driverAdvances", status: migration, resource: "advances", description: "السلف المعتمدة والمعلقة وتسميعها في المسير." },
      { href: "/rider-warnings", label: "إنذارات المناديب", oldKey: "driverWarnings", status: migration, resource: "driver-warnings", description: "إنذارات الأداء والحضور والمخالفات والمستندات." },
    ],
  },
  {
    title: "السيارات والحركة",
    items: [
      {
        href: "/vehicles",
        label: "السيارات",
        oldKey: "vehicles",
        status: connected,
        resource: "vehicles",
        description: "إدارة السيارات واللوحات والتكاليف والحالة.",
        children: [
          { href: "/vehicles/new", label: "إضافة سيارة", oldKey: "newVehicle", status: connected, resource: "vehicles", description: "تسجيل سيارة جديدة." },
          { href: "/vehicle-movements", label: "حركة السيارات", oldKey: "vehicleMovements", status: migration, resource: "vehicle-movements", description: "تسليم واستلام ونقل السيارات بين المناديب." },
          { href: "/vehicle-cleaning", label: "نظافة السيارات", oldKey: "vehicleCleanliness", status: migration, resource: "vehicle-cleaning", description: "متابعة نظافة السيارات وتكلفتها." },
          { href: "/vehicle-maintenance", label: "الصيانة", oldKey: "vehicleMaintenance", status: migration, resource: "vehicle-maintenance", description: "صيانة السيارات والتكلفة والحالة." },
          { href: "/authorizations", label: "التفويضات", oldKey: "vehicleAuthorizations", status: migration, resource: "vehicle-authorizations", description: "تفويضات السيارات والمناديب." },
          { href: "/rental-companies", label: "شركات التأجير", oldKey: "vehicleRentals", status: migration, resource: "rental-companies", description: "إدارة شركات التأجير والتواصل." },
          { href: "/vehicle-cost", label: "تكلفة السيارات", oldKey: "vehicleCosts", status: migration, resource: "vehicle-costs", description: "تكلفة الإيجار والصيانة والحوادث والتلفيات." },
          { href: "/vehicle-accidents", label: "حوادث السيارات", oldKey: "vehicleAccidents", status: migration, resource: "vehicle-accidents", description: "حوادث السيارات وربطها بالمندوب والتكلفة." },
          { href: "/vehicle-damages", label: "تلفيات السيارات", oldKey: "vehicleDamages", status: migration, resource: "vehicle-damages", description: "تلفيات السيارات وتقدير التكلفة والخصومات." },
          { href: "/vehicle-deductions", label: "خصومات السيارات", oldKey: "vehicleDeductions", status: migration, resource: "deductions", description: "خصومات مرتبطة بالسيارات والمسير." },
          { href: "/vehicle-violations", label: "مخالفات السيارات", oldKey: "vehicleViolations", status: migration, resource: "violations", description: "مخالفات مرورية مرتبطة بالسيارة والمندوب." },
        ],
      },
    ],
  },
  {
    title: "الماليات",
    items: [
      {
        href: "/finance",
        label: "مركز الماليات",
        oldKey: "financeCenter",
        status: connected,
        description: "ملخص مالي للإيرادات والمصروفات والمسيرات.",
        children: [
          { href: "/payroll", label: "مسير الرواتب", oldKey: "salaryRun", status: connected, resource: "payroll", description: "مسير رواتب المناديب من البيانات المعتمدة." },
          { href: "/payroll/settings", label: "إعدادات المسير", oldKey: "payrollSettings", status: migration, resource: "payroll-settings", description: "قواعد الرواتب والبونص والخصومات." },
          { href: "/invoices", label: "الفواتير", oldKey: "invoices", status: migration, resource: "invoices", description: "إدارة فواتير المشاريع والعملاء." },
          { href: "/receivables", label: "المستحقات", oldKey: "receivables", status: migration, resource: "receivables", description: "المبالغ المستحقة والتحصيل." },
          { href: "/payments", label: "المدفوعات", oldKey: "payments", status: migration, resource: "payments", description: "مدفوعات الموردين والرواتب والمصروفات." },
          { href: "/expenses", label: "المصروفات", oldKey: "expenses", status: migration, resource: "expenses", description: "مصروفات التشغيل والسيارات والمكتب." },
          { href: "/revenues", label: "الإيرادات", oldKey: "revenues", status: migration, resource: "revenues", description: "إيرادات التطبيقات والفواتير." },
          { href: "/deductions", label: "الخصومات", oldKey: "financeDeductions", status: migration, resource: "deductions", description: "خصومات الرواتب والسيارات والمخالفات." },
          { href: "/vehicle-finance", label: "مالية السيارات", oldKey: "vehicleFinance", status: migration, resource: "vehicle-costs", description: "مالية السيارات وربطها بالتكاليف." },
          { href: "/supplier-accounts", label: "حسابات الموردين", oldKey: "supplierAccounts", status: migration, resource: "supplier-accounts", description: "أرصدة الموردين والمدفوعات." },
          { href: "/custody-cashbox", label: "العهدة والصندوق", oldKey: "pettyCash", status: migration, resource: "cashbox-entries", description: "حركة العهدة والصندوق." },
          { href: "/bank-accounts", label: "الحسابات البنكية", oldKey: "bankAccounts", status: migration, resource: "bank-accounts", description: "الحسابات البنكية والحركات." },
          { href: "/vat", label: "VAT", oldKey: "vatTax", status: migration, resource: "vat-records", description: "ضريبة القيمة المضافة." },
          { href: "/profit-loss", label: "الأرباح والخسائر", oldKey: "profitLoss", status: migration, resource: "profit-loss", description: "تحليل الربح والخسارة." },
          { href: "/financial-reports", label: "التقارير المالية", oldKey: "financialReports", status: migration, resource: "profit-loss", description: "تقارير مالية شهرية." },
        ],
      },
    ],
  },
  {
    title: "الأدوات والبيانات",
    items: [
      { href: "/keeta-template", label: "قالب Keeta", oldKey: "keetaTemplate", status: migration, resource: "excel-mappings", description: "قوالب Keeta التشغيلية." },
      { href: "/hungerstation-template", label: "قالب HungerStation", oldKey: "hungerTemplate", status: migration, resource: "excel-mappings", description: "قوالب HungerStation." },
      { href: "/talabat-template", label: "قالب Talabat", oldKey: "talabatTemplate", status: migration, resource: "excel-mappings", description: "قوالب Talabat." },
      { href: "/api-integrations", label: "API Integrations", oldKey: "apiIntegrations", status: migration, resource: "api-integrations", description: "حالة التكاملات والربط." },
      { href: "/backup-restore", label: "Backup/Restore", oldKey: "backupRestore", status: migration, resource: "backup-records", description: "النسخ الاحتياطي والاستعادة." },
      { href: "/data-cleaning", label: "تنظيف البيانات", oldKey: "dataCleaning", status: migration, resource: "data-cleaning-issues", description: "مشاكل تكرار أو نقص البيانات." },
    ],
  },
];

export type ModuleWithSection = ModuleItem & {
  section: string;
  parent?: string;
};

function flattenItems(items: ModuleItem[], section: string, parent?: string): ModuleWithSection[] {
  return items.flatMap((item) => {
    const current: ModuleWithSection = { ...item, section, parent };
    const children = item.children ? flattenItems(item.children, section, item.label) : [];
    return [current, ...children];
  });
}

export function allModules() {
  return moduleSections.flatMap((section) => flattenItems(section.items, section.title));
}

export function findModuleByPath(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const modules = allModules().sort((a, b) => b.href.length - a.href.length);
  return modules.find((item) => item.href === normalized || normalized.startsWith(`${item.href}/`));
}
