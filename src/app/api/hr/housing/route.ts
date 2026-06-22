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
  return RecordStatus.ACTIVE;
}

function jsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? null));
}

async function audit(request: Request, action: string, entityId: string | null, before: unknown, after: unknown) {
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

function payload(body: Record<string, unknown>): Prisma.DriverHousingCreateInput {
  const driverId = text(body.driverId);
  const housingType = text(body.housingType || body.accommodationType);
  if (!driverId || !housingType) throw new Error("المندوب ونوع السكن مطلوبين.");
  return {
    driver: { connect: { id: driverId } },
    housingType,
    accommodationType: optionalText(body.accommodationType) || housingType,
    location: optionalText(body.location),
    roomNumber: optionalText(body.roomNumber),
    monthlyCost: money(body.monthlyCost),
    status: status(body.status),
    startDate: dateOrNull(body.startDate),
    endDate: dateOrNull(body.endDate),
    notes: optionalText(body.notes),
  };
}

function updatePayload(body: Record<string, unknown>): Prisma.DriverHousingUpdateInput {
  const data: Prisma.DriverHousingUpdateInput = {};
  if ("housingType" in body) data.housingType = text(body.housingType);
  if ("accommodationType" in body) data.accommodationType = optionalText(body.accommodationType);
  if ("location" in body) data.location = optionalText(body.location);
  if ("roomNumber" in body) data.roomNumber = optionalText(body.roomNumber);
  if ("monthlyCost" in body) data.monthlyCost = money(body.monthlyCost);
  if ("status" in body) data.status = status(body.status);
  if ("startDate" in body) data.startDate = dateOrNull(body.startDate);
  if ("endDate" in body) data.endDate = dateOrNull(body.endDate);
  if ("notes" in body) data.notes = optionalText(body.notes);
  return data;
}

export async function POST(request: Request) {
  const role = roleFromHeaders(request.headers);
  if (!canWriteResource(role, "driver-housing")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const driverId = text(body.driverId);
    const data = payload(body);
    const result = await prisma.$transaction(async (tx) => {
      const driver = await tx.driver.findUnique({ where: { id: driverId }, select: { id: true } });
      if (!driver) throw new Error("المندوب غير موجود.");
      const active = await tx.driverHousing.findFirst({ where: { driverId, status: RecordStatus.ACTIVE }, orderBy: { startDate: "desc" } });
      const housing = active
        ? await tx.driverHousing.update({ where: { id: active.id }, data: updatePayload(body) })
        : await tx.driverHousing.create({ data });
      await tx.driver.update({
        where: { id: driverId },
        data: { housingStatus: housing.housingType, accommodationType: housing.accommodationType || housing.housingType },
      });
      return housing;
    });
    await audit(request, "UPSERT_DRIVER_HOUSING", result.id, null, result);
    return NextResponse.json({ message: "تم حفظ سكن المندوب.", item: result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر حفظ سكن المندوب." }, { status: 400 });
  }
}
