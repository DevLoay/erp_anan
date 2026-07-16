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
  return allowedStatuses.has(raw) ? raw : "PENDING";
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

async function validateScope(request: Request, cityId: string | null) {
  const scope = await getAccessScope(request.headers);
  if (!scope.isGlobal && cityId && scope.cityIds.length && !scope.cityIds.includes(cityId)) {
    return "ليس لديك صلاحية على هذه المدينة.";
  }
  return "";
}

async function hydrateRow(id: string, request: Request) {
  const data = await getInterviewsPageData(resolveInterviewFilters({}), request.headers);
  return data.rows.find((row) => row.id === id) || null;
}

export async function GET(request: Request) {
  const role = roleFromHeaders(request.headers);
  if (!canReadResource(role, "interviews")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const url = new URL(request.url);
  const filters = resolveInterviewFilters(Object.fromEntries(url.searchParams.entries()));
  const data = await getInterviewsPageData(filters, request.headers);
  return NextResponse.json({ data: data.rows, meta: { summary: data.summary, count: data.rows.length } });
}

export async function POST(request: Request) {
  const role = roleFromHeaders(request.headers);
  if (!canWriteResource(role, "interviews")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json()) as Record<string, unknown>;
  const candidateName = text(body.candidateName);
  const cityId = nullableText(body.cityId);
  const projectId = nullableText(body.projectId);
  if (!candidateName) return NextResponse.json({ error: "اسم المرشح مطلوب." }, { status: 400 });

  const scopeError = await validateScope(request, cityId);
  if (scopeError) return NextResponse.json({ error: scopeError }, { status: 403 });

  if (cityId) {
    const city = await prisma.city.findUnique({ where: { id: cityId }, select: { id: true } });
    if (!city) return NextResponse.json({ error: "المدينة المحددة غير موجودة." }, { status: 400 });
  }
  if (projectId) {
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!project) return NextResponse.json({ error: "المشروع المحدد غير موجود." }, { status: 400 });
  }

  const created = await prisma.interview.create({
    data: {
      candidateName,
      phone: nullableText(body.phone),
      cityId,
      projectId,
      status: status(body.status) as any,
      scheduledAt: parseDate(body.scheduledAt),
      notes: nullableText(body.notes),
    },
  });
  await audit(request, "INTERVIEW_CREATED", created.id, null, created);
  const row = await hydrateRow(created.id, request);
  return NextResponse.json({ data: row || created }, { status: 201 });
}
