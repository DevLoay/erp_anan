import { VehicleModernClient } from "@/components/vehicles/VehicleModernClient";
import { getVehicleModuleData, type VehicleModuleKey } from "@/lib/vehicles/vehicleModuleData";
import { headers } from "next/headers";
import { getAccessScope } from "@/lib/auth/accessScope";

type Props = {
  module: VehicleModuleKey;
  openCreate?: boolean;
};

export async function VehicleModulePage({ module, openCreate = false }: Props) {
  const accessScope = await getAccessScope(await headers());
  const data = await getVehicleModuleData(module, accessScope);
  return <VehicleModernClient data={data} openCreate={openCreate} />;
}
