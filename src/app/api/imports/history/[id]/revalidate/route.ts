import { NextResponse } from "next/server";
import { canWriteResource, roleFromHeaders } from "@/lib/permissions";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const role = roleFromHeaders(request.headers);
  if (!canWriteResource(role, "applications")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await context.params;
  return NextResponse.json({
    data: { id },
    message: "إعادة التحقق قيد التطوير. الدفعة محفوظة ويمكن مراجعة الأخطاء من شاشة التفاصيل.",
  });
}

