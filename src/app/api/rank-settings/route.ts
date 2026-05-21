import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canReadResource, canWriteResource, roleFromHeaders } from "@/lib/permissions";

type StatusValue = "ACTIVE" | "INACTIVE" | "PENDING" | "APPROVED" | "REJECTED" | "LOCKED";

function normalizeStatus(value: unknown): StatusValue {
  const raw = String(value ?? "ACTIVE").toUpperCase();
  return ["ACTIVE", "INACTIVE", "PENDING", "APPROVED", "REJECTED", "LOCKED"].includes(raw) ? (raw as StatusValue) : "ACTIVE";
}

function nullableString(value: unknown) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function nullableInt(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : null;
}

function jsonValue(value: unknown) {
  if (value === undefined || value === "") return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

function dbOffline(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: string }).code) : "";
  return code === "P1001" || code === "P1002" || message.includes("Can't reach database server");
}

export async function GET(request: Request) {
  const role = roleFromHeaders(request.headers);
  if (!canReadResource(role, "applications")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(request.url);
  const applicationId = url.searchParams.get("applicationId") ?? undefined;
  const applicationProjectId = url.searchParams.get("applicationProjectId") ?? undefined;

  try {
    const data = await prisma.applicationRankSetting.findMany({
      where: {
        ...(applicationId ? { applicationId } : {}),
        ...(applicationProjectId ? { applicationProjectId } : {}),
      },
      include: {
        application: { select: { id: true, code: true, name: true } },
        applicationProject: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
    });
    return NextResponse.json({ data, meta: { count: data.length, resource: "rank-settings" } });
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
  const applicationId = String(body.applicationId ?? "").trim();
  if (!name || !applicationId) return NextResponse.json({ error: "name and applicationId are required" }, { status: 400 });

  const application = await prisma.application.findUnique({ where: { id: applicationId }, select: { id: true } });
  if (!application) return NextResponse.json({ error: "Application not found" }, { status: 404 });

  const applicationProjectId = nullableString(body.applicationProjectId);
  if (applicationProjectId) {
    const project = await prisma.applicationProject.findFirst({ where: { id: applicationProjectId, applicationId }, select: { id: true } });
    if (!project) return NextResponse.json({ error: "Application project not found" }, { status: 404 });
  }

  const payload: Prisma.ApplicationRankSettingUncheckedCreateInput = {
      name,
      applicationId,
      applicationProjectId,
      rankType: nullableString(body.rankType),
      minimumOrders: nullableInt(body.minimumOrders),
      onTimeRule: jsonValue(body.onTimeRule),
      cancellationRule: jsonValue(body.cancellationRule),
      rejectionRule: jsonValue(body.rejectionRule),
      workingHoursRule: jsonValue(body.workingHoursRule),
      bonusRule: jsonValue(body.bonusRule),
      deductionRule: jsonValue(body.deductionRule),
      levelOutput: jsonValue(body.levelOutput),
      status: normalizeStatus(body.status),
  };

  const data = await prisma.applicationRankSetting.create({ data: payload });

  return NextResponse.json({ data }, { status: 201 });
}
