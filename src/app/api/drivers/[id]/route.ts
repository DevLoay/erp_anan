import { NextResponse } from "next/server";
import { DriverStatus, VehicleStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canWriteResource, roleFromHeaders } from "@/lib/permissions";

function jsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? null));
}

async function audit(request: Request, action: string, entityId: string, before: unknown, after: unknown) {
  await prisma.auditLog.create({
    data: {
      userId: request.headers.get("x-user-id") || undefined,
      user: request.headers.get("x-user-email") || undefined,
      action,
      entityType: "Driver",
      entityId,
      before: jsonValue(before),
      after: jsonValue(after),
      oldValue: jsonValue(before),
      newValue: jsonValue(after),
    },
  }).catch(() => null);
}

async function linkedRecordsCount(driverId: string) {
  const counts = await Promise.all([
    prisma.applicationAccount.count({ where: { driverId } }),
    prisma.accountUsage.count({ where: { OR: [{ ownerDriverId: driverId }, { actualDriverId: driverId }] } }),
    prisma.payrollItem.count({ where: { driverId } }),
    prisma.advance.count({ where: { driverId } }),
    prisma.violation.count({ where: { driverId } }),
    prisma.attendanceRecord.count({ where: { driverId } }),
    prisma.vehicleAssignment.count({ where: { driverId } }),
    prisma.applicationImportRow.count({ where: { driverId } }),
    prisma.financeEntry.count({ where: { driverId } }),
    prisma.hungerStationDailyPerformanceRecord.count({ where: { driverId } }),
    prisma.hungerStationInvoiceRecord.count({ where: { driverId } }),
    prisma.keetaRankRecord.count({ where: { driverId } }),
    prisma.keetaPerformanceRecord.count({ where: { driverId } }),
    prisma.keetaInvoiceRecord.count({ where: { driverId } }),
  ]);
  return counts.reduce((sum, count) => sum + count, 0);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const role = roleFromHeaders(request.headers);
  if (!canWriteResource(role, "drivers")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action || "update");
  const before = await prisma.driver.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (action === "safeDelete") {
    const linkedRecords = await linkedRecordsCount(id);
    if (linkedRecords > 0) {
      const updated = await prisma.driver.update({ where: { id }, data: { status: DriverStatus.INACTIVE, needsReview: true } });
      await audit(request, "DRIVER_SAFE_DELETE_BLOCKED", id, before, { ...updated, linkedRecords });
      return NextResponse.json({ data: updated, blocked: true, linkedRecords });
    }
    const deleted = await prisma.driver.delete({ where: { id } });
    await audit(request, "DRIVER_SAFE_DELETE", id, before, deleted);
    return NextResponse.json({ data: deleted, deleted: true });
  }

  const data: Record<string, unknown> = {};
  if (action === "suspend") {
    data.status = DriverStatus.SUSPENDED;
    data.needsReview = true;
  } else if (action === "reactivate") {
    data.status = DriverStatus.ACTIVE;
  } else if (action === "archive") {
    data.status = DriverStatus.INACTIVE;
    data.needsReview = true;
  } else if (action === "assignSupervisor") {
    data.supervisorId = String(body.supervisorId || "").trim() || null;
  } else if (action === "moveScope") {
    if ("cityId" in body) data.cityId = String(body.cityId || "").trim() || null;
    if ("projectId" in body) data.projectId = String(body.projectId || "").trim() || null;
  } else if (action === "update") {
    const allowed = ["name", "actualName", "phone", "mobile", "nationalId", "nationality", "contractType", "sponsorshipType", "accommodationType", "housingStatus", "vehicleOwnershipType", "joinDate", "driverCode", "cityId", "supervisorId"];
    for (const key of allowed) {
      if (!(key in body)) continue;
      data[key] = key === "joinDate" && body[key] ? new Date(String(body[key])) : body[key] || null;
    }
    const internalCode = String(body.internalCode || "").trim();
    if (internalCode && internalCode !== before.internalCode) {
      const duplicate = await prisma.driver.findFirst({ where: { internalCode, id: { not: id } }, select: { id: true } });
      if (duplicate) return NextResponse.json({ error: "الكود الداخلي مستخدم بالفعل لمندوب آخر." }, { status: 409 });
      data.internalCode = internalCode;
    }
    const status = String(body.status || "").trim();
    if (status) {
      if (!Object.values(DriverStatus).includes(status as DriverStatus)) return NextResponse.json({ error: "حالة المندوب غير صحيحة." }, { status: 400 });
      data.status = status;
    }
    if ("vehicleId" in body) data.vehicleId = String(body.vehicleId || "").trim() || null;
    if ("accountId" in body) data.accountId = String(body.accountId || "").trim() || null;
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  if (action === "update") {
    const cityId = typeof data.cityId === "string" ? data.cityId : before.cityId;
    const supervisorId = typeof data.supervisorId === "string" ? data.supervisorId : null;
    const vehicleId = typeof data.vehicleId === "string" ? data.vehicleId : null;
    const accountId = typeof data.accountId === "string" ? data.accountId : null;
    const applicationProjectId = String(body.applicationProjectId || "").trim();
    const appUserId = String(body.appUserId || "").trim();
    const appUsername = String(body.appUsername || "").trim();

    const [supervisor, vehicle, account, applicationProject] = await Promise.all([
      supervisorId ? prisma.supervisor.findUnique({ where: { id: supervisorId }, select: { id: true, cityId: true } }) : null,
      vehicleId ? prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { id: true, currentDriverId: true, cityId: true } }) : null,
      accountId ? prisma.applicationAccount.findUnique({ where: { id: accountId }, select: { id: true, driverId: true, cityId: true, applicationProjectId: true } }) : null,
      applicationProjectId ? prisma.applicationProject.findUnique({ where: { id: applicationProjectId }, select: { id: true, applicationId: true, application: { select: { name: true } }, cityId: true } }) : null,
    ]);

    if (supervisorId && !supervisor) return NextResponse.json({ error: "المشرف المحدد غير موجود." }, { status: 400 });
    if (supervisor?.cityId && cityId && supervisor.cityId !== cityId) return NextResponse.json({ error: "المشرف خارج نطاق مدينة المندوب." }, { status: 409 });
    if (vehicleId && !vehicle) return NextResponse.json({ error: "السيارة المحددة غير موجودة." }, { status: 400 });
    if (vehicle?.currentDriverId && vehicle.currentDriverId !== id) return NextResponse.json({ error: "السيارة مرتبطة بالفعل بمندوب آخر." }, { status: 409 });
    if (accountId && !account) return NextResponse.json({ error: "حساب التطبيق المحدد غير موجود." }, { status: 400 });
    if (account?.driverId && account.driverId !== id) return NextResponse.json({ error: "حساب التطبيق مرتبط بالفعل بمندوب آخر." }, { status: 409 });
    if (applicationProjectId && !applicationProject) return NextResponse.json({ error: "مشروع التطبيق المحدد غير موجود." }, { status: 400 });
    if (applicationProject?.cityId && cityId && applicationProject.cityId !== cityId) return NextResponse.json({ error: "مشروع التطبيق خارج نطاق مدينة المندوب." }, { status: 409 });

    const updated = await prisma.$transaction(async (tx) => {
      if (before.vehicleId && before.vehicleId !== vehicleId) {
        await tx.vehicle.updateMany({ where: { id: before.vehicleId, currentDriverId: id }, data: { currentDriverId: null, status: VehicleStatus.AVAILABLE } });
        await tx.vehicleAssignment.updateMany({ where: { driverId: id, vehicleId: before.vehicleId, endDate: null }, data: { endDate: new Date(), status: "INACTIVE" } });
      }

      let linkedAccountId = accountId;
      if (accountId) {
        await tx.applicationAccount.update({ where: { id: accountId }, data: { driverId: id, cityId: cityId || null, linkedAt: new Date(), isEmpty: false, needsReview: false } });
      } else if (applicationProject && (appUserId || appUsername)) {
        const username = appUserId || appUsername;
        const existing = await tx.applicationAccount.findFirst({
          where: {
            applicationProjectId,
            OR: [{ appUserId: appUserId || username }, { username }],
          },
          select: { id: true, driverId: true },
        });
        if (existing?.driverId && existing.driverId !== id) throw new Error("حساب التطبيق موجود ومرتبط بالفعل بمندوب آخر.");
        const linked = existing
          ? await tx.applicationAccount.update({
              where: { id: existing.id },
              data: { driverId: id, cityId: cityId || null, appUserId: appUserId || username, appUsername: appUsername || String(data.name || before.name), isEmpty: false, needsReview: false, linkedAt: new Date() },
              select: { id: true },
            })
          : await tx.applicationAccount.create({
              data: {
                appName: applicationProject.application.name,
                username,
                appUserId: appUserId || username,
                appUsername: appUsername || String(data.name || before.name),
                applicationId: applicationProject.applicationId,
                applicationProjectId,
                cityId: cityId || null,
                driverId: id,
                isEmpty: false,
                needsReview: false,
                source: "MANUAL_EDIT",
                linkedAt: new Date(),
              },
              select: { id: true },
            });
        linkedAccountId = linked.id;
      }

      const driver = await tx.driver.update({ where: { id }, data: { ...data, accountId: linkedAccountId || null } });
      if (vehicleId) {
        await tx.vehicle.update({ where: { id: vehicleId }, data: { currentDriverId: id, status: VehicleStatus.ASSIGNED, ...(cityId ? { cityId } : {}) } });
        const openAssignment = await tx.vehicleAssignment.findFirst({ where: { driverId: id, vehicleId, endDate: null }, select: { id: true } });
        if (!openAssignment) await tx.vehicleAssignment.create({ data: { driverId: id, vehicleId, startDate: new Date(), status: "ACTIVE", notes: "تم ربط السيارة من تعديل بيانات المندوب." } });
      }
      return driver;
    });

    await audit(request, `DRIVER_${action.toUpperCase()}`, id, before, updated);
    return NextResponse.json({ data: updated });
  }

  const updated = await prisma.driver.update({ where: { id }, data });
  await audit(request, `DRIVER_${action.toUpperCase()}`, id, before, updated);
  return NextResponse.json({ data: updated });
}
