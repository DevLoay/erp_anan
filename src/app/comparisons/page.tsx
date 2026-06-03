import Link from "next/link";
import { PageAnalyticsSection } from "@/components/analytics/PageAnalyticsSection";
import { PageShell } from "@/components/ui/PageShell";
import { getPageAnalytics } from "@/lib/page-analytics";

export const dynamic = "force-dynamic";

const comparisonLinks = [
  { title: "مدينة مقابل مدينة", href: "/city-ranking" },
  { title: "مشروع مقابل مشروع", href: "/management-reports" },
  { title: "مشرف مقابل مشرف", href: "/supervisors" },
  { title: "مندوب مقابل مندوب", href: "/rider-reports" },
  { title: "الشهر الحالي مقابل السابق", href: "/management-reports" },
  { title: "التارجت مقابل الفعلي", href: "/city-targets" },
];

export default async function ComparisonsPage() {
  const analytics = await getPageAnalytics("reports");

  return (
    <PageShell title="المقارنات" description="مركز مقارنة المدن والمشاريع والمشرفين والمناديب من البيانات التشغيلية المحفوظة فقط." actions={<Link href="/management-reports" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm transition hover:bg-slate-50">رجوع للتقارير</Link>}>
      <PageAnalyticsSection analytics={analytics} />

      <div className="grid gap-3 md:grid-cols-3">
        {comparisonLinks.map((item) => (
          <Link key={item.title} href={item.href} className="rounded-2xl border border-slate-200 bg-white p-5 text-sm font-black text-slate-950 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50">
            {item.title}
            <span className="mt-2 block text-xs font-bold text-slate-500">افتح التقرير المرتبط وطبّق الفلاتر المطلوبة.</span>
          </Link>
        ))}
      </div>
    </PageShell>
  );
}
