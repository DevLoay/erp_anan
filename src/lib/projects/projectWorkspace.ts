import { PayrollStatus, Prisma, RecordStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { databaseOfflineMessage, getImportTemplatesData, resolveImportTemplateFilters } from "@/lib/imports/templates";
import { projectImportTypesForApplication } from "@/lib/imports/importScopes";
import { getTemplateConfigs, resolveKeetaApplicationProject, rowFromTemplateConfig } from "@/lib/templates/templateConfig";
import { calculateExpectedTarget } from "@/lib/performance/expectedTargets";

export type ProjectWorkspaceFilters = {
  month?: string;
  cityId?: string;
  supervisorId?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type ProjectWorkspace = Awaited<ReturnType<typeof getProjectWorkspace>>;

function decimalNumber(value: unknown) {
  if (value instanceof Prisma.Decimal) return value.toNumber();
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function money(value: unknown) {
  return new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(decimalNumber(value));
}

function numberFormat(value: number) {
  return new Intl.NumberFormat("ar-SA").format(value);
}

function monthStart(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber) return null;
  return new Date(Date.UTC(year, monthNumber - 1, 1));
}

function monthEnd(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber) return null;
  return new Date(Date.UTC(year, monthNumber, 0, 23, 59, 59, 999));
}

function dateOrNull(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function resolvePeriod(filters: ProjectWorkspaceFilters) {
  const month = filters.month || "2026-04";
  const from = dateOrNull(filters.dateFrom) ?? monthStart(month);
  const to = dateOrNull(filters.dateTo) ?? monthEnd(month);
  return { month, from, to };
}

function statusText(status: unknown) {
  const raw = String(status ?? "").toUpperCase();
  const labels: Record<string, string> = {
    ACTIVE: "نشط",
    INACTIVE: "غير نشط",
    PENDING: "قيد المراجعة",
    APPROVED: "معتمد",
    LOCKED: "مقفل",
    DRAFT: "مسودة",
    UNDER_REVIEW: "مراجعة",
    PAID: "مدفوع",
  };
  return labels[raw] ?? String(status ?? "-");
}

function invoiceApprovedWhere() {
  return [
    { status: { in: [RecordStatus.APPROVED, RecordStatus.LOCKED] } },
    { invoiceStatus: { in: ["Approved", "Locked", "Paid", "APPROVED", "LOCKED", "PAID"] } },
  ];
}

function codeFrom(value: string) {
  return value.trim().replace(/\s+/g, "_").replace(/[^\p{L}\p{N}_-]/gu, "").toUpperCase() || "APP";
}

const PROJECT_SLUGS: Record<string, { code: string; name: string }> = {
  hungerstation: { code: "HUNGERSTATION", name: "HungerStation" },
  talabat: { code: "TALABAT", name: "Talabat" },
  ninja: { code: "NINJA", name: "Ninja" },
  toyou: { code: "TOYOU", name: "ToYou" },
};

async function resolveApplicationProject(projectId: string) {
  if (projectId.trim().toLowerCase() === "keeta") {
    return resolveKeetaApplicationProject();
  }

  const stable = PROJECT_SLUGS[projectId.trim().toLowerCase()];
  if (stable) {
    const application = await prisma.application.upsert({
      where: { code: stable.code },
      update: { name: stable.name, status: RecordStatus.ACTIVE },
      create: { code: stable.code, name: stable.name, status: RecordStatus.ACTIVE },
    });
    return prisma.applicationProject.upsert({
      where: { code: `${stable.code}-WORKSPACE` },
      update: {
        applicationId: application.id,
        projectId: null,
        cityId: null,
        name: stable.name,
        status: RecordStatus.ACTIVE,
      },
      create: {
        applicationId: application.id,
        projectId: null,
        cityId: null,
        code: `${stable.code}-WORKSPACE`,
        name: stable.name,
        status: RecordStatus.ACTIVE,
      },
      include: {
        application: true,
        city: true,
        project: true,
      },
    });
  }

  const existing = await prisma.applicationProject.findUnique({
    where: { id: projectId },
    include: {
      application: true,
      city: true,
      project: true,
    },
  });
  if (existing) return existing;

  const legacy = await prisma.project.findUnique({
    where: { id: projectId },
    include: { city: true },
  });
  if (!legacy) return null;

  const applicationName = legacy.appName || legacy.name || "Other";
  const applicationCode = codeFrom(applicationName);
  const application = await prisma.application.upsert({
    where: { code: applicationCode },
    update: { name: applicationName },
    create: { code: applicationCode, name: applicationName, status: RecordStatus.ACTIVE },
  });
  const cityCode = legacy.city?.nameEn || legacy.city?.nameAr || legacy.cityId || "GLOBAL";
  const bridgeCode = `${applicationCode}-${codeFrom(cityCode)}`;
  return prisma.applicationProject.upsert({
    where: { code: bridgeCode },
    update: {
      applicationId: application.id,
      projectId: null,
      cityId: legacy.cityId,
      name: legacy.name,
      status: legacy.status,
    },
    create: {
      applicationId: application.id,
      projectId: null,
      cityId: legacy.cityId,
      code: bridgeCode,
      name: legacy.name,
      status: legacy.status,
    },
    include: {
      application: true,
      city: true,
      project: true,
    },
  });
}

export async function getProjectWorkspace(projectId: string, filters: ProjectWorkspaceFilters = {}) {
  try {
    const applicationProject = await resolveApplicationProject(projectId);

    if (!applicationProject) {
      return { status: "missing" as const, message: "المشروع غير موجود أو تم حذفه.", project: null };
    }

    const { month, from, to } = resolvePeriod(filters);
    const projectReportWhere: Prisma.DailyReportWhereInput = {
      applicationProjectId: applicationProject.id,
      ...(filters.cityId ? { cityId: filters.cityId } : applicationProject.cityId ? { cityId: applicationProject.cityId } : {}),
      ...(from && to ? { reportDate: { gte: from, lte: to } } : { month }),
      ...(filters.supervisorId ? { driver: { supervisorId: filters.supervisorId } } : {}),
    };
    const invoiceWhere: Prisma.InvoiceWhereInput = {
      applicationProjectId: applicationProject.id,
      ...(month ? { month } : {}),
      status: { not: RecordStatus.INACTIVE },
    };
    const payrollWhere: Prisma.PayrollRunWhereInput = {
      applicationProjectId: applicationProject.id,
      ...(filters.cityId ? { cityId: filters.cityId } : applicationProject.cityId ? { cityId: applicationProject.cityId } : {}),
      ...(month ? { year: Number(month.slice(0, 4)), month: Number(month.slice(5, 7)) } : {}),
    };
    const importPeriodFilters: Prisma.ApplicationImportBatchWhereInput[] = [];
    if (month) importPeriodFilters.push({ month });
    if (from && to) {
      importPeriodFilters.push({ periodStart: { gte: from, lte: to } }, { periodEnd: { gte: from, lte: to } }, { createdAt: { gte: from, lte: to } });
    }
    const importWhere: Prisma.ApplicationImportBatchWhereInput = {
      applicationProjectId: applicationProject.id,
      ...(importPeriodFilters.length ? { OR: importPeriodFilters } : {}),
    };
    const financeWhere: Prisma.FinanceEntryWhereInput = {
      applicationProjectId: applicationProject.id,
      ...(filters.cityId ? { cityId: filters.cityId } : applicationProject.cityId ? { cityId: applicationProject.cityId } : {}),
      ...(from && to ? { entryDate: { gte: from, lte: to } } : {}),
    };

    const [
      reportsAggregate,
      reports,
      driversCount,
      accountsCount,
      unlinkedAccounts,
      imports,
      invoices,
      approvedInvoices,
      keetaInvoiceRecords,
      payrollRuns,
      approvedPayrollRuns,
      financeAggregate,
      invoiceSettingsCount,
      rankSettingsCount,
      payrollSettingsCount,
      cities,
      supervisors,
    ] = await Promise.all([
      prisma.dailyReport.aggregate({
        where: projectReportWhere,
        _sum: { orders: true, workingHours: true },
        _avg: { onTimeRate: true, cancellationRate: true, rejectionRate: true },
        _count: { _all: true },
      }),
      prisma.dailyReport.findMany({
        where: projectReportWhere,
        include: {
          driver: { select: { id: true, internalCode: true, driverCode: true, name: true, actualName: true, supervisor: { select: { name: true } } } },
          city: { select: { nameAr: true, nameEn: true } },
        },
        orderBy: { reportDate: "desc" },
        take: 200,
      }),
      prisma.driver.count({
        where: {
          OR: [
            { applicationAccounts: { some: { applicationProjectId: applicationProject.id } } },
            ...(!applicationProject.cityId ? [{ applicationAccounts: { some: { applicationId: applicationProject.applicationId } } }] : []),
          ],
          ...(applicationProject.cityId ? { cityId: applicationProject.cityId } : {}),
        },
      }),
      prisma.applicationAccount.count({ where: { applicationProjectId: applicationProject.id } }),
      prisma.applicationAccount.count({ where: { applicationProjectId: applicationProject.id, OR: [{ driverId: null }, { isEmpty: true }] } }),
      prisma.applicationImportBatch.findMany({
        where: importWhere,
        select: {
          id: true,
          fileName: true,
          sourceFileName: true,
          fileType: true,
          totalRows: true,
          validRows: true,
          invalidRows: true,
          missingDrivers: true,
          status: true,
          uploadedBy: true,
          createdAt: true,
          template: { select: { name: true } },
          createdBy: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 60,
      }),
      prisma.invoice.findMany({ where: invoiceWhere, orderBy: { issuedAt: "desc" }, take: 80 }),
      prisma.invoice.aggregate({
        where: { AND: [invoiceWhere, { OR: invoiceApprovedWhere() }] },
        _sum: { amount: true, vatAmount: true },
        _count: { _all: true },
      }),
      prisma.keetaInvoiceRecord.findMany({
        where: {
          applicationProjectId: applicationProject.id,
          ...(month ? { month } : {}),
          status: { in: ["Approved", "APPROVED", "Locked", "LOCKED", "Paid", "PAID"] },
        },
        include: { invoiceBatch: { select: { id: true, fileName: true, sourceFileName: true, createdAt: true, approvedAt: true } } },
        orderBy: [{ approvedAt: "desc" }, { updatedAt: "desc" }],
        take: 1000,
      }),
      prisma.payrollRun.findMany({
        where: payrollWhere,
        include: { city: { select: { nameAr: true, nameEn: true } }, _count: { select: { items: true } } },
        orderBy: [{ year: "desc" }, { month: "desc" }],
        take: 80,
      }),
      prisma.payrollRun.aggregate({
        where: { ...payrollWhere, status: { in: [PayrollStatus.APPROVED, PayrollStatus.PAID, PayrollStatus.LOCKED] } },
        _sum: { netTotal: true, totalEarnings: true, totalDeductions: true, totalCompanyRevenue: true, estimatedCompanyProfit: true },
        _count: { _all: true },
      }),
      prisma.financeEntry.aggregate({ where: financeWhere, _sum: { amount: true }, _count: { _all: true } }),
      prisma.applicationInvoiceSetting.count({ where: { OR: [{ applicationProjectId: applicationProject.id }, { applicationId: applicationProject.applicationId, applicationProjectId: null }] } }),
      prisma.applicationRankSetting.count({ where: { OR: [{ applicationProjectId: applicationProject.id }, { applicationId: applicationProject.applicationId, applicationProjectId: null }] } }),
      prisma.applicationPayrollSetting.count({ where: { OR: [{ applicationProjectId: applicationProject.id }, { applicationId: applicationProject.applicationId, applicationProjectId: null }] } }),
      prisma.city.findMany({ orderBy: { nameAr: "asc" }, select: { id: true, nameAr: true, nameEn: true } }),
      prisma.supervisor.findMany({
        where: applicationProject.cityId ? { cityId: applicationProject.cityId } : {},
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ]);

    const totalOrders = reportsAggregate._sum.orders ?? 0;
    const totalHours = decimalNumber(reportsAggregate._sum.workingHours);
    const reportsCount = reportsAggregate._count._all;
    const averageOnTime = Math.round(decimalNumber(reportsAggregate._avg.onTimeRate) * 10) / 10;
    const averageCancellation = Math.round(decimalNumber(reportsAggregate._avg.cancellationRate) * 10) / 10;
    const averageRejection = Math.round(decimalNumber(reportsAggregate._avg.rejectionRate) * 10) / 10;
    const periodTarget = applicationProject.monthlyTarget
      ? calculateExpectedTarget({
          monthlyTarget: applicationProject.monthlyTarget,
          month,
          dateFrom: from?.toISOString().slice(0, 10),
          dateTo: to?.toISOString().slice(0, 10),
        }).expected
      : 0;
    const targetAchievement = periodTarget ? Math.min((totalOrders / periodTarget) * 100, 120) : 0;
    const driverKpiScore = reportsCount
      ? Math.round(
          Math.min(
            100,
            averageOnTime * 0.4 +
              Math.max(0, 100 - averageCancellation) * 0.2 +
              Math.max(0, 100 - averageRejection) * 0.15 +
              Math.min(targetAchievement, 100) * 0.25,
          ) * 10,
        ) / 10
      : 0;
    const invoiceBatchIds = new Set(invoices.map((invoice) => invoice.importBatchId).filter((id): id is string => Boolean(id)));
    const keetaFallbackInvoices = Array.from(
      keetaInvoiceRecords.reduce((groups, record) => {
        const key = record.invoiceBatchId || `keeta-${record.month || month}-${record.createdAt.toISOString()}`;
        if (invoiceBatchIds.has(key)) return groups;
        const current = groups.get(key) ?? {
          id: key,
          number: `KEETA-${key.slice(-8).toUpperCase()}`,
          client: "Keeta",
          month: record.month || month || "-",
          amount: 0,
          vatAmount: 0,
          status: statusText(record.status),
          issuedAt: (record.approvedAt || record.invoiceBatch?.approvedAt || record.createdAt).toISOString(),
          fileName: record.invoiceBatch?.sourceFileName || record.invoiceBatch?.fileName || "",
        };
        current.amount += decimalNumber(record.totalPayableAmount);
        groups.set(key, current);
        return groups;
      }, new Map<string, { id: string; number: string; client: string; month: string; amount: number; vatAmount: number; status: string; issuedAt: string; fileName: string }>())
        .values(),
    );
    const approvedInvoiceTotal =
      decimalNumber(approvedInvoices._sum.amount) +
      decimalNumber(approvedInvoices._sum.vatAmount) +
      keetaFallbackInvoices.reduce((sum, invoice) => sum + invoice.amount + invoice.vatAmount, 0);
    const approvedPayrollNet = decimalNumber(approvedPayrollRuns._sum.netTotal);
    const netProfit = decimalNumber(approvedPayrollRuns._sum.estimatedCompanyProfit) || approvedInvoiceTotal - approvedPayrollNet;
    const lastImport = imports[0];

    return {
      status: "online" as const,
      project: {
        id: applicationProject.id,
        routeId: applicationProject.id,
        name: applicationProject.name,
        code: applicationProject.code,
        applicationId: applicationProject.applicationId,
        applicationName: applicationProject.application.name,
        applicationCode: applicationProject.application.code,
        cityId: applicationProject.cityId,
        cityName: applicationProject.city?.nameAr || applicationProject.city?.nameEn || "كل المدن",
        legacyProjectId: null,
        monthlyTarget: applicationProject.monthlyTarget ?? 0,
        dailyTarget: applicationProject.dailyTarget ?? 0,
      },
      filters: { month, cityId: filters.cityId ?? "", supervisorId: filters.supervisorId ?? "", dateFrom: filters.dateFrom ?? "", dateTo: filters.dateTo ?? "" },
      options: {
        cities: cities.map((city) => ({ id: city.id, name: city.nameAr || city.nameEn || "-" })),
        supervisors,
      },
      summary: {
        totalOrders,
        totalOrdersText: numberFormat(totalOrders),
        reportsCount,
        driversCount,
        accountsCount,
        unlinkedAccounts,
        importsCount: imports.length,
        lastImportFile: lastImport?.sourceFileName || lastImport?.fileName || "-",
        approvedInvoicesCount: approvedInvoices._count._all + keetaFallbackInvoices.length,
        approvedInvoiceTotal: money(approvedInvoiceTotal),
        payrollRunsCount: payrollRuns.length,
        approvedPayrollRunsCount: approvedPayrollRuns._count._all,
        approvedPayrollNet: money(approvedPayrollNet),
        netProfit: money(netProfit),
        averageOnTime,
        averageCancellation,
        averageRejection,
        driverKpiScore,
        targetAchievement: Math.round(targetAchievement * 10) / 10,
        totalHours: Math.round(totalHours * 10) / 10,
        financeEntries: financeAggregate._count._all,
        financeTotal: money(financeAggregate._sum.amount),
        invoiceSettingsCount,
        rankSettingsCount,
        payrollSettingsCount,
      },
      imports: imports.map((item) => ({
        id: item.id,
        fileName: item.sourceFileName || item.fileName || "-",
        fileType: item.fileType,
        templateName: item.template?.name || "-",
        totalRows: item.totalRows,
        validRows: item.validRows,
        invalidRows: item.invalidRows,
        missingDrivers: item.missingDrivers,
        status: item.status,
        createdBy: item.createdBy?.name || item.uploadedBy || "-",
        createdAt: item.createdAt.toISOString(),
      })),
      invoices: [
        ...invoices.map((item) => ({
          id: item.id,
          number: item.number,
          client: item.client || applicationProject.application.name,
          month: item.month || "-",
          amount: money(item.amount),
          vatAmount: money(item.vatAmount),
          status: item.invoiceStatus || statusText(item.status),
          issuedAt: item.issuedAt.toISOString(),
        })),
        ...keetaFallbackInvoices.map((item) => ({
          ...item,
          number: item.fileName || item.number,
          amount: money(item.amount),
          vatAmount: money(item.vatAmount),
        })),
      ],
      payrollRuns: payrollRuns.map((item) => ({
        id: item.id,
        month: `${item.year}-${String(item.month).padStart(2, "0")}`,
        cityName: item.city?.nameAr || item.city?.nameEn || applicationProject.city?.nameAr || "-",
        totalDrivers: item.totalDrivers || item._count.items,
        totalOrders: item.totalOrders,
        totalEarnings: money(item.totalEarnings),
        totalDeductions: money(item.totalDeductions),
        netTotal: money(item.netTotal),
        totalCompanyRevenue: money(item.totalCompanyRevenue),
        estimatedCompanyProfit: money(item.estimatedCompanyProfit),
        status: statusText(item.status),
        approvedAt: item.approvedAt?.toISOString() || "-",
      })),
      reports: reports.map((item) => ({
        id: item.id,
        driverId: item.driver?.id || "",
        date: item.reportDate.toISOString().slice(0, 10),
        driverCode: item.driver?.internalCode || item.driver?.driverCode || "-",
        driverName: item.driver?.actualName || item.driver?.name || "مندوب غير معروف",
        cityName: item.city?.nameAr || item.city?.nameEn || "-",
        supervisorName: item.driver?.supervisor?.name || "-",
        orders: item.orders,
        workingHours: decimalNumber(item.workingHours),
        onTimeRate: decimalNumber(item.onTimeRate),
        cancellationRate: decimalNumber(item.cancellationRate),
        rejectionRate: decimalNumber(item.rejectionRate),
      })),
    };
  } catch (error) {
    const offline = databaseOfflineMessage(error);
    return {
      status: offline ? "offline" as const : "error" as const,
      message: offline || (error instanceof Error ? error.message : "تعذر تحميل بيانات المشروع."),
      project: null,
    };
  }
}

export async function getProjectImportTemplates(projectId: string, filters: ProjectWorkspaceFilters = {}) {
  const workspace = await getProjectWorkspace(projectId, filters);
  if (workspace.status !== "online") return { workspace, templates: [], applications: [], projects: [] };

  const templateData = await getImportTemplatesData(resolveImportTemplateFilters({}));
  const configRows = await getTemplateConfigs({
    applicationProjectId: workspace.project.id,
    applicationName: `${workspace.project.applicationCode} ${workspace.project.applicationName}`,
    visibility: "projectImports",
  });
  const configTemplates = configRows.map(rowFromTemplateConfig);
  const allowedTypes = configRows.length
    ? configRows.map((item) => item.importType)
    : projectImportTypesForApplication(`${workspace.project.applicationCode} ${workspace.project.applicationName}`);
  const configTypes = new Set(configTemplates.map((template) => template.fileType));
  const templates = [
    ...configTemplates,
    ...templateData.rows.filter((template) => {
      if (!allowedTypes.includes(template.fileType)) return false;
      if (configTypes.has(template.fileType)) return false;
      return !template.applicationProjectId || template.applicationProjectId === workspace.project.id;
    }),
  ];

  return {
    workspace,
    templates,
    applications: templateData.applications.filter((app) => app.id === workspace.project.applicationId),
    projects: templateData.projects.filter((project) => project.id === workspace.project.id),
    allowedTypes,
  };
}
