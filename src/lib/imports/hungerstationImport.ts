import type { ParsedImportFile, ParsedImportSheet } from "./parseCsv";
import { validateImportRows, type ImportPreviewRow } from "./validateRows";
import type { ImportColumn, ImportColumnMapping } from "./templates";
import type { ImportPreviewPayload } from "./previewImport";

function text(value: unknown) {
  return String(value ?? "").trim();
}

function normalizedSheetName(value: string) {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function numberValue(value: unknown, fallback = 0) {
  const raw = text(value).replace(/,/g, "").replace(/[^\d.\-]/g, "");
  if (!raw) return fallback;
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function sumRows(rows: ImportPreviewRow[], key: string) {
  return Math.round(rows.reduce((sum, row) => sum + numberValue(row.mappedData[key]), 0) * 100) / 100;
}

function monthFromFileName(fileName: string) {
  const match = fileName.match(/(20\d{2})[-_\s#]*(0[1-9]|1[0-2])/);
  return match ? `${match[1]}-${match[2]}` : "";
}

function firstSheet(sheets: ParsedImportSheet[], names: string[]) {
  const wanted = new Set(names.map(normalizedSheetName));
  return sheets.find((sheet) => wanted.has(normalizedSheetName(sheet.name)));
}

function uniqueColumns(...groups: string[][]) {
  return Array.from(new Set(groups.flat().filter(Boolean)));
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
}) {
  const sheets = args.parsed.sheets?.length ? args.parsed.sheets : [{ name: "Rider LVL", columns: args.parsed.columns, rows: args.parsed.rows }];
  const riderLevel = firstSheet(sheets, ["Rider LVL", "Rider Level", "rider_lvl"]) ?? sheets[0];
  const riderBreakdown = firstSheet(sheets, ["Rider Breakdown", "Breakdown"]);

  if (!riderLevel) throw new Error("لم يتم العثور على شيت Rider LVL داخل فاتورة HungerStation.");

  const fallbackMonth = monthFromFileName(args.fileName);
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
      report_month: row.report_month || breakdown.report_month || fallbackMonth,
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
  });

  const month = text(result.rows[0]?.mappedData.reportDate).slice(0, 7) || fallbackMonth;
  const summary = {
    ...result.summary,
    sheetNames: sheets.map((sheet) => sheet.name),
    month,
    matchedDrivers: result.rows.filter((row) => row.driverId).length,
    unmatchedRows: result.rows.filter((row) => row.errorType === "missing_driver" || row.errorType === "duplicate_match").length,
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
        sumRows(result.rows, "latePenalty") +
        sumRows(result.rows, "noShowPenalty") +
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
    message: "هذه معاينة فقط. لم يتم حفظ أي بيانات في قاعدة البيانات بعد.",
  } satisfies ImportPreviewPayload;
}
