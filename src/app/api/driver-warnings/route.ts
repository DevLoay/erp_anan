import { NextResponse } from "next/server";
import { Prisma, RecordStatus, Severity } from "@prisma/client";
import { getAccessScope, type AccessScope } from "@/lib/auth/accessScope";
import { canReadResource, canWriteResource, roleFromHeaders } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

function jsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function normalizeSeverity(value: unknown) {
  const severity = String(value || "WARNING").toUpperCase();
  return Object.values(Severity).includes(severity as Severity) ? (severity as Severity) : Severity.WARNING;
}

function normalizeStatus(value: unknown) {
  const status = String(value || "PENDING").toUpperCase();
  return Object.values(RecordStatus).includes(status as RecordStatus) ? (status as RecordStatus) : RecordStatus.PENDING;
}

function canAccessDriver(scope: AccessScope, driver: {
  id: string;
  cityId: string | null;
  supervisorId: string | null;
  applicationAccounts: { applicationProjectId: string | null }[];
}) {
  if (scope.isGlobal) return true;
  if (scope.driverId && driver.id === scope.driverId) return true;
  if (scope.supervisorId && driver.supervisorId === scope.supervisorId) return true;
  if (driver.cityId && scope.cityIds.includes(driver.cityId)) return true;
  return driver.applicationAccounts.some((account) => account.applicationProjectId && scope.projectIds.includes(account.applicationProjectId));
}

export async function POST(request: Request) {
  const role = roleFromHeaders(request.headers);
  if (!canWriteResource(role, "driver-warnings")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const driverId = String(body.driverId ?? "").trim();
  const type = String(body.type ?? "").trim();
  const notes = String(body.notes ?? "").trim();
  const issuedAt = body.issuedAt ? new Date(String(body.issuedAt)) : new Date();
  const followUpAt = body.followUpAt ? new Date(String(body.followUpAt)) : null;
  const severity = normalizeSeverity(body.severity);
  const status = normalizeStatus(body.status);

  if (!driverId || !type) return NextResponse.json({ error: "المندوب ونوع التحذير مطلوبان." }, { status: 400 });
  if (!Number.isFinite(issuedAt.getTime()) || (followUpAt && !Number.isFinite(followUpAt.getTime()))) {
    return NextResponse.json({ error: "تاريخ التحذير أو المتابعة غير صحيح." }, { status: 400 });
  }

  const scope = await getAccessScope(request.headers);
  const driver = await prisma.driver.findUnique({
    where: { id: driverId },
    include: { applicationAccounts: { select: { applicationProjectId: true } } },
  });
  if (!driver) return NextResponse.json({ error: "المندوب غير موجود." }, { status: 404 });
  if (!canAccessDriver(scope, driver)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const userId = request.headers.get("x-user-id") || undefined;
  const userEmail = request.headers.get("x-user-email") || undefined;
  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const warning = await tx.driverWarning.create({
      data: {
        driverId,
        type,
        severity,
        status,
        issuedAt,
        followUpAt,
        notes: notes || null,
      },
    });
    const notification = await tx.notification.create({
      data: {
        title: "تحذير جديد",
        body: `${type}${notes ? ` - ${notes}` : ""}`,
        severity,
        status: RecordStatus.PENDING,
        driverId,
        entityType: "DriverWarning",
        entityId: warning.id,
      },
    });
    await tx.auditLog.create({
      data: {
        userId,
        user: userEmail,
        action: "CREATE_DRIVER_WARNING",
        entityType: "DriverWarning",
        entityId: warning.id,
        after: jsonValue({ warning, notification }),
        newValue: jsonValue({ warning, notification }),
      },
    }).catch(() => null);
    return { warning, notification };
  });

  return NextResponse.json({ data: result }, { status: 201 });
}

export async function GET(request: Request) {
  const role = roleFromHeaders(request.headers);
  if (!canReadResource(role, "driver-warnings")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const scope = await getAccessScope(request.headers);
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const take = Math.min(Number(url.searchParams.get("take") ?? 50), 500);
  const and: Prisma.DriverWarningWhereInput[] = [];
  if (q) {
    and.push({
      OR: [
        { type: { contains: q, mode: "insensitive" } },
        { notes: { contains: q, mode: "insensitive" } },
        { driver: { name: { contains: q, mode: "insensitive" } } },
        { driver: { actualName: { contains: q, mode: "insensitive" } } },
        { driver: { internalCode: { contains: q, mode: "insensitive" } } },
        { driver: { driverCode: { contains: q, mode: "insensitive" } } },
      ],
    });
  }
  if (!scope.isGlobal) {
    const scopedOr: Prisma.DriverWarningWhereInput[] = [];
    if (scope.driverId) scopedOr.push({ driverId: scope.driverId });
    if (scope.supervisorId) scopedOr.push({ driver: { supervisorId: scope.supervisorId } });
    if (scope.cityIds.length) scopedOr.push({ driver: { cityId: { in: scope.cityIds } } });
    if (scope.projectIds.length) scopedOr.push({ driver: { applicationAccounts: { some: { applicationProjectId: { in: scope.projectIds } } } } });
    and.push(scopedOr.length ? { OR: scopedOr } : { id: "__NO_ACCESS_SCOPE__" });
  }
  const where: Prisma.DriverWarningWhereInput = {
    ...(url.searchParams.get("driverId") ? { driverId: url.searchParams.get("driverId") ?? undefined } : {}),
    ...(url.searchParams.get("status") ? { status: normalizeStatus(url.searchParams.get("status")) } : {}),
    ...(and.length ? { AND: and } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.driverWarning.findMany({
      where,
      include: { driver: { select: { name: true, actualName: true, internalCode: true, driverCode: true } } },
      orderBy: { issuedAt: "desc" },
      take,
    }),
    prisma.driverWarning.count({ where }),
  ]);

  return NextResponse.json({
    data: rows.map((row) => ({
      ...row,
      driverName: row.driver.actualName || row.driver.name,
      driverCode: row.driver.driverCode || row.driver.internalCode,
    })),
    meta: { count: rows.length, total, resource: "driver-warnings" },
  });
}
