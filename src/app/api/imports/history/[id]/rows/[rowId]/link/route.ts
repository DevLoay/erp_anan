import { NextResponse } from "next/server";
import { canWriteResource, roleFromHeaders } from "@/lib/permissions";
import { linkImportRowToDriver } from "@/lib/imports/linkImportRow";

type RouteContext = {
  params: Promise<{ id: string; rowId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const role = roleFromHeaders(request.headers);
  if (!canWriteResource(role, "applications")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, rowId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { driverId?: string; applicationAccountId?: string };
  if (!body.driverId) return NextResponse.json({ error: "اختر المندوب قبل تنفيذ الربط." }, { status: 400 });

  try {
    const data = await linkImportRowToDriver({
      batchId: id,
      rowId,
      driverId: body.driverId,
      applicationAccountId: body.applicationAccountId || undefined,
    });
    return NextResponse.json({
      data,
      message: data.dailyReport.created
        ? "تم ربط الصف بالمندوب وإنشاء تقرير يومي جديد."
        : data.dailyReport.updated
          ? "تم ربط الصف بالمندوب وتحديث التقرير اليومي الموجود."
          : "تم ربط الصف بالمندوب وحساب التطبيق.",
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر ربط الصف بالمندوب." }, { status: 400 });
  }
}
