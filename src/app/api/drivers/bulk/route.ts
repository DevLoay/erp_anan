import { NextResponse } from "next/server";
import { canAccessCity, canAccessProject, getAccessScope } from "@/lib/auth/accessScope";
import { canWriteResource, roleFromHeaders } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item ?? "").trim()).filter(Boolean) : [];
}

function jsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export async function PATCH(request: Request) {
  const role = roleFromHeaders(request.headers);
  if (!canWriteResource(role, "drivers")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const scope = await getAccessScope(request.headers);
  const body = (await request.json()) as Record<string, unknown>;
  const action = String(body.action ?? "").trim();
  const driverIds = [...new Set(asStringArray(body.driverIds))];
  const supervisorId = String(body.supervisorId ?? "").trim();

  if (action !== "assignSupervisor") {
    return NextResponse.json({ error: "إجراء غير مدعوم." }, { status: 400 });
  }
  if (!driverIds.length || !supervisorId) {
    return NextResponse.json({ error: "اختر المناديب والمشرف أولًا." }, { status: 400 });
  }

  const [drivers, supervisor] = await Promise.all([
    prisma.driver.findMany({
      where: { id: { in: driverIds } },
      select: {
        id: true,
        internalCode: true,
        name: true,
        cityId: true,
        supervisorId: true,
        applicationAccounts: { select: { applicationProjectId: true } },
      },
    }),
    prisma.supervisor.findUnique({ where: { id: supervisorId }, select: { id: true, name: true, cityId: true } }),
  ]);

  if (!supervisor) return NextResponse.json({ error: "المشرف المحدد غير موجود." }, { status: 400 });

  const allowedDrivers = drivers.filter((driver) => {
    if (scope.isGlobal) return true;
    const cityAllowed = driver.cityId ? canAccessCity(scope, driver.cityId) : true;
    const projectAllowed = driver.applicationAccounts.some((account) => account.applicationProjectId && canAccessProject(scope, account.applicationProjectId));
    return cityAllowed || projectAllowed || scope.driverId === driver.id || scope.supervisorId === driver.supervisorId;
  });

  const blockedByScope = drivers.length - allowedDrivers.length;
  if (!allowedDrivers.length) return NextResponse.json({ error: "لا توجد مناديب داخل نطاق صلاحيتك." }, { status: 403 });

  const invalidCityDrivers = supervisor.cityId ? allowedDrivers.filter((driver) => driver.cityId && driver.cityId !== supervisor.cityId) : [];
  const allowOverride = Boolean(body.allowScopeOverride) && role === "ADMIN";
  if (invalidCityDrivers.length && !allowOverride) {
    return NextResponse.json(
      {
        error: "لا يمكن ربط مشرف مدينة بمناديب خارج مدينته.",
        skippedCount: invalidCityDrivers.length,
      },
      { status: 409 },
    );
  }

  const updateIds = allowedDrivers.map((driver) => driver.id);
  const result = await prisma.driver.updateMany({
    where: { id: { in: updateIds } },
    data: { supervisorId },
  });

  await prisma.auditLog
    .create({
      data: {
        userId: request.headers.get("x-user-id") || undefined,
        user: request.headers.get("x-user-email") || undefined,
        action: "BULK_ASSIGN_DRIVER_SUPERVISOR",
        entityType: "drivers",
        entityId: supervisorId,
        after: jsonValue({ driverIds: updateIds, supervisorId, supervisorName: supervisor.name, updatedCount: result.count, blockedByScope }),
        newValue: jsonValue({ driverIds: updateIds, supervisorId, supervisorName: supervisor.name, updatedCount: result.count, blockedByScope }),
      },
    })
    .catch(() => null);

  return NextResponse.json({
    data: {
      updatedCount: result.count,
      skippedCount: blockedByScope,
    },
  });
}
