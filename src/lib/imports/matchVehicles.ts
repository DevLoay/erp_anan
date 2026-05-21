import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type MatchedVehicle = {
  id: string;
  label: string;
  plateArabic: string;
  plateEnglish: string;
  status: string;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

export async function matchVehicleFromMappedData(mappedData: Record<string, unknown>): Promise<{
  status: "matched" | "missing_vehicle" | "duplicate_match" | "not_required";
  vehicle?: MatchedVehicle;
  message?: string;
}> {
  const vehicleCode = clean(mappedData.vehicleCode);
  const plateArabic = clean(mappedData.plateArabic || mappedData.plateAr || mappedData.vehiclePlate);
  const plateEnglish = clean(mappedData.plateEnglish || mappedData.plateEn || mappedData.vehiclePlate);

  if (!vehicleCode && !plateArabic && !plateEnglish) return { status: "not_required" };

  const vehicles = await prisma.vehicle.findMany({
    where: {
      OR: [
        vehicleCode ? { vehicleCode } : undefined,
        plateArabic ? { plateArabic } : undefined,
        plateArabic ? { plateAr: plateArabic } : undefined,
        plateEnglish ? { plateEnglish } : undefined,
        plateEnglish ? { plateEn: plateEnglish } : undefined,
      ].filter(Boolean) as Prisma.VehicleWhereInput[],
    },
    select: {
      id: true,
      vehicleCode: true,
      plateArabic: true,
      plateAr: true,
      plateEnglish: true,
      plateEn: true,
      status: true,
    },
    take: 3,
  });

  if (!vehicles.length) return { status: "missing_vehicle", message: "لم يتم العثور على السيارة." };
  if (vehicles.length > 1) return { status: "duplicate_match", message: "تم العثور على أكثر من سيارة بنفس بيانات الربط." };

  const vehicle = vehicles[0];
  return {
    status: "matched",
    vehicle: {
      id: vehicle.id,
      label: vehicle.vehicleCode || vehicle.plateArabic || vehicle.plateAr || vehicle.plateEnglish || vehicle.plateEn || vehicle.id,
      plateArabic: vehicle.plateArabic || vehicle.plateAr || "-",
      plateEnglish: vehicle.plateEnglish || vehicle.plateEn || "-",
      status: String(vehicle.status),
    },
  };
}
