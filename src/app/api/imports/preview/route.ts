import { NextResponse } from "next/server";
import { buildImportPreview } from "@/lib/imports/previewImport";
import { importTypeRequiresProject } from "@/lib/imports/importScopes";
import { canWriteResource, roleFromHeaders } from "@/lib/permissions";

function isSupportedFile(fileName: string) {
  const lower = fileName.toLowerCase();
  return lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".csv");
}

const MAX_IMPORT_FILE_SIZE = 25 * 1024 * 1024;

export async function POST(request: Request) {
  const role = roleFromHeaders(request.headers);
  if (!canWriteResource(role, "applications")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (file instanceof File && (file.size <= 0 || file.size > MAX_IMPORT_FILE_SIZE)) {
      return NextResponse.json({ error: "حجم الملف غير صالح. الحد الأقصى 25 ميجابايت." }, { status: 413 });
    }
    if (!(file instanceof File)) return NextResponse.json({ error: "يجب رفع ملف Excel أو CSV أولًا." }, { status: 400 });
    if (!isSupportedFile(file.name)) return NextResponse.json({ error: "صيغة الملف غير مدعومة. استخدم Excel أو CSV." }, { status: 400 });

    const importType = String(form.get("importType") || form.get("fileType") || "").trim();
    if (!importType) return NextResponse.json({ error: "نوع الاستيراد مطلوب." }, { status: 400 });

    const applicationId = String(form.get("applicationId") || "").trim();
    const applicationProjectId = String(form.get("applicationProjectId") || "").trim();
    const projectId = String(form.get("projectId") || "").trim();
    const month = String(form.get("month") || "").trim();
    const reportDate = String(form.get("reportDate") || "").trim();

    if (importType === "hungerstation_invoice" && !month) {
      return NextResponse.json({ error: "شهر الفاتورة مطلوب لفاتورة HungerStation الشهرية." }, { status: 400 });
    }

    if (importType === "hungerstation_invoice" && !applicationId && !applicationProjectId) {
      return NextResponse.json({ error: "يجب تحديد تطبيق HungerStation أو مشروع مدينة قبل رفع الفاتورة." }, { status: 400 });
    }
    if (importTypeRequiresProject(importType) && importType !== "hungerstation_invoice" && (!applicationId || !applicationProjectId)) {
      return NextResponse.json({ error: "لا يمكن رفع تقرير أو فاتورة مشروع بدون تحديد مشروع واضح." }, { status: 400 });
    }

    const cityId = String(form.get("cityId") || "").trim();
    if (importTypeRequiresProject(importType) && importType !== "hungerstation_invoice" && !cityId) {
      return NextResponse.json({ error: "لا يمكن رفع ملف مشروع بدون تحديد المدينة. افتح الاستيراد من داخل مشروع المدينة الصحيح." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const preview = await buildImportPreview({
      fileName: file.name,
      buffer,
      importType,
      templateId: String(form.get("templateId") || "") || null,
      applicationId,
      applicationProjectId,
      projectId,
      cityId,
      month,
      reportDate,
    });

    return NextResponse.json({ data: preview });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر إنشاء المعاينة.";
    const status = message.includes("قاعدة البيانات غير متصلة") ? 503 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
