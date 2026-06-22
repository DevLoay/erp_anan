import { NextResponse } from "next/server";
import { canWriteResource, roleFromHeaders } from "@/lib/permissions";

export async function POST(request: Request) {
  const role = roleFromHeaders(request.headers);
  if (!canWriteResource(role, "import-batches")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(
    {
      error:
        "مسار اعتماد الاستيراد القديم تم تعطيله لحماية ربط المشاريع. استخدم /api/imports/commit بعد Preview من شاشة الاستيراد الجديدة.",
      replacement: "/api/imports/commit",
    },
    { status: 410 },
  );
}
