import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getAccessScope, canAccessCity, canAccessProject } from "@/lib/auth/accessScope";
import { canWriteResource, roleFromHeaders } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

function text(value: unknown) {
  return String(value ?? "").trim();
}

function nullable(value: unknown) {
  const out = text(value);
  return out ? out : null;
}

function dateOrNull(value: unknown) {
  const raw = text(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function validPhone(value: string) {
  if (!value) return true;
  return /^[+\d\s-]{7,20}$/.test(value);
}

function jsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? null));
}

async function audit(request: Request, action: string, entityType: string, entityId: string | undefined, after: unknown) {
  await prisma.auditLog
    .create({
      data: {
        userId: request.headers.get("x-user-id") || undefined,
        user: request.headers.get("x-user-email") || undefined,
        action,
        entityType,
        entityId,
        after: jsonValue(after),
        newValue: jsonValue(after),
      },
    })
    .catch(() => null);
}

export async function POST(request: Request) {
  const role = roleFromHeaders(request.headers);
  if (!canWriteResource(role, "drivers")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const scope = await getAccessScope(request.headers);
  const body = (await request.json()) as Record<string, unknown>;

  const internalCode = text(body.internalCode);
  const name = text(body.name || body.actualName);
  const phone = text(body.phone || body.mobile);
  const cityId = text(body.cityId);
  const supervisorId = text(body.supervisorId);
  const vehicleId = text(body.vehicleId);
  const accountId = text(body.accountId);
  const applicationProjectId = text(body.applicationProjectId);
  const appUserId = text(body.appUserId);
  const appUsername = text(body.appUsername);
  const requestedVehicleOwnershipType = text(body.vehicleOwnershipType) || "no_vehicle";
  const vehicleOwnershipType = vehicleId ? "company_car" : requestedVehicleOwnershipType;
  const status = text(body.status) || "ACTIVE";

  if (!internalCode || !name || !phone || !cityId) {
    return NextResponse.json({ error: "الكود الداخلي والاسم والجوال والمدينة مطلوبة." }, { status: 400 });
  }
  if (!validPhone(phone)) {
    return NextResponse.json({ error: "رقم الجوال غير صحيح." }, { status: 400 });
  }
  if (!scope.isGlobal && !canAccessCity(scope, cityId)) {
    return NextResponse.json({ error: "لا تملك صلاحية إضافة مندوب داخل هذه المدينة." }, { status: 403 });
  }
  if (applicationProjectId && !canAccessProject(scope, applicationProjectId)) {
    return NextResponse.json({ error: "لا تملك صلاحية إضافة مندوب داخل مشروع التطبيق المحدد." }, { status: 403 });
  }

  const duplicateCode = await prisma.driver.findUnique({ where: { internalCode }, select: { id: true } });
  if (duplicateCode) return NextResponse.json({ error: "الكود الداخلي مستخدم بالفعل." }, { status: 409 });

  const [city, supervisor, vehicle, account, applicationProject, duplicateNationalId] = await Promise.all([
    prisma.city.findUnique({ where: { id: cityId }, select: { id: true } }),
    supervisorId ? prisma.supervisor.findUnique({ where: { id: supervisorId }, select: { id: true, cityId: true } }) : null,
    vehicleId ? prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { id: true, currentDriverId: true, status: true, cityId: true } }) : null,
    accountId ? prisma.applicationAccount.findUnique({ where: { id: accountId }, select: { id: true, driverId: true, cityId: true, applicationProjectId: true } }) : null,
    applicationProjectId
      ? prisma.applicationProject.findUnique({ where: { id: applicationProjectId }, select: { id: true, applicationId: true, application: { select: { name: true } }, cityId: true } })
      : null,
    body.nationalId ? prisma.driver.findFirst({ where: { nationalId: text(body.nationalId) }, select: { id: true } }) : null,
  ]);

  if (!city) return NextResponse.json({ error: "المدينة المحددة غير موجودة." }, { status: 400 });
  if (supervisorId && !supervisor) return NextResponse.json({ error: "المشرف المحدد غير موجود." }, { status: 400 });
  if (supervisor?.cityId && supervisor.cityId !== cityId) {
    return NextResponse.json({ error: "المشرف المحدد خارج نطاق مدينة المندوب." }, { status: 409 });
  }
  if (vehicleId && !vehicle) return NextResponse.json({ error: "السيارة المحددة غير موجودة." }, { status: 400 });
  if (vehicle?.currentDriverId) return NextResponse.json({ error: "السيارة مربوطة بالفعل بمندوب نشط." }, { status: 409 });
  if (accountId && !account) return NextResponse.json({ error: "حساب التطبيق المحدد غير موجود." }, { status: 400 });
  if (account?.driverId) return NextResponse.json({ error: "حساب التطبيق مربوط بالفعل بمندوب آخر." }, { status: 409 });
  if (applicationProjectId && !applicationProject) return NextResponse.json({ error: "مشروع التطبيق المحدد غير موجود." }, { status: 400 });
  if (applicationProject?.cityId && applicationProject.cityId !== cityId) {
    return NextResponse.json({ error: "مشروع التطبيق خارج نطاق المدينة المحددة." }, { status: 409 });
  }

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const driver = await tx.driver.create({
      data: {
        internalCode,
        driverCode: nullable(body.driverCode),
        name,
        actualName: nullable(body.actualName) || name,
        phone,
        mobile: nullable(body.mobile) || phone,
        nationalId: nullable(body.nationalId),
        nationality: nullable(body.nationality),
        cityId,
        supervisorId: supervisorId || null,
        vehicleId: vehicleId || null,
        accountId: accountId || null,
        status: status as Prisma.DriverUncheckedCreateInput["status"],
        vehicleOwnershipType,
        contractType: nullable(body.contractType),
        sponsorshipType: nullable(body.sponsorshipType),
        accommodationType: nullable(body.accommodationType),
        housingStatus: nullable(body.housingStatus),
        source: text(body.source) || "MANUAL",
        needsReview: Boolean(duplicateNationalId),
        joinDate: dateOrNull(body.joinDate),
      },
    });

    let linkedAccountId = accountId || "";
    if (accountId) {
      await tx.applicationAccount.update({
        where: { id: accountId },
        data: { driverId: driver.id, cityId, linkedAt: new Date(), isEmpty: false, needsReview: false },
      });
    } else if (applicationProject && (appUserId || appUsername)) {
      const username = appUserId || appUsername || internalCode;
      const existing = await tx.applicationAccount.findFirst({
        where: {
          applicationProjectId,
          OR: [{ appUserId: appUserId || username }, { username }],
        },
        select: { id: true, driverId: true },
      });
      if (existing?.driverId) throw new Error("حساب التطبيق موجود ومربوط بالفعل بمندوب آخر.");
      const appAccount = existing
        ? await tx.applicationAccount.update({
            where: { id: existing.id },
            data: { driverId: driver.id, cityId, appUserId: appUserId || username, appUsername: appUsername || name, isEmpty: false, needsReview: false, linkedAt: new Date() },
          })
        : await tx.applicationAccount.create({
            data: {
              appName: applicationProject.application.name,
              username,
              appUserId: appUserId || username,
              appUsername: appUsername || name,
              applicationId: applicationProject.applicationId,
              applicationProjectId,
              cityId,
              driverId: driver.id,
              isEmpty: false,
              needsReview: false,
              source: "MANUAL",
              linkedAt: new Date(),
            },
          });
      linkedAccountId = appAccount.id;
      await tx.driver.update({ where: { id: driver.id }, data: { accountId: linkedAccountId } });
    }

    if (vehicleId) {
      await tx.vehicle.update({ where: { id: vehicleId }, data: { currentDriverId: driver.id, status: "ASSIGNED" } });
      await tx.vehicleAssignment.create({
        data: { vehicleId, driverId: driver.id, startDate: new Date(), status: "ACTIVE", notes: "تم ربط السيارة من إضافة مندوب يدوي." },
      });
    }

    return { driver: { ...driver, accountId: linkedAccountId || driver.accountId }, duplicateNationalId: Boolean(duplicateNationalId) };
  });

  await audit(request, "CREATE_DRIVER_MANUAL", "drivers", result.driver.id, result);
  return NextResponse.json({ data: result }, { status: 201 });
}
