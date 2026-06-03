import { headers } from "next/headers";
import { AttendanceCameraClient } from "@/components/attendance/AttendanceCameraClient";
import { getAccessScope } from "@/lib/auth/accessScope";
import { getAttendancePageData, resolveAttendanceFilters } from "@/lib/attendance/getAttendancePageData";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AttendancePage({ searchParams }: PageProps) {
  const accessScope = await getAccessScope(await headers());
  const filters = resolveAttendanceFilters(await searchParams, accessScope);
  const data = await getAttendancePageData(filters);
  return <AttendanceCameraClient data={data} />;
}
