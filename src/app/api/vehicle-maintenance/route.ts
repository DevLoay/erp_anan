import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type Tx = any;

function cleanText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function numberValue(value: unknown) {
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

function isOpenMaintenance(status: string) {
  return status === "PENDING" || status === "ACTIVE";
}

async function resolveVehicleContext(tx: Tx, vehicleId: string, requestedDriverId?: string | null) {
  const vehicle = await tx.vehicle.findUnique({
    where: { id: vehicleId },
    select: { id: true, currentDriverId: true, cityId: true, status: true },
  });
  if (!vehicle) throw new Error("السيارة غير موجودة.");

  const activeAssignment = await tx.vehicleAssignment.findFirst({
    where: { vehicleId, status: "ACTIVE", endDate: null },
    orderBy: { startDate: "desc" },
    select: { driverId: true },
  });

  const driverId = cleanText(requestedDriverId) || vehicle.currentDriverId || activeAssignment?.driverId || null;

  if (driverId) {
    const driver = await tx.driver.findUnique({ where: { id: driverId }, select: { id: true } });
    if (!driver) throw new Error("المندوب المرتبط بالسيارة غير موجود.");
  }

  return { vehicle, driverId };
}

async function restoreVehicleStatusIfNoOpenMaintenance(tx: Tx, vehicleId: string, excludeMaintenanceId?: string) {
  const openCount = await tx.vehicleMaintenance.count({
    where: {
      vehicleId,
      id: excludeMaintenanceId ? { not: excludeMaintenanceId } : undefined,
      status: { in: ["PENDING", "ACTIVE"] },
    },
  });

  if (openCount > 0) return;

  const vehicle = await tx.vehicle.findUnique({ where: { id: vehicleId }, select: { currentDriverId: true } });
  await tx.vehicle.update({
    where: { id: vehicleId },
    data: { status: vehicle?.currentDriverId ? "ASSIGNED" : "AVAILABLE" },
  });
}

export async function POST(request: Request) {
  try {
    const input = await request.json().catch(() => ({}));
    const vehicleId = cleanText(input.vehicleId);
    if (!vehicleId) return NextResponse.json({ error: "السيارة مطلوبة." }, { status: 400 });

    const type = cleanText(input.type);
    if (!type) return NextResponse.json({ error: "نوع الصيانة مطلوب." }, { status: 400 });

    const status = safeRecordStatus(input.status);

    const record = await prisma.$transaction(async (tx) => {
      const { driverId } = await resolveVehicleContext(tx, vehicleId, input.driverId);

      const maintenance = await tx.vehicleMaintenance.create({
        data: {
          vehicleId,
          driverId,
          type,
          vendor: cleanText(input.vendor),
          date: parseDate(input.date),
          cost: numberValue(input.cost),
          status: status as any,
          notes: cleanText(input.notes),
        },
      });

      if (isOpenMaintenance(status)) {
        await tx.vehicle.update({ where: { id: vehicleId }, data: { status: "MAINTENANCE" } });
      }

      return maintenance;
    });

    return NextResponse.json({ data: record }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر حفظ الصيانة.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
