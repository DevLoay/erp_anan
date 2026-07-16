import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canReadResource, canWriteResource, roleFromHeaders } from "@/lib/permissions";

function text(value: unknown) { return String(value ?? "").trim(); }
function nullableText(value: unknown) { const raw = text(value); return raw || null; }
function parseDate(value: unknown) {
  const raw = text(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}
function recordStatus(value: unknown) {
  const raw = text(value).toUpperCase();
  if (["ACTIVE", "INACTIVE", "PENDING", "APPROVED", "REJECTED", "LOCKED", "CANCELLED", "DEDUCTED", "PARTIALLY_DEDUCTED"].includes(raw)) return raw;
  return undefined;
}
function serialize(value: unknown) { return JSON.parse(JSON.stringify(value ?? null)); }
function canRead(request: Request) {
  const role = roleFromHeaders(request.headers);
  return canReadResource(role, "driver-documents") || canReadResource(role, "drivers");
}
function canWrite(request: Request) {
  const role = roleFromHeaders(request.headers);
  return canWriteResource(role, "driver-documents") || canWriteResource(role, "drivers");
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> | { id: string } }) {
  if (!canRead(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const params = await context.params;
  const documentRaw = await prisma.driverDocument.findUnique({ where: { id: params.id } });
  if (!documentRaw) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const driver = documentRaw.driverId
    ? await prisma.driver.findUnique({
        where: { id: documentRaw.driverId },
        select: { id: true, name: true, actualName: true, internalCode: true, driverCode: true, nationalId: true, phone: true, mobile: true, city: { select: { id: true, nameAr: true, nameEn: true } }, project: { select: { id: true, name: true, appName: true } } },
      })
    : null;
  return NextResponse.json({ document: serialize({ ...documentRaw, driver }) });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> | { id: string } }) {
  if (!canWrite(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const params = await context.params;
  const before = await prisma.driverDocument.findUnique({ where: { id: params.id } });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const data: any = {};
  if (body.driverId !== undefined) data.driverId = text(body.driverId);
  if (body.type !== undefined) data.type = text(body.type) || before.type;
  if (body.documentType !== undefined) data.documentType = nullableText(body.documentType);
  if (body.documentNumber !== undefined) data.documentNumber = nullableText(body.documentNumber);
  if (body.issueDate !== undefined) data.issueDate = parseDate(body.issueDate);
  if (body.expiryDate !== undefined) data.expiryDate = parseDate(body.expiryDate);
  if (body.status !== undefined) data.status = recordStatus(body.status) || before.status;
  if (body.verificationStatus !== undefined) data.verificationStatus = text(body.verificationStatus) || before.verificationStatus;
  if (body.fileUrl !== undefined) data.fileUrl = nullableText(body.fileUrl);
  if (body.notes !== undefined) data.notes = nullableText(body.notes);

  if (data.driverId) {
    const driver = await prisma.driver.findUnique({ where: { id: data.driverId }, select: { id: true } });
    if (!driver) return NextResponse.json({ error: "المندوب غير موجود." }, { status: 404 });
  }

  const document = await prisma.driverDocument.update({
    where: { id: params.id },
    data,
    include: { driver: { select: { id: true, name: true, actualName: true, internalCode: true, driverCode: true, nationalId: true, phone: true, mobile: true, city: { select: { id: true, nameAr: true, nameEn: true } }, project: { select: { id: true, name: true, appName: true } } } } },
  });

  await prisma.auditLog.create({
    data: {
      user: request.headers.get("x-user-email") || undefined,
      action: "UPDATE_DRIVER_DOCUMENT",
      entityType: "DriverDocument",
      entityId: document.id,
      oldValue: serialize(before),
      newValue: serialize(document),
    },
  }).catch(() => null);

  return NextResponse.json({ document: serialize(document) });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> | { id: string } }) {
  if (!canWrite(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const params = await context.params;
  const before = await prisma.driverDocument.findUnique({ where: { id: params.id } });
  if (!before) return NextResponse.json({ ok: true, deleted: 0 });
  await prisma.driverDocument.delete({ where: { id: params.id } });
  await prisma.auditLog.create({
    data: {
      user: request.headers.get("x-user-email") || undefined,
      action: "DELETE_DRIVER_DOCUMENT",
      entityType: "DriverDocument",
      entityId: params.id,
      oldValue: serialize(before),
    },
  }).catch(() => null);
  return NextResponse.json({ ok: true, deleted: 1 });
}
