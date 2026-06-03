export const PROJECT_IMPORT_TYPES = [
  "keeta_rank_template",
  "keeta_period_report_template",
  "keeta_driver_invoice_template",
  "keeta_drivers",
  "keeta_accounts",
  "hungerstation_drivers",
  "hungerstation_accounts",
  "hungerstation_invoice",
  "hungerstation_performance",
  "talabat_drivers",
  "talabat_accounts",
  "talabat_invoice",
] as const;

export const GENERAL_IMPORT_TYPES = [
  "drivers",
  "vehicles",
  "application_accounts",
  "advances",
  "deductions",
  "violations",
  "fuel",
  "hr_documents",
] as const;

const PROJECT_IMPORT_SET = new Set<string>(PROJECT_IMPORT_TYPES);

export function importTypeRequiresProject(importType: string) {
  return PROJECT_IMPORT_SET.has(importType) || ["keeta_invoice", "keeta_rank"].includes(importType);
}

export function projectImportTypesForApplication(applicationCodeOrName: string) {
  const key = applicationCodeOrName.trim().toLowerCase().replace(/\s+/g, "");

  if (key.includes("keeta")) return ["keeta_drivers", "keeta_accounts", "keeta_rank_template", "keeta_period_report_template", "keeta_driver_invoice_template"];
  if (key.includes("hungerstation")) return ["hungerstation_drivers", "hungerstation_accounts", "hungerstation_invoice", "hungerstation_performance"];
  if (key.includes("talabat")) return ["talabat_drivers", "talabat_accounts", "talabat_invoice"];

  return [...PROJECT_IMPORT_TYPES];
}

export function importTypeLabel(importType: string) {
  const labels: Record<string, string> = {
    drivers: "بيانات المناديب",
    vehicles: "بيانات السيارات",
    application_accounts: "حسابات التطبيقات",
    keeta_rank_template: "Keeta Rank",
    keeta_period_report_template: "تقرير Keeta حسب الفترة",
    keeta_driver_invoice_template: "فاتورة مناديب Keeta",
    keeta_invoice: "تقرير Keeta القديم",
    keeta_rank: "Keeta Rank القديم",
    hungerstation_invoice: "فاتورة HungerStation",
    hungerstation_performance: "أداء HungerStation",
    talabat_invoice: "فاتورة Talabat",
    advances: "السلف",
    deductions: "الخصومات",
    violations: "المخالفات",
    fuel: "البنزين",
    hr_documents: "مستندات HR",
    payroll: "مسير قديم Migration",
  };

  return labels[importType] ?? importType;
}
