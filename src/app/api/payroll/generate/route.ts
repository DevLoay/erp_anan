import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canWriteResource, roleFromHeaders } from "@/lib/permissions";
import { getRiderKpiReport, getSystemRules, type ReportFilters } from "@/lib/reporting";
import { generateKeetaPayroll, isKeetaPayrollRequest } from "@/lib/payroll/keetaPayroll";

type GenerateBody = Partial<ReportFilters> & {
  month?: string;
};

function numberValue(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function moneyRule(rules: Record<string, unknown>, key: string) {
  return numberValue(rules[key]);
}

function mapAmounts<T extends { driverId: string; amount: unknown }>(items: T[]) {
  const map = new Map<string, number>();
  for (const item of items) {
    map.set(item.driverId, (map.get(item.driverId) ?? 0) + numberValue(item.amount));
  }
  return map;
}

export async function POST(request: Request) {
  const role = roleFromHeaders(request.headers);
  if (!canWriteResource(role, "payroll")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as GenerateBody;
  const filters: ReportFilters = {
    month: body.month || "2026-04",
    dateFrom: body.dateFrom || `${body.month || "2026-04"}-01`,
    dateTo: body.dateTo || new Date(Date.UTC(Number((body.month || "2026-04").slice(0, 4)), Number((body.month || "2026-04").slice(5, 7)), 0)).toISOString().slice(0, 10),
    appName: body.appName || "",
    cityId: body.cityId || "",
    projectId: body.projectId || "",
    supervisorId: body.supervisorId || "",
    driverId: body.driverId || "",
    q: body.q || "",
    status: "",
  };

  const [legacyProject, applicationProject] = filters.projectId
    ? await Promise.all([
        prisma.project.findUnique({ where: { id: filters.projectId }, select: { name: true, appName: true } }).catch(() => null),
        prisma.applicationProject
          .findFirst({
            where: { OR: [{ id: filters.projectId }, { projectId: filters.projectId }] },
            include: { application: { select: { name: true, code: true } } },
          })
          .catch(() => null),
      ])
    : [null, null];

  if (
    isKeetaPayrollRequest({
      appName: filters.appName || legacyProject?.appName || applicationProject?.application.name || applicationProject?.application.code,
      projectName: legacyProject?.name || applicationProject?.name,
      projectId: filters.projectId,
    })
  ) {
    const result = await generateKeetaPayroll({
      month: filters.month,
      cityId: filters.cityId || undefined,
      requestedBy: "Admin",
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error, details: result.details }, { status: result.status });
    }

    return NextResponse.json({ data: result.data });
  }

  const [settings, kpi] = await Promise.all([getSystemRules(), getRiderKpiReport(filters)]);
  const driverIds = kpi.rows.map((row) => row.driverId).filter((id) => id && !id.startsWith("unassigned:"));

  if (!driverIds.length) {
    return NextResponse.json({
      data: {
        month: filters.month,
        created: 0,
        updated: 0,
        skippedLocked: 0,
        skippedNoDriver: 0,
        message: "لا توجد بيانات KPI صالحة لتوليد المسير.",
      },
    });
  }

  const [drivers, advances, deductions] = await Promise.all([
    prisma.driver.findMany({
      where: { id: { in: driverIds } },
      select: { id: true, projectId: true, vehicleId: true, housingStatus: true },
    }),
    prisma.advance.findMany({
      where: { driverId: { in: driverIds }, deductionMonth: filters.month, status: "APPROVED" },
      select: { driverId: true, amount: true },
    }),
    prisma.deduction.findMany({
      where: { driverId: { in: driverIds }, month: filters.month, status: "APPROVED" },
      select: { driverId: true, amount: true },
    }),
  ]);

  const driverMap = new Map(drivers.map((driver) => [driver.id, driver]));
  const advanceMap = mapAmounts(advances);
  const deductionMap = mapAmounts(deductions);
  const payrollRules = settings.payrollRules as Record<string, unknown>;

  let created = 0;
  let updated = 0;
  let skippedLocked = 0;
  let skippedNoDriver = 0;
  let totalNet = 0;

  for (const row of kpi.rows) {
    if (!driverIds.includes(row.driverId)) {
      skippedNoDriver += 1;
      continue;
    }

    const driver = driverMap.get(row.driverId);
    if (!driver) {
      skippedNoDriver += 1;
      continue;
    }

    const existing = await prisma.payroll.findUnique({
      where: { driverId_month: { driverId: row.driverId, month: filters.month } },
    });

    if (existing && ["APPROVED", "PAID", "LOCKED"].includes(existing.status)) {
      skippedLocked += 1;
      continue;
    }

    const basicSalary = moneyRule(payrollRules, "basicSalary") || 0;
    const targetBonus = row.valid ? moneyRule(payrollRules, "targetBonus") : 0;
    const extraOrderBonus = Math.max(0, row.orders - row.target.monthlyOrders) * moneyRule(payrollRules, "extraOrderBonus");
    const vehicleDeduction = driver.vehicleId ? moneyRule(payrollRules, "vehicleRentDeduction") : 0;
    const housingDeduction = String(driver.housingStatus ?? "").toLowerCase().includes("company")
      ? moneyRule(payrollRules, "housingDeduction")
      : 0;
    const approvedAdvances = advanceMap.get(row.driverId) ?? 0;
    const approvedDeductions = deductionMap.get(row.driverId) ?? 0;
    const totalDeductions = vehicleDeduction + housingDeduction + approvedAdvances + approvedDeductions;
    const bonus = targetBonus + extraOrderBonus;
    const netSalary = basicSalary + bonus - totalDeductions;
    totalNet += netSalary;

    const data = {
      projectId: row.projectId || driver.projectId || null,
      basicSalary,
      bonus,
      deductions: totalDeductions,
      netSalary,
      status: "DRAFT" as const,
      lockedAt: null,
    };

    if (existing) {
      await prisma.payroll.update({
        where: { id: existing.id },
        data,
      });
      updated += 1;
    } else {
      await prisma.payroll.create({
        data: {
          driverId: row.driverId,
          month: filters.month,
          ...data,
        },
      });
      created += 1;
    }
  }

  await prisma.auditLog.create({
    data: {
      user: "Admin",
      action: "GENERATE_PAYROLL",
      entityType: "Payroll",
      entityId: filters.month,
      newValue: {
        filters,
        created,
        updated,
        skippedLocked,
        skippedNoDriver,
        totalNet,
      },
    },
  });

  return NextResponse.json({
    data: {
      month: filters.month,
      created,
      updated,
      skippedLocked,
      skippedNoDriver,
      totalNet,
    },
  });
}
