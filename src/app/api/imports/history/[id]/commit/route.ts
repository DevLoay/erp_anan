import { NextResponse } from "next/server";
import { reprocessStoredImportBatch } from "@/lib/imports/commitImport";
import { canWriteResource, roleFromHeaders } from "@/lib/permissions";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const role = roleFromHeaders(request.headers);

  if (!canWriteResource(role, "applications")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  const data = await reprocessStoredImportBatch(id);

  return NextResponse.json({
    data,
    message: "تم اعتماد الدفعة، والمعالجة التفصيلية ستكتمل في مرحلة لاحقة.",
  });
}
