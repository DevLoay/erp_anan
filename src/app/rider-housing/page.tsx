import { RiderHousingClient } from "@/components/hr/RiderHousingClient";
import { getRiderHousingData, resolveRiderHousingFilters } from "@/lib/hr/getRiderHousingData";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RiderHousingPage({ searchParams }: PageProps) {
  const filters = resolveRiderHousingFilters(await searchParams);
  const data = await getRiderHousingData(filters);
  return <RiderHousingClient data={data} />;
}
