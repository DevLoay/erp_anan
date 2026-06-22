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

function parseDate(value: unknown, fallback = new Date()) {
  const text = String(value ?? "").trim();
  if (!text) return fallback;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function safeRecordStatus(value: unknown) {
  const raw = String(value ?? "PENDING").trim().toUpperCase();
  const allowed = new Set(["ACTIVE", "INACTIVE", "PENDING", "APPROVED", "REJECTED", "LOCKED", "CANCELLED", "DEDUCTED", "PARTIALLY_DEDUCTED"]);
  return allowed.has(raw) ? raw : "PENDING";
}

async function resolveVehicleDriver(vehicleId: string | null, fallbackDriverId: string | null) {
  if (!vehicleId) throw new Error("السيارة مطلوبة في مخالفات السيارات.");

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: { id: true, currentDriverId: true },
  });
  if (!vehicle) throw new Error("السيارة غير موجودة.");

  const driverId = vehicle.currentDriverId || fallbackDriverId;
  if (!driverId) throw new Error("السيارة غير مرتبطة بمندوب حاليًا، سجل حركة تسليم للسيارة أولًا أو اختر المندوب يدويًا.");
  return { vehicleId: vehicle.id, driverId };
}

export async function POST(request: Request) {
  try {
    const input = await request.json();
    const type = cleanText(input.type);
    const amount = moneyNumber(input.amount);
    const status = safeRecordStatus(input.status);
    const notes = cleanText(input.notes);
    const occurredAt = parseDate(input.occurredAt);
    const resolved = await resolveVehicleDriver(cleanText(input.vehicleId), cleanText(input.driverId));

    if (!type) return NextResponse.json({ error: "نوع المخالفة مطلوب." }, { status: 400 });
    if (amount <= 0) return NextResponse.json({ error: "مبلغ المخالفة يجب أن يكون أكبر من صفر." }, { status: 400 });

    const driver = await prisma.driver.findUnique({ where: { id: resolved.driverId }, select: { id: true } });
    if (!driver) return NextResponse.json({ error: "المندوب غير موجود." }, { status: 404 });

    const record = await prisma.violation.create({
      data: {
        driverId: resolved.driverId,
        vehicleId: resolved.vehicleId,
        type,
        amount,
        status: status as any,
        occurredAt,
        notes,
      },
    });
    return NextResponse.json({ data: record }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر حفظ مخالفة السيارة.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
