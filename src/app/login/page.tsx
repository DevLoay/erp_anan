import { LoginClient } from "./LoginClient";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: PageProps) {
  const next = String((await searchParams).next ?? "/dashboard");
  return <LoginClient nextPath={next.startsWith("/") ? next : "/dashboard"} />;
}

