import { DriverStatus, Prisma, RecordStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ImportPreviewPayload } from "./previewImport";
import type { ImportPreviewRow } from "./validateRows";

function json(value: unknown) {
  if (value === undefined || value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeCode(value: string) {
  return value.trim().replace(/\s+/g, "_").replace(/[^\p{L}\p{N}_-]/gu, "").toUpperCase() || "APP";
}

function driverStatus(value: unknown) {
  const raw = text(value).toLowerCase();
  if (["inactive", "غير نشط", "موقوف", "suspended", "stop", "stopped"].includes(raw)) return raw.includes("suspend") || raw.includes("موقوف") ? DriverStatus.SUSPENDED : DriverStatus.INACTIVE;
  return DriverStatus.ACTIVE;
}

function recordStatus(value: unknown) {
  const raw = text(value).toLowerCase();
  if (["inactive", "غير نشط", "suspended", "موقوف"].includes(raw)) return RecordStatus.INACTIVE;
  if (["pending", "قيد المراجعة"].includes(raw)) return RecordStatus.PENDING;
  return RecordStatus.ACTIVE;
}

async function findOrCreateCity(tx: Prisma.TransactionClient, name: string) {
  if (!name) return null;
  const existing = await tx.city.findFirst({
    where: {
      OR: [
        { nameAr: { equals: name, mode: "insensitive" } },
        { nameEn: { equals: name, mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await tx.city.create({ data: { nameAr: name, nameEn: name, status: "ACTIVE" }, select: { id: true } });
  return created.id;
}

async function findOrCreateProject(tx: Prisma.TransactionClient, name: string, appName: string, cityId: string | null) {
  if (!name) return null;
  const existing = await tx.project.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      ...(cityId ? { cityId } : {}),
    },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await tx.project.create({
    data: { name, appName: appName || null, cityId, status: "ACTIVE" },
    select: { id: true },
  });
  return created.id;
}

async function findOrCreateApplication(tx: Prisma.TransactionClient, name: string) {
  if (!name) return null;
  const code = normalizeCode(name);
  const existing = await tx.application.findFirst({
    where: {
      OR: [
        { code },
        { name: { equals: name, mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await tx.application.create({ data: { code, name, status: RecordStatus.ACTIVE }, select: { id: true } });
  return created.id;
}

async function commitDriverRows(tx: Prisma.TransactionClient, rows: ImportPreviewRow[]) {
  let createdDrivers = 0;
  let updatedDrivers = 0;
  let createdAccounts = 0;
  let updatedAccounts = 0;

  for (const row of rows) {
    const mapped = row.mappedData;
    const driverCode = text(mapped.driverCode);
    const nationalId = text(mapped.nationalId);
    const actualName = text(mapped.actualName) || text(mapped.name);
    if (!driverCode || !nationalId || !actualName) continue;

    const cityName = text(mapped.city);
    const projectName = text(mapped.project);
    const appName = text(mapped.applicationName);
    const appUserId = text(mapped.appUserId);
    const appUsername = text(mapped.appUsername);
    const mobile = text(mapped.mobile);

    const cityId = await findOrCreateCity(tx, cityName);
    const projectId = await findOrCreateProject(tx, projectName, appName, cityId);
    const applicationId = await findOrCreateApplication(tx, appName);

    const existingDriver = await tx.driver.findFirst({
      where: {
        OR: [
          { internalCode: driverCode },
          { driverCode },
          { nationalId },
        ],
      },
      select: { id: true },
    });

    const driverData = {
      internalCode: driverCode,
      driverCode,
      nationalId,
      name: actualName,
      actualName,
      phone: mobile || null,
      mobile: mobile || null,
      nationality: text(mapped.nationality) || null,
      cityId,
      projectId,
      contractType: text(mapped.contractType) || null,
      accommodationType: text(mapped.accommodationType) || null,
      housingStatus: text(mapped.accommodationType) || null,
      status: driverStatus(mapped.appStatus),
    };

    const driver = existingDriver
      ? await tx.driver.update({ where: { id: existingDriver.id }, data: driverData, select: { id: true } })
      : await tx.driver.create({ data: driverData, select: { id: true } });

    if (existingDriver) updatedDrivers += 1;
    else createdDrivers += 1;

    if (appUserId || appUsername || appName) {
      const username = appUsername || appUserId || `${appName || "APP"}-${driverCode}`;
      const existingAccount = await tx.applicationAccount.findFirst({
        where: {
          OR: [
            { username },
            appUserId ? { appUserId } : undefined,
            appUsername ? { appUsername } : undefined,
          ].filter(Boolean) as Prisma.ApplicationAccountWhereInput[],
        },
        select: { id: true },
      });

      const accountData = {
        appName: appName || "Unknown",
        username,
        appUserId: appUserId || null,
        appUsername: appUsername || username,
        applicationId,
        projectId,
        cityId,
        driverId: driver.id,
        isEmpty: false,
        status: recordStatus(mapped.appStatus),
        linkedAt: new Date(),
      };

      const account = existingAccount
        ? await tx.applicationAccount.update({ where: { id: existingAccount.id }, data: accountData, select: { id: true } })
        : await tx.applicationAccount.create({ data: accountData, select: { id: true } });

      if (existingAccount) updatedAccounts += 1;
      else createdAccounts += 1;

      await tx.driver.update({ where: { id: driver.id }, data: { accountId: account.id } });
    }
  }

  return { createdDrivers, updatedDrivers, createdAccounts, updatedAccounts };
}

export async function commitImportPreview(preview: ImportPreviewPayload, userId?: string | null) {
  const validRows = preview.rows.filter((row) => row.severity !== "error" && row.status !== "ignored");
  const status = preview.summary.importType === "drivers" ? "committed_processed" : "committed_pending_processing";

  const batch = await prisma.$transaction(async (tx) => {
    const created = await tx.applicationImportBatch.create({
      data: {
        applicationId: preview.summary.applicationId || null,
        applicationProjectId: preview.summary.applicationProjectId || null,
        templateId: preview.summary.templateId || null,
        fileType: preview.summary.importType,
        fileName: preview.summary.fileName,
        status,
        totalRows: preview.summary.totalRows,
        validRows: preview.summary.validRows,
        invalidRows: preview.summary.invalidRows,
        duplicateRows: preview.summary.duplicateRows,
        missingDrivers: preview.summary.missingDrivers,
        unlinkedAccounts: preview.summary.missingApplicationAccounts,
        createdById: userId ?? null,
        committedAt: new Date(),
      },
    });

    if (preview.summary.templateId) {
      await tx.applicationImportTemplate.update({
        where: { id: preview.summary.templateId },
        data: { lastUsedAt: new Date() },
      }).catch(() => null);
    }

    if (preview.rows.length) {
      await tx.applicationImportRow.createMany({
        data: preview.rows.map((row) => ({
          batchId: created.id,
          rowNumber: row.rowNumber,
          rawData: json(row.rawData),
          mappedData: json(row.mappedData),
          isValid: row.severity !== "error",
          errorType: row.errorType ?? null,
          errorMessage: row.errorMessage ?? null,
          driverId: row.driverId ?? null,
          applicationAccountId: row.applicationAccountId ?? null,
          status: row.severity === "error" ? "invalid" : row.severity === "warning" ? "warning" : "ready",
        })),
      });
    }

    await tx.auditLog.create({
      data: {
        userId: userId ?? null,
        action: "IMPORT_COMMIT",
        entityType: "ApplicationImportBatch",
        entityId: created.id,
        after: json({
          fileName: preview.summary.fileName,
          importType: preview.summary.importType,
          totalRows: preview.summary.totalRows,
          validRows: preview.summary.validRows,
          invalidRows: preview.summary.invalidRows,
        }),
      },
    }).catch(() => null);

    const drivers = preview.summary.importType === "drivers" ? await commitDriverRows(tx, validRows) : null;

    return { created, drivers };
  });

  return {
    batchId: batch.created.id,
    rowsSaved: preview.rows.length,
    validRowsSaved: validRows.length,
    skippedRows: preview.summary.invalidRows,
    drivers: batch.drivers,
    message: preview.summary.importType === "drivers" ? "تم اعتماد ملف المناديب وتحديث قاعدة البيانات." : "تم حفظ عملية الاستيراد، معالجة هذا النوع ستكتمل في مرحلة لاحقة",
  };
}
