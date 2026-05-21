import { NextResponse } from "next/server";
import { canWriteResource, roleFromHeaders } from "@/lib/permissions";

export async function POST(request: Request) {
  const role = roleFromHeaders(request.headers);

  if (!canWriteResource(role, "applications")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await request.json().catch(() => ({}));

  return NextResponse.json({
    data: null,
    message: "تم استلام طلب الاعتماد، لكن معالجة الاستيراد التفصيلية قيد المراجعة.",
  });
}