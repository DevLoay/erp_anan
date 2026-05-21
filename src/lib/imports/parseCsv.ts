import { parse } from "csv-parse/sync";

export type ParsedImportFile = {
  columns: string[];
  rows: Record<string, unknown>[];
};

export function normalizeCell(value: unknown) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

export function parseCsvBuffer(buffer: Buffer): ParsedImportFile {
  const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
  const records = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, unknown>[];

  const columns = records.length ? Object.keys(records[0]) : [];
  return {
    columns,
    rows: records.map((row) =>
      Object.fromEntries(Object.entries(row).map(([key, value]) => [key.trim(), normalizeCell(value)])),
    ),
  };
}

