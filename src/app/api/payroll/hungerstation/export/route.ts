import { NextResponse } from "next/server";
import { buildHungerStationCompanyPayrollCsv, getHungerStationCompanyPayrollPreview } from "@/lib/payroll/hungerstationCompanyPayroll";

export const dynamic = "force-dynamic";

function fileSafe(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const month = url.searchParams.get("month") || "2026-04";
  const projectCode = url.searchParams.get("projectCode") || undefined;
  const applicationProjectId = url.searchParams.get("applicationProjectId") || undefined;

  const preview = await getHungerStationCompanyPayrollPreview({ month, projectCode, applicationProjectId });
  const csv = buildHungerStationCompanyPayrollCsv(preview);
  const suffix = projectCode || applicationProjectId || "ALL";
  const filename = `hungerstation-company-payroll-${fileSafe(month)}-${fileSafe(suffix)}.csv`;

  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
