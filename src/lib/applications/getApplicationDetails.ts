import { buildInsight, moneyValue } from "./applicationAnalytics";

export type ApplicationProjectRow = {
  id: string;
  code: string;
  name: string;
  cityName: string;
  monthlyTarget: number | null;
  dailyTarget: number | null;
  driversCount: number;
  accountsCount: number;
  reportsCount: number;
  payrollRuns: number;
  status: string;
};

export type ApplicationAccountRow = {
  id: string;
  driverCode: string;
  driverName: string;
  nationalId: string;
  appUserId: string;
  appUsername: string;
  cityName: string;
  projectName: string;
  status: string;
  linkedAt: string;
};

export type ApplicationSettingRow = {
  id: string;
  name: string;
  projectName: string;
  type: string;
  requiredColumnsCount: number;
  optionalColumnsCount: number;
  mappingStatus: string;
  status: string;
  updatedAt: string;
  minimumOrders?: number | null;
  onTimeRule?: string;
  cancellationRule?: string;
  rejectionRule?: string;
  workingHoursRule?: string;
  basicSalary?: string;
  targetOrders?: number | null;
  extraOrderPrice?: string;
  levelRules?: string;
  carRentRule?: string;
};

export type ApplicationImportTemplateRow = {
  id: string;
  name: string;
  fileType: string;
  projectName: string;
  requiredColumnsCount: number;
  optionalColumnsCount: number;
  lastUsedAt: string;
  status: string;
};

export type ApplicationImportHistoryRow = {
  id: string;
  fileName: string;
  fileType: string;
  projectName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  missingDrivers: number;
  unlinkedAccounts: number;
  status: string;
  createdAt: string;
};

export type ApplicationPayrollRunRow = {
  id: string;
  month: string;
  year: string;
  projectName: string;
  cityName: string;
  totalDrivers: number;
  totalOrders: number;
  totalEarnings: string;
  totalDeductions: string;
  netTotal: string;
  status: string;
  approvedAt: string;
};

export type ApplicationFinanceEntryRow = {
  id: string;
  sourceType: string;
  entryType: string;
  amount: string;
  direction: string;
  description: string;
  entryDate: string;
  status: string;
};

export type ApplicationFinanceSummary = {
  approvedPayrollTotal: string;
  totalDeductions: string;
  advancesDeducted: string;
  carRentTotal: string;
  netExpenses: string;
  financeEntriesTotal: string;
  financeEntriesCount: number;
};

export type ApplicationCenterApp = {
  id: string;
  key: string;
  code: string;
  name: string;
  description: string;
  status: string;
  source: "database" | "legacy" | "catalog";
  projectsCount: number;
  linkedDrivers: number;
  accountsCount: number;
  activeAccounts: number;
  unlinkedAccounts: number;
  importedReports: number;
  lastImport: string;
  totalOrders: number;
  totalCollection: string;
  payrollRuns: number;
  approvedPayrolls: number;
  insight: string;
  projects: ApplicationProjectRow[];
  accounts: ApplicationAccountRow[];
  invoiceSettings: ApplicationSettingRow[];
  rankSettings: ApplicationSettingRow[];
  payrollSettings: ApplicationSettingRow[];
  importTemplates: ApplicationImportTemplateRow[];
  importHistory: ApplicationImportHistoryRow[];
  payrollRunRows: ApplicationPayrollRunRow[];
  financeEntries: ApplicationFinanceEntryRow[];
  financeSummary: ApplicationFinanceSummary;
};

export function buildApplicationDetails(input: Omit<ApplicationCenterApp, "insight">): ApplicationCenterApp {
  return {
    ...input,
    insight: buildInsight(input.name, input.projectsCount, input.activeAccounts, input.unlinkedAccounts),
  };
}

export function emptyFinanceSummary(): ApplicationFinanceSummary {
  return {
    approvedPayrollTotal: moneyValue(0),
    totalDeductions: moneyValue(0),
    advancesDeducted: moneyValue(0),
    carRentTotal: moneyValue(0),
    netExpenses: moneyValue(0),
    financeEntriesTotal: moneyValue(0),
    financeEntriesCount: 0,
  };
}

