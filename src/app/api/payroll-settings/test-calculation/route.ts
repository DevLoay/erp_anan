import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { testSalaryCalculation } from "@/lib/payroll/testCalculation";
import { isDatabaseOffline } from "@/lib/payroll/payrollSettings";
import { canReadResource, roleFromHeaders } from "@/lib/permissions";

export async function POST(request: Request) {
  const role = roleFromHeaders(request.headers);
  if (!canReadResource(role, "payroll")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const settingId = String(body.settingId ?? "");
    if (!settingId) return NextResponse.json({ error: "اختر إعداد المسير أولًا." }, { status: 400 });

    const setting = await prisma.applicationPayrollSetting.findUnique({ where: { id: settingId } });
    if (!setting) return NextResponse.json({ error: "إعداد المسير غير موجود." }, { status: 404 });

    const result = testSalaryCalculation(body, setting);
    return NextResponse.json({ data: result });
  } catch (error) {
    if (isDatabaseOffline(error)) return NextResponse.json({ error: "Database offline" }, { status: 503 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر اختبار حساب الراتب." }, { status: 400 });
  }
}

