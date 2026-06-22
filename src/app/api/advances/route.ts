import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canReadResource, canWriteResource, roleFromHeaders } from "@/lib/permissions";
import { getAccessScope, canAccessCity, canAccessProject } from "@/lib/auth/accessScope";

const validStatuses = new Set(["PENDING", "APPROVED", "REJECTED", "DEDUCTED", "PARTIALLY_DEDUCTED", "CANCELLED", "LOCKED"]);

function jsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function numberValue(value: unknown) {
  return Number(value) || 0;
}

function monthValue(value: unknown) {
  const raw = text(value);
  return /^\d{4}-\d{2}$/.test(raw) ? raw : "";
}

function dateValue(value: unknown) {
  const raw = text(value);
  const date = raw ? new Date(`${raw}T00:00:00.000Z`) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

async function audit(request: Request, action: string, entityId: string | undefined, before: unknown, after: unknown) {
  await prisma.auditLog
    .create({
      data: {
        userId: request.headers.get("x-user-id") || undefined,
        user: request.headers.get("x-user-email") || undefined,
        action,
        entityType: "advances",
        entityId,
        before: jsonValue(before),
        after: jsonValue(after),
        oldValue: jsonValue(before),
        newValue: jsonValue(after),
      },
    })
    .catch(() => null);
}

async function validateScope(request: Request, driverId: string, cityId: string, applicationProjectId: string) {
  const scope = await getAccessScope(request.headers);
  const driver = await prisma.driver.findUnique({
    where: { id: driverId },
    select: { id: true, cityId: true, supervisorId: true, applicationAccounts: { select: { applicationProjectId: true }, take: 5 } },
  });
  if (!driver) return { error: "المندوب غير موجود." };

  const effectiveCityId = cityId || driver.cityId || "";
  const effectiveProjectId = applicationProjectId || driver.applicationAccounts[0]?.applicationProjectId || "";

  if (effectiveCityId && !canAccessCity(scope, effectiveCityId)) return { error: "ليس لديك صلاحية على مدينة هذا المندوب." };
  if (effectiveProjectId && !canAccessProject(scope, effectiveProjectId)) return { error: "ليس لديك صلاحية على هذا المشروع." };
  if (scope.driverId && scope.driverId !== driver.id) return { error: "ليس لديك صلاحية على هذا المندوب." };
  if (scope.supervisorId && scope.supervisorId !== driver.supervisorId) return { error: "ليس لديك صلاحية على هذا المشرف." };

  return { driver, effectiveCityId, effectiveProjectId };
}

function dataFromBody(body: Record<string, unknown>) {
  const amount = numberValue(body.amount);
  const advanceDate = dateValue(body.advanceDate);
  const deductionMonth = monthValue(body.deductionMonth ?? body.deductFromMonth);
  const status = text(body.status || "PENDING").toUpperCase();
  return {
    driverId: text(body.driverId),
    applicationProjectId: text(body.applicationProjectId),
    cityId: text(body.cityId),
    supervisorId: text(body.supervisorId),
    referenceNumber: text(body.referenceNumber) || null,
    amount,
    remainingAmount: body.remainingAmount === undefined || body.remainingAmount === "" ? amount : numberValue(body.remainingAmount),
    reason: text(body.reason ?? body.note) || null,
    deductionMonth,
    advanceDate,
    status: validStatuses.has(status) ? status : "",
  };
}

export async function GET(request: Request) {
  const role = roleFromHeaders(request.headers);
  if (!canReadResource(role, "advances")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(request.url);
  const take = Math.min(Number(url.searchParams.get("take") || 50) || 50, 500);
  const rows = await prisma.advance.findMany({
    include: { driver: { select: { name: true, internalCode: true } } },
    orderBy: [{ advanceDate: "desc" }, { createdAt: "desc" }],
    take,
  });
  return NextResponse.json({ data: rows });
}

export async function POST(request: Request) {
  const role = roleFromHeaders(request.headers);
  if (!canWriteResource(role, "advances")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json()) as Record<string, unknown>;
  const data = dataFromBody(body);
  if (!data.driverId) return NextResponse.json({ error: "اختار المندوب أولًا." }, { status: 400 });
  if (!data.applicationProjectId) return NextResponse.json({ error: "اختار المشروع أولًا." }, { status: 400 });
  if (!data.cityId) return NextResponse.json({ error: "اختار المدينة أولًا." }, { status: 400 });
  if (!data.advanceDate) return NextResponse.json({ error: "تاريخ السلفة مطلوب." }, { status: 400 });
  if (!data.deductionMonth) return NextResponse.json({ error: "شهر الخصم يجب أن يكون بصيغة YYYY-MM." }, { status: 400 });
  if (data.amount <= 0) return NextResponse.json({ error: "قيمة السلفة يجب أن تكون أكبر من صفر." }, { status: 400 });
  if (!data.status) return NextResponse.json({ error: "حالة السلفة غير صحيحة." }, { status: 400 });

  const scopeResult = await validateScope(request, data.driverId, data.cityId, data.applicationProjectId);
  if ("error" in scopeResult) return NextResponse.json({ error: scopeResult.error }, { status: 403 });

  const result = await prisma.advance.create({
    data: {
      driverId: data.driverId,
      applicationProjectId: data.applicationProjectId,
      cityId: data.cityId,
      supervisorId: data.supervisorId || scopeResult.driver?.supervisorId || null,
      referenceNumber: data.referenceNumber,
      amount: data.amount,
      remainingAmount: data.remainingAmount,
      reason: data.reason,
      deductionMonth: data.deductionMonth,
      advanceDate: data.advanceDate,
      status: data.status as never,
      createdById: request.headers.get("x-user-id") || null,
      ...(data.status === "APPROVED"
        ? { approvedById: request.headers.get("x-user-id") || null, approvedAt: new Date() }
        : {}),
    },
  });
  await audit(request, "CREATE_ADVANCE", result.id, null, result);
  return NextResponse.json({ data: result }, { status: 201 });
}
