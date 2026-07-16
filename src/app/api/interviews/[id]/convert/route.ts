import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAccessScope } from "@/lib/auth/accessScope";
import { canWriteResource, roleFromHeaders } from "@/lib/permissions";
import { getInterviewsPageData, resolveInterviewFilters } from "@/lib/interviews/getInterviewsPageData";

function jsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? null));
}

async function hydrateRow(id: string, request: Request) {
  const data = await getInterviewsPageData(resolveInterviewFilters({}), request.headers);
  return data.rows.find((row) => row.id === id) || null;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const role = roleFromHeaders(request.headers);
  if (!canWriteResource(role, "interviews") || !canWriteResource(role, "drivers")) {
    return NextResponse.json({ error: "تحويل المقابلة لمندوب يحتاج صلاحية المقابلات والمناديب." }, { status: 403 });
  }
  const scope = await getAccessScope(request.headers);
  const { id } = await context.params;
  const interview = await prisma.interview.findUnique({ where: { id } });
  if (!interview) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!scope.isGlobal && interview.cityId && scope.cityIds.length && !scope.cityIds.includes(interview.cityId)) {
    return NextResponse.json({ error: "ليس لديك صلاحية على هذه المدينة." }, { status: 403 });
  }
  if (interview.convertedDriverId) {
    const row = await hydrateRow(id, request);
    return NextResponse.json({ data: row || interview, message: "تم تحويل هذه المقابلة سابقًا." });
  }

  const timestamp = Date.now().toString().slice(-8);
  const internalCode = `INT-${timestamp}`;
  const result = await prisma.$transaction(async (tx) => {
    const driver = await tx.driver.create({
      data: {
        internalCode,
        driverCode: internalCode,
        name: interview.candidateName,
        actualName: interview.candidateName,
        phone: interview.phone,
        mobile: interview.phone,
        cityId: interview.cityId,
        projectId: interview.projectId,
        status: "ACTIVE",
        source: "interview",
        joinDate: new Date(),
      },
    });
    const updated = await tx.interview.update({
      where: { id },
      data: { status: "APPROVED", convertedDriverId: driver.id },
    });
    await tx.auditLog
      .create({
        data: {
          userId: scope.userId || request.headers.get("x-user-id") || undefined,
          user: request.headers.get("x-user-email") || undefined,
          action: "INTERVIEW_CONVERTED_TO_DRIVER",
          entityType: "Interview",
          entityId: id,
          before: jsonValue(interview),
          after: jsonValue({ interview: updated, driver }),
          oldValue: jsonValue(interview),
          newValue: jsonValue({ interview: updated, driver }),
        },
      })
      .catch(() => null);
    return { driver, interview: updated };
  });

  const row = await hydrateRow(id, request);
  return NextResponse.json({ data: row || result.interview, driver: result.driver }, { status: 201 });
}
