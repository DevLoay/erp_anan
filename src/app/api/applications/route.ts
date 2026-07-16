import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canReadResource, canWriteResource, roleFromHeaders } from "@/lib/permissions";
import { getAccessScope } from "@/lib/auth/accessScope";

function normalizeStatus(value: unknown) {
  const raw = String(value ?? "ACTIVE").toUpperCase();
  return ["ACTIVE", "INACTIVE", "PENDING", "APPROVED", "REJECTED", "LOCKED"].includes(raw) ? raw : "ACTIVE";
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
    const scope = await getAccessScope(request.headers);
    const data = await prisma.application.findMany({
      where: scope.isGlobal
        ? {}
        : {
            projects: {
              some: {
                AND: [
                  scope.projectIds.length ? { id: { in: scope.projectIds } } : {},
                  scope.cityIds.length ? { cityId: { in: scope.cityIds } } : {},
                ],
              },
            },
          },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ data, meta: { count: data.length, resource: "applications" } });
  } catch (error) {
    if (dbOffline(error)) return NextResponse.json({ error: "Database offline" }, { status: 503 });
    if (schemaNotReady(error)) return NextResponse.json({ data: [], meta: { count: 0, resource: "applications", schemaReady: false } });
    throw error;
  }
}

export async function POST(request: Request) {
  const role = roleFromHeaders(request.headers);
  if (!canWriteResource(role, "applications")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json()) as Record<string, unknown>;
  const code = String(body.code ?? "").trim().toUpperCase();
  const name = String(body.name ?? "").trim();
  if (!code || !name) return NextResponse.json({ error: "code and name are required" }, { status: 400 });

  const data = await prisma.application.create({
    data: {
      code,
      name,
      description: body.description ? String(body.description) : null,
      status: normalizeStatus(body.status) as "ACTIVE",
    },
  });

  return NextResponse.json({ data }, { status: 201 });
}
