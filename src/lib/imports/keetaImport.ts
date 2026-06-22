import { Prisma, RecordStatus } from "@prisma/client";
import type { ParsedImportFile, ParsedImportSheet } from "./parseCsv";
import type { ImportPreviewPayload } from "./previewImport";
import { validateImportRows, type ImportPreviewRow } from "./validateRows";
import type { ImportColumn, ImportColumnMapping } from "./templates";
import { upsertOperationalApplicationAccount } from "@/lib/application-accounts/accountLinking";
import {
  KEETA_DRIVER_INVOICE_TEMPLATE,
  KEETA_PERIOD_REPORT_TEMPLATE,
  KEETA_RANK_TEMPLATE,
} from "./templates";

export function isKeetaOperationalImport(importType: string) {
  return [KEETA_RANK_TEMPLATE, KEETA_PERIOD_REPORT_TEMPLATE, KEETA_DRIVER_INVOICE_TEMPLATE].includes(importType);
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function json(value: unknown) {
  if (value === undefined || value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

function numberValue(value: unknown, fallback = 0) {
  const raw = text(value)
    .replace(/\u00a0/g, "")
    .replace(/,/g, "")
    .replace("%", "")
    .replace(/[^\d.\-]/g, "");
  if (!raw) return fallback;
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function intValue(value: unknown, fallback = 0) {
  return Math.round(numberValue(value, fallback));
}

function rateValue(value: unknown, fallback = 0) {
  const valueNumber = numberValue(value, fallback);
  if (valueNumber > 0 && valueNumber <= 1) return Math.round(valueNumber * 10000) / 100;
  return valueNumber;
}

function hoursValue(value: unknown, fallback = 0) {
  const raw = text(value).toLowerCase();
  if (!raw) return fallback;
  const clock = raw.match(/^(\d{1,3}):(\d{2})(?::(\d{2}))?$/);
  if (clock) {
    const hours = Number(clock[1]);
    const minutes = Number(clock[2]) / 60;
    const seconds = clock[3] ? Number(clock[3]) / 3600 : 0;
    return Math.round((hours + minutes + seconds) * 100) / 100;
  }
  let total = 0;
  const hourMatch = raw.match(/(\d+(?:\.\d+)?)\s*(?:hr|hour|hours|h|ساعة|ساعه)/);
  const minuteMatch = raw.match(/(\d+(?:\.\d+)?)\s*(?:min|minute|minutes|m|دقيقة|دقيقه)/);
  const secondMatch = raw.match(/(\d+(?:\.\d+)?)\s*(?:sec|second|seconds|s|ثانية|ثانيه)/);
  if (hourMatch) total += Number(hourMatch[1]);
  if (minuteMatch) total += Number(minuteMatch[1]) / 60;
  if (secondMatch) total += Number(secondMatch[1]) / 3600;
  if (total > 0) return Math.round(total * 100) / 100;
  const numeric = numberValue(raw, Number.NaN);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function boolValue(value: unknown) {
  const raw = text(value).toLowerCase();
  if (!raw) return null;
  if (["true", "yes", "y", "1", "valid", "صحيح", "نعم"].includes(raw)) return true;
  if (["false", "no", "n", "0", "invalid", "خطأ", "لا"].includes(raw)) return false;
  return null;
}

function parsedDateValue(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const raw = text(value).replace(/\.0+$/, "");
  if (!raw) return null;
  const compact = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) {
    const parsed = new Date(Date.UTC(Number(compact[1]), Number(compact[2]) - 1, Number(compact[3])));
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function endOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 23, 59, 59, 999));
}

function monthFrom(value: unknown, fallback = new Date()) {
  const raw = text(value);
  const cycle = raw.match(/(\d{4})[-/](\d{2})/);
  if (cycle) return `${cycle[1]}-${cycle[2]}`;
  const parsed = parsedDateValue(value);
  return (parsed ?? fallback).toISOString().slice(0, 7);
}

function normalizedMonth(value: unknown) {
  const raw = text(value);
  const match = raw.match(/^(20\d{2})-(0[1-9]|1[0-2])$/);
  return match ? `${match[1]}-${match[2]}` : "";
}

function monthFromFileName(fileName: string) {
  const match = fileName.match(/(20\d{2})[-_\s#]*(0[1-9]|1[0-2])/);
  return match ? `${match[1]}-${match[2]}` : "";
}

function monthFromBillingCycle(value: unknown) {
  const raw = text(value);
  const matches = Array.from(raw.matchAll(/(20\d{2})[-/](0?[1-9]|1[0-2])/g));
  const last = matches.at(-1);
  if (!last) return "";
  return `${last[1]}-${last[2].padStart(2, "0")}`;
}

function rowDateRange(rows: ImportPreviewRow[]) {
  const dates = rows
    .map((row) => parsedDateValue(row.mappedData.reportDate || row.mappedData.date))
    .filter((date): date is Date => Boolean(date))
    .map((date) => date.getTime());
  if (!dates.length) return { periodStart: undefined, periodEnd: undefined };
  return {
    periodStart: new Date(Math.min(...dates)).toISOString(),
    periodEnd: new Date(Math.max(...dates)).toISOString(),
  };
}

function sumRows(rows: ImportPreviewRow[], key: string) {
  return Math.round(rows.reduce((sum, row) => sum + numberValue(row.mappedData[key]), 0) * 100) / 100;
}

function sumHours(rows: ImportPreviewRow[], key: string) {
  return Math.round(rows.reduce((sum, row) => sum + hoursValue(row.mappedData[key]), 0) * 100) / 100;
}

function averageRate(rows: ImportPreviewRow[], key: string) {
  if (!rows.length) return 0;
  return Math.round((rows.reduce((sum, row) => sum + rateValue(row.mappedData[key]), 0) / rows.length) * 100) / 100;
}

function normalizedSheetName(value: string) {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

const riderOrderDetailRequiredColumns: ImportColumn[] = [
  { key: "courierId", displayName: "Courier ID", required: true, dataType: "string", aliases: ["Courier ID", "appUserId"] },
];

const riderOrderDetailOptionalColumns: ImportColumn[] = [
  { key: "partnerId", displayName: "Partner ID", dataType: "string", aliases: ["Partner ID"] },
  { key: "partnerName", displayName: "Partner Name", dataType: "string", aliases: ["Partner Name"] },
  { key: "billingCycle", displayName: "Billing Cycle", dataType: "string", aliases: ["Billing Cycle"] },
  { key: "courierName", displayName: "Courier name", dataType: "string", aliases: ["Courier name"] },
  { key: "transactionType", displayName: "transaction type", dataType: "string", aliases: ["transaction type"] },
  { key: "businessId", displayName: "Business ID", dataType: "string", aliases: ["Business ID"] },
  { key: "note", displayName: "Note", dataType: "string", aliases: ["Note"] },
  { key: "feeType", displayName: "Fee type", dataType: "string", aliases: ["Fee type"] },
  { key: "detailAmount", displayName: "detail amount", dataType: "number", aliases: ["detail amount"] },
  { key: "totalPayableAmount", displayName: "مستحق الشركة من كيتا", dataType: "number", aliases: ["Total payable amount", "Keeta Payable to Company", "Company Revenue from Keeta"] },
  { key: "deliveryDistance", displayName: "Delivery distance", dataType: "number", aliases: ["Delivery distance"] },
  { key: "ticketId", displayName: "Ticket ID", dataType: "string", aliases: ["Ticket ID"] },
  { key: "violationId", displayName: "Violation ID", dataType: "string", aliases: ["Violation ID"] },
  { key: "violationType", displayName: "Violation type", dataType: "string", aliases: ["Violation type"] },
  { key: "punishmentMethods", displayName: "Punishment methods", dataType: "string", aliases: ["Punishment methods"] },
  { key: "timeOfFaceVerification", displayName: "Time of face verification", dataType: "string", aliases: ["Time of face verification"] },
  { key: "faceVerificationResult", displayName: "Face verification result", dataType: "string", aliases: ["Face verification result"] },
];

function mappingFor(columns: ImportColumn[]): ImportColumnMapping[] {
  return columns.map((column) => ({
    incomingColumn: column.displayName,
    systemField: column.key,
    required: Boolean(column.required),
    transformRule: column.dataType,
  }));
}

export async function buildKeetaDriverInvoicePreview(args: {
  fileName: string;
  parsed: ParsedImportFile;
  requiredColumns: ImportColumn[];
  optionalColumns: ImportColumn[];
  columnMapping: ImportColumnMapping[];
  applicationId: string;
  applicationProjectId: string;
  projectId?: string;
  cityId?: string;
  templateId: string;
  month?: string;
}) {
  const sheets = args.parsed.sheets?.length ? args.parsed.sheets : [{ name: "riderDetail", columns: args.parsed.columns, rows: args.parsed.rows }];
  const riderDetail = sheets.find((sheet) => normalizedSheetName(sheet.name) === "riderdetail") ?? sheets[0];
  const riderOrderDetail = sheets.find((sheet) => normalizedSheetName(sheet.name) === "riderorderdetail");

  if (!riderDetail) throw new Error("لم يتم العثور على شيت riderDetail داخل فاتورة Keeta.");

  const detailResult = await validateImportRows({
    fileType: KEETA_DRIVER_INVOICE_TEMPLATE,
    sourceColumns: riderDetail.columns,
    rawRows: riderDetail.rows,
    requiredColumns: args.requiredColumns,
    optionalColumns: args.optionalColumns,
    columnMapping: args.columnMapping,
    fileName: args.fileName,
    applicationId: args.applicationId,
    applicationProjectId: args.applicationProjectId,
    projectId: args.projectId ?? "",
    cityId: args.cityId ?? "",
    templateId: args.templateId,
  });

  const orderDetailResult = riderOrderDetail
    ? await validateImportRows({
        fileType: KEETA_DRIVER_INVOICE_TEMPLATE,
        sourceColumns: riderOrderDetail.columns,
        rawRows: riderOrderDetail.rows,
        requiredColumns: riderOrderDetailRequiredColumns,
        optionalColumns: riderOrderDetailOptionalColumns,
        columnMapping: mappingFor([...riderOrderDetailRequiredColumns, ...riderOrderDetailOptionalColumns]),
        fileName: args.fileName,
        applicationId: args.applicationId,
        applicationProjectId: args.applicationProjectId,
        projectId: args.projectId ?? "",
        cityId: args.cityId ?? "",
        templateId: args.templateId,
      })
    : { rows: [] as ImportPreviewRow[] };

  const billingMonth =
    monthFromFileName(args.fileName) ||
    monthFromBillingCycle(detailResult.rows[0]?.mappedData.billingCycle) ||
    normalizedMonth(args.month) ||
    monthFrom(new Date());
  const summary = {
    ...detailResult.summary,
    sheetNames: sheets.map((sheet) => sheet.name),
    month: billingMonth,
    matchedDrivers: detailResult.rows.filter((row) => row.driverId).length,
    unmatchedRows: detailResult.rows.filter((row) => row.errorType === "missing_driver" || row.errorType === "duplicate_match").length,
    totals: {
      deliveredOrders: sumRows(detailResult.rows, "deliveredOrders"),
      orderBasedPricing: sumRows(detailResult.rows, "orderBasedPricing"),
      validDaCapacityIncentives: sumRows(detailResult.rows, "validDaCapacityIncentives"),
      experienceIncentive: sumRows(detailResult.rows, "experienceIncentive"),
      deduction: sumRows(detailResult.rows, "deduction"),
      foodCompensation: sumRows(detailResult.rows, "foodCompensation"),
      tgaDeductionVatExcluded: sumRows(detailResult.rows, "tgaDeductionVatExcluded"),
      totalPayableAmount: sumRows(detailResult.rows, "totalPayableAmount"),
      detailRows: orderDetailResult.rows.length,
    },
  };

  return {
    summary,
    columns: detailResult.columns,
    missingColumns: detailResult.missingColumns.map((column) => ({ key: column.key, displayName: column.displayName })),
    rows: detailResult.rows,
    sheets: sheets.map((sheet) => sheet.name),
    keetaInvoiceDetails: orderDetailResult.rows,
    message: "هذه معاينة فقط. لم يتم حفظ أي بيانات في قاعدة البيانات بعد.",
  } satisfies ImportPreviewPayload;
}

export function enrichKeetaPreview(preview: ImportPreviewPayload): ImportPreviewPayload {
  if (preview.summary.importType !== KEETA_RANK_TEMPLATE && preview.summary.importType !== KEETA_PERIOD_REPORT_TEMPLATE) return preview;
  const { periodStart, periodEnd } = rowDateRange(preview.rows);
  const firstDate = preview.rows[0]?.mappedData.reportDate || preview.rows[0]?.mappedData.date;
  const month = preview.summary.importType === KEETA_PERIOD_REPORT_TEMPLATE ? monthFrom(firstDate) : preview.summary.month;
  const totals: Record<string, number | string> = preview.summary.importType === KEETA_PERIOD_REPORT_TEMPLATE
    ? {
        acceptedTasks: sumRows(preview.rows, "acceptedTasks"),
        deliveredTasks: sumRows(preview.rows, "deliveredTasks"),
        rejectedTasks: sumRows(preview.rows, "rejectedTasks"),
        cancellationRateAverage: averageRate(preview.rows, "cancellationRateFromDeliveryIssues"),
        onTimeRateAverage: averageRate(preview.rows, "onTimeRate"),
        onlineHours: sumHours(preview.rows, "validOnlineTime"),
      }
    : {
        orderVolume: sumRows(preview.rows, "orderVolume"),
        rewardAmount: sumRows(preview.rows, "currentEstimatedRewardAmount"),
      };
  return {
    ...preview,
    summary: {
      ...preview.summary,
      periodStart,
      periodEnd,
      month,
      matchedDrivers: preview.rows.filter((row) => row.driverId).length,
      unmatchedRows: preview.rows.filter((row) => row.errorType === "missing_driver" || row.errorType === "duplicate_match").length,
      totals,
    },
  };
}

async function findAccountAndDriver(
  tx: Prisma.TransactionClient,
  row: ImportPreviewRow,
  scope: { applicationId?: string | null; applicationProjectId?: string | null; cityId?: string | null },
) {
  const courierId = text(row.mappedData.courierId || row.mappedData.appUserId || row.mappedData.applicationAccountId);
  if (!courierId) return { driverId: row.driverId ?? null, applicationAccountId: row.applicationAccountId ?? null, cityId: null as string | null };
  const identityWhere = {
    OR: [
      { appUserId: courierId },
      { username: courierId },
      { appUsername: courierId },
    ],
  };
  const scopedWhere: Prisma.ApplicationAccountWhereInput[] = [];
  if (scope.applicationProjectId) scopedWhere.push({ ...identityWhere, applicationProjectId: scope.applicationProjectId });
  if (scope.applicationId && scope.cityId) scopedWhere.push({ ...identityWhere, applicationId: scope.applicationId, cityId: scope.cityId });
  if (scope.applicationId) scopedWhere.push({ ...identityWhere, applicationId: scope.applicationId });
  scopedWhere.push(identityWhere);

  let account: {
    id: string;
    driverId: string | null;
    cityId: string | null;
    driver: { id: string; cityId: string | null } | null;
  } | null = null;
  for (const where of scopedWhere) {
    account = await tx.applicationAccount.findFirst({
      where,
      include: { driver: { select: { id: true, cityId: true } } },
    });
    if (account) break;
  }
  const driverId = row.driverId ?? account?.driverId ?? account?.driver?.id ?? null;
  let applicationAccountId = row.applicationAccountId ?? account?.id ?? null;
  let cityId = account?.cityId ?? account?.driver?.cityId ?? scope.cityId ?? null;

  if (driverId) {
    const linked = await upsertOperationalApplicationAccount(tx, {
      appName: "Keeta",
      applicationId: scope.applicationId ?? null,
      applicationProjectId: scope.applicationProjectId ?? null,
      cityId,
      driverId,
      appUserId: courierId,
      appUsername: text(row.mappedData.courierName || row.mappedData.name),
      existingId: applicationAccountId,
      source: "KEETA_IMPORT",
    });
    applicationAccountId = linked.id;
    cityId = linked.cityId ?? cityId;
  }

  return {
    driverId,
    applicationAccountId,
    cityId,
  };
}

function periodDate(value?: string | null) {
  return value ? parsedDateValue(value) : null;
}

async function resolveRequiredKeetaLinks(
  tx: Prisma.TransactionClient,
  rows: ImportPreviewRow[],
  scope: { applicationId?: string | null; applicationProjectId?: string | null; cityId?: string | null },
) {
  const links = new Map<number, Awaited<ReturnType<typeof findAccountAndDriver>>>();
  const missing: string[] = [];

  for (const row of rows) {
    const link = await findAccountAndDriver(tx, row, scope);
    links.set(row.rowNumber, link);
    if (!link.driverId) {
      const courierId = text(row.mappedData.courierId || row.mappedData.appUserId || row.mappedData.applicationAccountId);
      const courierName = text(row.mappedData.courierName || row.mappedData.name || row.mappedData.courierFirstName);
      missing.push(`row ${row.rowNumber}: ${courierId || "no Courier ID"}${courierName ? ` / ${courierName}` : ""} / project=${scope.applicationProjectId || "-"} / city=${scope.cityId || "-"}`);
    }
  }

  if (missing.length) {
    throw new Error(`Cannot approve Keeta import before linking every Courier ID to an internal driver. Missing: ${Array.from(new Set(missing)).slice(0, 20).join(", ")}`);
  }

  return links;
}

export async function commitKeetaRecords(args: {
  tx: Prisma.TransactionClient;
  batchId: string;
  preview: ImportPreviewPayload;
  applicationProjectId: string | null;
  cityId: string | null;
  userId?: string | null;
}) {
  const { tx, batchId, preview } = args;
  const validRows = preview.rows.filter((row) => row.severity !== "error" && row.status !== "ignored");
  const importType = preview.summary.importType;
  const approvedAt = new Date();
  const periodStart = periodDate(preview.summary.periodStart) ?? null;
  const periodEnd = periodDate(preview.summary.periodEnd) ?? null;
  const month = preview.summary.month ?? monthFrom(periodStart ?? new Date());

  if (importType === KEETA_RANK_TEMPLATE) {
    const requiredLinks = await resolveRequiredKeetaLinks(tx, validRows, {
      applicationId: preview.summary.applicationId,
      applicationProjectId: args.applicationProjectId,
      cityId: args.cityId,
    });
    for (const row of validRows) {
      const link = requiredLinks.get(row.rowNumber)!;
      const courierId = text(row.mappedData.courierId || row.mappedData.appUserId);
      const rankData = {
        projectId: "keeta",
        applicationProjectId: args.applicationProjectId,
        driverId: link.driverId,
        applicationAccountId: link.applicationAccountId,
        courierId,
        courierName: text(row.mappedData.courierName || row.mappedData.name) || null,
        cityId: link.cityId ?? args.cityId,
        month,
        periodStart,
        periodEnd,
        currentEstimatedLevel: text(row.mappedData.currentEstimatedLevel || row.mappedData.rank) || null,
        currentEstimatedRanking: numberValue(row.mappedData.currentEstimatedRanking),
        courierRankingPercentile: rateValue(row.mappedData.courierRankingPercentile),
        currentScoreForForcedAssignment: numberValue(row.mappedData.currentScoreForForcedAssignment),
        currentEstimatedRewardAmount: numberValue(row.mappedData.currentEstimatedRewardAmount),
        onTimeRate: rateValue(row.mappedData.onTimeRate),
        orderCompletionRate: rateValue(row.mappedData.orderCompletionRate),
        dropOffNotEarlyRate: rateValue(row.mappedData.dropOffNotEarlyRate),
        orderVolume: intValue(row.mappedData.orderVolume),
        rawData: json(row.rawData),
        importBatchId: batchId,
        status: "Approved",
        approvedBy: args.userId ?? null,
        approvedAt,
      };
      const existingRanks = await tx.keetaRankRecord.findMany({
        where: {
          courierId,
          month,
          ...(args.applicationProjectId ? { applicationProjectId: args.applicationProjectId } : {}),
          ...((link.cityId ?? args.cityId) ? { cityId: link.cityId ?? args.cityId } : {}),
        },
        select: { id: true },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      });
      if (existingRanks[0]) {
        await tx.keetaRankRecord.update({ where: { id: existingRanks[0].id }, data: rankData });
        const duplicateIds = existingRanks.slice(1).map((record) => record.id);
        if (duplicateIds.length) await tx.keetaRankRecord.deleteMany({ where: { id: { in: duplicateIds } } });
      } else {
        await tx.keetaRankRecord.create({ data: rankData });
      }
    }
    return { keetaRankRecords: validRows.length };
  }

  if (importType === KEETA_PERIOD_REPORT_TEMPLATE) {
    let createdDailyReports = 0;
    let updatedDailyReports = 0;
    for (const row of validRows) {
      const link = await findAccountAndDriver(tx, row, {
        applicationId: preview.summary.applicationId,
        applicationProjectId: args.applicationProjectId,
        cityId: args.cityId,
      });
      const reportDate = startOfUtcDay(parsedDateValue(row.mappedData.reportDate || row.mappedData.date) ?? periodStart ?? approvedAt);
      const deliveredTasks = intValue(row.mappedData.deliveredTasks || row.mappedData.orders);
      const validOnlineTime = hoursValue(row.mappedData.validOnlineTime || row.mappedData.workingHours);
      const courierId = text(row.mappedData.courierId || row.mappedData.appUserId);
      const performanceData = {
        projectId: "keeta",
        applicationProjectId: args.applicationProjectId,
        driverId: link.driverId,
        applicationAccountId: link.applicationAccountId,
        courierId,
        courierFirstName: text(row.mappedData.courierFirstName) || null,
        courierLastName: text(row.mappedData.courierLastName) || null,
        supervisorName: text(row.mappedData.supervisorName) || null,
        vehicleType: text(row.mappedData.vehicleType) || null,
        cityId: link.cityId ?? args.cityId,
        reportDate,
        month: monthFrom(reportDate),
        periodStart,
        periodEnd,
        shiftAttendanceSummary: text(row.mappedData.shiftAttendanceSummary) || null,
        onShift: boolValue(row.mappedData.onShift),
        validDay: boolValue(row.mappedData.validDay),
        courierAppOnlineTime: hoursValue(row.mappedData.courierAppOnlineTime),
        validOnlineTime,
        peakOnlineHours: hoursValue(row.mappedData.peakOnlineHours),
        acceptedTasks: intValue(row.mappedData.acceptedTasks),
        tasksWithRestaurantArrivals: intValue(row.mappedData.tasksWithRestaurantArrivals),
        deliveredTasks,
        largeOrderTasksCompleted: intValue(row.mappedData.largeOrderTasksCompleted),
        rejectedTasks: intValue(row.mappedData.rejectedTasks),
        rejectedTasksCourier: intValue(row.mappedData.rejectedTasksCourier),
        rejectedTasksAuto: intValue(row.mappedData.rejectedTasksAuto),
        cancellationRateFromDeliveryIssues: rateValue(row.mappedData.cancellationRateFromDeliveryIssues),
        orderCompletionRateNonDelivery: rateValue(row.mappedData.orderCompletionRateNonDelivery),
        onTimeRate: rateValue(row.mappedData.onTimeRate),
        largeOrderOnTimeRate: rateValue(row.mappedData.largeOrderOnTimeRate),
        avgDeliveryTime: numberValue(row.mappedData.avgDeliveryTime),
        deliveredOrdersOver55MinPercent: rateValue(row.mappedData.deliveredOrdersOver55MinPercent),
        overdueOrderTasks: intValue(row.mappedData.overdueOrderTasks),
        severelyOverdueOrderTasks: intValue(row.mappedData.severelyOverdueOrderTasks),
        rawData: json(row.rawData),
        importBatchId: batchId,
        status: "Approved",
        approvedBy: args.userId ?? null,
        approvedAt,
      };
      const existingPerformance = await tx.keetaPerformanceRecord.findMany({
        where: {
          courierId,
          reportDate: { gte: reportDate, lte: endOfUtcDay(reportDate) },
          ...(args.applicationProjectId ? { applicationProjectId: args.applicationProjectId } : {}),
          ...((link.cityId ?? args.cityId) ? { cityId: link.cityId ?? args.cityId } : {}),
        },
        select: { id: true },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      });
      if (existingPerformance[0]) {
        await tx.keetaPerformanceRecord.update({ where: { id: existingPerformance[0].id }, data: performanceData });
        const duplicateIds = existingPerformance.slice(1).map((record) => record.id);
        if (duplicateIds.length) await tx.keetaPerformanceRecord.deleteMany({ where: { id: { in: duplicateIds } } });
      } else {
        await tx.keetaPerformanceRecord.create({ data: performanceData });
      }

      if (link.driverId) {
        const existingReports = await tx.dailyReport.findMany({
          where: {
            driverId: link.driverId,
            reportDate: { gte: reportDate, lte: endOfUtcDay(reportDate) },
            appName: "Keeta",
            ...(args.applicationProjectId ? { applicationProjectId: args.applicationProjectId } : {}),
            ...((link.cityId ?? args.cityId) ? { cityId: link.cityId ?? args.cityId } : {}),
          },
          select: { id: true },
          orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        });
        const existing = existingReports[0];
        const dailyData = {
          reportDate,
          month: monthFrom(reportDate),
          driverId: link.driverId,
          cityId: link.cityId ?? args.cityId,
          projectId: null,
          applicationId: preview.summary.applicationId || null,
          applicationProjectId: args.applicationProjectId,
          appName: "Keeta",
          orders: deliveredTasks,
          workingHours: validOnlineTime,
          onTimeRate: rateValue(row.mappedData.onTimeRate),
          cancellationRate: rateValue(row.mappedData.cancellationRateFromDeliveryIssues),
          rejectionRate: intValue(row.mappedData.rejectedTasks),
        };
        if (existing) {
          await tx.dailyReport.update({ where: { id: existing.id }, data: dailyData });
          const duplicateIds = existingReports.slice(1).map((report) => report.id);
          if (duplicateIds.length) await tx.dailyReport.deleteMany({ where: { id: { in: duplicateIds } } });
          updatedDailyReports += 1;
        } else {
          await tx.dailyReport.create({ data: dailyData });
          createdDailyReports += 1;
        }
      }
    }
    return { keetaPerformanceRecords: validRows.length, createdDailyReports, updatedDailyReports };
  }

  if (importType === KEETA_DRIVER_INVOICE_TEMPLATE) {
    const requiredLinks = await resolveRequiredKeetaLinks(tx, validRows, {
      applicationId: preview.summary.applicationId,
      applicationProjectId: args.applicationProjectId,
      cityId: args.cityId,
    });
    for (const row of validRows) {
      const link = requiredLinks.get(row.rowNumber)!;
      const courierId = text(row.mappedData.courierId || row.mappedData.appUserId);
      const invoiceData = {
        projectId: "keeta",
        applicationProjectId: args.applicationProjectId,
        driverId: link.driverId,
        applicationAccountId: link.applicationAccountId,
        courierId,
        courierName: text(row.mappedData.courierName) || null,
        partnerId: text(row.mappedData.partnerId) || null,
        partnerName: text(row.mappedData.partnerName) || null,
        billingCycle: text(row.mappedData.billingCycle) || null,
        cityId: link.cityId ?? args.cityId,
        month,
        periodStart,
        periodEnd,
        isValid: boolValue(row.mappedData.isValid),
        reason: text(row.mappedData.reason) || null,
        onlineDaysValid: numberValue(row.mappedData.onlineDaysValid),
        dailyOnlineHoursValid: numberValue(row.mappedData.dailyOnlineHoursValid),
        dailyOnlineHoursPeakValid: numberValue(row.mappedData.dailyOnlineHoursPeakValid),
        deliveredOrders: intValue(row.mappedData.deliveredOrders),
        orderBasedPricing: numberValue(row.mappedData.orderBasedPricing),
        distanceFromPriceIncrease: numberValue(row.mappedData.distanceFromPriceIncrease),
        validDaCapacityIncentives: numberValue(row.mappedData.validDaCapacityIncentives),
        experienceIncentive: numberValue(row.mappedData.experienceIncentive),
        dxgy: numberValue(row.mappedData.dxgy),
        subsidy: numberValue(row.mappedData.subsidy),
        activitiesAndOtherRewards: numberValue(row.mappedData.activitiesAndOtherRewards),
        deduction: numberValue(row.mappedData.deduction),
        foodCompensation: numberValue(row.mappedData.foodCompensation),
        registrationServiceFee: numberValue(row.mappedData.registrationServiceFee),
        otherAdjustment: numberValue(row.mappedData.otherAdjustment),
        tipsExcludingTax: numberValue(row.mappedData.tipsExcludingTax),
        tgaDeductionVatExcluded: numberValue(row.mappedData.tgaDeductionVatExcluded),
        totalPayableAmount: numberValue(row.mappedData.totalPayableAmount),
        rawData: json(row.rawData),
        invoiceBatchId: batchId,
        status: "Approved",
        approvedBy: args.userId ?? null,
        approvedAt,
      };
      const existingInvoices = await tx.keetaInvoiceRecord.findMany({
        where: {
          courierId,
          month,
          ...(args.applicationProjectId ? { applicationProjectId: args.applicationProjectId } : {}),
          ...((link.cityId ?? args.cityId) ? { cityId: link.cityId ?? args.cityId } : {}),
        },
        select: { id: true },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      });
      if (existingInvoices[0]) {
        await tx.keetaInvoiceRecord.update({ where: { id: existingInvoices[0].id }, data: invoiceData });
        const duplicateIds = existingInvoices.slice(1).map((record) => record.id);
        if (duplicateIds.length) await tx.keetaInvoiceRecord.deleteMany({ where: { id: { in: duplicateIds } } });
      } else {
        await tx.keetaInvoiceRecord.create({ data: invoiceData });
      }
    }

    const details = preview.keetaInvoiceDetails?.filter((row) => row.severity !== "error" && row.status !== "ignored") ?? [];
    const detailCourierIds = [...new Set(details.map((row) => text(row.mappedData.courierId || row.mappedData.appUserId)).filter(Boolean))];
    const detailBillingCycles = [...new Set(details.map((row) => text(row.mappedData.billingCycle)).filter(Boolean))];
    if (detailCourierIds.length) {
      await tx.keetaInvoiceDetailRecord.deleteMany({
        where: {
          courierId: { in: detailCourierIds },
          ...(args.applicationProjectId ? { applicationProjectId: args.applicationProjectId } : {}),
          ...(detailBillingCycles.length ? { billingCycle: { in: detailBillingCycles } } : {}),
        },
      });
    }
    const detailLinks = details.length
      ? await resolveRequiredKeetaLinks(tx, details, {
          applicationId: preview.summary.applicationId,
          applicationProjectId: args.applicationProjectId,
          cityId: args.cityId,
        })
      : new Map<number, Awaited<ReturnType<typeof findAccountAndDriver>>>();
    for (const row of details) {
      const link = detailLinks.get(row.rowNumber)!;
      await tx.keetaInvoiceDetailRecord.create({
        data: {
          projectId: "keeta",
          applicationProjectId: args.applicationProjectId,
          invoiceBatchId: batchId,
          driverId: link.driverId,
          applicationAccountId: link.applicationAccountId,
          courierId: text(row.mappedData.courierId || row.mappedData.appUserId),
          courierName: text(row.mappedData.courierName) || null,
          partnerId: text(row.mappedData.partnerId) || null,
          partnerName: text(row.mappedData.partnerName) || null,
          billingCycle: text(row.mappedData.billingCycle) || null,
          transactionType: text(row.mappedData.transactionType) || null,
          businessId: text(row.mappedData.businessId) || null,
          note: text(row.mappedData.note) || null,
          feeType: text(row.mappedData.feeType) || null,
          detailAmount: numberValue(row.mappedData.detailAmount),
          totalPayableAmount: numberValue(row.mappedData.totalPayableAmount),
          deliveryDistance: numberValue(row.mappedData.deliveryDistance),
          ticketId: text(row.mappedData.ticketId) || null,
          violationId: text(row.mappedData.violationId) || null,
          violationType: text(row.mappedData.violationType) || null,
          punishmentMethods: text(row.mappedData.punishmentMethods) || null,
          timeOfFaceVerification: text(row.mappedData.timeOfFaceVerification) || null,
          faceVerificationResult: text(row.mappedData.faceVerificationResult) || null,
          rawData: json(row.rawData),
        },
      });
    }

    return { keetaInvoiceRecords: validRows.length, keetaInvoiceDetailRecords: details.length };
  }

  return null;
}

export function keetaInvoiceAmount(preview: ImportPreviewPayload) {
  if (preview.summary.importType !== KEETA_DRIVER_INVOICE_TEMPLATE) return 0;
  return numberValue(preview.summary.totals?.totalPayableAmount);
}
