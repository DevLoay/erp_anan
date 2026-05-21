import ExcelJS from "exceljs";
import { getBuiltinTemplate, resolveTemplateForUse, type ImportColumn } from "./templates";

function headerName(column: ImportColumn) {
  return column.displayName || column.key;
}

export async function buildTemplateWorkbookBuffer(templateId: string | null, fileType: string) {
  const template = await resolveTemplateForUse(templateId, fileType);
  const definition = getBuiltinTemplate(template.fileType);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MOHAMED SHAWKI ERP";
  workbook.created = new Date();

  const columns = [...template.requiredColumns, ...template.optionalColumns];
  const sheet = workbook.addWorksheet("Template");
  sheet.addRow(columns.map(headerName));
  sheet.addRow(
    columns.map((column) => {
      if (column.dataType === "number") return 0;
      if (column.dataType === "date") return new Date().toISOString().slice(0, 10);
      if (column.key === "driverCode") return "DRV-0001";
      if (column.key === "nationalId") return "1000000000";
      if (column.key === "actualName") return "اسم مندوب تجريبي";
      return "";
    }),
  );
  sheet.getRow(1).font = { bold: true };
  sheet.columns.forEach((column) => {
    column.width = 22;
  });

  const instructions = workbook.addWorksheet("Instructions");
  instructions.addRows([
    ["Template Name", template.name],
    ["File Type", template.fileType],
    ["Required Columns", template.requiredColumns.map(headerName).join(", ")],
    ["Optional Columns", template.optionalColumns.map(headerName).join(", ")],
    ["Matching Fields", definition?.matchingFields.join(", ") ?? "-"],
    ["Note", "لا يتم حفظ أي بيانات قبل المعاينة واعتماد الحفظ."],
  ]);
  instructions.getColumn(1).width = 28;
  instructions.getColumn(2).width = 80;

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

