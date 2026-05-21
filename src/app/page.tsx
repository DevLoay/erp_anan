import { PageAnalyticsSection } from "@/components/analytics/PageAnalyticsSection";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { PageShell } from "@/components/ui/PageShell";
import { getPageAnalytics } from "@/lib/page-analytics";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const analytics = await getPageAnalytics("dashboard");

  return (
    <PageShell
      title="Dashboard"
      description="مؤشرات حقيقية من PostgreSQL. عند عدم وجود بيانات تظهر القيم صفر بدون أرقام وهمية."
    >
      <PageAnalyticsSection analytics={analytics} />
      <DashboardView />
    </PageShell>
  );
}
