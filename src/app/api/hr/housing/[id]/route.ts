import { Prisma, RecordStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canWriteResource, roleFromHeaders } from "@/lib/permissions";

function text(value: unknown) {
  return String(value ?? "").trim();
}

function optionalText(value: unknown) {
  const out = text(value);
  return out ? out : null;
}

function dateOrNull(value: unknown) {
  const raw = text(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function money(value: unknown) {
  const out = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(out) ? out : 0;
}

function status(value: unknown) {
  const raw = text(value).toUpperCase();
  if (raw === RecordStatus.ACTIVE || raw === RecordStatus.INACTIVE || raw === RecordStatus.PENDING) return raw as RecordStatus;
  return undefined;
}

function jsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function updatePayload(body: Record<string, unknown>): Prisma.DriverHousingUpdateInput {
  const data: Prisma.DriverHousingUpdateInput = {};
  if ("housingType" in body) data.housingType = text(body.housingType);
  if ("accommodationType" in body) data.accommodationType = optionalText(body.accommodationType);
  if ("location" in body) data.location = optionalText(body.location);
  if ("roomNumber" in body) data.roomNumber = optionalText(body.roomNumber);
  if ("monthlyCost" in body) data.monthlyCost = money(body.monthlyCost);
  if ("status" in body) {
    const next = status(body.status);
    if (next) data.status = next;
  }
  if ("startDate" in body) data.startDate = dateOrNull(body.startDate);
  if ("endDate" in body) data.endDate = dateOrNull(body.endDate);
  if ("notes" in body) data.notes = optionalText(body.notes);
  return data;
}

async function audit(request: Request, action: string, entityId: string, before: unknown, after: unknown) {
  await prisma.auditLog
    .create({
      data: {
        userId: request.headers.get("x-user-id") || undefined,
        user: request.headers.get("x-user-email") || undefined,
        action,
        entityType: "DriverHousing",
        entityId,
        before: jsonValue(before),
        after: jsonValue(after),
        oldValue: jsonValue(before),
        newValue: jsonValue(after),
      },
    })
    .catch(() => null);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const role = roleFromHeaders(request.headers);
  if (!canWriteResource(role, "driver-housing")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const before = await prisma.driverHousing.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "سجل السكن غير موجود." }, { status: 404 });

  const updated = await prisma.$transaction(async (tx) => {
    const housing = await tx.driverHousing.update({ where: { id }, data: updatePayload(body) });
    const active = housing.status === RecordStatus.ACTIVE;
    await tx.driver.update({
      where: { id: housing.driverId },
      data: active
        ? { housingStatus: housing.housingType, accommodationType: housing.accommodationType || housing.housingType }
        : { housingStatus: null, accommodationType: null },
    });
    return housing;
  });
  await audit(request, "UPDATE_DRIVER_HOUSING", id, before, updated);
  return NextResponse.json({ message: "تم تحديث سكن المندوب.", item: updated });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const role = roleFromHeaders(request.headers);
  if (!canWriteResource(role, "driver-housing")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const before = await prisma.driverHousing.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "سجل السكن غير موجود." }, { status: 404 });

  const updated = await prisma.$transaction(async (tx) => {
    const housing = await tx.driverHousing.update({ where: { id }, data: { status: RecordStatus.INACTIVE, endDate: new Date() } });
    await tx.driver.update({ where: { id: housing.driverId }, data: { housingStatus: null, accommodationType: null } });
    return housing;
  });
  await audit(request, "DEACTIVATE_DRIVER_HOUSING", id, before, updated);
  return NextResponse.json({ message: "تم تعطيل سجل السكن.", item: updated });
}
