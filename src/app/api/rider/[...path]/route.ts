import { NextResponse } from "next/server";
import { Prisma, RecordStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRiderSession, auditRiderAction } from "@/lib/rider-app/riderAuth";
import {
  getRiderAdvances,
  getRiderAttendance,
  getRiderDashboardData,
  getRiderDocuments,
  getRiderNotifications,
  getRiderPageData,
  getRiderPayroll,
  getRiderProfile,
  getRiderTasks,
  getRiderVehicle,
  getRiderViolations,
  riderSections,
  type RiderSection,
} from "@/lib/rider-app/riderData";

type RouteContext = { params: Promise<{ path?: string[] }> };

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function normalizeStatus(value: unknown) {
  const status = String(value || "").toUpperCase();
  return Object.values(RecordStatus).includes(status as RecordStatus) ? (status as RecordStatus) : null;
}

function startOfDay(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function nextDay(value: string) {
  const date = startOfDay(value);
  date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function hoursBetween(start?: Date | null, end?: Date | null) {
  if (!start || !end) return 0;
  return Math.max(0, Math.round(((end.getTime() - start.getTime()) / 36e5) * 100) / 100);
}

async function contextOr401(headers: Headers) {
  const context = await getRiderSession(headers);
  return context;
}

export async function GET(request: Request, routeContext: RouteContext) {
  const context = await contextOr401(request.headers);
  if (!context) return jsonError("Unauthorized", 401);
  const path = (await routeContext.params).path || [];
  const resource = path[0] || "dashboard";
  const url = new URL(request.url);
  const month = url.searchParams.get("month");

  if (resource === "me" || resource === "profile") return NextResponse.json({ data: await getRiderProfile(context) });
  if (resource === "dashboard") return NextResponse.json({ data: await getRiderDashboardData(context, month) });
  if (resource === "notifications") return NextResponse.json({ data: await getRiderNotifications(context) });
  if (resource === "violations") return NextResponse.json({ data: await getRiderViolations(context) });
  if (resource === "payroll") return NextResponse.json({ data: await getRiderPayroll(context, month) });
  if (resource === "advances") return NextResponse.json({ data: await getRiderAdvances(context) });
  if (resource === "attendance") return NextResponse.json({ data: await getRiderAttendance(context, month) });
  if (resource === "vehicle") return NextResponse.json({ data: await getRiderVehicle(context) });
  if (resource === "documents") return NextResponse.json({ data: await getRiderDocuments(context) });
  if (resource === "tasks") return NextResponse.json({ data: await getRiderTasks(context) });
  if (riderSections.includes(resource as RiderSection)) {
    return NextResponse.json({ data: await getRiderPageData(context, resource as RiderSection, month) });
  }

  return jsonError("Not found", 404);
}

export async function PATCH(request: Request, routeContext: RouteContext) {
  const context = await contextOr401(request.headers);
  if (!context) return jsonError("Unauthorized", 401);
  const path = (await routeContext.params).path || [];
  const [resource, id, action] = path;

  if (resource === "notifications" && id === "read-all") {
    const result = await prisma.notification.updateMany({
      where: { driverId: context.driver?.id, status: RecordStatus.PENDING },
      data: { status: RecordStatus.APPROVED },
    });
    await auditRiderAction(context.driver?.id || "", "RIDER_MARK_ALL_NOTIFICATIONS_READ", "Notification", null, result);
    return NextResponse.json({ data: result });
  }

  if (resource === "notifications" && id && action === "read") {
    const notification = await prisma.notification.findFirst({ where: { id, driverId: context.driver?.id } });
    if (!notification) return jsonError("Notification not found", 404);
    const updated = await prisma.notification.update({ where: { id }, data: { status: RecordStatus.APPROVED } });
    await auditRiderAction(context.driver?.id || "", "RIDER_MARK_NOTIFICATION_READ", "Notification", id, { status: updated.status });
    return NextResponse.json({ data: updated });
  }

  if (resource === "tasks" && id) {
    const body = (await request.json().catch(() => ({}))) as { status?: string; notes?: string };
    const status = normalizeStatus(body.status);
    const allowedTaskStatuses: RecordStatus[] = [RecordStatus.PENDING, RecordStatus.ACTIVE, RecordStatus.APPROVED];
    if (!status || !allowedTaskStatuses.includes(status)) {
      return jsonError("حالة المهمة غير صحيحة.");
    }
    const task = await prisma.task.findFirst({ where: { id, driverId: context.driver?.id } });
    if (!task) return jsonError("Task not found", 404);
    const updated = await prisma.task.update({ where: { id }, data: { status, notes: body.notes || task.notes } });
    await auditRiderAction(context.driver?.id || "", "RIDER_UPDATE_TASK_STATUS", "Task", id, { status, notes: body.notes });
    return NextResponse.json({ data: updated });
  }

  return jsonError("Not found", 404);
}

export async function POST(request: Request, routeContext: RouteContext) {
  const context = await contextOr401(request.headers);
  if (!context) return jsonError("Unauthorized", 401);
  const path = (await routeContext.params).path || [];
  const [resource, action] = path;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const driverId = context.driver?.id || "";

  if (resource === "advances" && action === "request") {
    const amount = new Prisma.Decimal(String(body.amount || 0));
    if (amount.lte(0)) return jsonError("قيمة السلفة مطلوبة.");
    const advance = await prisma.advance.create({
      data: {
        driverId,
        cityId: context.driver?.cityId || null,
        supervisorId: context.driver?.supervisorId || null,
        amount,
        remainingAmount: amount,
        reason: String(body.reason || "طلب سلفة من تطبيق المندوب"),
        deductionMonth: String(body.deductionMonth || "") || null,
        status: RecordStatus.PENDING,
      },
    });
    await prisma.notification.create({
      data: {
        title: "تم استلام طلب السلفة",
        body: "طلبك قيد المراجعة من الإدارة.",
        status: RecordStatus.PENDING,
        severity: "INFO",
        driverId,
        entityType: "Advance",
        entityId: advance.id,
      },
    }).catch(() => null);
    await auditRiderAction(driverId, "RIDER_REQUEST_ADVANCE", "Advance", advance.id, { amount: amount.toNumber() });
    return NextResponse.json({ data: advance }, { status: 201 });
  }

  if (resource === "attendance" && (action === "check-in" || action === "check-out")) {
    const workDate = String(body.workDate || today()).slice(0, 10);
    const capturedAt = body.capturedAt ? new Date(String(body.capturedAt)) : new Date();
    if (!Number.isFinite(capturedAt.getTime())) return jsonError("وقت التسجيل غير صحيح.");
    const existing = await prisma.attendanceRecord.findFirst({
      where: { driverId, personType: "driver", workDate: { gte: startOfDay(workDate), lt: nextDay(workDate) } },
      orderBy: { updatedAt: "desc" },
    });
    const photoDataUrl = String(body.photoDataUrl || "").trim();
    const data = {
      personType: "driver",
      driverId,
      workDate: startOfDay(workDate),
      checkIn: action === "check-in" ? capturedAt : existing?.checkIn ?? null,
      checkOut: action === "check-out" ? capturedAt : existing?.checkOut ?? null,
      checkInPhoto: action === "check-in" && photoDataUrl ? photoDataUrl : existing?.checkInPhoto ?? null,
      checkOutPhoto: action === "check-out" && photoDataUrl ? photoDataUrl : existing?.checkOutPhoto ?? null,
      status: RecordStatus.ACTIVE,
      notes: action === "check-in" ? "تسجيل حضور من تطبيق المندوب" : "تسجيل انصراف من تطبيق المندوب",
    };
    const saved = existing
      ? await prisma.attendanceRecord.update({ where: { id: existing.id }, data: { ...data, workingHours: hoursBetween(data.checkIn, data.checkOut) } })
      : await prisma.attendanceRecord.create({ data: { ...data, workingHours: hoursBetween(data.checkIn, data.checkOut) } });
    await auditRiderAction(driverId, action === "check-in" ? "RIDER_CHECK_IN" : "RIDER_CHECK_OUT", "AttendanceRecord", saved.id, { workDate, hasPhoto: Boolean(photoDataUrl) });
    return NextResponse.json({ data: saved });
  }

  if (resource === "vehicle" && action === "issues") {
    const title = String(body.title || "بلاغ سيارة من تطبيق المندوب").trim();
    const description = String(body.description || "").trim();
    const task = await prisma.task.create({
      data: {
        title,
        description,
        category: "VEHICLE_ISSUE",
        cityId: context.driver?.cityId || null,
        supervisorId: context.driver?.supervisorId || null,
        driverId,
        priority: "WARNING",
        status: RecordStatus.PENDING,
      },
    });
    await auditRiderAction(driverId, "RIDER_CREATE_VEHICLE_ISSUE", "Task", task.id, { title });
    return NextResponse.json({ data: task }, { status: 201 });
  }

  if (resource === "documents" && action === "upload") {
    const documentType = String(body.documentType || body.type || "").trim();
    if (!documentType) return jsonError("نوع المستند مطلوب.");
    const document = await prisma.driverDocument.create({
      data: {
        driverId,
        type: documentType,
        documentType,
        documentNumber: String(body.documentNumber || "") || null,
        fileUrl: String(body.fileUrl || "") || null,
        verificationStatus: "pending",
        status: RecordStatus.PENDING,
        notes: String(body.notes || "") || null,
      },
    });
    await auditRiderAction(driverId, "RIDER_UPLOAD_DOCUMENT", "DriverDocument", document.id, { documentType });
    return NextResponse.json({ data: document }, { status: 201 });
  }

  if (resource === "support") {
    const type = String(body.type || "general").trim();
    const title = String(body.title || "").trim();
    const description = String(body.description || "").trim();
    if (!title || !description) return jsonError("عنوان الطلب والوصف مطلوبان.");
    const task = await prisma.task.create({
      data: {
        title,
        description,
        category: `SUPPORT_${type.toUpperCase()}`,
        cityId: context.driver?.cityId || null,
        supervisorId: context.driver?.supervisorId || null,
        driverId,
        priority: type === "salary" || type === "violation" ? "WARNING" : "INFO",
        status: RecordStatus.PENDING,
        notes: String(body.relatedMonth || "") || null,
      },
    });
    await prisma.notification.create({
      data: {
        title: "تم استلام طلب الدعم",
        body: "تم تسجيل طلبك وسيتم متابعته من الفريق المختص.",
        severity: "INFO",
        status: RecordStatus.PENDING,
        driverId,
        entityType: "Task",
        entityId: task.id,
      },
    }).catch(() => null);
    await auditRiderAction(driverId, "RIDER_SUBMIT_SUPPORT_REQUEST", "Task", task.id, { type, title });
    return NextResponse.json({ data: task }, { status: 201 });
  }

  return jsonError("Not found", 404);
}
