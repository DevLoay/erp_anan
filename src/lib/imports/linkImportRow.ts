import { Prisma, RecordStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function json(value: unknown) {
  if (value === undefined || value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function firstText(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = text(record[key]);
    if (value) return value;
  }
  return "";
}

async function uniqueAccountUsername(tx: Prisma.TransactionClient, preferred: string, scopeKey?: string | null, existingId?: string | null) {
  const base = preferred || `account-${scopeKey || "import"}`;
  const current = await tx.applicationAccount.findUnique({ where: { username: base }, select: { id: true } });
  if (!current || current.id === existingId) return base;

  const suffix = (scopeKey || "scoped").replace(/[^a-zA-Z0-9_-]/g, "").slice(-8) || "scoped";
  const scoped = `${base}-${suffix}`;
  const scopedCurrent = await tx.applicationAccount.findUnique({ where: { username: scoped }, select: { id: true } });
  if (!scopedCurrent || scopedCurrent.id === existingId) return scoped;
  return `${base}-${suffix}-${Date.now().toString(36)}`;
}

function numberValue(value: unknown, fallback = 0) {
  const raw = text(value).replace(/,/g, "").replace("%", "");
  if (!raw) return fallback;
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function intValue(value: unknown, fallback = 0) {
  return Math.round(numberValue(value, fallback));
}

function hoursValue(value: unknown, fallback = 0) {
  const raw = text(value).toLowerCase();
  if (!raw) return fallback;
  const numeric = numberValue(raw, Number.NaN);
  if (Number.isFinite(numeric)) return numeric;

  let total = 0;
  const hourMatch = raw.match(/(\d+(?:\.\d+)?)\s*(?:hr|hour|hours|h|ساعة|ساعه)/);
  const minuteMatch = raw.match(/(\d+(?:\.\d+)?)\s*(?:min|minute|minutes|m|دقيقة|دقيقه)/);
  const secondMatch = raw.match(/(\d+(?:\.\d+)?)\s*(?:sec|second|seconds|s|ثانية|ثانيه)/);
  if (hourMatch) total += Number(hourMatch[1]);
  if (minuteMatch) total += Number(minuteMatch[1]) / 60;
  if (secondMatch) total += Number(secondMatch[1]) / 3600;
  if (total > 0) return Math.round(total * 100) / 100;

  const clockMatch = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (clockMatch) {
    const hours = Number(clockMatch[1]);
    const minutes = Number(clockMatch[2]) / 60;
    const seconds = clockMatch[3] ? Number(clockMatch[3]) / 3600 : 0;
    return Math.round((hours + minutes + seconds) * 100) / 100;
  }

  return fallback;
}

function rateValue(value: unknown, fallback = 0) {
  const rate = numberValue(value, fallback);
  if (rate > 0 && rate <= 1) return Math.round(rate * 1000) / 10;
  return rate;
}

function dateValue(value: unknown, fallback = new Date()) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const raw = text(value);
  if (raw) {
    const compact = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (compact) {
      const parsed = new Date(Date.UTC(Number(compact[1]), Number(compact[2]) - 1, Number(compact[3])));
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return fallback;
}

function monthValue(value: unknown, fallbackDate = new Date()) {
  const raw = text(value);
  if (/^\d{4}-\d{2}$/.test(raw)) return raw;
  return dateValue(value, fallbackDate).toISOString().slice(0, 7);
}

function appNameFromImportType(importType: string) {
  if (importType.startsWith("keeta")) return "Keeta";
  if (importType.startsWith("hungerstation")) return "HungerStation";
  if (importType.startsWith("talabat")) return "Talabat";
  return importType;
}

function isDailyReportImportType(importType: string) {
  return ["keeta_period_report_template", "keeta_rank_template", "keeta_driver_invoice_template", "keeta_invoice", "keeta_rank", "hungerstation_invoice", "hungerstation_performance", "talabat_invoice"].includes(importType);
}

async function recalculateBatch(tx: Prisma.TransactionClient, batchId: string) {
  const rows = await tx.applicationImportRow.findMany({
    where: { batchId },
    select: { isValid: true, errorType: true, status: true, driverId: true, applicationAccountId: true },
  });
  const totalRows = rows.length;
  const validRows = rows.filter((row) => row.isValid).length;
  const invalidRows = totalRows - validRows;
  const duplicateRows = rows.filter((row) => String(row.errorType ?? row.status).toLowerCase().includes("duplicate")).length;
  const missingDrivers = rows.filter((row) => !row.driverId && String(row.errorType ?? row.status).toLowerCase().includes("driver")).length;
  const unlinkedAccounts = rows.filter((row) => !row.applicationAccountId && String(row.errorType ?? row.status).toLowerCase().includes("account")).length;

  return tx.applicationImportBatch.update({
    where: { id: batchId },
    data: {
      totalRows,
      validRows,
      invalidRows,
      duplicateRows,
      missingDrivers,
      unlinkedAccounts,
      status: invalidRows ? "committed_processed_with_errors" : "committed_processed",
    },
  });
}

async function ensureApplicationAccount(args: {
  tx: Prisma.TransactionClient;
  mapped: Record<string, unknown>;
  driverId: string;
  applicationAccountId?: string;
  batch: {
    applicationId: string | null;
    applicationProjectId: string | null;
    cityId: string | null;
    fileType: string;
    application?: { name: string } | null;
    applicationProject?: { projectId: string | null; cityId: string | null; name: string; application: { name: string } } | null;
  };
  driver: { cityId: string | null; projectId: string | null };
}) {
  const { tx, mapped, driverId, applicationAccountId, batch, driver } = args;
  if (applicationAccountId) {
    const scopedCityId = batch.cityId ?? batch.applicationProject?.cityId ?? driver.cityId ?? null;
    const account = await tx.applicationAccount.update({
      where: { id: applicationAccountId },
      data: {
        driverId,
        applicationId: batch.applicationId,
        applicationProjectId: batch.applicationProjectId,
        projectId: null,
        cityId: scopedCityId,
        isEmpty: false,
        needsReview: !batch.applicationProjectId || !scopedCityId,
        unmatchedReason: !batch.applicationProjectId ? "missing_application_project" : !scopedCityId ? "missing_city" : null,
        linkedAt: new Date(),
      },
      select: { id: true },
    });
    await tx.driver.update({ where: { id: driverId }, data: { accountId: account.id } }).catch(() => null);
    return account.id;
  }

  const appUserId = text(mapped.appUserId);
  const appUsername = firstText(mapped, ["appUsername", "username"]);
  if (!appUserId && !appUsername) return null;

  const existing = await tx.applicationAccount.findFirst({
    where: {
      ...(batch.applicationId ? { applicationId: batch.applicationId } : {}),
      ...(batch.applicationProjectId ? { applicationProjectId: batch.applicationProjectId } : {}),
      ...(batch.cityId ? { cityId: batch.cityId } : {}),
      OR: [
        appUserId ? { appUserId } : undefined,
        appUserId ? { username: appUserId } : undefined,
        appUsername ? { appUsername } : undefined,
        appUsername ? { username: appUsername } : undefined,
      ].filter(Boolean) as Prisma.ApplicationAccountWhereInput[],
    },
    select: { id: true },
  });

  const appName = text(mapped.applicationName) || batch.application?.name || batch.applicationProject?.application.name || appNameFromImportType(batch.fileType);
  const username = await uniqueAccountUsername(tx, appUsername || appUserId, batch.applicationProjectId || batch.cityId, existing?.id);
  const scopedCityId = batch.cityId ?? batch.applicationProject?.cityId ?? driver.cityId ?? null;
  const needsReview = !batch.applicationProjectId || !scopedCityId || !driverId;
  const unmatchedReason = [
    !batch.applicationProjectId ? "missing_application_project" : "",
    !scopedCityId ? "missing_city" : "",
    !driverId ? "missing_driver" : "",
  ].filter(Boolean).join(",") || null;
  const accountData = {
    appName,
    username,
    appUserId: appUserId || null,
    appUsername: appUsername || username,
    applicationId: batch.applicationId,
    applicationProjectId: batch.applicationProjectId,
    projectId: null,
    cityId: scopedCityId,
    driverId,
    isEmpty: false,
    needsReview,
    unmatchedReason,
    source: "IMPORT",
    status: RecordStatus.ACTIVE,
    linkedAt: new Date(),
  };

  const account = existing
    ? await tx.applicationAccount.update({ where: { id: existing.id }, data: accountData, select: { id: true } })
    : await tx.applicationAccount.create({ data: accountData, select: { id: true } });
  await tx.driver.update({ where: { id: driverId }, data: { accountId: account.id } }).catch(() => null);
  return account.id;
}

async function saveDailyReportForRow(args: {
  tx: Prisma.TransactionClient;
  mapped: Record<string, unknown>;
  driverId: string;
  batch: {
    fileType: string;
    cityId?: string | null;
    application?: { name: string } | null;
    applicationProject?: { projectId: string | null; cityId: string | null; name: string; application: { name: string } } | null;
  };
  driver: { cityId: string | null; projectId: string | null };
}) {
  const { tx, mapped, driverId, batch, driver } = args;
  if (!isDailyReportImportType(batch.fileType)) return { created: false, updated: false };

  const reportDate = dateValue(mapped.reportDate || mapped.date, new Date());
  const appName = text(mapped.applicationName) || batch.application?.name || batch.applicationProject?.application.name || appNameFromImportType(batch.fileType);
  const month = monthValue(mapped.month || mapped.reportDate || mapped.date, reportDate);
  const cityId = batch.cityId ?? batch.applicationProject?.cityId ?? driver.cityId ?? null;
  const projectId = batch.applicationProject?.projectId ?? null;

  const existing = await tx.dailyReport.findFirst({
    where: { driverId, reportDate, appName },
    select: { id: true },
  });

  const data = {
    reportDate,
    month,
    driverId,
    cityId,
    projectId,
    appName,
    orders: intValue(mapped.orders),
    workingHours: hoursValue(mapped.workingHours),
    onTimeRate: rateValue(mapped.onTimeRate),
    cancellationRate: rateValue(mapped.cancellationRate),
    rejectionRate: rateValue(mapped.rejectionRate),
  };

  if (existing) {
    await tx.dailyReport.update({ where: { id: existing.id }, data });
    return { created: false, updated: true };
  }

  await tx.dailyReport.create({ data });
  return { created: true, updated: false };
}

export async function linkImportRowToDriver(args: {
  batchId: string;
  rowId: string;
  driverId: string;
  applicationAccountId?: string;
  userId?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const [batch, row, driver] = await Promise.all([
      tx.applicationImportBatch.findUnique({
        where: { id: args.batchId },
        include: {
          application: { select: { name: true } },
          applicationProject: { select: { projectId: true, cityId: true, name: true, application: { select: { name: true } } } },
        },
      }),
      tx.applicationImportRow.findUnique({ where: { id: args.rowId } }),
      tx.driver.findUnique({ where: { id: args.driverId }, select: { id: true, cityId: true, projectId: true } }),
    ]);

    if (!batch) throw new Error("عملية الاستيراد غير موجودة.");
    if (!row || row.batchId !== args.batchId) throw new Error("صف الاستيراد غير موجود داخل هذه العملية.");
    if (!driver) throw new Error("المندوب المختار غير موجود.");

    const mapped = objectValue(row.mappedData);
    const accountId = await ensureApplicationAccount({
      tx,
      mapped,
      driverId: driver.id,
      applicationAccountId: args.applicationAccountId,
      batch,
      driver,
    });
    const reportResult = await saveDailyReportForRow({ tx, mapped, driverId: driver.id, batch, driver });

    const updatedRow = await tx.applicationImportRow.update({
      where: { id: row.id },
      data: {
        isValid: true,
        driverId: driver.id,
        applicationAccountId: accountId,
        status: reportResult.created || reportResult.updated ? "linked_processed" : "linked",
        errorType: null,
        errorMessage: null,
      },
    });

    const updatedBatch = await recalculateBatch(tx, args.batchId);

    await tx.auditLog.create({
      data: {
        userId: args.userId ?? null,
        action: "IMPORT_ROW_LINK",
        entityType: "ApplicationImportRow",
        entityId: row.id,
        before: json({ driverId: row.driverId, applicationAccountId: row.applicationAccountId, status: row.status, errorType: row.errorType }),
        after: json({ driverId: driver.id, applicationAccountId: accountId, status: updatedRow.status, dailyReport: reportResult }),
      },
    }).catch(() => null);

    return { row: updatedRow, batch: updatedBatch, dailyReport: reportResult, applicationAccountId: accountId };
  });
}
