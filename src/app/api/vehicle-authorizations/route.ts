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

function safeRecordStatus(value: unknown) {
  const raw = String(value ?? "PENDING").trim().toUpperCase();
  const allowed = new Set(["ACTIVE", "INACTIVE", "PENDING", "APPROVED", "REJECTED", "LOCKED", "CANCELLED", "DEDUCTED", "PARTIALLY_DEDUCTED"]);
  return allowed.has(raw) ? raw : "PENDING";
}

async function resolveAuthorizationContext(tx: Tx, vehicleId: string, requestedDriverId?: string | null) {
  const vehicle = await tx.vehicle.findUnique({ where: { id: vehicleId }, select: { id: true, currentDriverId: true, cityId: true } });
  if (!vehicle) throw new Error("السيارة غير موجودة.");

  const assignment = await tx.vehicleAssignment.findFirst({
    where: { vehicleId, status: "ACTIVE", endDate: null },
    orderBy: { startDate: "desc" },
    select: { driverId: true },
  });

  const driverId = cleanText(requestedDriverId) || vehicle.currentDriverId || assignment?.driverId || null;
  if (!driverId) throw new Error("لا يمكن إنشاء تفويض لأن السيارة غير مرتبطة بمندوب حاليًا.");

  const driver = await tx.driver.findUnique({ where: { id: driverId }, select: { id: true } });
  if (!driver) throw new Error("المندوب المرتبط بالسيارة غير موجود.");

  return { vehicle, driverId };
}

function validateDates(startDate: Date | null, endDate: Date | null) {
  if (startDate && endDate && endDate.getTime() < startDate.getTime()) {
    throw new Error("تاريخ نهاية التفويض لا يمكن أن يكون قبل تاريخ البداية.");
  }
}

export async function POST(request: Request) {
  try {
    const input = await request.json().catch(() => ({}));
    const vehicleId = cleanText(input.vehicleId);
    if (!vehicleId) return NextResponse.json({ error: "السيارة مطلوبة." }, { status: 400 });

    const startDate = parseDate(input.startDate);
    const endDate = parseDate(input.endDate);
    validateDates(startDate, endDate);

    const record = await prisma.$transaction(async (tx) => {
      const { driverId } = await resolveAuthorizationContext(tx, vehicleId, input.driverId);

      return tx.vehicleAuthorization.create({
        data: {
          vehicleId,
          driverId,
          authNumber: cleanText(input.authNumber),
          startDate,
          endDate,
          status: safeRecordStatus(input.status) as any,
          notes: cleanText(input.notes),
        },
      });
    });

    return NextResponse.json({ data: record }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر حفظ التفويض.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
