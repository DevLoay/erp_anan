import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAccessScope } from "@/lib/auth/accessScope";
import { canReadResource, canWriteResource, roleFromHeaders } from "@/lib/permissions";
import { getInterviewsPageData, resolveInterviewFilters } from "@/lib/interviews/getInterviewsPageData";

const allowedStatuses = new Set(["ACTIVE", "INACTIVE", "PENDING", "APPROVED", "REJECTED", "LOCKED", "CANCELLED"]);

function text(value: unknown) {
  return String(value ?? "").trim();
}
function nullableText(value: unknown) {
  const parsed = text(value);
  return parsed || null;
}
function parseDate(value: unknown) {
  const raw = text(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}
function status(value: unknown) {
  const raw = text(value).toUpperCase();
  return allowedStatuses.has(raw) ? raw : null;
}
function jsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? null));
}
async function audit(request: Request, action: string, entityId: string, before: unknown, after: unknown) {
  await prisma.auditLog
    .create({
      data: {
        userId: request.headers.get("x-user-id") || undefined,
        user: request.headers.get("x-user-email") || undefined,
        action,
        entityType: "Interview",
        entityId,
        before: jsonValue(before),
        after: jsonValue(after),
        oldValue: jsonValue(before),
        newValue: jsonValue(after),
      },
    })
    .catch(() => null);
}
async function canUseCity(request: Request, cityId: string | null) {
  const scope = await getAccessScope(request.headers);
  if (!scope.isGlobal && cityId && scope.cityIds.length && !scope.cityIds.includes(cityId)) return false;
  return true;
}
async function hydrateRow(id: string, request: Request) {
  const data = await getInterviewsPageData(resolveInterviewFilters({}), request.headers);
  return data.rows.find((row) => row.id === id) || null;
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const role = roleFromHeaders(request.headers);
  if (!canReadResource(role, "interviews")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await context.params;
  const row = await hydrateRow(id, request);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canUseCity(request, row.cityId || null))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ data: row });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const role = roleFromHeaders(request.headers);
  if (!canWriteResource(role, "interviews")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await context.params;
  const before = await prisma.interview.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canUseCity(request, before.cityId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json()) as Record<string, unknown>;
  const update: Record<string, unknown> = {};
  if ("candidateName" in body) {
    const candidateName = text(body.candidateName);
    if (!candidateName) return NextResponse.json({ error: "اسم المرشح مطلوب." }, { status: 400 });
    update.candidateName = candidateName;
  }
  if ("phone" in body) update.phone = nullableText(body.phone);
  if ("cityId" in body) update.cityId = nullableText(body.cityId);
  if ("projectId" in body) update.projectId = nullableText(body.projectId);
  if ("status" in body) {
    const nextStatus = status(body.status);
    if (nextStatus) update.status = nextStatus;
  }
  if ("scheduledAt" in body) update.scheduledAt = parseDate(body.scheduledAt);
  if ("notes" in body) update.notes = nullableText(body.notes);

  const nextCityId = String(update.cityId ?? before.cityId ?? "") || null;
  if (!(await canUseCity(request, nextCityId))) return NextResponse.json({ error: "ليس لديك صلاحية على هذه المدينة." }, { status: 403 });
  if (nextCityId) {
    const city = await prisma.city.findUnique({ where: { id: nextCityId }, select: { id: true } });
    if (!city) return NextResponse.json({ error: "المدينة المحددة غير موجودة." }, { status: 400 });
  }
  const nextProjectId = String(update.projectId ?? before.projectId ?? "") || null;
  if (nextProjectId) {
    const project = await prisma.project.findUnique({ where: { id: nextProjectId }, select: { id: true } });
    if (!project) return NextResponse.json({ error: "المشروع المحدد غير موجود." }, { status: 400 });
  }

  const updated = await prisma.interview.update({ where: { id }, data: update as any });
  await audit(request, "INTERVIEW_UPDATED", id, before, updated);
  const row = await hydrateRow(id, request);
  return NextResponse.json({ data: row || updated });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const role = roleFromHeaders(request.headers);
  if (!canWriteResource(role, "interviews")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await context.params;
  const before = await prisma.interview.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canUseCity(request, before.cityId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await prisma.interview.delete({ where: { id } });
  await audit(request, "INTERVIEW_DELETED", id, before, null);
  return NextResponse.json({ data: { id, deleted: true } });
}
