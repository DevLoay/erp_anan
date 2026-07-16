import { NextResponse } from "next/server";
import { getHungerStationCompanyPayrollPreview } from "@/lib/payroll/hungerstationCompanyPayroll";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const month = url.searchParams.get("month") || "2026-04";
  const projectCode = url.searchParams.get("projectCode") || undefined;
  const applicationProjectId = url.searchParams.get("applicationProjectId") || undefined;

  const preview = await getHungerStationCompanyPayrollPreview({ month, projectCode, applicationProjectId });
  return NextResponse.json(preview);
}
