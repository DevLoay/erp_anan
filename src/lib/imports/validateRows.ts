import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { findOperationalAccount, hasBadArabicEncoding, type OperationalScope } from "@/lib/application-accounts/accountLinking";
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
  projectId: string;
  cityId: string;
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
  matchedDrivers?: number;
  unmatchedRows?: number;
  sheetNames?: string[];
  month?: string;
  periodStart?: string;
  periodEnd?: string;
  totals?: Record<string, number | string>;
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

function rawValueByAliases(row: Record<string, unknown>, aliases: string[]) {
  const normalizedMap = new Map<string, string>();
  for (const key of Object.keys(row)) normalizedMap.set(normalizeHeader(key), key);

  for (const alias of aliases) {
    const rawKey = normalizedMap.get(normalizeHeader(alias));
    if (rawKey) {
      const value = valueOf(row, rawKey);
      if (value) return value;
    }
  }

  return "";
}

function withFallback(mapped: Record<string, unknown>, key: string, value: unknown) {
  if (!valueOf(mapped, key) && value !== undefined && value !== null && String(value).trim()) {
    mapped[key] = value;
  }
}

function enrichVehicleMappedData(rawData: Record<string, unknown>, mappedData: Record<string, unknown>) {
  const vehicleCode = rawValueByAliases(rawData, ["Vehicle Code", "VehicleCode", "كود السيارة"]);
  const plateArabic = rawValueByAliases(rawData, ["Plate Arabic", "Plate Ar", "Plate AR", "اللوحة عربي", "اللوحة العربية"]);
  const plateEnglish = rawValueByAliases(rawData, ["Plate English", "Plate En", "Plate EN", "اللوحة إنجليزي", "اللوحة الانجليزية"]);
  const vehicleType = rawValueByAliases(rawData, ["Vehicle Type", "Type", "نوع السيارة"]);
  const model = rawValueByAliases(rawData, ["Model", "الموديل"]);
  const rentalCompany = rawValueByAliases(rawData, ["Rental Company", "شركة التأجير"]);
  const ownerCompany = rawValueByAliases(rawData, ["Owner Company", "الشركة المالكة"]);
  const city = rawValueByAliases(rawData, ["City", "المدينة"]);
  const project = rawValueByAliases(rawData, ["Project", "المشروع", "Application", "التطبيق"]);
  const status = rawValueByAliases(rawData, ["Status", "الحالة"]);
  const currentDriverCode = rawValueByAliases(rawData, ["Current Driver Code", "Assigned Driver Code", "Driver Code", "كود المندوب الحالي", "كود المندوب"]);
  const currentDriverIqama = rawValueByAliases(rawData, ["Current Driver Iqama", "Current Driver Iqaama", "Driver Iqama", "Iqama", "National ID", "إقامة المندوب الحالي", "رقم الإقامة", "الهوية"]);
  const currentDriverName = rawValueByAliases(rawData, ["Current Driver Name", "Assigned Driver Name", "Driver Name", "اسم المندوب الحالي", "اسم المندوب"]);
  const monthlyRent = rawValueByAliases(rawData, ["Monthly Rent", "MonthlyRent", "الإيجار الشهري", "ايجار شهري"]);
  const dailyRent = rawValueByAliases(rawData, ["Daily Rent", "DailyRent", "الإيجار اليومي", "ايجار يومي"]);
  const receivedDate = rawValueByAliases(rawData, ["Received Date", "Handover Date", "Start Date", "تاريخ التسليم", "تاريخ الاستلام"]);
  const authorizationEnd = rawValueByAliases(rawData, ["Authorization End", "Authorization End Date", "Auth End Date", "تاريخ انتهاء التفويض", "نهاية التفويض"]);
  const notes = rawValueByAliases(rawData, ["Notes", "ملاحظات"]);

  withFallback(mappedData, "vehicleCode", vehicleCode);
  withFallback(mappedData, "plateArabic", plateArabic);
  withFallback(mappedData, "plateAr", plateArabic);
  withFallback(mappedData, "plateEnglish", plateEnglish);
  withFallback(mappedData, "plateEn", plateEnglish);
  withFallback(mappedData, "brand", vehicleType);
  withFallback(mappedData, "vehicleType", vehicleType);
  withFallback(mappedData, "model", model);
  withFallback(mappedData, "rentalCompany", rentalCompany);
  withFallback(mappedData, "ownerCompany", ownerCompany);
  withFallback(mappedData, "city", city);
  withFallback(mappedData, "project", project);
  withFallback(mappedData, "status", status);
  withFallback(mappedData, "monthlyRent", monthlyRent);
  withFallback(mappedData, "dailyRent", dailyRent);
  withFallback(mappedData, "receivedDate", receivedDate);
  withFallback(mappedData, "handoverDate", receivedDate);
  withFallback(mappedData, "startDate", receivedDate);
  withFallback(mappedData, "authorizationEnd", authorizationEnd);
  withFallback(mappedData, "notes", notes);

  // These fields are required for driver matching during vehicle imports.
  withFallback(mappedData, "currentDriverCode", currentDriverCode);
  withFallback(mappedData, "assignedDriverCode", currentDriverCode);
  withFallback(mappedData, "driverCode", currentDriverCode);
  withFallback(mappedData, "currentDriverIqama", currentDriverIqama);
  withFallback(mappedData, "assignedDriverIqama", currentDriverIqama);
  withFallback(mappedData, "nationalId", currentDriverIqama);
  withFallback(mappedData, "currentDriverName", currentDriverName);
  withFallback(mappedData, "assignedDriverName", currentDriverName);
  withFallback(mappedData, "name", currentDriverName);

  return mappedData;
}

function numberValue(value: unknown) {
  const numeric = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(numeric) ? numeric : NaN;
}

function validDate(value: unknown) {
  if (!value) return false;
  const raw = String(value).trim().replace(/\.0+$/, "");
  if (/^\d{8}$/.test(raw)) {
    const date = new Date(Date.UTC(Number(raw.slice(0, 4)), Number(raw.slice(4, 6)) - 1, Number(raw.slice(6, 8))));
    return !Number.isNaN(date.getTime());
  }
  const date = new Date(String(value));
  return !Number.isNaN(date.getTime());
}

function reportDateValue(mappedData: Record<string, unknown>) {
  return valueOf(mappedData, "reportDate") || valueOf(mappedData, "date");
}

function isDailyReportImport(fileType: string) {
  return [
    "keeta_invoice",
    "keeta_rank",
    "keeta_period_report_template",
    "hungerstation_invoice",
    "hungerstation_performance",
    "talabat_invoice",
  ].includes(fileType);
}

function isDriverImport(fileType: string) {
  return fileType === "drivers" || fileType.endsWith("_drivers");
}

function isApplicationAccountImport(fileType: string) {
  return fileType === "application_accounts" || fileType.endsWith("_accounts");
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

async function findApplicationAccountForDriver(
  driverId: string,
  scope?: OperationalScope & { projectId?: string },
): Promise<MatchedApplicationAccount | undefined> {
  const account = await prisma.applicationAccount.findFirst({
    where: {
      driverId,
      ...(scope?.applicationId ? { applicationId: scope.applicationId } : {}),
      ...(scope?.applicationProjectId ? { applicationProjectId: scope.applicationProjectId } : {}),
      ...(scope?.cityId ? { cityId: scope.cityId } : {}),
    },
    select: {
      id: true,
      appUserId: true,
      appUsername: true,
      username: true,
      driverId: true,
    },
  });

  if (!account) return undefined;

  return {
    id: account.id,
    appUserId: account.appUserId || account.username || "-",
    appUsername: account.appUsername || account.username || "-",
    driverId: account.driverId || driverId,
  };
}

async function matchDriver(mappedData: Record<string, unknown>, scope?: OperationalScope & { projectId?: string }): Promise<{
  status: "matched" | "missing_driver" | "duplicate_match" | "not_required";
  driver?: MatchedDriver;
  account?: MatchedApplicationAccount;
  message?: string;
}> {
  const driverCode =
    valueOf(mappedData, "driverCode") ||
    valueOf(mappedData, "internalCode") ||
    valueOf(mappedData, "assignedDriverCode") ||
    valueOf(mappedData, "currentDriverCode");
  const nationalId =
    valueOf(mappedData, "nationalId") ||
    valueOf(mappedData, "iqama") ||
    valueOf(mappedData, "iqamaNumber") ||
    valueOf(mappedData, "assignedDriverIqama") ||
    valueOf(mappedData, "currentDriverIqama");
  const courierId = valueOf(mappedData, "courierId") || valueOf(mappedData, "applicationAccountId");
  const appUserId = valueOf(mappedData, "appUserId") || courierId;
  const appUsername =
    valueOf(mappedData, "appUsername") ||
    valueOf(mappedData, "username") ||
    valueOf(mappedData, "assignedDriverName") ||
    valueOf(mappedData, "currentDriverName");
  const mobile = valueOf(mappedData, "mobile") || valueOf(mappedData, "phone");
  const courierName =
    valueOf(mappedData, "courierName") ||
    valueOf(mappedData, "assignedDriverName") ||
    valueOf(mappedData, "currentDriverName") ||
    valueOf(mappedData, "name") ||
    [valueOf(mappedData, "courierFirstName"), valueOf(mappedData, "courierLastName")].filter(Boolean).join(" ").trim();

  if (!driverCode && !nationalId && !appUserId && !appUsername && !mobile && !courierName) return { status: "not_required" };

  const accountMatch = await findOperationalAccount(prisma, scope ?? {}, { appUserId, appUsername });

  if (accountMatch && "duplicate" in accountMatch) {
    return { status: "duplicate_match", message: "يوجد أكثر من حساب تطبيق بنفس المعرف داخل نطاق التشغيل. راجع ربط الحسابات قبل الاعتماد." };
  }

  const account = accountMatch
    ? {
        id: accountMatch.id,
        appUserId: accountMatch.appUserId || accountMatch.username || "-",
        appUsername: accountMatch.appUsername || accountMatch.username || "-",
        driverId: accountMatch.driverId || "",
      }
    : undefined;

  if (accountMatch?.driver) {
    return {
      status: "matched",
      account,
      driver: {
        id: accountMatch.driver.id,
        code: accountMatch.driver.internalCode || accountMatch.driver.driverCode || "-",
        name: accountMatch.driver.actualName || accountMatch.driver.name,
        nationalId: accountMatch.driver.nationalId || "-",
      },
    };
  }

  if (accountMatch && !accountMatch.driverId) {
    return { status: "missing_driver", account, message: "الحساب موجود لكنه غير مربوط بمندوب داخلي. اربطه من مراجعة حسابات التطبيقات أو من شاشة المعاينة." };
  }

  const driverMatches = await prisma.driver.findMany({
    where: {
      OR: [
        driverCode ? { internalCode: driverCode } : undefined,
        driverCode ? { driverCode } : undefined,
        nationalId ? { nationalId } : undefined,
        mobile ? { mobile } : undefined,
        mobile ? { phone: mobile } : undefined,
        courierName ? { name: { equals: courierName, mode: "insensitive" } } : undefined,
        courierName ? { actualName: { equals: courierName, mode: "insensitive" } } : undefined,
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

  const drivers = [...combined.values()];

  if (!drivers.length) return { status: "missing_driver", account, message: "لم يتم العثور على مندوب مطابق داخل جدول Driver أو حسابات التطبيق." };
  if (drivers.length > 1) return { status: "duplicate_match", account, message: "تم العثور على أكثر من مندوب مطابق. راجع الصف قبل الاعتماد." };

  const driver = drivers[0];
  const accountForDriver = await findApplicationAccountForDriver(driver.id, scope);

  return { status: "matched", driver, account: accountForDriver ?? account };
}

function basicValidation(fileType: string, mappedData: Record<string, unknown>) {
  const errors: { type: string; message: string }[] = [];
  const hasDriverIdentifier = Boolean(
    valueOf(mappedData, "driverCode") ||
      valueOf(mappedData, "internalCode") ||
      valueOf(mappedData, "nationalId") ||
      valueOf(mappedData, "assignedDriverCode") ||
      valueOf(mappedData, "currentDriverCode") ||
      valueOf(mappedData, "assignedDriverIqama") ||
      valueOf(mappedData, "currentDriverIqama") ||
      valueOf(mappedData, "appUserId") ||
      valueOf(mappedData, "appUsername") ||
      valueOf(mappedData, "courierId"),
  );
  const textFields = ["actualName", "name", "courierName", "appUsername", "username", "courierFirstName", "courierLastName"];
  if (textFields.some((field) => hasBadArabicEncoding(mappedData[field]))) {
    errors.push({ type: "invalid_encoding", message: "يوجد نص عربي محفوظ بترميز غير صحيح. راجع الصف قبل الاعتماد." });
  }

  if (isDriverImport(fileType)) {
    if (!hasDriverIdentifier) errors.push({ type: "missing_driver_identifier", message: "بيانات ربط المندوب مطلوبة." });
    if (!valueOf(mappedData, "actualName") && !valueOf(mappedData, "name")) errors.push({ type: "missing_name", message: "اسم المندوب مطلوب." });
  }

  if (fileType === "vehicles") {
    if (!valueOf(mappedData, "plateArabic") && !valueOf(mappedData, "plateEnglish") && !valueOf(mappedData, "vehicleCode")) errors.push({ type: "missing_vehicle_identifier", message: "كود السيارة أو اللوحة مطلوب." });
    if (valueOf(mappedData, "monthlyRent") && Number.isNaN(numberValue(mappedData.monthlyRent))) errors.push({ type: "invalid_number", message: "الإيجار الشهري يجب أن يكون رقمًا." });
  }

  if (isApplicationAccountImport(fileType)) {
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
    if (isDailyReportImport(fileType) && !validDate(reportDateValue(mappedData))) errors.push({ type: "invalid_report_date", message: "Report date is required and must be valid before saving the daily report." });
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
  projectId: string;
  cityId: string;
  templateId: string;
}): Promise<{ summary: ImportPreviewSummary; rows: ImportPreviewRow[]; columns: string[]; missingColumns: ImportColumn[] }> {
  const allColumns = [...args.requiredColumns, ...args.optionalColumns];
  const missingColumns = missingRequiredColumns(args.sourceColumns, args.requiredColumns);
  const rows: ImportPreviewRow[] = [];
  const seenMainIdentifiers = new Set<string>();

  for (const [index, rawData] of args.rawRows.entries()) {
    const mappedData =
      args.fileType === "vehicles"
        ? enrichVehicleMappedData(rawData, mapRawRow(rawData, allColumns, args.columnMapping))
        : mapRawRow(rawData, allColumns, args.columnMapping);
    const primaryIdentifier =
      valueOf(mappedData, "driverCode") ||
      valueOf(mappedData, "nationalId") ||
      valueOf(mappedData, "courierId") ||
      valueOf(mappedData, "appUserId") ||
      valueOf(mappedData, "appUsername") ||
      valueOf(mappedData, "vehicleCode") ||
      valueOf(mappedData, "plateEnglish") ||
      `row-${index + 2}`;
    const mainIdentifier =
      isDailyReportImport(args.fileType)
        ? `${reportDateValue(mappedData) || "no-date"}-${primaryIdentifier}`
        : primaryIdentifier;

    const errors = [...basicValidation(args.fileType, mappedData)];

    if (mainIdentifier && seenMainIdentifiers.has(mainIdentifier)) {
      errors.push({ type: "duplicate_row", message: "هذا الصف مكرر داخل الملف." });
    }
    seenMainIdentifiers.add(mainIdentifier);

    const vehicleHasDriverData = Boolean(
      valueOf(mappedData, "assignedDriverCode") ||
        valueOf(mappedData, "currentDriverCode") ||
        valueOf(mappedData, "assignedDriverIqama") ||
        valueOf(mappedData, "currentDriverIqama") ||
        valueOf(mappedData, "assignedDriverName") ||
        valueOf(mappedData, "currentDriverName"),
    );
    const driverMatch =
      args.fileType === "vehicles" && !vehicleHasDriverData
        ? { status: "not_required" as const }
        : await matchDriver(mappedData, {
            applicationId: args.applicationId,
            applicationProjectId: args.applicationProjectId,
            cityId: args.cityId,
          });
    if (driverMatch.status === "missing_driver") {
      errors.push({
        type: args.fileType === "vehicles" ? "missing_driver_vehicle" : "missing_driver",
        message:
          driverMatch.message ??
          (args.fileType === "vehicles"
            ? "لم يتم العثور على مندوب مطابق للسيارة، سيتم حفظ السيارة بدون مندوب حتى تتم مراجعتها."
            : "لم يتم العثور على المندوب."),
      });
    }
    if (driverMatch.status === "duplicate_match") errors.push({ type: "duplicate_match", message: driverMatch.message ?? "نتائج ربط متعددة." });

    const vehicleMatch = ["vehicles", "violations", "fuel"].includes(args.fileType) ? await matchVehicleFromMappedData(mappedData) : { status: "not_required" as const };
    if (vehicleMatch.status === "missing_vehicle" && ["violations", "fuel"].includes(args.fileType) && valueOf(mappedData, "vehiclePlate")) {
      errors.push({ type: "missing_vehicle", message: vehicleMatch.message ?? "لم يتم العثور على السيارة." });
    }
    if (vehicleMatch.status === "duplicate_match") errors.push({ type: "duplicate_match", message: vehicleMatch.message ?? "نتائج ربط سيارة متعددة." });

    const hardErrors = errors.filter((error) => error.type !== "new_vehicle" && error.type !== "missing_driver_vehicle");
    const severity: ImportPreviewRow["severity"] = hardErrors.length ? "error" : errors.length ? "warning" : "ready";
    const rowStatus =
      isDriverImport(args.fileType) && severity === "ready"
        ? driverMatch.status === "matched"
          ? "update_existing_record"
          : "new_record"
        : args.fileType === "vehicles" && severity === "ready"
          ? vehicleMatch.status === "matched"
            ? "update_existing_record"
            : "new_vehicle"
        : severity === "ready"
          ? "ready"
          : severity === "warning"
            ? "warning"
            : errors[0]?.type ?? "invalid";
    const rowMessage =
      args.fileType === "vehicles" && severity === "ready" && vehicleMatch.status !== "matched"
        ? "سيارة جديدة جاهزة للحفظ عند الاعتماد."
        : args.fileType === "vehicles" && severity === "ready" && vehicleMatch.status === "matched"
          ? "سيارة موجودة وسيتم تحديث بياناتها عند الاعتماد."
          : isDriverImport(args.fileType) && severity === "ready" && driverMatch.status !== "matched"
        ? "سجل مندوب جديد جاهز للحفظ عند الاعتماد."
        : isDriverImport(args.fileType) && severity === "ready" && driverMatch.status === "matched"
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
  const missingDrivers = rows.filter((row) => row.errorType === "missing_driver" || row.errorType === "missing_driver_vehicle").length;
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
      projectId: args.projectId,
      cityId: args.cityId,
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
