import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { defaultPayrollRules, defaultRulesByProject, getSystemRules } from "@/lib/reporting";
import { canWriteResource, roleFromHeaders } from "@/lib/permissions";

export async function GET() {
  const rules = await getSystemRules();
  return NextResponse.json(rules);
}

export async function PUT(request: Request) {
  const role = roleFromHeaders(request.headers);
  if (!canWriteResource(role, "system-settings")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as {
    kpiTargets?: unknown;
    payrollRules?: unknown;
  };

  const [kpiTargets, payrollRules] = await Promise.all([
    prisma.systemSetting.upsert({
      where: { key: "kpiTargets" },
      create: {
        key: "kpiTargets",
        value: body.kpiTargets ?? { default: defaultRulesByProject.Keeta, projects: defaultRulesByProject },
        updatedBy: "Admin",
      },
      update: {
        value: body.kpiTargets ?? { default: defaultRulesByProject.Keeta, projects: defaultRulesByProject },
        updatedBy: "Admin",
      },
    }),
    prisma.systemSetting.upsert({
      where: { key: "payrollRules" },
      create: {
        key: "payrollRules",
        value: body.payrollRules ?? defaultPayrollRules,
        updatedBy: "Admin",
      },
      update: {
        value: body.payrollRules ?? defaultPayrollRules,
        updatedBy: "Admin",
      },
    }),
  ]);

  return NextResponse.json({ data: { kpiTargets, payrollRules } });
}
