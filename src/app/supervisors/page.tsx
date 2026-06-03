import { SupervisorsOperationsClient } from "@/components/supervisors/SupervisorsOperationsClient";
import { PageShell } from "@/components/ui/PageShell";
import { ResourceWorkspace } from "@/components/ui/ResourceWorkspace";
import { getSupervisorPerformanceReport } from "@/lib/supervisor-performance";
import { resources } from "@/lib/resources";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SupervisorsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const report = await getSupervisorPerformanceReport(params);

  return (
    <PageShell
      title="المشرفين"
      description="صفحة تشغيلية لتقييم المشرفين حسب الأداء والمهام والمناديب المرتبطين، مع الحفاظ على إدارة سجلات المشرفين."
    >
      <div suppressHydrationWarning>
        <SupervisorsOperationsClient report={report} />
      </div>

      <details id="supervisor-crud" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" suppressHydrationWarning>
        <summary className="cursor-pointer text-base font-black text-slate-950">
          إدارة سجلات المشرفين
        </summary>
        <div className="mt-4">
          <ResourceWorkspace resource={resources.supervisors} compact />
        </div>
      </details>
    </PageShell>
  );
}
