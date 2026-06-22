import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canWriteResource, roleFromHeaders } from "@/lib/permissions";

const validStatuses = new Set(["PENDING", "APPROVED", "REJECTED", "DEDUCTED", "PARTIALLY_DEDUCTED", "CANCELLED", "LOCKED"]);

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

function jsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? null));
}

async function audit(request: Request, action: string, entityId: string, before: unknown, after: unknown) {
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

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const role = roleFromHeaders(request.headers);
  if (!canWriteResource(role, "advances")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const before = await prisma.advance.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "السلفة غير موجودة." }, { status: 404 });
  if (before.isDeducted || before.payrollItemId || before.deductedPayrollRunId || String(before.status) === "DEDUCTED") {
    return NextResponse.json({ error: "لا يمكن تعديل سلفة تم خصمها أو ربطها بمسير." }, { status: 409 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const status = text(body.status || before.status).toUpperCase();
  if (!validStatuses.has(status)) return NextResponse.json({ error: "حالة السلفة غير صحيحة." }, { status: 400 });
  const amount = body.amount === undefined || body.amount === "" ? undefined : numberValue(body.amount);
  if (amount !== undefined && amount <= 0) return NextResponse.json({ error: "قيمة السلفة يجب أن تكون أكبر من صفر." }, { status: 400 });
  const deductionMonth = body.deductionMonth === undefined ? undefined : monthValue(body.deductionMonth);
  if (body.deductionMonth !== undefined && !deductionMonth) return NextResponse.json({ error: "شهر الخصم يجب أن يكون بصيغة YYYY-MM." }, { status: 400 });
  const advanceDate = body.advanceDate === undefined ? undefined : dateValue(body.advanceDate);
  const nextAdvanceDate = advanceDate || undefined;
  if (body.advanceDate !== undefined && !advanceDate) return NextResponse.json({ error: "تاريخ السلفة غير صحيح." }, { status: 400 });

  const updateData: Prisma.AdvanceUncheckedUpdateInput = {
    ...(body.driverId !== undefined ? { driverId: text(body.driverId) } : {}),
    ...(body.applicationProjectId !== undefined ? { applicationProjectId: text(body.applicationProjectId) || null } : {}),
    ...(body.cityId !== undefined ? { cityId: text(body.cityId) || null } : {}),
    ...(body.supervisorId !== undefined ? { supervisorId: text(body.supervisorId) || null } : {}),
    ...(body.referenceNumber !== undefined ? { referenceNumber: text(body.referenceNumber) || null } : {}),
    ...(amount !== undefined ? { amount, remainingAmount: numberValue(body.remainingAmount ?? amount) } : {}),
    ...(body.reason !== undefined || body.note !== undefined ? { reason: text(body.reason ?? body.note) || null } : {}),
    ...(deductionMonth !== undefined ? { deductionMonth } : {}),
    ...(nextAdvanceDate !== undefined ? { advanceDate: nextAdvanceDate } : {}),
    status: status as never,
    ...(status === "APPROVED" && String(before.status) !== "APPROVED"
      ? { approvedById: request.headers.get("x-user-id") || null, approvedAt: new Date() }
      : {}),
  };

  const data = await prisma.advance.update({
    where: { id },
    data: updateData,
  });
  await audit(request, "UPDATE_ADVANCE", id, before, data);
  return NextResponse.json({ data });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const role = roleFromHeaders(request.headers);
  if (role !== "ADMIN") return NextResponse.json({ error: "الحذف يحتاج صلاحية المدير." }, { status: 403 });

  const { id } = await context.params;
  const before = await prisma.advance.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "السلفة غير موجودة." }, { status: 404 });

  if (before.isDeducted || before.payrollItemId || before.deductedPayrollRunId || String(before.status) === "DEDUCTED") {
    const data = await prisma.advance.update({ where: { id }, data: { status: "CANCELLED" as never } });
    await audit(request, "CANCEL_ADVANCE_LINKED_TO_PAYROLL", id, before, data);
    return NextResponse.json({ data, message: "السلفة مرتبطة بمسير، تم إلغاؤها بدل حذفها." });
  }

  const data = await prisma.advance.delete({ where: { id } });
  await audit(request, "DELETE_ADVANCE", id, before, data);
  return NextResponse.json({ data });
}
