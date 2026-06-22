import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getAccessScope, type AccessScope } from "@/lib/auth/accessScope";
import { canReadResource, canWriteResource, roleFromHeaders } from "@/lib/permissions";
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
  return null;
}

function taskStatus(value: unknown) {
  const raw = text(value).toUpperCase();
  if (raw === "IN_PROGRESS" || raw === "ACTIVE") return "ACTIVE";
  if (raw === "COMPLETED" || raw === "APPROVED") return "APPROVED";
  if (raw === "CANCELLED" || raw === "REJECTED" || raw === "INACTIVE") return "CANCELLED";
  if (raw === "LOCKED") return "LOCKED";
  if (raw === "PENDING") return "PENDING";
  return null;
}

function notificationStatus(taskStatusValue: string) {
  if (taskStatusValue === "APPROVED" || taskStatusValue === "LOCKED") return "APPROVED";
  if (taskStatusValue === "CANCELLED" || taskStatusValue === "REJECTED" || taskStatusValue === "INACTIVE") return "CANCELLED";
  if (taskStatusValue === "ACTIVE") return "ACTIVE";
  return "PENDING";
}

function taskAllowed(task: { supervisorId: string | null; driverId: string | null; cityId: string | null }, scope: AccessScope) {
  if (scope.isGlobal) return true;
  if (scope.supervisorId && task.supervisorId === scope.supervisorId) return true;
  if (scope.driverId && task.driverId === scope.driverId) return true;
  if (task.cityId && scope.cityIds.includes(task.cityId)) return true;
  return false;
}

async function audit(args: { request: Request; scope: AccessScope; action: string; entityId: string; before?: unknown; after?: unknown }) {
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

async function validateRelations(data: { cityId?: string | null; supervisorId?: string | null; driverId?: string | null }, scope: AccessScope) {
  const cityId = data.cityId || "";
  const supervisorId = data.supervisorId || "";
  const driverId = data.driverId || "";
  const [city, supervisor, driver] = await Promise.all([
    cityId ? prisma.city.findUnique({ where: { id: cityId }, select: { id: true } }) : null,
    supervisorId ? prisma.supervisor.findUnique({ where: { id: supervisorId }, select: { id: true, cityId: true } }) : null,
    driverId ? prisma.driver.findUnique({ where: { id: driverId }, select: { id: true, cityId: true, supervisorId: true } }) : null,
  ]);

  if (cityId && !city) return "المدينة المحددة غير موجودة.";
  if (supervisorId && !supervisor) return "المشرف المحدد غير موجود.";
  if (driverId && !driver) return "المندوب المحدد غير موجود.";
  if (!scope.isGlobal && cityId && scope.cityIds.length && !scope.cityIds.includes(cityId)) return "ليس لديك صلاحية على هذه المدينة.";
  if (!scope.isGlobal && supervisorId && scope.supervisorId && scope.supervisorId !== supervisorId) return "ليس لديك صلاحية على هذا المشرف.";
  if (cityId && supervisor?.cityId && supervisor.cityId !== cityId) return "المشرف المحدد غير تابع للمدينة المختارة.";
  if (cityId && driver?.cityId && driver.cityId !== cityId) return "المندوب المرتبط ليس تابعًا لنفس المدينة.";
  return "";
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const role = roleFromHeaders(request.headers);
  if (!canReadResource(role, "tasks")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const scope = await getAccessScope(request.headers);
  const { id } = await context.params;
  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      city: { select: { nameAr: true, nameEn: true } },
      supervisor: { select: { name: true } },
      driver: { select: { internalCode: true, name: true, actualName: true } },
    },
  });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!taskAllowed(task, scope)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ data: task });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const role = roleFromHeaders(request.headers);
  if (!canWriteResource(role, "tasks")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const scope = await getAccessScope(request.headers);
  const { id } = await context.params;
  const before = await prisma.task.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!taskAllowed(before, scope)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json()) as Record<string, unknown>;
  const update: Prisma.TaskUncheckedUpdateInput = {};

  if (role === "SUPERVISOR") {
    if (scope.supervisorId !== before.supervisorId) return NextResponse.json({ error: "المشرف يرى مهامه فقط." }, { status: 403 });
    if ("status" in body) {
      const nextStatus = taskStatus(body.status);
      if (nextStatus && ["ACTIVE", "APPROVED", "PENDING"].includes(nextStatus)) update.status = nextStatus as Prisma.TaskUncheckedUpdateInput["status"];
    }
    if ("notes" in body) update.notes = nullableText(body.notes);
  } else {
    if ("title" in body) update.title = text(body.title);
    if ("description" in body) update.description = nullableText(body.description);
    if ("category" in body) update.category = nullableText(body.category);
    if ("cityId" in body) update.cityId = nullableText(body.cityId);
    if ("supervisorId" in body) update.supervisorId = nullableText(body.supervisorId);
    if ("driverId" in body) update.driverId = nullableText(body.driverId);
    if ("priority" in body) {
      const nextPriority = priority(body.priority);
      if (nextPriority) update.priority = nextPriority as Prisma.TaskUncheckedUpdateInput["priority"];
    }
    if ("status" in body) {
      const nextStatus = taskStatus(body.status);
      if (nextStatus) update.status = nextStatus as Prisma.TaskUncheckedUpdateInput["status"];
    }
    if ("dueDate" in body) update.dueDate = parseDate(body.dueDate);
    if ("notes" in body) update.notes = nullableText(body.notes);
  }

  const nextCityId = String(update.cityId ?? before.cityId ?? "");
  const nextSupervisorId = String(update.supervisorId ?? before.supervisorId ?? "");
  const nextDriverId = String(update.driverId ?? before.driverId ?? "");
  const relationError = await validateRelations({ cityId: nextCityId, supervisorId: nextSupervisorId, driverId: nextDriverId }, scope);
  if (relationError) return NextResponse.json({ error: relationError }, { status: 400 });

  const reassigned = "supervisorId" in update && update.supervisorId && update.supervisorId !== before.supervisorId;
  const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const task = await tx.task.update({ where: { id }, data: update });
    if ("status" in update) {
      await tx.notification.updateMany({
        where: { entityType: "Task", entityId: id },
        data: { status: notificationStatus(String(task.status)) as Prisma.NotificationUncheckedUpdateManyInput["status"] },
      });
    }
    if (reassigned) {
      await tx.notification.create({
        data: {
          title: "مهمة معاد إسنادها",
          body: `${task.title} - الاستحقاق ${task.dueDate?.toISOString().slice(0, 10) || "-"}`,
          severity: task.priority,
          status: "PENDING",
          driverId: task.driverId,
          supervisorId: task.supervisorId,
          entityType: "Task",
          entityId: task.id,
        },
      });
    }
    return task;
  });

  await audit({
    request,
    scope,
    action: updated.status !== before.status ? "TASK_STATUS_CHANGED" : reassigned ? "TASK_REASSIGNED" : "TASK_UPDATED",
    entityId: id,
    before,
    after: updated,
  });

  return NextResponse.json({ data: updated });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const role = roleFromHeaders(request.headers);
  if (role !== "ADMIN" && role !== "OPERATION_MANAGER") return NextResponse.json({ error: "إلغاء المهمة يحتاج صلاحية مدير أو مدير تشغيل." }, { status: 403 });
  const scope = await getAccessScope(request.headers);
  const { id } = await context.params;
  const before = await prisma.task.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!taskAllowed(before, scope)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const task = await tx.task.update({ where: { id }, data: { status: "CANCELLED" } });
    await tx.notification.updateMany({ where: { entityType: "Task", entityId: id }, data: { status: "CANCELLED" } });
    return task;
  });
  await audit({ request, scope, action: "TASK_CANCELLED", entityId: id, before, after: updated });
  return NextResponse.json({ data: updated });
}
