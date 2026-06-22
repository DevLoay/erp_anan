import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const COMPANY_CAR_FULL_MONTH_RENT = 2000;
const RENT_DAYS_BASE = 30;

type MovementInput = {
  vehicleId?: string;
  movementType?: string;
  fromDriverId?: string | null;
  toDriverId?: string | null;
  cityId?: string | null;
  handoverDate?: string | null;
  returnDate?: string | null;
  status?: string | null;
  notes?: string | null;
};

type Tx = any;

function cleanText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function parseDate(value: unknown, fallback = new Date()) {
  const text = String(value ?? "").trim();
  if (!text) return fallback;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function dateOnly(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function inclusiveDays(start: Date, end: Date) {
  const startOnly = dateOnly(start).getTime();
  const endOnly = dateOnly(end).getTime();
  const diff = Math.floor((endOnly - startOnly) / 86_400_000) + 1;
  return Math.max(1, diff);
}

function safeRecordStatus(value: unknown) {
  const raw = String(value ?? "ACTIVE").trim().toUpperCase();
  const allowed = new Set(["ACTIVE", "INACTIVE", "PENDING", "APPROVED", "REJECTED", "LOCKED", "CANCELLED", "DEDUCTED", "PARTIALLY_DEDUCTED"]);
  return allowed.has(raw) ? raw : "ACTIVE";
}

function normalizeMovementType(type: string) {
  const value = type.trim();
  if (value.includes("نقل")) return "TRANSFER";
  if (value.includes("استلام")) return "RECEIVE";
  if (value.includes("تسليم")) return "ASSIGN";
  if (value.includes("دخول") && value.includes("صيانة")) return "ENTER_MAINTENANCE";
  if (value.includes("خروج") && value.includes("صيانة")) return "EXIT_MAINTENANCE";
  if (value.includes("إرجاع") || value.includes("ارجاع")) return "RETURN_OWNER";
  return "OTHER";
}

function vehicleMonthlyRent(vehicle: { monthlyRent: unknown; ownershipType?: string | null }) {
  const ownershipType = String(vehicle.ownershipType ?? "").toLowerCase();
  if (ownershipType.includes("personal") || ownershipType.includes("شخص")) return 0;
  const configured = Number(vehicle.monthlyRent ?? 0);
  return Number.isFinite(configured) && configured > 0 ? configured : COMPANY_CAR_FULL_MONTH_RENT;
}

function rentForClosedAssignment(vehicle: { monthlyRent: unknown; ownershipType?: string | null }, startDate: Date, endDate: Date) {
  const monthly = vehicleMonthlyRent(vehicle);
  if (monthly <= 0) return { rentalDays: inclusiveDays(startDate, endDate), calculatedRent: 0 };
  const days = inclusiveDays(startDate, endDate);
  const chargedDays = Math.min(days, RENT_DAYS_BASE);
  const amount = Math.min(monthly, (monthly / RENT_DAYS_BASE) * chargedDays);
  return { rentalDays: days, calculatedRent: Number(amount.toFixed(2)) };
}

async function closeActiveAssignments(tx: Tx, vehicleId: string, endDate: Date, notes?: string | null) {
  const assignments = await tx.vehicleAssignment.findMany({
    where: { vehicleId, status: "ACTIVE", endDate: null },
    include: { vehicle: { select: { monthlyRent: true, ownershipType: true } } },
  });

  for (const assignment of assignments) {
    const rent = rentForClosedAssignment(assignment.vehicle, assignment.startDate, endDate);
    await tx.vehicleAssignment.update({
      where: { id: assignment.id },
      data: {
        endDate,
        rentalDays: rent.rentalDays,
        calculatedRent: rent.calculatedRent,
        status: "INACTIVE",
        notes: [assignment.notes, notes].filter(Boolean).join(" | ") || assignment.notes,
      },
    });
  }

  return assignments;
}

async function applyMovement(tx: Tx, input: MovementInput) {
  const vehicleId = cleanText(input.vehicleId);
  const movementType = cleanText(input.movementType);
  if (!vehicleId) throw new Error("السيارة مطلوبة.");
  if (!movementType) throw new Error("نوع الحركة مطلوب.");

  const vehicle = await tx.vehicle.findUnique({
    where: { id: vehicleId },
    select: {
      id: true,
      currentDriverId: true,
      cityId: true,
      monthlyRent: true,
      ownershipType: true,
    },
  });
  if (!vehicle) throw new Error("السيارة غير موجودة.");

  const normalized = normalizeMovementType(movementType);
  const handoverDate = parseDate(input.handoverDate, new Date());
  const returnDate = parseDate(input.returnDate, handoverDate);

  const latestAssignment = await tx.vehicleAssignment.findFirst({
    where: { vehicleId, status: "ACTIVE", endDate: null },
    orderBy: { startDate: "desc" },
  });

  const currentDriverId = vehicle.currentDriverId || latestAssignment?.driverId || null;
  const fromDriverId = cleanText(input.fromDriverId) || currentDriverId;
  const toDriverId = cleanText(input.toDriverId);

  if ((normalized === "ASSIGN" || normalized === "TRANSFER") && !toDriverId) {
    throw new Error("المندوب المستلم مطلوب في حركة التسليم أو النقل.");
  }

  if ((normalized === "RECEIVE" || normalized === "TRANSFER" || normalized === "RETURN_OWNER") && !fromDriverId) {
    throw new Error("السيارة غير مرتبطة بمندوب حاليًا، لذلك لا يمكن تسجيل استلام/نقل بدون مندوب سابق.");
  }

  const toDriver = toDriverId
    ? await tx.driver.findUnique({ where: { id: toDriverId }, select: { id: true, cityId: true } })
    : null;
  if (toDriverId && !toDriver) throw new Error("المندوب المستلم غير موجود.");

  const effectiveCityId = cleanText(input.cityId) || toDriver?.cityId || vehicle.cityId || null;

  const movement = await tx.vehicleMovement.create({
    data: {
      vehicleId,
      movementType,
      fromDriverId,
      toDriverId,
      cityId: effectiveCityId,
      handoverDate,
      returnDate: normalized === "RECEIVE" || normalized === "RETURN_OWNER" ? returnDate : cleanText(input.returnDate) ? returnDate : null,
      status: safeRecordStatus(input.status) as any,
      notes: cleanText(input.notes),
    },
  });

  if (normalized === "ASSIGN" || normalized === "TRANSFER") {
    await closeActiveAssignments(tx, vehicleId, handoverDate, normalized === "TRANSFER" ? "تم إغلاق التخصيص بسبب نقل السيارة." : "تم إغلاق التخصيص السابق بسبب تسليم جديد.");

    if (fromDriverId && fromDriverId !== toDriverId) {
      await tx.driver.updateMany({ where: { id: fromDriverId, vehicleId }, data: { vehicleId: null, vehicleOwnershipType: "no_vehicle" } });
    }

    await tx.driver.update({
      where: { id: toDriverId! },
      data: {
        vehicleId,
        vehicleOwnershipType: String(vehicle.ownershipType ?? "company").toLowerCase().includes("personal") ? "personal" : "company",
      },
    });

    await tx.vehicle.update({
      where: { id: vehicleId },
      data: {
        currentDriverId: toDriverId,
        cityId: effectiveCityId,
        status: "ASSIGNED",
      },
    });

    await tx.vehicleAssignment.create({
      data: {
        vehicleId,
        driverId: toDriverId!,
        startDate: handoverDate,
        status: "ACTIVE",
        notes: cleanText(input.notes),
      },
    });
  } else if (normalized === "RECEIVE") {
    await closeActiveAssignments(tx, vehicleId, returnDate, "تم إغلاق التخصيص بسبب استلام السيارة.");
    if (fromDriverId) {
      await tx.driver.updateMany({ where: { id: fromDriverId, vehicleId }, data: { vehicleId: null, vehicleOwnershipType: "no_vehicle" } });
    }
    await tx.vehicle.update({ where: { id: vehicleId }, data: { currentDriverId: null, status: "AVAILABLE" } });
  } else if (normalized === "ENTER_MAINTENANCE") {
    await tx.vehicle.update({ where: { id: vehicleId }, data: { status: "MAINTENANCE" } });
  } else if (normalized === "EXIT_MAINTENANCE") {
    const current = await tx.vehicle.findUnique({ where: { id: vehicleId }, select: { currentDriverId: true } });
    await tx.vehicle.update({
      where: { id: vehicleId },
      data: { status: current?.currentDriverId ? "ASSIGNED" : "AVAILABLE" },
    });
  } else if (normalized === "RETURN_OWNER") {
    await closeActiveAssignments(tx, vehicleId, returnDate, "تم إغلاق التخصيص بسبب إرجاع السيارة للشركة المالكة.");
    if (fromDriverId) {
      await tx.driver.updateMany({ where: { id: fromDriverId, vehicleId }, data: { vehicleId: null, vehicleOwnershipType: "no_vehicle" } });
    }
    await tx.vehicle.update({ where: { id: vehicleId }, data: { currentDriverId: null, status: "INACTIVE" } });
  }

  return movement;
}

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as MovementInput;
    const movement = await prisma.$transaction((tx) => applyMovement(tx, input));
    return NextResponse.json({ data: movement }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر تسجيل حركة السيارة.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
