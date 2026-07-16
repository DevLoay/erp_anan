import { Prisma, RecordStatus } from "@prisma/client";
import type { ParsedImportFile, ParsedImportSheet } from "./parseCsv";
import { validateImportRows, type ImportPreviewRow } from "./validateRows";
import type { ImportColumn, ImportColumnMapping } from "./templates";
import type { ImportPreviewPayload } from "./previewImport";
import { findOperationalAccount, findOrCreateApplication, resolveOperationalProject, upsertOperationalApplicationAccount } from "@/lib/application-accounts/accountLinking";
import { monthDateRange, upsertAccountUsage, accountUsageRisk, accountUsageType } from "@/lib/application-accounts/accountUsage";

function text(value: unknown) {
  return String(value ?? "").trim();
}

function normalizedSheetName(value: string) {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function numberValue(value: unknown, fallback = 0) {
  if (value instanceof Prisma.Decimal) return value.toNumber();
  const raw = text(value).replace(/,/g, "").replace("%", "").replace(/[^\d.\-]/g, "");
  if (!raw) return fallback;
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function decimal(value: unknown) {
  return new Prisma.Decimal(numberValue(value));
}

function intValue(value: unknown, fallback = 0) {
  return Math.round(numberValue(value, fallback));
}

function rateValue(value: unknown, fallback = 0) {
  const rate = numberValue(value, fallback);
  if (rate > 0 && rate <= 1) return Math.round(rate * 10000) / 100;
  return Math.round(rate * 100) / 100;
}

function hoursValue(value: unknown, fallback = 0) {
  const raw = text(value).toLowerCase();
  if (!raw) return fallback;
  const numeric = numberValue(raw, Number.NaN);
  if (Number.isFinite(numeric)) return Math.round(numeric * 100) / 100;

  const clockMatch = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (clockMatch) {
    const hours = Number(clockMatch[1]);
    const minutes = Number(clockMatch[2]) / 60;
    const seconds = clockMatch[3] ? Number(clockMatch[3]) / 3600 : 0;
    return Math.round((hours + minutes + seconds) * 100) / 100;
  }

  return fallback;
}

function dateValue(value: unknown) {
  const raw = text(value);
  if (!raw) return null;
  if (/^\d{8}$/.test(raw)) {
    const parsed = new Date(Date.UTC(Number(raw.slice(0, 4)), Number(raw.slice(4, 6)) - 1, Number(raw.slice(6, 8))));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

function monthFromDate(value: string) {
  return value.slice(0, 7);
}

function sumRows(rows: ImportPreviewRow[], key: string) {
  return Math.round(rows.reduce((sum, row) => sum + numberValue(row.mappedData[key]), 0) * 100) / 100;
}

function avgRows(rows: ImportPreviewRow[], key: string) {
  const values = rows.map((row) => numberValue(row.mappedData[key], Number.NaN)).filter(Number.isFinite);
  if (!values.length) return 0;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
}

function monthFromFileName(fileName: string) {
  const monthNames: Record<string, string> = {
    january: "01",
    jan: "01",
    february: "02",
    feb: "02",
    march: "03",
    mar: "03",
    april: "04",
    apr: "04",
    may: "05",
    june: "06",
    jun: "06",
    july: "07",
    jul: "07",
    august: "08",
    aug: "08",
    september: "09",
    sep: "09",
    october: "10",
    oct: "10",
    november: "11",
    nov: "11",
    december: "12",
    dec: "12",
  };
  const lower = fileName.toLowerCase();
  const numeric = lower.match(/(20\d{2})[-_\s#]*(0[1-9]|1[0-2])|(?:^|[^\d])(0[1-9]|1[0-2])[-_\s#]*(20\d{2})/);
  if (numeric?.[1] && numeric[2]) return `${numeric[1]}-${numeric[2]}`;
  if (numeric?.[3] && numeric[4]) return `${numeric[4]}-${numeric[3]}`;
  for (const [name, month] of Object.entries(monthNames)) {
    const match = lower.match(new RegExp(`${name}[^0-9]*(20)?(\\d{2})`));
    if (match) return `${match[1] ? "20" : "20"}${match[2]}-${month}`;
  }
  return "";
}

function firstSheet(sheets: ParsedImportSheet[], names: string[]) {
  const wanted = new Set(names.map(normalizedSheetName));
  return sheets.find((sheet) => wanted.has(normalizedSheetName(sheet.name)));
}

function uniqueColumns(...groups: string[][]) {
  return Array.from(new Set(groups.flat().filter(Boolean)));
}

function normalizeKey(value: unknown) {
  return text(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/[\s_\-.,()#/\\]+/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

const HUNGERSTATION_CITY_MAP = [
  { nameAr: "الدمام", nameEn: "Dammam", aliases: ["eastern province", "easternprovince", "dammam", "الدمام"] },
  { nameAr: "الإحساء", nameEn: "Al Ahsa", aliases: ["al ahsa", "al-ahsa", "alahsa", "ahsa", "الاحساء", "الأحساء", "الإحساء", "الاحسا", "الأحسا"] },
  { nameAr: "أبها", nameEn: "Abha", aliases: ["abha province", "abha", "ابها", "أبها"] },
  { nameAr: "مكة", nameEn: "Makkah", aliases: ["mecca", "makkah", "مكة", "مكه"] },
  { nameAr: "جدة", nameEn: "Jeddah", aliases: ["jeddah", "جدة", "جده"] },
  { nameAr: "المدينة المنورة", nameEn: "Madinah", aliases: ["medina", "madinah", "المدينة", "المدينة المنورة"] },
  { nameAr: "الرياض", nameEn: "Riyadh", aliases: ["riyadh", "الرياض"] },
];

export function normalizeHungerStationCityName(value: unknown) {
  const key = normalizeKey(value);
  if (!key) return "";
  const match = HUNGERSTATION_CITY_MAP.find((city) => city.aliases.some((alias) => key === normalizeKey(alias) || key.includes(normalizeKey(alias))));
  return match?.nameAr || "";
}

async function findHungerStationCity(tx: Prisma.TransactionClient, value: unknown) {
  const normalized = normalizeHungerStationCityName(value);
  if (!normalized) return null;
  const cityDef = HUNGERSTATION_CITY_MAP.find((city) => city.nameAr === normalized);
  const names = Array.from(new Set([normalized, cityDef?.nameEn, ...(cityDef?.aliases ?? [])].filter(Boolean) as string[]));
  return tx.city.findFirst({
    where: {
      OR: names.flatMap((name) => [
        { nameAr: { equals: name, mode: "insensitive" as Prisma.QueryMode } },
        { nameEn: { equals: name, mode: "insensitive" as Prisma.QueryMode } },
      ]),
    },
    select: { id: true, nameAr: true, nameEn: true },
  });
}

async function resolveHungerStationScope(tx: Prisma.TransactionClient, args: {
  applicationId?: string | null;
  applicationProjectId?: string | null;
  cityId?: string | null;
}) {
  let applicationId = args.applicationId || null;
  if (!applicationId) {
    const app = await findOrCreateApplication(tx, "HungerStation");
    applicationId = app.id;
  }

  const project = await resolveOperationalProject(tx, {
    applicationId,
    applicationName: "HungerStation",
    applicationProjectId: args.applicationProjectId || null,
    cityId: args.cityId || null,
  });

  return {
    applicationId: applicationId || project?.applicationId || null,
    applicationProjectId: args.applicationProjectId || project?.id || null,
    cityId: args.cityId || project?.cityId || null,
    projectId: project?.projectId || null,
  };
}

async function ensureHungerStationAccount(tx: Prisma.TransactionClient, args: {
  appUserId: string;
  applicationId?: string | null;
  applicationProjectId?: string | null;
  cityId?: string | null;
  driverId?: string | null;
}) {
  if (!args.appUserId) return null;
  const found = await findOperationalAccount(tx, {
    applicationId: args.applicationId || undefined,
    applicationProjectId: args.applicationProjectId || undefined,
    cityId: args.cityId || undefined,
  }, {
    appUserId: args.appUserId,
    username: args.appUserId,
    appUsername: args.appUserId,
  });

  if (found && !("duplicate" in found)) return found;

  if (found && "duplicate" in found) {
    const preferred = found.matches.find((match) => match.driverId === args.driverId) ?? found.matches[0];
    return preferred ?? null;
  }

  return upsertOperationalApplicationAccount(tx, {
    appName: "HungerStation",
    applicationId: args.applicationId || null,
    applicationProjectId: args.applicationProjectId || null,
    cityId: args.cityId || null,
    appUserId: args.appUserId,
    appUsername: args.appUserId,
    username: args.appUserId,
    driverId: args.driverId || null,
    status: RecordStatus.ACTIVE,
    source: "HUNGERSTATION_IMPORT",
    updateDriverPrimaryAccount: Boolean(args.driverId),
  });
}

function reviewReason(parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" | ") || null;
}

export async function buildHungerStationDailyPerformancePreview(args: {
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
  reportDate?: string;
}) {
  const reportDateProvidedByUser = Boolean(dateValue(args.reportDate));
  args.reportDate =
    args.reportDate ||
    text(args.parsed.rows.map((row) => row["Report Date"] ?? row.reportDate ?? row.date ?? row.Date).find((value) => dateValue(value)));
  const reportDateFromFile = args.parsed.rows
    .map((row) => row["Report Date"] ?? row.reportDate ?? row.date ?? row.Date)
    .map(dateValue)
    .find(Boolean);
  const explicitReportDate = reportDateProvidedByUser;
  const reportDate = dateValue(args.reportDate) ?? reportDateFromFile;
  if (!reportDate) throw new Error("تاريخ تقرير HungerStation اليومي مطلوب وصيغته غير صحيحة.");
  const reportDateIso = reportDate.toISOString().slice(0, 10);
  const month = monthFromDate(reportDate.toISOString().slice(0, 10));
  const result = await validateImportRows({
    fileType: "hungerstation_performance",
    sourceColumns: uniqueColumns(args.parsed.columns, ["Report Date"]),
    rawRows: args.parsed.rows,
    requiredColumns: args.requiredColumns,
    optionalColumns: args.optionalColumns,
    columnMapping: args.columnMapping,
    fileName: args.fileName,
    applicationId: args.applicationId,
    applicationProjectId: args.applicationProjectId,
    projectId: args.projectId ?? "",
    cityId: args.cityId ?? "",
    templateId: args.templateId,
    staticMappedData: explicitReportDate ? { reportDate: reportDateIso, month } : { month },
  });

  const cities = Array.from(new Set(result.rows.map((row) => normalizeHungerStationCityName(row.mappedData.city)).filter(Boolean)));
  const rows = result.rows.map((row) => {
    const normalizedCity = normalizeHungerStationCityName(row.mappedData.city);
    const cityReview = normalizedCity ? null : "لم يتم التعرف على مدينة HungerStation من City Name.";
    return {
      ...row,
      mappedData: { ...row.mappedData, normalizedCity, month },
      errorType: row.errorType || (cityReview ? "city_needs_review" : undefined),
      errorMessage: [row.errorMessage, cityReview].filter(Boolean).join(" | "),
      severity: cityReview && row.severity === "ready" ? ("warning" as const) : row.severity,
      status: cityReview && row.status === "ready" ? "warning" : row.status,
    };
  });

  return {
    summary: {
      ...result.summary,
      totalRows: rows.length,
      validRows: rows.filter((row) => row.severity !== "error").length,
      invalidRows: rows.filter((row) => row.severity === "error").length,
      rowsReadyToSave: rows.filter((row) => row.severity !== "error").length,
      month,
      periodStart: reportDate.toISOString(),
      periodEnd: reportDate.toISOString(),
      matchedDrivers: rows.filter((row) => row.driverId).length,
      unmatchedRows: rows.filter((row) => row.errorType === "unlinked_account" || !row.driverId).length,
      totals: {
        completedDeliveries: sumRows(rows, "completedDeliveries"),
        declinedDeliveries: sumRows(rows, "declinedDeliveries"),
        cancelledDeliveries: sumRows(rows, "cancelledDeliveries"),
        actualWorkingHours: sumRows(rows, "actualWorkingHours"),
        averageAttendanceRate: avgRows(rows, "attendanceRate"),
        averageAcceptanceRate: avgRows(rows, "acceptanceRate"),
        cities: cities.join(", "),
      },
    },
    columns: result.columns,
    missingColumns: result.missingColumns.map((column) => ({ key: column.key, displayName: column.displayName })),
    rows,
    sheets: args.parsed.sheets?.map((sheet) => sheet.name),
    message: "هذه معاينة تقرير HungerStation اليومي. سيتم حفظ الصفوف غير المربوطة وإرسالها لمراجعة استخدام الحسابات بدل رفض الملف.",
  } satisfies ImportPreviewPayload;
}

export async function buildHungerStationInvoicePreview(args: {
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
  const month = text(args.month) || monthFromFileName(args.fileName);
  if (!/^20\d{2}-\d{2}$/.test(month)) throw new Error("شهر فاتورة HungerStation مطلوب بصيغة YYYY-MM قبل إنشاء المعاينة.");
  const sheets = args.parsed.sheets?.length ? args.parsed.sheets : [{ name: "Rider LVL", columns: args.parsed.columns, rows: args.parsed.rows }];
  const riderLevel = firstSheet(sheets, ["Rider LVL", "Rider Level", "rider_lvl"]) ?? sheets[0];
  const riderBreakdown = firstSheet(sheets, ["Rider Breakdown", "Breakdown"]);

  if (!riderLevel) throw new Error("لم يتم العثور على شيت Rider LVL داخل فاتورة HungerStation.");

  const breakdownByRider = new Map<string, Record<string, unknown>>();

  for (const row of riderBreakdown?.rows ?? []) {
    const riderId = text(row.rider_id);
    if (!riderId) continue;
    const previous = breakdownByRider.get(riderId);
    if (!previous) {
      breakdownByRider.set(riderId, { ...row });
      continue;
    }
    previous.completed_orders = numberValue(previous.completed_orders) + numberValue(row.completed_orders);
    previous.total_monthly_working_hours = numberValue(previous.total_monthly_working_hours) + numberValue(row.total_monthly_working_hours);
    previous.working_days = Math.max(numberValue(previous.working_days), numberValue(row.working_days));
  }

  const rawRows = riderLevel.rows.map((row) => {
    const riderId = text(row.rider_id);
    const breakdown = breakdownByRider.get(riderId) ?? {};
    return {
      ...row,
      report_month: month,
      city_name: row.city_name || breakdown.city_name || "",
      total_monthly_working_hours: row.total_monthly_working_hours || breakdown.total_monthly_working_hours || "",
      working_days: row.working_days || breakdown.working_days || "",
    };
  });

  const result = await validateImportRows({
    fileType: "hungerstation_invoice",
    sourceColumns: uniqueColumns(riderLevel.columns, riderBreakdown?.columns ?? [], ["report_month", "city_name", "total_monthly_working_hours", "working_days"]),
    rawRows,
    requiredColumns: args.requiredColumns,
    optionalColumns: args.optionalColumns,
    columnMapping: args.columnMapping,
    fileName: args.fileName,
    applicationId: args.applicationId,
    applicationProjectId: args.applicationProjectId,
    projectId: args.projectId ?? "",
    cityId: args.cityId ?? "",
    templateId: args.templateId,
    staticMappedData: { month, reportDate: `${month}-01` },
  });

  const summary = {
    ...result.summary,
    month,
    sheetNames: sheets.map((sheet) => sheet.name),
    matchedDrivers: result.rows.filter((row) => row.driverId).length,
    unmatchedRows: result.rows.filter((row) => row.errorType === "unlinked_account" || row.errorType === "duplicate_match" || !row.driverId).length,
    totals: {
      completedOrders: sumRows(result.rows, "orders"),
      workingHours: sumRows(result.rows, "workingHours"),
      cityPayment: sumRows(result.rows, "cityPayment"),
      basicPayment: sumRows(result.rows, "basicPayment"),
      distancePayment: sumRows(result.rows, "distancePayment"),
      penalties:
        sumRows(result.rows, "acceptanceRatePenalties") +
        sumRows(result.rows, "contactRatePenalties") +
        sumRows(result.rows, "stackingDeduction") +
        sumRows(result.rows, "declinedPenaltiesDayLogic") +
        sumRows(result.rows, "latePenalty") +
        sumRows(result.rows, "noShowPenalty") +
        sumRows(result.rows, "noShowPenaltySpecialCities") +
        sumRows(result.rows, "dailyAcceptanceRatePenalty") +
        sumRows(result.rows, "missedDaysPenalty"),
      riderBalance: sumRows(result.rows, "collectionAmount"),
    },
  };

  return {
    summary,
    columns: result.columns,
    missingColumns: result.missingColumns.map((column) => ({ key: column.key, displayName: column.displayName })),
    rows: result.rows,
    sheets: sheets.map((sheet) => sheet.name),
    message: "هذه معاينة فاتورة HungerStation الشهرية. لن يتم اعتبار rider_id مندوبًا داخليًا إلا بعد ربط الحساب أو اعتماد استخدام الحساب.",
  } satisfies ImportPreviewPayload;
}

export async function commitHungerStationRecords(args: {
  tx: Prisma.TransactionClient;
  batchId: string;
  preview: ImportPreviewPayload;
  userId?: string | null;
}) {
  if (args.preview.summary.importType === "hungerstation_performance") return commitHungerStationDailyRecords(args);
  if (args.preview.summary.importType === "hungerstation_invoice") return commitHungerStationInvoiceRecords(args);
  return null;
}

async function commitHungerStationDailyRecords(args: {
  tx: Prisma.TransactionClient;
  batchId: string;
  preview: ImportPreviewPayload;
  userId?: string | null;
}) {
  const { tx, batchId, preview } = args;
  let createdDailyReports = 0;
  let updatedDailyReports = 0;
  let accountUsageRows = 0;
  let linkedAccounts = 0;
  let needsReview = 0;

  for (const row of preview.rows.filter((item) => item.severity !== "error" && item.status !== "ignored")) {
    const mapped = row.mappedData;
    const reportDate = dateValue(mapped.reportDate);
    if (!reportDate) continue;
    const month = text(mapped.month) || monthFromDate(reportDate.toISOString().slice(0, 10));
    const riderIdFromFile = text(mapped.appUserId);
    if (!riderIdFromFile) continue;

    const cityFromFile = text(mapped.city);
    const normalizedCity = normalizeHungerStationCityName(cityFromFile);
    const city = await findHungerStationCity(tx, cityFromFile);
    const scoped = await resolveHungerStationScope(tx, {
      applicationId: preview.summary.applicationId || null,
      applicationProjectId: preview.summary.applicationProjectId || null,
      cityId: city?.id || preview.summary.cityId || null,
    });

    const account = await ensureHungerStationAccount(tx, {
      appUserId: riderIdFromFile,
      applicationId: scoped.applicationId,
      applicationProjectId: scoped.applicationProjectId,
      cityId: city?.id || scoped.cityId,
      driverId: row.driverId || null,
    });
    if (account?.id) linkedAccounts += 1;

    const ownerDriverId = account?.driverId || null;
    const driverId = row.driverId || account?.driverId || null;
    const actualDriverId = row.driverId || null;
    const matchingStatus = driverId && account?.id && normalizedCity ? "MATCHED" : "NEEDS_REVIEW";
    const reason = reviewReason([
      !normalizedCity && `city_not_normalized:${cityFromFile || "empty"}`,
      normalizedCity && !city?.id && `city_not_found:${normalizedCity}`,
      !account?.id && `account_not_found:${riderIdFromFile}`,
      !driverId && "driver_not_linked",
    ]);
    if (matchingStatus !== "MATCHED") needsReview += 1;

    const data = {
      reportDate,
      month,
      applicationId: scoped.applicationId,
      applicationProjectId: scoped.applicationProjectId,
      cityId: city?.id || scoped.cityId,
      riderIdFromFile,
      applicationAccountId: account?.id || row.applicationAccountId || null,
      driverId,
      contractName: text(mapped.contractName) || null,
      vehicleName: text(mapped.vehicleName) || null,
      batchNumber: text(mapped.batchNumber) || null,
      tgaStatus: text(mapped.tgaStatus) || null,
      errorCodes: text(mapped.errorCodes) || null,
      shifts: text(mapped.shifts) ? intValue(mapped.shifts) : null,
      workingDays: text(mapped.workingDays) ? decimal(mapped.workingDays) : null,
      plannedWorkingHours: text(mapped.plannedWorkingHours) ? decimal(hoursValue(mapped.plannedWorkingHours)) : null,
      actualWorkingHours: text(mapped.actualWorkingHours) ? decimal(hoursValue(mapped.actualWorkingHours)) : null,
      avgWorkingHoursPerDay: text(mapped.avgWorkingHoursPerDay) ? decimal(hoursValue(mapped.avgWorkingHoursPerDay)) : null,
      attendanceRate: text(mapped.attendanceRate) ? decimal(rateValue(mapped.attendanceRate)) : null,
      breakHours: text(mapped.breakHours) ? decimal(hoursValue(mapped.breakHours)) : null,
      lostHours: text(mapped.lostHours) ? decimal(hoursValue(mapped.lostHours)) : null,
      acceptanceRate: text(mapped.acceptanceRate) ? decimal(rateValue(mapped.acceptanceRate)) : null,
      contactRate: text(mapped.contactRate) ? decimal(rateValue(mapped.contactRate)) : null,
      noShows: text(mapped.noShows) ? intValue(mapped.noShows) : null,
      noShowRate: text(mapped.noShowRate) ? decimal(rateValue(mapped.noShowRate)) : null,
      notifiedDeliveries: text(mapped.notifiedDeliveries) ? intValue(mapped.notifiedDeliveries) : null,
      completedDeliveries: text(mapped.completedDeliveries) ? intValue(mapped.completedDeliveries) : null,
      acceptedDeliveries: text(mapped.acceptedDeliveries) ? intValue(mapped.acceptedDeliveries) : null,
      stackedDeliveries: text(mapped.stackedDeliveries) ? intValue(mapped.stackedDeliveries) : null,
      declinedDeliveries: text(mapped.declinedDeliveries) ? intValue(mapped.declinedDeliveries) : null,
      cancelledDeliveries: text(mapped.cancelledDeliveries) ? intValue(mapped.cancelledDeliveries) : null,
      deductionDeliveries: text(mapped.deductionDeliveries) ? intValue(mapped.deductionDeliveries) : null,
      notAcceptedDeliveries: text(mapped.notAcceptedDeliveries) ? intValue(mapped.notAcceptedDeliveries) : null,
      manualUndispatched: text(mapped.manualUndispatched) ? intValue(mapped.manualUndispatched) : null,
      matchingStatus,
      reviewReason: reason,
      rawData: row.rawData as Prisma.InputJsonValue,
      importBatchId: batchId,
    };

    const existing = await tx.hungerStationDailyPerformanceRecord.findFirst({
      where: {
        applicationProjectId: data.applicationProjectId,
        cityId: data.cityId,
        reportDate,
        riderIdFromFile,
      },
      select: { id: true },
    });

    if (existing) {
      await tx.hungerStationDailyPerformanceRecord.update({ where: { id: existing.id }, data });
      updatedDailyReports += 1;
    } else {
      await tx.hungerStationDailyPerformanceRecord.create({ data });
      createdDailyReports += 1;
    }

    const usageData = {
      month,
      applicationId: data.applicationId,
      applicationProjectId: data.applicationProjectId,
      cityId: data.cityId,
      riderIdFromFile,
      applicationAccountId: data.applicationAccountId,
      driverId,
      usageSource: "DAILY_REPORT",
      usageDate: reportDate,
      completedDeliveries: data.completedDeliveries,
      actualWorkingHours: data.actualWorkingHours,
      workingDays: data.workingDays,
      status: matchingStatus === "MATCHED" ? "MATCHED" : "NEEDS_REVIEW",
      riskLevel: accountUsageRisk({
        appName: "HungerStation",
        ownerDriverId,
        actualDriverIds: actualDriverId ? [actualDriverId] : [],
        hasDailyData: true,
      }),
      reviewReason: reason,
    };

    const existingUsage = await tx.hungerStationAccountUsage.findFirst({
      where: {
        month,
        riderIdFromFile,
        usageSource: "DAILY_REPORT",
        usageDate: reportDate,
        applicationProjectId: data.applicationProjectId,
        cityId: data.cityId,
      },
      select: { id: true },
    });
    if (existingUsage) await tx.hungerStationAccountUsage.update({ where: { id: existingUsage.id }, data: usageData });
    else await tx.hungerStationAccountUsage.create({ data: usageData });

    if (data.applicationAccountId) {
      await upsertAccountUsage(tx, {
        applicationAccountId: data.applicationAccountId,
        applicationId: data.applicationId,
        applicationProjectId: data.applicationProjectId,
        cityId: data.cityId,
        ownerDriverId,
        actualDriverId,
        month,
        usageDate: reportDate,
        dateFrom: reportDate,
        dateTo: reportDate,
        source: "HUNGERSTATION_DAILY_REPORT",
        status: actualDriverId ? "APPROVED" : "PENDING",
        usageType: accountUsageType({ appName: "HungerStation", ownerDriverId, actualDriverId }),
        reviewReason: reason,
        appName: "HungerStation",
        rawData: {
          riderIdFromFile,
          completedDeliveries: data.completedDeliveries,
          actualWorkingHours: data.actualWorkingHours ? Number(data.actualWorkingHours) : null,
          workingDays: data.workingDays ? Number(data.workingDays) : null,
          importBatchId: batchId,
        } as Prisma.InputJsonValue,
      });
    }
    accountUsageRows += 1;
  }

  return { createdDailyReports, updatedDailyReports, createdInvoices: 0, updatedInvoices: 0, accountUsageRows, linkedAccounts, needsReview };
}

async function commitHungerStationInvoiceRecords(args: {
  tx: Prisma.TransactionClient;
  batchId: string;
  preview: ImportPreviewPayload;
  userId?: string | null;
}) {
  const { tx, batchId, preview } = args;
  const month = text(preview.summary.month);
  if (!/^20\d{2}-\d{2}$/.test(month)) throw new Error("لا يمكن اعتماد فاتورة HungerStation بدون شهر واضح.");

  let createdInvoices = 0;
  let updatedInvoices = 0;
  let accountUsageRows = 0;
  let linkedAccounts = 0;
  let needsReview = 0;

  for (const row of preview.rows.filter((item) => item.severity !== "error" && item.status !== "ignored")) {
    const mapped = row.mappedData;
    const riderIdFromFile = text(mapped.appUserId);
    if (!riderIdFromFile) continue;

    const scoped = await resolveHungerStationScope(tx, {
      applicationId: preview.summary.applicationId || null,
      applicationProjectId: preview.summary.applicationProjectId || null,
      cityId: preview.summary.cityId || null,
    });

    const account = await ensureHungerStationAccount(tx, {
      appUserId: riderIdFromFile,
      applicationId: scoped.applicationId,
      applicationProjectId: scoped.applicationProjectId,
      cityId: scoped.cityId,
      driverId: row.driverId || null,
    });
    if (account?.id) linkedAccounts += 1;

    const ownerDriverId = account?.driverId || null;
    const driverId = row.driverId || account?.driverId || null;
    const actualDriverId = row.driverId || null;
    const matchingStatus = driverId && account?.id ? "MATCHED" : "NEEDS_REVIEW";
    const reason = reviewReason([
      !account?.id && `account_not_found:${riderIdFromFile}`,
      !driverId && "driver_not_linked",
      !scoped.applicationProjectId && "application_project_missing_or_global_invoice",
      !scoped.cityId && "city_missing_or_global_invoice",
    ]);
    if (matchingStatus !== "MATCHED") needsReview += 1;

    const data = {
      month,
      applicationId: scoped.applicationId,
      applicationProjectId: scoped.applicationProjectId,
      cityId: scoped.cityId,
      riderIdFromFile,
      applicationAccountId: account?.id || row.applicationAccountId || null,
      driverId,
      contractName: text(mapped.contractName) || null,
      completedOrders: text(mapped.orders) ? intValue(mapped.orders) : null,
      cityPayment: text(mapped.cityPayment) ? decimal(mapped.cityPayment) : null,
      basicPayment: text(mapped.basicPayment) ? decimal(mapped.basicPayment) : null,
      acceptanceRatePenalties: text(mapped.acceptanceRatePenalties) ? decimal(mapped.acceptanceRatePenalties) : null,
      contactRatePenalties: text(mapped.contactRatePenalties) ? decimal(mapped.contactRatePenalties) : null,
      stackingDeduction: text(mapped.stackingDeduction) ? decimal(mapped.stackingDeduction) : null,
      declinedPenaltiesDayLogic: text(mapped.declinedPenaltiesDayLogic) ? decimal(mapped.declinedPenaltiesDayLogic) : null,
      latePenalty: text(mapped.latePenalty) ? decimal(mapped.latePenalty) : null,
      noShowPenalty: text(mapped.noShowPenalty) ? decimal(mapped.noShowPenalty) : null,
      noShowPenaltySpecialCities: text(mapped.noShowPenaltySpecialCities) ? decimal(mapped.noShowPenaltySpecialCities) : null,
      dailyAcceptanceRatePenalty: text(mapped.dailyAcceptanceRatePenalty) ? decimal(mapped.dailyAcceptanceRatePenalty) : null,
      distancePayment: text(mapped.distancePayment) ? decimal(mapped.distancePayment) : null,
      missedDaysPenalty: text(mapped.missedDaysPenalty) ? decimal(mapped.missedDaysPenalty) : null,
      courierBasicPayment: text(mapped.courierBasicPayment) ? decimal(mapped.courierBasicPayment) : null,
      courierScoringPayment: text(mapped.courierScoringPayment) ? decimal(mapped.courierScoringPayment) : null,
      riderBalance: text(mapped.collectionAmount) ? decimal(mapped.collectionAmount) : null,
      matchingStatus,
      reviewReason: reason,
      rawData: row.rawData as Prisma.InputJsonValue,
      importBatchId: batchId,
    };

    const existing = await tx.hungerStationInvoiceRecord.findFirst({
      where: {
        month,
        riderIdFromFile,
        applicationId: data.applicationId,
        applicationProjectId: data.applicationProjectId,
      },
      select: { id: true },
    });

    if (existing) {
      await tx.hungerStationInvoiceRecord.update({ where: { id: existing.id }, data });
      updatedInvoices += 1;
    } else {
      await tx.hungerStationInvoiceRecord.create({ data });
      createdInvoices += 1;
    }

    const usageData = {
      month,
      applicationId: data.applicationId,
      applicationProjectId: data.applicationProjectId,
      cityId: data.cityId,
      riderIdFromFile,
      applicationAccountId: data.applicationAccountId,
      driverId,
      usageSource: "MONTHLY_INVOICE",
      invoiceCompletedOrders: data.completedOrders,
      invoiceRiderBalance: data.riderBalance,
      status: matchingStatus === "MATCHED" ? "MATCHED" : "NEEDS_REVIEW",
      riskLevel: accountUsageRisk({
        appName: "HungerStation",
        ownerDriverId,
        actualDriverIds: actualDriverId ? [actualDriverId] : [],
        hasInvoice: true,
      }),
      reviewReason: reason,
    };

    const existingUsage = await tx.hungerStationAccountUsage.findFirst({
      where: {
        month,
        riderIdFromFile,
        usageSource: "MONTHLY_INVOICE",
        applicationProjectId: data.applicationProjectId,
      },
      select: { id: true },
    });
    if (existingUsage) await tx.hungerStationAccountUsage.update({ where: { id: existingUsage.id }, data: usageData });
    else await tx.hungerStationAccountUsage.create({ data: usageData });

    if (data.applicationAccountId) {
      const { start, end } = monthDateRange(month);
      await upsertAccountUsage(tx, {
        applicationAccountId: data.applicationAccountId,
        applicationId: data.applicationId,
        applicationProjectId: data.applicationProjectId,
        cityId: data.cityId,
        ownerDriverId,
        actualDriverId,
        month,
        dateFrom: start,
        dateTo: end,
        source: "HUNGERSTATION_MONTHLY_INVOICE",
        status: actualDriverId ? "APPROVED" : "PENDING",
        usageType: accountUsageType({ appName: "HungerStation", ownerDriverId, actualDriverId }),
        reviewReason: reason,
        appName: "HungerStation",
        rawData: {
          riderIdFromFile,
          completedOrders: data.completedOrders,
          riderBalance: data.riderBalance ? Number(data.riderBalance) : null,
          importBatchId: batchId,
        } as Prisma.InputJsonValue,
      });
    }
    accountUsageRows += 1;
  }

  return { createdDailyReports: 0, updatedDailyReports: 0, createdInvoices, updatedInvoices, accountUsageRows, linkedAccounts, needsReview };
}
