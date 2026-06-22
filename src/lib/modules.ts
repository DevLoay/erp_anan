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
    title: "الرئيسية",
    items: [
      { href: "/dashboard", label: "لوحة الإدارة", oldKey: "dashboard", status: connected, resource: "dashboard", description: "ملخص التشغيل والإيرادات والتنبيهات من البيانات المعتمدة." },
      { href: "/management-reports", label: "التقارير العامة", oldKey: "managementReports", status: connected, resource: "management-reports", description: "تقارير عامة تقرأ من البيانات المعتمدة فقط ولا تستقبل ملفات." },
      { href: "/notifications", label: "الإشعارات والتنبيهات", oldKey: "notifications", status: connected, resource: "notifications", description: "تنبيهات التشغيل والماليات والمطابقة." },
      { href: "/reports", label: "التقارير العامة", oldKey: "reports", status: connected, resource: "reports", description: "مركز التقارير العامة والملخصات التنفيذية من البيانات المعتمدة." },
      { href: "/daily-reports", label: "التقارير اليومية", oldKey: "dailyReports", status: connected, resource: "daily-reports", description: "تقارير التشغيل اليومية ومتابعات المدن والمشرفين." },
      { href: "/operations-alerts", label: "تنبيهات العمليات", oldKey: "operationsAlerts", status: connected, resource: "operations-alerts", description: "تنبيهات تشغيلية مجمعة للحالات التي تحتاج متابعة." },
      { href: "/uploaded-reports", label: "التقارير المرفوعة", oldKey: "uploadedReports", status: connected, resource: "uploaded-reports", description: "ملفات وتقارير تم رفعها للنظام للرجوع والمراجعة." },
      { href: "/report-templates", label: "قوالب التقارير", oldKey: "reportTemplates", status: connected, resource: "report-templates", description: "قوالب تقارير جاهزة للاستخدام والتصدير." },
    ],
  },
  {
    title: "المشاريع والتطبيقات",
    items: [
      {
        href: "/projects",
        label: "المشاريع",
        oldKey: "projects",
        status: connected,
        resource: "projects",
        description: "الصفحة الموحدة لكل مشاريع التشغيل حسب التطبيق والمدينة.",
      },
      { href: "/settings/application-account-review", label: "مراجعة ربط الحسابات", oldKey: "applicationAccountReview", status: connected, resource: "application-accounts", description: "حسابات التطبيقات التي تحتاج ربط مندوب أو مدينة أو مشروع تشغيل." },
      { href: "/cities", label: "المدن", oldKey: "cities", status: connected, resource: "cities", description: "المدن وأداؤها وربطها بالمشاريع والمناديب." },
    ],
  },
  {
    title: "الاستيراد",
    items: [
      { href: "/imports", label: "استيراد البيانات العامة", oldKey: "imports", status: connected, resource: "import-batches", description: "للبيانات العامة فقط: مناديب، سيارات، مدن، مشرفين، HR، حسابات عامة." },
      { href: "/imports/templates", label: "قوالب الاستيراد العامة", oldKey: "importTemplates", status: connected, resource: "import-templates", description: "قوالب البيانات العامة. قوالب المشاريع تظهر داخل المشروع فقط." },
      { href: "/imports/history", label: "تاريخ الاستيراد العام", oldKey: "importHistory", status: connected, resource: "import-batches", description: "سجل عمليات الاستيراد العامة." },
      { href: "/settings/templates", label: "إعدادات القوالب", oldKey: "templateSettings", status: connected, resource: "template-configs", description: "التحكم في ظهور القوالب حسب المشروع والصفحة والصلاحية." },
    ],
  },
  {
    title: "التشغيل والموارد",
    items: [
      { href: "/drivers", label: "إدارة المناديب", oldKey: "drivers", status: connected, resource: "drivers", description: "المناديب وربطهم بالمدينة والمشرف وحسابات التطبيقات والسيارات." },
      { href: "/supervisors", label: "المشرفين", oldKey: "supervisors", status: connected, resource: "supervisors", description: "المشرفون وفرقهم وتقييم الأداء والمهام." },
      { href: "/hr", label: "الموارد البشرية", oldKey: "hr", status: connected, resource: "drivers", description: "العقود، المستندات، السكن، السلف، والإنذارات." },
      { href: "/rider-housing", label: "سكن المناديب", oldKey: "driverHousing", status: connected, resource: "driver-housing", description: "سكن الشركة والسكن الخارجي وتأثير بدل السكن على المسير." },
      { href: "/attendance", label: "الحضور والانصراف", oldKey: "attendance", status: connected, resource: "attendance", description: "تسجيل حضور وانصراف المناديب والمشرفين." },
      { href: "/supervisor-tasks", label: "مهام المشرفين", oldKey: "tasks", status: connected, resource: "tasks", description: "مهام ومتابعات مرتبطة بالتنبيهات والتقارير." },
      { href: "/rider-kpi", label: "KPI المناديب", oldKey: "riderKpi", status: connected, resource: "daily-reports", description: "مؤشرات أداء المناديب." },
      { href: "/rider-reports", label: "تقارير المناديب", oldKey: "riderReports", status: connected, resource: "daily-reports", description: "تقرير المندوب المفصل." },
      { href: "/violations", label: "مخالفات المناديب", oldKey: "driverViolations", status: connected, resource: "violations", description: "المخالفات المعتمدة وتأثيرها على المسير." },
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
        description: "السيارات واللوحات والحالة والمندوب الحالي.",
        children: [
          { href: "/vehicle-movements", label: "حركة السيارات", oldKey: "vehicleMovements", status: connected, resource: "vehicle-movements", description: "تسليم واستلام ونقل السيارات." },
          { href: "/vehicle-maintenance", label: "الصيانة", oldKey: "vehicleMaintenance", status: connected, resource: "vehicle-maintenance", description: "صيانة السيارات والتكلفة والحالة." },
          { href: "/authorizations", label: "التفويضات", oldKey: "vehicleAuthorizations", status: connected, resource: "vehicle-authorizations", description: "تفويضات السيارات والمناديب." },
          { href: "/rental-companies", label: "شركات التأجير", oldKey: "rentalCompanies", status: connected, resource: "rental-companies", description: "شركات التأجير وتكاليف الإيجار." },
          { href: "/vehicle-deductions", label: "خصومات السيارات", oldKey: "vehicleDeductions", status: connected, resource: "deductions", description: "خصومات مرتبطة بالسيارات والمسير." },
          { href: "/vehicle-violations", label: "مخالفات السيارات", oldKey: "vehicleViolations", status: connected, resource: "violations", description: "مخالفات مرورية مرتبطة بالسيارة والمندوب." },
        ],
      },
    ],
  },
  {
    title: "الماليات والمسير",
    items: [
      { href: "/payroll", label: "مسير الرواتب", oldKey: "payroll", status: connected, resource: "payroll", description: "مسيرات الرواتب العامة وملخصاتها." },
      { href: "/payroll/settings", label: "إعدادات المسير", oldKey: "payrollSettings", status: connected, resource: "payroll-settings", description: "خطط الرواتب وقواعد المستويات والخصومات." },
      { href: "/finance", label: "مركز الماليات", oldKey: "finance", status: connected, resource: "finance", description: "الإيرادات والمصروفات والربح التقديري." },
      { href: "/invoices", label: "الفواتير العامة", oldKey: "invoices", status: connected, resource: "invoices", description: "الفواتير العامة. فواتير المشروع تدار من داخل Workspace المشروع." },
      { href: "/receivables", label: "المستحقات", oldKey: "receivables", status: connected, resource: "receivables", description: "مستحقات العملاء والتطبيقات حسب البيانات المعتمدة." },
      { href: "/payments", label: "المدفوعات", oldKey: "payments", status: connected, resource: "payments", description: "المدفوعات وحالات السداد والربط بالماليات." },
      { href: "/expenses", label: "المصروفات", oldKey: "expenses", status: connected, resource: "expenses", description: "مصروفات التشغيل والسيارات والمشاريع." },
      { href: "/revenues", label: "الإيرادات", oldKey: "revenues", status: connected, resource: "revenues", description: "إيرادات المشاريع والفواتير المعتمدة." },
      { href: "/advances", label: "السلف المالية", oldKey: "financeAdvances", status: connected, resource: "advances", description: "السلف المعتمدة وتسميعها في المسير." },
      { href: "/deductions", label: "الخصومات", oldKey: "financeDeductions", status: connected, resource: "deductions", description: "خصومات المناديب والخصومات اليدوية." },
      { href: "/vehicle-finance", label: "مالية السيارات", oldKey: "vehicleFinance", status: connected, resource: "vehicle-costs", description: "تكلفة السيارات وإيجاراتها كتكلفة شركة." },
      { href: "/vehicle-cost", label: "تكلفة السيارات", oldKey: "vehicleCost", status: connected, resource: "vehicle-costs", description: "تكلفة السيارات الشهرية ومراجعة التكلفة المحسوبة." },
      { href: "/supplier-accounts", label: "حسابات الموردين", oldKey: "supplierAccounts", status: connected, resource: "supplier-accounts", description: "حسابات الموردين وشركات التأجير." },
      { href: "/custody-cashbox", label: "العهدة والصندوق", oldKey: "custodyCashbox", status: connected, resource: "cashbox-entries", description: "العهد النقدية وحركة الصندوق." },
      { href: "/bank-accounts", label: "الحسابات البنكية", oldKey: "bankAccounts", status: connected, resource: "bank-accounts", description: "الحسابات البنكية والتسويات." },
      { href: "/vat", label: "ضريبة القيمة المضافة", oldKey: "vat", status: connected, resource: "vat-records", description: "VAT وسجلات الضريبة." },
      { href: "/profit-loss", label: "الأرباح والخسائر", oldKey: "profitLoss", status: connected, resource: "profit-loss", description: "ملخص الربح والخسارة حسب المشروع والفترة." },
      { href: "/financial-reports", label: "التقارير المالية", oldKey: "financialReports", status: connected, resource: "financial-reports", description: "تقارير مالية مجمعة من البيانات المعتمدة." },
    ],
  },
  {
    title: "الإعدادات والصلاحيات",
    items: [
      { href: "/settings", label: "الإعدادات", oldKey: "settings", status: connected, resource: "settings", description: "إعدادات الشركة والنظام." },
      { href: "/users", label: "المستخدمين والصلاحيات", oldKey: "users", status: connected, resource: "users", description: "المستخدمون والأدوار ونطاق المدن والمشرفين." },
      { href: "/permissions", label: "مصفوفة الصلاحيات", oldKey: "permissions", status: connected, resource: "users", description: "صلاحيات الواجهة والـ API." },
      { href: "/audit-log", label: "سجل العمليات", oldKey: "auditLog", status: connected, resource: "audit-logs", description: "تتبع العمليات الحساسة والتجاوزات." },
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
