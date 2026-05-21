import { NextResponse } from "next/server";
import { copyPayrollSetting, isDatabaseOffline } from "@/lib/payroll/payrollSettings";
import { canWriteResource, roleFromHeaders } from "@/lib/permissions";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const role = roleFromHeaders(request.headers);
  if (!canWriteResource(role, "payroll")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await context.params;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const data = await copyPayrollSetting({
      sourceSettingId: id,
      targetApplicationId: String(body.targetApplicationId ?? ""),
      targetApplicationProjectId: String(body.targetApplicationProjectId ?? "") || null,
      cityId: String(body.cityId ?? "") || null,
      name: String(body.name ?? "").trim() || "نسخة من إعداد المسير",
    });
    return NextResponse.json({ data, message: "تم نسخ إعداد المسير بنجاح." }, { status: 201 });
  } catch (error) {
    if (isDatabaseOffline(error)) return NextResponse.json({ error: "Database offline" }, { status: 503 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر نسخ إعداد المسير." }, { status: 400 });
  }
}

