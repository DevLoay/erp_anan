import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { RiderLoginClient } from "@/components/rider-app/RiderLoginClient";
import { getRiderSession } from "@/lib/rider-app/riderAuth";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RiderLoginPage({ searchParams }: PageProps) {
  const next = String((await searchParams).next ?? "/rider-app/dashboard");
  const context = await getRiderSession(await headers());
  if (context) redirect(next.startsWith("/rider-app") ? next : "/rider-app/dashboard");
  return <RiderLoginClient nextPath={next.startsWith("/rider-app") ? next : "/rider-app/dashboard"} />;
}
