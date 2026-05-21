import ExcelJS from "exceljs";
import { parse } from "csv-parse/sync";
import { matchKeetaRankRows, type KeetaRankMappedRow, type KeetaRankMatchedRow } from "./matchDrivers";

export type KeetaRankPreviewResult = {
  fileName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  missingDrivers: number;
  unlinkedAccounts: number;
  duplicateRows: number;
  linkedDrivers: number;
  rows: KeetaRankMatchedRow[];
};

function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_\-./]+/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

const aliases: Record<keyof Omit<KeetaRankMappedRow, "rowNumber" | "rawData">, string[]> = {
  driverCode: ["drivercode", "internalcode", "riderid", "driverid", "كودالمندوب", "المندوب"],
  driverName: ["drivername", "ridername", "name", "اسم", "اسمالمندوب"],
  nationalId: ["nationalid", "iqama", "idnumber", "رقمالهوية", "الاقامة", "الإقامة"],
  appUserId: ["appuserid", "userid", "accountid", "keetaid", "appaccount", "رقمالحساب"],
  appUsername: ["appusername", "username", "accountusername", "account", "حسابالتطبيق"],
  rank: ["rank", "level", "keetarank", "الرانك", "المستوى"],
  orders: ["orders", "completedorders", "totalorders", "الطلبات", "عددالطلبات"],
  onTime: ["ontime", "ontime%", "ontimerate", "التسليمفيالوقت", "اونتايم"],
  cancellation: ["cancellation", "cancellation%", "cancelrate", "cancellations", "الإلغاء", "الغاء"],
  rejection: ["rejection", "rejection%", "rejectrate", "رفض", "الرفض"],
  workingHours: ["workinghours", "hours", "onlinehours", "ساعاتالعمل", "الساعات"],
};

function findValue(row: Record<string, unknown>, field: keyof Omit<KeetaRankMappedRow, "rowNumber" | "rawData">) {
  const lookup = new Map<string, unknown>();
  for (const [key, value] of Object.entries(row)) lookup.set(normalizeKey(key), value);
  for (const alias of aliases[field]) {
    const value = lookup.get(normalizeKey(alias));
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return "";
}

function text(value: unknown) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object" && "text" in value) return String((value as { text?: unknown }).text ?? "");
  return String(value).trim();
}

function numeric(value: unknown) {
  const raw = text(value).replace("%", "").replace(",", ".");
  if (!raw) return null;
  const number = Number(raw);
  return Number.isFinite(number) ? number : Number.NaN;
}

function mapRawRows(rawRows: Record<string, unknown>[]) {
  return rawRows.map((row, index): KeetaRankMappedRow => ({
    rowNumber: index + 2,
    rawData: row,
    driverCode: text(findValue(row, "driverCode")),
    driverName: text(findValue(row, "driverName")),
    nationalId: text(findValue(row, "nationalId")),
    appUserId: text(findValue(row, "appUserId")),
    appUsername: text(findValue(row, "appUsername")),
    rank: text(findValue(row, "rank")),
    orders: numeric(findValue(row, "orders")),
    onTime: numeric(findValue(row, "onTime")),
    cancellation: numeric(findValue(row, "cancellation")),
    rejection: numeric(findValue(row, "rejection")),
    workingHours: numeric(findValue(row, "workingHours")),
  }));
}

function cellToValue(value: unknown) {
  if (value && typeof value === "object") {
    if ("text" in value) return (value as { text?: unknown }).text ?? "";
    if ("result" in value) return (value as { result?: unknown }).result ?? "";
    if ("richText" in value && Array.isArray((value as { richText?: unknown }).richText)) {
      return ((value as { richText: { text?: string }[] }).richText).map((part) => part.text ?? "").join("");
    }
  }
  return value;
}

async function parseExcel(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const headers: string[] = [];
  worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber - 1] = text(cellToValue(cell.value));
  });

  const rows: Record<string, unknown>[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const record: Record<string, unknown> = {};
    let hasValue = false;
    headers.forEach((header, index) => {
      if (!header) return;
      const value = cellToValue(row.getCell(index + 1).value);
      if (value !== null && value !== undefined && String(value).trim() !== "") hasValue = true;
      record[header] = value ?? "";
    });
    if (hasValue) rows.push(record);
  });
  return rows;
}

function parseCsv(buffer: Buffer) {
  return parse(buffer.toString("utf8"), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  }) as Record<string, unknown>[];
}

export async function buildKeetaRankPreview(fileName: string, buffer: Buffer, applicationId?: string | null): Promise<KeetaRankPreviewResult> {
  const lowerName = fileName.toLowerCase();
  const rawRows = lowerName.endsWith(".csv") ? parseCsv(buffer) : await parseExcel(buffer);
  const rows = await matchKeetaRankRows(mapRawRows(rawRows), applicationId);
  const validRows = rows.filter((row) => row.status === "Valid").length;
  const missingDrivers = rows.filter((row) => row.status === "Missing Driver").length;
  const unlinkedAccounts = rows.filter((row) => row.status === "Unlinked Account").length;
  const duplicateRows = rows.filter((row) => row.status === "Duplicate Match").length;

  return {
    fileName,
    totalRows: rows.length,
    validRows,
    invalidRows: rows.length - validRows,
    missingDrivers,
    unlinkedAccounts,
    duplicateRows,
    linkedDrivers: rows.filter((row) => row.driverId).length,
    rows,
  };
}
