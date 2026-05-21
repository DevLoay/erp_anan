import ExcelJS from "exceljs";
import { normalizeCell, type ParsedImportFile } from "./parseCsv";

function cellToValue(cell: ExcelJS.Cell) {
  const value = cell.value;
  if (value && typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("result" in value) return value.result;
    if ("richText" in value && Array.isArray(value.richText)) return value.richText.map((item) => item.text).join("");
    if (value instanceof Date) return value;
  }
  return value;
}

export async function parseExcelBuffer(buffer: Buffer): Promise<ParsedImportFile> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return { columns: [], rows: [] };

  const headerRow = worksheet.getRow(1);
  const columns: string[] = [];
  headerRow.eachCell((cell) => {
    const header = normalizeCell(cellToValue(cell));
    if (header) columns.push(header);
  });

  const rows: Record<string, unknown>[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const record: Record<string, unknown> = {};
    let hasValue = false;
    columns.forEach((column, index) => {
      const value = normalizeCell(cellToValue(row.getCell(index + 1)));
      if (value !== "") hasValue = true;
      record[column] = value;
    });
    if (hasValue) rows.push(record);
  });

  return { columns, rows };
}

