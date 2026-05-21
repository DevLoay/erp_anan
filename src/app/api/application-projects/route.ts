import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canReadResource, canWriteResource, roleFromHeaders } from "@/lib/permissions";

function normalizeStatus(value: unknown) {
  const raw = String(value ?? "ACTIVE").toUpperCase();
  return ["ACTIVE", "INACTIVE", "PENDING", "APPROVED", "REJECTED", "LOCKED"].includes(raw) ? raw : "ACTIVE";
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function schemaNotReady(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && ["P2021", "P2022"].includes(String((error as { code?: string }).code));
}

function dbOffline(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: string }).code) : "";
  return code === "P1001" || message.includes("Can't reach database server");
}

export async function GET(request: Request) {
  const role = roleFromHeaders(request.headers);
  if (!canReadResource(role, "applications")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const data = await prisma.applicationProject.findMany({
      include: { application: true, project: true, city: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ data, meta: { count: data.length, resource: "application-projects" } });
  } catch (error) {
    if (dbOffline(error)) return NextResponse.json({ error: "Database offline" }, { status: 503 });
    if (schemaNotReady(error)) return NextResponse.json({ data: [], meta: { count: 0, resource: "application-projects", schemaReady: false } });
    throw error;
  }
}

export async function POST(request: Request) {
  const role = roleFromHeaders(request.headers);
  if (!canWriteResource(role, "applications")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json()) as Record<string, unknown>;
  const applicationId = String(body.applicationId ?? "").trim();
  const code = String(body.code ?? "").trim().toUpperCase();
  const name = String(body.name ?? "").trim();
  if (!applicationId || !code || !name) return NextResponse.json({ error: "applicationId, code and name are required" }, { status: 400 });

  const data = await prisma.applicationProject.create({
    data: {
      applicationId,
      projectId: body.projectId ? String(body.projectId) : null,
      cityId: body.cityId ? String(body.cityId) : null,
      code,
      name,
      monthlyTarget: numberOrNull(body.monthlyTarget),
      dailyTarget: numberOrNull(body.dailyTarget),
      status: normalizeStatus(body.status) as "ACTIVE",
    },
  });

  return NextResponse.json({ data }, { status: 201 });
}

