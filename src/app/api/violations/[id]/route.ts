import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function cleanText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function moneyNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function parseDate(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function safeRecordStatus(value: unknown) {
  const raw = String(value ?? "PENDING").trim().toUpperCase();
  const allowed = new Set(["ACTIVE", "INACTIVE", "PENDING", "APPROVED", "REJECTED", "LOCKED", "CANCELLED", "DEDUCTED", "PARTIALLY_DEDUCTED"]);
  return allowed.has(raw) ? raw : "PENDING";
}

async function resolveVehicleDriver(vehicleId: string | null, fallbackDriverId: string | null) {
  if (!vehicleId) throw new Error("السيارة مطلوبة في مخالفات السيارات.");
  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { id: true, currentDriverId: true } });
  if (!vehicle) throw new Error("السيارة غير موجودة.");
  const driverId = vehicle.currentDriverId || fallbackDriverId;
  if (!driverId) throw new Error("السيارة غير مرتبطة بمندوب حاليًا، سجل حركة تسليم للسيارة أولًا أو اختر المندوب يدويًا.");
  return { vehicleId: vehicle.id, driverId };
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const input = await request.json();
    const resolved = await resolveVehicleDriver(cleanText(input.vehicleId), cleanText(input.driverId));
    const record = await prisma.violation.update({
      where: { id },
      data: {
        vehicleId: resolved.vehicleId,
        driverId: resolved.driverId,
        type: cleanText(input.type) || undefined,
        amount: moneyNumber(input.amount),
        occurredAt: parseDate(input.occurredAt) || undefined,
        status: safeRecordStatus(input.status) as any,
        notes: cleanText(input.notes),
      },
    });
    return NextResponse.json({ data: record });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر تعديل مخالفة السيارة.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const record = await prisma.violation.update({ where: { id }, data: { status: "CANCELLED" as any } });
    return NextResponse.json({ data: record });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر إلغاء مخالفة السيارة.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
