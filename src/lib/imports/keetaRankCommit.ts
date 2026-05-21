import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { KeetaRankMatchedRow } from "./matchDrivers";

export type KeetaRankCommitInput = {
  fileName: string;
  applicationId?: string | null;
  applicationProjectId?: string | null;
  rankSettingId?: string | null;
  rows: KeetaRankMatchedRow[];
};

export async function commitKeetaRankImport(input: KeetaRankCommitInput) {
  const totalRows = input.rows.length;
  const validRows = input.rows.filter((row) => row.status === "Valid").length;
  const missingDrivers = input.rows.filter((row) => row.status === "Missing Driver").length;
  const unlinkedAccounts = input.rows.filter((row) => row.status === "Unlinked Account").length;
  const duplicateRows = input.rows.filter((row) => row.status === "Duplicate Match").length;
  const invalidRows = totalRows - validRows;

  return prisma.$transaction(async (tx) => {
    const batch = await tx.applicationImportBatch.create({
      data: {
        applicationId: input.applicationId || null,
        applicationProjectId: input.applicationProjectId || null,
        fileType: "KEETA_RANK",
        fileName: input.fileName,
        status: "committed",
        totalRows,
        validRows,
        invalidRows,
        duplicateRows,
        missingDrivers,
        unlinkedAccounts,
        committedAt: new Date(),
        rows: {
          create: input.rows.map((row) => ({
            rowNumber: row.rowNumber,
            rawData: row.rawData as Prisma.InputJsonValue,
            mappedData: {
              driverCode: row.driverCode,
              driverName: row.driverName,
              nationalId: row.nationalId,
              appUserId: row.appUserId,
              appUsername: row.appUsername,
              rank: row.rank,
              orders: row.orders,
              onTime: row.onTime,
              cancellation: row.cancellation,
              rejection: row.rejection,
              workingHours: row.workingHours,
              matchStatus: row.status,
              rankSettingId: input.rankSettingId || null,
            } as Prisma.InputJsonValue,
            isValid: row.isValid,
            errorType: row.status === "Valid" ? null : row.status,
            errorMessage: row.errorMessage || null,
            driverId: row.driverId,
            applicationAccountId: row.applicationAccountId,
            status: row.status,
          })),
        },
      },
      include: { rows: true },
    });

    await tx.auditLog.create({
      data: {
        action: "KEETA_RANK_IMPORT_COMMIT",
        entityType: "ApplicationImportBatch",
        entityId: batch.id,
        user: "System Admin",
        after: {
          fileName: input.fileName,
          totalRows,
          validRows,
          invalidRows,
          missingDrivers,
          unlinkedAccounts,
          duplicateRows,
        },
      },
    });

    return batch;
  });
}
