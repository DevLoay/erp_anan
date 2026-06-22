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

function isOpenMaintenance(status: string) {
  return status === "PENDING" || status === "ACTIVE";
}

async function resolveDriverForVehicle(tx: Tx, vehicleId: string, requestedDriverId?: string | null) {
  const vehicle = await tx.vehicle.findUnique({ where: { id: vehicleId }, select: { id: true, currentDriverId: true } });
  if (!vehicle) throw new Error("السيارة غير موجودة.");

  const assignment = await tx.vehicleAssignment.findFirst({
    where: { vehicleId, status: "ACTIVE", endDate: null },
    orderBy: { startDate: "desc" },
    select: { driverId: true },
  });

  const driverId = cleanText(requestedDriverId) || vehicle.currentDriverId || assignment?.driverId || null;
  if (driverId) {
    const driver = await tx.driver.findUnique({ where: { id: driverId }, select: { id: true } });
    if (!driver) throw new Error("المندوب المرتبط بالسيارة غير موجود.");
  }

  return driverId;
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

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const input = await request.json().catch(() => ({}));

    const record = await prisma.$transaction(async (tx) => {
      const existing = await tx.vehicleMaintenance.findUnique({ where: { id } });
      if (!existing) throw new Error("سجل الصيانة غير موجود.");

      const vehicleId = cleanText(input.vehicleId) || existing.vehicleId;
      const status = safeRecordStatus(input.status, String(existing.status));
      const driverId = await resolveDriverForVehicle(tx, vehicleId, input.driverId ?? existing.driverId);

      const maintenance = await tx.vehicleMaintenance.update({
        where: { id },
        data: {
          vehicleId,
          driverId,
          type: cleanText(input.type) || existing.type,
          vendor: cleanText(input.vendor),
          date: parseDate(input.date) ?? existing.date,
          cost: numberValue(input.cost),
          status: status as any,
          notes: cleanText(input.notes),
        },
      });

      if (isOpenMaintenance(status)) {
        await tx.vehicle.update({ where: { id: vehicleId }, data: { status: "MAINTENANCE" } });
      } else {
        await restoreVehicleStatusIfNoOpenMaintenance(tx, vehicleId, id);
      }

      if (existing.vehicleId !== vehicleId) {
        await restoreVehicleStatusIfNoOpenMaintenance(tx, existing.vehicleId, id);
      }

      return maintenance;
    });

    return NextResponse.json({ data: record });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر تعديل الصيانة.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const record = await prisma.$transaction(async (tx) => {
      const existing = await tx.vehicleMaintenance.findUnique({ where: { id } });
      if (!existing) throw new Error("سجل الصيانة غير موجود.");

      const updated = await tx.vehicleMaintenance.update({ where: { id }, data: { status: "CANCELLED" } });
      await restoreVehicleStatusIfNoOpenMaintenance(tx, existing.vehicleId, id);
      return updated;
    });

    return NextResponse.json({ data: record });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر إلغاء الصيانة.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
