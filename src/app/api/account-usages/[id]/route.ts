import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canWriteResource, roleFromHeaders } from "@/lib/permissions";
import { accountUsageType } from "@/lib/application-accounts/accountUsage";

function jsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? null));
}

async function audit(request: Request, action: string, entityId: string, before: unknown, after: unknown) {
  await prisma.auditLog.create({
    data: {
      userId: request.headers.get("x-user-id") || undefined,
      user: request.headers.get("x-user-email") || undefined,
      action,
      entityType: "AccountUsage",
      entityId,
      before: jsonValue(before),
      after: jsonValue(after),
      oldValue: jsonValue(before),
      newValue: jsonValue(after),
    },
  }).catch(() => null);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const role = roleFromHeaders(request.headers);
  if (!canWriteResource(role, "application-accounts")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action || "update");
  const before = await prisma.accountUsage.findUnique({
    where: { id },
    include: {
      application: { select: { name: true } },
      applicationAccount: { select: { driverId: true, appName: true } },
    },
  });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Prisma.AccountUsageUpdateInput = {};
  if (action === "approve") {
    data.status = "APPROVED";
    data.approvedAt = new Date();
    data.approvedBy = request.headers.get("x-user-id") ? { connect: { id: request.headers.get("x-user-id") || "" } } : undefined;
  } else if (action === "reject") {
    data.status = "REJECTED";
  } else if (action === "archive") {
    data.status = "ARCHIVED";
  } else if (action === "assignActualWorker") {
    const actualDriverId = String(body.actualDriverId || "").trim();
    if (!actualDriverId) return NextResponse.json({ error: "actualDriverId is required" }, { status: 400 });
    data.actualDriver = { connect: { id: actualDriverId } };
    data.usageType = accountUsageType({
      appName: before.application?.name || before.applicationAccount.appName,
      ownerDriverId: before.ownerDriverId || before.applicationAccount.driverId,
      actualDriverId,
    });
    data.status = before.application?.name?.toLowerCase().includes("keeta") && before.ownerDriverId && before.ownerDriverId !== actualDriverId ? "PENDING" : "APPROVED";
  } else if (action === "note") {
    data.reviewReason = String(body.reviewReason || before.reviewReason || "").trim() || null;
  } else {
    if (typeof body.status === "string") data.status = body.status;
    if (typeof body.usageType === "string") data.usageType = body.usageType;
    if (typeof body.reviewReason === "string") data.reviewReason = body.reviewReason || null;
  }

  const updated = await prisma.accountUsage.update({ where: { id }, data });
  await audit(request, `ACCOUNT_USAGE_${action.toUpperCase()}`, id, before, updated);
  return NextResponse.json({ data: updated });
}
