import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function NewVehiclePage() {
  redirect("/vehicles?openCreate=1");
}
