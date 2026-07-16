import { PayrollStatus, Prisma, RecordStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getHungerStationCompanyPayrollPreview } from "@/lib/payroll/hungerstationCompanyPayroll";

type GenerateHungerStationPayrollInput = {
  month: string;
  cityId?: string;
  applicationProjectId?: string;
  requestedBy?: string;
};

type HungerStationPayrollSettings = {
  companyOrderRate: number;
  companyKmRate: number;
  normalOrderRate: number;
  normalKmRate: number;
  lowOrderRate: number;
  lowKmRate: number;
  highInvoiceOrderRate: number;
  lowInvoiceOrderRate: number;
  invoiceRateTolerance: number;
  requireApprovedUsage: boolean;
};

type DailyRecord = {
  reportDate: Date;
  completedDeliveries: number | null;
  actualWorkingHours: unknown;
  workingDays: unknown;
};

type DraftPayrollRow = {
  warnings: string[];
  values: Omit<Prisma.PayrollItemUncheckedCreateInput, "payrollRunId">;
};

const DEFAULT_SETTINGS: HungerStationPayrollSettings = {
  companyOrderRate: 10,
  companyKmRate: 1.25,
  normalOrderRate: 8,
  normalKmRate: 0.75,
  lowOrderRate: 5,
  lowKmRate: 0.5,
  highInvoiceOrderRate: 9.65,
  lowInvoiceOrderRate: 8,
  invoiceRateTolerance: 0,
  requireApprovedUsage: true,
};

const APPROVED_USAGE_STATUS = ["APPROVED", "Approved", "approved", "LOCKED", "Locked", "locked"];
function numberValue(value: unknown) {
  if (typeof value === "object" && value) {
    const decimalLike = value as { toNumber?: () => number };
    if (typeof decimalLike.toNumber === "function") return Number(decimalLike.toNumber()) || 0;
  }
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function roundQty(value: number) {
  return Math.round(value * 100) / 100;
}

function absMoney(value: unknown) {
  return Math.abs(numberValue(value));
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function appKey(value: unknown) {
  return clean(value).toLowerCase().replace(/[\s_-]+/g, "");
}

function isHungerText(value: unknown) {
  const text = clean(value).toLowerCase();
  const key = appKey(value);
  return key.includes("hungerstation") || key.includes("hunger") || text.includes("هنجر") || text.includes("هنقر");
}

export function isHungerStationPayrollRequest(args: { appName?: string; projectName?: string; projectId?: string }) {
  return isHungerText(`${args.appName ?? ""} ${args.projectName ?? ""} ${args.projectId ?? ""}`) || args.projectId === "hungerstation";
}

function monthParts(month: string) {
  const safeMonth = /^20\d{2}-\d{2}$/.test(month) ? month : new Date().toISOString().slice(0, 7);
  const year = Number(safeMonth.slice(0, 4));
  const monthNumber = Number(safeMonth.slice(5, 7));
  const start = new Date(Date.UTC(year, monthNumber - 1, 1));
  const end = new Date(Date.UTC(year, monthNumber, 0, 23, 59, 59, 999));
  return { safeMonth, year, monthNumber, start, end };
}

function daysInclusive(start: Date, end: Date) {
  const ms = end.getTime() - start.getTime();
  if (ms < 0) return 0;
  return Math.floor(ms / 86_400_000) + 1;
}

function clampPeriod(args: { dateFrom?: Date | null; dateTo?: Date | null; monthStart: Date; monthEnd: Date }) {
  const from = args.dateFrom && args.dateFrom > args.monthStart ? args.dateFrom : args.monthStart;
  const to = args.dateTo && args.dateTo < args.monthEnd ? args.dateTo : args.monthEnd;
  return { from, to, days: daysInclusive(from, to) };
}

function inPeriod(date: Date, from: Date, to: Date) {
  return date.getTime() >= from.getTime() && date.getTime() <= to.getTime();
}

function sumBy<T>(rows: T[], selector: (row: T) => number) {
  return rows.reduce((sum, row) => sum + selector(row), 0);
}

function settingsNumber(source: Record<string, unknown>, key: string, fallback: number) {
  const value = numberValue(source[key]);
  return value > 0 || source[key] === 0 ? value : fallback;
}

function settingsBool(source: Record<string, unknown>, key: string, fallback: boolean) {
  if (typeof source[key] === "boolean") return Boolean(source[key]);
  if (typeof source[key] === "string") return ["true", "yes", "1", "نعم"].includes(String(source[key]).toLowerCase());
  return fallback;
}

async function resolveHungerStationProject(input: GenerateHungerStationPayrollInput) {
  if (input.applicationProjectId) {
    const explicit = await prisma.applicationProject.findFirst({
      where: {
        OR: [{ id: input.applicationProjectId }, { projectId: input.applicationProjectId }],
      },
      include: { application: true, city: true },
    });
    if (explicit && isHungerText(`${explicit.application?.name ?? ""} ${explicit.application?.code ?? ""} ${explicit.name}`)) return explicit;
  }

  return prisma.applicationProject.findFirst({
    where: {
      ...(input.cityId ? { cityId: input.cityId } : {}),
      OR: [
        { name: { contains: "Hunger", mode: "insensitive" } },
        { code: { contains: "HUNGER", mode: "insensitive" } },
        { application: { name: { contains: "Hunger", mode: "insensitive" } } },
        { application: { code: { contains: "HUNGER", mode: "insensitive" } } },
      ],
    },
    include: { application: true, city: true },
    orderBy: { name: "asc" },
  });
}

async function resolveSettings(args: { applicationId: string; applicationProjectId: string; cityId?: string | null }) {
  const row =
    (await prisma.applicationPayrollSetting.findFirst({
      where: {
        applicationId: args.applicationId,
        applicationProjectId: args.applicationProjectId,
        ...(args.cityId ? { OR: [{ cityId: args.cityId }, { cityId: null }] } : {}),
        status: RecordStatus.ACTIVE,
      },
      orderBy: [{ cityId: "desc" }, { updatedAt: "desc" }],
    })) ??
    (await prisma.applicationPayrollSetting.findFirst({
      where: { applicationId: args.applicationId, status: RecordStatus.ACTIVE },
      orderBy: { updatedAt: "desc" },
    }));

  const levelRules = row?.levelRules && typeof row.levelRules === "object" && !Array.isArray(row.levelRules) ? (row.levelRules as Record<string, unknown>) : {};
  const deductionRules = row?.deductionRules && typeof row.deductionRules === "object" && !Array.isArray(row.deductionRules) ? (row.deductionRules as Record<string, unknown>) : {};
  const merged = { ...levelRules, ...deductionRules };

  return {
    row,
    settings: {
      companyOrderRate: settingsNumber(merged, "companyOrderRate", DEFAULT_SETTINGS.companyOrderRate),
      companyKmRate: settingsNumber(merged, "companyKmRate", DEFAULT_SETTINGS.companyKmRate),
      normalOrderRate: settingsNumber(merged, "normalOrderRate", DEFAULT_SETTINGS.normalOrderRate),
      normalKmRate: settingsNumber(merged, "normalKmRate", DEFAULT_SETTINGS.normalKmRate),
      lowOrderRate: settingsNumber(merged, "lowOrderRate", DEFAULT_SETTINGS.lowOrderRate),
      lowKmRate: settingsNumber(merged, "lowKmRate", DEFAULT_SETTINGS.lowKmRate),
      highInvoiceOrderRate: settingsNumber(merged, "highInvoiceOrderRate", DEFAULT_SETTINGS.highInvoiceOrderRate),
      lowInvoiceOrderRate: settingsNumber(merged, "lowInvoiceOrderRate", DEFAULT_SETTINGS.lowInvoiceOrderRate),
      invoiceRateTolerance: settingsNumber(merged, "invoiceRateTolerance", DEFAULT_SETTINGS.invoiceRateTolerance),
      requireApprovedUsage: settingsBool(merged, "requireApprovedUsage", DEFAULT_SETTINGS.requireApprovedUsage),
    } satisfies HungerStationPayrollSettings,
  };
}

function classifyInvoicePerformance(invoiceOrderRate: number, settings: HungerStationPayrollSettings) {
  if (!Number.isFinite(invoiceOrderRate) || invoiceOrderRate <= 0) {
    return { tier: "NEEDS_REVIEW" as const, orderRate: settings.lowOrderRate, kmRate: settings.lowKmRate };
  }

  // HungerStation invoice is the source of truth for performance.
  // Final rule: basic_payment / completed_orders >= 9.65 is HIGH, any positive lower rate is LOW.
  const highRate = DEFAULT_SETTINGS.highInvoiceOrderRate;
  if (invoiceOrderRate >= highRate) {
    return { tier: "HIGH" as const, orderRate: settings.normalOrderRate, kmRate: settings.normalKmRate };
  }

  return { tier: "LOW" as const, orderRate: settings.lowOrderRate, kmRate: settings.lowKmRate };
}

function appDeductionsFromInvoice(invoice: {
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
}) {
  return roundMoney(
    absMoney(invoice.acceptanceRatePenalties) +
      absMoney(invoice.contactRatePenalties) +
      absMoney(invoice.stackingDeduction) +
      absMoney(invoice.declinedPenaltiesDayLogic) +
      absMoney(invoice.latePenalty) +
      absMoney(invoice.noShowPenalty) +
      absMoney(invoice.noShowPenaltySpecialCities) +
      absMoney(invoice.dailyAcceptanceRatePenalty) +
      absMoney(invoice.missedDaysPenalty) +
      absMoney(invoice.riderBalance),
  );
}

function rowAccountKey(row: { applicationAccountId: string | null; riderIdFromFile: string }) {
  return row.applicationAccountId || `rider:${row.riderIdFromFile}`;
}

function groupDailyRows(rows: Array<{ applicationAccountId: string | null; riderIdFromFile: string; reportDate: Date; completedDeliveries: number | null; actualWorkingHours: unknown; workingDays: unknown }>) {
  const map = new Map<string, DailyRecord[]>();
  for (const row of rows) {
    const key = rowAccountKey(row);
    const current = map.get(key) ?? [];
    current.push(row);
    map.set(key, current);
  }
  return map;
}

function mapAmounts<T extends { driverId: string; amount: unknown }>(items: T[]) {
  const map = new Map<string, number>();
  for (const item of items) map.set(item.driverId, (map.get(item.driverId) ?? 0) + numberValue(item.amount));
  return map;
}

function monthDateFromString(value: string) {
  const parts = monthParts(value);
  return { start: parts.start, end: parts.end };
}

type ResolvedHungerStationProject = NonNullable<Awaited<ReturnType<typeof resolveHungerStationProject>>>;

async function generateHungerStationPayrollFromPreview(input: GenerateHungerStationPayrollInput, applicationProject: ResolvedHungerStationProject) {
  const { safeMonth, year, monthNumber } = monthParts(input.month);
  const preview = await getHungerStationCompanyPayrollPreview({
    month: safeMonth,
    applicationProjectId: applicationProject.id,
    projectCode: applicationProject.code,
  });

  const hardBlocked = preview.blocked.filter((row) => row.reason !== "EXCLUDED");
  if (hardBlocked.length) {
    await prisma.auditLog.create({
      data: {
        user: input.requestedBy || "Admin",
        action: "BLOCK_HUNGERSTATION_PAYROLL_READINESS",
        entityType: "PayrollRun",
        entityId: `${safeMonth}:${applicationProject.id}`,
        newValue: toPrismaJson({
          month: safeMonth,
          applicationProjectId: applicationProject.id,
          blocked: hardBlocked.slice(0, 100),
          source: "HungerStationInvoiceRecord + AccountUsage",
        }),
      },
    });

    return {
      ok: false as const,
      status: 422,
      error: "لا يمكن إنشاء مسير HungerStation قبل حل حسابات الاستخدام غير المعتمدة.",
      details: {
        blocked: hardBlocked.slice(0, 100),
        rows: preview.rows.length,
        blockedCount: hardBlocked.length,
      },
    };
  }

  if (!preview.rows.length) {
    return {
      ok: false as const,
      status: 422,
      error: "لا توجد صفوف مسير HungerStation قابلة للتوليد لهذا الشهر/المشروع.",
      details: { month: safeMonth, applicationProjectId: applicationProject.id, invoiceRecords: preview.summary.invoiceRecords },
    };
  }

  const cityId = input.cityId || applicationProject.cityId || null;
  const totals = {
    totalDrivers: new Set(preview.rows.map((row) => row.actualDriverId)).size,
    totalOrders: Math.round(preview.rows.reduce((sum, row) => sum + row.orders, 0)),
    totalEarnings: roundMoney(preview.rows.reduce((sum, row) => sum + row.grossSalary, 0)),
    totalDeductions: roundMoney(preview.rows.reduce((sum, row) => sum + row.totalDeductions, 0)),
    netTotal: roundMoney(preview.rows.reduce((sum, row) => sum + row.netSalary, 0)),
    totalCompanyRevenue: roundMoney(preview.rows.reduce((sum, row) => sum + row.collectedAfterDeductions, 0)),
    estimatedCompanyProfit: roundMoney(preview.rows.reduce((sum, row) => sum + row.companyProfit, 0)),
  };

  const existingRun = await prisma.payrollRun.findFirst({
    where: {
      applicationProjectId: applicationProject.id,
      cityId,
      year,
      month: monthNumber,
      status: { notIn: [PayrollStatus.APPROVED, PayrollStatus.PAID, PayrollStatus.LOCKED] },
    },
    orderBy: { updatedAt: "desc" },
  });

  const run = await prisma.$transaction(async (tx) => {
    const payrollRun = existingRun
      ? await tx.payrollRun.update({
          where: { id: existingRun.id },
          data: {
            status: PayrollStatus.DRAFT,
            totalDrivers: totals.totalDrivers,
            totalOrders: totals.totalOrders,
            totalEarnings: totals.totalEarnings,
            totalDeductions: totals.totalDeductions,
            netTotal: totals.netTotal,
            totalCompanyRevenue: totals.totalCompanyRevenue,
            estimatedCompanyProfit: totals.estimatedCompanyProfit,
          },
        })
      : await tx.payrollRun.create({
          data: {
            month: monthNumber,
            year,
            applicationId: applicationProject.applicationId,
            applicationProjectId: applicationProject.id,
            cityId,
            status: PayrollStatus.DRAFT,
            totalDrivers: totals.totalDrivers,
            totalOrders: totals.totalOrders,
            totalEarnings: totals.totalEarnings,
            totalDeductions: totals.totalDeductions,
            netTotal: totals.netTotal,
            totalCompanyRevenue: totals.totalCompanyRevenue,
            estimatedCompanyProfit: totals.estimatedCompanyProfit,
          },
        });

    if (existingRun) await tx.payrollItem.deleteMany({ where: { payrollRunId: payrollRun.id } });

    for (const row of preview.rows) {
      const item: Prisma.PayrollItemUncheckedCreateInput = {
        payrollRunId: payrollRun.id,
        driverId: row.actualDriverId,
        applicationAccountId: row.applicationAccountId,
        vehicleId: row.vehicleId,
        vehicleOwnershipType: row.vehicleOwnershipType || "no_vehicle",
        vehicleRentDays: row.vehicleRentDays,
        orders: Math.round(row.orders),
        deliveredOrders: Math.round(row.orders),
        performanceValidDays: row.usageDays,
        performanceValidRate: roundQty(row.ratio * 100),
        kpiScore: row.invoiceOrderRate,
        kpiStatus: row.tier,
        level: row.tier,
        basicSalary: roundMoney(row.orderSalary),
        totalEarnings: roundMoney(row.grossSalary),
        grossSalary: roundMoney(row.grossSalary),
        appDeductionsTotal: roundMoney(row.appDeductions),
        totalAppDeductions: roundMoney(row.appDeductions),
        adminCarryoverDeduction: roundMoney(row.carryoverDeduction),
        housingDeduction: roundMoney(row.housingDeduction),
        trafficViolationDeduction: roundMoney(row.trafficViolationDeduction),
        advanceDeduction: roundMoney(row.advanceDeduction),
        internalAdvances: roundMoney(row.advanceDeduction),
        fuelDeduction: roundMoney(row.fuelDeduction),
        vehicleCarryoverDeduction: roundMoney(row.vehicleCarryoverDeduction),
        vehicleDamageDeduction: roundMoney(row.vehicleDamageDeduction),
        accidentLiabilityDeduction: roundMoney(row.accidentLiabilityDeduction),
        kafalaDeduction: roundMoney(row.kafalaDeduction),
        userDeduction: roundMoney(row.userDeduction),
        userDeductionApplied: row.userDeduction > 0,
        userDeductionReason: row.userDeduction > 0 ? "HungerStation: freelancer/personal car/internal user deduction" : undefined,
        carRentDeduction: roundMoney(row.carRentDeduction),
        otherDeductions: roundMoney(row.adminDeduction),
        manualDeduction: roundMoney(row.adminDeduction),
        totalDeductions: roundMoney(row.totalDeductions),
        netSalary: roundMoney(row.netSalary),
        finalSalary: roundMoney(row.netSalary),
        relationshipType: row.contractType || "",
        companyGrossRevenue: roundMoney(row.companyCollected),
        companyRevenueFromKeeta: roundMoney(row.collectedAfterDeductions),
        estimatedCompanyProfit: roundMoney(row.companyProfit),
        costPerOrder: row.orders > 0 ? roundMoney(row.netSalary / row.orders) : 0,
        status: "draft",
        notes: [
          `HungerStation payroll source=HungerStationInvoiceRecord+AccountUsage`,
          `rider_id=${row.riderId}`,
          `accountName=${row.accountName}`,
          `actualDriver=${row.actualDriverName}`,
          `city=${row.city}`,
          `tier=${row.tier}`,
          `usage=${row.from || safeMonth + "-01"}..${row.to || safeMonth}`,
          `invoiceOrderRate=${row.invoiceOrderRate}`,
          `hungerDeductions=${row.appDeductions}`,
          `internalDeductions=${row.internalDeductions}`,
          `userDeduction=${row.userDeduction}`,
          `formula=profit=(collected-appDeductions)-netSalary; netSalary=grossSalary-(hungerDeductions+internalDeductions)`,
          row.notes,
        ]
          .filter(Boolean)
          .join(" | "),
      };

      await tx.payrollItem.create({ data: item });
    }

    await tx.auditLog.create({
      data: {
        user: input.requestedBy || "Admin",
        action: "GENERATE_HUNGERSTATION_PAYROLL",
        entityType: "PayrollRun",
        entityId: payrollRun.id,
        newValue: toPrismaJson({
          month: safeMonth,
          applicationProjectId: applicationProject.id,
          rows: preview.rows.length,
          blocked: preview.blocked.length,
          formula: "HungerStation: source is invoice + approved AccountUsage. Rider Balance is a deduction. Shared accounts split by approved usage periods.",
          totals,
        }),
      },
    });

    return payrollRun;
  });

  return {
    ok: true as const,
    data: {
      month: safeMonth,
      payrollRunId: run.id,
      created: existingRun ? 0 : preview.rows.length,
      updated: existingRun ? preview.rows.length : 0,
      skippedLocked: 0,
      totalNet: totals.netTotal,
      totalCompanyRevenue: totals.totalCompanyRevenue,
      estimatedCompanyProfit: totals.estimatedCompanyProfit,
      warnings: preview.blocked.length,
      message: `تم توليد مسير HungerStation من الفاتورة والاستخدام المعتمد: ${preview.rows.length} صف.`,
    },
  };
}

export async function generateHungerStationPayroll(input: GenerateHungerStationPayrollInput) {
  const { safeMonth, year, monthNumber, start: monthStart, end: monthEnd } = monthParts(input.month);
  const applicationProject = await resolveHungerStationProject(input);

  if (!applicationProject || !applicationProject.applicationId) {
    return {
      ok: false as const,
      status: 422,
      error: "لم يتم العثور على مشروع HungerStation صالح للمسير.",
      details: { applicationProjectId: input.applicationProjectId, cityId: input.cityId },
    };
  }

  return generateHungerStationPayrollFromPreview(input, applicationProject);
}

/*
  Legacy HungerStation payroll implementation is intentionally disabled.
  HungerStation payroll now has one source of truth:
  HungerStationInvoiceRecord + approved/locked AccountUsage.
  ApplicationImportBatch/ApplicationImportRow remain import logs only.
  const cityId = input.cityId || applicationProject.cityId || undefined;
  const { row: settingsRow, settings } = await resolveSettings({
    applicationId: applicationProject.applicationId,
    applicationProjectId: applicationProject.id,
    cityId,
  });

  const invoiceRows = await prisma.hungerStationInvoiceRecord.findMany({
    where: {
      month: safeMonth,
      applicationProjectId: applicationProject.id,
      ...(cityId ? { cityId } : {}),
    },
    include: {
      applicationAccount: { select: { id: true, appUserId: true, appUsername: true, username: true, driverId: true } },
      driver: { select: { id: true, name: true, actualName: true, internalCode: true } },
    },
    orderBy: [{ riderIdFromFile: "asc" }],
  });

  if (!invoiceRows.length) {
    return {
      ok: false as const,
      status: 422,
      error: "لا توجد فاتورة HungerStation محفوظة لهذا الشهر/المشروع.",
      details: { month: safeMonth, applicationProjectId: applicationProject.id, cityId },
    };
  }

  const accountIds = Array.from(new Set(invoiceRows.map((row) => row.applicationAccountId).filter(Boolean))) as string[];
  if (!accountIds.length) {
    return {
      ok: false as const,
      status: 422,
      error: "الفاتورة موجودة لكن الحسابات غير مربوطة بعد. راجع Account Usage Review قبل المسير.",
      details: { month: safeMonth, invoices: invoiceRows.length },
    };
  }

  const [approvedUsages, allUsages, dailyRows] = await Promise.all([
    prisma.accountUsage.findMany({
      where: {
        month: safeMonth,
        applicationProjectId: applicationProject.id,
        ...(cityId ? { cityId } : {}),
        applicationAccountId: { in: accountIds },
        actualDriverId: { not: null },
        status: { in: APPROVED_USAGE_STATUS },
      },
      include: {
        actualDriver: { select: { id: true, name: true, actualName: true, internalCode: true, vehicleId: true, vehicleOwnershipType: true, contractType: true } },
        ownerDriver: { select: { id: true, name: true, actualName: true, internalCode: true } },
        applicationAccount: { select: { id: true, appUserId: true, appUsername: true, username: true, driverId: true } },
      },
      orderBy: [{ applicationAccountId: "asc" }, { dateFrom: "asc" }, { updatedAt: "asc" }],
    }),
    prisma.accountUsage.findMany({
      where: {
        month: safeMonth,
        applicationProjectId: applicationProject.id,
        ...(cityId ? { cityId } : {}),
        applicationAccountId: { in: accountIds },
      },
      select: { applicationAccountId: true, actualDriverId: true, status: true, usageType: true, reviewReason: true },
    }),
    prisma.hungerStationDailyPerformanceRecord.findMany({
      where: {
        month: safeMonth,
        applicationProjectId: applicationProject.id,
        ...(cityId ? { cityId } : {}),
        OR: [{ applicationAccountId: { in: accountIds } }, { riderIdFromFile: { in: invoiceRows.map((row) => row.riderIdFromFile) } }],
      },
      select: {
        applicationAccountId: true,
        riderIdFromFile: true,
        reportDate: true,
        completedDeliveries: true,
        actualWorkingHours: true,
        workingDays: true,
      },
    }),
  ]);

  const usagesByAccount = new Map<string, typeof approvedUsages>();
  for (const usage of approvedUsages) {
    if (!usage.applicationAccountId) continue;
    const current = usagesByAccount.get(usage.applicationAccountId) ?? [];
    current.push(usage);
    usagesByAccount.set(usage.applicationAccountId, current);
  }

  const allUsagesByAccount = new Map<string, typeof allUsages>();
  for (const usage of allUsages) {
    const allCurrent = allUsagesByAccount.get(usage.applicationAccountId) ?? [];
    allCurrent.push(usage);
    allUsagesByAccount.set(usage.applicationAccountId, allCurrent);
  }

  const dailyByAccount = groupDailyRows(dailyRows);
  const problems: Array<Record<string, unknown>> = [];
  const draftRows: DraftPayrollRow[] = [];

  for (const invoice of invoiceRows) {
    const accountKey = rowAccountKey(invoice);
    const accountUsages = invoice.applicationAccountId ? usagesByAccount.get(invoice.applicationAccountId) ?? [] : [];
    const unapprovedUsages = invoice.applicationAccountId ? allUsagesByAccount.get(invoice.applicationAccountId) ?? [] : [];

    if (!invoice.applicationAccountId) {
      problems.push({ riderId: invoice.riderIdFromFile, reason: "NO_APPLICATION_ACCOUNT", message: "الحساب غير مربوط في ApplicationAccount." });
      continue;
    }

    if (settings.requireApprovedUsage && !accountUsages.length) {
      problems.push({
        riderId: invoice.riderIdFromFile,
        accountId: invoice.applicationAccountId,
        reason: "NO_APPROVED_ACCOUNT_USAGE",
        message: "لا توجد فترة استخدام معتمدة للحساب. المسير يحتاج actualDriverId + dateFrom/dateTo + APPROVED.",
        currentUsages: unapprovedUsages.map((usage) => ({ status: usage.status, usageType: usage.usageType, actualDriverId: usage.actualDriverId, reviewReason: usage.reviewReason })),
      });
      continue;
    }

    const invoiceOrders = Number(invoice.completedOrders ?? 0);
    const basicPayment = numberValue(invoice.basicPayment);
    const distancePayment = numberValue(invoice.distancePayment);
    const cityPayment = numberValue(invoice.cityPayment);
    const invoiceOrderRate = invoiceOrders > 0 ? basicPayment / invoiceOrders : 0;
    const performance = classifyInvoicePerformance(invoiceOrderRate, settings);
    const accountKm = settings.companyKmRate > 0 ? distancePayment / settings.companyKmRate : 0;
    const accountAppDeductions = appDeductionsFromInvoice(invoice);
    const companyGross = basicPayment + distancePayment + cityPayment;
    const companyNetAfterAppDeductions = companyGross - accountAppDeductions;
    const accountDailyRows = dailyByAccount.get(accountKey) ?? [];
    const totalDailyOrders = sumBy(accountDailyRows, (row) => Number(row.completedDeliveries ?? 0));

    const clampedUsages = accountUsages
      .map((usage) => ({ usage, period: clampPeriod({ dateFrom: usage.dateFrom, dateTo: usage.dateTo, monthStart, monthEnd }) }))
      .filter((item) => item.period.days > 0 && item.usage.actualDriverId && item.usage.actualDriver);
    const totalUsageDays = clampedUsages.reduce((sum, item) => sum + item.period.days, 0) || clampedUsages.length || 1;

    let allocatedOrdersSum = 0;
    let allocatedGrossSum = 0;
    let allocatedDeductionSum = 0;
    let allocatedKmSum = 0;
    let allocatedCompanyNetSum = 0;

    for (let index = 0; index < clampedUsages.length; index += 1) {
      const { usage, period } = clampedUsages[index];
      const isLast = index === clampedUsages.length - 1;
      const periodDailyRows = accountDailyRows.filter((row) => inPeriod(row.reportDate, period.from, period.to));
      const periodDailyOrders = sumBy(periodDailyRows, (row) => Number(row.completedDeliveries ?? 0));
      const ratio = totalDailyOrders > 0 ? periodDailyOrders / totalDailyOrders : period.days / totalUsageDays;

      const allocatedOrders = isLast ? Math.max(0, invoiceOrders - allocatedOrdersSum) : Math.max(0, Math.round(invoiceOrders * ratio));
      const allocatedKm = isLast ? Math.max(0, accountKm - allocatedKmSum) : Math.max(0, accountKm * ratio);
      const allocatedAppDeductions = isLast ? Math.max(0, accountAppDeductions - allocatedDeductionSum) : Math.max(0, accountAppDeductions * ratio);
      const allocatedCompanyGross = isLast ? Math.max(0, companyGross - allocatedGrossSum) : Math.max(0, companyGross * ratio);
      const allocatedCompanyNet = isLast ? companyNetAfterAppDeductions - allocatedCompanyNetSum : companyNetAfterAppDeductions * ratio;
      const allocatedHours = totalDailyOrders > 0 ? sumBy(periodDailyRows, (row) => numberValue(row.actualWorkingHours)) : 0;
      const allocatedWorkingDays = totalDailyOrders > 0 ? sumBy(periodDailyRows, (row) => numberValue(row.workingDays)) : period.days;
      const driverGross = allocatedOrders * performance.orderRate + allocatedKm * performance.kmRate;
      const warnings: string[] = [];

      if (performance.tier === "NEEDS_REVIEW") warnings.push(`Invoice order rate ${roundQty(invoiceOrderRate)} is not close to ${settings.highInvoiceOrderRate} or ${settings.lowInvoiceOrderRate}; used low-performance rates until review.`);
      if (!totalDailyOrders) warnings.push("لا توجد تقارير يومية كافية لهذا الحساب؛ تم توزيع الفاتورة حسب أيام فترة الاستخدام.");
      if (accountUsages.length > 1) warnings.push("حساب مشترك: تم توزيع الفاتورة حسب فترة الاستخدام المعتمدة.");

      allocatedOrdersSum += allocatedOrders;
      allocatedKmSum += allocatedKm;
      allocatedDeductionSum += allocatedAppDeductions;
      allocatedGrossSum += allocatedCompanyGross;
      allocatedCompanyNetSum += allocatedCompanyNet;

      draftRows.push({
        warnings,
        values: {
          driverId: usage.actualDriverId!,
          applicationAccountId: invoice.applicationAccountId,
          vehicleId: usage.actualDriver?.vehicleId || null,
          vehicleOwnershipType: usage.actualDriver?.vehicleOwnershipType || "no_vehicle",
          orders: allocatedOrders,
          deliveredOrders: allocatedOrders,
          workingHours: roundQty(allocatedHours),
          performanceValidDays: Math.round(allocatedWorkingDays),
          performanceValidRate: roundQty(ratio * 100),
          kpiStatus: performance.tier,
          level: performance.tier,
          basicSalary: roundMoney(driverGross),
          totalEarnings: roundMoney(driverGross),
          grossSalary: roundMoney(driverGross),
          appDeductionsTotal: roundMoney(allocatedAppDeductions),
          totalAppDeductions: roundMoney(allocatedAppDeductions),
          totalDeductions: roundMoney(allocatedAppDeductions),
          netSalary: roundMoney(driverGross - allocatedAppDeductions),
          finalSalary: roundMoney(driverGross - allocatedAppDeductions),
          relationshipType: usage.actualDriver?.contractType || "",
          workedDaysForSalary: Math.round(allocatedWorkingDays),
          salaryBaseWorkingDays: 28,
          baseSalaryBeforeProration: roundMoney(driverGross),
          companyGrossRevenue: roundMoney(allocatedCompanyGross),
          companyRevenueFromKeeta: roundMoney(allocatedCompanyNet),
          estimatedCompanyProfit: roundMoney(allocatedCompanyNet - (driverGross - allocatedAppDeductions)),
          costPerOrder: allocatedOrders > 0 ? roundMoney((driverGross - allocatedAppDeductions) / allocatedOrders) : 0,
          status: warnings.length ? "review" : "draft",
          notes: [
            `HungerStation payroll: rider=${invoice.riderIdFromFile}, invoiceRate=${roundQty(invoiceOrderRate)}, tier=${performance.tier}, period=${period.from.toISOString().slice(0, 10)}..${period.to.toISOString().slice(0, 10)}, invoiceCollected=basic+distance+city`,
            `formula=driverGross(orders*${performance.orderRate}+km*${performance.kmRate})-appDeductions`,
            `appDeductions include acceptance/contact/stacking/declined/late/no-show/daily-acceptance/missed-days/Rider Balance`,
            ...warnings,
          ].join(" | "),
        },
      });
    }
  }

  if (problems.length) {
    await prisma.auditLog.create({
      data: {
        user: input.requestedBy || "Admin",
        action: "BLOCK_HUNGERSTATION_PAYROLL_READINESS",
        entityType: "PayrollRun",
        entityId: safeMonth,
        newValue: toPrismaJson({
          month: safeMonth,
          applicationProjectId: applicationProject.id,
          problems: problems.slice(0, 100),
        }),
      },
    });
    return {
      ok: false as const,
      status: 422,
      error: "لا يمكن إنشاء مسير HungerStation قبل اعتماد فترات استخدام الحسابات.",
      details: { problems: problems.slice(0, 100), scannedInvoices: invoiceRows.length, approvedUsages: approvedUsages.length },
    };
  }

  if (!draftRows.length) {
    return {
      ok: false as const,
      status: 422,
      error: "لا توجد صفوف مسير HungerStation قابلة للتوليد.",
      details: { month: safeMonth, invoiceRows: invoiceRows.length, approvedUsages: approvedUsages.length },
    };
  }

  const driverIds = Array.from(new Set(draftRows.map((row) => String(row.values.driverId)).filter(Boolean)));
  const { start: periodStart, end: periodEnd } = monthDateFromString(safeMonth);
  const [advances, deductions, violations] = await Promise.all([
    prisma.advance.findMany({
      where: {
        driverId: { in: driverIds },
        deductionMonth: safeMonth,
        status: RecordStatus.APPROVED,
        isDeducted: false,
        payrollItemId: null,
        deductedPayrollRunId: null,
      },
      select: { driverId: true, amount: true },
    }),
    prisma.deduction.findMany({
      where: { driverId: { in: driverIds }, month: safeMonth, status: RecordStatus.APPROVED },
      select: { driverId: true, amount: true },
    }),
    prisma.violation.findMany({
      where: { driverId: { in: driverIds }, status: RecordStatus.APPROVED, occurredAt: { gte: periodStart, lte: periodEnd } },
      select: { driverId: true, amount: true },
    }),
  ]);

  const advanceMap = mapAmounts(advances);
  const deductionMap = mapAmounts(deductions);
  const violationMap = mapAmounts(violations);
  const internalApplied = new Set<string>();

  for (const row of draftRows) {
    const driverId = String(row.values.driverId);
    if (internalApplied.has(driverId)) continue;
    internalApplied.add(driverId);
    const internalAdvances = advanceMap.get(driverId) ?? 0;
    const internalDeductions = deductionMap.get(driverId) ?? 0;
    const internalViolations = violationMap.get(driverId) ?? 0;
    const extraDeductions = internalAdvances + internalDeductions + internalViolations;
    const currentTotalDeductions = numberValue(row.values.totalDeductions);
    const currentFinal = numberValue(row.values.finalSalary);
    row.values.advancesTotal = roundMoney(internalAdvances);
    row.values.internalAdvances = roundMoney(internalAdvances);
    row.values.advanceDeduction = roundMoney(internalAdvances);
    row.values.violationsTotal = roundMoney(internalViolations);
    row.values.internalPenalties = roundMoney(internalViolations + internalDeductions);
    row.values.otherDeductions = roundMoney(internalDeductions);
    row.values.totalDeductions = roundMoney(currentTotalDeductions + extraDeductions);
    row.values.netSalary = roundMoney(currentFinal - extraDeductions);
    row.values.finalSalary = roundMoney(currentFinal - extraDeductions);
    row.values.estimatedCompanyProfit = roundMoney(numberValue(row.values.companyRevenueFromKeeta) - numberValue(row.values.finalSalary));
    row.values.notes = [row.values.notes, extraDeductions ? `internalDeductions applied once for driver: advances=${internalAdvances}, deductions=${internalDeductions}, violations=${internalViolations}` : null]
      .filter(Boolean)
      .join(" | ");
  }

  const totals = {
    totalDrivers: new Set(draftRows.map((row) => row.values.driverId)).size,
    totalOrders: draftRows.reduce((sum, row) => sum + Number(row.values.deliveredOrders ?? row.values.orders ?? 0), 0),
    totalEarnings: roundMoney(draftRows.reduce((sum, row) => sum + numberValue(row.values.grossSalary ?? row.values.totalEarnings), 0)),
    totalDeductions: roundMoney(draftRows.reduce((sum, row) => sum + numberValue(row.values.totalDeductions), 0)),
    netTotal: roundMoney(draftRows.reduce((sum, row) => sum + numberValue(row.values.finalSalary ?? row.values.netSalary), 0)),
    totalCompanyRevenue: roundMoney(draftRows.reduce((sum, row) => sum + numberValue(row.values.companyRevenueFromKeeta), 0)),
    estimatedCompanyProfit: roundMoney(draftRows.reduce((sum, row) => sum + numberValue(row.values.estimatedCompanyProfit), 0)),
  };

  const existingRun = await prisma.payrollRun.findFirst({
    where: {
      applicationProjectId: applicationProject.id,
      cityId: cityId || applicationProject.cityId,
      year,
      month: monthNumber,
      status: { notIn: [PayrollStatus.APPROVED, PayrollStatus.PAID, PayrollStatus.LOCKED] },
    },
    orderBy: { updatedAt: "desc" },
  });

  const run = await prisma.$transaction(async (tx) => {
    const payrollRun = existingRun
      ? await tx.payrollRun.update({
          where: { id: existingRun.id },
          data: {
            status: PayrollStatus.DRAFT,
            payrollSettingId: settingsRow?.id ?? null,
            totalDrivers: totals.totalDrivers,
            totalOrders: totals.totalOrders,
            totalEarnings: totals.totalEarnings,
            totalDeductions: totals.totalDeductions,
            netTotal: totals.netTotal,
            totalCompanyRevenue: totals.totalCompanyRevenue,
            estimatedCompanyProfit: totals.estimatedCompanyProfit,
          },
        })
      : await tx.payrollRun.create({
          data: {
            month: monthNumber,
            year,
            applicationId: applicationProject.applicationId,
            applicationProjectId: applicationProject.id,
            cityId: cityId || applicationProject.cityId,
            payrollSettingId: settingsRow?.id ?? null,
            status: PayrollStatus.DRAFT,
            totalDrivers: totals.totalDrivers,
            totalOrders: totals.totalOrders,
            totalEarnings: totals.totalEarnings,
            totalDeductions: totals.totalDeductions,
            netTotal: totals.netTotal,
            totalCompanyRevenue: totals.totalCompanyRevenue,
            estimatedCompanyProfit: totals.estimatedCompanyProfit,
          },
        });

    if (existingRun) await tx.payrollItem.deleteMany({ where: { payrollRunId: payrollRun.id } });

    for (const row of draftRows) {
      await tx.payrollItem.create({ data: { payrollRunId: payrollRun.id, ...row.values } as Prisma.PayrollItemUncheckedCreateInput });
    }

    await tx.auditLog.create({
      data: {
        user: input.requestedBy || "Admin",
        action: "GENERATE_HUNGERSTATION_PAYROLL",
        entityType: "PayrollRun",
        entityId: payrollRun.id,
        newValue: toPrismaJson({
          month: safeMonth,
          applicationProjectId: applicationProject.id,
          formula: "HungerStation: performance tier from invoice basic_payment/completed_orders. Invoice collected = basic_payment + distance_payment + city_payment. Driver gross = orders*driverRate + km*driverKmRate. App deductions include all penalty fields and Rider Balance. Shared accounts are split by approved AccountUsage dateFrom/dateTo.",
          settings,
          totals,
        }),
      },
    });

    return payrollRun;
  });

  return {
    ok: true as const,
    data: {
      month: safeMonth,
      payrollRunId: run.id,
      created: draftRows.length,
      updated: existingRun ? draftRows.length : 0,
      skippedLocked: 0,
      totalNet: totals.netTotal,
      totalCompanyRevenue: totals.totalCompanyRevenue,
      estimatedCompanyProfit: totals.estimatedCompanyProfit,
      warnings: draftRows.filter((row) => row.warnings.length).length,
    },
  };
}





*/

