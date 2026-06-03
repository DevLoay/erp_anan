import { prisma } from "@/lib/prisma";
import {
  applicationCatalog,
  applicationDisplayName,
  formatDate,
  moneyValue,
  normalizeAppKey,
  numberValue,
  recordStatusText,
} from "./applicationAnalytics";
import {
  buildApplicationDetails,
  emptyFinanceSummary,
  type ApplicationAccountRow,
  type ApplicationCenterApp,
  type ApplicationFinanceEntryRow,
  type ApplicationImportHistoryRow,
  type ApplicationImportTemplateRow,
  type ApplicationPayrollRunRow,
  type ApplicationProjectRow,
  type ApplicationSettingRow,
} from "./getApplicationDetails";

type QueryIssue = {
  label: string;
  message: string;
};

export type ApplicationCenterSummary = {
  totalApplications: number;
  activeApplications: number;
  totalProjects: number;
  totalAccounts: number;
  activeAccounts: number;
  unlinkedAccounts: number;
  importedReports: number;
  lastImport: string;
  totalOrders: number;
  totalCollection: string;
  payrollRuns: number;
  approvedPayrolls: number;
};

export type ApplicationCenterAnalytics = {
  accountsByApplication: { name: string; value: number }[];
  projectsByApplication: { name: string; value: number }[];
  reportsByApplication: { name: string; value: number }[];
  payrollRunsByApplication: { name: string; value: number }[];
  validVsInvalidRows: { name: string; value: number }[];
  unlinkedAccountsByApplication: { name: string; value: number }[];
};

export type ApplicationCenterData = {
  databaseStatus: "online" | "offline";
  databaseMessage?: string;
  schemaWarnings: QueryIssue[];
  isEmpty: boolean;
  summary: ApplicationCenterSummary;
  applications: ApplicationCenterApp[];
  analytics: ApplicationCenterAnalytics;
};

type SafeState = {
  offlineMessage?: string;
  warnings: QueryIssue[];
};

type LegacyApplicationAccount = {
  id: string;
  appName: string;
  username: string;
  projectId: string | null;
  cityId: string | null;
  driverId: string | null;
  isEmpty: boolean;
  status: unknown;
  createdAt: Date;
  updatedAt: Date;
  project?: {
    id: string;
    name: string;
    appName: string | null;
    city?: { nameAr: string; nameEn: string | null } | null;
  } | null;
  driver?: {
    id: string;
    internalCode: string;
    name: string;
    nationalId: string | null;
    city?: { nameAr: string; nameEn: string | null } | null;
    project?: { name: string; appName: string | null } | null;
  } | null;
};

function issueMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown database error";
}

function errorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error ? String((error as { code?: string }).code) : "";
}

function isDatabaseOffline(error: unknown) {
  const code = errorCode(error);
  const message = issueMessage(error);
  return code === "P1001" || code === "P1002" || message.includes("Can't reach database server") || message.includes("ECONNREFUSED");
}

function isSchemaNotReady(error: unknown) {
  const code = errorCode(error);
  return code === "P2021" || code === "P2022";
}

async function safeQuery<T>(state: SafeState, label: string, query: () => Promise<T>, fallback: T): Promise<T> {
  if (state.offlineMessage) return fallback;

  try {
    return await query();
  } catch (error) {
    if (isDatabaseOffline(error)) {
      state.offlineMessage = "قاعدة البيانات غير متصلة. يرجى تشغيل PostgreSQL ثم تحديث الصفحة.";
      return fallback;
    }

    if (isSchemaNotReady(error)) {
      state.warnings.push({ label, message: "جدول أو عمود Phase 2 غير مطبق في PostgreSQL بعد." });
      return fallback;
    }

    state.warnings.push({ label, message: issueMessage(error) });
    return fallback;
  }
}

function cityName(city?: { nameAr: string | null; nameEn: string | null } | null) {
  return city?.nameAr || city?.nameEn || "غير محدد";
}

function projectName(project?: { name: string | null; appName?: string | null } | null) {
  return project?.name || project?.appName || "غير محدد";
}

function countJson(value: unknown) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") return Object.keys(value).length;
  return 0;
}

function jsonRuleSummary(value: unknown) {
  const count = countJson(value);
  return count ? `${count} قواعد` : "-";
}

function latestDate(...values: unknown[]) {
  const timestamps = values
    .flat()
    .map((value) => {
      if (!value) return 0;
      const date = value instanceof Date ? value : new Date(String(value));
      return Number.isNaN(date.getTime()) ? 0 : date.getTime();
    })
    .filter(Boolean);

  if (!timestamps.length) return "-";
  return formatDate(new Date(Math.max(...timestamps)));
}

function sumBy<T>(rows: T[], value: (row: T) => number) {
  return rows.reduce((total, row) => total + value(row), 0);
}

function uniqueCount<T>(rows: T[], key: (row: T) => string | null | undefined) {
  const values = new Set<string>();
  for (const row of rows) {
    const value = key(row);
    if (value) values.add(value);
  }
  return values.size;
}

function settingProjectName(row: { applicationProject?: { name: string } | null }) {
  return row.applicationProject?.name ?? "كل المشاريع";
}

function appKeyFromLegacy(values: unknown[]) {
  for (const value of values) {
    const key = normalizeAppKey(value);
    if (key !== "other") return key;
  }
  return "other";
}

function collectionDirection(direction: unknown, entryType: unknown) {
  const rawDirection = String(direction ?? "").toLowerCase();
  const rawType = String(entryType ?? "").toLowerCase();
  return rawDirection.includes("in") || rawDirection.includes("credit") || rawType.includes("revenue") || rawType.includes("collection");
}

function emptySummary(): ApplicationCenterSummary {
  return {
    totalApplications: 0,
    activeApplications: 0,
    totalProjects: 0,
    totalAccounts: 0,
    activeAccounts: 0,
    unlinkedAccounts: 0,
    importedReports: 0,
    lastImport: "-",
    totalOrders: 0,
    totalCollection: moneyValue(0),
    payrollRuns: 0,
    approvedPayrolls: 0,
  };
}

function emptyData(state: SafeState): ApplicationCenterData {
  return {
    databaseStatus: state.offlineMessage ? "offline" : "online",
    databaseMessage: state.offlineMessage,
    schemaWarnings: state.warnings,
    isEmpty: true,
    summary: emptySummary(),
    applications: [],
    analytics: {
      accountsByApplication: [],
      projectsByApplication: [],
      reportsByApplication: [],
      payrollRunsByApplication: [],
      validVsInvalidRows: [],
      unlinkedAccountsByApplication: [],
    },
  };
}

export async function getApplicationCenterData(): Promise<ApplicationCenterData> {
  const state: SafeState = { warnings: [] };

  const [
    applications,
    applicationProjects,
    invoiceSettings,
    rankSettings,
    payrollSettings,
    importTemplates,
    applicationImportBatches,
    payrollRuns,
    financeEntries,
    projects,
    accounts,
    dailyReports,
    uploadedReports,
    legacyImportBatches,
    legacyPayrolls,
    invoices,
    advances,
  ] = await Promise.all([
    safeQuery(
      state,
      "Application",
      () => prisma.application.findMany({ orderBy: { name: "asc" } }),
      [],
    ),
    safeQuery(
      state,
      "ApplicationProject",
      () =>
        prisma.applicationProject.findMany({
          include: {
            application: true,
            city: { select: { nameAr: true, nameEn: true } },
            project: { select: { id: true, name: true, appName: true } },
          },
          orderBy: { name: "asc" },
        }),
      [],
    ),
    safeQuery(
      state,
      "ApplicationInvoiceSetting",
      () => prisma.applicationInvoiceSetting.findMany({ include: { applicationProject: true }, orderBy: { updatedAt: "desc" } }),
      [],
    ),
    safeQuery(
      state,
      "ApplicationRankSetting",
      () => prisma.applicationRankSetting.findMany({ include: { applicationProject: true }, orderBy: { updatedAt: "desc" } }),
      [],
    ),
    safeQuery(
      state,
      "ApplicationPayrollSetting",
      () => prisma.applicationPayrollSetting.findMany({ include: { applicationProject: true }, orderBy: { updatedAt: "desc" } }),
      [],
    ),
    safeQuery(
      state,
      "ApplicationImportTemplate",
      () => prisma.applicationImportTemplate.findMany({ include: { applicationProject: true }, orderBy: { updatedAt: "desc" } }),
      [],
    ),
    safeQuery(
      state,
      "ApplicationImportBatch",
      () => prisma.applicationImportBatch.findMany({ include: { application: true, applicationProject: true }, orderBy: { createdAt: "desc" } }),
      [],
    ),
    safeQuery(
      state,
      "PayrollRun",
      () => prisma.payrollRun.findMany({ include: { application: true, applicationProject: true, city: true }, orderBy: { updatedAt: "desc" } }),
      [],
    ),
    safeQuery(
      state,
      "FinanceEntry",
      () => prisma.financeEntry.findMany({ include: { application: true, applicationProject: true, city: true }, orderBy: { entryDate: "desc" } }),
      [],
    ),
    safeQuery(
      state,
      "Project",
      () =>
        prisma.project.findMany({
          select: {
            id: true,
            name: true,
            appName: true,
            cityId: true,
            status: true,
            city: { select: { nameAr: true, nameEn: true } },
            drivers: { select: { id: true } },
            accounts: { select: { id: true } },
            reports: { select: { id: true, orders: true } },
          },
          orderBy: { name: "asc" },
        }),
      [],
    ),
    safeQuery(
      state,
      "ApplicationAccount",
      () =>
        prisma.applicationAccount.findMany({
          select: {
            id: true,
            appName: true,
            username: true,
            projectId: true,
            cityId: true,
            driverId: true,
            isEmpty: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            project: { select: { id: true, name: true, appName: true, city: { select: { nameAr: true, nameEn: true } } } },
            driver: {
              select: {
                id: true,
                internalCode: true,
                name: true,
                nationalId: true,
                city: { select: { nameAr: true, nameEn: true } },
                project: { select: { name: true, appName: true } },
              },
            },
          },
          orderBy: { updatedAt: "desc" },
        }),
      [],
    ),
    safeQuery(
      state,
      "DailyReport",
      () =>
        prisma.dailyReport.findMany({
          select: {
            id: true,
            appName: true,
            projectId: true,
            cityId: true,
            month: true,
            orders: true,
            reportDate: true,
            project: { select: { id: true, name: true, appName: true, city: { select: { nameAr: true, nameEn: true } } } },
          },
          orderBy: { reportDate: "desc" },
        }),
      [],
    ),
    safeQuery(
      state,
      "UploadedReport",
      () =>
        prisma.uploadedReport.findMany({
          select: { id: true, fileName: true, importType: true, appName: true, month: true, status: true, rowsCount: true, createdAt: true, updatedAt: true },
          orderBy: { createdAt: "desc" },
        }),
      [],
    ),
    safeQuery(
      state,
      "ImportBatch",
      () =>
        prisma.importBatch.findMany({
          select: { id: true, fileName: true, importType: true, appName: true, month: true, status: true, rowsFound: true, rowsImported: true, rowsSkipped: true, createdAt: true, updatedAt: true },
          orderBy: { createdAt: "desc" },
        }),
      [],
    ),
    safeQuery(
      state,
      "Payroll",
      () =>
        prisma.payroll.findMany({
          select: {
            id: true,
            driverId: true,
            projectId: true,
            month: true,
            deductions: true,
            netSalary: true,
            status: true,
            lockedAt: true,
            createdAt: true,
            updatedAt: true,
            project: { select: { id: true, name: true, appName: true, city: { select: { nameAr: true, nameEn: true } } } },
            driver: { select: { project: { select: { appName: true, name: true } }, city: { select: { nameAr: true, nameEn: true } } } },
          },
          orderBy: { updatedAt: "desc" },
        }),
      [],
    ),
    safeQuery(
      state,
      "Invoice",
      () => prisma.invoice.findMany({ select: { id: true, projectId: true, amount: true, status: true, issuedAt: true, createdAt: true } }),
      [],
    ),
    safeQuery(
      state,
      "Advance",
      () =>
        prisma.advance.findMany({
          select: {
            id: true,
            amount: true,
            status: true,
            deductionMonth: true,
            driver: { select: { project: { select: { id: true, appName: true, name: true } } } },
          },
        }),
      [],
    ),
  ]);

  if (state.offlineMessage) return emptyData(state);

  const appById = new Map(applications.map((app) => [app.id, app]));
  const appKeyByApplicationId = new Map(applications.map((app) => [app.id, normalizeAppKey(app.code || app.name)]));
  const projectById = new Map(projects.map((project) => [project.id, project]));

  const appRows: ApplicationCenterApp[] = [];
  const allKeys = applicationCatalog.map((item) => item.key);
  const databaseAppKeys = applications.map((app) => normalizeAppKey(app.code || app.name));
  for (const key of databaseAppKeys) {
    if (!allKeys.includes(key)) allKeys.push(key);
  }

  for (const key of allKeys) {
    const catalog = applicationCatalog.find((item) => item.key === key);
    const databaseApp = applications.find((app) => normalizeAppKey(app.code || app.name) === key);
    const appName = databaseApp?.name ?? catalog?.name ?? applicationDisplayName(key);
    const appId = databaseApp?.id ?? key;

    const keyFromProject = (project: { appName: string | null; name: string }) => appKeyFromLegacy([project.appName, project.name]);
    const keyFromAccount = (account: LegacyApplicationAccount) => appKeyFromLegacy([account.appName, account.project?.appName, account.project?.name]);
    const keyFromReport = (report: (typeof dailyReports)[number]) => appKeyFromLegacy([report.appName, report.project?.appName, report.project?.name]);
    const keyFromPayroll = (payroll: (typeof legacyPayrolls)[number]) => appKeyFromLegacy([payroll.project?.appName, payroll.driver?.project?.appName]);

    const legacyProjects = projects.filter((project) => keyFromProject(project) === key);
    const newProjects = applicationProjects.filter((project) => {
      const projectKey = appKeyByApplicationId.get(project.applicationId) ?? normalizeAppKey(project.application?.code || project.application?.name);
      return projectKey === key;
    });
    const representedProjectIds = new Set(newProjects.map((project) => project.projectId).filter(Boolean));
    const appProjects: ApplicationProjectRow[] = [
      ...newProjects.map((project) => {
        const linkedProject = project.projectId ? projectById.get(project.projectId) : null;
        const projectAccounts = accounts.filter((account) => account.projectId && account.projectId === project.projectId);
        const projectReports = dailyReports.filter((report) => report.projectId && report.projectId === project.projectId);
        const projectPayrollRuns = payrollRuns.filter((run) => run.applicationProjectId === project.id);
        return {
          id: project.id,
          routeId: key === "keeta" ? "keeta" : project.id,
          code: project.code,
          name: project.name,
          cityName: cityName(project.city ?? linkedProject?.city),
          monthlyTarget: project.monthlyTarget,
          dailyTarget: project.dailyTarget,
          driversCount: linkedProject?.drivers.length ?? uniqueCount(projectAccounts, (account) => account.driverId),
          accountsCount: projectAccounts.length,
          reportsCount: projectReports.length,
          payrollRuns: projectPayrollRuns.length,
          status: recordStatusText(project.status),
        };
      }),
      ...legacyProjects
        .filter((project) => !representedProjectIds.has(project.id))
        .map((project) => {
          const projectReports = dailyReports.filter((report) => report.projectId === project.id);
          const projectPayrollRuns = legacyPayrolls.filter((payroll) => payroll.projectId === project.id);
          return {
            id: project.id,
            routeId: key === "keeta" ? "keeta" : project.id,
            code: project.id.slice(-8),
            name: project.name,
            cityName: cityName(project.city),
            monthlyTarget: null,
            dailyTarget: null,
            driversCount: project.drivers.length,
            accountsCount: project.accounts.length,
            reportsCount: projectReports.length,
            payrollRuns: uniqueCount(projectPayrollRuns, (payroll) => payroll.month),
            status: recordStatusText(project.status),
          };
        }),
    ];

    const appAccounts = accounts.filter((account) => keyFromAccount(account as LegacyApplicationAccount) === key) as LegacyApplicationAccount[];
    const accountRows: ApplicationAccountRow[] = appAccounts.map((account) => ({
      id: account.id,
      driverCode: account.driver?.internalCode ?? "-",
      driverName: account.driver?.name ?? "غير مربوط",
      nationalId: account.driver?.nationalId ?? "-",
      appUserId: account.username,
      appUsername: account.username,
      cityName: cityName(account.driver?.city ?? account.project?.city),
      projectName: projectName(account.driver?.project ?? account.project),
      status: recordStatusText(account.status),
      linkedAt: account.driverId ? formatDate(account.updatedAt) : "-",
    }));

    const appReports = dailyReports.filter((report) => keyFromReport(report) === key);
    const appUploadedReports = uploadedReports.filter((report) => appKeyFromLegacy([report.appName, report.importType]) === key);
    const appLegacyImports = legacyImportBatches.filter((batch) => appKeyFromLegacy([batch.appName, batch.importType]) === key);
    const appNewImports = applicationImportBatches.filter((batch) => {
      const batchKey = batch.applicationId
        ? appKeyByApplicationId.get(batch.applicationId)
        : normalizeAppKey(batch.application?.code || batch.application?.name || batch.applicationProject?.name);
      return batchKey === key;
    });

    const importHistoryRows: ApplicationImportHistoryRow[] = [
      ...appNewImports.map((batch) => ({
        id: batch.id,
        fileName: batch.fileName ?? "-",
        fileType: batch.fileType,
        projectName: batch.applicationProject?.name ?? "كل المشاريع",
        totalRows: batch.totalRows,
        validRows: batch.validRows,
        invalidRows: batch.invalidRows,
        missingDrivers: batch.missingDrivers,
        unlinkedAccounts: batch.unlinkedAccounts,
        status: recordStatusText(batch.status),
        createdAt: formatDate(batch.createdAt),
      })),
      ...appLegacyImports.map((batch) => ({
        id: batch.id,
        fileName: batch.fileName,
        fileType: batch.importType,
        projectName: "استيراد قديم",
        totalRows: batch.rowsFound,
        validRows: batch.rowsImported,
        invalidRows: batch.rowsSkipped,
        missingDrivers: 0,
        unlinkedAccounts: 0,
        status: recordStatusText(batch.status),
        createdAt: formatDate(batch.createdAt),
      })),
      ...appUploadedReports.map((report) => ({
        id: report.id,
        fileName: report.fileName,
        fileType: report.importType,
        projectName: "ملف مرفوع",
        totalRows: report.rowsCount,
        validRows: report.status === "APPROVED" ? report.rowsCount : 0,
        invalidRows: report.status === "APPROVED" ? 0 : report.rowsCount,
        missingDrivers: 0,
        unlinkedAccounts: 0,
        status: recordStatusText(report.status),
        createdAt: formatDate(report.createdAt),
      })),
    ].sort((a, b) => Number(new Date(b.createdAt)) - Number(new Date(a.createdAt)));

    const appInvoiceSettings = invoiceSettings.filter((setting) => appKeyByApplicationId.get(setting.applicationId) === key);
    const appRankSettings = rankSettings.filter((setting) => appKeyByApplicationId.get(setting.applicationId) === key);
    const appPayrollSettings = payrollSettings.filter((setting) => appKeyByApplicationId.get(setting.applicationId) === key);
    const appTemplates = importTemplates.filter((template) => {
      if (!template.applicationId) return normalizeAppKey(template.applicationProject?.name) === key;
      return appKeyByApplicationId.get(template.applicationId) === key;
    });

    const invoiceSettingRows: ApplicationSettingRow[] = appInvoiceSettings.map((setting) => ({
      id: setting.id,
      name: setting.name,
      projectName: settingProjectName(setting),
      type: setting.invoiceType ?? "-",
      requiredColumnsCount: countJson(setting.requiredColumns),
      optionalColumnsCount: countJson(setting.optionalColumns),
      mappingStatus: countJson(setting.columnMapping) ? "مكتمل" : "غير مكتمل",
      status: recordStatusText(setting.status),
      updatedAt: formatDate(setting.updatedAt),
    }));

    const rankSettingRows: ApplicationSettingRow[] = appRankSettings.map((setting) => ({
      id: setting.id,
      name: setting.name,
      projectName: settingProjectName(setting),
      type: setting.rankType ?? "-",
      requiredColumnsCount: 0,
      optionalColumnsCount: 0,
      mappingStatus: jsonRuleSummary(setting.levelOutput),
      status: recordStatusText(setting.status),
      updatedAt: formatDate(setting.updatedAt),
      minimumOrders: setting.minimumOrders,
      onTimeRule: jsonRuleSummary(setting.onTimeRule),
      cancellationRule: jsonRuleSummary(setting.cancellationRule),
      rejectionRule: jsonRuleSummary(setting.rejectionRule),
      workingHoursRule: jsonRuleSummary(setting.workingHoursRule),
    }));

    const payrollSettingRows: ApplicationSettingRow[] = appPayrollSettings.map((setting) => ({
      id: setting.id,
      name: setting.name,
      projectName: settingProjectName(setting),
      type: "Payroll",
      requiredColumnsCount: 0,
      optionalColumnsCount: 0,
      mappingStatus: jsonRuleSummary(setting.bonusRules),
      status: recordStatusText(setting.status),
      updatedAt: formatDate(setting.updatedAt),
      basicSalary: setting.basicSalary === null ? "-" : moneyValue(setting.basicSalary),
      targetOrders: setting.targetOrders,
      extraOrderPrice: setting.extraOrderPrice === null ? "-" : moneyValue(setting.extraOrderPrice),
      levelRules: jsonRuleSummary(setting.levelRules),
      carRentRule: jsonRuleSummary(setting.carRentRule),
    }));

    const templateRows: ApplicationImportTemplateRow[] = appTemplates.map((template) => ({
      id: template.id,
      name: template.name,
      fileType: template.fileType,
      projectName: template.applicationProject?.name ?? "كل المشاريع",
      requiredColumnsCount: countJson(template.requiredColumns),
      optionalColumnsCount: countJson(template.optionalColumns),
      lastUsedAt: formatDate(template.lastUsedAt),
      status: recordStatusText(template.status),
    }));

    const appPayrollRuns = payrollRuns.filter((run) => {
      const runKey = run.applicationId
        ? appKeyByApplicationId.get(run.applicationId)
        : normalizeAppKey(run.application?.code || run.application?.name || run.applicationProject?.name);
      return runKey === key;
    });
    const appLegacyPayrolls = legacyPayrolls.filter((payroll) => keyFromPayroll(payroll) === key);
    const legacyPayrollRunRows = Array.from(new Map(appLegacyPayrolls.map((payroll) => [`${payroll.projectId ?? "none"}:${payroll.month}`, payroll])).values());
    const payrollRunRows: ApplicationPayrollRunRow[] = [
      ...appPayrollRuns.map((run) => ({
        id: run.id,
        month: String(run.month),
        year: String(run.year),
        projectName: run.applicationProject?.name ?? "كل المشاريع",
        cityName: cityName(run.city),
        totalDrivers: run.totalDrivers,
        totalOrders: run.totalOrders,
        totalEarnings: moneyValue(run.totalEarnings),
        totalDeductions: moneyValue(run.totalDeductions),
        netTotal: moneyValue(run.netTotal),
        status: recordStatusText(run.status),
        approvedAt: formatDate(run.approvedAt),
      })),
      ...legacyPayrollRunRows.map((run) => {
        const grouped = appLegacyPayrolls.filter((payroll) => payroll.projectId === run.projectId && payroll.month === run.month);
        return {
          id: run.id,
          month: run.month,
          year: run.month.slice(0, 4) || "-",
          projectName: projectName(run.project ?? run.driver?.project),
          cityName: cityName(run.project?.city ?? run.driver?.city),
          totalDrivers: grouped.length,
          totalOrders: 0,
          totalEarnings: moneyValue(sumBy(grouped, (payroll) => numberValue(payroll.netSalary) + numberValue(payroll.deductions))),
          totalDeductions: moneyValue(sumBy(grouped, (payroll) => numberValue(payroll.deductions))),
          netTotal: moneyValue(sumBy(grouped, (payroll) => numberValue(payroll.netSalary))),
          status: recordStatusText(run.status),
          approvedAt: formatDate(run.lockedAt),
        };
      }),
    ];

    const appFinanceEntries = financeEntries.filter((entry) => {
      const entryKey = entry.applicationId
        ? appKeyByApplicationId.get(entry.applicationId)
        : normalizeAppKey(entry.application?.code || entry.application?.name || entry.applicationProject?.name);
      return entryKey === key;
    });
    const financeEntryRows: ApplicationFinanceEntryRow[] = appFinanceEntries.map((entry) => ({
      id: entry.id,
      sourceType: entry.sourceType,
      entryType: entry.entryType,
      amount: moneyValue(entry.amount),
      direction: entry.direction,
      description: entry.description ?? "-",
      entryDate: formatDate(entry.entryDate),
      status: recordStatusText(entry.status),
    }));

    const appInvoices = invoices.filter((invoice) => {
      const project = invoice.projectId ? projectById.get(invoice.projectId) : null;
      return appKeyFromLegacy([project?.appName, project?.name]) === key;
    });
    const appAdvances = advances.filter((advance) => appKeyFromLegacy([advance.driver?.project?.appName, advance.driver?.project?.name]) === key);

    const approvedNewPayrollTotal = sumBy(
      appPayrollRuns.filter((run) => String(run.status) === "APPROVED" || String(run.status) === "PAID" || String(run.status) === "LOCKED"),
      (run) => numberValue(run.netTotal),
    );
    const approvedLegacyPayrollTotal = sumBy(
      appLegacyPayrolls.filter((payroll) => String(payroll.status) === "APPROVED" || String(payroll.status) === "PAID" || String(payroll.status) === "LOCKED"),
      (payroll) => numberValue(payroll.netSalary),
    );
    const totalDeductions = sumBy(appPayrollRuns, (run) => numberValue(run.totalDeductions)) + sumBy(appLegacyPayrolls, (payroll) => numberValue(payroll.deductions));
    const advancesDeducted = sumBy(
      appAdvances.filter((advance) => String(advance.status) === "APPROVED" || String(advance.status) === "LOCKED"),
      (advance) => numberValue(advance.amount),
    );
    const financeTotal = sumBy(appFinanceEntries, (entry) => numberValue(entry.amount));
    const collectionTotal =
      sumBy(appFinanceEntries.filter((entry) => collectionDirection(entry.direction, entry.entryType)), (entry) => numberValue(entry.amount)) +
      sumBy(appInvoices, (invoice) => numberValue(invoice.amount));

    const financeSummary = {
      ...emptyFinanceSummary(),
      approvedPayrollTotal: moneyValue(approvedNewPayrollTotal + approvedLegacyPayrollTotal),
      totalDeductions: moneyValue(totalDeductions),
      advancesDeducted: moneyValue(advancesDeducted),
      netExpenses: moneyValue(approvedNewPayrollTotal + approvedLegacyPayrollTotal + totalDeductions + advancesDeducted),
      financeEntriesTotal: moneyValue(financeTotal),
      financeEntriesCount: appFinanceEntries.length,
    };

    const totalPayrollRuns = payrollRunRows.length;
    const approvedPayrolls =
      appPayrollRuns.filter((run) => ["APPROVED", "PAID", "LOCKED"].includes(String(run.status))).length +
      uniqueCount(
        appLegacyPayrolls.filter((payroll) => ["APPROVED", "PAID", "LOCKED"].includes(String(payroll.status))),
        (payroll) => `${payroll.projectId ?? "none"}:${payroll.month}`,
      );

    appRows.push(
      buildApplicationDetails({
        id: appId,
        key,
        code: databaseApp?.code ?? applicationCatalog.find((item) => item.key === key)?.code ?? key.toUpperCase(),
        name: appName,
        description: databaseApp?.description ?? "تطبيق تشغيلي ضمن مركز التطبيقات.",
        status: recordStatusText(databaseApp?.status ?? (appProjects.length || appAccounts.length || appReports.length ? "ACTIVE" : "INACTIVE")),
        source: databaseApp ? "database" : appProjects.length || appAccounts.length || appReports.length ? "legacy" : "catalog",
        projectsCount: appProjects.length,
        linkedDrivers: uniqueCount(appAccounts, (account) => account.driverId),
        accountsCount: appAccounts.length,
        activeAccounts: appAccounts.filter((account) => String(account.status) === "ACTIVE" && !account.isEmpty).length,
        unlinkedAccounts: appAccounts.filter((account) => !account.driverId || account.isEmpty).length,
        importedReports: importHistoryRows.length,
        lastImport: latestDate(appNewImports.map((item) => item.createdAt), appLegacyImports.map((item) => item.createdAt), appUploadedReports.map((item) => item.createdAt)),
        totalOrders: sumBy(appReports, (report) => report.orders),
        totalCollection: moneyValue(collectionTotal),
        payrollRuns: totalPayrollRuns,
        approvedPayrolls,
        projects: appProjects,
        accounts: accountRows,
        invoiceSettings: invoiceSettingRows,
        rankSettings: rankSettingRows,
        payrollSettings: payrollSettingRows,
        importTemplates: templateRows,
        importHistory: importHistoryRows,
        payrollRunRows,
        financeEntries: financeEntryRows,
        financeSummary,
      }),
    );
  }

  const visibleApps = appRows.filter((app) => applicationCatalog.some((catalog) => catalog.key === app.key));
  const appsForSummary = visibleApps.length ? visibleApps : appRows;
  const importedReports = sumBy(appsForSummary, (app) => app.importedReports);
  const payrollRunsCount = sumBy(appsForSummary, (app) => app.payrollRuns);
  const approvedPayrolls = sumBy(appsForSummary, (app) => app.approvedPayrolls);
  const totalCollectionNumber = sumBy(appsForSummary, (app) => {
    const digits = app.totalCollection.replace(/[^\d.-]/g, "");
    return numberValue(digits);
  });
  const allImportDates = [
    ...applicationImportBatches.map((batch) => batch.createdAt),
    ...legacyImportBatches.map((batch) => batch.createdAt),
    ...uploadedReports.map((report) => report.createdAt),
  ];

  const summary: ApplicationCenterSummary = {
    totalApplications: appsForSummary.length,
    activeApplications: appsForSummary.filter((app) => app.status === "نشط").length,
    totalProjects: sumBy(appsForSummary, (app) => app.projectsCount),
    totalAccounts: sumBy(appsForSummary, (app) => app.accountsCount),
    activeAccounts: sumBy(appsForSummary, (app) => app.activeAccounts),
    unlinkedAccounts: sumBy(appsForSummary, (app) => app.unlinkedAccounts),
    importedReports,
    lastImport: latestDate(allImportDates),
    totalOrders: sumBy(appsForSummary, (app) => app.totalOrders),
    totalCollection: moneyValue(totalCollectionNumber),
    payrollRuns: payrollRunsCount,
    approvedPayrolls,
  };

  const hasAnyData =
    applications.length > 0 ||
    projects.some((project) => Boolean(project.appName)) ||
    accounts.length > 0 ||
    dailyReports.length > 0 ||
    importedReports > 0 ||
    payrollRunsCount > 0;

  const analytics: ApplicationCenterAnalytics = {
    accountsByApplication: appsForSummary.map((app) => ({ name: app.name, value: app.accountsCount })).filter((item) => item.value > 0),
    projectsByApplication: appsForSummary.map((app) => ({ name: app.name, value: app.projectsCount })).filter((item) => item.value > 0),
    reportsByApplication: appsForSummary.map((app) => ({ name: app.name, value: app.importedReports })).filter((item) => item.value > 0),
    payrollRunsByApplication: appsForSummary.map((app) => ({ name: app.name, value: app.payrollRuns })).filter((item) => item.value > 0),
    validVsInvalidRows: [
      { name: "Valid Rows", value: sumBy(applicationImportBatches, (batch) => batch.validRows) + sumBy(legacyImportBatches, (batch) => batch.rowsImported) },
      { name: "Invalid Rows", value: sumBy(applicationImportBatches, (batch) => batch.invalidRows) + sumBy(legacyImportBatches, (batch) => batch.rowsSkipped) },
    ].filter((item) => item.value > 0),
    unlinkedAccountsByApplication: appsForSummary.map((app) => ({ name: app.name, value: app.unlinkedAccounts })).filter((item) => item.value > 0),
  };

  return {
    databaseStatus: "online",
    schemaWarnings: state.warnings,
    isEmpty: !hasAnyData,
    summary,
    applications: appsForSummary,
    analytics,
  };
}
