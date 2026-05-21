import { NextResponse } from "next/server";
import { commitKeetaRankImport } from "@/lib/imports/keetaRankCommit";
import type { KeetaRankMatchedRow } from "@/lib/imports/matchDrivers";
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
    const body = (await request.json()) as {
      fileName?: string;
      applicationId?: string;
      applicationProjectId?: string;
      rankSettingId?: string;
      rows?: KeetaRankMatchedRow[];
    };

    if (!body.fileName) return NextResponse.json({ error: "File name is required" }, { status: 400 });
    if (!Array.isArray(body.rows) || !body.rows.length) return NextResponse.json({ error: "Preview rows are required before commit" }, { status: 400 });

    const data = await commitKeetaRankImport({
      fileName: body.fileName,
      applicationId: body.applicationId || null,
      applicationProjectId: body.applicationProjectId || null,
      rankSettingId: body.rankSettingId || null,
      rows: body.rows,
    });

    return NextResponse.json({
      data: {
        id: data.id,
        totalRows: data.totalRows,
        validRows: data.validRows,
        invalidRows: data.invalidRows,
        missingDrivers: data.missingDrivers,
        unlinkedAccounts: data.unlinkedAccounts,
        duplicateRows: data.duplicateRows,
      },
    }, { status: 201 });
  } catch (error) {
    if (dbOffline(error)) return NextResponse.json({ error: "Database offline" }, { status: 503 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر اعتماد استيراد Keeta Rank" }, { status: 400 });
  }
}
