import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { RecordStatus } from "@prisma/client";

export type SavedVehicleAttachment = {
  url: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export function textField(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function optionalTextField(form: FormData, key: string) {
  const value = textField(form, key);
  return value || null;
}

export function numberField(form: FormData, key: string) {
  const number = Number(textField(form, key) || 0);
  return Number.isFinite(number) ? number : 0;
}

export function dateField(form: FormData, key: string, fallback = new Date()) {
  const value = textField(form, key);
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : fallback;
}

export function statusField(form: FormData) {
  const raw = textField(form, "status").toUpperCase() || "PENDING";
  return Object.values(RecordStatus).includes(raw as RecordStatus) ? (raw as RecordStatus) : RecordStatus.PENDING;
}

function safeExtension(file: File) {
  const fromName = file.name.includes(".") ? file.name.split(".").pop() : "";
  const extension = String(fromName || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  return extension || "bin";
}

export async function saveVehicleAttachments(form: FormData, options: { folder: string; required?: boolean; imagesOnly?: boolean }) {
  const files = form.getAll("attachments").filter((value): value is File => value instanceof File && value.size > 0);

  if (options.required && files.length === 0) {
    throw new Error(options.imagesOnly ? "يجب إرفاق صورة السيارة قبل الحفظ." : "يجب إرفاق ملف إثبات قبل الحفظ.");
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads", "vehicles", options.folder);
  await mkdir(uploadDir, { recursive: true });

  const saved: SavedVehicleAttachment[] = [];
  for (const file of files) {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`الملف ${file.name} أكبر من الحد المسموح 10MB.`);
    }
    if (options.imagesOnly && !file.type.startsWith("image/")) {
      throw new Error("النظافة تقبل صور فقط للسيارة.");
    }
    if (!options.imagesOnly && !(file.type.startsWith("image/") || file.type === "application/pdf")) {
      throw new Error("المرفقات المسموحة: صور أو PDF فقط.");
    }

    const extension = safeExtension(file);
    const fileName = `${Date.now()}-${randomUUID()}.${extension}`;
    const filePath = path.join(uploadDir, fileName);
    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, bytes);

    saved.push({
      url: `/uploads/vehicles/${options.folder}/${fileName}`,
      originalName: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      uploadedAt: new Date().toISOString(),
    });
  }

  return saved;
}

export function mergeAttachments(existing: unknown, uploaded: SavedVehicleAttachment[]) {
  const current = Array.isArray(existing) ? existing : [];
  return uploaded.length ? [...current, ...uploaded] : current;
}
