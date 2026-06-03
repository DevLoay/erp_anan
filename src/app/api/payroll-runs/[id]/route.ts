import { NextResponse } from "next/server";
import { PayrollStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canWriteResource, roleFromHeaders } from "@/lib/permissions";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type PatchBody = {
  status?: PayrollStatus;
  overrideReason?: string;
};

function isKeetaRun(run: Awaited<ReturnType<typeof loadRun>>) {
  const text = `${run?.application?.name ?? ""} ${run?.application?.code ?? ""} ${run?.applicationProject?.name ?? ""} ${run?.applicationProject?.code ?? ""}`.toLowerCase();
  return text.includes("keeta");
}

async function loadRun(id: string) {
  return prisma.payrollRun.findUnique({
    where: { id },
    include: {
      application: { select: { name: true, code: true } },
      applicationProject: { select: { name: true, code: true } },
      items: { select: { id: true, driverId: true, salaryPlanId: true, relationshipType: true, level: true, notes: true } },
    },
  });
}

function keetaApprovalProblems(run: NonNullable<Awaited<ReturnType<typeof loadRun>>>) {
  const problems: string[] = [];
  for (const item of run.items) {
    if (!item.driverId) problems.push(`${item.id}: لا يوجد driverId.`);
    if (!item.salaryPlanId) problems.push(`${item.id}: لا توجد Payroll Plan مناسبة.`);
    if (!item.relationshipType) problems.push(`${item.id}: لا يوجد نوع علاقة.`);
    if (!item.level) problems.push(`${item.id}: لا يوجد Level.`);
    if (item.notes?.includes("لا يوجد Rank")) problems.push(`${item.id}: لا يوجد Rank معتمد.`);
    if (item.notes?.includes("لا يوجد تقرير أداء")) problems.push(`${item.id}: لا يوجد تقرير أداء معتمد.`);
  }
  return problems;
}

export async function PATCH(request: Request, context: RouteContext) {
  const role = roleFromHeaders(request.headers);
  if (!canWriteResource(role, "payroll")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as PatchBody;
  const status = body.status || PayrollStatus.UNDER_REVIEW;
  const adminOnlyStatuses: PayrollStatus[] = [PayrollStatus.APPROVED, PayrollStatus.PAID, PayrollStatus.LOCKED];
  if (adminOnlyStatuses.includes(status) && role !== "ADMIN") {
    return NextResponse.json({ error: "هذه العملية حساسة ومسموح بها للمدير فقط." }, { status: 403 });
  }
  const run = await loadRun(id);
  if (!run) return NextResponse.json({ error: "PayrollRun not found" }, { status: 404 });

  if ((run.status === PayrollStatus.PAID || run.status === PayrollStatus.LOCKED) && status !== run.status) {
    return NextResponse.json({ error: "المسير مدفوع أو مقفل ولا يمكن تعديله." }, { status: 409 });
  }

  if (status === PayrollStatus.APPROVED && isKeetaRun(run)) {
    const problems = keetaApprovalProblems(run);
    if (problems.length) {
      await prisma.auditLog.create({
        data: {
          user: "Admin",
          action: "BLOCK_KEETA_PAYROLL_APPROVAL",
          entityType: "PayrollRun",
          entityId: run.id,
          newValue: { problems: problems.slice(0, 100), overrideReason: body.overrideReason || "" },
        },
      });
      return NextResponse.json({ error: "لا يمكن اعتماد مسير Keeta قبل حل مشاكل الخطة والربط.", details: { problems } }, { status: 422 });
    }
  }

  const updated = await prisma.payrollRun.update({
    where: { id },
    data: {
      status,
      approvedAt: status === PayrollStatus.APPROVED ? new Date() : run.approvedAt,
    },
  });

  await prisma.auditLog.create({
    data: {
      user: "Admin",
      action: "UPDATE_PAYROLL_RUN_STATUS",
      entityType: "PayrollRun",
      entityId: run.id,
      oldValue: { status: run.status },
      newValue: { status, overrideReason: body.overrideReason || "" },
    },
  });

  return NextResponse.json({ data: updated });
}
