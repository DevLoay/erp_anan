import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dateField, numberField, optionalTextField, saveVehicleAttachments, statusField, textField } from "../_vehicleUploads";

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

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const vehicleId = textField(form, "vehicleId");
    if (!vehicleId) return NextResponse.json({ error: "السيارة مطلوبة." }, { status: 400 });

    const vehicle = await vehicleDefaults(vehicleId);
    const attachments = await saveVehicleAttachments(form, { folder: "cleaning", required: true, imagesOnly: true });
    const record = await prisma.vehicleCleaning.create({
      data: {
        vehicleId,
        driverId: vehicle.driverId || optionalTextField(form, "driverId"),
        cleanDate: dateField(form, "cleanDate"),
        cost: numberField(form, "cost"),
        status: statusField(form),
        notes: optionalTextField(form, "notes"),
        attachments,
      },
    });

    return NextResponse.json({ data: record }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر حفظ نظافة السيارة.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
