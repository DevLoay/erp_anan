import { DataCleaningScanButton } from "@/components/data-cleaning/DataCleaningScanButton";
import { ResourceWorkspace } from "@/components/ui/ResourceWorkspace";
import { PageShell } from "@/components/ui/PageShell";
import { resources } from "@/lib/resources";

export const dynamic = "force-dynamic";

export default function DataCleaningPage() {
  return (
    <PageShell
      title="تنظيف البيانات"
      description="كشف التكرارات والروابط الناقصة بين المناديب، المدن، المشاريع، الحسابات والسيارات بدون حذف تلقائي."
    >
      <DataCleaningScanButton />
      <ResourceWorkspace resource={resources["data-cleaning-issues"]} />
    </PageShell>
  );
}
