import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

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
  const raw = String(value ?? "ACTIVE").trim().toUpperCase();
  const allowed = new Set(["ACTIVE", "INACTIVE", "PENDING", "APPROVED", "REJECTED", "LOCKED", "CANCELLED", "DEDUCTED", "PARTIALLY_DEDUCTED"]);
  return allowed.has(raw) ? raw : "ACTIVE";
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const input = await request.json();
    const record = await prisma.vehicleMovement.update({
      where: { id },
      data: {
        vehicleId: cleanText(input.vehicleId) || undefined,
        movementType: cleanText(input.movementType) || undefined,
        fromDriverId: cleanText(input.fromDriverId),
        toDriverId: cleanText(input.toDriverId),
        cityId: cleanText(input.cityId),
        handoverDate: parseDate(input.handoverDate),
        returnDate: parseDate(input.returnDate),
        status: safeRecordStatus(input.status) as any,
        notes: cleanText(input.notes),
      },
    });

    return NextResponse.json({ data: record });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر تعديل حركة السيارة.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const record = await prisma.vehicleMovement.update({ where: { id }, data: { status: "CANCELLED" } });
    return NextResponse.json({ data: record });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر إلغاء حركة السيارة.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
