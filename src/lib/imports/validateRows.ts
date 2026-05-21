import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { matchVehicleFromMappedData, type MatchedVehicle } from "./matchVehicles";
import type { ImportColumn, ImportColumnMapping } from "./templates";

export type MatchedDriver = {
  id: string;
  code: string;
  name: string;
  nationalId: string;
};

export type MatchedApplicationAccount = {
  id: string;
  appUserId: string;
  appUsername: string;
  driverId: string;
};

export type ImportPreviewRow = {
  rowNumber: number;
  status: string;
  severity: "ready" | "warning" | "error";
  rawData: Record<string, unknown>;
  mappedData: Record<string, unknown>;
  mainIdentifier: string;
  driverId?: string;
  vehicleId?: string;
  applicationAccountId?: string;
  matchedDriver?: MatchedDriver;
  matchedVehicle?: MatchedVehicle;
  matchedApplicationAccount?: MatchedApplicationAccount;
  errorType?: string;
  errorMessage?: string;
};

export type ImportPreviewSummary = {
  fileName: string;
  importType: string;
  applicationId: string;
  applicationProjectId: string;
  templateId: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  missingRequiredColumns: number;
  missingDrivers: number;
  missingVehicles: number;
  missingProjects: number;
  missingApplicationAccounts: number;
  rowsReadyToSave: number;
};

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_\-.]+/g, "");
}

function valueOf(row: Record<string, unknown>, key: string) {
  return String(row[key] ?? "").trim();
}

function numberValue(value: unknown) {
  const numeric = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(numeric) ? numeric : NaN;
}

function validDate(value: unknown) {
  if (!value) return false;
  const date = new Date(String(value));
  return !Number.isNaN(date.getTime());
}

export function mapRawRow(
  rawData: Record<string, unknown>,
  columns: ImportColumn[],
  mapping: ImportColumnMapping[],
): Record<string, unknown> {
  const headerMap = new Map<string, string>();
  for (const key of Object.keys(rawData)) headerMap.set(normalizeHeader(key), key);

  const mapped: Record<string, unknown> = {};
  for (const column of columns) {
    const mappingItem = mapping.find((item) => item.systemField === column.key);
    const candidates = [
      mappingItem?.incomingColumn,
      column.displayName,
      column.key,
      ...(column.aliases ?? []),
    ].filter(Boolean);
    const rawKey = candidates.map(normalizeHeader).map((candidate) => headerMap.get(candidate)).find(Boolean);
    mapped[column.key] = rawKey ? rawData[rawKey] : "";
  }
  return mapped;
}

export function missingRequiredColumns(sourceColumns: string[], requiredColumns: ImportColumn[]) {
  const normalized = new Set(sourceColumns.map(normalizeHeader));
  return requiredColumns.filter((column) => {
    const aliases = [column.displayName, column.key, ...(column.aliases ?? [])].map(normalizeHeader);
    return !aliases.some((alias) => normalized.has(alias));
  });
}

async function matchDriver(mappedData: Record<string, unknown>): Promise<{
  status: "matched" | "missing_driver" | "duplicate_match" | "not_required";
  driver?: MatchedDriver;
  account?: MatchedApplicationAccount;
  message?: string;
}> {
  const driverCode = valueOf(mappedData, "driverCode") || valueOf(mappedData, "internalCode");
  const nationalId = valueOf(mappedData, "nationalId");
  const appUserId = valueOf(mappedData, "appUserId");
  const appUsername = valueOf(mappedData, "appUsername") || valueOf(mappedData, "username");
  const mobile = valueOf(mappedData, "mobile") || valueOf(mappedData, "phone");

  if (!driverCode && !nationalId && !appUserId && !appUsername && !mobile) return { status: "not_required" };

  const accountMatches = appUserId || appUsername
    ? await prisma.applicationAccount.findMany({
        where: {
          OR: [
            appUserId ? { appUserId } : undefined,
            appUserId ? { username: appUserId } : undefined,
            appUsername ? { appUsername } : undefined,
            appUsername ? { username: appUsername } : undefined,
          ].filter(Boolean) as Prisma.ApplicationAccountWhereInput[],
        },
        select: {
          id: true,
          appUserId: true,
          appUsername: true,
          username: true,
          driverId: true,
          driver: { select: { id: true, internalCode: true, driverCode: true, name: true, actualName: true, nationalId: true } },
        },
        take: 3,
      })
    : [];

  const driverMatches = await prisma.driver.findMany({
    where: {
      OR: [
        driverCode ? { internalCode: driverCode } : undefined,
        driverCode ? { driverCode } : undefined,
        nationalId ? { nationalId } : undefined,
        mobile ? { mobile } : undefined,
        mobile ? { phone: mobile } : undefined,
      ].filter(Boolean) as Prisma.DriverWhereInput[],
    },
    select: { id: true, internalCode: true, driverCode: true, name: true, actualName: true, nationalId: true },
    take: 3,
  });

  const combined = new Map<string, MatchedDriver>();
  for (const driver of driverMatches) {
    combined.set(driver.id, {
      id: driver.id,
      code: driver.internalCode || driver.driverCode || "-",
      name: driver.actualName || driver.name,
      nationalId: driver.nationalId || "-",
    });
  }
  for (const account of accountMatches) {
    if (account.driver) {
      combined.set(account.driver.id, {
        id: account.driver.id,
        code: account.driver.internalCode || account.driver.driverCode || "-",
        name: account.driver.actualName || account.driver.name,
        nationalId: account.driver.nationalId || "-",
      });
    }
  }

  const drivers = [...combined.values()];
  const account = accountMatches[0]
    ? {
        id: accountMatches[0].id,
        appUserId: accountMatches[0].appUserId || accountMatches[0].username || "-",
        appUsername: accountMatches[0].appUsername || accountMatches[0].username || "-",
        driverId: accountMatches[0].driverId || "",
      }
    : undefined;

  if (accountMatches.length && !accountMatches[0].driverId) return { status: "missing_driver", account, message: "الحساب موجود لكنه غير مربوط بمندوب." };
  if (!drivers.length) return { status: "missing_driver", account, message: "لم يتم العثور على المندوب." };
  if (drivers.length > 1) return { status: "duplicate_match", account, message: "تم العثور على أكثر من مندوب مطابق." };
  return { status: "matched", driver: drivers[0], account };
}

function basicValidation(fileType: string, mappedData: Record<string, unknown>) {
  const errors: { type: string; message: string }[] = [];
  const hasDriverIdentifier = Boolean(valueOf(mappedData, "driverCode") || valueOf(mappedData, "nationalId") || valueOf(mappedData, "appUserId") || valueOf(mappedData, "appUsername"));

  if (fileType === "drivers") {
    if (!valueOf(mappedData, "driverCode") && !valueOf(mappedData, "nationalId")) errors.push({ type: "missing_driver_identifier", message: "كود المندوب أو رقم الهوية مطلوب." });
    if (!valueOf(mappedData, "actualName") && !valueOf(mappedData, "name")) errors.push({ type: "missing_name", message: "اسم المندوب مطلوب." });
  }

  if (fileType === "vehicles") {
    if (!valueOf(mappedData, "plateArabic") && !valueOf(mappedData, "plateEnglish") && !valueOf(mappedData, "vehicleCode")) errors.push({ type: "missing_vehicle_identifier", message: "كود السيارة أو اللوحة مطلوب." });
    if (valueOf(mappedData, "monthlyRent") && Number.isNaN(numberValue(mappedData.monthlyRent))) errors.push({ type: "invalid_number", message: "الإيجار الشهري يجب أن يكون رقمًا." });
  }

  if (fileType === "application_accounts") {
    if (!valueOf(mappedData, "appUserId") && !valueOf(mappedData, "appUsername")) errors.push({ type: "missing_account_identifier", message: "معرف الحساب أو اسم المستخدم مطلوب." });
  }

  if (["advances", "deductions", "violations", "fuel"].includes(fileType)) {
    if (!hasDriverIdentifier) errors.push({ type: "missing_driver_identifier", message: "بيانات ربط المندوب مطلوبة." });
    if (Number.isNaN(numberValue(mappedData.amount))) errors.push({ type: "invalid_amount", message: "المبلغ يجب أن يكون رقمًا." });
    if (!validDate(mappedData.date)) errors.push({ type: "invalid_date", message: "التاريخ غير صحيح." });
  }

  if (fileType === "hr_documents") {
    if (!hasDriverIdentifier) errors.push({ type: "missing_driver_identifier", message: "بيانات ربط المندوب مطلوبة." });
    if (!valueOf(mappedData, "documentType")) errors.push({ type: "missing_document_type", message: "نوع المستند مطلوب." });
    if (valueOf(mappedData, "expiryDate") && !validDate(mappedData.expiryDate)) errors.push({ type: "invalid_date", message: "تاريخ الانتهاء غير صحيح." });
  }

  if (fileType === "payroll") {
    if (!hasDriverIdentifier) errors.push({ type: "missing_driver_identifier", message: "بيانات ربط المندوب مطلوبة." });
    if (!valueOf(mappedData, "month")) errors.push({ type: "missing_month", message: "الشهر مطلوب." });
    if (!valueOf(mappedData, "year") || Number.isNaN(numberValue(mappedData.year))) errors.push({ type: "invalid_year", message: "السنة مطلوبة ويجب أن تكون رقمًا." });
  }

  if (fileType.includes("invoice") || fileType.includes("performance") || fileType.includes("rank")) {
    if (!hasDriverIdentifier) errors.push({ type: "missing_driver_identifier", message: "بيانات ربط المندوب أو حساب التطبيق مطلوبة." });
    if (valueOf(mappedData, "orders") && Number.isNaN(numberValue(mappedData.orders))) errors.push({ type: "invalid_orders", message: "عدد الطلبات يجب أن يكون رقمًا." });
  }

  return errors;
}

export async function validateImportRows(args: {
  fileType: string;
  sourceColumns: string[];
  rawRows: Record<string, unknown>[];
  requiredColumns: ImportColumn[];
  optionalColumns: ImportColumn[];
  columnMapping: ImportColumnMapping[];
  fileName: string;
  applicationId: string;
  applicationProjectId: string;
  templateId: string;
}): Promise<{ summary: ImportPreviewSummary; rows: ImportPreviewRow[]; columns: string[]; missingColumns: ImportColumn[] }> {
  const allColumns = [...args.requiredColumns, ...args.optionalColumns];
  const missingColumns = missingRequiredColumns(args.sourceColumns, args.requiredColumns);
  const rows: ImportPreviewRow[] = [];
  const seenMainIdentifiers = new Set<string>();

  for (const [index, rawData] of args.rawRows.entries()) {
    const mappedData = mapRawRow(rawData, allColumns, args.columnMapping);
    const primaryIdentifier =
      valueOf(mappedData, "driverCode") ||
      valueOf(mappedData, "nationalId") ||
      valueOf(mappedData, "appUserId") ||
      valueOf(mappedData, "appUsername") ||
      valueOf(mappedData, "vehicleCode") ||
      valueOf(mappedData, "plateEnglish") ||
      `row-${index + 2}`;
    const mainIdentifier =
      args.fileType === "keeta_invoice"
        ? `${valueOf(mappedData, "reportDate") || "no-date"}-${primaryIdentifier}`
        : primaryIdentifier;

    const errors = [...basicValidation(args.fileType, mappedData)];

    if (mainIdentifier && seenMainIdentifiers.has(mainIdentifier)) {
      errors.push({ type: "duplicate_row", message: "هذا الصف مكرر داخل الملف." });
    }
    seenMainIdentifiers.add(mainIdentifier);

    const driverMatch = args.fileType === "vehicles" ? { status: "not_required" as const } : await matchDriver(mappedData);
    if (driverMatch.status === "missing_driver" && !["drivers", "vehicles"].includes(args.fileType)) {
      errors.push({ type: "missing_driver", message: driverMatch.message ?? "لم يتم العثور على المندوب." });
    }
    if (driverMatch.status === "duplicate_match") errors.push({ type: "duplicate_match", message: driverMatch.message ?? "نتائج ربط متعددة." });

    const vehicleMatch = ["vehicles", "violations", "fuel"].includes(args.fileType) ? await matchVehicleFromMappedData(mappedData) : { status: "not_required" as const };
    if (vehicleMatch.status === "missing_vehicle" && args.fileType === "vehicles") {
      errors.push({ type: "new_vehicle", message: "سيتم اعتبار السيارة كسجل جديد عند اكتمال معالجة هذا النوع." });
    } else if (vehicleMatch.status === "missing_vehicle" && ["violations", "fuel"].includes(args.fileType) && valueOf(mappedData, "vehiclePlate")) {
      errors.push({ type: "missing_vehicle", message: vehicleMatch.message ?? "لم يتم العثور على السيارة." });
    }
    if (vehicleMatch.status === "duplicate_match") errors.push({ type: "duplicate_match", message: vehicleMatch.message ?? "نتائج ربط سيارة متعددة." });

    const hardErrors = errors.filter((error) => error.type !== "new_vehicle");
    const severity: ImportPreviewRow["severity"] = hardErrors.length ? "error" : errors.length ? "warning" : "ready";
    const rowStatus =
      args.fileType === "drivers" && severity === "ready"
        ? driverMatch.status === "matched"
          ? "update_existing_record"
          : "new_record"
        : severity === "ready"
          ? "ready"
          : severity === "warning"
            ? "warning"
            : errors[0]?.type ?? "invalid";
    const rowMessage =
      args.fileType === "drivers" && severity === "ready" && driverMatch.status !== "matched"
        ? "سجل مندوب جديد جاهز للحفظ عند الاعتماد."
        : args.fileType === "drivers" && severity === "ready" && driverMatch.status === "matched"
          ? "مندوب موجود وسيتم تحديث بياناته عند الاعتماد."
          : errors.map((error) => error.message).join(" | ");

    rows.push({
      rowNumber: index + 2,
      status: rowStatus,
      severity,
      rawData,
      mappedData: {
        ...mappedData,
        vehicleId: vehicleMatch.status === "matched" ? vehicleMatch.vehicle?.id : undefined,
      },
      mainIdentifier,
      driverId: driverMatch.status === "matched" ? driverMatch.driver?.id : undefined,
      vehicleId: vehicleMatch.status === "matched" ? vehicleMatch.vehicle?.id : undefined,
      applicationAccountId: driverMatch.account?.id,
      matchedDriver: driverMatch.status === "matched" ? driverMatch.driver : undefined,
      matchedVehicle: vehicleMatch.status === "matched" ? vehicleMatch.vehicle : undefined,
      matchedApplicationAccount: driverMatch.account,
      errorType: errors[0]?.type,
      errorMessage: rowMessage,
    });
  }

  const invalidRows = rows.filter((row) => row.severity === "error").length;
  const duplicateRows = rows.filter((row) => row.errorType === "duplicate_row" || row.errorType === "duplicate_match").length;
  const missingDrivers = rows.filter((row) => row.errorType === "missing_driver").length;
  const missingVehicles = rows.filter((row) => row.errorType === "missing_vehicle").length;
  const missingApplicationAccounts = rows.filter((row) => row.errorType === "unlinked_account").length;

  return {
    rows,
    columns: args.sourceColumns,
    missingColumns,
    summary: {
      fileName: args.fileName,
      importType: args.fileType,
      applicationId: args.applicationId,
      applicationProjectId: args.applicationProjectId,
      templateId: args.templateId,
      totalRows: rows.length,
      validRows: rows.filter((row) => row.severity !== "error").length,
      invalidRows,
      duplicateRows,
      missingRequiredColumns: missingColumns.length,
      missingDrivers,
      missingVehicles,
      missingProjects: 0,
      missingApplicationAccounts,
      rowsReadyToSave: rows.filter((row) => row.severity !== "error").length,
    },
  };
}
