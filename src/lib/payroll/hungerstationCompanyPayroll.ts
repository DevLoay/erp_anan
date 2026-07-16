import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type HungerStationPayrollDecisionType = "AUTO" | "LOW" | "SPECIAL" | "EXCLUDED";

export type HungerStationPayrollDecision = {
  decision: HungerStationPayrollDecisionType;
  riderId: string;
  month: string;
  specialOrderRate?: number;
  specialKmRate?: number;
  notes?: string;
  updatedAt?: string;
};

export type HungerStationPayrollAdjustment = {
  rowKey: string;
  riderId: string;
  month: string;
  grossSalaryOverride?: number;
  adminDeduction?: number;
  carryoverDeduction?: number;
  housingDeduction?: number;
  trafficViolationDeduction?: number;
  fuelDeduction?: number;
  advanceDeduction?: number;
  simDeduction?: number;
  vehicleDamageDeduction?: number;
  accidentLiabilityDeduction?: number;
  userDeduction?: number;
  vehicleCarryoverDeduction?: number;
  carRentDeduction?: number;
  vehicleRentDays?: number;
  kafalaDeduction?: number;
  notes?: string;
  updatedAt?: string;
};

export type HungerStationCompanyPayrollInput = {
  month: string;
  projectCode?: string;
  applicationProjectId?: string;
};

export type HungerStationCompanyPayrollRow = {
  rowKey: string;
  riderId: string;
  project: string;
  city: string;
  applicationProjectId: string | null;
  applicationAccountId: string | null;
  actualDriverId: string;
  account: string;
  accountName: string;
  driver: string;
  actualDriverName: string;
  driverCode: string;
  vehicleId: string | null;
  vehicle: string;
  vehicleOwnershipType: string;
  contractType: string;
  isFreelancer: boolean;
  isPersonalCar: boolean;
  from: string;
  to: string;
  usageType: string;
  tier: "HIGH" | "LOW" | "SPECIAL";
  decision: HungerStationPayrollDecisionType;
  invoiceOrderRate: number;
  usageDays: number;
  ratio: number;
  orders: number;
  km: number;
  companyCollected: number;
  appDeductions: number;
  collectedAfterDeductions: number;
  driverOrderRate: number;
  driverKmRate: number;
  orderSalary: number;
  kmSalary: number;
  calculatedGrossSalary: number;
  grossSalary: number;
  salaryAdjustment: number;
  noShowDeduction: number;
  stackingDeduction: number;
  declinedDeduction: number;
  missedDaysDeduction: number;
  walletDeduction: number;
  otherHungerDeduction: number;
  adminDeduction: number;
  carryoverDeduction: number;
  housingDeduction: number;
  trafficViolationDeduction: number;
  fuelDeduction: number;
  advanceDeduction: number;
  simDeduction: number;
  vehicleDamageDeduction: number;
  accidentLiabilityDeduction: number;
  userDeduction: number;
  autoUserDeduction: number;
  vehicleCarryoverDeduction: number;
  carRentDeduction: number;
  vehicleRentDays: number;
  kafalaDeduction: number;
  internalDeductions: number;
  totalDeductions: number;
  netSalary: number;
  companyProfit: number;
  negativeBalance: number;
  notes: string;
  adjustmentNotes: string;
  invoiceBasicPayment: number;
  invoiceDistancePayment: number;
  invoiceCityPayment: number;
  invoiceRiderBalance: number;
};

export type HungerStationCompanyPayrollBlocked = {
  riderId: string;
  account?: string;
  project?: string;
  reason: string;
  message: string;
  orderRate?: number;
  decision?: HungerStationPayrollDecisionType;
};

export type HungerStationCompanyPayrollSummary = {
  rows: number;
  invoiceRecords: number;
  accountIds: number;
  approvedUsages: number;
  sharedAccounts: number;
  collected: number;
  appDeductions: number;
  collectedAfterDeductions: number;
  grossSalary: number;
  internalDeductions: number;
  deductions: number;
  netSalary: number;
  profit: number;
  negatives: number;
  blocked: number;
  tierCounts: Record<"HIGH" | "LOW" | "SPECIAL", number>;
};

export type HungerStationCompanyPayrollPreview = {
  ok: true;
  month: string;
  filter: {
    application: "HungerStation";
    projectCode?: string;
    applicationProjectId?: string;
  };
  projects: Array<{ id: string; code: string; name: string }>;
  rows: HungerStationCompanyPayrollRow[];
  blocked: HungerStationCompanyPayrollBlocked[];
  summary: HungerStationCompanyPayrollSummary;
};

const SETTINGS = {
  normalDriverOrderRate: 8,
  normalDriverKmRate: 0.75,
  lowDriverOrderRate: 5,
  lowDriverKmRate: 0.5,
  companyKmRateFromInvoice: 1.25,
  highInvoiceOrderRate: 9.65,
  freelancerUserDeduction: 200,
  personalCarUserDeduction: 300,
};

const DECISION_KEY_PREFIX = "hungerstation.payrollDecision";
const ADJUSTMENT_KEY_PREFIX = "hungerstation.payrollAdjustment";

function decisionKey(month: string, riderId: string) {
  return `${DECISION_KEY_PREFIX}.${month}.${riderId}`;
}

function adjustmentKey(month: string, rowKey: string) {
  return `${ADJUSTMENT_KEY_PREFIX}.${month}.${rowKey}`;
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function n(value: unknown) {
  if (typeof value === "object" && value) {
    const decimalLike = value as { toNumber?: () => number };
    if (typeof decimalLike.toNumber === "function") return Number(decimalLike.toNumber()) || 0;
  }
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function money(value: unknown) {
  return Number(n(value).toFixed(2));
}

function qty(value: unknown) {
  return Number(n(value).toFixed(4));
}

function abs(value: unknown) {
  return Math.abs(n(value));
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function normal(value: unknown) {
  return clean(value).toLowerCase().replace(/[\s_\-]+/g, "");
}

function isFreelancer(contractType: unknown, sponsorshipType?: unknown) {
  const text = `${clean(contractType)} ${clean(sponsorshipType)}`.toLowerCase();
  const key = normal(text);
  return key.includes("freelance") || key.includes("freelancer") || text.includes("فريلانسر") || text.includes("فري لانس") || text.includes("حر");
}

function isPersonalCar(vehicleOwnershipType: unknown) {
  const key = normal(vehicleOwnershipType);
  return key.includes("personalcar") || key.includes("personal") || key.includes("private") || key.includes("own") || clean(vehicleOwnershipType).includes("شخص");
}

function monthBounds(month: string) {
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  return {
    start: new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0)),
    end: new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999)),
  };
}

function dateOnly(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : "";
}

function daysInclusive(from: Date | null | undefined, to: Date | null | undefined, month: string) {
  const bounds = monthBounds(month);
  const start = from && from > bounds.start ? from : bounds.start;
  const end = to && to < bounds.end ? to : bounds.end;
  return Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1);
}

function rowKey(parts: { riderId: string; actualDriverId: string; from: string; to: string }) {
  return [parts.riderId, parts.actualDriverId, parts.from || "from", parts.to || "to"].map((part) => clean(part).replace(/[^a-zA-Z0-9_-]/g, "-")).join("__");
}

function classifyInvoiceTier(record: { completedOrders: unknown; basicPayment: unknown }, decision?: HungerStationPayrollDecision) {
  if (decision?.decision === "SPECIAL") {
    return {
      tier: "SPECIAL" as const,
      decision: "SPECIAL" as const,
      orderRate: Number(decision.specialOrderRate || SETTINGS.lowDriverOrderRate),
      kmRate: Number(decision.specialKmRate || SETTINGS.lowDriverKmRate),
    };
  }

  if (decision?.decision === "LOW") {
    return {
      tier: "LOW" as const,
      decision: "LOW" as const,
      orderRate: SETTINGS.lowDriverOrderRate,
      kmRate: SETTINGS.lowDriverKmRate,
    };
  }

  const orders = n(record.completedOrders);
  const invoiceRate = orders > 0 ? n(record.basicPayment) / orders : 0;

  if (invoiceRate >= SETTINGS.highInvoiceOrderRate) {
    return {
      tier: "HIGH" as const,
      decision: "AUTO" as const,
      orderRate: SETTINGS.normalDriverOrderRate,
      kmRate: SETTINGS.normalDriverKmRate,
    };
  }

  if (invoiceRate > 0) {
    return {
      tier: "LOW" as const,
      decision: "AUTO" as const,
      orderRate: SETTINGS.lowDriverOrderRate,
      kmRate: SETTINGS.lowDriverKmRate,
    };
  }

  return null;
}

function appDeductionBreakdown(record: {
  acceptanceRatePenalties: unknown;
  contactRatePenalties: unknown;
  stackingDeduction: unknown;
  declinedPenaltiesDayLogic: unknown;
  latePenalty: unknown;
  noShowPenalty: unknown;
  noShowPenaltySpecialCities: unknown;
  dailyAcceptanceRatePenalty: unknown;
  missedDaysPenalty: unknown;
  riderBalance: unknown;
}, ratio: number) {
  const acceptance = abs(record.acceptanceRatePenalties) * ratio;
  const contact = abs(record.contactRatePenalties) * ratio;
  const stacking = abs(record.stackingDeduction) * ratio;
  const declined = abs(record.declinedPenaltiesDayLogic) * ratio;
  const late = abs(record.latePenalty) * ratio;
  const noShow = abs(record.noShowPenalty) * ratio;
  const noShowSpecial = abs(record.noShowPenaltySpecialCities) * ratio;
  const dailyAcceptance = abs(record.dailyAcceptanceRatePenalty) * ratio;
  const missedDays = abs(record.missedDaysPenalty) * ratio;
  const riderBalance = abs(record.riderBalance) * ratio;
  const otherHunger = acceptance + contact + late + dailyAcceptance;

  return {
    otherHungerDeduction: money(otherHunger),
    stackingDeduction: money(stacking),
    declinedDeduction: money(declined),
    noShowDeduction: money(noShow + noShowSpecial),
    missedDaysDeduction: money(missedDays),
    walletDeduction: money(riderBalance),
    total: money(otherHunger + stacking + declined + noShow + noShowSpecial + missedDays + riderBalance),
  };
}

function accountIdLabel(account: { appUserId: string | null; appUsername: string | null; username: string } | null | undefined, riderId: string) {
  return account?.appUserId || riderId;
}

function accountNameLabel(account: { appUserId: string | null; appUsername: string | null; username: string } | null | undefined, riderId: string) {
  return account?.appUsername || account?.username || account?.appUserId || riderId;
}

function cityLabel(city?: { nameAr: string; nameEn: string | null } | null) {
  return city?.nameAr || city?.nameEn || "-";
}

function vehiclePlate(vehicle?: { plateArabic?: string | null; plateAr?: string | null; plateEnglish?: string | null; plateEn?: string | null } | null) {
  return vehicle?.plateArabic || vehicle?.plateAr || vehicle?.plateEnglish || vehicle?.plateEn || "-";
}

function parseDecision(value: unknown): HungerStationPayrollDecision | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Partial<HungerStationPayrollDecision>;
  if (!data.riderId || !data.month || !data.decision) return null;
  if (!["AUTO", "LOW", "SPECIAL", "EXCLUDED"].includes(data.decision)) return null;
  return {
    riderId: String(data.riderId),
    month: String(data.month),
    decision: data.decision,
    specialOrderRate: data.specialOrderRate == null ? undefined : Number(data.specialOrderRate),
    specialKmRate: data.specialKmRate == null ? undefined : Number(data.specialKmRate),
    notes: data.notes ? String(data.notes) : undefined,
    updatedAt: data.updatedAt ? String(data.updatedAt) : undefined,
  };
}

function parseAdjustment(value: unknown): HungerStationPayrollAdjustment | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Partial<HungerStationPayrollAdjustment>;
  if (!data.rowKey || !data.month || !data.riderId) return null;
  const numberField = (field: keyof HungerStationPayrollAdjustment) => (data[field] == null || data[field] === "" ? undefined : Number(data[field]));
  return {
    rowKey: String(data.rowKey),
    riderId: String(data.riderId),
    month: String(data.month),
    grossSalaryOverride: numberField("grossSalaryOverride"),
    adminDeduction: numberField("adminDeduction"),
    carryoverDeduction: numberField("carryoverDeduction"),
    housingDeduction: numberField("housingDeduction"),
    trafficViolationDeduction: numberField("trafficViolationDeduction"),
    fuelDeduction: numberField("fuelDeduction"),
    advanceDeduction: numberField("advanceDeduction"),
    simDeduction: numberField("simDeduction"),
    vehicleDamageDeduction: numberField("vehicleDamageDeduction"),
    accidentLiabilityDeduction: numberField("accidentLiabilityDeduction"),
    userDeduction: numberField("userDeduction"),
    vehicleCarryoverDeduction: numberField("vehicleCarryoverDeduction"),
    carRentDeduction: numberField("carRentDeduction"),
    vehicleRentDays: numberField("vehicleRentDays"),
    kafalaDeduction: numberField("kafalaDeduction"),
    notes: data.notes ? String(data.notes) : undefined,
    updatedAt: data.updatedAt ? String(data.updatedAt) : undefined,
  };
}

export async function getHungerStationPayrollDecisions(month: string) {
  const settings = await prisma.systemSetting.findMany({
    where: { key: { startsWith: `${DECISION_KEY_PREFIX}.${month}.` } },
    select: { value: true },
  });

  const map = new Map<string, HungerStationPayrollDecision>();
  for (const setting of settings) {
    const decision = parseDecision(setting.value);
    if (decision) map.set(decision.riderId, decision);
  }
  return map;
}

export async function getHungerStationPayrollAdjustments(month: string) {
  const settings = await prisma.systemSetting.findMany({
    where: { key: { startsWith: `${ADJUSTMENT_KEY_PREFIX}.${month}.` } },
    select: { value: true },
  });

  const map = new Map<string, HungerStationPayrollAdjustment>();
  for (const setting of settings) {
    const adjustment = parseAdjustment(setting.value);
    if (adjustment) map.set(adjustment.rowKey, adjustment);
  }
  return map;
}

export async function saveHungerStationPayrollDecision(input: {
  month: string;
  riderId: string;
  decision: HungerStationPayrollDecisionType;
  specialOrderRate?: number;
  specialKmRate?: number;
  notes?: string;
}) {
  const month = input.month.trim();
  const riderId = input.riderId.trim();
  const decision = input.decision;

  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Invalid month");
  if (!riderId) throw new Error("Missing riderId");
  if (!["AUTO", "LOW", "SPECIAL", "EXCLUDED"].includes(decision)) throw new Error("Invalid decision");

  const value: HungerStationPayrollDecision = {
    month,
    riderId,
    decision,
    specialOrderRate: decision === "SPECIAL" ? Number(input.specialOrderRate || SETTINGS.lowDriverOrderRate) : undefined,
    specialKmRate: decision === "SPECIAL" ? Number(input.specialKmRate || SETTINGS.lowDriverKmRate) : undefined,
    notes: input.notes || undefined,
    updatedAt: new Date().toISOString(),
  };

  await prisma.systemSetting.upsert({
    where: { key: decisionKey(month, riderId) },
    update: { value: toPrismaJson(value), updatedBy: "Admin" },
    create: { key: decisionKey(month, riderId), value: toPrismaJson(value), updatedBy: "Admin" },
  });

  await prisma.auditLog.create({
    data: {
      user: "Admin",
      action: "HUNGERSTATION_PAYROLL_DECISION",
      entityType: "HungerStationPayrollDecision",
      entityId: `${month}:${riderId}`,
      newValue: toPrismaJson(value),
    },
  });

  return value;
}

export async function saveHungerStationPayrollAdjustment(input: HungerStationPayrollAdjustment) {
  const month = input.month.trim();
  const riderId = input.riderId.trim();
  const rowKey = input.rowKey.trim();

  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Invalid month");
  if (!riderId) throw new Error("Missing riderId");
  if (!rowKey) throw new Error("Missing rowKey");

  const value: HungerStationPayrollAdjustment = {
    ...input,
    month,
    riderId,
    rowKey,
    updatedAt: new Date().toISOString(),
  };

  await prisma.systemSetting.upsert({
    where: { key: adjustmentKey(month, rowKey) },
    update: { value: toPrismaJson(value), updatedBy: "Admin" },
    create: { key: adjustmentKey(month, rowKey), value: toPrismaJson(value), updatedBy: "Admin" },
  });

  await prisma.auditLog.create({
    data: {
      user: "Admin",
      action: "HUNGERSTATION_PAYROLL_ADJUSTMENT",
      entityType: "HungerStationPayrollAdjustment",
      entityId: `${month}:${rowKey}`,
      newValue: toPrismaJson(value),
    },
  });

  return value;
}

function addToMap(map: Map<string, number>, driverId: string, amount: unknown) {
  map.set(driverId, money((map.get(driverId) ?? 0) + n(amount)));
}

function deductionBucket(type: unknown) {
  const text = clean(type).toLowerCase();
  const key = normal(type);
  if (key.includes("admin") || text.includes("اداري") || text.includes("إداري")) return "adminDeduction";
  if (key.includes("carry") || text.includes("مرحل")) return "carryoverDeduction";
  if (key.includes("housing") || text.includes("سكن")) return "housingDeduction";
  if (key.includes("fuel") || text.includes("بنزين")) return "fuelDeduction";
  if (key.includes("sim") || key.includes("chip") || text.includes("شريحه") || text.includes("شريحة")) return "simDeduction";
  if (key.includes("vehicledamage") || text.includes("تلفيات")) return "vehicleDamageDeduction";
  if (key.includes("accident") || text.includes("حادث")) return "accidentLiabilityDeduction";
  if (key.includes("user") || text.includes("يوزر")) return "userDeduction";
  if (key.includes("vehiclecarry") || text.includes("مرحل سيارات")) return "vehicleCarryoverDeduction";
  if (key.includes("rent") || text.includes("ايجار") || text.includes("إيجار")) return "carRentDeduction";
  if (key.includes("kafala") || text.includes("كفالة") || text.includes("كفاله")) return "kafalaDeduction";
  return "adminDeduction";
}

async function loadInternalDeductions(month: string, driverIds: string[]) {
  const maps = {
    adminDeduction: new Map<string, number>(),
    carryoverDeduction: new Map<string, number>(),
    housingDeduction: new Map<string, number>(),
    trafficViolationDeduction: new Map<string, number>(),
    fuelDeduction: new Map<string, number>(),
    advanceDeduction: new Map<string, number>(),
    simDeduction: new Map<string, number>(),
    vehicleDamageDeduction: new Map<string, number>(),
    accidentLiabilityDeduction: new Map<string, number>(),
    userDeduction: new Map<string, number>(),
    vehicleCarryoverDeduction: new Map<string, number>(),
    carRentDeduction: new Map<string, number>(),
    kafalaDeduction: new Map<string, number>(),
  };

  if (!driverIds.length) return maps;

  const bounds = monthBounds(month);
  const [advances, deductions, violations, fuelRecords] = await Promise.all([
    prisma.advance.findMany({
      where: { driverId: { in: driverIds }, deductionMonth: month, status: "APPROVED", isDeducted: false },
      select: { driverId: true, amount: true },
    }),
    prisma.deduction.findMany({ where: { driverId: { in: driverIds }, month }, select: { driverId: true, amount: true, type: true } }),
    prisma.violation.findMany({ where: { driverId: { in: driverIds }, occurredAt: { gte: bounds.start, lte: bounds.end } }, select: { driverId: true, amount: true } }),
    prisma.fuelRecord.findMany({ where: { driverId: { in: driverIds }, fuelDate: { gte: bounds.start, lte: bounds.end } }, select: { driverId: true, amount: true } }),
  ]);

  for (const advance of advances) addToMap(maps.advanceDeduction, advance.driverId, advance.amount);
  for (const violation of violations) addToMap(maps.trafficViolationDeduction, violation.driverId, violation.amount);
  for (const fuel of fuelRecords) addToMap(maps.fuelDeduction, fuel.driverId, fuel.amount);
  for (const deduction of deductions) {
    const bucket = deductionBucket(deduction.type) as keyof typeof maps;
    addToMap(maps[bucket], deduction.driverId, deduction.amount);
  }

  return maps;
}

function mapValue(map: Map<string, number>, driverId: string) {
  return money(map.get(driverId) ?? 0);
}

function applyNumberOverride(value: number, override: number | undefined) {
  return override == null || Number.isNaN(override) ? value : money(override);
}

export async function getHungerStationCompanyPayrollPreview(input: HungerStationCompanyPayrollInput): Promise<HungerStationCompanyPayrollPreview> {
  const month = input.month || "2026-04";
  const hunger = await prisma.application.findFirst({
    where: { OR: [{ code: "HUNGERSTATION" }, { name: "HungerStation" }] },
    select: { id: true, code: true, name: true },
  });

  if (!hunger) {
    return {
      ok: true,
      month,
      filter: { application: "HungerStation", projectCode: input.projectCode, applicationProjectId: input.applicationProjectId },
      projects: [],
      rows: [],
      blocked: [{ riderId: "-", reason: "APPLICATION_NOT_FOUND", message: "لم يتم العثور على تطبيق HungerStation." }],
      summary: emptySummary(1),
    };
  }

  const projects = await prisma.applicationProject.findMany({
    where: { applicationId: hunger.id, status: "ACTIVE" },
    select: { id: true, code: true, name: true },
    orderBy: { code: "asc" },
  });

  const projectFilter = input.applicationProjectId
    ? { applicationProjectId: input.applicationProjectId }
    : input.projectCode
      ? { applicationProject: { code: input.projectCode } }
      : {};

  const invoices = await prisma.hungerStationInvoiceRecord.findMany({
    where: {
      month,
      applicationId: hunger.id,
      ...projectFilter,
    },
    include: {
      city: { select: { nameAr: true, nameEn: true } },
      applicationProject: { select: { id: true, name: true, code: true, city: { select: { nameAr: true, nameEn: true } } } },
      applicationAccount: { select: { id: true, appUserId: true, appUsername: true, username: true } },
    },
    orderBy: { riderIdFromFile: "asc" },
  });

  const decisions = await getHungerStationPayrollDecisions(month);
  const adjustments = await getHungerStationPayrollAdjustments(month);
  const accountIds = [...new Set(invoices.map((invoice) => invoice.applicationAccountId).filter((id): id is string => Boolean(id)))];

  const usages = accountIds.length
    ? await prisma.accountUsage.findMany({
        where: {
          month,
          applicationAccountId: { in: accountIds },
          status: { in: ["APPROVED", "Approved", "approved", "LOCKED", "Locked", "locked"] },
        },
        include: {
          city: { select: { nameAr: true, nameEn: true } },
          applicationProject: { select: { name: true, city: { select: { nameAr: true, nameEn: true } } } },
          actualDriver: {
            select: {
              id: true,
              name: true,
              actualName: true,
              driverCode: true,
              internalCode: true,
              contractType: true,
              sponsorshipType: true,
              vehicleId: true,
              vehicleOwnershipType: true,
              vehicle: { select: { plateArabic: true, plateAr: true, plateEnglish: true, plateEn: true } },
            },
          },
        },
        orderBy: { dateFrom: "asc" },
      })
    : [];

  const driverIds: string[] = [...new Set(usages.map((usage) => usage.actualDriverId).filter((id): id is string => Boolean(id)))];
  const internalMaps = await loadInternalDeductions(month, driverIds);

  const usageByAccount = new Map<string, typeof usages>();
  for (const usage of usages) {
    const list = usageByAccount.get(usage.applicationAccountId) || [];
    list.push(usage);
    usageByAccount.set(usage.applicationAccountId, list);
  }

  const rows: HungerStationCompanyPayrollRow[] = [];
  const blocked: HungerStationCompanyPayrollBlocked[] = [];

  for (const invoice of invoices) {
    const riderId = invoice.riderIdFromFile;
    const account = accountIdLabel(invoice.applicationAccount, riderId);
    const accountName = accountNameLabel(invoice.applicationAccount, riderId);
    const project = invoice.applicationProject?.name || "HungerStation";
    const decision = decisions.get(riderId);

    if (decision?.decision === "EXCLUDED") {
      blocked.push({
        riderId,
        account,
        project,
        reason: "EXCLUDED",
        message: decision.notes || "تم استبعاد الحساب من المسير لهذا الشهر.",
        orderRate: invoice.completedOrders ? money(n(invoice.basicPayment) / n(invoice.completedOrders)) : 0,
        decision: "EXCLUDED",
      });
      continue;
    }

    if (!invoice.applicationAccountId) {
      blocked.push({ riderId, account, project, reason: "NO_APPLICATION_ACCOUNT", message: "الحساب غير موجود في ApplicationAccount." });
      continue;
    }

    const accountUsages = usageByAccount.get(invoice.applicationAccountId) || [];
    const validUsages = accountUsages.filter((usage) => usage.actualDriverId && usage.actualDriver);

    if (!validUsages.length) {
      blocked.push({ riderId, account, project, reason: "NO_APPROVED_USAGE", message: "لا توجد فترة استخدام معتمدة للحساب." });
      continue;
    }

    const tier = classifyInvoiceTier(invoice, decision);
    const invoiceOrderRate = invoice.completedOrders ? n(invoice.basicPayment) / n(invoice.completedOrders) : 0;

    if (!tier) {
      blocked.push({ riderId, account, project, reason: "NO_VALID_ORDER_RATE", message: "لا يوجد سعر طلب صالح في الفاتورة.", orderRate: money(invoiceOrderRate) });
      continue;
    }

    const totalUsageDays = validUsages.reduce((sum, usage) => sum + daysInclusive(usage.dateFrom, usage.dateTo, month), 0) || validUsages.length || 1;
    const totalOrders = n(invoice.completedOrders);
    const totalKm = n(invoice.distancePayment) / SETTINGS.companyKmRateFromInvoice;
    const totalBasic = n(invoice.basicPayment);
    const totalDistance = n(invoice.distancePayment);
    const totalCity = n(invoice.cityPayment);

    let allocatedOrdersSum = 0;
    let allocatedKmSum = 0;
    let allocatedBasicSum = 0;
    let allocatedDistanceSum = 0;
    let allocatedCitySum = 0;
    let allocatedDeductionSum = 0;

    const totalDeductionsForAccount = appDeductionBreakdown(invoice, 1).total;

    for (let index = 0; index < validUsages.length; index += 1) {
      const usage = validUsages[index];
      const usageDays = daysInclusive(usage.dateFrom, usage.dateTo, month);
      const ratio = totalUsageDays ? usageDays / totalUsageDays : 1 / validUsages.length;
      const last = index === validUsages.length - 1;

      const orders = last ? Math.max(0, totalOrders - allocatedOrdersSum) : totalOrders * ratio;
      const km = last ? Math.max(0, totalKm - allocatedKmSum) : totalKm * ratio;
      const invoiceBasicPayment = last ? Math.max(0, totalBasic - allocatedBasicSum) : totalBasic * ratio;
      const invoiceDistancePayment = last ? Math.max(0, totalDistance - allocatedDistanceSum) : totalDistance * ratio;
      const invoiceCityPayment = last ? Math.max(0, totalCity - allocatedCitySum) : totalCity * ratio;
      const appDeductions = appDeductionBreakdown(invoice, ratio);

      if (last) appDeductions.total = money(totalDeductionsForAccount - allocatedDeductionSum);

      allocatedOrdersSum += orders;
      allocatedKmSum += km;
      allocatedBasicSum += invoiceBasicPayment;
      allocatedDistanceSum += invoiceDistancePayment;
      allocatedCitySum += invoiceCityPayment;
      allocatedDeductionSum += appDeductions.total;

      const actualDriver = usage.actualDriver!;
      const actualDriverId = usage.actualDriverId!;
      const from = dateOnly(usage.dateFrom);
      const to = dateOnly(usage.dateTo);
      const key = rowKey({ riderId, actualDriverId, from, to });
      const adjustment = adjustments.get(key);
      const freelance = isFreelancer(actualDriver.contractType, actualDriver.sponsorshipType);
      const personalCar = isPersonalCar(actualDriver.vehicleOwnershipType);
      const autoUserDeduction = money((freelance ? SETTINGS.freelancerUserDeduction : 0) + (personalCar ? SETTINGS.personalCarUserDeduction : 0));

      const companyCollected = invoiceBasicPayment + invoiceDistancePayment + invoiceCityPayment;
      const collectedAfterDeductions = companyCollected - appDeductions.total;
      const orderSalary = orders * tier.orderRate;
      const kmSalary = km * tier.kmRate;
      const calculatedGrossSalary = orderSalary + kmSalary;
      const grossSalary = applyNumberOverride(money(calculatedGrossSalary), adjustment?.grossSalaryOverride);
      const salaryAdjustment = money(grossSalary - calculatedGrossSalary);

      const adminDeduction = applyNumberOverride(mapValue(internalMaps.adminDeduction, actualDriverId), adjustment?.adminDeduction);
      const carryoverDeduction = applyNumberOverride(mapValue(internalMaps.carryoverDeduction, actualDriverId), adjustment?.carryoverDeduction);
      const housingDeduction = applyNumberOverride(mapValue(internalMaps.housingDeduction, actualDriverId), adjustment?.housingDeduction);
      const trafficViolationDeduction = applyNumberOverride(mapValue(internalMaps.trafficViolationDeduction, actualDriverId), adjustment?.trafficViolationDeduction);
      const fuelDeduction = applyNumberOverride(mapValue(internalMaps.fuelDeduction, actualDriverId), adjustment?.fuelDeduction);
      const advanceDeduction = applyNumberOverride(mapValue(internalMaps.advanceDeduction, actualDriverId), adjustment?.advanceDeduction);
      const simDeduction = applyNumberOverride(mapValue(internalMaps.simDeduction, actualDriverId), adjustment?.simDeduction);
      const vehicleDamageDeduction = applyNumberOverride(mapValue(internalMaps.vehicleDamageDeduction, actualDriverId), adjustment?.vehicleDamageDeduction);
      const accidentLiabilityDeduction = applyNumberOverride(mapValue(internalMaps.accidentLiabilityDeduction, actualDriverId), adjustment?.accidentLiabilityDeduction);
      const userDeductionBase = money(mapValue(internalMaps.userDeduction, actualDriverId) + autoUserDeduction);
      const userDeduction = applyNumberOverride(userDeductionBase, adjustment?.userDeduction);
      const vehicleCarryoverDeduction = applyNumberOverride(mapValue(internalMaps.vehicleCarryoverDeduction, actualDriverId), adjustment?.vehicleCarryoverDeduction);
      const carRentDeduction = applyNumberOverride(mapValue(internalMaps.carRentDeduction, actualDriverId), adjustment?.carRentDeduction);
      const vehicleRentDays = applyNumberOverride(0, adjustment?.vehicleRentDays);
      const kafalaDeduction = applyNumberOverride(mapValue(internalMaps.kafalaDeduction, actualDriverId), adjustment?.kafalaDeduction);

      const internalDeductions = money(
        adminDeduction +
          carryoverDeduction +
          housingDeduction +
          trafficViolationDeduction +
          fuelDeduction +
          advanceDeduction +
          simDeduction +
          vehicleDamageDeduction +
          accidentLiabilityDeduction +
          userDeduction +
          vehicleCarryoverDeduction +
          carRentDeduction +
          kafalaDeduction,
      );
      const totalDeductions = money(appDeductions.total + internalDeductions);
      const netSalary = money(grossSalary - totalDeductions);
      const companyProfit = money(collectedAfterDeductions - netSalary);
      const driverCode = actualDriver.driverCode || actualDriver.internalCode || "";
      const driverName = actualDriver.actualName || actualDriver.name || "NO_DRIVER";
      const shared = validUsages.length > 1;
      const baseNotes = [
        tier.tier === "HIGH" ? "أداء عالي من الفاتورة" : tier.tier === "SPECIAL" ? "اعتماد Special" : "أداء منخفض من الفاتورة",
        shared ? "حساب مشترك" : "",
        freelance ? "فريلانسر: يوزر +200" : "",
        personalCar ? "سيارة شخصية: يوزر +300" : "",
        decision?.decision && decision.decision !== "AUTO" ? `قرار يدوي=${decision.decision}` : "",
        salaryAdjustment ? `تعديل راتب=${money(salaryAdjustment)}` : "",
        adjustment?.notes ? `تعديل: ${adjustment.notes}` : "",
        `Invoice rate=${money(invoiceOrderRate)}`,
      ]
        .filter(Boolean)
        .join(" - ");

      rows.push({
        rowKey: key,
        riderId,
        project,
        city: cityLabel(usage.city || usage.applicationProject?.city || invoice.city || invoice.applicationProject?.city),
        applicationProjectId: invoice.applicationProjectId,
        applicationAccountId: invoice.applicationAccountId,
        actualDriverId,
        account,
        accountName,
        driver: accountName,
        actualDriverName: driverName,
        driverCode,
        vehicleId: actualDriver.vehicleId,
        vehicle: vehiclePlate(actualDriver.vehicle),
        vehicleOwnershipType: actualDriver.vehicleOwnershipType || "no_vehicle",
        contractType: actualDriver.contractType || actualDriver.sponsorshipType || "",
        isFreelancer: freelance,
        isPersonalCar: personalCar,
        from,
        to,
        usageType: usage.usageType || (shared ? "SHARED" : "APPROVED"),
        tier: tier.tier,
        decision: tier.decision,
        invoiceOrderRate: money(invoiceOrderRate),
        usageDays,
        ratio: qty(ratio),
        orders: money(orders),
        km: money(km),
        companyCollected: money(companyCollected),
        appDeductions: money(appDeductions.total),
        collectedAfterDeductions: money(collectedAfterDeductions),
        driverOrderRate: tier.orderRate,
        driverKmRate: tier.kmRate,
        orderSalary: money(orderSalary),
        kmSalary: money(kmSalary),
        calculatedGrossSalary: money(calculatedGrossSalary),
        grossSalary: money(grossSalary),
        salaryAdjustment,
        noShowDeduction: appDeductions.noShowDeduction,
        stackingDeduction: appDeductions.stackingDeduction,
        declinedDeduction: appDeductions.declinedDeduction,
        missedDaysDeduction: appDeductions.missedDaysDeduction,
        walletDeduction: appDeductions.walletDeduction,
        otherHungerDeduction: appDeductions.otherHungerDeduction,
        adminDeduction,
        carryoverDeduction,
        housingDeduction,
        trafficViolationDeduction,
        fuelDeduction,
        advanceDeduction,
        simDeduction,
        vehicleDamageDeduction,
        accidentLiabilityDeduction,
        userDeduction,
        autoUserDeduction,
        vehicleCarryoverDeduction,
        carRentDeduction,
        vehicleRentDays: Math.round(vehicleRentDays),
        kafalaDeduction,
        internalDeductions,
        totalDeductions,
        netSalary,
        companyProfit,
        negativeBalance: netSalary < 0 ? money(Math.abs(netSalary)) : 0,
        notes: baseNotes,
        adjustmentNotes: adjustment?.notes || "",
        invoiceBasicPayment: money(invoiceBasicPayment),
        invoiceDistancePayment: money(invoiceDistancePayment),
        invoiceCityPayment: money(invoiceCityPayment),
        invoiceRiderBalance: money(n(invoice.riderBalance) * ratio),
      });
    }
  }

  return {
    ok: true,
    month,
    filter: { application: "HungerStation", projectCode: input.projectCode, applicationProjectId: input.applicationProjectId },
    projects,
    rows,
    blocked,
    summary: buildSummary(rows, blocked, invoices.length, accountIds.length, usages.length),
  };
}

function emptySummary(blocked = 0): HungerStationCompanyPayrollSummary {
  return {
    rows: 0,
    invoiceRecords: 0,
    accountIds: 0,
    approvedUsages: 0,
    sharedAccounts: 0,
    collected: 0,
    appDeductions: 0,
    collectedAfterDeductions: 0,
    grossSalary: 0,
    internalDeductions: 0,
    deductions: 0,
    netSalary: 0,
    profit: 0,
    negatives: 0,
    blocked,
    tierCounts: { HIGH: 0, LOW: 0, SPECIAL: 0 },
  };
}

function buildSummary(
  rows: HungerStationCompanyPayrollRow[],
  blocked: HungerStationCompanyPayrollBlocked[],
  invoiceRecords: number,
  accountIds: number,
  approvedUsages: number,
): HungerStationCompanyPayrollSummary {
  const sharedAccounts = new Set(rows.filter((row) => row.usageType === "SHARED" || row.usageType === "shared").map((row) => row.account)).size;
  const tierCounts = rows.reduce(
    (acc, row) => {
      acc[row.tier] += 1;
      return acc;
    },
    { HIGH: 0, LOW: 0, SPECIAL: 0 },
  );

  return {
    rows: rows.length,
    invoiceRecords,
    accountIds,
    approvedUsages,
    sharedAccounts,
    collected: money(rows.reduce((sum, row) => sum + row.companyCollected, 0)),
    appDeductions: money(rows.reduce((sum, row) => sum + row.appDeductions, 0)),
    collectedAfterDeductions: money(rows.reduce((sum, row) => sum + row.collectedAfterDeductions, 0)),
    grossSalary: money(rows.reduce((sum, row) => sum + row.grossSalary, 0)),
    internalDeductions: money(rows.reduce((sum, row) => sum + row.internalDeductions, 0)),
    deductions: money(rows.reduce((sum, row) => sum + row.totalDeductions, 0)),
    netSalary: money(rows.reduce((sum, row) => sum + row.netSalary, 0)),
    profit: money(rows.reduce((sum, row) => sum + row.companyProfit, 0)),
    negatives: money(rows.reduce((sum, row) => sum + row.negativeBalance, 0)),
    blocked: blocked.length,
    tierCounts,
  };
}

export const HUNGERSTATION_COMPANY_PAYROLL_HEADERS = [
  "الايدى",
  "اسم المندوب",
  "المدينة",
  "اسم المستخدم",
  "السياره",
  "عدد الطلبات",
  "الايام",
  "الكيلومترات",
  "متوسط سعر الطلب",
  "الشريحة",
  "المحصل",
  "خصومات هنجر",
  "المحصل مع المخالفات",
  "سعر الطلب",
  "سعر الكيلو",
  "الراتب بالطلب",
  "الراتب بالكيلو",
  "الإجمالي",
  "الراتب الاجمالي",
  "غرامة عدم الحضور",
  "خصم الطلبات المتعدده",
  "رفض طلبات",
  "غرامه الغياب",
  "المحافظ",
  "خصم اداري",
  "مرحل",
  "سكن",
  "مخالفات مروريه",
  "بنزين",
  "سلفة",
  "شريحه",
  "تلفيات سياره",
  "نسبه تحمل حادث",
  "يوزر",
  "مرحل سيارات",
  "ايجار سياره",
  "ايام السياره",
  "خصومات ك",
  "إجمالي الخصومات",
  "صافي الراتب",
  "السوالب",
  "الفايده",
  "ملاحظات",
  "قرارات",
] as const;

function rowToExport(row: HungerStationCompanyPayrollRow): Record<(typeof HUNGERSTATION_COMPANY_PAYROLL_HEADERS)[number], string | number> {
  return {
    "الايدى": row.riderId,
    "اسم المندوب": row.accountName,
    "المدينة": row.city,
    "اسم المستخدم": row.account,
    "السياره": row.vehicle,
    "عدد الطلبات": row.orders,
    "الايام": row.usageDays,
    "الكيلومترات": row.km,
    "متوسط سعر الطلب": row.invoiceOrderRate,
    "الشريحة": row.tier,
    "المحصل": row.companyCollected,
    "خصومات هنجر": row.appDeductions,
    "المحصل مع المخالفات": row.collectedAfterDeductions,
    "سعر الطلب": row.driverOrderRate,
    "سعر الكيلو": row.driverKmRate,
    "الراتب بالطلب": row.orderSalary,
    "الراتب بالكيلو": row.kmSalary,
    "الإجمالي": row.grossSalary,
    "الراتب الاجمالي": row.grossSalary,
    "غرامة عدم الحضور": row.noShowDeduction,
    "خصم الطلبات المتعدده": row.stackingDeduction,
    "رفض طلبات": row.declinedDeduction,
    "غرامه الغياب": row.missedDaysDeduction,
    "المحافظ": row.walletDeduction,
    "خصم اداري": row.adminDeduction,
    "مرحل": row.carryoverDeduction,
    "سكن": row.housingDeduction,
    "مخالفات مروريه": row.trafficViolationDeduction,
    "بنزين": row.fuelDeduction,
    "سلفة": row.advanceDeduction,
    "شريحه": row.simDeduction,
    "تلفيات سياره": row.vehicleDamageDeduction,
    "نسبه تحمل حادث": row.accidentLiabilityDeduction,
    "يوزر": row.userDeduction,
    "مرحل سيارات": row.vehicleCarryoverDeduction,
    "ايجار سياره": row.carRentDeduction,
    "ايام السياره": row.vehicleRentDays,
    "خصومات ك": row.kafalaDeduction,
    "إجمالي الخصومات": row.totalDeductions,
    "صافي الراتب": row.netSalary,
    "السوالب": row.negativeBalance,
    "الفايده": row.companyProfit,
    "ملاحظات": row.notes,
    "قرارات": row.decision,
  };
}

export function buildHungerStationCompanyPayrollCsv(preview: HungerStationCompanyPayrollPreview) {
  const headers = [...HUNGERSTATION_COMPANY_PAYROLL_HEADERS];
  const rows = preview.rows.map(rowToExport);
  return [headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n");
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes('"') || text.includes("\n")) return `"${text.replace(/"/g, '""')}"`;
  return text;
}
