export type ResourceKey = string;

export type ResourceConfig = {
  key: ResourceKey;
  title: string;
  description: string;
  delegate: string;
  route: string;
  api: string;
  searchFields: string[];
  columns: { key: string; label: string }[];
  financeOnly?: boolean;
};

export const resources: Record<string, ResourceConfig> = {
  users: {
    key: "users",
    title: "المستخدمين",
    description: "إدارة المستخدمين والأدوار وحالة الحساب.",
    delegate: "user",
    route: "/settings",
    api: "/api/users",
    searchFields: ["name", "email", "role"],
    columns: [
      { key: "name", label: "الاسم" },
      { key: "email", label: "البريد" },
      { key: "role", label: "الدور" },
      { key: "isActive", label: "نشط" },
    ],
  },
  cities: {
    key: "cities",
    title: "المدن",
    description: "المدن التشغيلية ونطاق البيانات المرتبط بها.",
    delegate: "city",
    route: "/cities",
    api: "/api/cities",
    searchFields: ["nameAr", "nameEn", "status"],
    columns: [
      { key: "nameAr", label: "المدينة" },
      { key: "nameEn", label: "City" },
      { key: "status", label: "الحالة" },
      { key: "updatedAt", label: "آخر تحديث" },
    ],
  },
  projects: {
    key: "projects",
    title: "المشاريع",
    description: "المشاريع والتطبيقات المرتبطة بالمدن.",
    delegate: "project",
    route: "/projects",
    api: "/api/projects",
    searchFields: ["name", "appName", "status"],
    columns: [
      { key: "name", label: "المشروع" },
      { key: "appName", label: "التطبيق" },
      { key: "status", label: "الحالة" },
      { key: "updatedAt", label: "آخر تحديث" },
    ],
  },
  supervisors: {
    key: "supervisors",
    title: "المشرفين",
    description: "ربط المشرفين بالمدن والمناديب والمهام.",
    delegate: "supervisor",
    route: "/supervisors",
    api: "/api/supervisors",
    searchFields: ["name", "phone", "email", "status"],
    columns: [
      { key: "name", label: "المشرف" },
      { key: "phone", label: "الجوال" },
      { key: "email", label: "البريد" },
      { key: "status", label: "الحالة" },
    ],
  },
  drivers: {
    key: "drivers",
    title: "المناديب",
    description: "ملف المندوب الأساسي وربطه بالمدينة والمشروع والمشرف.",
    delegate: "driver",
    route: "/drivers",
    api: "/api/drivers",
    searchFields: ["internalCode", "name", "phone", "nationalId", "status"],
    columns: [
      { key: "internalCode", label: "الكود" },
      { key: "name", label: "المندوب" },
      { key: "phone", label: "الجوال" },
      { key: "status", label: "الحالة" },
    ],
  },
  vehicles: {
    key: "vehicles",
    title: "السيارات",
    description: "السيارات وحالتها والتكلفة الشهرية والمدينة.",
    delegate: "vehicle",
    route: "/vehicles",
    api: "/api/vehicles",
    searchFields: ["plateAr", "plateEn", "model", "rentalCompany", "status"],
    columns: [
      { key: "plateAr", label: "اللوحة عربي" },
      { key: "plateEn", label: "اللوحة إنجليزي" },
      { key: "model", label: "الموديل" },
      { key: "status", label: "الحالة" },
    ],
  },
  applications: {
    key: "applications",
    title: "التطبيقات والحسابات",
    description: "حسابات التطبيقات وربطها بالمشاريع والمناديب.",
    delegate: "applicationAccount",
    route: "/applications",
    api: "/api/applications",
    searchFields: ["appName", "username", "status"],
    columns: [
      { key: "appName", label: "التطبيق" },
      { key: "username", label: "الحساب" },
      { key: "isEmpty", label: "فارغ" },
      { key: "status", label: "الحالة" },
    ],
  },
  "daily-reports": {
    key: "daily-reports",
    title: "التقارير اليومية",
    description: "الأداء اليومي الفعلي من التقارير المستوردة والمعتمدة.",
    delegate: "dailyReport",
    route: "/daily-reports",
    api: "/api/daily-reports",
    searchFields: ["month", "appName"],
    columns: [
      { key: "reportDate", label: "التاريخ" },
      { key: "month", label: "الشهر" },
      { key: "appName", label: "التطبيق" },
      { key: "orders", label: "الطلبات" },
      { key: "workingHours", label: "الساعات" },
    ],
  },
  advances: {
    key: "advances",
    title: "السلف",
    description: "سلف المناديب وحالة الاعتماد والخصم.",
    delegate: "advance",
    route: "/finance",
    api: "/api/advances",
    searchFields: ["reason", "deductionMonth", "status"],
    columns: [
      { key: "amount", label: "المبلغ" },
      { key: "remainingAmount", label: "المتبقي" },
      { key: "deductionMonth", label: "شهر الخصم" },
      { key: "status", label: "الحالة" },
    ],
    financeOnly: true,
  },
  deductions: {
    key: "deductions",
    title: "الخصومات",
    description: "الخصومات المالية المرتبطة بالمناديب والرواتب.",
    delegate: "deduction",
    route: "/finance",
    api: "/api/deductions",
    searchFields: ["type", "month", "status", "notes"],
    columns: [
      { key: "type", label: "النوع" },
      { key: "amount", label: "المبلغ" },
      { key: "month", label: "الشهر" },
      { key: "status", label: "الحالة" },
    ],
    financeOnly: true,
  },
  violations: {
    key: "violations",
    title: "المخالفات",
    description: "المخالفات التشغيلية والمالية المرتبطة بالمندوب.",
    delegate: "violation",
    route: "/reports",
    api: "/api/violations",
    searchFields: ["type", "status", "notes"],
    columns: [
      { key: "type", label: "النوع" },
      { key: "amount", label: "المبلغ" },
      { key: "occurredAt", label: "التاريخ" },
      { key: "status", label: "الحالة" },
    ],
  },
  payroll: {
    key: "payroll",
    title: "مسير الرواتب",
    description: "مسير الرواتب وحالات المراجعة والقفل.",
    delegate: "payroll",
    route: "/payroll",
    api: "/api/payroll",
    searchFields: ["month", "status"],
    columns: [
      { key: "month", label: "الشهر" },
      { key: "basicSalary", label: "الأساسي" },
      { key: "deductions", label: "الخصومات" },
      { key: "netSalary", label: "الصافي" },
      { key: "status", label: "الحالة" },
    ],
    financeOnly: true,
  },
  tasks: {
    key: "tasks",
    title: "مهام المشرفين",
    description: "مهام مرتبطة بالمشرفين والمناديب والتنبيهات.",
    delegate: "task",
    route: "/reports",
    api: "/api/tasks",
    searchFields: ["title", "description", "status", "priority"],
    columns: [
      { key: "title", label: "المهمة" },
      { key: "priority", label: "الأولوية" },
      { key: "status", label: "الحالة" },
      { key: "dueDate", label: "تاريخ الاستحقاق" },
    ],
  },
  notifications: {
    key: "notifications",
    title: "التنبيهات",
    description: "تنبيهات تشغيلية ومالية مرتبطة بالكيانات.",
    delegate: "notification",
    route: "/reports",
    api: "/api/notifications",
    searchFields: ["title", "body", "severity", "status"],
    columns: [
      { key: "title", label: "التنبيه" },
      { key: "severity", label: "الخطورة" },
      { key: "status", label: "الحالة" },
      { key: "createdAt", label: "التاريخ" },
    ],
  },
};

Object.assign(resources, {
  interviews: {
    key: "interviews", title: "المقابلات", description: "المقابلات وتحويل المقبولين إلى مناديب.", delegate: "interview", route: "/interviews", api: "/api/interviews",
    searchFields: ["candidateName", "phone", "status"], columns: [{key:"candidateName",label:"المرشح"},{key:"phone",label:"الجوال"},{key:"status",label:"الحالة"},{key:"scheduledAt",label:"موعد المقابلة"}],
  },
  "driver-documents": {
    key: "driver-documents", title: "مستندات المناديب", description: "الإقامة والرخصة والعقود والتأمين مرتبطة بالمندوب.", delegate: "driverDocument", route: "/rider-documents", api: "/api/driver-documents",
    searchFields: ["driverId", "type", "status", "notes"], columns: [{key:"driverId",label:"المندوب"},{key:"type",label:"نوع المستند"},{key:"expiryDate",label:"تاريخ الانتهاء"},{key:"status",label:"الحالة"}],
  },
  "driver-contracts": {
    key: "driver-contracts", title: "العقود والكفالة", description: "العقود والكفالة وأجير والفريلانسر.", delegate: "driverContract", route: "/contracts-sponsorship", api: "/api/driver-contracts",
    searchFields: ["driverId", "contractType", "sponsor", "status"], columns: [{key:"driverId",label:"المندوب"},{key:"contractType",label:"نوع العقد"},{key:"endDate",label:"نهاية العقد"},{key:"status",label:"الحالة"}],
  },
  "driver-housing": {
    key: "driver-housing", title: "سكن المناديب", description: "سكن الشركة أو السكن الخارجي والخصومات.", delegate: "driverHousing", route: "/rider-housing", api: "/api/driver-housing",
    searchFields: ["driverId", "housingType", "location", "status"], columns: [{key:"driverId",label:"المندوب"},{key:"housingType",label:"نوع السكن"},{key:"monthlyCost",label:"التكلفة"},{key:"status",label:"الحالة"}],
  },
  "driver-warnings": {
    key: "driver-warnings", title: "إنذارات المناديب", description: "إنذارات الأداء والحضور والمستندات والمخالفات.", delegate: "driverWarning", route: "/rider-warnings", api: "/api/driver-warnings",
    searchFields: ["driverId", "type", "severity", "status", "notes"], columns: [{key:"driverId",label:"المندوب"},{key:"type",label:"النوع"},{key:"severity",label:"الخطورة"},{key:"status",label:"الحالة"}],
  },
  attendance: {
    key: "attendance", title: "الحضور والانصراف", description: "الحضور وساعات العمل وربطها بالـ KPI.", delegate: "attendanceRecord", route: "/attendance", api: "/api/attendance",
    searchFields: ["driverId", "status", "notes"], columns: [{key:"driverId",label:"المندوب"},{key:"workDate",label:"التاريخ"},{key:"workingHours",label:"الساعات"},{key:"status",label:"الحالة"}],
  },
  shifts: {
    key: "shifts", title: "الشفتات", description: "إدارة شفتات المناديب.", delegate: "shift", route: "/shifts", api: "/api/shifts",
    searchFields: ["name", "driverId", "cityId", "status"], columns: [{key:"name",label:"الشفت"},{key:"startTime",label:"البداية"},{key:"endTime",label:"النهاية"},{key:"status",label:"الحالة"}],
  },
  "uploaded-reports": {
    key: "uploaded-reports", title: "تقارير مرفوعة", description: "سجل الملفات المستوردة وحالة المعالجة.", delegate: "uploadedReport", route: "/uploaded-reports", api: "/api/uploaded-reports",
    searchFields: ["fileName", "importType", "appName", "month", "status"], columns: [{key:"fileName",label:"الملف"},{key:"importType",label:"النوع"},{key:"month",label:"الشهر"},{key:"status",label:"الحالة"}],
  },
  "app-account-movements": {
    key: "app-account-movements", title: "حركة الحسابات", description: "تتبع ربط ونقل وإخلاء حسابات التطبيقات.", delegate: "appAccountMovement", route: "/account-movement", api: "/api/app-account-movements",
    searchFields: ["accountId", "appName", "movementType", "status"], columns: [{key:"accountId",label:"الحساب"},{key:"movementType",label:"الحركة"},{key:"movementDate",label:"التاريخ"},{key:"status",label:"الحالة"}],
  },
  "city-targets": {
    key: "city-targets", title: "تارجت المدن", description: "أهداف شهرية لكل مدينة وتطبيق.", delegate: "cityTarget", route: "/city-targets", api: "/api/city-targets",
    searchFields: ["cityId", "appName", "month", "status"], columns: [{key:"cityId",label:"المدينة"},{key:"appName",label:"التطبيق"},{key:"monthlyTarget",label:"الهدف الشهري"},{key:"month",label:"الشهر"}],
  },
  "import-batches": {
    key: "import-batches", title: "دفعات الاستيراد", description: "سجل دفعات الاستيراد ومخرجات المعاينة.", delegate: "importBatch", route: "/imports", api: "/api/import-batches",
    searchFields: ["fileName", "importType", "appName", "month", "status"], columns: [{key:"fileName",label:"الملف"},{key:"importType",label:"النوع"},{key:"rowsImported",label:"مستوردة"},{key:"status",label:"الحالة"}],
  },
  "audit-logs": {
    key: "audit-logs", title: "سجل العمليات", description: "تتبع العمليات الحساسة والتغييرات.", delegate: "auditLog", route: "/audit-log", api: "/api/audit-logs",
    searchFields: ["user", "action", "entityType", "entityId"], columns: [{key:"user",label:"المستخدم"},{key:"action",label:"الإجراء"},{key:"entityType",label:"الكيان"},{key:"createdAt",label:"التاريخ"}],
  },
  "system-settings": {
    key: "system-settings", title: "إعدادات النظام", description: "إعدادات عامة وKPI وثيم النظام.", delegate: "systemSetting", route: "/settings", api: "/api/system-settings",
    searchFields: ["key", "updatedBy"], columns: [{key:"key",label:"المفتاح"},{key:"updatedBy",label:"آخر تعديل بواسطة"},{key:"updatedAt",label:"آخر تحديث"}],
  },
  "vehicle-movements": {
    key: "vehicle-movements", title: "حركة السيارات", description: "تسليم واستلام ونقل السيارات.", delegate: "vehicleMovement", route: "/vehicle-movement", api: "/api/vehicle-movements",
    searchFields: ["vehicleId", "movementType", "status", "notes"], columns: [{key:"vehicleId",label:"السيارة"},{key:"movementType",label:"الحركة"},{key:"handoverDate",label:"التسليم"},{key:"status",label:"الحالة"}],
  },
  "vehicle-cleaning": {
    key: "vehicle-cleaning", title: "نظافة السيارات", description: "سجلات النظافة والتكلفة.", delegate: "vehicleCleaning", route: "/vehicle-cleaning", api: "/api/vehicle-cleaning",
    searchFields: ["vehicleId", "driverId", "status", "notes"], columns: [{key:"vehicleId",label:"السيارة"},{key:"cleanDate",label:"التاريخ"},{key:"cost",label:"التكلفة"},{key:"status",label:"الحالة"}],
  },
  "vehicle-maintenance": {
    key: "vehicle-maintenance", title: "الصيانة", description: "الصيانة والتكلفة والمورد.", delegate: "vehicleMaintenance", route: "/maintenance", api: "/api/vehicle-maintenance",
    searchFields: ["vehicleId", "type", "vendor", "status"], columns: [{key:"vehicleId",label:"السيارة"},{key:"type",label:"النوع"},{key:"cost",label:"التكلفة"},{key:"status",label:"الحالة"}],
  },
  "vehicle-authorizations": {
    key: "vehicle-authorizations", title: "التفويضات", description: "تفويضات السيارات وانتهاء الصلاحية.", delegate: "vehicleAuthorization", route: "/authorizations", api: "/api/vehicle-authorizations",
    searchFields: ["vehicleId", "driverId", "authNumber", "status"], columns: [{key:"vehicleId",label:"السيارة"},{key:"driverId",label:"المندوب"},{key:"endDate",label:"النهاية"},{key:"status",label:"الحالة"}],
  },
  "rental-companies": {
    key: "rental-companies", title: "شركات التأجير", description: "شركات تأجير السيارات.", delegate: "rentalCompany", route: "/rental-companies", api: "/api/rental-companies",
    searchFields: ["name", "contact", "phone", "status"], columns: [{key:"name",label:"الشركة"},{key:"contact",label:"المسؤول"},{key:"phone",label:"الجوال"},{key:"status",label:"الحالة"}],
  },
  "vehicle-costs": {
    key: "vehicle-costs", title: "تكلفة السيارات", description: "تكلفة شهرية تفصيلية لكل سيارة.", delegate: "vehicleCost", route: "/vehicle-cost", api: "/api/vehicle-costs",
    searchFields: ["vehicleId", "month", "status"], columns: [{key:"vehicleId",label:"السيارة"},{key:"month",label:"الشهر"},{key:"totalCost",label:"الإجمالي"},{key:"status",label:"الحالة"}],
  },
  "vehicle-accidents": {
    key: "vehicle-accidents", title: "حوادث السيارات", description: "الحوادث والتكلفة والمسؤولية.", delegate: "vehicleAccident", route: "/vehicle-accidents", api: "/api/vehicle-accidents",
    searchFields: ["vehicleId", "driverId", "type", "status"], columns: [{key:"vehicleId",label:"السيارة"},{key:"driverId",label:"المندوب"},{key:"cost",label:"التكلفة"},{key:"status",label:"الحالة"}],
  },
  "vehicle-damages": {
    key: "vehicle-damages", title: "تلفيات السيارات", description: "التلفيات والتكلفة النهائية.", delegate: "vehicleDamage", route: "/vehicle-damages", api: "/api/vehicle-damages",
    searchFields: ["vehicleId", "driverId", "type", "status"], columns: [{key:"vehicleId",label:"السيارة"},{key:"type",label:"نوع التلف"},{key:"finalCost",label:"التكلفة النهائية"},{key:"status",label:"الحالة"}],
  },
  invoices: {
    key: "invoices", title: "الفواتير", description: "فواتير العملاء والمشاريع.", delegate: "invoice", route: "/invoices", api: "/api/invoices",
    searchFields: ["number", "client", "month", "status"], columns: [{key:"number",label:"رقم الفاتورة"},{key:"client",label:"العميل"},{key:"amount",label:"المبلغ"},{key:"status",label:"الحالة"}],
  },
  receivables: {
    key: "receivables", title: "المستحقات", description: "المبالغ المستحقة والتحصيل.", delegate: "receivable", route: "/receivables", api: "/api/receivables",
    searchFields: ["client", "status", "notes"], columns: [{key:"client",label:"العميل"},{key:"amount",label:"المبلغ"},{key:"paidAmount",label:"المدفوع"},{key:"status",label:"الحالة"}],
  },
  payments: {
    key: "payments", title: "المدفوعات", description: "المدفوعات والمراجع.", delegate: "payment", route: "/payments", api: "/api/payments",
    searchFields: ["payee", "method", "referenceNo", "status"], columns: [{key:"payee",label:"المستفيد"},{key:"amount",label:"المبلغ"},{key:"method",label:"طريقة الدفع"},{key:"status",label:"الحالة"}],
  },
  expenses: {
    key: "expenses", title: "المصروفات", description: "مصروفات التشغيل.", delegate: "expense", route: "/expenses", api: "/api/expenses",
    searchFields: ["type", "month", "status", "notes"], columns: [{key:"type",label:"النوع"},{key:"amount",label:"المبلغ"},{key:"month",label:"الشهر"},{key:"status",label:"الحالة"}],
  },
  revenues: {
    key: "revenues", title: "الإيرادات", description: "إيرادات التطبيقات والفواتير.", delegate: "revenue", route: "/revenues", api: "/api/revenues",
    searchFields: ["source", "month", "status", "notes"], columns: [{key:"source",label:"المصدر"},{key:"amount",label:"المبلغ"},{key:"month",label:"الشهر"},{key:"status",label:"الحالة"}],
  },
  "supplier-accounts": {
    key: "supplier-accounts", title: "حسابات الموردين", description: "أرصدة الموردين.", delegate: "supplierAccount", route: "/supplier-accounts", api: "/api/supplier-accounts",
    searchFields: ["supplier", "status", "notes"], columns: [{key:"supplier",label:"المورد"},{key:"balance",label:"الرصيد"},{key:"dueDate",label:"تاريخ الاستحقاق"},{key:"status",label:"الحالة"}],
  },
  "cashbox-entries": {
    key: "cashbox-entries", title: "العهدة والصندوق", description: "حركة الصندوق والعهدة.", delegate: "cashboxEntry", route: "/custody-cashbox", api: "/api/cashbox-entries",
    searchFields: ["type", "responsible", "status", "notes"], columns: [{key:"type",label:"الحركة"},{key:"amount",label:"المبلغ"},{key:"balance",label:"الرصيد"},{key:"status",label:"الحالة"}],
  },
  "bank-accounts": {
    key: "bank-accounts", title: "الحسابات البنكية", description: "الحسابات والأرصدة.", delegate: "bankAccount", route: "/bank-accounts", api: "/api/bank-accounts",
    searchFields: ["bankName", "iban", "status"], columns: [{key:"bankName",label:"البنك"},{key:"iban",label:"IBAN"},{key:"balance",label:"الرصيد"},{key:"status",label:"الحالة"}],
  },
  "vat-records": {
    key: "vat-records", title: "VAT", description: "ضريبة القيمة المضافة.", delegate: "vatRecord", route: "/vat", api: "/api/vat-records",
    searchFields: ["month", "status"], columns: [{key:"month",label:"الشهر"},{key:"salesVat",label:"ضريبة المبيعات"},{key:"purchaseVat",label:"ضريبة المشتريات"},{key:"netVat",label:"الصافي"}],
  },
  "profit-loss": {
    key: "profit-loss", title: "الأرباح والخسائر", description: "ملخص الربح والخسارة الشهري.", delegate: "profitLossRecord", route: "/profit-loss", api: "/api/profit-loss",
    searchFields: ["month", "status"], columns: [{key:"month",label:"الشهر"},{key:"revenues",label:"الإيرادات"},{key:"expenses",label:"المصروفات"},{key:"netProfit",label:"الصافي"}],
  },
  "quality-audits": {
    key: "quality-audits", title: "الجودة والتدقيق", description: "تدقيق الكيانات والملفات والمهام.", delegate: "qualityAuditRecord", route: "/quality-audit", api: "/api/quality-audits",
    searchFields: ["entityType", "entityId", "result", "status"], columns: [{key:"entityType",label:"الكيان"},{key:"result",label:"النتيجة"},{key:"reviewedBy",label:"المراجع"},{key:"status",label:"الحالة"}],
  },
  "report-templates": {
    key: "report-templates", title: "قوالب التقارير", description: "قوالب التقارير والتصدير.", delegate: "reportTemplate", route: "/report-templates", api: "/api/report-templates",
    searchFields: ["name", "reportType", "status"], columns: [{key:"name",label:"القالب"},{key:"reportType",label:"نوع التقرير"},{key:"status",label:"الحالة"},{key:"updatedAt",label:"آخر تحديث"}],
  },
  "excel-mappings": {
    key: "excel-mappings", title: "ربط أعمدة Excel", description: "خرائط الأعمدة للاستيراد.", delegate: "excelMapping", route: "/excel-column-mapping", api: "/api/excel-mappings",
    searchFields: ["name", "importType", "status"], columns: [{key:"name",label:"الخريطة"},{key:"importType",label:"نوع الاستيراد"},{key:"status",label:"الحالة"},{key:"updatedAt",label:"آخر تحديث"}],
  },
  "api-integrations": {
    key: "api-integrations", title: "API Integrations", description: "التكاملات وحالة الربط.", delegate: "apiIntegration", route: "/api-integrations", api: "/api/api-integrations",
    searchFields: ["name", "provider", "status"], columns: [{key:"name",label:"التكامل"},{key:"provider",label:"المزود"},{key:"lastSyncAt",label:"آخر مزامنة"},{key:"status",label:"الحالة"}],
  },
  "backup-records": {
    key: "backup-records", title: "Backup/Restore", description: "سجل النسخ والاستعادة.", delegate: "backupRecord", route: "/backup-restore", api: "/api/backup-records",
    searchFields: ["fileName", "type", "status", "createdBy"], columns: [{key:"fileName",label:"الملف"},{key:"type",label:"النوع"},{key:"createdBy",label:"بواسطة"},{key:"status",label:"الحالة"}],
  },
  "data-cleaning-issues": {
    key: "data-cleaning-issues", title: "تنظيف البيانات", description: "مشاكل التكرار والروابط المكسورة.", delegate: "dataCleaningIssue", route: "/data-cleaning", api: "/api/data-cleaning-issues",
    searchFields: ["issueType", "entityType", "entityId", "status"], columns: [{key:"issueType",label:"المشكلة"},{key:"entityType",label:"الكيان"},{key:"severity",label:"الخطورة"},{key:"status",label:"الحالة"}],
  },
});

export function getResource(key: string) {
  return resources[key as ResourceKey] ?? null;
}

export const tablePages = [
  resources.drivers,
  resources.supervisors,
  resources.cities,
  resources.projects,
  resources.vehicles,
  resources.applications,
  resources["daily-reports"],
];
