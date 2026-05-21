import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  assertNoDuplicatePayrollSetting,
  getPayrollSettingsData,
  isDatabaseOffline,
  normalizePayrollSettingPayload,
  resolvePayrollSettingFilters,
} from "@/lib/payroll/payrollSettings";
import { canReadResource, canWriteResource, roleFromHeaders } from "@/lib/permissions";

export async function GET(request: Request) {
  const role = roleFromHeaders(request.headers);
  if (!canReadResource(role, "payroll")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const filters = resolvePayrollSettingFilters(Object.fromEntries(new URL(request.url).searchParams.entries()));
    const data = await getPayrollSettingsData(filters);
    return NextResponse.json({ data });
  } catch (error) {
    if (isDatabaseOffline(error)) return NextResponse.json({ error: "Database offline" }, { status: 503 });
    throw error;
  }
}

export async function POST(request: Request) {
  const role = roleFromHeaders(request.headers);
  if (!canWriteResource(role, "payroll")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const payload = normalizePayrollSettingPayload(body);
    await assertNoDuplicatePayrollSetting({
      applicationId: payload.applicationId,
      applicationProjectId: payload.applicationProjectId ?? null,
      cityId: payload.cityId ?? null,
    });
    const data = await prisma.applicationPayrollSetting.create({ data: payload });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    if (isDatabaseOffline(error)) return NextResponse.json({ error: "Database offline" }, { status: 503 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر حفظ إعداد المسير." }, { status: 400 });
  }
}

