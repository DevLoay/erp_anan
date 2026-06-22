import { DriverStatus, Prisma, RecordStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canWriteResource, roleFromHeaders } from "@/lib/permissions";

function text(value: unknown) {
  return String(value ?? "").trim();
}

function optionalText(value: unknown) {
  const out = text(value);
  return out ? out : null;
}

function dateOrNull(value: unknown) {
  const raw = text(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function jsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function driverStatus(value: unknown) {
  const raw = text(value).toUpperCase();
  if (raw === DriverStatus.ACTIVE || raw === DriverStatus.SUSPENDED || raw === DriverStatus.INACTIVE) return raw as DriverStatus;
  return undefined;
}

function recordStatus(value: unknown) {
  const raw = text(value).toUpperCase();
  if (raw === RecordStatus.ACTIVE || raw === RecordStatus.INACTIVE || raw === RecordStatus.PENDING) return raw as RecordStatus;
  return undefined;
}

function userStatus(value: unknown) {
  const raw = text(value).toLowerCase();
  if (raw === "active" || raw === "inactive") return raw;
  return undefined;
}

function hasWriteAccess(request: Request, personType: string) {
  const role = roleFromHeaders(request.headers);
  const resource = personType === "user" ? "users" : personType === "supervisor" ? "supervisors" : "drivers";
  return canWriteResource(role, resource);
}

async function audit(request: Request, action: string, entityType: string, entityId: string | null, before: unknown, after: unknown) {
  await prisma.auditLog
    .create({
      data: {
        userId: request.headers.get("x-user-id") || undefined,
        user: request.headers.get("x-user-email") || undefined,
        action,
        entityType,
        entityId,
        before: jsonValue(before),
        after: jsonValue(after),
        oldValue: jsonValue(before),
        newValue: jsonValue(after),
      },
    })
    .catch(() => null);
}

function driverPatch(fields: Record<string, unknown>): Prisma.DriverUpdateInput {
  const data: Prisma.DriverUpdateInput = {};
  const status = driverStatus(fields.status);
  if (status) data.status = status;
  if ("joinDate" in fields) data.joinDate = dateOrNull(fields.joinDate);
  if ("cityId" in fields) data.city = optionalText(fields.cityId) ? { connect: { id: text(fields.cityId) } } : { disconnect: true };
  if ("supervisorId" in fields) data.supervisor = optionalText(fields.supervisorId) ? { connect: { id: text(fields.supervisorId) } } : { disconnect: true };
  if ("contractType" in fields) data.contractType = optionalText(fields.contractType);
  if ("sponsorshipType" in fields) data.sponsorshipType = optionalText(fields.sponsorshipType);
  if ("housingStatus" in fields) data.housingStatus = optionalText(fields.housingStatus);
  if ("accommodationType" in fields) data.accommodationType = optionalText(fields.accommodationType);
  return data;
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const personType = text(body.personType);
  if (!["driver", "supervisor", "user"].includes(personType)) return NextResponse.json({ error: "نوع السجل غير صحيح." }, { status: 400 });
  if (!hasWriteAccess(request, personType)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const fields = (body.fields && typeof body.fields === "object" ? body.fields : {}) as Record<string, unknown>;
  const ids = Array.isArray(body.ids) ? body.ids.map(text).filter(Boolean) : [];
  const id = text(body.id);
  if (!id && !ids.length) return NextResponse.json({ error: "اختر سجل واحد على الأقل." }, { status: 400 });

  if (personType === "driver") {
    if (ids.length) {
      const before = await prisma.driver.findMany({ where: { id: { in: ids } }, select: { id: true, status: true, supervisorId: true, cityId: true, contractType: true, sponsorshipType: true, housingStatus: true } });
      const data = driverPatch(fields);
      await prisma.$transaction(ids.map((driverId) => prisma.driver.update({ where: { id: driverId }, data })));
      await audit(request, "HR_BULK_UPDATE_DRIVERS", "Driver", null, before, { ids, data });
      return NextResponse.json({ message: `تم تحديث ${ids.length} مندوب.` });
    }
    const before = await prisma.driver.findUnique({ where: { id } });
    if (!before) return NextResponse.json({ error: "المندوب غير موجود." }, { status: 404 });
    const updated = await prisma.driver.update({ where: { id }, data: driverPatch(fields) });
    await audit(request, "HR_UPDATE_DRIVER", "Driver", id, before, updated);
    return NextResponse.json({ message: "تم تحديث بيانات المندوب.", item: updated });
  }

  if (personType === "supervisor") {
    const before = await prisma.supervisor.findUnique({ where: { id } });
    if (!before) return NextResponse.json({ error: "المشرف غير موجود." }, { status: 404 });
    const status = recordStatus(fields.status);
    const updated = await prisma.supervisor.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        ...("cityId" in fields ? { cityId: optionalText(fields.cityId) } : {}),
      },
    });
    await audit(request, "HR_UPDATE_SUPERVISOR", "Supervisor", id, before, updated);
    return NextResponse.json({ message: "تم تحديث بيانات المشرف.", item: updated });
  }

  const before = await prisma.user.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "المستخدم غير موجود." }, { status: 404 });
  const status = userStatus(fields.status);
  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(status ? { status, isActive: status === "active" } : {}),
      ...("cityId" in fields ? { cityId: optionalText(fields.cityId) } : {}),
    },
  });
  await audit(request, "HR_UPDATE_USER", "User", id, before, updated);
  return NextResponse.json({ message: "تم تحديث بيانات المستخدم.", item: updated });
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const personType = text(url.searchParams.get("personType"));
  const id = text(url.searchParams.get("id"));
  if (!["driver", "supervisor", "user"].includes(personType) || !id) return NextResponse.json({ error: "بيانات التعطيل غير مكتملة." }, { status: 400 });
  if (!hasWriteAccess(request, personType)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (personType === "driver") {
    const before = await prisma.driver.findUnique({ where: { id } });
    if (!before) return NextResponse.json({ error: "المندوب غير موجود." }, { status: 404 });
    const updated = await prisma.driver.update({ where: { id }, data: { status: DriverStatus.INACTIVE } });
    await audit(request, "HR_DEACTIVATE_DRIVER", "Driver", id, before, updated);
    return NextResponse.json({ message: "تم تعطيل المندوب بدون حذف بياناته التشغيلية." });
  }

  if (personType === "supervisor") {
    const before = await prisma.supervisor.findUnique({ where: { id } });
    if (!before) return NextResponse.json({ error: "المشرف غير موجود." }, { status: 404 });
    const updated = await prisma.supervisor.update({ where: { id }, data: { status: RecordStatus.INACTIVE } });
    await audit(request, "HR_DEACTIVATE_SUPERVISOR", "Supervisor", id, before, updated);
    return NextResponse.json({ message: "تم تعطيل المشرف." });
  }

  const before = await prisma.user.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "المستخدم غير موجود." }, { status: 404 });
  const updated = await prisma.user.update({ where: { id }, data: { status: "inactive", isActive: false } });
  await audit(request, "HR_DEACTIVATE_USER", "User", id, before, updated);
  return NextResponse.json({ message: "تم تعطيل المستخدم." });
}
