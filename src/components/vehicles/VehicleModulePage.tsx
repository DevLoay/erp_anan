import { VehicleLegacyClient } from "@/components/vehicles/VehicleLegacyClient";
import { getVehicleModuleData, type VehicleModuleKey } from "@/lib/vehicles/vehicleModuleData";

export async function VehicleModulePage({ module, openCreate = false }: { module: VehicleModuleKey; openCreate?: boolean }) {
  const data = await getVehicleModuleData(module);
  return <VehicleLegacyClient data={data} openCreate={openCreate} />;
}
