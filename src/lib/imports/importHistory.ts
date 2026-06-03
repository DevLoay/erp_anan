import { prisma } from "@/lib/prisma";
import { databaseOfflineMessage, formatDate, statusText } from "./templates";

export type ImportHistoryRow = {
  id: string;
  fileName: string;
  fileType: string;
  applicationName: string;
  projectName: string;
  templateName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  missingDrivers: number;
  unlinkedAccounts: number;
  status: string;
  createdBy: string;
  createdAt: string;
};

export type ImportHistoryData = {
  databaseStatus: "online" | "offline";
  databaseMessage?: string;
  summary: {
    total: number;
    successful: number;
    withErrors: number;
    previews: number;
    totalRows: number;
    validRows: number;
    invalidRows: number;
    lastImport: string;
  };
  rows: ImportHistoryRow[];
};

function rowFromBatch(batch: {
  id: string;
  fileName: string | null;
  fileType: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  missingDrivers: number;
  unlinkedAccounts: number;
  status: string;
  createdAt: Date;
  application?: { name: string } | null;
  applicationProject?: { name: string } | null;
  template?: { name: string } | null;
  createdBy?: { name: string; email: string } | null;
}): ImportHistoryRow {
  return {
    id: batch.id,
    fileName: batch.fileName ?? "-",
    fileType: batch.fileType,
    applicationName: batch.application?.name ?? "-",
    projectName: batch.applicationProject?.name ?? "كل المشاريع",
    templateName: batch.template?.name ?? "-",
    totalRows: batch.totalRows,
    validRows: batch.validRows,
    invalidRows: batch.invalidRows,
    duplicateRows: batch.duplicateRows,
    missingDrivers: batch.missingDrivers,
    unlinkedAccounts: batch.unlinkedAccounts,
    status: statusText(batch.status),
    createdBy: batch.createdBy?.name || batch.createdBy?.email || "-",
    createdAt: formatDate(batch.createdAt),
  };
}

export async function getImportHistoryData(): Promise<ImportHistoryData> {
  try {
    const batches = await prisma.applicationImportBatch.findMany({
      include: {
        application: { select: { name: true } },
        applicationProject: { select: { name: true } },
        template: { select: { name: true } },
        createdBy: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    const rows = batches.map(rowFromBatch);
    return {
      databaseStatus: "online",
      rows,
      summary: {
        total: rows.length,
        successful: rows.filter((row) => row.status.includes("محفوظ") || row.status.includes("معتمد")).length,
        withErrors: rows.filter((row) => row.invalidRows > 0).length,
        previews: rows.filter((row) => row.status === "معاينة").length,
        totalRows: rows.reduce((sum, row) => sum + row.totalRows, 0),
        validRows: rows.reduce((sum, row) => sum + row.validRows, 0),
        invalidRows: rows.reduce((sum, row) => sum + row.invalidRows, 0),
        lastImport: rows[0]?.createdAt ?? "-",
      },
    };
  } catch (error) {
    const message = databaseOfflineMessage(error);
    if (message) {
      return {
        databaseStatus: "offline",
        databaseMessage: message,
        rows: [],
        summary: { total: 0, successful: 0, withErrors: 0, previews: 0, totalRows: 0, validRows: 0, invalidRows: 0, lastImport: "-" },
      };
    }
    throw error;
  }
}

export async function getImportBatchDetails(id: string) {
  try {
    const [batch, drivers] = await Promise.all([
      prisma.applicationImportBatch.findUnique({
        where: { id },
        include: {
          application: { select: { name: true, code: true } },
          applicationProject: { select: { name: true, code: true } },
          template: { select: { name: true, fileType: true } },
          createdBy: { select: { name: true, email: true } },
          rows: {
            include: {
              driver: { select: { internalCode: true, name: true, actualName: true } },
              applicationAccount: { select: { appUserId: true, appUsername: true, username: true } },
            },
            orderBy: { rowNumber: "asc" },
          },
        },
      }),
      prisma.driver.findMany({
        select: {
          id: true,
          internalCode: true,
          driverCode: true,
          name: true,
          actualName: true,
          nationalId: true,
          mobile: true,
          phone: true,
          city: { select: { nameAr: true, nameEn: true } },
          project: { select: { name: true, appName: true } },
          account: { select: { appUserId: true, appUsername: true, username: true } },
        },
        orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
        take: 1000,
      }),
    ]);

    if (!batch) return { databaseStatus: "online" as const, batch: null, drivers: [] };

    function mappedText(value: unknown, keys: string[]) {
      if (!value || typeof value !== "object") return "-";
      const record = value as Record<string, unknown>;
      for (const key of keys) {
        const text = String(record[key] ?? "").trim();
        if (text) return text;
      }
      return "-";
    }

    return {
      databaseStatus: "online" as const,
      drivers: drivers.map((driver) => ({
        id: driver.id,
        label: `${driver.internalCode || driver.driverCode || "-"} - ${driver.actualName || driver.name}${driver.nationalId ? ` - ${driver.nationalId}` : ""}`,
        searchText: [
          driver.internalCode,
          driver.driverCode,
          driver.actualName,
          driver.name,
          driver.nationalId,
          driver.mobile,
          driver.phone,
          driver.city?.nameAr,
          driver.city?.nameEn,
          driver.project?.name,
          driver.project?.appName,
          driver.account?.appUserId,
          driver.account?.appUsername,
          driver.account?.username,
        ].filter(Boolean).join(" ").toLowerCase(),
      })),
      batch: {
        id: batch.id,
        fileName: batch.fileName ?? "-",
        fileType: batch.fileType,
        applicationName: batch.application?.name ?? "-",
        projectName: batch.applicationProject?.name ?? "كل المشاريع",
        templateName: batch.template?.name ?? "-",
        createdBy: batch.createdBy?.name || batch.createdBy?.email || "-",
        createdAt: formatDate(batch.createdAt),
        status: statusText(batch.status),
        totalRows: batch.totalRows,
        validRows: batch.validRows,
        invalidRows: batch.invalidRows,
        duplicateRows: batch.duplicateRows,
        missingDrivers: batch.missingDrivers,
        unlinkedAccounts: batch.unlinkedAccounts,
        rows: batch.rows.map((row) => ({
          id: row.id,
          rowNumber: row.rowNumber,
          status: statusText(row.status),
          isValid: row.isValid,
          driver: row.driver ? `${row.driver.internalCode} - ${row.driver.actualName || row.driver.name}` : "-",
          applicationAccount: row.applicationAccount ? row.applicationAccount.appUserId || row.applicationAccount.appUsername || row.applicationAccount.username : "-",
          vehicle: mappedText(row.mappedData, ["vehicleId", "vehicleCode", "plateArabic", "plateEnglish", "vehiclePlate"]),
          rawData: row.rawData,
          mappedData: row.mappedData,
          errorType: row.errorType ?? "-",
          errorMessage: row.errorMessage ?? "-",
        })),
      },
    };
  } catch (error) {
    const message = databaseOfflineMessage(error);
    if (message) return { databaseStatus: "offline" as const, databaseMessage: message, batch: null, drivers: [] };
    throw error;
  }
}
