import { NextResponse } from "next/server";
import { getImportHistoryData } from "@/lib/imports/importHistory";
import { canReadResource, roleFromHeaders } from "@/lib/permissions";

export async function GET(request: Request) {
  const role = roleFromHeaders(request.headers);
  if (!canReadResource(role, "applications")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const data = await getImportHistoryData();
  return NextResponse.json({ data });
}

