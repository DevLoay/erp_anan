import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getImportTemplatesData,
  jsonInput,
  resolveImportTemplateFilters,
  statusValue,
} from "@/lib/imports/templates";
import { canReadResource, canWriteResource, roleFromHeaders } from "@/lib/permissions";

function nullableString(value: unknown) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function dbOffline(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: string }).code) : "";
  return code === "P1001" || code === "P1002" || message.includes("Can't reach database server");
}

export async function GET(request: Request) {
  const role = roleFromHeaders(request.headers);
  if (!canReadResource(role, "applications")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const filters = resolveImportTemplateFilters(Object.fromEntries(new URL(request.url).searchParams.entries()));
    const data = await getImportTemplatesData(filters);
    return NextResponse.json({ data: data.rows, meta: { count: data.rows.length, resource: "import-templates" }, summary: data.summary });
  } catch (error) {
    if (dbOffline(error)) return NextResponse.json({ error: "Database offline" }, { status: 503 });
    throw error;
  }
}

export async function POST(request: Request) {
  const role = roleFromHeaders(request.headers);
  if (!canWriteResource(role, "applications")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json()) as Record<string, unknown>;
  const name = String(body.name ?? "").trim();
  const fileType = String(body.fileType ?? "").trim();
  if (!name || !fileType) return NextResponse.json({ error: "name and fileType are required" }, { status: 400 });

  const payload: Prisma.ApplicationImportTemplateUncheckedCreateInput = {
      name,
      fileType,
      applicationId: nullableString(body.applicationId),
      applicationProjectId: nullableString(body.applicationProjectId),
      requiredColumns: jsonInput(body.requiredColumns),
      optionalColumns: jsonInput(body.optionalColumns),
      columnMapping: jsonInput(body.columnMapping),
      sampleFileUrl: nullableString(body.sampleFileUrl),
      status: statusValue(body.status),
  };

  const data = await prisma.applicationImportTemplate.create({ data: payload });

  return NextResponse.json({ data }, { status: 201 });
}
