import { NextResponse } from "next/server";
import { canWriteResource, roleFromHeaders } from "@/lib/permissions";
import { commitImportPreview } from "@/lib/imports/commitImport";
import { databaseOfflineMessage } from "@/lib/imports/templates";
import { importTypeRequiresProject } from "@/lib/imports/importScopes";
import type { ImportPreviewPayload } from "@/lib/imports/previewImport";

type CommitBody = {
  preview?: ImportPreviewPayload;
  userId?: string | null;
};

export async function POST(request: Request) {
  const role = roleFromHeaders(request.headers);

  if (!canWriteResource(role, "applications")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as CommitBody;
    if (!body.preview?.summary || !Array.isArray(body.preview.rows)) {
      return NextResponse.json({ error: "بيانات المعاينة غير مكتملة. ارفع الملف مرة أخرى ثم اضغط اعتماد الحفظ." }, { status: 400 });
    }

    if (body.preview.summary.importType === "hungerstation_invoice" && !body.preview.summary.month) {
      return NextResponse.json({ error: "لا يمكن اعتماد فاتورة HungerStation بدون شهر واضح." }, { status: 400 });
    }

    if (importTypeRequiresProject(body.preview.summary.importType) && body.preview.summary.importType !== "hungerstation_invoice" && (!body.preview.summary.applicationId || !body.preview.summary.applicationProjectId)) {
      return NextResponse.json({ error: "لا يمكن اعتماد تقرير أو فاتورة مشروع بدون projectId واضح." }, { status: 400 });
    }

    if (importTypeRequiresProject(body.preview.summary.importType) && body.preview.summary.importType !== "hungerstation_invoice" && !body.preview.summary.cityId) {
      return NextResponse.json({ error: "لا يمكن اعتماد ملف مشروع بدون cityId واضح. افتح الرفع من داخل مشروع المدينة الصحيح." }, { status: 400 });
    }

    const data = await commitImportPreview(body.preview, body.userId ?? null);
    return NextResponse.json({ data });
  } catch (error) {
    const offline = databaseOfflineMessage(error);
    if (offline) return NextResponse.json({ error: offline }, { status: 503 });
    const message = error instanceof Error ? error.message : "تعذر حفظ عملية الاستيراد.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
