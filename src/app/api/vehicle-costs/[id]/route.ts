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

function buildPatch(input: any) {
  const rentCost = money(input.rentCost);
  const maintenanceCost = money(input.maintenanceCost);
  const cleaningCost = money(input.cleaningCost);
  const accidentCost = money(input.accidentCost);
  const damageCost = money(input.damageCost);
  const otherCost = money(input.otherCost);
  const providedTotal = input.totalCost === undefined || input.totalCost === null || input.totalCost === "" ? null : money(input.totalCost);
  const totalCost = providedTotal ?? rentCost + maintenanceCost + cleaningCost + accidentCost + damageCost + otherCost;

  return {
    vehicleId: cleanText(input.vehicleId) || undefined,
    month: cleanText(input.month) || undefined,
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

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const input = await request.json();
    const record = await prisma.vehicleCost.update({ where: { id }, data: buildPatch(input) as any });
    return NextResponse.json({ data: record });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر تعديل تكلفة السيارة.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const record = await prisma.vehicleCost.update({ where: { id }, data: { status: "CANCELLED" } });
    return NextResponse.json({ data: record });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر إلغاء تكلفة السيارة.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
