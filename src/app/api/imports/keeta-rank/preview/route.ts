import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeAppKey } from "@/lib/applications/applicationAnalytics";
import { buildKeetaRankPreview } from "@/lib/imports/keetaRankPreview";
import { canWriteResource, roleFromHeaders } from "@/lib/permissions";

function dbOffline(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: string }).code) : "";
  return code === "P1001" || code === "P1002" || message.includes("Can't reach database server");
}

export async function POST(request: Request) {
  const role = roleFromHeaders(request.headers);
  if (!canWriteResource(role, "applications")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "يجب رفع ملف Excel أو CSV أولًا" }, { status: 400 });

    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith(".xlsx") && !lowerName.endsWith(".xls") && !lowerName.endsWith(".csv")) {
      return NextResponse.json({ error: "صيغة الملف غير مدعومة. استخدم Excel أو CSV." }, { status: 400 });
    }

    const applications = await prisma.application.findMany({ select: { id: true, code: true, name: true } });
    const keeta = applications.find((app) => normalizeAppKey(`${app.code} ${app.name}`) === "keeta");
    if (!keeta) {
      const legacyKeetaCount = await prisma.applicationAccount.count({ where: { appName: "Keeta" } });
      if (!legacyKeetaCount) return NextResponse.json({ error: "لا يوجد تطبيق Keeta أو حسابات Keeta في قاعدة البيانات." }, { status: 404 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const preview = await buildKeetaRankPreview(file.name, buffer, keeta?.id ?? null);
    return NextResponse.json({
      data: {
        ...preview,
        applicationId: keeta?.id ?? "",
        applicationProjectId: String(form.get("applicationProjectId") ?? ""),
        rankSettingId: String(form.get("rankSettingId") ?? ""),
      },
    });
  } catch (error) {
    if (dbOffline(error)) return NextResponse.json({ error: "Database offline" }, { status: 503 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر قراءة ملف Keeta Rank" }, { status: 400 });
  }
}
