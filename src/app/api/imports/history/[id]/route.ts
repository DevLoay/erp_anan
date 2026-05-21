import { NextResponse } from "next/server";
import { getImportBatchDetails } from "@/lib/imports/importHistory";
import { canReadResource, roleFromHeaders } from "@/lib/permissions";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const role = roleFromHeaders(request.headers);
  if (!canReadResource(role, "applications")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const data = await getImportBatchDetails(id);
  if (data.databaseStatus === "online" && !data.batch) return NextResponse.json({ error: "Import batch not found" }, { status: 404 });
  return NextResponse.json({ data });
}

