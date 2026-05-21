import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canReadResource, canWriteResource, roleFromHeaders } from "@/lib/permissions";

type StatusValue = "ACTIVE" | "INACTIVE" | "PENDING" | "APPROVED" | "REJECTED" | "LOCKED";

function normalizeStatus(value: unknown): StatusValue | undefined {
  if (value === undefined) return undefined;
  const raw = String(value ?? "").toUpperCase();
  return ["ACTIVE", "INACTIVE", "PENDING", "APPROVED", "REJECTED", "LOCKED"].includes(raw) ? (raw as StatusValue) : undefined;
}

function nullableString(value: unknown) {
  if (value === undefined) return undefined;
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function jsonValue(value: unknown) {
  if (value === undefined) return undefined;
  if (value === "" || value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

function dbOffline(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: string }).code) : "";
  return code === "P1001" || code === "P1002" || message.includes("Can't reach database server");
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const role = roleFromHeaders(request.headers);
  if (!canReadResource(role, "applications")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  try {
    const data = await prisma.applicationInvoiceSetting.findUnique({
      where: { id },
      include: {
        application: { select: { id: true, code: true, name: true } },
        applicationProject: { select: { id: true, code: true, name: true } },
      },
    });
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data });
  } catch (error) {
    if (dbOffline(error)) return NextResponse.json({ error: "Database offline" }, { status: 503 });
    throw error;
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const role = roleFromHeaders(request.headers);
  if (!canWriteResource(role, "applications")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const body = (await request.json()) as Record<string, unknown>;
  const status = normalizeStatus(body.status);
  const payload: Prisma.ApplicationInvoiceSettingUncheckedUpdateInput = {};
  if (typeof body.name === "string" && body.name.trim()) payload.name = body.name.trim();
  if (body.applicationId) payload.applicationId = String(body.applicationId);
  if (body.applicationProjectId !== undefined) payload.applicationProjectId = nullableString(body.applicationProjectId);
  if (body.invoiceType !== undefined) payload.invoiceType = nullableString(body.invoiceType);
  if (body.requiredColumns !== undefined) payload.requiredColumns = jsonValue(body.requiredColumns);
  if (body.optionalColumns !== undefined) payload.optionalColumns = jsonValue(body.optionalColumns);
  if (body.columnMapping !== undefined) payload.columnMapping = jsonValue(body.columnMapping);
  if (body.calculationRules !== undefined) payload.calculationRules = jsonValue(body.calculationRules);
  if (body.deductionRules !== undefined) payload.deductionRules = jsonValue(body.deductionRules);
  if (body.bonusRules !== undefined) payload.bonusRules = jsonValue(body.bonusRules);
  if (status) payload.status = status;

  try {
    const data = await prisma.applicationInvoiceSetting.update({ where: { id }, data: payload });
    return NextResponse.json({ data });
  } catch (error) {
    if (dbOffline(error)) return NextResponse.json({ error: "Database offline" }, { status: 503 });
    throw error;
  }
}
