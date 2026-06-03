import { Prisma, RecordStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  KEETA_DRIVER_INVOICE_TEMPLATE,
  KEETA_PERIOD_REPORT_TEMPLATE,
  KEETA_RANK_TEMPLATE,
  getBuiltinTemplate,
  jsonInput,
  templateFromDefinition,
  type ImportTemplateRow,
} from "@/lib/imports/templates";

type TemplateVisibility = "projectImports" | "invoices" | "payroll" | "reports" | "managementReports" | "applicationCenter" | "globalImports";

const KEETA_TEMPLATE_KEYS = [
  {
    key: "keeta_rank_template",
    importType: KEETA_RANK_TEMPLATE,
    nameAr: "قالب Keeta Rank",
    nameEn: "Keeta Rank Template",
    route: "/projects/keeta/imports?type=keeta_rank_template",
    sortOrder: 10,
    showInInvoices: false,
    affectsRank: true,
    affectsInvoices: false,
  },
  {
    key: "keeta_period_report_template",
    importType: KEETA_PERIOD_REPORT_TEMPLATE,
    nameAr: "قالب تقرير Keeta حسب الفترة",
    nameEn: "Keeta Period Report Template",
    route: "/projects/keeta/imports?type=keeta_period_report_template",
    sortOrder: 20,
    showInInvoices: false,
    affectsRank: false,
    affectsInvoices: false,
  },
  {
    key: "keeta_driver_invoice_template",
    importType: KEETA_DRIVER_INVOICE_TEMPLATE,
    nameAr: "قالب فاتورة مناديب Keeta",
    nameEn: "Keeta Driver Invoice Template",
    route: "/projects/keeta/invoices?type=keeta_driver_invoice_template",
    sortOrder: 30,
    showInInvoices: true,
    affectsRank: false,
    affectsInvoices: true,
  },
] as const;

function normalizeAppKey(value: string) {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function isKeetaApplication(value: string) {
  return normalizeAppKey(value).includes("keeta");
}

export function isKeetaTemplateType(importType: string) {
  return [KEETA_RANK_TEMPLATE, KEETA_PERIOD_REPORT_TEMPLATE, KEETA_DRIVER_INVOICE_TEMPLATE].includes(importType);
}

export function normalizeKeetaImportType(importType: string) {
  if (importType === "keeta_rank") return KEETA_RANK_TEMPLATE;
  if (importType === "keeta_invoice") return KEETA_PERIOD_REPORT_TEMPLATE;
  return importType;
}

export async function resolveKeetaApplicationProject() {
  const existing = await prisma.applicationProject.findFirst({
    where: {
      OR: [
        { application: { OR: [{ code: { contains: "KEETA", mode: "insensitive" } }, { name: { contains: "Keeta", mode: "insensitive" } }] } },
        { code: { contains: "KEETA", mode: "insensitive" } },
        { name: { contains: "Keeta", mode: "insensitive" } },
        { project: { OR: [{ appName: { contains: "Keeta", mode: "insensitive" } }, { name: { contains: "Keeta", mode: "insensitive" } }] } },
      ],
    },
    include: { application: true, city: true, project: true },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;

  const legacy = await prisma.project.findFirst({
    where: { OR: [{ appName: { contains: "Keeta", mode: "insensitive" } }, { name: { contains: "Keeta", mode: "insensitive" } }] },
    include: { city: true },
    orderBy: { createdAt: "asc" },
  });
  const application = await prisma.application.upsert({
    where: { code: "KEETA" },
    update: { name: "Keeta", status: RecordStatus.ACTIVE },
    create: { code: "KEETA", name: "Keeta", status: RecordStatus.ACTIVE },
  });
  return prisma.applicationProject.upsert({
    where: { code: "KEETA" },
    update: {
      applicationId: application.id,
      projectId: legacy?.id ?? null,
      cityId: legacy?.cityId ?? null,
      name: legacy?.name ?? "Keeta",
      status: legacy?.status ?? RecordStatus.ACTIVE,
    },
    create: {
      applicationId: application.id,
      projectId: legacy?.id ?? null,
      cityId: legacy?.cityId ?? null,
      code: "KEETA",
      name: legacy?.name ?? "Keeta",
      status: legacy?.status ?? RecordStatus.ACTIVE,
    },
    include: { application: true, city: true, project: true },
  });
}

export async function ensureDefaultTemplateConfigs() {
  const keetaProject = await resolveKeetaApplicationProject();
  const rows = [];

  for (const item of KEETA_TEMPLATE_KEYS) {
    const definition = getBuiltinTemplate(item.importType);
    const row = await prisma.templateConfig.upsert({
      where: { key: item.key },
      update: {
        nameAr: item.nameAr,
        nameEn: item.nameEn,
        projectId: "keeta",
        applicationId: keetaProject.applicationId,
        applicationProjectId: keetaProject.id,
        scope: "project",
        importType: item.importType,
        enabled: true,
        showInGlobalImports: false,
        showInProjectImports: true,
        showInInvoices: item.showInInvoices,
        showInPayroll: true,
        showInReports: true,
        showInManagementReports: true,
        showInApplicationCenter: true,
        affectsPayroll: true,
        affectsInvoices: item.affectsInvoices,
        affectsReports: true,
        affectsRank: item.affectsRank,
        allowedRoles: jsonInput(["Admin", "Operation Manager", "Supervisor"]),
        requiredColumns: jsonInput(definition?.requiredColumns ?? []),
        optionalColumns: jsonInput(definition?.optionalColumns ?? []),
        matchingKeys: jsonInput(["courierId", "appUserId", "applicationAccountId", "driverCode", "nationalId"]),
        route: item.route,
        sortOrder: item.sortOrder,
      },
      create: {
        key: item.key,
        nameAr: item.nameAr,
        nameEn: item.nameEn,
        projectId: "keeta",
        applicationId: keetaProject.applicationId,
        applicationProjectId: keetaProject.id,
        scope: "project",
        importType: item.importType,
        enabled: true,
        showInGlobalImports: false,
        showInProjectImports: true,
        showInInvoices: item.showInInvoices,
        showInPayroll: true,
        showInReports: true,
        showInManagementReports: true,
        showInApplicationCenter: true,
        affectsPayroll: true,
        affectsInvoices: item.affectsInvoices,
        affectsReports: true,
        affectsRank: item.affectsRank,
        allowedRoles: jsonInput(["Admin", "Operation Manager", "Supervisor"]),
        requiredColumns: jsonInput(definition?.requiredColumns ?? []),
        optionalColumns: jsonInput(definition?.optionalColumns ?? []),
        matchingKeys: jsonInput(["courierId", "appUserId", "applicationAccountId", "driverCode", "nationalId"]),
        route: item.route,
        sortOrder: item.sortOrder,
      },
    });
    rows.push(row);
  }

  return rows;
}

export async function getTemplateConfigs(filters: {
  applicationProjectId?: string;
  applicationName?: string;
  visibility?: TemplateVisibility;
  includeDisabled?: boolean;
} = {}) {
  await ensureDefaultTemplateConfigs();

  const visibilityWhere: Prisma.TemplateConfigWhereInput = (() => {
    switch (filters.visibility) {
      case "globalImports":
        return { showInGlobalImports: true };
      case "invoices":
        return { showInInvoices: true };
      case "payroll":
        return { showInPayroll: true };
      case "reports":
        return { showInReports: true };
      case "managementReports":
        return { showInManagementReports: true };
      case "applicationCenter":
        return { showInApplicationCenter: true };
      case "projectImports":
      default:
        return { showInProjectImports: true };
    }
  })();

  const projectWhere: Prisma.TemplateConfigWhereInput[] = [];
  if (filters.applicationProjectId) projectWhere.push({ applicationProjectId: filters.applicationProjectId });
  if (filters.applicationName && isKeetaApplication(filters.applicationName)) projectWhere.push({ projectId: "keeta" });

  return prisma.templateConfig.findMany({
    where: {
      ...(filters.includeDisabled ? {} : { enabled: true }),
      ...visibilityWhere,
      ...(projectWhere.length ? { OR: projectWhere } : {}),
    },
    include: {
      application: { select: { id: true, code: true, name: true } },
      applicationProject: { select: { id: true, code: true, name: true, applicationId: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
  });
}

export function rowFromTemplateConfig(config: Awaited<ReturnType<typeof getTemplateConfigs>>[number]): ImportTemplateRow {
  const definition = getBuiltinTemplate(config.importType);
  const base = definition ? templateFromDefinition(definition) : null;
  return {
    id: `builtin:${config.importType}`,
    source: "builtin",
    name: config.nameEn,
    fileType: config.importType,
    category: base?.category ?? "applications",
    applicationId: config.applicationId ?? "",
    applicationName: config.application?.name ?? base?.applicationName ?? "-",
    applicationProjectId: config.applicationProjectId ?? "",
    projectName: config.applicationProject?.name ?? "كل مشاريع Keeta",
    requiredColumnsCount: Array.isArray(config.requiredColumns) ? config.requiredColumns.length : base?.requiredColumnsCount ?? 0,
    optionalColumnsCount: Array.isArray(config.optionalColumns) ? config.optionalColumns.length : base?.optionalColumnsCount ?? 0,
    mappingStatus: "جاهز",
    lastUsedAt: "-",
    status: config.enabled ? "نشط" : "غير نشط",
    requiredColumns: base?.requiredColumns ?? [],
    optionalColumns: base?.optionalColumns ?? [],
    columnMapping: base?.columnMapping ?? [],
  };
}
