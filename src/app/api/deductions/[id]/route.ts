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

function safeRecordStatus(value: unknown) {
  const raw = String(value ?? "PENDING").trim().toUpperCase();
  const allowed = new Set(["ACTIVE", "INACTIVE", "PENDING", "APPROVED", "REJECTED", "LOCKED", "CANCELLED", "DEDUCTED", "PARTIALLY_DEDUCTED"]);
  return allowed.has(raw) ? raw : "PENDING";
}

async function resolveVehicleDriver(vehicleId: string | null, fallbackDriverId: string | null) {
  if (!vehicleId) return { vehicleId: null, driverId: fallbackDriverId };

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: { id: true, currentDriverId: true },
  });
  if (!vehicle) throw new Error("السيارة غير موجودة.");

  const driverId = vehicle.currentDriverId || fallbackDriverId;
  if (!driverId) throw new Error("السيارة غير مرتبطة بمندوب حاليًا، اختر مندوب أو سجل حركة تسليم للسيارة أولًا.");
  return { vehicleId: vehicle.id, driverId };
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const input = await request.json();
    const vehicleIdInput = cleanText(input.vehicleId);
    const driverIdInput = cleanText(input.driverId);
    const resolved = await resolveVehicleDriver(vehicleIdInput, driverIdInput);

    const record = await prisma.deduction.update({
      where: { id },
      data: {
        vehicleId: resolved.vehicleId,
        driverId: resolved.driverId || undefined,
        type: cleanText(input.type) || undefined,
        amount: moneyNumber(input.amount),
        month: cleanText(input.month),
        status: safeRecordStatus(input.status) as any,
        notes: cleanText(input.notes),
      } as any,
    });
    return NextResponse.json({ data: record });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر تعديل خصم السيارة.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const record = await prisma.deduction.update({ where: { id }, data: { status: "CANCELLED" as any } });
    return NextResponse.json({ data: record });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر إلغاء خصم السيارة.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
