import Link from "next/link";
import { PageAnalyticsSection } from "@/components/analytics/PageAnalyticsSection";
import { ResourceWorkspace } from "@/components/ui/ResourceWorkspace";
import { PageShell } from "@/components/ui/PageShell";
import { getPageAnalytics } from "@/lib/page-analytics";
import { resources } from "@/lib/resources";

export const dynamic = "force-dynamic";

const financeLinks = [
  { title: "مسير الرواتب", href: "/payroll", tone: "bg-slate-950 text-white border-slate-950" },
  { title: "الفواتير", href: "/invoices", tone: "bg-sky-50 text-sky-800 border-sky-200" },
  { title: "المصروفات", href: "/expenses", tone: "bg-red-50 text-red-800 border-red-200" },
  { title: "الأرباح والخسائر", href: "/profit-loss", tone: "bg-emerald-50 text-emerald-800 border-emerald-200" },
];

export default async function FinancePage() {
  const analytics = await getPageAnalytics("finance");

  return (
    <PageShell
      title="مركز الماليات"
      description="مركز تشغيل للرواتب والسلف والخصومات والفواتير، بدون أرقام وهمية وباعتماد البيانات المحفوظة فقط."
    >
      <PageAnalyticsSection analytics={analytics} />

      <div className="grid gap-3 md:grid-cols-4">
        {financeLinks.map((item) => (
          <Link key={item.href} href={item.href} className={`rounded-lg border p-4 text-sm font-black shadow-sm transition hover:-translate-y-0.5 ${item.tone}`}>
            {item.title}
          </Link>
        ))}
      </div>

      <div className="grid gap-5">
        <section className="space-y-3">
          <h2 className="text-lg font-black text-slate-950">مسير الرواتب</h2>
          <ResourceWorkspace resource={resources.payroll} compact />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-black text-slate-950">سلف المناديب</h2>
          <ResourceWorkspace resource={resources.advances} compact />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-black text-slate-950">الخصومات</h2>
          <ResourceWorkspace resource={resources.deductions} compact />
        </section>
      </div>
    </PageShell>
  );
}
