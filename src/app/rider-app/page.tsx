import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function RiderAppIndexPage() {
  redirect("/rider-app/dashboard");
}
