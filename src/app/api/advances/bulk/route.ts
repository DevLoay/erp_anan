import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canWriteResource, roleFromHeaders } from "@/lib/permissions";

function idsFrom(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function jsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export async function PATCH(request: Request) {
  const role = roleFromHeaders(request.headers);
  if (!canWriteResource(role, "advances")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json()) as Record<string, unknown>;
  const ids = idsFrom(body.ids ?? body.advanceIds);
  const action = String(body.action ?? "").trim();
  if (!ids.length) return NextResponse.json({ error: "اختار سلفة واحدة على الأقل." }, { status: 400 });
  if (!["approve", "reject", "cancel"].includes(action)) return NextResponse.json({ error: "إجراء غير مدعوم." }, { status: 400 });

  const protectedRows = await prisma.advance.count({
    where: {
      id: { in: ids },
      OR: [{ isDeducted: true }, { payrollItemId: { not: null } }, { deductedPayrollRunId: { not: null } }, { status: "DEDUCTED" as never }],
    },
  });
  if (protectedRows) return NextResponse.json({ error: "يوجد سلف مرتبطة بمسير أو تم خصمها، لا يمكن تغييرها جماعيًا." }, { status: 409 });

  const nextStatus = action === "approve" ? "APPROVED" : action === "reject" ? "REJECTED" : "CANCELLED";
  const before = await prisma.advance.findMany({ where: { id: { in: ids } } });
  const result = await prisma.advance.updateMany({
    where: { id: { in: ids } },
    data: {
      status: nextStatus as never,
      ...(nextStatus === "APPROVED" ? { approvedById: request.headers.get("x-user-id") || null, approvedAt: new Date() } : {}),
    },
  });
  await prisma.auditLog
    .create({
      data: {
        userId: request.headers.get("x-user-id") || undefined,
        user: request.headers.get("x-user-email") || undefined,
        action: `BULK_${nextStatus}_ADVANCES`,
        entityType: "advances",
        entityId: ids.join(","),
        before: jsonValue(before),
        after: jsonValue({ count: result.count, ids, status: nextStatus }),
      },
    })
    .catch(() => null);

  return NextResponse.json({ data: { count: result.count, status: nextStatus } });
}
