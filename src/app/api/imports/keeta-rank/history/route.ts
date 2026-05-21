import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeAppKey } from "@/lib/applications/applicationAnalytics";
import { canReadResource, roleFromHeaders } from "@/lib/permissions";

function dbOffline(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: string }).code) : "";
  return code === "P1001" || code === "P1002" || message.includes("Can't reach database server");
}

export async function GET(request: Request) {
  const role = roleFromHeaders(request.headers);
  if (!canReadResource(role, "applications")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const applications = await prisma.application.findMany({ select: { id: true, code: true, name: true } });
    const keeta = applications.find((app) => normalizeAppKey(`${app.code} ${app.name}`) === "keeta");

    const data = await prisma.applicationImportBatch.findMany({
      where: { fileType: "KEETA_RANK", ...(keeta ? { OR: [{ applicationId: keeta.id }, { applicationId: null }] } : {}) },
      include: { applicationProject: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({ data, meta: { count: data.length, resource: "keeta-rank-history" } });
  } catch (error) {
    if (dbOffline(error)) return NextResponse.json({ error: "Database offline" }, { status: 503 });
    throw error;
  }
}
