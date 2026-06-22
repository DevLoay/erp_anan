import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getAccessScope, type AccessScope } from "@/lib/auth/accessScope";
import { canReadResource, canWriteResource, roleFromHeaders } from "@/lib/permissions";
import { getSupervisorTasksData, resolveSupervisorTaskFilters } from "@/lib/supervisor-tasks/getSupervisorTasksData";
import { prisma } from "@/lib/prisma";

function jsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? null));
}

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

function priority(value: unknown) {
  const raw = text(value).toUpperCase();
  if (raw === "CRITICAL" || raw === "WARNING" || raw === "INFO") return raw;
  return "INFO";
}

export function taskStatus(value: unknown) {
  const raw = text(value).toUpperCase();
  if (raw === "IN_PROGRESS" || raw === "ACTIVE") return "ACTIVE";
  if (raw === "COMPLETED" || raw === "APPROVED") return "APPROVED";
  if (raw === "CANCELLED" || raw === "REJECTED" || raw === "INACTIVE") return "CANCELLED";
  if (raw === "LOCKED") return "LOCKED";
  return "PENDING";
}

function taskAllowed(task: { supervisorId: string | null; driverId: string | null; cityId: string | null }, scope: AccessScope) {
  if (scope.isGlobal) return true;
  if (scope.supervisorId && task.supervisorId === scope.supervisorId) return true;
  if (scope.driverId && task.driverId === scope.driverId) return true;
  if (task.cityId && scope.cityIds.includes(task.cityId)) return true;
  return false;
}

async function writeAudit(args: {
  request: Request;
  scope: AccessScope;
  action: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
}) {
  await prisma.auditLog
    .create({
      data: {
        userId: args.scope.userId || args.request.headers.get("x-user-id") || undefined,
        user: args.request.headers.get("x-user-email") || undefined,
        action: args.action,
        entityType: "Task",
        entityId: args.entityId,
        before: jsonValue(args.before),
        after: jsonValue(args.after),
        oldValue: jsonValue(args.before),
        newValue: jsonValue(args.after),
      },
    })
    .catch(() => null);
}

async function validateTaskScope(input: { cityId: string; supervisorId: string; driverId: string }, scope: AccessScope) {
  const [city, supervisor, driver] = await Promise.all([
    input.cityId ? prisma.city.findUnique({ where: { id: input.cityId }, select: { id: true } }) : null,
    input.supervisorId ? prisma.supervisor.findUnique({ where: { id: input.supervisorId }, select: { id: true, cityId: true, name: true } }) : null,
    input.driverId ? prisma.driver.findUnique({ where: { id: input.driverId }, select: { id: true, cityId: true, supervisorId: true, name: true, actualName: true } }) : null,
  ]);

  if (!city) return { error: "المدينة مطلوبة أو غير موجودة." };
  if (!supervisor) return { error: "المشرف مطلوب أو غير موجود." };
  if (!scope.isGlobal && input.cityId && scope.cityIds.length && !scope.cityIds.includes(input.cityId)) return { error: "ليس لديك صلاحية على هذه المدينة." };
  if (!scope.isGlobal && scope.supervisorId && scope.supervisorId !== input.supervisorId) return { error: "ليس لديك صلاحية على هذا المشرف." };
  if (supervisor.cityId && supervisor.cityId !== input.cityId) return { error: "المشرف المحدد غير تابع للمدينة المختارة." };
  if (driver) {
    if (driver.cityId && driver.cityId !== input.cityId) return { error: "المندوب المرتبط ليس تابعًا لنفس المدينة." };
    if (!scope.isGlobal && scope.supervisorId && driver.supervisorId && driver.supervisorId !== scope.supervisorId) return { error: "المندوب خارج نطاق المشرف الحالي." };
  }

  return { city, supervisor, driver };
}

export async function GET(request: Request) {
  const role = roleFromHeaders(request.headers);
  if (!canReadResource(role, "tasks")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams.entries());
  const filters = resolveSupervisorTaskFilters(params);
  const data = await getSupervisorTasksData(filters, request.headers);
  return NextResponse.json({ data: data.rows, meta: { summary: data.summary, access: data.access, count: data.rows.length } });
}

export async function POST(request: Request) {
  const role = roleFromHeaders(request.headers);
  const scope = await getAccessScope(request.headers);
  if (!canWriteResource(role, "tasks") || (role !== "ADMIN" && role !== "OPERATION_MANAGER")) {
    return NextResponse.json({ error: "إنشاء مهام للمشرفين متاح للمدير أو مدير التشغيل فقط." }, { status: 403 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const title = text(body.title);
  const description = text(body.description);
  const cityId = text(body.cityId);
  const supervisorId = text(body.supervisorId);
  const driverId = text(body.driverId);
  const dueDate = parseDate(body.dueDate);

  if (!title) return NextResponse.json({ error: "عنوان المهمة مطلوب." }, { status: 400 });
  if (!description) return NextResponse.json({ error: "تفاصيل المهمة مطلوبة." }, { status: 400 });
  if (!cityId) return NextResponse.json({ error: "المدينة مطلوبة." }, { status: 400 });
  if (!supervisorId) return NextResponse.json({ error: "المشرف مطلوب." }, { status: 400 });
  if (!dueDate) return NextResponse.json({ error: "تاريخ الاستحقاق مطلوب وصحيح." }, { status: 400 });

  const scopeResult = await validateTaskScope({ cityId, supervisorId, driverId }, scope);
  if ("error" in scopeResult) return NextResponse.json({ error: scopeResult.error }, { status: 400 });

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const task = await tx.task.create({
      data: {
        title,
        description,
        category: nullableText(body.category),
        cityId,
        supervisorId,
        driverId: driverId || null,
        priority: priority(body.priority),
        status: "PENDING",
        dueDate,
        notes: nullableText(body.notes),
      },
    });

    const notification = await tx.notification.create({
      data: {
        title: "مهمة جديدة",
        body: `${title} - الاستحقاق ${dueDate.toISOString().slice(0, 10)}`,
        severity: task.priority,
        status: "PENDING",
        driverId: task.driverId,
        supervisorId: task.supervisorId,
        entityType: "Task",
        entityId: task.id,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: scope.userId || request.headers.get("x-user-id") || undefined,
        user: request.headers.get("x-user-email") || undefined,
        action: "TASK_CREATED_AND_ASSIGNED",
        entityType: "Task",
        entityId: task.id,
        after: jsonValue({ task, notificationId: notification.id }),
        newValue: jsonValue({ task, notificationId: notification.id }),
      },
    });

    return { task, notification };
  });

  return NextResponse.json({ data: result }, { status: 201 });
}
