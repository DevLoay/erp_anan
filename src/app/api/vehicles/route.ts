import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const COMPANY_CAR_MONTHLY_RENT = 2000;
const COMPANY_CAR_DAILY_RENT = Number((COMPANY_CAR_MONTHLY_RENT / 30).toFixed(2));

function cleanText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function numberOrNull(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function intOrNull(value: unknown) {
  const number = numberOrNull(value);
  return number === null ? null : Math.trunc(number);
}

function normalizeVehicleStatus(value: unknown) {
  const status = String(value ?? "AVAILABLE").trim().toUpperCase();
  const allowed = new Set(["AVAILABLE", "ASSIGNED", "MAINTENANCE", "ACCIDENT", "INACTIVE"]);
  return allowed.has(status) ? status : "AVAILABLE";
}

function normalizeOwnership(value: unknown) {
  const text = String(value ?? "company").trim().toLowerCase();
  if (text.includes("personal") || text.includes("شخص")) return "personal";
  if (text.includes("rental") || text.includes("إيجار") || text.includes("ايجار")) return "rental";
  return "company";
}

function rentValues(ownershipType: string, monthlyInput: unknown, dailyInput: unknown) {
  if (ownershipType === "personal") return { monthlyRent: 0, dailyRent: 0 };
  // قاعدة الشركة المعتمدة: 2000 شهري / 30 = 66.67 يومي، حتى لو الشهر 31 يوم السقف 2000.
  return { monthlyRent: COMPANY_CAR_MONTHLY_RENT, dailyRent: COMPANY_CAR_DAILY_RENT };
}

async function resolveRentalCompanyId(inputId: unknown, inputName: unknown) {
  const rentalCompanyId = cleanText(inputId);
  if (rentalCompanyId) {
    const existing = await prisma.rentalCompany.findUnique({ where: { id: rentalCompanyId }, select: { id: true, name: true } });
    if (!existing) throw new Error("شركة التأجير المختارة غير موجودة.");
    return existing;
  }

  const name = cleanText(inputName);
  if (!name) return null;

  const existing = await prisma.rentalCompany.findFirst({ where: { name }, select: { id: true, name: true } });
  if (existing) return existing;

  return prisma.rentalCompany.create({ data: { name, status: "ACTIVE" as any }, select: { id: true, name: true } });
}

async function vehicleData(body: Record<string, unknown>) {
  const plateEn = cleanText(body.plateEn || body.plateEnglish);
  if (!plateEn) throw new Error("اللوحة الإنجليزي مطلوبة.");

  const ownershipType = normalizeOwnership(body.ownershipType);
  const rent = rentValues(ownershipType, body.monthlyRent, body.dailyRent);
  const rentalCompany = ownershipType === "personal" ? null : await resolveRentalCompanyId(body.rentalCompanyId, body.rentalCompany);
  const currentDriverId = cleanText(body.currentDriverId);

  return {
    vehicleCode: cleanText(body.vehicleCode),
    plateAr: cleanText(body.plateAr || body.plateArabic),
    plateArabic: cleanText(body.plateAr || body.plateArabic),
    plateEn,
    plateEnglish: plateEn,
    brand: cleanText(body.brand),
    model: cleanText(body.model),
    year: intOrNull(body.year),
    ownershipType,
    rentalCompany: rentalCompany?.name || cleanText(body.rentalCompany),
    rentalCompanyId: rentalCompany?.id || null,
    dailyRent: rent.dailyRent,
    monthlyRent: rent.monthlyRent,
    cityId: cleanText(body.cityId),
    currentDriverId,
    status: currentDriverId ? "ASSIGNED" as any : normalizeVehicleStatus(body.status) as any,
  };
}

async function syncDriverLink(tx: any, vehicleId: string, oldDriverId: string | null | undefined, newDriverId: string | null | undefined, ownershipType: string) {
  if (oldDriverId && oldDriverId !== newDriverId) {
    await tx.driver.updateMany({ where: { id: oldDriverId, vehicleId }, data: { vehicleId: null, vehicleOwnershipType: "no_vehicle" } });
  }
  if (newDriverId) {
    await tx.driver.updateMany({ where: { id: newDriverId }, data: { vehicleId, vehicleOwnershipType: ownershipType === "personal" ? "personal" : "company" } });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const data = await vehicleData(body);

    const result = await prisma.$transaction(async (tx) => {
      const vehicle = await tx.vehicle.create({ data: data as any });
      await syncDriverLink(tx, vehicle.id, null, data.currentDriverId, data.ownershipType);
      return vehicle;
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر حفظ السيارة.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
