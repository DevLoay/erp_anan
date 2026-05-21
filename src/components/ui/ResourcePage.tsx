import { PageAnalyticsSection } from "@/components/analytics/PageAnalyticsSection";
import { getPageAnalytics } from "@/lib/page-analytics";
import { PageShell } from "./PageShell";
import { ResourceWorkspace } from "./ResourceWorkspace";
import type { ResourceConfig } from "@/lib/resources";

export async function ResourcePage({ resource }: { resource: ResourceConfig }) {
  const analytics = await getPageAnalytics(resource.key);

  return (
    <PageShell title={resource.title} description={resource.description}>
      <PageAnalyticsSection analytics={analytics} />
      <ResourceWorkspace resource={resource} />
    </PageShell>
  );
}
