import { prisma } from "@/lib/prisma";

export type KeetaRankMappedRow = {
  rowNumber: number;
  rawData: Record<string, unknown>;
  driverCode: string;
  driverName: string;
  nationalId: string;
  appUserId: string;
  appUsername: string;
  rank: string;
  orders: number | null;
  onTime: number | null;
  cancellation: number | null;
  rejection: number | null;
  workingHours: number | null;
};

export type KeetaRankMatchedRow = KeetaRankMappedRow & {
  status: "Valid" | "Missing Driver" | "Unlinked Account" | "Duplicate Match" | "Invalid Data";
  isValid: boolean;
  errorMessage: string;
  driverId: string | null;
  applicationAccountId: string | null;
};

function hasValue(value: string) {
  return value.trim().length > 0;
}

function invalidNumbers(row: KeetaRankMappedRow) {
  return [row.orders, row.onTime, row.cancellation, row.rejection, row.workingHours].some((value) => value !== null && !Number.isFinite(value));
}

export async function matchKeetaRankRows(rows: KeetaRankMappedRow[], applicationId?: string | null): Promise<KeetaRankMatchedRow[]> {
  const matched: KeetaRankMatchedRow[] = [];

  for (const row of rows) {
    if (invalidNumbers(row)) {
      matched.push({
        ...row,
        status: "Invalid Data",
        isValid: false,
        errorMessage: "توجد قيم رقمية غير صحيحة في الصف.",
        driverId: null,
        applicationAccountId: null,
      });
      continue;
    }

    const driverMatches = [];

    if (hasValue(row.driverCode)) {
      const byCode = await prisma.driver.findMany({
        where: { OR: [{ driverCode: row.driverCode }, { internalCode: row.driverCode }] },
        select: { id: true },
        take: 3,
      });
      driverMatches.push(...byCode.map((driver) => driver.id));
    }

    let matchedAccountId: string | null = null;
    let accountDriverId: string | null = null;

    if (!driverMatches.length && hasValue(row.appUserId)) {
      const accounts = await prisma.applicationAccount.findMany({
        where: {
          appUserId: row.appUserId,
          ...(applicationId ? { applicationId } : {}),
        },
        select: { id: true, driverId: true },
        take: 3,
      });
      if (accounts.length > 1) {
        matched.push({
          ...row,
          status: "Duplicate Match",
          isValid: false,
          errorMessage: "تم العثور على أكثر من حساب بنفس App User ID.",
          driverId: null,
          applicationAccountId: null,
        });
        continue;
      }
      if (accounts[0]) {
        matchedAccountId = accounts[0].id;
        accountDriverId = accounts[0].driverId;
        if (accountDriverId) driverMatches.push(accountDriverId);
      }
    }

    if (!driverMatches.length && hasValue(row.appUsername)) {
      const accounts = await prisma.applicationAccount.findMany({
        where: {
          OR: [{ appUsername: row.appUsername }, { username: row.appUsername }],
          ...(applicationId ? { applicationId } : {}),
        },
        select: { id: true, driverId: true },
        take: 3,
      });
      if (accounts.length > 1) {
        matched.push({
          ...row,
          status: "Duplicate Match",
          isValid: false,
          errorMessage: "تم العثور على أكثر من حساب بنفس App Username.",
          driverId: null,
          applicationAccountId: null,
        });
        continue;
      }
      if (accounts[0]) {
        matchedAccountId = accounts[0].id;
        accountDriverId = accounts[0].driverId;
        if (accountDriverId) driverMatches.push(accountDriverId);
      }
    }

    if (!driverMatches.length && hasValue(row.nationalId)) {
      const byNationalId = await prisma.driver.findMany({
        where: { nationalId: row.nationalId },
        select: { id: true },
        take: 3,
      });
      driverMatches.push(...byNationalId.map((driver) => driver.id));
    }

    const uniqueDriverMatches = Array.from(new Set(driverMatches));
    if (uniqueDriverMatches.length > 1) {
      matched.push({
        ...row,
        status: "Duplicate Match",
        isValid: false,
        errorMessage: "تم العثور على أكثر من مندوب مطابق لهذا الصف.",
        driverId: null,
        applicationAccountId: matchedAccountId,
      });
      continue;
    }

    if (!uniqueDriverMatches.length && matchedAccountId && !accountDriverId) {
      matched.push({
        ...row,
        status: "Unlinked Account",
        isValid: false,
        errorMessage: "حساب التطبيق موجود لكنه غير مربوط بمندوب.",
        driverId: null,
        applicationAccountId: matchedAccountId,
      });
      continue;
    }

    if (!uniqueDriverMatches.length) {
      matched.push({
        ...row,
        status: "Missing Driver",
        isValid: false,
        errorMessage: "لم يتم العثور على مندوب مطابق لهذا الصف.",
        driverId: null,
        applicationAccountId: matchedAccountId,
      });
      continue;
    }

    matched.push({
      ...row,
      status: "Valid",
      isValid: true,
      errorMessage: "",
      driverId: uniqueDriverMatches[0],
      applicationAccountId: matchedAccountId,
    });
  }

  return matched;
}
