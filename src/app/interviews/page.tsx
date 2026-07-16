import { InterviewsClient } from "@/components/interviews/InterviewsClient";
import { getInterviewsPageData, resolveInterviewFilters } from "@/lib/interviews/getInterviewsPageData";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function InterviewsPage({ searchParams }: PageProps) {
  const filters = resolveInterviewFilters(await searchParams);
  const data = await getInterviewsPageData(filters);
  return <InterviewsClient data={data} />;
}
