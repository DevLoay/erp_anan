import { VehicleModernClient } from "@/components/vehicles/VehicleModernClient";
import { getVehicleModuleData, type VehicleModuleKey } from "@/lib/vehicles/vehicleModuleData";

type Props = {
  module: VehicleModuleKey;
  openCreate?: boolean;
};

export async function VehicleModulePage({ module, openCreate = false }: Props) {
  const data = await getVehicleModuleData(module);
  return <VehicleModernClient data={data} openCreate={openCreate} />;
}
