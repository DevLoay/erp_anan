import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function NewDriverPage() {
  redirect("/drivers?newDriver=1");
}
