import { parseCsvBuffer } from "./parseCsv";
import { parseExcelBuffer } from "./parseExcel";
import { databaseOfflineMessage, resolveTemplateForUse } from "./templates";
import { validateImportRows, type ImportPreviewRow, type ImportPreviewSummary } from "./validateRows";

export type ImportPreviewPayload = {
  summary: ImportPreviewSummary;
  columns: string[];
  missingColumns: { key: string; displayName: string }[];
  rows: ImportPreviewRow[];
  message: string;
};

export async function buildImportPreview(args: {
  fileName: string;
  buffer: Buffer;
  importType: string;
  templateId: string | null;
  applicationId: string;
  applicationProjectId: string;
}): Promise<ImportPreviewPayload> {
  try {
    const lowerName = args.fileName.toLowerCase();
    const parsed = lowerName.endsWith(".csv") ? parseCsvBuffer(args.buffer) : await parseExcelBuffer(args.buffer);
    const template = await resolveTemplateForUse(args.templateId, args.importType);

    const result = await validateImportRows({
      fileType: template.fileType,
      sourceColumns: parsed.columns,
      rawRows: parsed.rows,
      requiredColumns: template.requiredColumns,
      optionalColumns: template.optionalColumns,
      columnMapping: template.columnMapping,
      fileName: args.fileName,
      applicationId: args.applicationId,
      applicationProjectId: args.applicationProjectId,
      templateId: template.source === "database" ? template.id : "",
    });

    return {
      summary: result.summary,
      columns: result.columns,
      missingColumns: result.missingColumns.map((column) => ({ key: column.key, displayName: column.displayName })),
      rows: result.rows,
      message: "هذه معاينة فقط. لم يتم حفظ أي بيانات في قاعدة البيانات بعد.",
    };
  } catch (error) {
    const offline = databaseOfflineMessage(error);
    if (offline) throw new Error(offline);
    throw error;
  }
}

