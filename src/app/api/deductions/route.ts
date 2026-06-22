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
    select: { id: true, currentDriverId: true, plateEn: true, plateAr: true, plateEnglish: true, plateArabic: true },
  });
  if (!vehicle) throw new Error("السيارة غير موجودة.");

  const driverId = vehicle.currentDriverId || fallbackDriverId;
  if (!driverId) throw new Error("السيارة غير مرتبطة بمندوب حاليًا، اختر مندوب أو سجل حركة تسليم للسيارة أولًا.");

  return { vehicleId: vehicle.id, driverId };
}

export async function POST(request: Request) {
  try {
    const input = await request.json();
    const type = cleanText(input.type);
    const amount = moneyNumber(input.amount);
    const month = cleanText(input.month);
    const status = safeRecordStatus(input.status);
    const notes = cleanText(input.notes);
    const vehicleIdInput = cleanText(input.vehicleId);
    const driverIdInput = cleanText(input.driverId);

    if (!type) return NextResponse.json({ error: "نوع الخصم مطلوب." }, { status: 400 });
    if (amount <= 0) return NextResponse.json({ error: "مبلغ الخصم يجب أن يكون أكبر من صفر." }, { status: 400 });

    const resolved = await resolveVehicleDriver(vehicleIdInput, driverIdInput);
    if (!resolved.driverId) return NextResponse.json({ error: "المندوب مطلوب." }, { status: 400 });

    const driver = await prisma.driver.findUnique({ where: { id: resolved.driverId }, select: { id: true } });
    if (!driver) return NextResponse.json({ error: "المندوب غير موجود." }, { status: 404 });

    const record = await prisma.deduction.create({
      data: {
        driverId: resolved.driverId,
        vehicleId: resolved.vehicleId,
        type,
        amount,
        month,
        status: status as any,
        notes,
      } as any,
    });

    return NextResponse.json({ data: record }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر حفظ خصم السيارة.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
