import { RiderDocumentsClient } from "@/components/rider-documents/RiderDocumentsClient";
import { getRiderDocumentsData, resolveRiderDocumentFilters } from "@/lib/rider-documents/getRiderDocumentsData";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RiderDocumentsPage({ searchParams }: PageProps) {
  const filters = resolveRiderDocumentFilters((await searchParams) ?? {});
  const data = await getRiderDocumentsData(filters);
  return <RiderDocumentsClient data={data} />;
}
