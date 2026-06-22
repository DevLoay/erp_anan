import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dateField, mergeAttachments, numberField, optionalTextField, saveVehicleAttachments, statusField, textField } from "../../_vehicleUploads";

export const runtime = "nodejs";

async function vehicleDefaults(vehicleId: string) {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: { currentDriverId: true, cityId: true },
  });
  return {
    driverId: vehicle?.currentDriverId || null,
    cityId: vehicle?.cityId || null,
  };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const form = await request.formData();
    const existing = await prisma.vehicleAccident.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "سجل الحادث غير موجود." }, { status: 404 });

    const uploaded = await saveVehicleAttachments(form, { folder: "accidents", required: false });
    const vehicleId = textField(form, "vehicleId");
    const effectiveVehicleId = vehicleId || existing.vehicleId;
    const vehicle = await vehicleDefaults(effectiveVehicleId);
    const record = await prisma.vehicleAccident.update({
      where: { id },
      data: {
        ...(vehicleId ? { vehicleId } : {}),
        driverId: vehicle.driverId || optionalTextField(form, "driverId"),
        cityId: vehicle.cityId || optionalTextField(form, "cityId"),
        type: optionalTextField(form, "type"),
        date: dateField(form, "date", existing.date),
        cost: numberField(form, "cost"),
        liabilityPercent: numberField(form, "liabilityPercent"),
        status: statusField(form),
        notes: optionalTextField(form, "notes"),
        attachments: mergeAttachments(existing.attachments, uploaded),
      },
    });

    return NextResponse.json({ data: record });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر تعديل سجل الحادث.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.vehicleAccident.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
