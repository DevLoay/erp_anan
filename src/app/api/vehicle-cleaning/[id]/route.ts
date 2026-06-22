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
    const existing = await prisma.vehicleCleaning.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "سجل النظافة غير موجود." }, { status: 404 });

    const uploaded = await saveVehicleAttachments(form, { folder: "cleaning", required: false, imagesOnly: true });
    const vehicleId = textField(form, "vehicleId");
    const effectiveVehicleId = vehicleId || existing.vehicleId;
    const vehicle = await vehicleDefaults(effectiveVehicleId);
    const record = await prisma.vehicleCleaning.update({
      where: { id },
      data: {
        ...(vehicleId ? { vehicleId } : {}),
        driverId: vehicle.driverId || optionalTextField(form, "driverId"),
        cleanDate: dateField(form, "cleanDate", existing.cleanDate),
        cost: numberField(form, "cost"),
        status: statusField(form),
        notes: optionalTextField(form, "notes"),
        attachments: mergeAttachments(existing.attachments, uploaded),
      },
    });

    return NextResponse.json({ data: record });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر تعديل سجل النظافة.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.vehicleCleaning.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
