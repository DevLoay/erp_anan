import { LoginClient } from "./LoginClient";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const next = String(params.next ?? "/dashboard");
  const error = String(params.error ?? "");
  const errorMessage =
    error === "missing"
      ? "البريد الإلكتروني وكلمة المرور مطلوبان."
      : error === "invalid"
      ? "بيانات الدخول غير صحيحة أو الحساب غير نشط."
      : "";
  return <LoginClient nextPath={next.startsWith("/") ? next : "/dashboard"} errorMessage={errorMessage} />;
}

