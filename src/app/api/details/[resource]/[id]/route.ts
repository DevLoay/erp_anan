import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canReadResource, roleFromHeaders } from "@/lib/permissions";

type DetailCard = {
  label: string;
  value: string | number;
  tone?: "emerald" | "amber" | "red" | "blue" | "slate";
};

type DetailRow = {
  label: string;
  value: string | number;
  sub?: string;
};

type DetailTab = {
  key: string;
  title: string;
  cards: DetailCard[];
  rows?: DetailRow[];
};

function numberValue(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function pct(value: unknown) {
  return `${Math.round(numberValue(value) * 10) / 10}%`;
}

function money(value: unknown) {
  return `${Math.round(numberValue(value) * 100) / 100} ر.س`;
}

function dateValue(value: Date | string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toISOString().slice(0, 10);
}

function cityName(city?: { nameAr: string | null; nameEn: string | null } | null) {
  return city?.nameAr || city?.nameEn || "-";
}

async function driverDetails(id: string) {
  const driver = await prisma.driver.findUnique({
    where: { id },
    select: {
      id: true,
      internalCode: true,
      name: true,
      phone: true,
      nationalId: true,
      cityId: true,
      projectId: true,
      supervisorId: true,
      vehicleId: true,
      accountId: true,
      status: true,
      contractType: true,
      housingStatus: true,
      updatedAt: true,
      city: { select: { nameAr: true, nameEn: true } },
      project: { select: { name: true, appName: true } },
      supervisor: { select: { name: true } },
      vehicle: { select: { plateEn: true, plateAr: true, model: true } },
      account: { select: { username: true, appName: true } },
    },
  });
  if (!driver) return null;

  const [
    reportAgg,
    recentReports,
    payrollAgg,
    payrolls,
    advances,
    deductions,
    violations,
    tasks,
    notifications,
    documents,
    contracts,
    housing,
    warnings,
    attendanceAgg,
  ] = await Promise.all([
    prisma.dailyReport.aggregate({
      where: { driverId: id },
      _count: { _all: true },
      _sum: { orders: true, workingHours: true },
      _avg: { onTimeRate: true, cancellationRate: true, rejectionRate: true, workingHours: true },
    }),
    prisma.dailyReport.findMany({ where: { driverId: id }, orderBy: { reportDate: "desc" }, take: 8 }),
    prisma.payroll.aggregate({
      where: { driverId: id },
      _sum: { basicSalary: true, bonus: true, deductions: true, netSalary: true },
      _count: { _all: true },
    }),
    prisma.payroll.findMany({ where: { driverId: id }, orderBy: { month: "desc" }, take: 6 }),
    prisma.advance.findMany({ where: { driverId: id }, select: { id: true, amount: true, remainingAmount: true, reason: true, deductionMonth: true, status: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.deduction.findMany({ where: { driverId: id }, select: { id: true, type: true, amount: true, month: true, status: true, notes: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.violation.findMany({ where: { driverId: id }, select: { id: true, type: true, amount: true, status: true, occurredAt: true, notes: true }, orderBy: { occurredAt: "desc" }, take: 8 }),
    prisma.task.findMany({ where: { driverId: id }, select: { id: true, title: true, description: true, status: true, priority: true, dueDate: true, updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 8 }),
    prisma.notification.findMany({ where: { driverId: id }, orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.driverDocument.findMany({ where: { driverId: id }, select: { id: true, type: true, issueDate: true, expiryDate: true, status: true, fileUrl: true, notes: true, updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 8 }),
    prisma.driverContract.findMany({ where: { driverId: id }, select: { id: true, contractType: true, sponsor: true, startDate: true, endDate: true, status: true, notes: true, updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 4 }),
    prisma.driverHousing.findMany({ where: { driverId: id }, select: { id: true, housingType: true, location: true, monthlyCost: true, status: true, startDate: true, endDate: true, notes: true, updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 4 }),
    prisma.driverWarning.findMany({ where: { driverId: id }, select: { id: true, type: true, severity: true, status: true, issuedAt: true, followUpAt: true, notes: true }, orderBy: { issuedAt: "desc" }, take: 8 }),
    prisma.attendanceRecord.aggregate({
      where: { driverId: id },
      _count: { _all: true },
      _sum: { workingHours: true },
      _avg: { workingHours: true },
    }),
  ]);

  const tabs: DetailTab[] = [
    {
      key: "basic",
      title: "البيانات الأساسية",
      cards: [
        { label: "الكود", value: driver.internalCode },
        { label: "المدينة", value: cityName(driver.city) },
        { label: "المشروع", value: driver.project?.name ?? "-" },
        { label: "المشرف", value: driver.supervisor?.name ?? "-" },
        { label: "الحساب", value: driver.account?.username ?? "-" },
        { label: "السيارة", value: driver.vehicle?.plateEn ?? "-" },
        { label: "الحالة", value: driver.status, tone: driver.status === "ACTIVE" ? "emerald" : "amber" },
        { label: "السكن", value: driver.housingStatus ?? "-" },
      ],
      rows: [
        { label: "الجوال", value: driver.phone ?? "-" },
        { label: "رقم الهوية", value: driver.nationalId ?? "-" },
        { label: "نوع العقد", value: driver.contractType ?? "-" },
        { label: "آخر تحديث", value: dateValue(driver.updatedAt) },
      ],
    },
    {
      key: "performance",
      title: "الأداء",
      cards: [
        { label: "إجمالي الطلبات", value: reportAgg._sum.orders ?? 0, tone: "blue" },
        { label: "ساعات العمل", value: numberValue(reportAgg._sum.workingHours), tone: "blue" },
        { label: "متوسط ساعات اليوم", value: numberValue(reportAgg._avg.workingHours), tone: "slate" },
        { label: "On-Time", value: pct(reportAgg._avg.onTimeRate), tone: numberValue(reportAgg._avg.onTimeRate) >= 99 ? "emerald" : "amber" },
        { label: "Cancellation", value: pct(reportAgg._avg.cancellationRate), tone: numberValue(reportAgg._avg.cancellationRate) > 0 ? "red" : "emerald" },
        { label: "Rejection", value: pct(reportAgg._avg.rejectionRate), tone: numberValue(reportAgg._avg.rejectionRate) > 0 ? "red" : "emerald" },
      ],
      rows: recentReports.map((report) => ({
        label: dateValue(report.reportDate),
        value: report.orders,
        sub: `${numberValue(report.workingHours)} ساعة - On-Time ${pct(report.onTimeRate)}`,
      })),
    },
    {
      key: "finance",
      title: "المالية",
      cards: [
        { label: "الراتب الأساسي", value: money(payrollAgg._sum.basicSalary), tone: "blue" },
        { label: "البونص", value: money(payrollAgg._sum.bonus), tone: "emerald" },
        { label: "خصومات المسير", value: money(payrollAgg._sum.deductions), tone: "red" },
        { label: "صافي الرواتب", value: money(payrollAgg._sum.netSalary), tone: numberValue(payrollAgg._sum.netSalary) >= 0 ? "emerald" : "red" },
        { label: "السلف", value: money(advances.reduce((sum, row) => sum + numberValue(row.amount), 0)), tone: "amber" },
        { label: "الخصومات", value: money(deductions.reduce((sum, row) => sum + numberValue(row.amount), 0)), tone: "red" },
        { label: "المخالفات", value: money(violations.reduce((sum, row) => sum + numberValue(row.amount), 0)), tone: "red" },
      ],
      rows: payrolls.map((row) => ({
        label: row.month,
        value: money(row.netSalary),
        sub: `أساسي ${money(row.basicSalary)} - خصومات ${money(row.deductions)} - ${row.status}`,
      })),
    },
    {
      key: "operations",
      title: "التشغيل والتنبيهات",
      cards: [
        { label: "المهام", value: tasks.length, tone: tasks.length ? "amber" : "emerald" },
        { label: "التنبيهات", value: notifications.length, tone: notifications.length ? "amber" : "emerald" },
        { label: "الإنذارات", value: warnings.length, tone: warnings.length ? "red" : "emerald" },
        { label: "المستندات", value: documents.length, tone: "blue" },
        { label: "العقود", value: contracts.length, tone: "blue" },
        { label: "السكن", value: housing.length, tone: "blue" },
        { label: "سجلات الحضور", value: attendanceAgg._count._all, tone: "slate" },
        { label: "متوسط حضور", value: numberValue(attendanceAgg._avg.workingHours), tone: "slate" },
      ],
      rows: [
        ...tasks.map((row) => ({ label: row.title, value: row.status, sub: row.description ?? undefined })),
        ...notifications.map((row) => ({ label: row.title, value: row.severity, sub: row.body ?? undefined })),
        ...warnings.map((row) => ({ label: row.type, value: row.severity, sub: row.notes ?? undefined })),
      ].slice(0, 10),
    },
  ];

  return { title: driver.name, subtitle: driver.internalCode, tabs };
}

async function supervisorDetails(id: string) {
  const supervisor = await prisma.supervisor.findUnique({
    where: { id },
    include: {
      city: { select: { nameAr: true, nameEn: true } },
      drivers: {
        select: {
          id: true,
          internalCode: true,
          name: true,
          cityId: true,
          projectId: true,
          status: true,
          city: { select: { nameAr: true, nameEn: true } },
          project: { select: { name: true, appName: true } },
          applicationAccounts: {
            take: 1,
            orderBy: { updatedAt: "desc" },
            select: { applicationProject: { select: { name: true } } },
          },
        },
      },
    },
  });
  if (!supervisor) return null;

  const driverIds = supervisor.drivers.map((driver) => driver.id);
  const [reportAgg, tasks, weakDrivers] = await Promise.all([
    prisma.dailyReport.aggregate({
      where: { driverId: { in: driverIds } },
      _count: { _all: true },
      _sum: { orders: true, workingHours: true },
      _avg: { onTimeRate: true, cancellationRate: true, rejectionRate: true },
    }),
    prisma.task.findMany({ where: { supervisorId: id }, select: { id: true, title: true, description: true, status: true, priority: true, dueDate: true, updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 10 }),
    prisma.dailyReport.groupBy({
      by: ["driverId"],
      where: { driverId: { in: driverIds } },
      _sum: { orders: true },
      orderBy: { _sum: { orders: "asc" } },
      take: 8,
    }),
  ]);

  const driverNameById = new Map(supervisor.drivers.map((driver) => [driver.id, driver.name]));
  const tabs: DetailTab[] = [
    {
      key: "overview",
      title: "ملخص المشرف",
      cards: [
        { label: "المدينة", value: cityName(supervisor.city), tone: "blue" },
        { label: "الحالة", value: supervisor.status, tone: supervisor.status === "ACTIVE" ? "emerald" : "amber" },
        { label: "عدد المناديب", value: supervisor.drivers.length, tone: "blue" },
        { label: "مناديب نشطين", value: supervisor.drivers.filter((driver) => driver.status === "ACTIVE").length, tone: "emerald" },
        { label: "طلبات الفريق", value: reportAgg._sum.orders ?? 0, tone: "blue" },
        { label: "ساعات الفريق", value: numberValue(reportAgg._sum.workingHours), tone: "blue" },
        { label: "On-Time الفريق", value: pct(reportAgg._avg.onTimeRate), tone: numberValue(reportAgg._avg.onTimeRate) >= 99 ? "emerald" : "amber" },
      ],
      rows: [
        { label: "الجوال", value: supervisor.phone ?? "-" },
        { label: "البريد", value: supervisor.email ?? "-" },
        { label: "آخر تحديث", value: dateValue(supervisor.updatedAt) },
      ],
    },
    {
      key: "team",
      title: "الفريق",
      cards: [
        { label: "بدون مشروع", value: supervisor.drivers.filter((driver) => !driver.projectId).length, tone: "amber" },
        { label: "بدون مدينة", value: supervisor.drivers.filter((driver) => !driver.cityId).length, tone: "amber" },
        { label: "موقوفين", value: supervisor.drivers.filter((driver) => driver.status !== "ACTIVE").length, tone: "red" },
      ],
      rows: supervisor.drivers.slice(0, 12).map((driver) => ({
        label: driver.name,
        value: driver.internalCode,
        sub: `${cityName(driver.city)} - ${driver.project?.name ?? "بدون مشروع"} - ${driver.status}`,
      })),
    },
    {
      key: "performance",
      title: "الأداء",
      cards: [
        { label: "عدد تقارير الفريق", value: reportAgg._count._all },
        { label: "Cancellation", value: pct(reportAgg._avg.cancellationRate), tone: numberValue(reportAgg._avg.cancellationRate) > 0 ? "red" : "emerald" },
        { label: "Rejection", value: pct(reportAgg._avg.rejectionRate), tone: numberValue(reportAgg._avg.rejectionRate) > 0 ? "red" : "emerald" },
      ],
      rows: weakDrivers.map((row) => ({
        label: driverNameById.get(row.driverId ?? "") ?? "مندوب غير محدد",
        value: row._sum.orders ?? 0,
        sub: "أقل طلبات داخل فريق المشرف",
      })),
    },
    {
      key: "tasks",
      title: "المهام",
      cards: [
        { label: "إجمالي المهام", value: tasks.length, tone: tasks.length ? "amber" : "emerald" },
        { label: "مفتوحة", value: tasks.filter((task) => task.status !== "APPROVED" && task.status !== "LOCKED").length, tone: "amber" },
      ],
      rows: tasks.map((task) => ({ label: task.title, value: task.status, sub: task.description ?? undefined })),
    },
  ];

  return { title: supervisor.name, subtitle: cityName(supervisor.city), tabs };
}

export async function GET(request: Request, context: { params: Promise<{ resource: string; id: string }> }) {
  const { resource, id } = await context.params;
  const role = roleFromHeaders(request.headers);

  if (resource === "drivers") {
    if (!canReadResource(role, "drivers")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const data = await driverDetails(id);
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data });
  }

  if (resource === "supervisors") {
    if (!canReadResource(role, "supervisors")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const data = await supervisorDetails(id);
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data });
  }

  return NextResponse.json({ error: "Details are not available for this resource yet" }, { status: 404 });
}
