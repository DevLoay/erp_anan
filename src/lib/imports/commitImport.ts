import { DriverStatus, Prisma, RecordStatus, VehicleStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { importTypeRequiresProject } from "./importScopes";
import { KEETA_DRIVER_INVOICE_TEMPLATE, KEETA_PERIOD_REPORT_TEMPLATE, KEETA_RANK_TEMPLATE } from "./templates";
import { commitKeetaRecords, isKeetaOperationalImport, keetaInvoiceAmount } from "./keetaImport";
import { commitHungerStationRecords } from "./hungerstationImport";
import {
  createImportedDriver,
  findDriverByIdentifiers,
  findOperationalAccount,
  findOrCreateApplication as findOrCreateOperationalApplication,
  resolveOperationalProject,
  upsertOperationalApplicationAccount,
} from "@/lib/application-accounts/accountLinking";
import { findOrCreateNormalizedCity } from "@/lib/cities/cityNormalization";
import type { ImportPreviewPayload } from "./previewImport";
import type { ImportPreviewRow } from "./validateRows";

function json(value: unknown) {
  if (value === undefined || value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function canonicalImportType(importType: string) {
  if (importType === "keeta_invoice") return KEETA_DRIVER_INVOICE_TEMPLATE;
  if (importType === "keeta_rank") return KEETA_RANK_TEMPLATE;
  return importType;
}

function normalizeLookup(value: unknown) {
  return text(value)
    .toLowerCase()
    .replace(/[\s\-_]+/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function normalizePlate(value: unknown) {
  return text(value)
    .toUpperCase()
    .replace(/[\s\-_]+/g, "")
    .replace(/[^A-Z0-9\p{L}\p{N}]/gu, "");
}

function vehiclePlateWhere(vehicleCode: string, plateEnglish: string, plateArabic: string): Prisma.VehicleWhereInput[] {
  const normalizedCode = normalizePlate(vehicleCode);
  const normalizedPlateEn = normalizePlate(plateEnglish);
  const normalizedPlateAr = normalizePlate(plateArabic);
  const conditions: Prisma.VehicleWhereInput[] = [];

  if (vehicleCode) conditions.push({ vehicleCode });
  if (plateEnglish) {
    conditions.push({ plateEn: plateEnglish }, { plateEnglish });
  }
  if (plateArabic) {
    conditions.push({ plateAr: plateArabic }, { plateArabic });
  }

  // Fallback matching for plates saved with spaces/dashes or mixed formats.
  if (normalizedCode) {
    conditions.push({ vehicleCode: { contains: normalizedCode, mode: "insensitive" } });
  }
  if (normalizedPlateEn) {
    conditions.push(
      { plateEn: { contains: normalizedPlateEn, mode: "insensitive" } },
      { plateEnglish: { contains: normalizedPlateEn, mode: "insensitive" } },
    );
  }
  if (normalizedPlateAr) {
    conditions.push(
      { plateAr: { contains: normalizedPlateAr, mode: "insensitive" } },
      { plateArabic: { contains: normalizedPlateAr, mode: "insensitive" } },
    );
  }

  return conditions;
}

function normalizeCode(value: string) {
  return value.trim().replace(/\s+/g, "_").replace(/[^\p{L}\p{N}_-]/gu, "").toUpperCase() || "APP";
}

function isDriverImport(importType: string) {
  return importType === "drivers" || importType.endsWith("_drivers");
}

function isApplicationAccountImport(importType: string) {
  return importType === "application_accounts" || importType.endsWith("_accounts");
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

function vehicleStatus(value: unknown) {
  const raw = text(value).toLowerCase();
  if (["assigned", "مخصصة", "مع مندوب"].includes(raw)) return VehicleStatus.ASSIGNED;
  if (["maintenance", "صيانة"].includes(raw)) return VehicleStatus.MAINTENANCE;
  if (["accident", "حادث"].includes(raw)) return VehicleStatus.ACCIDENT;
  if (["inactive", "غير نشط", "موقوف"].includes(raw)) return VehicleStatus.INACTIVE;
  return VehicleStatus.AVAILABLE;
}

function numberValue(value: unknown, fallback = 0) {
  const raw = text(value).replace(/,/g, "").replace("%", "");
  if (!raw) return fallback;
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function decimalNumber(value: unknown) {
  if (value instanceof Prisma.Decimal) return value.toNumber();
  return numberValue(value);
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

function intValue(value: unknown, fallback = 0) {
  return Math.round(numberValue(value, fallback));
}

function excelSerialDate(value: number) {
  // Excel serial date system; 25569 = 1970-01-01.
  // Handles typical modern serials such as 45810.
  if (!Number.isFinite(value) || value < 20000 || value > 70000) return null;
  const utcDays = Math.floor(value - 25569);
  const utcValue = utcDays * 86400 * 1000;
  const date = new Date(utcValue);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parsedDateValue(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number") {
    const excelDate = excelSerialDate(value);
    if (excelDate) return excelDate;
  }
  const raw = text(value);
  if (/^\d+(?:\.\d+)?$/.test(raw)) {
    const excelDate = excelSerialDate(Number(raw));
    if (excelDate) return excelDate;
  }
  if (raw) {
    const compact = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (compact) {
      const parsed = new Date(Date.UTC(Number(compact[1]), Number(compact[2]) - 1, Number(compact[3])));
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function endOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 23, 59, 59, 999));
}

function dateValue(value: unknown, fallback = new Date()) {
  const parsed = parsedDateValue(value);
  if (parsed) return parsed;
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
  return "";
}

function appNameFromScopeText(value: unknown) {
  const raw = normalizeLookup(value);
  if (!raw) return "";
  if (raw.includes("hungerstation") || raw.includes("hunger") || raw.includes("هنجر") || raw.includes("هنقر")) return "HungerStation";
  if (raw.includes("keeta") || raw.includes("kita") || raw.includes("كيتا")) return "Keeta";
  if (raw.includes("talabat") || raw.includes("طلبات")) return "Talabat";
  if (raw.includes("ninja") || raw.includes("نينجا")) return "Ninja";
  if (raw.includes("toyou") || raw.includes("تويو") || raw.includes("توي") || raw.includes("تويو")) return "ToYou";
  return "";
}

function driverRowScope(preview: ImportPreviewPayload | undefined, mapped: Record<string, unknown>, selectedApplicationName: string, selectedProjectName?: string | null) {
  const importType = preview?.summary.importType ?? "";
  const genericDriverImport = importType === "drivers";
  const appFromProject = appNameFromScopeText(mapped.project);
  const appFromApplicationName = appNameFromScopeText(mapped.applicationName);
  const explicitRowScope = Boolean(text(mapped.project) || text(mapped.applicationName) || appFromProject || appFromApplicationName);
  const lockedProjectId = preview?.summary.applicationProjectId && (!genericDriverImport || !explicitRowScope)
    ? preview.summary.applicationProjectId
    : "";
  const lockedApplicationId = lockedProjectId ? preview?.summary.applicationId || "" : "";

  const appName =
    (genericDriverImport ? appFromProject || appFromApplicationName || text(mapped.applicationName) || text(mapped.project) : "") ||
    appNameFromImportType(importType) ||
    selectedApplicationName ||
    appNameFromScopeText(selectedProjectName) ||
    text(mapped.applicationName) ||
    "";

  return { appName, lockedProjectId, lockedApplicationId };
}


function isHungerStationScope(value: unknown) {
  const raw = normalizeLookup(value);
  return raw.includes("hungerstation") || raw.includes("hunger") || raw.includes("هنجر") || raw.includes("هنقر");
}

function expectedCityCodeFromScope(value: unknown) {
  const raw = normalizeLookup(value);
  if (!raw) return "";
  if (raw.includes("makkah") || raw.includes("mecca") || raw.includes("مكة")) return "MAKKAH";
  if (raw.includes("dammam") || raw.includes("الدمام")) return "DAMMAM";
  if (raw.includes("ahsa") || raw.includes("الأحساء") || raw.includes("الاحساء") || raw.includes("الإحساء")) return "AHSA";
  if (raw.includes("riyadh") || raw.includes("الرياض")) return "RIYADH";
  if (raw.includes("jeddah") || raw.includes("جدة")) return "JEDDAH";
  if (raw.includes("madinah") || raw.includes("medina") || raw.includes("المدينة")) return "MADINAH";
  if (raw.includes("abha") || raw.includes("أبها")) return "ABHA";
  if (raw.includes("taif") || raw.includes("الطائف")) return "TAIF";
  return "";
}

function codeContainsDifferentCity(code: string, expectedCityCode: string) {
  if (!code || !expectedCityCode) return false;
  const normalized = normalizeCode(code);
  const cityTokens = ["DAMMAM", "MAKKAH", "MECCA", "AHSA", "RIYADH", "JEDDAH", "MADINAH", "MEDINA", "ABHA", "TAIF"];
  return cityTokens.some((token) => normalized.includes(token) && token !== expectedCityCode && !(expectedCityCode === "MAKKAH" && token === "MECCA") && !(expectedCityCode === "MADINAH" && token === "MEDINA"));
}

function isUnsafeDriverCodeForScope(code: unknown, appName: unknown, projectCode: unknown, cityName: unknown) {
  const rawCode = text(code);
  if (!rawCode) return false;

  const normalizedCode = normalizeCode(rawCode);
  const scopeText = [appName, projectCode, cityName].map(text).join(" ");
  const expectedCityCode = expectedCityCodeFromScope(scopeText);

  if (isHungerStationScope(scopeText) && normalizedCode.includes("KEETA")) return true;
  if (isHungerStationScope(scopeText) && normalizedCode.includes("KETA")) return true;
  if (codeContainsDifferentCity(rawCode, expectedCityCode)) return true;

  return false;
}

async function keepExistingSupervisorIfValid(tx: Prisma.TransactionClient, driverId: string, cityId: string | null) {
  const driver = await tx.driver.findUnique({
    where: { id: driverId },
    select: {
      supervisorId: true,
      supervisor: { select: { cityId: true } },
    },
  });

  if (!driver?.supervisorId) return null;
  if (!cityId) return driver.supervisorId;
  if (!driver.supervisor?.cityId) return null;
  return driver.supervisor.cityId === cityId ? driver.supervisorId : null;
}

function firstReportDate(rows: ImportPreviewRow[]) {
  for (const row of rows) {
    const parsed = parsedDateValue(row.mappedData.reportDate || row.mappedData.date);
    if (parsed) return parsed;
  }
  return null;
}

function reportDateRange(rows: ImportPreviewRow[]) {
  const dates = rows
    .map((row) => parsedDateValue(row.mappedData.reportDate || row.mappedData.date))
    .filter((date): date is Date => Boolean(date))
    .sort((a, b) => a.getTime() - b.getTime());

  return {
    periodStart: dates[0] ? startOfUtcDay(dates[0]) : null,
    periodEnd: dates[dates.length - 1] ? endOfUtcDay(dates[dates.length - 1]) : null,
  };
}

function firstText(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = text(record[key]);
    if (value) return value;
  }
  return "";
}

async function uniqueDriverInternalCode(tx: Prisma.TransactionClient, preferred: string, scopeKey?: string | null, existingId?: string | null) {
  const base = preferred || `DRV-${scopeKey || "IMPORT"}`;
  const current = await tx.driver.findUnique({ where: { internalCode: base }, select: { id: true } });
  if (!current || current.id === existingId) return base;

  const scopedPrefix = normalizeCode(scopeKey || "IMPORT").slice(0, 24) || "IMPORT";
  const scoped = `${scopedPrefix}-${base}`.slice(0, 80);
  const scopedCurrent = await tx.driver.findUnique({ where: { internalCode: scoped }, select: { id: true } });
  if (!scopedCurrent || scopedCurrent.id === existingId) return scoped;
  return `${scoped}-${Date.now().toString(36)}`;
}

function cityAliases(name: string) {
  const raw = name.trim();
  const normalized = raw.toLowerCase();
  if (raw.includes("مكة") || normalized.includes("makkah") || normalized.includes("mecca")) return ["مكة", "Makkah", "Mecca"];
  if (raw.includes("المدينة") || normalized.includes("madinah") || normalized.includes("medina")) return ["المدينة المنورة", "المدينة", "Madinah", "Medina"];
  if (raw.includes("الرياض") || normalized.includes("riyadh")) return ["الرياض", "Riyadh"];
  if (raw.includes("الدمام") || normalized.includes("dammam")) return ["الدمام", "Dammam"];
  if (["mecca", "makkah", "makka", "makkah al mukarramah"].includes(normalized) || raw.includes("مكة")) return ["مكة", "Makkah", "Mecca"];
  if (["madinah", "medina", "al madinah"].includes(normalized) || raw.includes("المدينة")) return ["المدينة المنورة", "المدينة", "Madinah", "Medina"];
  if (["riyadh"].includes(normalized) || raw.includes("الرياض")) return ["الرياض", "Riyadh"];
  if (["dammam"].includes(normalized) || raw.includes("الدمام")) return ["الدمام", "Dammam"];
  return [raw];
}

async function findOrCreateCity(tx: Prisma.TransactionClient, name: string) {
  if (!name) return null;
  const city = await findOrCreateNormalizedCity(tx, name);
  return city?.id ?? null;
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
  const application = await findOrCreateOperationalApplication(tx, name);
  return application.id;
}

async function findApplicationName(tx: Prisma.TransactionClient, id: string | null | undefined) {
  if (!id) return "";
  const application = await tx.application.findUnique({ where: { id }, select: { name: true } });
  return application?.name ?? "";
}

async function findProjectFromApplicationProject(tx: Prisma.TransactionClient, id: string | null | undefined) {
  if (!id) return null;
  return tx.applicationProject.findUnique({
    where: { id },
    select: { id: true, projectId: true, cityId: true, name: true, application: { select: { id: true, name: true } } },
  });
}

async function findDriverForRow(tx: Prisma.TransactionClient, row: ImportPreviewRow, preview?: ImportPreviewPayload) {
  if (row.driverId) {
    const driver = await tx.driver.findUnique({
      where: { id: row.driverId },
      select: { id: true, cityId: true, projectId: true, vehicleId: true, accountId: true },
    });
    if (driver) return driver;
  }

  const mapped = row.mappedData;
  const driverCode = firstText(mapped, ["driverCode", "internalCode", "currentDriverCode", "currentDriverId", "driver_code"]);
  const nationalId = firstText(mapped, ["nationalId", "iqama", "iqamaNumber", "currentDriverIqaama", "currentDriverIqama", "currentDriverNationalId"]);
  const appUserId = firstText(mapped, ["appUserId", "currentDriverCode"]);
  const appUsername = firstText(mapped, ["appUsername", "username", "currentDriverName"]);
  const mobile = firstText(mapped, ["mobile", "phone", "currentDriverMobile", "currentDriverPhone"]);
  const name = firstText(mapped, ["actualName", "name", "courierName", "currentDriverName"]);

  const account = await findOperationalAccount(tx, {
    applicationId: preview?.summary.applicationId || null,
    applicationProjectId: preview?.summary.applicationProjectId || null,
    cityId: preview?.summary.cityId || null,
  }, { appUserId, appUsername });
  if (account && !("duplicate" in account) && account.driverId) {
    const driver = await tx.driver.findUnique({
      where: { id: account.driverId },
      select: { id: true, cityId: true, projectId: true, vehicleId: true, accountId: true },
    });
    if (driver) return driver;
  }

  return findDriverByIdentifiers(tx, { driverCode, nationalId, mobile, appUserId, appUsername, name }, {
    applicationId: preview?.summary.applicationId || null,
    applicationProjectId: preview?.summary.applicationProjectId || null,
    cityId: preview?.summary.cityId || null,
  }) as Promise<{ id: string; cityId: string | null; projectId: string | null; vehicleId?: string | null; accountId?: string | null } | null>;
}

async function commitDriverRows(tx: Prisma.TransactionClient, rows: ImportPreviewRow[], preview?: ImportPreviewPayload) {
  let createdDrivers = 0;
  let updatedDrivers = 0;
  let createdAccounts = 0;
  let updatedAccounts = 0;
  const selectedProject = preview ? await findProjectFromApplicationProject(tx, preview.summary.applicationProjectId) : null;
  const selectedApplicationName = preview ? await findApplicationName(tx, preview.summary.applicationId) : null;
  const scopedCityId = preview?.summary.cityId || selectedProject?.cityId || null;

  for (const row of rows) {
    const mapped = row.mappedData;
    const driverCode = text(mapped.driverCode);
    const nationalId = text(mapped.nationalId);
    const actualName = text(mapped.actualName) || text(mapped.name);

    const cityName = text(mapped.city);
    const appUserId = text(mapped.appUserId);
    const appUsername = text(mapped.appUsername);
    const mobile = text(mapped.mobile);
    if ((!driverCode && !nationalId && !appUserId && !appUsername && !mobile) || !actualName) continue;

    const rowScope = driverRowScope(preview, mapped, selectedApplicationName || selectedProject?.application.name || "", selectedProject?.name);
    const appName = rowScope.appName || selectedProject?.application.name || appNameFromImportType(preview?.summary.importType ?? "");

    const cityId = (rowScope.lockedProjectId ? scopedCityId : null) ?? (await findOrCreateCity(tx, cityName)) ?? scopedCityId;
    const applicationId =
      rowScope.lockedApplicationId ||
      (rowScope.lockedProjectId ? selectedProject?.application.id || null : null) ||
      (await findOrCreateApplication(tx, appName || selectedApplicationName || selectedProject?.application.name || ""));
    const operationalProject = await resolveOperationalProject(tx, {
      applicationId,
      applicationName: appName,
      applicationProjectId: rowScope.lockedProjectId,
      cityId,
    });
    const applicationProjectId = rowScope.lockedProjectId || operationalProject?.id || null;
    const projectId = null;

    let existingAccount: { id: string; username: string; driverId: string | null } | null = null;
    if (appUserId || appUsername) {
      const accountMatch = await findOperationalAccount(tx, { applicationId, applicationProjectId, cityId }, { appUserId, appUsername });
      if (accountMatch && "duplicate" in accountMatch) {
        const preferred =
          accountMatch.matches.find((account) => account.applicationProjectId === applicationProjectId && account.cityId === cityId) ??
          accountMatch.matches.find((account) => !account.applicationProjectId && account.applicationId === applicationId && account.cityId === cityId) ??
          accountMatch.matches.find((account) => account.driverId) ??
          null;
        existingAccount = preferred ? { id: preferred.id, username: preferred.username, driverId: preferred.driverId } : null;
      } else if (accountMatch) {
        existingAccount = { id: accountMatch.id, username: accountMatch.username, driverId: accountMatch.driverId };
      }
    }

    const scopedOperationalImport = Boolean(applicationProjectId && (appUserId || appUsername));
    let existingDriver: { id: string; internalCode: string; driverCode: string | null; supervisorId?: string | null } | null = null;

    if (existingAccount?.driverId) {
      existingDriver = await tx.driver.findUnique({
        where: { id: existingAccount.driverId },
        select: { id: true, internalCode: true, driverCode: true, supervisorId: true },
      });
    }

    if (!existingDriver) {
      // عند رفع ملف مناديب فيه Keeta Courier ID، لازم نطابق المندوب القديم
      // برقم الإقامة/الكود/الجوال قبل إنشاء مندوب جديد.
      // النسخة القديمة كانت تمنع البحث المباشر لو appUserId موجود، وده كان ممكن يعمل Duplication
      // بعد إصلاح مابنج Keeta Courier ID.
      const lookupAttempts: Prisma.DriverWhereInput[] = [];
      if (nationalId) lookupAttempts.push({ nationalId });
      if (driverCode) lookupAttempts.push({ internalCode: driverCode }, { driverCode });
      if (mobile) lookupAttempts.push({ mobile }, { phone: mobile });

      for (const where of lookupAttempts) {
        const matches = await tx.driver.findMany({
          where,
          select: { id: true, internalCode: true, driverCode: true, supervisorId: true },
          take: 2,
        });
        if (matches.length === 1) {
          existingDriver = matches[0];
          break;
        }
      }
    }

    const scopeCode = operationalProject?.code || applicationProjectId || cityId || appName;
    const importedDriverCodeIsUnsafe = isUnsafeDriverCodeForScope(driverCode, appName, operationalProject?.code || operationalProject?.name || "", cityName);
    const existingInternalCodeIsUnsafe = existingDriver ? isUnsafeDriverCodeForScope(existingDriver.internalCode, appName, operationalProject?.code || operationalProject?.name || "", cityName) : false;
    const existingDriverCodeIsUnsafe = existingDriver ? isUnsafeDriverCodeForScope(existingDriver.driverCode, appName, operationalProject?.code || operationalProject?.name || "", cityName) : false;
    const safeImportedDriverCode = importedDriverCodeIsUnsafe ? "" : driverCode;
    const preferredCodeSeed = normalizeCode(safeImportedDriverCode || appUserId || mobile || String(row.rowNumber));
    const preferredInternalCode = scopedOperationalImport
      ? `${normalizeCode(operationalProject?.code || applicationProjectId || appName)}-${preferredCodeSeed}`.slice(0, 80)
      : safeImportedDriverCode || appUserId || mobile || `DRV-${row.rowNumber}`;
    const internalCode =
      existingDriver && !existingInternalCodeIsUnsafe
        ? existingDriver.internalCode
        : await uniqueDriverInternalCode(
            tx,
            preferredInternalCode,
            scopeCode,
            existingDriver?.id,
          );
    const sourceDriverCode = safeImportedDriverCode || (existingDriver?.driverCode && !existingDriverCodeIsUnsafe ? existingDriver.driverCode : "") || internalCode;
    const vehicleOwnership = normalizeLookup(mapped.vehicleOwnership);
    const safeSupervisorId = existingDriver?.id ? await keepExistingSupervisorIfValid(tx, existingDriver.id, cityId) : null;

    const driverData = {
      internalCode,
      driverCode: sourceDriverCode,
      nationalId: nationalId || null,
      name: actualName,
      actualName,
      phone: mobile || null,
      mobile: mobile || null,
      nationality: text(mapped.nationality) || null,
      cityId,
      projectId,
      supervisorId: safeSupervisorId,
      contractType: text(mapped.contractType) || null,
      accommodationType: text(mapped.accommodationType) || null,
      housingStatus: text(mapped.accommodationType) || null,
      status: driverStatus(mapped.appStatus),
      vehicleOwnershipType: vehicleOwnership.includes("personal") || vehicleOwnership.includes("شخص")
        ? "personal_car"
        : vehicleOwnership.includes("company") || vehicleOwnership.includes("شركة") || vehicleOwnership.includes("شركه")
          ? "company_car"
          : "no_vehicle",
      needsReview: Boolean(importedDriverCodeIsUnsafe || existingInternalCodeIsUnsafe || existingDriverCodeIsUnsafe),
      source: importedDriverCodeIsUnsafe ? "IMPORT_CODE_NORMALIZED" : "IMPORT",
    };

    const driver = existingDriver
      ? await tx.driver.update({ where: { id: existingDriver.id }, data: driverData, select: { id: true } })
      : await tx.driver.create({ data: driverData, select: { id: true } });

    if (existingDriver) updatedDrivers += 1;
    else createdDrivers += 1;

    if (appUserId || appUsername || appName) {
      const account = await upsertOperationalApplicationAccount(tx, {
        appName: appName || "Unknown",
        appUserId: appUserId || null,
        appUsername,
        username: appUsername || appUserId || `${appName || "APP"}-${driverCode}`,
        applicationId,
        applicationProjectId,
        cityId,
        driverId: driver.id,
        source: "IMPORT",
        status: recordStatus(mapped.appStatus),
        existingId: existingAccount?.id,
      });

      if (account.wasCreated) createdAccounts += 1;
      else updatedAccounts += 1;
    }
  }

  return { createdDrivers, updatedDrivers, createdAccounts, updatedAccounts };
}

async function commitApplicationAccountRows(tx: Prisma.TransactionClient, rows: ImportPreviewRow[], preview: ImportPreviewPayload) {
  let createdAccounts = 0;
  let updatedAccounts = 0;
  const selectedApplicationName = await findApplicationName(tx, preview.summary.applicationId);
  const selectedProject = await findProjectFromApplicationProject(tx, preview.summary.applicationProjectId);

  for (const row of rows) {
    const mapped = row.mappedData;
    const appUserId = text(mapped.appUserId);
    const appUsername = firstText(mapped, ["appUsername", "username"]);
    if (!appUserId && !appUsername) continue;

    const driver = await findDriverForRow(tx, row, preview);
    const appName = text(mapped.applicationName) || selectedApplicationName || selectedProject?.application.name || "Unknown";
    const applicationId = preview.summary.applicationId || selectedProject?.application.id || (await findOrCreateApplication(tx, appName));
    const cityName = text(mapped.city);
    const cityId = (preview.summary.cityId || selectedProject?.cityId) ?? driver?.cityId ?? (cityName ? await findOrCreateCity(tx, cityName) : null);
    const operationalProject = await resolveOperationalProject(tx, {
      applicationId,
      applicationName: appName,
      applicationProjectId: preview.summary.applicationProjectId,
      cityId,
    });
    const applicationProjectId = preview.summary.applicationProjectId || operationalProject?.id || null;
    const preferredUsername = appUsername || appUserId;

    const account = await upsertOperationalApplicationAccount(tx, {
      appName,
      appUserId: appUserId || null,
      appUsername,
      username: preferredUsername,
      applicationId: applicationId || null,
      applicationProjectId,
      cityId,
      driverId: driver?.id ?? null,
      source: "IMPORT",
      status: recordStatus(mapped.status || mapped.appStatus),
    });

    if (account.wasCreated) createdAccounts += 1;
    else updatedAccounts += 1;
  }

  return { createdAccounts, updatedAccounts };
}


async function findVehicleForVehicleImport(
  tx: Prisma.TransactionClient,
  vehicleCode: string,
  plateEnglish: string,
  plateArabic: string,
) {
  const plateConditions = [
    plateEnglish ? { plateEn: plateEnglish } : undefined,
    plateEnglish ? { plateEnglish } : undefined,
    plateArabic ? { plateAr: plateArabic } : undefined,
    plateArabic ? { plateArabic } : undefined,
  ].filter(Boolean) as Prisma.VehicleWhereInput[];

  const plateMatch = plateConditions.length
    ? await tx.vehicle.findFirst({
        where: { OR: plateConditions },
        select: { id: true, vehicleCode: true, plateEn: true, plateEnglish: true, plateAr: true, plateArabic: true },
      })
    : null;

  const codeMatch = vehicleCode
    ? await tx.vehicle.findFirst({
        where: { vehicleCode },
        select: { id: true, vehicleCode: true, plateEn: true, plateEnglish: true, plateAr: true, plateArabic: true },
      })
    : null;

  // اللوحة هي المفتاح الأقوى. لو Vehicle Code يشير لسجل آخر، لا نحدث سجل الكود بلوحة موجودة على سيارة ثانية.
  const vehicle = plateMatch ?? codeMatch ?? null;
  return { vehicle, plateMatch, codeMatch };
}

function removeUndefinedValues<T extends Record<string, unknown>>(data: T) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)) as T;
}


async function commitVehicleRows(tx: Prisma.TransactionClient, rows: ImportPreviewRow[], preview?: ImportPreviewPayload) {
  let createdVehicles = 0;
  let updatedVehicles = 0;
  let assignments = 0;
  let movements = 0;
  let linkedDrivers = 0;
  let unmatchedDrivers = 0;
  const selectedProject = preview ? await findProjectFromApplicationProject(tx, preview.summary.applicationProjectId) : null;
  const scopedCityId = preview?.summary.cityId || selectedProject?.cityId || null;

  for (const row of rows) {
    const mapped = row.mappedData;

    const plateEnglish = firstText(mapped, ["plateEnglish", "plateEn", "vehiclePlate", "plate"]);
    const plateArabic = firstText(mapped, ["plateArabic", "plateAr"]);
    const vehicleCode = text(mapped.vehicleCode);
    if (!plateEnglish && !plateArabic && !vehicleCode) continue;

    const { vehicle: existing, plateMatch, codeMatch } = await findVehicleForVehicleImport(tx, vehicleCode, plateEnglish, plateArabic);
    const hasCodePlateConflict = Boolean(plateMatch && codeMatch && plateMatch.id !== codeMatch.id);

    const cityId = scopedCityId ?? (text(mapped.city) ? await findOrCreateCity(tx, text(mapped.city)) : null);
    const driver = await findDriverForRow(tx, row, preview);
    if (!driver?.id) unmatchedDrivers += 1;

    const monthlyRent = numberValue(mapped.monthlyRent);
    const dailyRent = text(mapped.dailyRent) ? numberValue(mapped.dailyRent) : monthlyRent > 0 ? Math.round((monthlyRent / 30) * 100) / 100 : 0;
    const receivedDate = dateValue(firstText(mapped, ["receivedDate", "handoverDate", "startDate"]), new Date());
    const authorizationEnd = parsedDateValue(firstText(mapped, ["authorizationEnd", "authorizationEndDate", "authEndDate"]));

    const vehicleData = removeUndefinedValues({
      // لو الكود يشير لسجل مختلف عن اللوحة، لا نحدث vehicleCode حتى لا نكسر unique constraints.
      vehicleCode: hasCodePlateConflict ? undefined : vehicleCode || null,
      plateAr: plateArabic || null,
      plateArabic: plateArabic || null,
      plateEn: plateEnglish || vehicleCode || plateArabic,
      plateEnglish: plateEnglish || null,
      brand: text(mapped.brand || mapped.vehicleType) || null,
      model: text(mapped.model) || null,
      year: text(mapped.year) ? intValue(mapped.year) : null,
      rentalCompany: text(mapped.rentalCompany) || null,
      monthlyRent,
      dailyRent,
      cityId,
      currentDriverId: driver?.id ?? null,
      status: driver?.id ? VehicleStatus.ASSIGNED : vehicleStatus(mapped.status),
    });

    const vehicle = existing
      ? await tx.vehicle.update({ where: { id: existing.id }, data: vehicleData, select: { id: true } })
      : await tx.vehicle.create({ data: vehicleData, select: { id: true } });

    if (existing) updatedVehicles += 1;
    else createdVehicles += 1;

    if (driver?.id) {
      await tx.vehicleAssignment.updateMany({
        where: {
          OR: [
            { vehicleId: vehicle.id, driverId: { not: driver.id }, status: RecordStatus.ACTIVE, endDate: null },
            { driverId: driver.id, vehicleId: { not: vehicle.id }, status: RecordStatus.ACTIVE, endDate: null },
          ],
        },
        data: {
          endDate: receivedDate,
          status: RecordStatus.INACTIVE,
        },
      }).catch(() => null);

      await tx.driver.update({
        where: { id: driver.id },
        data: {
          vehicleId: vehicle.id,
          vehicleOwnershipType: "company_car",
          ...(cityId ? { cityId } : {}),
        },
      }).catch(() => null);
      linkedDrivers += 1;

      const openAssignment = await tx.vehicleAssignment.findFirst({
        where: { vehicleId: vehicle.id, driverId: driver.id, status: RecordStatus.ACTIVE, endDate: null },
        select: { id: true },
      });

      if (!openAssignment) {
        await tx.vehicleAssignment.create({
          data: {
            vehicleId: vehicle.id,
            driverId: driver.id,
            startDate: receivedDate,
            rentalDays: text(mapped.rentalDays) ? intValue(mapped.rentalDays) : null,
            calculatedRent: text(mapped.calculatedRent) ? numberValue(mapped.calculatedRent) : null,
            status: RecordStatus.ACTIVE,
            notes: text(mapped.notes) || "تم إنشاء عهدة السيارة من ملف الاستيراد",
          },
        });
        assignments += 1;
      }

      const existingMovement = await tx.vehicleMovement.findFirst({
        where: {
          vehicleId: vehicle.id,
          toDriverId: driver.id,
          handoverDate: {
            gte: startOfUtcDay(receivedDate),
            lte: endOfUtcDay(receivedDate),
          },
        },
        select: { id: true },
      }).catch(() => null);

      if (!existingMovement) {
        await tx.vehicleMovement.create({
          data: {
            vehicleId: vehicle.id,
            toDriverId: driver.id,
            cityId,
            movementType: "HANDOVER",
            handoverDate: receivedDate,
            status: RecordStatus.APPROVED,
            notes: [
              "تم إنشاء حركة تسليم من ملف الاستيراد",
              authorizationEnd ? `نهاية التفويض: ${authorizationEnd.toISOString().slice(0, 10)}` : "",
              text(mapped.notes),
            ].filter(Boolean).join(" | "),
          },
        }).catch(() => null);
        movements += 1;
      }
    }
  }

  return { createdVehicles, updatedVehicles, assignments, movements, linkedDrivers, unmatchedDrivers };
}

async function commitDailyReportRows(tx: Prisma.TransactionClient, rows: ImportPreviewRow[], preview: ImportPreviewPayload) {
  let createdReports = 0;
  let updatedReports = 0;
  let linkedAccounts = 0;
  const selectedApplicationName = await findApplicationName(tx, preview.summary.applicationId);
  const selectedProject = await findProjectFromApplicationProject(tx, preview.summary.applicationProjectId);

  for (const row of rows) {
    const mapped = row.mappedData;
    const driver = await findDriverForRow(tx, row, preview);
    if (!driver?.id) continue;

    const parsedReportDate = parsedDateValue(mapped.reportDate || mapped.date);
    if (!parsedReportDate) continue;
    const reportDate = startOfUtcDay(parsedReportDate);
    const appName = text(mapped.applicationName) || selectedApplicationName || selectedProject?.application.name || appNameFromImportType(preview.summary.importType);
    const month = monthValue(mapped.month || mapped.reportDate || mapped.date, reportDate);
    const cityId = (preview.summary.cityId || selectedProject?.cityId) ?? driver.cityId ?? null;
    const projectId = selectedProject?.projectId || null;
    const applicationProjectId = preview.summary.applicationProjectId || selectedProject?.id || null;
    const appUserId = text(mapped.appUserId);
    const appUsername = firstText(mapped, ["appUsername", "username"]);
    const username = appUsername || appUserId;
    const applicationId = preview.summary.applicationId || selectedProject?.application.id || (await findOrCreateApplication(tx, appName));

    if (username) {
      const account = await upsertOperationalApplicationAccount(tx, {
        appName,
        appUserId: appUserId || null,
        appUsername: appUsername || username,
        username,
        applicationId: applicationId || null,
        applicationProjectId,
        cityId,
        driverId: driver.id,
        status: RecordStatus.ACTIVE,
        source: "IMPORT",
      });

      if (account.wasCreated || !account.driverId) linkedAccounts += 1;
    }

    const existingReports = await tx.dailyReport.findMany({
      where: {
        driverId: driver.id,
        reportDate: {
          gte: reportDate,
          lte: endOfUtcDay(reportDate),
        },
        appName,
        ...(applicationProjectId ? { applicationProjectId } : {}),
        ...(cityId ? { cityId } : {}),
      },
      select: { id: true },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });
    const existing = existingReports[0];

    const reportData = {
      reportDate,
      month,
      driverId: driver.id,
      cityId,
      projectId,
      applicationId: applicationId || null,
      applicationProjectId,
      appName,
      orders: intValue(mapped.orders),
      workingHours: hoursValue(mapped.workingHours),
      onTimeRate: rateValue(mapped.onTimeRate),
      cancellationRate: rateValue(mapped.cancellationRate),
      rejectionRate: rateValue(mapped.rejectionRate),
    };

    if (existing) {
      await tx.dailyReport.update({ where: { id: existing.id }, data: reportData });
      const duplicateIds = existingReports.slice(1).map((report) => report.id);
      if (duplicateIds.length) await tx.dailyReport.deleteMany({ where: { id: { in: duplicateIds } } });
      updatedReports += 1;
    } else {
      await tx.dailyReport.create({ data: reportData });
      createdReports += 1;
    }
  }

  return { createdReports, updatedReports, linkedAccounts };
}

async function commitFinanceRows(tx: Prisma.TransactionClient, rows: ImportPreviewRow[], fileType: string) {
  let created = 0;

  for (const row of rows) {
    const mapped = row.mappedData;
    const driver = await findDriverForRow(tx, row);
    if (!driver?.id) continue;
    const amount = numberValue(mapped.amount);

    if (fileType === "advances") {
      await tx.advance.create({
        data: {
          driverId: driver.id,
          amount,
          remainingAmount: amount,
          reason: text(mapped.reason) || "سلفة مستوردة من ملف",
          deductionMonth: text(mapped.deductionMonth) || monthValue(mapped.date, new Date()),
          status: RecordStatus.PENDING,
        },
      });
      created += 1;
    }

    if (fileType === "deductions") {
      await tx.deduction.create({
        data: {
          driverId: driver.id,
          type: text(mapped.type) || "خصم مستورد",
          amount,
          month: text(mapped.month) || monthValue(mapped.date, new Date()),
          status: RecordStatus.PENDING,
          notes: text(mapped.notes) || null,
        },
      });
      created += 1;
    }

    if (fileType === "violations") {
      await tx.violation.create({
        data: {
          driverId: driver.id,
          vehicleId: row.vehicleId || text(mapped.vehicleId) || driver.vehicleId || null,
          type: text(mapped.type) || "مخالفة مستوردة",
          amount,
          occurredAt: dateValue(mapped.date, new Date()),
          status: RecordStatus.PENDING,
          notes: text(mapped.notes) || null,
        },
      });
      created += 1;
    }

    if (fileType === "fuel") {
      await tx.fuelRecord.create({
        data: {
          driverId: driver.id,
          vehicleId: row.vehicleId || text(mapped.vehicleId) || driver.vehicleId || null,
          amount,
          liters: text(mapped.liters) ? numberValue(mapped.liters) : null,
          fuelDate: dateValue(mapped.date, new Date()),
          status: RecordStatus.PENDING,
          notes: text(mapped.notes) || null,
        },
      });
      created += 1;
    }
  }

  return { created };
}

async function commitDocumentRows(tx: Prisma.TransactionClient, rows: ImportPreviewRow[]) {
  let createdDocuments = 0;

  for (const row of rows) {
    const mapped = row.mappedData;
    const driver = await findDriverForRow(tx, row);
    if (!driver?.id) continue;
    const documentType = text(mapped.documentType) || "مستند";
    await tx.driverDocument.create({
      data: {
        driverId: driver.id,
        type: documentType,
        documentType,
        documentNumber: text(mapped.documentNumber) || null,
        expiryDate: text(mapped.expiryDate) ? dateValue(mapped.expiryDate, new Date()) : null,
        status: RecordStatus.PENDING,
        verificationStatus: "pending",
        notes: text(mapped.notes) || null,
      },
    });
    createdDocuments += 1;
  }

  return { createdDocuments };
}

async function commitPayrollRows(tx: Prisma.TransactionClient, rows: ImportPreviewRow[]) {
  let createdPayrolls = 0;
  let updatedPayrolls = 0;

  for (const row of rows) {
    const mapped = row.mappedData;
    const driver = await findDriverForRow(tx, row);
    if (!driver?.id) continue;
    const month = text(mapped.month);
    const year = text(mapped.year);
    const payrollMonth = month && year && !month.includes("-") ? `${year}-${month.padStart(2, "0")}` : month || monthValue(mapped.date, new Date());
    const existing = await tx.payroll.findUnique({
      where: { driverId_month: { driverId: driver.id, month: payrollMonth } },
      select: { id: true },
    });
    const payrollData = {
      driverId: driver.id,
      projectId: null,
      month: payrollMonth,
      basicSalary: numberValue(mapped.basicSalary),
      bonus: numberValue(mapped.bonus),
      deductions: numberValue(mapped.deductions),
      netSalary: numberValue(mapped.netSalary),
    };
    if (existing) {
      await tx.payroll.update({ where: { id: existing.id }, data: payrollData });
      updatedPayrolls += 1;
    } else {
      await tx.payroll.create({ data: payrollData });
      createdPayrolls += 1;
    }
  }

  return { createdPayrolls, updatedPayrolls };
}

export async function commitImportPreview(preview: ImportPreviewPayload, userId?: string | null) {
  const normalizedImportType = canonicalImportType(preview.summary.importType);
  if (normalizedImportType !== preview.summary.importType) {
    preview = { ...preview, summary: { ...preview.summary, importType: normalizedImportType } };
  }

  if (importTypeRequiresProject(preview.summary.importType) && (!preview.summary.applicationId || !preview.summary.applicationProjectId || !preview.summary.cityId)) {
    throw new Error("لا يمكن حفظ تقرير أو فاتورة مشروع بدون projectId واضح.");
  }

  const validRows = preview.rows.filter((row) => row.severity !== "error" && row.status !== "ignored");
  const processedTypes = new Set([
    "drivers",
    "vehicles",
    "application_accounts",
    "keeta_drivers",
    "keeta_accounts",
    "hungerstation_drivers",
    "hungerstation_accounts",
    "talabat_drivers",
    "talabat_accounts",
    KEETA_RANK_TEMPLATE,
    KEETA_PERIOD_REPORT_TEMPLATE,
    KEETA_DRIVER_INVOICE_TEMPLATE,
    "keeta_invoice",
    "keeta_rank",
    "hungerstation_invoice",
    "hungerstation_performance",
    "talabat_invoice",
    "advances",
    "deductions",
    "violations",
    "fuel",
    "hr_documents",
    "payroll",
  ]);
  const status = processedTypes.has(preview.summary.importType) ? "committed_processed" : "committed_pending_processing";

  const batch = await prisma.$transaction(async (tx) => {
    const selectedApplicationName = await findApplicationName(tx, preview.summary.applicationId);
    const selectedProject = await findProjectFromApplicationProject(tx, preview.summary.applicationProjectId);
    const reportDate = firstReportDate(validRows) ?? new Date();
    const detectedRange = reportDateRange(validRows);
    const periodStart = parsedDateValue(preview.summary.periodStart) ?? detectedRange.periodStart;
    const periodEnd = parsedDateValue(preview.summary.periodEnd) ?? detectedRange.periodEnd;
    const importMonth =
      preview.summary.month ||
      monthValue(validRows[0]?.mappedData.month || validRows[0]?.mappedData.reportDate || validRows[0]?.mappedData.date, reportDate);
    const importErrors = preview.rows
      .filter((row) => row.severity === "error")
      .map((row) => ({ rowNumber: row.rowNumber, errorType: row.errorType, errorMessage: row.errorMessage }));

    const created = await tx.applicationImportBatch.create({
      data: {
        applicationId: preview.summary.applicationId || null,
        applicationProjectId: preview.summary.applicationProjectId || null,
        projectId: selectedProject?.projectId || null,
        cityId: preview.summary.cityId || selectedProject?.cityId || null,
        templateId: preview.summary.templateId || null,
        fileType: preview.summary.importType,
        importType: preview.summary.importType,
        month: importMonth,
        fileName: preview.summary.fileName,
        sourceFileName: preview.summary.fileName,
        periodStart,
        periodEnd,
        status,
        sheetNames: json(preview.sheets ?? preview.summary.sheetNames ?? []),
        totalRows: preview.summary.totalRows,
        validRows: preview.summary.validRows,
        invalidRows: preview.summary.invalidRows,
        duplicateRows: preview.summary.duplicateRows,
        missingDrivers: preview.summary.missingDrivers,
        unlinkedAccounts: preview.summary.missingApplicationAccounts,
        unmatchedRows: preview.summary.unmatchedRows ?? preview.summary.missingDrivers,
        previewData: json({
          summary: preview.summary,
          keetaInvoiceDetails: preview.keetaInvoiceDetails?.map((row) => ({
            rowNumber: row.rowNumber,
            status: row.status,
            rawData: row.rawData,
            mappedData: row.mappedData,
            driverId: row.driverId,
            applicationAccountId: row.applicationAccountId,
            errorType: row.errorType,
            errorMessage: row.errorMessage,
          })),
        }),
        matchedColumns: json(preview.columns),
        errorRows: json(importErrors),
        uploadedBy: userId ? "User" : "Admin",
        createdById: userId ?? null,
        approvedById: userId ?? null,
        approvedAt: new Date(),
        committedAt: new Date(),
      },
    });

    const uploadedReport = await tx.uploadedReport.create({
      data: {
        fileName: preview.summary.fileName || "imported-file",
        importType: preview.summary.importType,
        appName: selectedApplicationName || selectedProject?.application.name || appNameFromImportType(preview.summary.importType),
        cityId: preview.summary.cityId || selectedProject?.cityId || null,
        month: importMonth,
        status: preview.summary.invalidRows ? RecordStatus.PENDING : RecordStatus.APPROVED,
        rowsCount: preview.summary.totalRows,
        uploadedBy: userId ? "User" : "Admin",
      },
      select: { id: true },
    }).catch(() => null);

    const legacyBatch = await tx.importBatch.create({
      data: {
        fileName: preview.summary.fileName || "imported-file",
        importType: preview.summary.importType,
        appName: selectedApplicationName || selectedProject?.application.name || appNameFromImportType(preview.summary.importType),
        month: importMonth,
        status: preview.summary.invalidRows ? RecordStatus.PENDING : RecordStatus.APPROVED,
        rowsFound: preview.summary.totalRows,
        rowsImported: validRows.length,
        rowsSkipped: preview.summary.invalidRows,
        errors: json(importErrors),
        createdBy: userId ? "User" : "Admin",
      },
      select: { id: true },
    }).catch(() => null);

    const invoice = preview.summary.importType.includes("invoice")
      ? await tx.invoice.create({
          data: {
            number: `INV-${created.id.slice(-8).toUpperCase()}`,
            client: selectedApplicationName || selectedProject?.application.name || appNameFromImportType(preview.summary.importType),
            projectId: selectedProject?.projectId || null,
            applicationProjectId: preview.summary.applicationProjectId || null,
            importBatchId: created.id,
            month: importMonth,
            amount: isKeetaOperationalImport(preview.summary.importType)
              ? keetaInvoiceAmount(preview)
              : validRows.reduce((sum, row) => sum + numberValue(row.mappedData.collectionAmount || row.mappedData.amount || row.mappedData.totalAmount), 0),
            vatAmount: 0,
            status: preview.summary.invalidRows ? RecordStatus.PENDING : RecordStatus.APPROVED,
            invoiceStatus: preview.summary.invalidRows ? "Reviewed" : "Approved",
            approvedAt: preview.summary.invalidRows ? null : new Date(),
          },
          select: { id: true, amount: true },
        }).catch(() => null)
      : null;

    if (invoice && decimalNumber(invoice.amount) > 0 && !preview.summary.invalidRows) {
      await tx.financeEntry.create({
        data: {
          sourceType: "Invoice",
          sourceId: invoice.id,
          entryType: "revenue",
          applicationId: preview.summary.applicationId || null,
          applicationProjectId: preview.summary.applicationProjectId || null,
          cityId: preview.summary.cityId || selectedProject?.cityId || null,
          amount: invoice.amount,
          direction: "in",
          description: `Approved invoice import ${preview.summary.fileName}`,
          status: RecordStatus.APPROVED,
          entryDate: reportDate,
        },
      }).catch(() => null);
    }

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

    if (preview.keetaInvoiceDetails?.length) {
      await tx.applicationImportRow.createMany({
        data: preview.keetaInvoiceDetails.map((row) => ({
          batchId: created.id,
          rowNumber: row.rowNumber + 100000,
          rawData: json(row.rawData),
          mappedData: json(row.mappedData),
          isValid: row.severity !== "error",
          errorType: row.errorType ?? null,
          errorMessage: row.errorMessage ?? null,
          driverId: row.driverId ?? null,
          applicationAccountId: row.applicationAccountId ?? null,
          status: row.severity === "error" ? "invalid_detail" : row.severity === "warning" ? "warning_detail" : "ready_detail",
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

    const drivers = isDriverImport(preview.summary.importType) ? await commitDriverRows(tx, validRows, preview) : null;
    const vehicles = preview.summary.importType === "vehicles" ? await commitVehicleRows(tx, validRows, preview) : null;
    const accounts = isApplicationAccountImport(preview.summary.importType) ? await commitApplicationAccountRows(tx, validRows, preview) : null;
    const keetaRecords = isKeetaOperationalImport(preview.summary.importType)
      ? await commitKeetaRecords({
          tx,
          batchId: created.id,
          preview,
          applicationProjectId: preview.summary.applicationProjectId || null,
          cityId: preview.summary.cityId || selectedProject?.cityId || null,
          userId,
        })
      : null;
    const hungerStationRecords = ["hungerstation_invoice", "hungerstation_performance"].includes(preview.summary.importType)
      ? await commitHungerStationRecords({ tx, batchId: created.id, preview, userId })
      : null;
    const reports = ["keeta_invoice", "keeta_rank", "talabat_invoice"].includes(preview.summary.importType)
      ? await commitDailyReportRows(tx, validRows, preview)
      : null;
    const finance = ["advances", "deductions", "violations", "fuel"].includes(preview.summary.importType)
      ? await commitFinanceRows(tx, validRows, preview.summary.importType)
      : null;
    const documents = preview.summary.importType === "hr_documents" ? await commitDocumentRows(tx, validRows) : null;
    const payroll = preview.summary.importType === "payroll" ? await commitPayrollRows(tx, validRows) : null;

    return { created, uploadedReport, legacyBatch, invoice, drivers, vehicles, accounts, reports, keetaRecords, hungerStationRecords, finance, documents, payroll };
  }, { maxWait: 60000, timeout: 600000 });

  const processedMessage = (() => {
    if (preview.summary.importType === "drivers") return "تم اعتماد ملف المناديب وتحديث قاعدة البيانات.";
    if (preview.summary.importType === "vehicles") return "تم اعتماد ملف السيارات وتحديث سجلات السيارات والحركة وربطها بالمناديب المتطابقين.";
    if (preview.summary.importType === "application_accounts") return "تم اعتماد ملف حسابات التطبيقات وتحديث الربط مع المناديب.";
    if (isKeetaOperationalImport(preview.summary.importType)) return "تم اعتماد ملف Keeta وحفظ سجلاته المتخصصة وربطها بالمسير والتقارير حسب نوع القالب.";
    if (["hungerstation_invoice", "hungerstation_performance"].includes(preview.summary.importType)) return "تم اعتماد ملف HungerStation وحفظ سجلاته المتخصصة ومراجعة الحسابات غير المربوطة.";
    if (["keeta_invoice", "keeta_rank", "talabat_invoice"].includes(preview.summary.importType)) {
      return "تم اعتماد التقرير وتحديث التقارير اليومية وسجل الملفات المرفوعة.";
    }
    if (["advances", "deductions", "violations", "fuel"].includes(preview.summary.importType)) return "تم اعتماد الملف وتسجيل البنود المالية كحالة Pending للمراجعة.";
    if (preview.summary.importType === "hr_documents") return "تم اعتماد ملف مستندات الموارد البشرية وتسجيل المستندات للمراجعة.";
    if (preview.summary.importType === "payroll") return "تم اعتماد ملف المسير وتحديث سجلات المسير المستوردة.";
    return "تم حفظ عملية الاستيراد، معالجة هذا النوع ستكتمل في مرحلة لاحقة.";
  })();

  return {
    batchId: batch.created.id,
    uploadedReportId: batch.uploadedReport?.id ?? null,
    legacyBatchId: batch.legacyBatch?.id ?? null,
    invoiceId: batch.invoice?.id ?? null,
    rowsSaved: preview.rows.length,
    validRowsSaved: validRows.length,
    skippedRows: preview.summary.invalidRows,
    drivers: batch.drivers,
    vehicles: batch.vehicles,
    accounts: batch.accounts,
    reports: batch.reports,
    keetaRecords: batch.keetaRecords,
    hungerStationRecords: batch.hungerStationRecords,
    finance: batch.finance,
    documents: batch.documents,
    payroll: batch.payroll,
    message: processedMessage,
  };
}

export async function reprocessStoredImportBatch(batchId: string, userId?: string | null) {
  const stored = await prisma.applicationImportBatch.findUnique({
    where: { id: batchId },
    include: { rows: { orderBy: { rowNumber: "asc" } } },
  });

  if (!stored) throw new Error("Import batch not found.");

  const storedFileType = canonicalImportType(stored.fileType);
  const storedRows: ImportPreviewRow[] = stored.rows.map((row) => ({
    rowNumber: row.rowNumber,
    status: row.status,
    severity: row.isValid ? (row.status === "warning" ? "warning" : "ready") : "error",
    rawData: (row.rawData ?? {}) as Record<string, unknown>,
    mappedData: (row.mappedData ?? {}) as Record<string, unknown>,
    mainIdentifier: String(row.rowNumber),
    driverId: row.driverId ?? undefined,
    applicationAccountId: row.applicationAccountId ?? undefined,
    errorType: row.errorType ?? undefined,
    errorMessage: row.errorMessage ?? undefined,
  }));
  const rows = storedRows
    .filter((row) => row.rowNumber < 100000 && !String(row.status).includes("_detail"))
    .map((row) => ({ ...row, mainIdentifier: String(row.mappedData.appUserId || row.mappedData.courierId || row.rowNumber) }));
  const keetaInvoiceDetails = storedRows
    .filter((row) => row.rowNumber >= 100000 || String(row.status).includes("_detail"))
    .map((row) => ({
      ...row,
      rowNumber: row.rowNumber >= 100000 ? row.rowNumber - 100000 : row.rowNumber,
      mainIdentifier: String(row.mappedData.businessId || row.mappedData.violationId || row.mappedData.courierId || row.rowNumber),
    }));
  const validRows = rows.filter((row) => row.severity !== "error" && row.status !== "ignored");
  const processedTypes = new Set([
    "drivers",
    "vehicles",
    "application_accounts",
    "keeta_drivers",
    "keeta_accounts",
    "hungerstation_drivers",
    "hungerstation_accounts",
    "talabat_drivers",
    "talabat_accounts",
    KEETA_RANK_TEMPLATE,
    KEETA_PERIOD_REPORT_TEMPLATE,
    KEETA_DRIVER_INVOICE_TEMPLATE,
    "keeta_invoice",
    "keeta_rank",
    "hungerstation_invoice",
    "hungerstation_performance",
    "talabat_invoice",
    "advances",
    "deductions",
    "violations",
    "fuel",
    "hr_documents",
    "payroll",
  ]);
  const preview: ImportPreviewPayload = {
    summary: {
      fileName: stored.fileName ?? "stored-import",
      importType: storedFileType,
      applicationId: stored.applicationId ?? "",
      applicationProjectId: stored.applicationProjectId ?? "",
      projectId: stored.projectId ?? "",
      cityId: stored.cityId ?? "",
      templateId: stored.templateId ?? "",
      totalRows: stored.totalRows,
      validRows: stored.validRows,
      invalidRows: stored.invalidRows,
      duplicateRows: stored.duplicateRows,
      missingRequiredColumns: 0,
      missingDrivers: stored.missingDrivers,
      missingVehicles: 0,
      missingProjects: 0,
      missingApplicationAccounts: stored.unlinkedAccounts,
      rowsReadyToSave: validRows.length,
    },
    columns: [],
    missingColumns: [],
    rows,
    keetaInvoiceDetails,
    message: "",
  };

  const result = await prisma.$transaction(async (tx) => {
    const drivers = isDriverImport(storedFileType) ? await commitDriverRows(tx, validRows, preview) : null;
    const vehicles = storedFileType === "vehicles" ? await commitVehicleRows(tx, validRows, preview) : null;
    const accounts = isApplicationAccountImport(storedFileType) ? await commitApplicationAccountRows(tx, validRows, preview) : null;
    const keetaRecords = isKeetaOperationalImport(storedFileType)
      ? await commitKeetaRecords({
          tx,
          batchId,
          preview,
          applicationProjectId: stored.applicationProjectId,
          cityId: stored.cityId,
          userId,
        })
      : null;
    const hungerStationRecords = ["hungerstation_invoice", "hungerstation_performance"].includes(storedFileType)
      ? await commitHungerStationRecords({ tx, batchId, preview, userId })
      : null;
    const reports = [KEETA_PERIOD_REPORT_TEMPLATE, "talabat_invoice"].includes(storedFileType)
      ? await commitDailyReportRows(tx, validRows, preview)
      : null;
    const finance = ["advances", "deductions", "violations", "fuel"].includes(storedFileType)
      ? await commitFinanceRows(tx, validRows, storedFileType)
      : null;
    const documents = storedFileType === "hr_documents" ? await commitDocumentRows(tx, validRows) : null;
    const payroll = storedFileType === "payroll" ? await commitPayrollRows(tx, validRows) : null;

    const updated = await tx.applicationImportBatch.update({
      where: { id: batchId },
      data: {
        status: processedTypes.has(storedFileType)
          ? stored.invalidRows
            ? "committed_processed_with_errors"
            : "committed_processed"
          : "committed_pending_processing",
        committedAt: new Date(),
      },
    });

    await tx.auditLog.create({
      data: {
        userId: userId ?? null,
        action: "IMPORT_REPROCESS",
        entityType: "ApplicationImportBatch",
        entityId: batchId,
        after: json({
          fileName: stored.fileName,
          importType: storedFileType,
          validRows: validRows.length,
          reports,
          keetaRecords,
          hungerStationRecords,
          drivers,
          vehicles,
          accounts,
          finance,
          documents,
          payroll,
        }),
      },
    }).catch(() => null);

    return { updated, drivers, vehicles, accounts, reports, keetaRecords, hungerStationRecords, finance, documents, payroll };
  }, { maxWait: 60000, timeout: 600000 });

  return {
    batchId: result.updated.id,
    status: result.updated.status,
    rowsProcessed: validRows.length,
    drivers: result.drivers,
    vehicles: result.vehicles,
    accounts: result.accounts,
    reports: result.reports,
    keetaRecords: result.keetaRecords,
    hungerStationRecords: result.hungerStationRecords,
    finance: result.finance,
    documents: result.documents,
    payroll: result.payroll,
    message: "تمت إعادة معالجة الدفعة وربط البيانات بالصفحات التشغيلية.",
  };
}
