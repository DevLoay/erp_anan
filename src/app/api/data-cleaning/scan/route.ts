import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canWriteResource, roleFromHeaders } from "@/lib/permissions";

type IssueInput = {
  issueType: string;
  entityType: string;
  entityId?: string;
  severity: "CRITICAL" | "WARNING" | "INFO";
  notes: string;
};

function normalizeArabic(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function pushGroupIssue<T extends { id: string }>(
  issues: IssueInput[],
  issueType: string,
  entityType: string,
  label: string,
  rows: T[],
  severity: IssueInput["severity"] = "WARNING",
) {
  if (rows.length < 2) return;
  issues.push({
    issueType,
    entityType,
    entityId: rows.map((row) => row.id).join(",").slice(0, 250),
    severity,
    notes: `${label}: ${rows.length} سجلات محتملة تحتاج مراجعة ودمج يدوي.`,
  });
}

async function createIfMissing(issue: IssueInput) {
  const existing = await prisma.dataCleaningIssue.findFirst({
    where: {
      issueType: issue.issueType,
      entityType: issue.entityType,
      entityId: issue.entityId,
      status: { in: ["PENDING", "ACTIVE"] },
    },
  });

  if (existing) return false;

  await prisma.dataCleaningIssue.create({
    data: {
      issueType: issue.issueType,
      entityType: issue.entityType,
      entityId: issue.entityId,
      severity: issue.severity,
      status: "PENDING",
      notes: issue.notes,
    },
  });
  return true;
}

export async function POST(request: Request) {
  const role = roleFromHeaders(request.headers);
  if (!canWriteResource(role, "data-cleaning-issues")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [cities, drivers, accounts, vehicles, projects, supervisors] = await Promise.all([
    prisma.city.findMany({ select: { id: true, nameAr: true, nameEn: true } }),
    prisma.driver.findMany({
      select: {
        id: true,
        internalCode: true,
        name: true,
        status: true,
        cityId: true,
        projectId: true,
        supervisorId: true,
        accountId: true,
        vehicleId: true,
      },
    }),
    prisma.applicationAccount.findMany({ select: { id: true, username: true, appName: true, driverId: true, isEmpty: true, status: true } }),
    prisma.vehicle.findMany({ select: { id: true, plateEn: true, plateAr: true, currentDriverId: true, status: true } }),
    prisma.project.findMany({ select: { id: true, name: true, appName: true, cityId: true } }),
    prisma.supervisor.findMany({ select: { id: true, name: true, cityId: true } }),
  ]);

  const issues: IssueInput[] = [];

  const cityGroups = new Map<string, typeof cities>();
  for (const city of cities) {
    const key = normalizeArabic(city.nameAr || city.nameEn);
    if (!key) continue;
    cityGroups.set(key, [...(cityGroups.get(key) ?? []), city]);
  }
  for (const [key, rows] of cityGroups) pushGroupIssue(issues, "DUPLICATE_CITY_NAME", "City", key, rows);

  const projectGroups = new Map<string, typeof projects>();
  for (const project of projects) {
    const key = `${normalizeArabic(project.name)}:${normalizeArabic(project.appName)}`;
    if (!key.trim()) continue;
    projectGroups.set(key, [...(projectGroups.get(key) ?? []), project]);
  }
  for (const [key, rows] of projectGroups) pushGroupIssue(issues, "DUPLICATE_PROJECT_NAME", "Project", key, rows, "INFO");

  const accountGroups = new Map<string, typeof accounts>();
  for (const account of accounts) {
    const key = `${normalizeArabic(account.appName)}:${normalizeArabic(account.username)}`;
    if (!key.trim()) continue;
    accountGroups.set(key, [...(accountGroups.get(key) ?? []), account]);
  }
  for (const [key, rows] of accountGroups) pushGroupIssue(issues, "DUPLICATE_APP_ACCOUNT", "ApplicationAccount", key, rows, "CRITICAL");

  const vehicleGroups = new Map<string, typeof vehicles>();
  for (const vehicle of vehicles) {
    const key = normalizeArabic(vehicle.plateEn || vehicle.plateAr);
    if (!key) continue;
    vehicleGroups.set(key, [...(vehicleGroups.get(key) ?? []), vehicle]);
  }
  for (const [key, rows] of vehicleGroups) pushGroupIssue(issues, "DUPLICATE_VEHICLE", "Vehicle", key, rows, "CRITICAL");

  const supervisorIds = new Set(supervisors.map((supervisor) => supervisor.id));
  const cityIds = new Set(cities.map((city) => city.id));
  const projectIds = new Set(projects.map((project) => project.id));
  const accountIds = new Set(accounts.map((account) => account.id));
  const vehicleIds = new Set(vehicles.map((vehicle) => vehicle.id));

  for (const driver of drivers) {
    const label = `${driver.internalCode} - ${driver.name}`;
    if (!driver.cityId) {
      issues.push({ issueType: "DRIVER_WITHOUT_CITY", entityType: "Driver", entityId: driver.id, severity: "WARNING", notes: `${label}: المندوب بدون مدينة.` });
    } else if (!cityIds.has(driver.cityId)) {
      issues.push({ issueType: "BROKEN_DRIVER_CITY", entityType: "Driver", entityId: driver.id, severity: "CRITICAL", notes: `${label}: المدينة المرتبطة غير موجودة.` });
    }

    if (!driver.projectId) {
      issues.push({ issueType: "DRIVER_WITHOUT_PROJECT", entityType: "Driver", entityId: driver.id, severity: "WARNING", notes: `${label}: المندوب بدون مشروع.` });
    } else if (!projectIds.has(driver.projectId)) {
      issues.push({ issueType: "BROKEN_DRIVER_PROJECT", entityType: "Driver", entityId: driver.id, severity: "CRITICAL", notes: `${label}: المشروع المرتبط غير موجود.` });
    }

    if (!driver.supervisorId) {
      issues.push({ issueType: "DRIVER_WITHOUT_SUPERVISOR", entityType: "Driver", entityId: driver.id, severity: "WARNING", notes: `${label}: المندوب بدون مشرف.` });
    } else if (!supervisorIds.has(driver.supervisorId)) {
      issues.push({ issueType: "BROKEN_DRIVER_SUPERVISOR", entityType: "Driver", entityId: driver.id, severity: "CRITICAL", notes: `${label}: المشرف المرتبط غير موجود.` });
    }

    if (!driver.accountId) {
      issues.push({ issueType: "DRIVER_WITHOUT_ACCOUNT", entityType: "Driver", entityId: driver.id, severity: "INFO", notes: `${label}: لا يوجد حساب تطبيق مربوط.` });
    } else if (!accountIds.has(driver.accountId)) {
      issues.push({ issueType: "BROKEN_DRIVER_ACCOUNT", entityType: "Driver", entityId: driver.id, severity: "CRITICAL", notes: `${label}: حساب التطبيق المرتبط غير موجود.` });
    }

    if (driver.vehicleId && !vehicleIds.has(driver.vehicleId)) {
      issues.push({ issueType: "BROKEN_DRIVER_VEHICLE", entityType: "Driver", entityId: driver.id, severity: "CRITICAL", notes: `${label}: السيارة المرتبطة غير موجودة.` });
    }
  }

  const activeDrivers = drivers.filter((driver) => driver.status === "ACTIVE");
  const activeAccounts = new Map<string, typeof drivers>();
  const activeVehicles = new Map<string, typeof drivers>();
  for (const driver of activeDrivers) {
    if (driver.accountId) activeAccounts.set(driver.accountId, [...(activeAccounts.get(driver.accountId) ?? []), driver]);
    if (driver.vehicleId) activeVehicles.set(driver.vehicleId, [...(activeVehicles.get(driver.vehicleId) ?? []), driver]);
  }
  for (const [accountId, rows] of activeAccounts) {
    if (rows.length > 1) {
      issues.push({
        issueType: "ACCOUNT_ASSIGNED_TO_MULTIPLE_ACTIVE_DRIVERS",
        entityType: "ApplicationAccount",
        entityId: accountId,
        severity: "CRITICAL",
        notes: `حساب تطبيق مربوط بأكثر من مندوب نشط: ${rows.map((row) => row.internalCode).join(", ")}`,
      });
    }
  }
  for (const [vehicleId, rows] of activeVehicles) {
    if (rows.length > 1) {
      issues.push({
        issueType: "VEHICLE_ASSIGNED_TO_MULTIPLE_ACTIVE_DRIVERS",
        entityType: "Vehicle",
        entityId: vehicleId,
        severity: "CRITICAL",
        notes: `سيارة مربوطة بأكثر من مندوب نشط: ${rows.map((row) => row.internalCode).join(", ")}`,
      });
    }
  }

  let created = 0;
  let existing = 0;
  for (const issue of issues) {
    const inserted = await createIfMissing(issue);
    if (inserted) created += 1;
    else existing += 1;
  }

  await prisma.auditLog.create({
    data: {
      user: "Admin",
      action: "SCAN_DATA_CLEANING",
      entityType: "DataCleaningIssue",
      newValue: { scannedIssues: issues.length, created, existing },
    },
  });

  return NextResponse.json({
    data: {
      scannedIssues: issues.length,
      created,
      existing,
      counts: {
        cities: cities.length,
        drivers: drivers.length,
        accounts: accounts.length,
        vehicles: vehicles.length,
        projects: projects.length,
        supervisors: supervisors.length,
      },
    },
  });
}
