import { NextResponse } from "next/server";
import { buildTemplateWorkbookBuffer } from "@/lib/imports/downloadTemplate";
import { canReadResource, roleFromHeaders } from "@/lib/permissions";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const role = roleFromHeaders(request.headers);
  if (!canReadResource(role, "applications")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const params = await context.params;
  const id = decodeURIComponent(params.id);
  const url = new URL(request.url);
  const fileType = url.searchParams.get("fileType") || id.replace("builtin:", "");
  const buffer = await buildTemplateWorkbookBuffer(id, fileType);
  const safeFileType = fileType.replace(/[^a-z0-9_-]/gi, "-");

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${safeFileType}-template.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
