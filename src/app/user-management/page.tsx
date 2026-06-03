import { UserManagementOldPageClient } from "@/components/users/UserManagementOldPageClient";
import { getUserManagementOldPageData, resolveUserManagementFilters } from "@/lib/users/getUserManagementOldPageData";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function UserManagementPage({ searchParams }: PageProps) {
  const filters = await resolveUserManagementFilters(await searchParams);
  const data = await getUserManagementOldPageData(filters);
  return <UserManagementOldPageClient data={data} />;
}
