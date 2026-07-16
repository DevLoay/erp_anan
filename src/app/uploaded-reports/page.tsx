import { redirect } from "next/navigation";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function queryString(params: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
    else if (value !== undefined) query.set(key, value);
  }
  return query.toString();
}

export default async function UploadedReportsRedirectPage({ searchParams }: PageProps) {
  const query = queryString(await searchParams);
  redirect(query ? `/imports/history?${query}` : "/imports/history");
}
