import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { moneyValue, normalizeAppKey } from "@/lib/applications/applicationAnalytics";
import { normalizeBonusRules, normalizeCarRentRule, normalizeDeductionRules } from "./calculateSalary";
import { normalizeLevelRules } from "./levels";

export type PayrollSettingFilters = {
  applicationId: string;
  applicationProjectId: string;
  cityId: string;
  status: string;
  contractType: string;
  q: string;
};

export type PayrollSettingRow = {
  id: string;
  name: string;
  applicationId: string;
  applicationName: string;
  applicationCode: string;
  applicationProjectId: string;
  projectName: string;
  cityId: string;
  cityName: string;
  contractType: string;
  basicSalary: string;
  basicSalaryValue: number;
  targetOrders: number | null;
  extraOrderPrice: string;
  extraOrderPriceValue: number;
  levelRulesSummary: string;
  bonusRulesSummary: string;
  deductionRulesSummary: string;
  carRentRuleSummary: string;
  status: string;
  isDefault: boolean;
  needsReview: boolean;
  updatedAt: string;
  levelRules: unknown;
  bonusRules: unknown;
  deductionRules: unknown;
  carRentRule: unknown;
};

export type PayrollSettingsData = {
  databaseStatus: "online" | "offline";
  databaseMessage?: string;
  filters: PayrollSettingFilters;
  summary: {
    total: number;
    active: number;
    keeta: number;
    hungerstation: number;
    talabat: number;
    withoutProject: number;
    defaultRules: number;
    needsReview: number;
  };
  applications: { id: string; code: string; name: string }[];
  projects: { id: string; code: string; name: string; applicationId: string }[];
  cities: { id: string; name: string }[];
  rows: PayrollSettingRow[];
};

type SearchParams = Record<string, string | string[] | undefined>;

function one(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export function resolvePayrollSettingFilters(params: SearchParams): PayrollSettingFilters {
  return {
    applicationId: one(params, "applicationId"),
    applicationProjectId: one(params, "applicationProjectId"),
    cityId: one(params, "cityId"),
    status: one(params, "status"),
    contractType: one(params, "contractType"),
    q: one(params, "q").trim().toLowerCase(),
  };
}

function errorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error ? String((error as { code?: string }).code) : "";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown database error";
}

export function isDatabaseOffline(error: unknown) {
  const code = errorCode(error);
  const message = errorMessage(error);
  return code === "P1001" || code === "P1002" || message.includes("Can't reach database server") || message.includes("ECONNREFUSED");
}

function formatDate(value: unknown) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? "-" : date.toISOString().slice(0, 10);
}

function numberValue(value: unknown) {
  if (typeof value === "object" && value !== null && "toNumber" in value && typeof value.toNumber === "function") return Number(value.toNumber());
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function statusText(status: unknown) {
  const value = String(status ?? "").toUpperCase();
  if (value === "ACTIVE") return "نشط";
  if (value === "INACTIVE") return "غير نشط";
  if (value === "PENDING") return "قيد المراجعة";
  if (value === "APPROVED") return "معتمد";
  if (value === "REJECTED") return "مرفوض";
  if (value === "LOCKED") return "مغلق";
  return String(status ?? "-");
}

function statusValue(value: unknown): "ACTIVE" | "INACTIVE" | "PENDING" | "APPROVED" | "REJECTED" | "LOCKED" {
  const raw = String(value ?? "ACTIVE").toUpperCase();
  if (raw === "INACTIVE" || raw === "PENDING" || raw === "APPROVED" || raw === "REJECTED" || raw === "LOCKED") return raw;
  return "ACTIVE";
}

function json(value: unknown) {
  if (value === undefined || value === "") return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

function nullableString(value: unknown) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function summaryCount(object: Record<string, unknown>) {
  return Object.values(object).filter((value) => {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (Array.isArray(value)) return value.length > 0;
    return false;
  }).length;
}

function levelSummary(levelRules: unknown) {
  const rules = normalizeLevelRules(levelRules);
  return `A ${rules.A.minimumOrders}+ / B ${rules.B.minimumOrders}+ / C`;
}

function bonusSummary(bonusRules: unknown) {
  const rules = normalizeBonusRules(bonusRules);
  const count = summaryCount(rules as unknown as Record<string, unknown>);
  return count ? `${count} قواعد` : "افتراضي";
}

function deductionSummary(deductionRules: unknown) {
  const rules = normalizeDeductionRules(deductionRules);
  const count = summaryCount(rules as unknown as Record<string, unknown>);
  return count ? `${count} قواعد` : "افتراضي";
}

function carRentSummary(carRentRule: unknown) {
  const rule = normalizeCarRentRule(carRentRule);
  if (!rule.enabled) return "غير مفعل";
  return rule.calculateByRentalDays ? `حسب الأيام / ${moneyValue(rule.defaultMonthlyRent)}` : `ثابت / ${moneyValue(rule.defaultMonthlyRent)}`;
}

function contractType(levelRules: unknown) {
  return normalizeLevelRules(levelRules).meta?.contractType ?? "";
}

function isNeedsReview(row: { levelRules: unknown; bonusRules: unknown; deductionRules: unknown; carRentRule: unknown; targetOrders: number | null; basicSalary: unknown }) {
  return !row.targetOrders || numberValue(row.basicSalary) <= 0 || !row.levelRules || !row.bonusRules || !row.deductionRules || !row.carRentRule;
}

function emptyData(filters: PayrollSettingFilters, message?: string): PayrollSettingsData {
  return {
    databaseStatus: message ? "offline" : "online",
    databaseMessage: message,
    filters,
    summary: { total: 0, active: 0, keeta: 0, hungerstation: 0, talabat: 0, withoutProject: 0, defaultRules: 0, needsReview: 0 },
    applications: [],
    projects: [],
    cities: [],
    rows: [],
  };
}

function rowFromSetting(setting: {
  id: string;
  name: string;
  applicationId: string;
  applicationProjectId: string | null;
  cityId: string | null;
  basicSalary: unknown;
  targetOrders: number | null;
  extraOrderPrice: unknown;
  levelRules: unknown;
  bonusRules: unknown;
  deductionRules: unknown;
  carRentRule: unknown;
  status: unknown;
  updatedAt: Date;
  application: { id: string; code: string; name: string };
  applicationProject?: { id: string; code: string; name: string } | null;
  city?: { id: string; nameAr: string; nameEn: string | null } | null;
}): PayrollSettingRow {
  const needsReview = isNeedsReview(setting);
  return {
    id: setting.id,
    name: setting.name,
    applicationId: setting.applicationId,
    applicationName: setting.application.name,
    applicationCode: setting.application.code,
    applicationProjectId: setting.applicationProjectId ?? "",
    projectName: setting.applicationProject?.name ?? "Default",
    cityId: setting.cityId ?? "",
    cityName: setting.city?.nameAr || setting.city?.nameEn || "كل المدن",
    contractType: contractType(setting.levelRules),
    basicSalary: moneyValue(setting.basicSalary),
    basicSalaryValue: numberValue(setting.basicSalary),
    targetOrders: setting.targetOrders,
    extraOrderPrice: moneyValue(setting.extraOrderPrice),
    extraOrderPriceValue: numberValue(setting.extraOrderPrice),
    levelRulesSummary: levelSummary(setting.levelRules),
    bonusRulesSummary: bonusSummary(setting.bonusRules),
    deductionRulesSummary: deductionSummary(setting.deductionRules),
    carRentRuleSummary: carRentSummary(setting.carRentRule),
    status: statusText(setting.status),
    isDefault: !setting.applicationProjectId,
    needsReview,
    updatedAt: formatDate(setting.updatedAt),
    levelRules: setting.levelRules,
    bonusRules: setting.bonusRules,
    deductionRules: setting.deductionRules,
    carRentRule: setting.carRentRule,
  };
}

export async function getPayrollSettingsData(filters: PayrollSettingFilters): Promise<PayrollSettingsData> {
  try {
    const [settings, applications, projects, cities] = await Promise.all([
      prisma.applicationPayrollSetting.findMany({
        include: {
          application: { select: { id: true, code: true, name: true } },
          applicationProject: { select: { id: true, code: true, name: true } },
          city: { select: { id: true, nameAr: true, nameEn: true } },
        },
        orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
      }),
      prisma.application.findMany({ select: { id: true, code: true, name: true }, orderBy: { name: "asc" } }),
      prisma.applicationProject.findMany({ select: { id: true, code: true, name: true, applicationId: true }, orderBy: { name: "asc" } }),
      prisma.city.findMany({ select: { id: true, nameAr: true, nameEn: true }, orderBy: { nameAr: "asc" } }),
    ]);

    let rows = settings.map(rowFromSetting);
    if (filters.applicationId) rows = rows.filter((row) => row.applicationId === filters.applicationId);
    if (filters.applicationProjectId) rows = rows.filter((row) => row.applicationProjectId === filters.applicationProjectId);
    if (filters.cityId) rows = rows.filter((row) => row.cityId === filters.cityId);
    if (filters.status) rows = rows.filter((row) => row.status === statusText(filters.status));
    if (filters.contractType) rows = rows.filter((row) => row.contractType.toLowerCase().includes(filters.contractType.toLowerCase()));
    if (filters.q) rows = rows.filter((row) => `${row.name} ${row.applicationName} ${row.projectName}`.toLowerCase().includes(filters.q));

    return {
      databaseStatus: "online",
      filters,
      applications,
      projects,
      cities: cities.map((city) => ({ id: city.id, name: city.nameAr || city.nameEn || city.id })),
      rows,
      summary: {
        total: rows.length,
        active: rows.filter((row) => row.status === "نشط").length,
        keeta: rows.filter((row) => normalizeAppKey(`${row.applicationCode} ${row.applicationName}`) === "keeta").length,
        hungerstation: rows.filter((row) => normalizeAppKey(`${row.applicationCode} ${row.applicationName}`) === "hungerstation").length,
        talabat: rows.filter((row) => normalizeAppKey(`${row.applicationCode} ${row.applicationName}`) === "talabat").length,
        withoutProject: rows.filter((row) => row.isDefault).length,
        defaultRules: rows.filter((row) => row.isDefault).length,
        needsReview: rows.filter((row) => row.needsReview).length,
      },
    };
  } catch (error) {
    if (isDatabaseOffline(error)) return emptyData(filters, "قاعدة البيانات غير متصلة. يرجى تشغيل PostgreSQL ثم تحديث الصفحة.");
    throw error;
  }
}

export function normalizePayrollSettingPayload(body: Record<string, unknown>): Prisma.ApplicationPayrollSettingUncheckedCreateInput {
  const name = String(body.name ?? "").trim();
  const applicationId = String(body.applicationId ?? "").trim();
  if (!name || !applicationId) throw new Error("اسم الإعداد والتطبيق مطلوبان.");

  return {
    name,
    applicationId,
    applicationProjectId: nullableString(body.applicationProjectId),
    cityId: nullableString(body.cityId),
    basicSalary: new Prisma.Decimal(numberValue(body.basicSalary)),
    targetOrders: body.targetOrders === "" || body.targetOrders === undefined ? null : numberValue(body.targetOrders),
    extraOrderPrice: new Prisma.Decimal(numberValue(body.extraOrderPrice)),
    levelRules: json(body.levelRules),
    bonusRules: json(body.bonusRules),
    deductionRules: json(body.deductionRules),
    carRentRule: json(body.carRentRule),
    status: statusValue(body.status),
  };
}

export async function assertNoDuplicatePayrollSetting(payload: { id?: string; applicationId: string; applicationProjectId?: string | null; cityId?: string | null }) {
  const existing = await prisma.applicationPayrollSetting.findFirst({
    where: {
      applicationId: payload.applicationId,
      applicationProjectId: payload.applicationProjectId ?? null,
      cityId: payload.cityId ?? null,
      ...(payload.id ? { id: { not: payload.id } } : {}),
    },
    select: { id: true, name: true },
  });
  if (existing) throw new Error(`يوجد إعداد مسير لنفس التطبيق/المشروع/المدينة بالفعل: ${existing.name}`);
}

export async function copyPayrollSetting(args: {
  sourceSettingId?: string;
  sourceApplicationId?: string;
  sourceApplicationProjectId?: string | null;
  targetApplicationId: string;
  targetApplicationProjectId?: string | null;
  cityId?: string | null;
  name: string;
}) {
  const source = args.sourceSettingId
    ? await prisma.applicationPayrollSetting.findUnique({ where: { id: args.sourceSettingId } })
    : await prisma.applicationPayrollSetting.findFirst({
        where: {
          applicationId: args.sourceApplicationId,
          applicationProjectId: args.sourceApplicationProjectId ?? null,
        },
        orderBy: { updatedAt: "desc" },
      });

  if (!source) throw new Error("لم يتم العثور على إعداد المصدر.");
  await assertNoDuplicatePayrollSetting({
    applicationId: args.targetApplicationId,
    applicationProjectId: args.targetApplicationProjectId ?? null,
    cityId: args.cityId ?? null,
  });

  return prisma.applicationPayrollSetting.create({
    data: {
      name: args.name,
      applicationId: args.targetApplicationId,
      applicationProjectId: args.targetApplicationProjectId ?? null,
      cityId: args.cityId ?? null,
      basicSalary: source.basicSalary,
      targetOrders: source.targetOrders,
      extraOrderPrice: source.extraOrderPrice,
      levelRules: source.levelRules === null ? Prisma.JsonNull : (source.levelRules as Prisma.InputJsonValue),
      bonusRules: source.bonusRules === null ? Prisma.JsonNull : (source.bonusRules as Prisma.InputJsonValue),
      deductionRules: source.deductionRules === null ? Prisma.JsonNull : (source.deductionRules as Prisma.InputJsonValue),
      carRentRule: source.carRentRule === null ? Prisma.JsonNull : (source.carRentRule as Prisma.InputJsonValue),
      status: source.status,
    },
  });
}

