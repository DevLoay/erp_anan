import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { RiderAppClient } from "@/components/rider-app/RiderAppClient";
import { getRiderSession } from "@/lib/rider-app/riderAuth";
import { getRiderPageData, riderSections, type RiderSection } from "@/lib/rider-app/riderData";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ section: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function RiderSectionPage({ params, searchParams }: PageProps) {
  const rawSection = (await params).section;
  const section = riderSections.includes(rawSection as RiderSection) ? (rawSection as RiderSection) : "dashboard";
  const month = first((await searchParams).month);

  try {
    const context = await getRiderSession(await headers());
    if (!context) redirect(`/rider-app/login?next=/rider-app/${section}`);
    const data = await getRiderPageData(context, section, month);
    return <RiderAppClient initialData={data} section={section} />;
  } catch (error) {
    if ((error as Error & { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw error;
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-4" dir="rtl">
        <section className="w-full max-w-md rounded-3xl border border-red-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-black text-red-700">قاعدة البيانات غير متصلة</p>
          <h1 className="mt-2 text-2xl font-black text-slate-950">تعذر تحميل تطبيق المندوب</h1>
          <p className="mt-2 text-sm font-bold text-slate-500">يرجى تشغيل PostgreSQL ثم تحديث الصفحة.</p>
          <a href="/rider-app/dashboard" className="mt-5 inline-flex rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white">تحديث</a>
        </section>
      </main>
    );
  }
}
