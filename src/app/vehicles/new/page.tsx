import { VehicleModulePage } from "@/components/vehicles/VehicleModulePage";

export const dynamic = "force-dynamic";

export default function NewVehiclePage() {
  return <VehicleModulePage module="vehicles" openCreate />;
}
