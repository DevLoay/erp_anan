import { NextResponse } from "next/server";
import { RecordStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canWriteResource, roleFromHeaders } from "@/lib/permissions";
import { monthDateRange, upsertAccountUsage, accountUsageType } from "@/lib/application-accounts/accountUsage";

function jsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? null));
}

async function audit(request: Request, action: string, entityId: string, before: unknown, after: unknown) {
  await prisma.auditLog.create({
    data: {
      userId: request.headers.get("x-user-id") || undefined,
      user: request.headers.get("x-user-email") || undefined,
      action,
      entityType: "ApplicationAccount",
      entityId,
      before: jsonValue(before),
      after: jsonValue(after),
      oldValue: jsonValue(before),
      newValue: jsonValue(after),
    },
  }).catch(() => null);
}

async function linkedRecordsCount(accountId: string) {
  const counts = await Promise.all([
    prisma.payrollItem.count({ where: { applicationAccountId: accountId } }),
    prisma.applicationImportRow.count({ where: { applicationAccountId: accountId } }),
    prisma.keetaRankRecord.count({ where: { applicationAccountId: accountId } }),
    prisma.keetaPerformanceRecord.count({ where: { applicationAccountId: accountId } }),
    prisma.keetaInvoiceRecord.count({ where: { applicationAccountId: accountId } }),
    prisma.keetaInvoiceDetailRecord.count({ where: { applicationAccountId: accountId } }),
    prisma.hungerStationDailyPerformanceRecord.count({ where: { applicationAccountId: accountId } }),
    prisma.hungerStationInvoiceRecord.count({ where: { applicationAccountId: accountId } }),
    prisma.hungerStationAccountUsage.count({ where: { applicationAccountId: accountId } }),
    prisma.accountUsage.count({ where: { applicationAccountId: accountId } }),
  ]);
  return counts.reduce((sum, count) => sum + count, 0);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const role = roleFromHeaders(request.headers);
  if (!canWriteResource(role, "application-accounts")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action || "update");
  const before = await prisma.applicationAccount.findUnique({
    where: { id },
    include: { application: true, applicationProject: true, city: true, driver: true },
  });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (action === "assignActualWorker") {
    const actualDriverId = String(body.actualDriverId || "").trim();
    const month = String(body.month || new Date().toISOString().slice(0, 7)).trim();
    if (!actualDriverId) return NextResponse.json({ error: "actualDriverId is required" }, { status: 400 });
    const { start, end } = monthDateRange(month);
    const usage = await upsertAccountUsage(prisma, {
      applicationAccountId: id,
      applicationId: before.applicationId,
      applicationProjectId: before.applicationProjectId,
      cityId: before.cityId,
      ownerDriverId: before.driverId,
      actualDriverId,
      month,
      dateFrom: start,
      dateTo: end,
      source: "MANUAL_REVIEW",
      status: before.application?.name.toLowerCase().includes("keeta") && before.driverId !== actualDriverId ? "PENDING" : "APPROVED",
      usageType: accountUsageType({ appName: before.application?.name || before.appName, ownerDriverId: before.driverId, actualDriverId }),
      reviewReason: String(body.reviewReason || "تم تحديد العامل الفعلي يدويًا.").trim(),
      appName: before.application?.name || before.appName,
      rawData: { action: "assignActualWorker", accountId: id } as Record<string, string>,
    });
    await audit(request, "APPLICATION_ACCOUNT_ASSIGN_ACTUAL_WORKER", id, before, usage);
    return NextResponse.json({ data: usage });
  }

  if (action === "safeDelete") {
    const linkedRecords = await linkedRecordsCount(id);
    if (linkedRecords > 0) {
      const updated = await prisma.applicationAccount.update({
        where: { id },
        data: {
          status: RecordStatus.INACTIVE,
          needsReview: true,
          unmatchedReason: `safe_delete_blocked:${linkedRecords}`,
        },
      });
      await audit(request, "APPLICATION_ACCOUNT_SAFE_DELETE_BLOCKED", id, before, updated);
      return NextResponse.json({ data: updated, blocked: true, linkedRecords });
    }
    const deleted = await prisma.applicationAccount.delete({ where: { id } });
    await audit(request, "APPLICATION_ACCOUNT_SAFE_DELETE", id, before, deleted);
    return NextResponse.json({ data: deleted, deleted: true });
  }

  const data: Record<string, unknown> = {};
  if (action === "suspend" || action === "archive") {
    data.status = RecordStatus.INACTIVE;
    data.needsReview = true;
    data.unmatchedReason = action === "archive" ? "archived_account" : "suspended_account";
  } else if (action === "reactivate") {
    data.status = RecordStatus.ACTIVE;
    data.needsReview = Boolean(!before.driverId || !before.applicationProjectId || !before.cityId);
    data.unmatchedReason = before.unmatchedReason === "suspended_account" || before.unmatchedReason === "archived_account" ? null : before.unmatchedReason;
  } else if (action === "unlink") {
    data.driverId = null;
    data.isEmpty = true;
    data.needsReview = true;
    data.unmatchedReason = "missing_driver";
    data.linkedAt = null;
  } else if (action === "link") {
    const driverId = String(body.driverId || "").trim();
    if (!driverId) return NextResponse.json({ error: "driverId is required" }, { status: 400 });
    data.driverId = driverId;
    data.isEmpty = false;
    data.linkedAt = new Date();
    data.needsReview = Boolean(!before.applicationProjectId || !before.cityId);
    data.unmatchedReason = !before.applicationProjectId ? "missing_application_project" : !before.cityId ? "missing_city" : null;
  } else if (action === "sendReview") {
    data.needsReview = true;
    data.unmatchedReason = String(body.reviewReason || before.unmatchedReason || "manual_review").trim();
  } else if (action === "setPrimary") {
    const driverId = String(body.driverId || before.driverId || "").trim();
    if (!driverId) return NextResponse.json({ error: "لا يمكن جعله حسابًا رئيسيًا بدون مندوب مرتبط." }, { status: 400 });
    const driver = await prisma.driver.update({ where: { id: driverId }, data: { accountId: id } });
    await audit(request, "APPLICATION_ACCOUNT_SET_PRIMARY", id, before, driver);
    return NextResponse.json({ data: driver });
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const updated = await prisma.applicationAccount.update({ where: { id }, data });
  await audit(request, `APPLICATION_ACCOUNT_${action.toUpperCase()}`, id, before, updated);
  return NextResponse.json({ data: updated });
}
