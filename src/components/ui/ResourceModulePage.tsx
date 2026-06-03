import Link from "next/link";
import { PageAnalyticsSection } from "@/components/analytics/PageAnalyticsSection";
import { PageShell } from "@/components/ui/PageShell";
import { ResourceWorkspace } from "@/components/ui/ResourceWorkspace";
import { getPageAnalytics } from "@/lib/page-analytics";
import type { ResourceConfig } from "@/lib/resources";

type ResourceModulePageProps = {
  resource: ResourceConfig;
  analyticsKey?: string;
  backHref?: string;
  backLabel?: string;
};

export async function ResourceModulePage({ resource, analyticsKey = "reports", backHref, backLabel }: ResourceModulePageProps) {
  const analytics = await getPageAnalytics(analyticsKey);

  return (
    <PageShell
      title={resource.title}
      description={resource.description}
      actions={
        backHref ? (
          <Link href={backHref} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm transition hover:bg-slate-50">
            {backLabel ?? "رجوع"}
          </Link>
        ) : null
      }
    >
      <PageAnalyticsSection analytics={analytics} />

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-black text-slate-500">المسار</p>
          <p className="mt-2 text-sm font-black text-slate-950">{resource.route}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-black text-slate-500">مصدر البيانات</p>
          <p className="mt-2 text-sm font-black text-slate-950">{resource.api}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-black text-slate-500">الحالة</p>
          <p className="mt-2 text-sm font-black text-emerald-700">متصل بقاعدة البيانات</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-black text-slate-500">الإجراءات</p>
          <p className="mt-2 text-sm font-black text-slate-950">عرض، إضافة، تعديل، حذف آمن، تصدير CSV</p>
        </div>
      </div>

      <ResourceWorkspace resource={resource} />
    </PageShell>
  );
}
