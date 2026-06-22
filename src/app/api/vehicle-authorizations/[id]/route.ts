import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type Tx = any;

function cleanText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function parseDate(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function safeRecordStatus(value: unknown, fallback = "PENDING") {
  const raw = String(value ?? fallback).trim().toUpperCase();
  const allowed = new Set(["ACTIVE", "INACTIVE", "PENDING", "APPROVED", "REJECTED", "LOCKED", "CANCELLED", "DEDUCTED", "PARTIALLY_DEDUCTED"]);
  return allowed.has(raw) ? raw : fallback;
}

async function resolveAuthorizationDriver(tx: Tx, vehicleId: string, requestedDriverId?: string | null) {
  const vehicle = await tx.vehicle.findUnique({ where: { id: vehicleId }, select: { id: true, currentDriverId: true } });
  if (!vehicle) throw new Error("السيارة غير موجودة.");

  const assignment = await tx.vehicleAssignment.findFirst({
    where: { vehicleId, status: "ACTIVE", endDate: null },
    orderBy: { startDate: "desc" },
    select: { driverId: true },
  });

  const driverId = cleanText(requestedDriverId) || vehicle.currentDriverId || assignment?.driverId || null;
  if (!driverId) throw new Error("لا يمكن حفظ التفويض لأن السيارة غير مرتبطة بمندوب حاليًا.");

  const driver = await tx.driver.findUnique({ where: { id: driverId }, select: { id: true } });
  if (!driver) throw new Error("المندوب المرتبط بالسيارة غير موجود.");

  return driverId;
}

function validateDates(startDate: Date | null, endDate: Date | null) {
  if (startDate && endDate && endDate.getTime() < startDate.getTime()) {
    throw new Error("تاريخ نهاية التفويض لا يمكن أن يكون قبل تاريخ البداية.");
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const input = await request.json().catch(() => ({}));

    const record = await prisma.$transaction(async (tx) => {
      const existing = await tx.vehicleAuthorization.findUnique({ where: { id } });
      if (!existing) throw new Error("سجل التفويض غير موجود.");

      const vehicleId = cleanText(input.vehicleId) || existing.vehicleId;
      const startDate = parseDate(input.startDate) ?? existing.startDate;
      const endDate = parseDate(input.endDate) ?? existing.endDate;
      validateDates(startDate, endDate);

      const driverId = await resolveAuthorizationDriver(tx, vehicleId, input.driverId ?? existing.driverId);

      return tx.vehicleAuthorization.update({
        where: { id },
        data: {
          vehicleId,
          driverId,
          authNumber: cleanText(input.authNumber),
          startDate,
          endDate,
          status: safeRecordStatus(input.status, String(existing.status)) as any,
          notes: cleanText(input.notes),
        },
      });
    });

    return NextResponse.json({ data: record });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر تعديل التفويض.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const record = await prisma.vehicleAuthorization.update({ where: { id }, data: { status: "CANCELLED" } });
    return NextResponse.json({ data: record });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر إلغاء التفويض.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
