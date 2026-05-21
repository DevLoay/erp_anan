import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  assertNoDuplicatePayrollSetting,
  isDatabaseOffline,
  normalizePayrollSettingPayload,
} from "@/lib/payroll/payrollSettings";
import { canReadResource, canWriteResource, roleFromHeaders } from "@/lib/permissions";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const role = roleFromHeaders(request.headers);
  if (!canReadResource(role, "payroll")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await context.params;

  try {
    const data = await prisma.applicationPayrollSetting.findUnique({
      where: { id },
      include: {
        application: { select: { id: true, code: true, name: true } },
        applicationProject: { select: { id: true, code: true, name: true } },
        city: { select: { id: true, nameAr: true, nameEn: true } },
      },
    });
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data });
  } catch (error) {
    if (isDatabaseOffline(error)) return NextResponse.json({ error: "Database offline" }, { status: 503 });
    throw error;
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const role = roleFromHeaders(request.headers);
  if (!canWriteResource(role, "payroll")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await context.params;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const payload = normalizePayrollSettingPayload(body);
    await assertNoDuplicatePayrollSetting({
      id,
      applicationId: payload.applicationId,
      applicationProjectId: payload.applicationProjectId ?? null,
      cityId: payload.cityId ?? null,
    });
    const data = await prisma.applicationPayrollSetting.update({ where: { id }, data: payload });
    return NextResponse.json({ data });
  } catch (error) {
    if (isDatabaseOffline(error)) return NextResponse.json({ error: "Database offline" }, { status: 503 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر تعديل إعداد المسير." }, { status: 400 });
  }
}

