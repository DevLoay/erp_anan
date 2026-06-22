import { parseCsvBuffer } from "./parseCsv";
import { parseExcelBuffer } from "./parseExcel";
import { databaseOfflineMessage, resolveTemplateForUse } from "./templates";
import { KEETA_DRIVER_INVOICE_TEMPLATE, KEETA_PERIOD_REPORT_TEMPLATE, KEETA_RANK_TEMPLATE } from "./templates";
import { buildKeetaDriverInvoicePreview, enrichKeetaPreview } from "./keetaImport";
import { buildHungerStationInvoicePreview } from "./hungerstationImport";
import { validateImportRows, type ImportPreviewRow, type ImportPreviewSummary } from "./validateRows";

export type ImportPreviewPayload = {
  summary: ImportPreviewSummary;
  columns: string[];
  missingColumns: { key: string; displayName: string }[];
  rows: ImportPreviewRow[];
  message: string;
  sheets?: string[];
  keetaInvoiceDetails?: ImportPreviewRow[];
};

function baseImportType(importType: string) {
  if (importType.endsWith("_drivers")) return "drivers";
  if (importType.endsWith("_accounts")) return "application_accounts";
  return importType;
}

export async function buildImportPreview(args: {
  fileName: string;
  buffer: Buffer;
  importType: string;
  templateId: string | null;
  applicationId: string;
  applicationProjectId: string;
  projectId?: string;
  cityId?: string;
  month?: string;
}): Promise<ImportPreviewPayload> {
  try {
    const lowerName = args.fileName.toLowerCase();
    const parsed = lowerName.endsWith(".csv") ? parseCsvBuffer(args.buffer) : await parseExcelBuffer(args.buffer);
    const importType =
      args.importType === "keeta_invoice"
        ? KEETA_DRIVER_INVOICE_TEMPLATE
        : args.importType === "keeta_rank"
          ? KEETA_RANK_TEMPLATE
          : args.importType;
    const template = await resolveTemplateForUse(args.templateId, baseImportType(importType));

    if (template.fileType === KEETA_DRIVER_INVOICE_TEMPLATE) {
      return buildKeetaDriverInvoicePreview({
        fileName: args.fileName,
        parsed,
        requiredColumns: template.requiredColumns,
        optionalColumns: template.optionalColumns,
        columnMapping: template.columnMapping,
        applicationId: args.applicationId,
        applicationProjectId: args.applicationProjectId,
        projectId: args.projectId ?? "",
        cityId: args.cityId ?? "",
        templateId: template.source === "database" ? template.id : "",
        month: args.month,
      });
    }

    if (template.fileType === "hungerstation_invoice") {
      return buildHungerStationInvoicePreview({
        fileName: args.fileName,
        parsed,
        requiredColumns: template.requiredColumns,
        optionalColumns: template.optionalColumns,
        columnMapping: template.columnMapping,
        applicationId: args.applicationId,
        applicationProjectId: args.applicationProjectId,
        projectId: args.projectId ?? "",
        cityId: args.cityId ?? "",
        templateId: template.source === "database" ? template.id : "",
      });
    }

    const result = await validateImportRows({
      fileType: importType,
      sourceColumns: parsed.columns,
      rawRows: parsed.rows,
      requiredColumns: template.requiredColumns,
      optionalColumns: template.optionalColumns,
      columnMapping: template.columnMapping,
      fileName: args.fileName,
      applicationId: args.applicationId,
      applicationProjectId: args.applicationProjectId,
      projectId: args.projectId ?? "",
      cityId: args.cityId ?? "",
      templateId: template.source === "database" ? template.id : "",
    });

    return enrichKeetaPreview({
      summary: {
        ...result.summary,
        month: args.month || result.summary.month,
      },
      columns: result.columns,
      missingColumns: result.missingColumns.map((column) => ({ key: column.key, displayName: column.displayName })),
      rows: result.rows,
      sheets: parsed.sheets?.map((sheet) => sheet.name),
      message: "هذه معاينة فقط. لم يتم حفظ أي بيانات في قاعدة البيانات بعد.",
    });
  } catch (error) {
    const offline = databaseOfflineMessage(error);
    if (offline) throw new Error(offline);
    throw error;
  }
}
