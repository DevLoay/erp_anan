import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canWriteResource, roleFromHeaders } from "@/lib/permissions";

type PreviewRow = {
  rowNumber: number;
  status: string;
  severity: string;
  data: Record<string, unknown>;
  warnings?: string[];
};

type ConfirmBody = {
  summary: Record<string, string | number | boolean>;
  rows: PreviewRow[];
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function numberValue(value: unknown) {
  const numeric = Number(String(value ?? "0").replace("%", "").replace(",", "").trim());
  return Number.isFinite(numeric) ? numeric : 0;
}

function parseDate(value: unknown, fallbackMonth: string) {
  const raw = text(value);
  if (raw) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date(`${fallbackMonth || "2026-04"}-01T00:00:00.000Z`);
}

function monthFromDate(date: Date, fallbackMonth: string) {
  if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 7);
  return fallbackMonth || "2026-04";
}

async function findCity(raw: string) {
  if (!raw) return null;
  return prisma.city.findFirst({
    where: {
      OR: [
        { nameAr: { contains: raw, mode: "insensitive" } },
        { nameEn: { contains: raw, mode: "insensitive" } },
      ],
    },
  });
}

async function findProject(raw: string) {
  if (!raw) return null;
  return prisma.project.findFirst({
    where: {
      OR: [
        { name: { contains: raw, mode: "insensitive" } },
        { appName: { contains: raw, mode: "insensitive" } },
      ],
    },
  });
}

async function findDriver(raw: string) {
  if (!raw) return null;
  return prisma.driver.findFirst({
    where: {
      OR: [
        { id: raw },
        { internalCode: raw },
        { nationalId: raw },
        { name: { contains: raw, mode: "insensitive" } },
      ],
    },
    select: { id: true, internalCode: true, name: true, nationalId: true, cityId: true, projectId: true, supervisorId: true },
  });
}

export async function POST(request: Request) {
  const role = roleFromHeaders(request.headers);
  if (!canWriteResource(role, "import-batches")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as ConfirmBody;
  const summary = body.summary ?? {};
  const rows = body.rows ?? [];
  const fileName = text(summary.fileName) || "imported-file";
  const importType = text(summary.importType) || "Application Report";
  const appNameFallback = text(summary.project) || "";
  const fallbackMonth = text(summary.month) || "2026-04";

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: { rowNumber: number; message: string }[] = [];

  const uploadedReport = await prisma.uploadedReport.create({
    data: {
      fileName,
      importType,
      appName: appNameFallback || null,
      month: fallbackMonth,
      status: "PENDING",
      rowsCount: rows.length,
      uploadedBy: "Admin",
    },
  });

  for (const row of rows) {
    if (row.severity === "error") {
      skipped += 1;
      errors.push({ rowNumber: row.rowNumber, message: row.warnings?.join(", ") || "صف غير صالح" });
      continue;
    }

    const data = row.data ?? {};
    const driverKey = text(data["Rider ID"]) || text(data["Driver ID"]) || text(data.riderId);
    const cityRaw = text(data.City) || text(data.city);
    const projectRaw = text(data.Project) || text(data.project) || text(data.App) || text(data.appName) || appNameFallback;
    const reportDate = parseDate(data.Date ?? data.date, fallbackMonth);
    const month = monthFromDate(reportDate, fallbackMonth);
    const appName = projectRaw || appNameFallback || null;

    const [driver, city, project] = await Promise.all([findDriver(driverKey), findCity(cityRaw), findProject(projectRaw)]);

    if (!driver && !driverKey) {
      skipped += 1;
      errors.push({ rowNumber: row.rowNumber, message: "لا يوجد Rider ID صالح" });
      continue;
    }

    const existing = await prisma.dailyReport.findFirst({
      where: {
        driverId: driver?.id ?? null,
        reportDate,
        appName,
      },
    });

    const reportData = {
      reportDate,
      month,
      driverId: driver?.id ?? null,
      cityId: driver?.cityId ?? city?.id ?? null,
      projectId: driver?.projectId ?? project?.id ?? null,
      appName,
      orders: Math.round(numberValue(data.Orders ?? data.orders)),
      workingHours: numberValue(data["Working Hours"] ?? data.workingHours),
      onTimeRate: numberValue(data["On-Time %"] ?? data.onTimeRate),
      cancellationRate: numberValue(data["Cancellation %"] ?? data.cancellationRate),
      rejectionRate: numberValue(data["Rejection %"] ?? data.rejectionRate),
    };

    if (existing) {
      await prisma.dailyReport.update({ where: { id: existing.id }, data: reportData });
      updated += 1;
    } else {
      await prisma.dailyReport.create({ data: reportData });
      created += 1;
    }
  }

  const batch = await prisma.importBatch.create({
    data: {
      fileName,
      importType,
      appName: appNameFallback || null,
      month: fallbackMonth,
      status: errors.length ? "PENDING" : "APPROVED",
      rowsFound: rows.length,
      rowsImported: created + updated,
      rowsSkipped: skipped,
      errors,
      createdBy: "Admin",
    },
  });

  await prisma.uploadedReport.update({
    where: { id: uploadedReport.id },
    data: { status: errors.length ? "PENDING" : "APPROVED" },
  });

  await prisma.auditLog.create({
    data: {
      user: "Admin",
      action: "CONFIRM_IMPORT",
      entityType: "ImportBatch",
      entityId: batch.id,
      newValue: { fileName, importType, created, updated, skipped, errors: errors.length },
    },
  });

  return NextResponse.json({
    data: {
      batchId: batch.id,
      uploadedReportId: uploadedReport.id,
      created,
      updated,
      skipped,
      errors,
    },
  });
}
