import { NextResponse } from "next/server";
import { buildImportPreview } from "@/lib/imports/previewImport";
import { canWriteResource, roleFromHeaders } from "@/lib/permissions";

function isSupportedFile(fileName: string) {
  const lower = fileName.toLowerCase();
  return lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".csv");
}

export async function POST(request: Request) {
  const role = roleFromHeaders(request.headers);
  if (!canWriteResource(role, "applications")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "يجب رفع ملف Excel أو CSV أولًا." }, { status: 400 });
    if (!isSupportedFile(file.name)) return NextResponse.json({ error: "صيغة الملف غير مدعومة. استخدم Excel أو CSV." }, { status: 400 });

    const importType = String(form.get("importType") || form.get("fileType") || "").trim();
    if (!importType) return NextResponse.json({ error: "نوع الاستيراد مطلوب." }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const preview = await buildImportPreview({
      fileName: file.name,
      buffer,
      importType,
      templateId: String(form.get("templateId") || "") || null,
      applicationId: String(form.get("applicationId") || ""),
      applicationProjectId: String(form.get("applicationProjectId") || ""),
    });

    return NextResponse.json({ data: preview });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر إنشاء المعاينة.";
    const status = message.includes("قاعدة البيانات غير متصلة") ? 503 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

