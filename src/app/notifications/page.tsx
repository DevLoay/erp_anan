import { NotificationsAlertsClient } from "@/components/notifications/NotificationsAlertsClient";
import { getNotificationsData, resolveNotificationFilters } from "@/lib/notifications/getNotificationsData";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NotificationsPage({ searchParams }: PageProps) {
  const filters = resolveNotificationFilters(await searchParams);
  const data = await getNotificationsData(filters);
  return <NotificationsAlertsClient data={data} />;
}
