import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canReadResource, canWriteResource, roleFromHeaders } from "@/lib/permissions";

function normalizeStatus(value: unknown) {
  const raw = String(value ?? "").toUpperCase();
  return ["ACTIVE", "INACTIVE", "PENDING", "APPROVED", "REJECTED", "LOCKED"].includes(raw) ? raw : undefined;
}

function normalizePayload(input: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  if (typeof input.code === "string" && input.code.trim()) data.code = input.code.trim().toUpperCase();
  if (typeof input.name === "string" && input.name.trim()) data.name = input.name.trim();
  if ("description" in input) data.description = input.description ? String(input.description) : null;
  const status = normalizeStatus(input.status);
  if (status) data.status = status;
  return data;
}

function schemaNotReady(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && ["P2021", "P2022"].includes(String((error as { code?: string }).code));
}

function dbOffline(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: string }).code) : "";
  return code === "P1001" || message.includes("Can't reach database server");
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const role = roleFromHeaders(request.headers);
  if (!canReadResource(role, "applications")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  try {
    const data = await prisma.application.findUnique({ where: { id } });
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data });
  } catch (error) {
    if (dbOffline(error)) return NextResponse.json({ error: "Database offline" }, { status: 503 });
    if (schemaNotReady(error)) return NextResponse.json({ error: "Applications schema is not ready" }, { status: 503 });
    throw error;
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const role = roleFromHeaders(request.headers);
  if (!canWriteResource(role, "applications")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const payload = normalizePayload((await request.json()) as Record<string, unknown>);
  try {
    const data = await prisma.application.update({ where: { id }, data: payload });
    return NextResponse.json({ data });
  } catch (error) {
    if (dbOffline(error)) return NextResponse.json({ error: "Database offline" }, { status: 503 });
    if (schemaNotReady(error)) return NextResponse.json({ error: "Applications schema is not ready" }, { status: 503 });
    throw error;
  }
}
