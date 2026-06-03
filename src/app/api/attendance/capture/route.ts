import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAccessScope } from "@/lib/auth/accessScope";
import { canWriteResource, roleFromHeaders } from "@/lib/permissions";

type CaptureBody = {
  personType?: string;
  personId?: string;
  action?: string;
  workDate?: string;
  capturedAt?: string;
  photoDataUrl?: string;
};

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

function validPhoto(value: string) {
  return /^data:image\/(png|jpeg|jpg|webp);base64,/i.test(value) && value.length < 1_500_000;
}

function hoursBetween(start?: Date | null, end?: Date | null) {
  if (!start || !end) return 0;
  const hours = (end.getTime() - start.getTime()) / 36e5;
  return Math.max(0, Math.round(hours * 100) / 100);
}

async function canUsePerson(headers: Headers, personType: string, personId: string) {
  const scope = await getAccessScope(headers);
  if (scope.isGlobal) return true;

  if (personType === "driver") {
    const driver = await prisma.driver.findUnique({ where: { id: personId }, select: { id: true, cityId: true, projectId: true, supervisorId: true } });
    if (!driver) return false;
    if (scope.driverId && scope.driverId !== driver.id) return false;
    if (scope.supervisorId && scope.supervisorId !== driver.supervisorId) return false;
    if (scope.cityIds.length && (!driver.cityId || !scope.cityIds.includes(driver.cityId))) return false;
    if (scope.projectIds.length && (!driver.projectId || !scope.projectIds.includes(driver.projectId))) return false;
    return true;
  }

  if (personType === "supervisor") {
    const supervisor = await prisma.supervisor.findUnique({ where: { id: personId }, select: { id: true, cityId: true } });
    if (!supervisor) return false;
    if (scope.supervisorId && scope.supervisorId !== supervisor.id) return false;
    if (scope.cityIds.length && (!supervisor.cityId || !scope.cityIds.includes(supervisor.cityId))) return false;
    return true;
  }

  if (personType === "user") return Boolean(scope.userId && scope.userId === personId);
  return false;
}

export async function POST(request: Request) {
  const role = roleFromHeaders(request.headers);
  if (!canWriteResource(role, "attendance")) {
    return NextResponse.json({ error: "ليس لديك صلاحية تسجيل الحضور والانصراف." }, { status: 403 });
  }

  const body = (await request.json()) as CaptureBody;
  const personType = String(body.personType || "").trim();
  const personId = String(body.personId || "").trim();
  const action = String(body.action || "").trim();
  const photoDataUrl = String(body.photoDataUrl || "").trim();
  const workDate = String(body.workDate || today()).slice(0, 10);
  const capturedAt = body.capturedAt ? new Date(body.capturedAt) : new Date();

  if (!["driver", "supervisor", "user"].includes(personType)) {
    return NextResponse.json({ error: "نوع الشخص غير صحيح." }, { status: 400 });
  }
  if (!personId) return NextResponse.json({ error: "اختر الشخص أولاً." }, { status: 400 });
  if (!["check-in", "check-out"].includes(action)) {
    return NextResponse.json({ error: "نوع الحركة غير صحيح." }, { status: 400 });
  }
  if (!validPhoto(photoDataUrl)) {
    return NextResponse.json({ error: "صورة الحضور أو الانصراف مطلوبة ويجب أن تكون صورة صالحة." }, { status: 400 });
  }
  if (Number.isNaN(capturedAt.getTime())) {
    return NextResponse.json({ error: "وقت التسجيل غير صحيح." }, { status: 400 });
  }
  if (!(await canUsePerson(request.headers, personType, personId))) {
    return NextResponse.json({ error: "هذا الشخص خارج نطاق صلاحياتك." }, { status: 403 });
  }

  const personWhere = personType === "driver" ? { driverId: personId } : personType === "supervisor" ? { supervisorId: personId } : { userId: personId };
  const existing = await prisma.attendanceRecord.findFirst({
    where: {
      personType,
      ...personWhere,
      workDate: { gte: startOfDay(workDate), lt: nextDay(workDate) },
    },
    orderBy: { updatedAt: "desc" },
  });

  const data = {
    personType,
    driverId: personType === "driver" ? personId : null,
    supervisorId: personType === "supervisor" ? personId : null,
    userId: personType === "user" ? personId : null,
    workDate: startOfDay(workDate),
    checkIn: action === "check-in" ? capturedAt : existing?.checkIn ?? null,
    checkOut: action === "check-out" ? capturedAt : existing?.checkOut ?? null,
    checkInPhoto: action === "check-in" ? photoDataUrl : existing?.checkInPhoto ?? null,
    checkOutPhoto: action === "check-out" ? photoDataUrl : existing?.checkOutPhoto ?? null,
    status: "ACTIVE" as const,
    notes: action === "check-in" ? "تسجيل حضور بالكاميرا" : "تسجيل انصراف بالكاميرا",
  };

  const saved = existing
    ? await prisma.attendanceRecord.update({
        where: { id: existing.id },
        data: { ...data, workingHours: hoursBetween(data.checkIn, data.checkOut) },
      })
    : await prisma.attendanceRecord.create({
        data: { ...data, workingHours: hoursBetween(data.checkIn, data.checkOut) },
      });

  await prisma.auditLog
    .create({
      data: {
        userId: (await getAccessScope(request.headers)).userId || null,
        action: action === "check-in" ? "ATTENDANCE_CHECK_IN" : "ATTENDANCE_CHECK_OUT",
        entityType: "AttendanceRecord",
        entityId: saved.id,
        after: { personType, personId, workDate, hasPhoto: true },
      },
    })
    .catch(() => null);

  return NextResponse.json({ data: saved });
}
