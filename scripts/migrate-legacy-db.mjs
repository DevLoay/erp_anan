import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const legacyPath = path.resolve(__dirname, "../../../data/db.json");

function txt(value) {
  return String(value ?? "").trim();
}

function num(value) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function safeId(prefix, value) {
  const raw = txt(value).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
  return `${prefix}_${raw || "unknown"}`;
}

function dateOrNull(value) {
  const raw = txt(value);
  if (!raw || raw.startsWith("+")) return null;
  const d = new Date(raw);
  return Number.isFinite(d.getTime()) ? d : null;
}

function requiredDate(value, fallback = "2026-04-01") {
  return dateOrNull(value) ?? new Date(`${fallback}T00:00:00.000Z`);
}

function monthOf(value) {
  const d = dateOrNull(value);
  return d ? d.toISOString().slice(0, 7) : txt(value).slice(0, 7) || "2026-04";
}

function recordStatus(value) {
  const v = txt(value).toLowerCase();
  if (["active", "valid", "open", "approved", "paid", "نشط", "مفتوح", "ساري"].some((x) => v.includes(x))) return "ACTIVE";
  if (["inactive", "suspended", "closed", "غير نشط", "موقوف", "مغلق"].some((x) => v.includes(x))) return "INACTIVE";
  if (["rejected", "رفض"].some((x) => v.includes(x))) return "REJECTED";
  if (["locked", "قفل", "مقفل"].some((x) => v.includes(x))) return "LOCKED";
  return "PENDING";
}

function driverStatus(value) {
  const v = txt(value).toLowerCase();
  if (v.includes("suspend") || v.includes("موقوف")) return "SUSPENDED";
  if (v.includes("inactive") || v.includes("غير")) return "INACTIVE";
  return "ACTIVE";
}

function vehicleStatus(value, hasDriver) {
  const v = txt(value).toLowerCase();
  if (v.includes("maintenance") || v.includes("صيانة")) return "MAINTENANCE";
  if (v.includes("accident") || v.includes("حادث")) return "ACCIDENT";
  if (v.includes("inactive") || v.includes("غير")) return "INACTIVE";
  return hasDriver ? "ASSIGNED" : "AVAILABLE";
}

function appName(row) {
  return txt(row.appName || row.primaryAppName || row.projectName || row.app || "Keeta");
}

function cityIdOf(row, knownCities) {
  const id = txt(row.cityId);
  return knownCities.has(id) ? id : null;
}

function projectIdFor(cityId, app) {
  return safeId("legacy_project", `${cityId || "all"}_${txt(app) || "unknown"}`);
}

function accountIdFor(username) {
  return safeId("legacy_account", username);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

async function main() {
  const db = JSON.parse(fs.readFileSync(legacyPath, "utf8"));
  const state = db.state ?? db;
  const counters = {};
  const knownCities = new Set();
  const knownSupervisors = new Set();
  const knownVehicles = new Set();
  const knownAccounts = new Set();
  const driverByLegacy = new Map();
  const driverByCode = new Map();
  const driverByAppId = new Map();

  for (const city of asArray(state.cities)) {
    const id = txt(city.id) || safeId("legacy_city", city.nameAr || city.nameEn);
    knownCities.add(id);
    await prisma.city.upsert({
      where: { id },
      update: {
        nameAr: txt(city.nameAr || city.name || city.nameEn || id),
        nameEn: txt(city.nameEn || city.name || ""),
        status: recordStatus(city.status || "Active"),
      },
      create: {
        id,
        nameAr: txt(city.nameAr || city.name || city.nameEn || id),
        nameEn: txt(city.nameEn || city.name || ""),
        status: recordStatus(city.status || "Active"),
      },
    });
    counters.cities = (counters.cities ?? 0) + 1;
  }

  for (const supervisor of asArray(state.supervisors)) {
    const id = txt(supervisor.id) || safeId("legacy_supervisor", supervisor.email || supervisor.name);
    knownSupervisors.add(id);
    await prisma.supervisor.upsert({
      where: { id },
      update: {
        name: txt(supervisor.name || supervisor.email || id),
        phone: txt(supervisor.phone),
        email: txt(supervisor.email),
        cityId: cityIdOf(supervisor, knownCities),
        status: recordStatus(supervisor.status || "Active"),
      },
      create: {
        id,
        name: txt(supervisor.name || supervisor.email || id),
        phone: txt(supervisor.phone),
        email: txt(supervisor.email),
        cityId: cityIdOf(supervisor, knownCities),
        status: recordStatus(supervisor.status || "Active"),
      },
    });
    counters.supervisors = (counters.supervisors ?? 0) + 1;
  }

  const projectKeys = new Set();
  for (const row of [...asArray(state.drivers), ...asArray(state.dailyReports), ...asArray(state.appAccounts)]) {
    const cityId = cityIdOf(row, knownCities);
    const app = appName(row);
    const id = projectIdFor(cityId, app);
    if (projectKeys.has(id)) continue;
    projectKeys.add(id);
    await prisma.project.upsert({
      where: { id },
      update: { name: app, appName: app, cityId, status: "ACTIVE" },
      create: { id, name: app, appName: app, cityId, status: "ACTIVE" },
    });
    counters.projects = (counters.projects ?? 0) + 1;
  }

  for (const account of asArray(state.appAccounts)) {
    const username = txt(account.username || account.account || account.appAccountId || account.id);
    if (!username) continue;
    const cityId = cityIdOf(account, knownCities);
    const app = appName(account);
    const id = accountIdFor(username);
    knownAccounts.add(id);
    await prisma.applicationAccount.upsert({
      where: { username },
      update: {
        appName: app,
        projectId: projectIdFor(cityId, app),
        cityId,
        driverId: txt(account.driverId || account.riderId),
        isEmpty: !txt(account.driverId || account.riderId),
        status: recordStatus(account.status || "Active"),
      },
      create: {
        id,
        appName: app,
        username,
        projectId: projectIdFor(cityId, app),
        cityId,
        driverId: txt(account.driverId || account.riderId),
        isEmpty: !txt(account.driverId || account.riderId),
        status: recordStatus(account.status || "Active"),
      },
    });
    counters.accounts = (counters.accounts ?? 0) + 1;
  }

  for (const vehicle of asArray(state.vehicles)) {
    const plate = txt(vehicle.plateEn || vehicle.plateNumber || vehicle.plateAr || vehicle.vehiclePlate || vehicle.id);
    if (!plate) continue;
    const id = txt(vehicle.id) || safeId("legacy_vehicle", plate);
    knownVehicles.add(id);
    await prisma.vehicle.upsert({
      where: { plateEn: plate },
      update: {
        plateAr: txt(vehicle.plateAr || vehicle.plateNumber || vehicle.vehiclePlate),
        model: txt(vehicle.model || vehicle.carType || vehicle.vehicleModel),
        rentalCompany: txt(vehicle.rentalCompany || vehicle.ownerCompany || vehicle.sourceType),
        monthlyRent: num(vehicle.monthlyRent || vehicle.rentAmount || vehicle.vehicleRent),
        status: vehicleStatus(vehicle.status, txt(vehicle.driverId || vehicle.currentDriverId)),
        currentDriverId: txt(vehicle.currentDriverId || vehicle.driverId),
        cityId: cityIdOf(vehicle, knownCities),
      },
      create: {
        id,
        plateAr: txt(vehicle.plateAr || vehicle.plateNumber || vehicle.vehiclePlate),
        plateEn: plate,
        model: txt(vehicle.model || vehicle.carType || vehicle.vehicleModel),
        rentalCompany: txt(vehicle.rentalCompany || vehicle.ownerCompany || vehicle.sourceType),
        monthlyRent: num(vehicle.monthlyRent || vehicle.rentAmount || vehicle.vehicleRent),
        status: vehicleStatus(vehicle.status, txt(vehicle.driverId || vehicle.currentDriverId)),
        currentDriverId: txt(vehicle.currentDriverId || vehicle.driverId),
        cityId: cityIdOf(vehicle, knownCities),
      },
    });
    counters.vehicles = (counters.vehicles ?? 0) + 1;
  }

  for (const driver of asArray(state.drivers)) {
    const internalCode = txt(driver.internalCode || driver.driverCode || driver.id || driver.nationalId);
    if (!internalCode) continue;
    const id = txt(driver.id) || safeId("legacy_driver", internalCode);
    const cityId = cityIdOf(driver, knownCities);
    const app = appName(driver);
    const username = txt(driver.appAccountId || driver.appDriverId || driver.keetaCourierId || driver.courierId || driver.appAccountName);
    const accountId = username ? accountIdFor(username) : null;
    if (accountId && !knownAccounts.has(accountId)) {
      await prisma.applicationAccount.upsert({
        where: { username },
        update: { appName: app, projectId: projectIdFor(cityId, app), cityId, driverId: id, isEmpty: false },
        create: { id: accountId, appName: app, username, projectId: projectIdFor(cityId, app), cityId, driverId: id, isEmpty: false },
      });
      knownAccounts.add(accountId);
    }
    const vehicleId = knownVehicles.has(txt(driver.vehicleId || driver.assignedVehicleId)) ? txt(driver.vehicleId || driver.assignedVehicleId) : null;
    const supervisorId = knownSupervisors.has(txt(driver.supervisorId)) ? txt(driver.supervisorId) : null;
    await prisma.driver.upsert({
      where: { internalCode },
      update: {
        name: txt(driver.name || driver.systemName || driver.appAccountName || internalCode),
        phone: txt(driver.phone || driver.mobile || driver.driverAppPhone),
        nationalId: txt(driver.nationalId || driver.iqamaId || driver.iqamaNo),
        cityId,
        projectId: projectIdFor(cityId, app),
        supervisorId,
        vehicleId,
        accountId: accountId && knownAccounts.has(accountId) ? accountId : null,
        status: driverStatus(driver.status || driver.driverAppStatus || driver.keetaStatus),
        contractType: txt(driver.contractType || driver.relationshipType),
        housingStatus: txt(driver.housingStatus || driver.housingType),
      },
      create: {
        id,
        internalCode,
        name: txt(driver.name || driver.systemName || driver.appAccountName || internalCode),
        phone: txt(driver.phone || driver.mobile || driver.driverAppPhone),
        nationalId: txt(driver.nationalId || driver.iqamaId || driver.iqamaNo),
        cityId,
        projectId: projectIdFor(cityId, app),
        supervisorId,
        vehicleId,
        accountId: accountId && knownAccounts.has(accountId) ? accountId : null,
        status: driverStatus(driver.status || driver.driverAppStatus || driver.keetaStatus),
        contractType: txt(driver.contractType || driver.relationshipType),
        housingStatus: txt(driver.housingStatus || driver.housingType),
      },
    });
    driverByLegacy.set(txt(driver.id), id);
    driverByCode.set(internalCode, id);
    [driver.nationalId, driver.iqamaId, driver.appDriverId, driver.keetaCourierId, driver.courierId, driver.appAccountId].forEach((key) => {
      if (txt(key)) driverByAppId.set(txt(key), id);
    });
    counters.drivers = (counters.drivers ?? 0) + 1;
  }

  for (const report of asArray(state.dailyReports)) {
    const reportDate = dateOrNull(report.date || report.reportDate);
    if (!reportDate) continue;
    const id = txt(report.id) || safeId("legacy_daily", `${report.date}_${report.driverCode || report.appDriverId}_${report.appName}`);
    const driverId = driverByLegacy.get(txt(report.driverId)) || driverByCode.get(txt(report.driverCode)) || driverByAppId.get(txt(report.appDriverId || report.courierId || report.iqamaId)) || null;
    const cityId = cityIdOf(report, knownCities);
    const app = appName(report);
    await prisma.dailyReport.upsert({
      where: { id },
      update: {
        reportDate,
        month: monthOf(report.date || report.reportDate),
        driverId,
        cityId,
        projectId: projectIdFor(cityId, app),
        appName: app,
        orders: Math.round(num(report.orders)),
        workingHours: num(report.hours || report.workingHours),
        onTimeRate: num(report.onTime || report.onTimeRate),
        cancellationRate: num(report.cancellation || report.cancellationRate),
        rejectionRate: num(report.rejection || report.rejectionRate),
      },
      create: {
        id,
        reportDate,
        month: monthOf(report.date || report.reportDate),
        driverId,
        cityId,
        projectId: projectIdFor(cityId, app),
        appName: app,
        orders: Math.round(num(report.orders)),
        workingHours: num(report.hours || report.workingHours),
        onTimeRate: num(report.onTime || report.onTimeRate),
        cancellationRate: num(report.cancellation || report.cancellationRate),
        rejectionRate: num(report.rejection || report.rejectionRate),
      },
    });
    counters.dailyReports = (counters.dailyReports ?? 0) + 1;
  }

  for (const task of asArray(state.tasks)) {
    const id = txt(task.id) || safeId("legacy_task", task.title || counters.tasks);
    await prisma.task.upsert({
      where: { id },
      update: {
        title: txt(task.title || task.name || "مهمة تشغيلية"),
        description: txt(task.description || task.notes),
        cityId: cityIdOf(task, knownCities),
        supervisorId: knownSupervisors.has(txt(task.supervisorId)) ? txt(task.supervisorId) : null,
        driverId: driverByLegacy.get(txt(task.driverId)) || null,
        priority: txt(task.priority).toLowerCase().includes("critical") ? "CRITICAL" : txt(task.priority).toLowerCase().includes("warn") ? "WARNING" : "INFO",
        status: recordStatus(task.status),
        dueDate: dateOrNull(task.dueDate),
      },
      create: {
        id,
        title: txt(task.title || task.name || "مهمة تشغيلية"),
        description: txt(task.description || task.notes),
        cityId: cityIdOf(task, knownCities),
        supervisorId: knownSupervisors.has(txt(task.supervisorId)) ? txt(task.supervisorId) : null,
        driverId: driverByLegacy.get(txt(task.driverId)) || null,
        priority: txt(task.priority).toLowerCase().includes("critical") ? "CRITICAL" : txt(task.priority).toLowerCase().includes("warn") ? "WARNING" : "INFO",
        status: recordStatus(task.status),
        dueDate: dateOrNull(task.dueDate),
      },
    });
    counters.tasks = (counters.tasks ?? 0) + 1;
  }

  for (const notification of asArray(state.notifications)) {
    const id = txt(notification.id) || safeId("legacy_notification", notification.title || counters.notifications);
    await prisma.notification.upsert({
      where: { id },
      update: {
        title: txt(notification.title || notification.message || "تنبيه"),
        body: txt(notification.body || notification.message || notification.notes),
        severity: txt(notification.severity || notification.type).toLowerCase().includes("critical") ? "CRITICAL" : txt(notification.severity || notification.type).toLowerCase().includes("warn") ? "WARNING" : "INFO",
        status: recordStatus(notification.status),
        driverId: driverByLegacy.get(txt(notification.driverId)) || null,
        entityType: txt(notification.entityType || notification.actionType),
        entityId: txt(notification.entityId || notification.relatedId),
      },
      create: {
        id,
        title: txt(notification.title || notification.message || "تنبيه"),
        body: txt(notification.body || notification.message || notification.notes),
        severity: txt(notification.severity || notification.type).toLowerCase().includes("critical") ? "CRITICAL" : txt(notification.severity || notification.type).toLowerCase().includes("warn") ? "WARNING" : "INFO",
        status: recordStatus(notification.status),
        driverId: driverByLegacy.get(txt(notification.driverId)) || null,
        entityType: txt(notification.entityType || notification.actionType),
        entityId: txt(notification.entityId || notification.relatedId),
      },
    });
    counters.notifications = (counters.notifications ?? 0) + 1;
  }

  for (const invoice of asArray(state.invoicesRecords)) {
    const number = txt(invoice.number || invoice.invoiceNo || invoice.id);
    if (!number) continue;
    await prisma.invoice.upsert({
      where: { number },
      update: {
        client: txt(invoice.client || invoice.customer || invoice.projectName),
        month: txt(invoice.month || monthOf(invoice.date || invoice.issuedAt)),
        amount: num(invoice.amount || invoice.total || invoice.totalAmount),
        vatAmount: num(invoice.vatAmount || invoice.vat),
        status: recordStatus(invoice.status),
        issuedAt: requiredDate(invoice.issuedAt || invoice.date),
        dueDate: dateOrNull(invoice.dueDate),
      },
      create: {
        id: txt(invoice.id) || safeId("legacy_invoice", number),
        number,
        client: txt(invoice.client || invoice.customer || invoice.projectName),
        month: txt(invoice.month || monthOf(invoice.date || invoice.issuedAt)),
        amount: num(invoice.amount || invoice.total || invoice.totalAmount),
        vatAmount: num(invoice.vatAmount || invoice.vat),
        status: recordStatus(invoice.status),
        issuedAt: requiredDate(invoice.issuedAt || invoice.date),
        dueDate: dateOrNull(invoice.dueDate),
      },
    });
    counters.invoices = (counters.invoices ?? 0) + 1;
  }

  for (const log of asArray(state.auditLogRecords).slice(0, 1000)) {
    const id = txt(log.id) || safeId("legacy_audit", `${log.action}_${log.at || log.createdAt}_${counters.auditLogs || 0}`);
    await prisma.auditLog.upsert({
      where: { id },
      update: {
        user: txt(log.user || log.createdBy),
        action: txt(log.action || "legacy/import"),
        entityType: txt(log.entityType || log.section || "legacy"),
        entityId: txt(log.entityId || log.id),
        newValue: log,
      },
      create: {
        id,
        user: txt(log.user || log.createdBy),
        action: txt(log.action || "legacy/import"),
        entityType: txt(log.entityType || log.section || "legacy"),
        entityId: txt(log.entityId || log.id),
        newValue: log,
        createdAt: dateOrNull(log.at || log.createdAt) ?? new Date(),
      },
    });
    counters.auditLogs = (counters.auditLogs ?? 0) + 1;
  }

  await prisma.importBatch.upsert({
    where: { id: "legacy-db-json-import" },
    update: {
      fileName: "data/db.json",
      importType: "legacy-migration",
      status: "APPROVED",
      rowsFound: Object.values(counters).reduce((a, b) => a + Number(b || 0), 0),
      rowsImported: Object.values(counters).reduce((a, b) => a + Number(b || 0), 0),
      errors: [],
    },
    create: {
      id: "legacy-db-json-import",
      fileName: "data/db.json",
      importType: "legacy-migration",
      status: "APPROVED",
      rowsFound: Object.values(counters).reduce((a, b) => a + Number(b || 0), 0),
      rowsImported: Object.values(counters).reduce((a, b) => a + Number(b || 0), 0),
      errors: [],
      createdBy: "Codex migration",
    },
  });

  console.log(JSON.stringify(counters, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
