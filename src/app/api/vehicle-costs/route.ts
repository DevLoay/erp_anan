import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function cleanText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function money(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function safeRecordStatus(value: unknown) {
  const raw = String(value ?? "ACTIVE").trim().toUpperCase();
  const allowed = new Set(["ACTIVE", "INACTIVE", "PENDING", "APPROVED", "REJECTED", "LOCKED", "CANCELLED"]);
  return allowed.has(raw) ? raw : "ACTIVE";
}

function buildData(input: any) {
  const rentCost = money(input.rentCost);
  const maintenanceCost = money(input.maintenanceCost);
  const cleaningCost = money(input.cleaningCost);
  const accidentCost = money(input.accidentCost);
  const damageCost = money(input.damageCost);
  const otherCost = money(input.otherCost);
  const providedTotal = input.totalCost === undefined || input.totalCost === null || input.totalCost === "" ? null : money(input.totalCost);
  const totalCost = providedTotal ?? rentCost + maintenanceCost + cleaningCost + accidentCost + damageCost + otherCost;

  return {
    vehicleId: cleanText(input.vehicleId),
    month: cleanText(input.month),
    rentCost,
    maintenanceCost,
    cleaningCost,
    accidentCost,
    damageCost,
    otherCost,
    totalCost,
    status: safeRecordStatus(input.status) as any,
  };
}

export async function POST(request: Request) {
  try {
    const input = await request.json();
    const data = buildData(input);
    if (!data.vehicleId) return NextResponse.json({ error: "السيارة مطلوبة." }, { status: 400 });
    if (!data.month) return NextResponse.json({ error: "الشهر مطلوب بصيغة YYYY-MM." }, { status: 400 });

    const record = await prisma.vehicleCost.upsert({
      where: { vehicleId_month: { vehicleId: data.vehicleId, month: data.month } },
      create: data as any,
      update: data as any,
    });

    return NextResponse.json({ data: record }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر حفظ تكلفة السيارة.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
