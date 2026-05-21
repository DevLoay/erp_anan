import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonInput, statusValue } from "@/lib/imports/templates";
import { canReadResource, canWriteResource, roleFromHeaders } from "@/lib/permissions";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function nullableString(value: unknown) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function dbOffline(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: string }).code) : "";
  return code === "P1001" || code === "P1002" || message.includes("Can't reach database server");
}

export async function GET(request: Request, context: RouteContext) {
  const role = roleFromHeaders(request.headers);
  if (!canReadResource(role, "applications")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const params = await context.params;
  const id = decodeURIComponent(params.id);

  if (id.startsWith("builtin:")) {
    return NextResponse.json({ error: "Built-in templates are available through the templates list and download endpoint." }, { status: 404 });
  }

  try {
    const data = await prisma.applicationImportTemplate.findUnique({
      where: { id },
      include: {
        application: { select: { id: true, code: true, name: true } },
        applicationProject: { select: { id: true, code: true, name: true } },
      },
    });
    if (!data) return NextResponse.json({ error: "Template not found" }, { status: 404 });
    return NextResponse.json({ data });
  } catch (error) {
    if (dbOffline(error)) return NextResponse.json({ error: "Database offline" }, { status: 503 });
    throw error;
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const role = roleFromHeaders(request.headers);
  if (!canWriteResource(role, "applications")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const params = await context.params;
  const id = decodeURIComponent(params.id);
  if (id.startsWith("builtin:")) return NextResponse.json({ error: "Built-in template cannot be edited. Copy it first." }, { status: 400 });

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const data: Prisma.ApplicationImportTemplateUncheckedUpdateInput = {
      ...(body.name !== undefined ? { name: String(body.name).trim() } : {}),
      ...(body.fileType !== undefined ? { fileType: String(body.fileType).trim() } : {}),
      ...(body.applicationId !== undefined ? { applicationId: nullableString(body.applicationId) } : {}),
      ...(body.applicationProjectId !== undefined ? { applicationProjectId: nullableString(body.applicationProjectId) } : {}),
      ...(body.requiredColumns !== undefined ? { requiredColumns: jsonInput(body.requiredColumns) } : {}),
      ...(body.optionalColumns !== undefined ? { optionalColumns: jsonInput(body.optionalColumns) } : {}),
      ...(body.columnMapping !== undefined ? { columnMapping: jsonInput(body.columnMapping) } : {}),
      ...(body.sampleFileUrl !== undefined ? { sampleFileUrl: nullableString(body.sampleFileUrl) } : {}),
      ...(body.status !== undefined ? { status: statusValue(body.status) } : {}),
    };
    const updated = await prisma.applicationImportTemplate.update({ where: { id }, data });
    return NextResponse.json({ data: updated });
  } catch (error) {
    if (dbOffline(error)) return NextResponse.json({ error: "Database offline" }, { status: 503 });
    throw error;
  }
}
