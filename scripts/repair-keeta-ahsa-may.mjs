import fs from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import { Prisma, PrismaClient, RecordStatus } from "@prisma/client";

const prisma = new PrismaClient();

const MONTH = "2026-05";
const CITY_AR = "\u0627\u0644\u0623\u062d\u0633\u0627\u0621";
const CITY_EN = "Al Ahsa";
const PROJECT_CODE = "KEETA-AHSA";
const PROJECT_NAME = `Keeta - ${CITY_AR}`;
const PERIOD_START = new Date("2026-05-01T00:00:00.000Z");
const PERIOD_END = new Date("2026-05-31T23:59:59.999Z");
const DEFAULT_PERFORMANCE_FILE = "C:/Users/hp/Downloads/20260619_221640_f620d8c4.xlsx";
const DEFAULT_INVOICE_FILE = "C:/Users/hp/Downloads/Company ANAN AL-ASMA For logistics (Holding) ( Al Ahsa )#2026-05#slab mode Bill1781076979849.xlsx";

function argValue(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

const performancePath = argValue("performance", DEFAULT_PERFORMANCE_FILE);
const invoicePath = argValue("invoice", DEFAULT_INVOICE_FILE);

function clean(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("text" in value) return clean(value.text);
    if ("result" in value) return clean(value.result);
    if ("richText" in value) return value.richText.map((part) => part.text || "").join("").trim();
  }
  return String(value).trim();
}

function numberValue(value) {
  const text = clean(value).replace(/SAR/gi, "").replace(/,/g, "").replace(/[^\d.\-]/g, "");
  if (!text || text === "-" || text === ".") return 0;
  const n = Number(text);
  return Number.isFinite(n) ? n : 0;
}

function intValue(value) {
  return Math.round(numberValue(value));
}

function decimal(value) {
  return new Prisma.Decimal(Math.round((Number(value) || 0) * 100) / 100);
}

function rateValue(value) {
  const n = numberValue(value);
  return n > 1 ? n / 100 : n;
}

function boolValue(value) {
  const text = clean(value).toLowerCase();
  if (["yes", "true", "valid", "1", "y"].includes(text)) return true;
  if (["no", "false", "invalid", "0", "n"].includes(text)) return false;
  return null;
}

function excelDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  if (typeof value === "number" && value >= 19000101 && value <= 22001231) {
    const text = String(Math.trunc(value));
    return new Date(Date.UTC(Number(text.slice(0, 4)), Number(text.slice(4, 6)) - 1, Number(text.slice(6, 8))));
  }
  if (typeof value === "number" && value > 20000 && value < 60000) return new Date(Date.UTC(1899, 11, 30 + Math.floor(value)));
  const text = clean(value);
  if (/^\d{8}$/.test(text)) return new Date(Date.UTC(Number(text.slice(0, 4)), Number(text.slice(4, 6)) - 1, Number(text.slice(6, 8))));
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return new Date(`${text.slice(0, 10)}T00:00:00.000Z`);
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) {
    const [m, d, y] = text.split("/").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

function durationHours(value) {
  if (typeof value === "number") return Math.round(value * 100) / 100;
  const text = clean(value).toLowerCase();
  if (!text || text === "-") return 0;
  let hours = 0;
  const hr = text.match(/([\d.]+)\s*hr/);
  const min = text.match(/([\d.]+)\s*min/);
  const sec = text.match(/([\d.]+)\s*sec/);
  if (hr) hours += Number(hr[1]) || 0;
  if (min) hours += (Number(min[1]) || 0) / 60;
  if (sec) hours += (Number(sec[1]) || 0) / 3600;
  if (!hours && /^\d+(\.\d+)?$/.test(text)) hours = Number(text);
  return Math.round(hours * 100) / 100;
}

function rowObjects(worksheet) {
  const headers = [];
  worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
    const header = clean(cell.value).trim();
    if (header) headers[col] = header;
  });
  const rows = [];
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const record = {};
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      const header = headers[col];
      if (header) record[header] = clean(cell.value);
    });
    if (Object.values(record).some((value) => clean(value))) rows.push({ rowNumber, record });
  }
  return rows;
}

async function readRows(filePath, sheetName) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = sheetName ? workbook.getWorksheet(sheetName) : workbook.worksheets[0];
  if (!worksheet) throw new Error(`Sheet ${sheetName || "first"} not found in ${filePath}`);
  return { workbook, worksheet, rows: rowObjects(worksheet) };
}

async function ensureKeetaAhsa() {
  const canonicalApp = await prisma.application.upsert({
    where: { code: "KEETA" },
    update: { name: "Keeta", status: RecordStatus.ACTIVE },
    create: { code: "KEETA", name: "Keeta", status: RecordStatus.ACTIVE },
  });
  const duplicateApps = await prisma.application.findMany({
    where: {
      id: { not: canonicalApp.id },
      OR: [{ code: { equals: "keeta", mode: "insensitive" } }, { name: { equals: "Keeta", mode: "insensitive" } }],
    },
    select: { id: true, code: true, name: true },
  });
  const duplicateAppIds = duplicateApps.map((app) => app.id);

  if (duplicateAppIds.length) {
    await prisma.applicationAccount.updateMany({ where: { applicationId: { in: duplicateAppIds } }, data: { applicationId: canonicalApp.id, appName: "Keeta", projectId: null } });
    await prisma.applicationImportBatch.updateMany({ where: { applicationId: { in: duplicateAppIds } }, data: { applicationId: canonicalApp.id } });
    await prisma.applicationImportTemplate.updateMany({ where: { applicationId: { in: duplicateAppIds } }, data: { applicationId: canonicalApp.id } });
    await prisma.applicationPayrollSetting.updateMany({ where: { applicationId: { in: duplicateAppIds } }, data: { applicationId: canonicalApp.id } });
    await prisma.payrollRun.updateMany({ where: { applicationId: { in: duplicateAppIds } }, data: { applicationId: canonicalApp.id } });
    await prisma.financeEntry.updateMany({ where: { applicationId: { in: duplicateAppIds } }, data: { applicationId: canonicalApp.id } });
    await prisma.application.updateMany({ where: { id: { in: duplicateAppIds } }, data: { status: RecordStatus.INACTIVE } });
  }

  const city =
    (await prisma.city.findFirst({
      where: {
        OR: [
          { nameEn: { equals: CITY_EN, mode: "insensitive" } },
          { nameEn: { equals: "AHS", mode: "insensitive" } },
          { nameAr: { equals: "الإحساء", mode: "insensitive" } },
          { nameAr: { equals: "الاحساء", mode: "insensitive" } },
          { nameAr: { equals: CITY_AR, mode: "insensitive" } },
        ],
      },
    })) ||
    (await prisma.city.create({ data: { nameAr: CITY_AR, nameEn: CITY_EN, status: RecordStatus.ACTIVE } }));
  const normalizedCity = await prisma.city.update({ where: { id: city.id }, data: { nameAr: CITY_AR, nameEn: CITY_EN, status: RecordStatus.ACTIVE } });
  const operationalCityCandidates = await prisma.city.findMany({
    where: {
      OR: [
        { id: normalizedCity.id },
        { nameEn: { equals: CITY_EN, mode: "insensitive" } },
        { nameEn: { equals: "AHS", mode: "insensitive" } },
        { nameAr: { contains: "حسا" } },
        { nameAr: { equals: CITY_AR, mode: "insensitive" } },
      ],
    },
    include: { _count: { select: { drivers: true, vehicles: true, applicationAccounts: true, applicationProjects: true } } },
  });
  const operationalCity =
    operationalCityCandidates.sort((a, b) => {
      const activeDelta = (b.status === RecordStatus.ACTIVE ? 1 : 0) - (a.status === RecordStatus.ACTIVE ? 1 : 0);
      if (activeDelta) return activeDelta;
      const score = (item) => item._count.drivers * 100000 + item._count.vehicles * 10000 + item._count.applicationAccounts * 100 + item._count.applicationProjects;
      return score(b) - score(a);
    })[0] || normalizedCity;
  if (operationalCity.id !== normalizedCity.id || operationalCity.nameAr !== CITY_AR || operationalCity.nameEn !== CITY_EN || operationalCity.status !== RecordStatus.ACTIVE) {
    await prisma.city.update({ where: { id: operationalCity.id }, data: { nameAr: CITY_AR, nameEn: CITY_EN, status: RecordStatus.ACTIVE } });
  }

  const project = await prisma.applicationProject.upsert({
    where: { code: PROJECT_CODE },
    update: { applicationId: canonicalApp.id, cityId: operationalCity.id, name: PROJECT_NAME, status: RecordStatus.ACTIVE },
    create: { applicationId: canonicalApp.id, cityId: operationalCity.id, code: PROJECT_CODE, name: PROJECT_NAME, status: RecordStatus.ACTIVE },
  });

  await prisma.applicationAccount.updateMany({
    where: {
      OR: [
        { applicationProjectId: project.id },
        { cityId: operationalCity.id, appName: { equals: "Keeta", mode: "insensitive" } },
      ],
    },
    data: { applicationId: canonicalApp.id, applicationProjectId: project.id, cityId: operationalCity.id, appName: "Keeta", projectId: null },
  });

  await prisma.keetaInvoiceRecord.updateMany({ where: { applicationProjectId: project.id }, data: { cityId: operationalCity.id } });
  await prisma.keetaRankRecord.updateMany({ where: { applicationProjectId: project.id }, data: { cityId: operationalCity.id } });
  await prisma.keetaPerformanceRecord.updateMany({ where: { applicationProjectId: project.id }, data: { cityId: operationalCity.id } });

  return { app: canonicalApp, duplicateApps, city: operationalCity, project };
}

async function accountForCourier(master, courierId, courierName) {
  if (!courierId) return { account: null, driver: null, reason: "missing_courier_id" };
  let account =
    (await prisma.applicationAccount.findFirst({
      where: { applicationProjectId: master.project.id, OR: [{ appUserId: courierId }, { username: courierId }, { appUsername: courierId }] },
      include: { driver: true },
    })) ||
    (await prisma.applicationAccount.findFirst({
      where: { applicationId: master.app.id, cityId: master.city.id, OR: [{ appUserId: courierId }, { username: courierId }, { appUsername: courierId }] },
      include: { driver: true },
    }));

  if (!account) {
    const usernameBase = `${courierId}-${PROJECT_CODE}`;
    const username = (await prisma.applicationAccount.findUnique({ where: { username: usernameBase }, select: { id: true } })) ? `${usernameBase}-${Date.now().toString(36)}` : usernameBase;
    account = await prisma.applicationAccount.create({
      data: {
        appName: "Keeta",
        username,
        appUserId: courierId,
        appUsername: courierName || courierId,
        applicationId: master.app.id,
        applicationProjectId: master.project.id,
        cityId: master.city.id,
        driverId: null,
        needsReview: true,
        unmatchedReason: "missing_driver",
        isEmpty: true,
        source: "KEETA_AHSA_REPAIR",
        status: RecordStatus.ACTIVE,
      },
      include: { driver: true },
    });
  } else if (account.applicationId !== master.app.id || account.applicationProjectId !== master.project.id || account.cityId !== master.city.id) {
    account = await prisma.applicationAccount.update({
      where: { id: account.id },
      data: {
        applicationId: master.app.id,
        applicationProjectId: master.project.id,
        cityId: master.city.id,
        appName: "Keeta",
        projectId: null,
        needsReview: account.driverId ? false : true,
        unmatchedReason: account.driverId ? null : "missing_driver",
        isEmpty: account.driverId ? false : true,
      },
      include: { driver: true },
    });
  }

  if (!account.driverId) {
    await prisma.applicationAccount.update({ where: { id: account.id }, data: { needsReview: true, unmatchedReason: "missing_driver", isEmpty: true } });
    return { account, driver: null, reason: "missing_driver" };
  }
  return { account, driver: account.driver, reason: null };
}

async function upsertImportBatch(master, { filePath, importType, sheetNames, rows, matched, unmatched, totals }) {
  const fileName = path.basename(filePath);
  const existingBatches = await prisma.applicationImportBatch.findMany({
    where: { applicationProjectId: master.project.id, cityId: master.city.id, fileType: importType, month: MONTH, sourceFileName: fileName },
    select: { id: true, createdAt: true },
    orderBy: [{ createdAt: "desc" }],
  });
  const existing = existingBatches[0];
  const data = {
    applicationId: master.app.id,
    applicationProjectId: master.project.id,
    cityId: master.city.id,
    fileType: importType,
    importType,
    month: MONTH,
    fileName,
    sourceFileName: fileName,
    periodStart: PERIOD_START,
    periodEnd: PERIOD_END,
    status: unmatched.length ? "committed_with_review" : "committed_processed",
    sheetNames,
    totalRows: rows.length,
    validRows: matched.length,
    invalidRows: unmatched.length,
    unmatchedRows: unmatched.length,
    missingDrivers: unmatched.length,
    previewData: { totals, matchedRows: matched.length, unmatchedRows: unmatched.length },
    errorRows: unmatched.map((row) => ({ rowNumber: row.rowNumber, courierId: row.courierId, courierName: row.courierName, reason: row.reason })),
    matchedColumns: [],
    uploadedBy: "System",
    approvedAt: new Date(),
    committedAt: new Date(),
  };
  const batch = existing ? await prisma.applicationImportBatch.update({ where: { id: existing.id }, data }) : await prisma.applicationImportBatch.create({ data });
  const oldBatchIds = existingBatches.filter((item) => item.id !== batch.id).map((item) => item.id);
  if (oldBatchIds.length) {
    await prisma.applicationImportBatch.updateMany({
      where: { id: { in: oldBatchIds } },
      data: { status: "superseded", validRows: 0, invalidRows: 0, unmatchedRows: 0, missingDrivers: 0 },
    });
  }
  await prisma.applicationImportRow.deleteMany({ where: { batchId: batch.id } });
  if (rows.length) {
    await prisma.applicationImportRow.createMany({
      data: rows.map((row) => ({
        batchId: batch.id,
        rowNumber: row.rowNumber,
        rawData: row.rawData,
        mappedData: row.mappedData,
        isValid: !row.reason,
        errorType: row.reason || null,
        errorMessage: row.reason ? `${row.reason}: ${row.courierId || "missing courier"} / ${row.courierName || "-"}` : null,
        driverId: row.driverId || null,
        applicationAccountId: row.applicationAccountId || null,
        status: row.reason ? "review" : "ready",
      })),
    });
  }
  return batch;
}

async function importPerformance(master) {
  const { rows } = await readRows(performancePath);
  const imported = [];
  const unmatched = [];
  let minDate = null;
  let maxDate = null;
  for (const { rowNumber, record } of rows) {
    const courierId = clean(record["Courier ID"]);
    const courierName = [clean(record["Courier First Name"]), clean(record["Courier Last Name"])].filter(Boolean).join(" ").trim();
    const reportDate = excelDate(record[" Date"] || record.Date);
    const link = await accountForCourier(master, courierId, courierName);
    const mappedData = {
      courierId,
      courierFirstName: clean(record["Courier First Name"]),
      courierLastName: clean(record["Courier Last Name"]),
      deliveredTasks: intValue(record["Task Volumes_Delivered Tasks"]),
      acceptedTasks: intValue(record["Task Volumes_Accepted Tasks"]),
      onTimeRate: rateValue(record["Delivery Experience_On-time Rate (D)"]),
    };
    if (!reportDate) {
      unmatched.push({ rowNumber, courierId, courierName, reason: "invalid_report_date", rawData: record, mappedData });
      continue;
    }
    if (!minDate || reportDate < minDate) minDate = reportDate;
    if (!maxDate || reportDate > maxDate) maxDate = reportDate;
    const rowMeta = {
      rowNumber,
      courierId,
      courierName,
      rawData: record,
      mappedData,
      driverId: link.driver?.id,
      applicationAccountId: link.account?.id,
      reason: link.reason,
    };
    if (link.reason) {
      unmatched.push(rowMeta);
      continue;
    }
    const performanceData = {
      projectId: "keeta",
      applicationProjectId: master.project.id,
      driverId: link.driver.id,
      applicationAccountId: link.account.id,
      courierId,
      courierFirstName: clean(record["Courier First Name"]) || null,
      courierLastName: clean(record["Courier Last Name"]) || null,
      supervisorName: clean(record.Supervisor) || null,
      vehicleType: clean(record["Vehicle Type"]) || null,
      cityId: master.city.id,
      reportDate,
      month: MONTH,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      shiftAttendanceSummary: clean(record["Shift_Attendance Summary"]) || null,
      onShift: boolValue(record["Shift_On-Shift?"]),
      validDay: boolValue(record["Shift_Valid Day?"]),
      courierAppOnlineTime: decimal(durationHours(record["Shift_Courier App Online Time"])),
      validOnlineTime: decimal(durationHours(record["Shift_Valid Online Time"])),
      peakOnlineHours: decimal(durationHours(record["Shift_Peak Online Hours"])),
      acceptedTasks: intValue(record["Task Volumes_Accepted Tasks"]),
      tasksWithRestaurantArrivals: intValue(record["Task Volumes_Tasks with restaurant arrivals"]),
      deliveredTasks: intValue(record["Task Volumes_Delivered Tasks"]),
      largeOrderTasksCompleted: intValue(record["Task Volumes_Large Order Tasks Completed"]),
      rejectedTasks: intValue(record["Task Volumes_Rejected Tasks"]),
      rejectedTasksCourier: intValue(record["Task Volumes_Rejected Tasks (Courier)"]),
      rejectedTasksAuto: intValue(record["Task Volumes_Rejected Tasks (Auto)"]),
      cancellationRateFromDeliveryIssues: decimal(rateValue(record["Task Volumes_Cancellation Rate from Delivery Issues"])),
      orderCompletionRateNonDelivery: decimal(rateValue(record["Task Volumes_Order completion rate (non-delivery related)"])),
      onTimeRate: decimal(rateValue(record["Delivery Experience_On-time Rate (D)"])),
      largeOrderOnTimeRate: decimal(rateValue(record["Delivery Experience_Large order on-time rate"])),
      avgDeliveryTime: decimal(numberValue(record["Delivery Experience_Avg Delivery Time of Delivered Orders"])),
      deliveredOrdersOver55MinPercent: decimal(rateValue(record["Delivery Experience_Delivered Orders Prop. (Over 55min)"])),
      overdueOrderTasks: intValue(record["Delivery Experience_Overdue Order Tasks"]),
      severelyOverdueOrderTasks: intValue(record["Delivery Experience_Severely Overdue Order Tasks"]),
      rawData: record,
      status: "Approved",
      approvedBy: "System",
      approvedAt: new Date(),
    };
    const existing = await prisma.keetaPerformanceRecord.findMany({
      where: { applicationProjectId: master.project.id, cityId: master.city.id, courierId, reportDate },
      select: { id: true },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });
    if (existing[0]) {
      await prisma.keetaPerformanceRecord.update({ where: { id: existing[0].id }, data: performanceData });
      if (existing.length > 1) await prisma.keetaPerformanceRecord.deleteMany({ where: { id: { in: existing.slice(1).map((item) => item.id) } } });
    } else {
      await prisma.keetaPerformanceRecord.create({ data: performanceData });
    }
    imported.push(rowMeta);
  }
  const batch = await upsertImportBatch(master, {
    filePath: performancePath,
    importType: "keeta_period_report_template",
    sheetNames: ["0"],
    rows: [...imported, ...unmatched],
    matched: imported,
    unmatched,
    totals: {
      periodStart: (minDate || PERIOD_START).toISOString(),
      periodEnd: (maxDate || PERIOD_END).toISOString(),
      deliveredTasks: imported.reduce((sum, row) => sum + Number(row.mappedData.deliveredTasks || 0), 0),
      acceptedTasks: imported.reduce((sum, row) => sum + Number(row.mappedData.acceptedTasks || 0), 0),
    },
  });
  await prisma.keetaPerformanceRecord.updateMany({ where: { importBatchId: null, applicationProjectId: master.project.id, cityId: master.city.id, month: MONTH }, data: { importBatchId: batch.id } });
  return { rows: rows.length, imported, unmatched, batch };
}

async function importInvoice(master) {
  const { rows } = await readRows(invoicePath, "riderDetail");
  const imported = [];
  const unmatched = [];
  const totals = {
    deliveredOrders: 0,
    totalPayableAmount: 0,
    deduction: 0,
    foodCompensation: 0,
    tgaDeductionVatExcluded: 0,
  };
  for (const { rowNumber, record } of rows) {
    const courierId = clean(record["Courier ID"]);
    const courierName = clean(record["Courier name"]);
    const link = await accountForCourier(master, courierId, courierName);
    const mappedData = {
      courierId,
      courierName,
      deliveredOrders: intValue(record["Delivered Orders"]),
      totalPayableAmount: numberValue(record["Total payable amount"]),
      deduction: numberValue(record.Deduction),
      foodCompensation: numberValue(record["food compensation"]),
      tgaDeductionVatExcluded: numberValue(record["TGA Deduction(VAT Excluded)"]),
    };
    const rowMeta = {
      rowNumber,
      courierId,
      courierName,
      rawData: record,
      mappedData,
      driverId: link.driver?.id,
      applicationAccountId: link.account?.id,
      reason: link.reason,
    };
    if (link.reason) {
      unmatched.push(rowMeta);
      continue;
    }
    const invoiceData = {
      projectId: "keeta",
      applicationProjectId: master.project.id,
      driverId: link.driver.id,
      applicationAccountId: link.account.id,
      courierId,
      courierName,
      partnerId: clean(record["Partner ID"]) || null,
      partnerName: clean(record["Partner Name"]) || null,
      billingCycle: clean(record["Billing Cycle"]) || null,
      cityId: master.city.id,
      month: MONTH,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      isValid: boolValue(record["Is Valid"]),
      reason: clean(record.Reason) || null,
      onlineDaysValid: decimal(numberValue(record["Online Days-Valid"])),
      dailyOnlineHoursValid: decimal(numberValue(record["Daily Onlines Hours-Valid"])),
      dailyOnlineHoursPeakValid: decimal(numberValue(record["Daily Onlines Hours During Peak Time -Valid"])),
      deliveredOrders: mappedData.deliveredOrders,
      orderBasedPricing: decimal(numberValue(record["Order-Based pricing"])),
      distanceFromPriceIncrease: decimal(numberValue(record["Distance from price increase"])),
      validDaCapacityIncentives: decimal(numberValue(record["Valid DA Capacity Incentives"])),
      experienceIncentive: decimal(numberValue(record["Experience incentive"])),
      dxgy: decimal(numberValue(record.DXGY)),
      subsidy: decimal(numberValue(record.Subsidy)),
      activitiesAndOtherRewards: decimal(numberValue(record["Activities and other rewards"])),
      deduction: decimal(mappedData.deduction),
      foodCompensation: decimal(mappedData.foodCompensation),
      registrationServiceFee: decimal(numberValue(record["Registration service fee"])),
      otherAdjustment: decimal(numberValue(record["Other Adjustment"])),
      tipsExcludingTax: decimal(numberValue(record["Tips (excluding tax)"])),
      tgaDeductionVatExcluded: decimal(mappedData.tgaDeductionVatExcluded),
      totalPayableAmount: decimal(mappedData.totalPayableAmount),
      rawData: record,
      status: "Approved",
      approvedBy: "System",
      approvedAt: new Date(),
    };
    const existing = await prisma.keetaInvoiceRecord.findMany({
      where: { applicationProjectId: master.project.id, cityId: master.city.id, courierId, month: MONTH },
      select: { id: true },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });
    if (existing[0]) {
      await prisma.keetaInvoiceRecord.update({ where: { id: existing[0].id }, data: invoiceData });
      if (existing.length > 1) await prisma.keetaInvoiceRecord.deleteMany({ where: { id: { in: existing.slice(1).map((item) => item.id) } } });
    } else {
      await prisma.keetaInvoiceRecord.create({ data: invoiceData });
    }
    imported.push(rowMeta);
    totals.deliveredOrders += mappedData.deliveredOrders;
    totals.totalPayableAmount += mappedData.totalPayableAmount;
    totals.deduction += mappedData.deduction;
    totals.foodCompensation += mappedData.foodCompensation;
    totals.tgaDeductionVatExcluded += mappedData.tgaDeductionVatExcluded;
  }
  const batch = await upsertImportBatch(master, {
    filePath: invoicePath,
    importType: "keeta_driver_invoice_template",
    sheetNames: ["riderDetail"],
    rows: [...imported, ...unmatched],
    matched: imported,
    unmatched,
    totals,
  });
  await prisma.keetaInvoiceRecord.updateMany({ where: { invoiceBatchId: null, applicationProjectId: master.project.id, cityId: master.city.id, month: MONTH }, data: { invoiceBatchId: batch.id } });

  const amount = imported.reduce((sum, row) => sum + Number(row.mappedData.totalPayableAmount || 0), 0);
  const invoice = await prisma.invoice.findFirst({ where: { applicationProjectId: master.project.id, importBatchId: batch.id }, select: { id: true } });
  if (invoice) {
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { amount: decimal(amount), month: MONTH, status: unmatched.length ? RecordStatus.PENDING : RecordStatus.APPROVED, invoiceStatus: unmatched.length ? "Reviewed" : "Approved", approvedAt: unmatched.length ? null : new Date() },
    });
  } else {
    await prisma.invoice.create({
      data: {
        number: `KEETA-AHSA-${MONTH}-${batch.id.slice(-6).toUpperCase()}`,
        client: "Keeta",
        applicationProjectId: master.project.id,
        importBatchId: batch.id,
        month: MONTH,
        amount: decimal(amount),
        vatAmount: decimal(0),
        status: unmatched.length ? RecordStatus.PENDING : RecordStatus.APPROVED,
        invoiceStatus: unmatched.length ? "Reviewed" : "Approved",
        approvedAt: unmatched.length ? null : new Date(),
      },
    }).catch(async () => {
      await prisma.invoice.updateMany({
        where: { number: `KEETA-AHSA-${MONTH}-${batch.id.slice(-6).toUpperCase()}` },
        data: { amount: decimal(amount), month: MONTH },
      });
    });
  }
  return { rows: rows.length, imported, unmatched, totals, batch };
}

async function writeReports(master, performance, invoice) {
  const [driversCount, vehicles, accountsCount, rankCount, perfCount, invCount, reviewCount] = await Promise.all([
    prisma.driver.count({ where: { cityId: master.city.id, applicationAccounts: { some: { applicationProjectId: master.project.id } } } }),
    prisma.vehicle.findMany({ where: { cityId: master.city.id }, select: { id: true, plateArabic: true, plateEnglish: true, currentDriverId: true, status: true } }),
    prisma.applicationAccount.count({ where: { applicationProjectId: master.project.id } }),
    prisma.keetaRankRecord.count({ where: { applicationProjectId: master.project.id, cityId: master.city.id, month: MONTH, status: { in: ["Approved", "APPROVED", "Locked", "LOCKED", "Paid", "PAID"] } } }),
    prisma.keetaPerformanceRecord.count({ where: { applicationProjectId: master.project.id, cityId: master.city.id, month: MONTH, status: { in: ["Approved", "APPROVED", "Locked", "LOCKED", "Paid", "PAID"] } } }),
    prisma.keetaInvoiceRecord.count({ where: { applicationProjectId: master.project.id, cityId: master.city.id, month: MONTH, status: { in: ["Approved", "APPROVED", "Locked", "LOCKED", "Paid", "PAID"] } } }),
    prisma.applicationAccount.count({ where: { applicationProjectId: master.project.id, OR: [{ needsReview: true }, { driverId: null }] } }),
  ]);
  const matchedCourierIds = new Set([...performance.imported, ...invoice.imported].map((row) => row.courierId).filter(Boolean));
  const unmatchedRows = [...performance.unmatched, ...invoice.unmatched];

  const reports = [
    {
      name: "KEETA_CITY_NORMALIZATION_REPORT.md",
      content: `# Keeta City Normalization Report\n\n- City: ${master.city.nameAr} / ${master.city.nameEn}\n- City ID: ${master.city.id}\n- Application: ${master.app.code} / ${master.app.id}\n- ApplicationProject: ${master.project.code} / ${master.project.id}\n- Duplicate Keeta applications normalized: ${master.duplicateApps.length}\n- Import month: ${MONTH}\n`,
    },
    {
      name: "KEETA_AHSA_DRIVERS_AUDIT.md",
      content: `# Keeta Al Ahsa Drivers Audit\n\n- Linked drivers in project/city: ${driversCount}\n- Application accounts in project: ${accountsCount}\n- Accounts needing review: ${reviewCount}\n- Matched courier IDs in uploaded files: ${matchedCourierIds.size}\n- Unmatched rows: ${unmatchedRows.length}\n`,
    },
    {
      name: "KEETA_AHSA_VEHICLES_AUDIT.md",
      content: `# Keeta Al Ahsa Vehicles Audit\n\n- Vehicles in Al Ahsa: ${vehicles.length}\n- Vehicles assigned to drivers: ${vehicles.filter((vehicle) => vehicle.currentDriverId).length}\n- Vehicles without current driver: ${vehicles.filter((vehicle) => !vehicle.currentDriverId).length}\n`,
    },
    {
      name: "KEETA_AHSA_ACCOUNT_MATCHING_REPORT.md",
      content: `# Keeta Al Ahsa Account Matching Report\n\n- Matched invoice rows: ${invoice.imported.length}\n- Unmatched invoice rows: ${invoice.unmatched.length}\n- Matched performance rows: ${performance.imported.length}\n- Unmatched performance rows: ${performance.unmatched.length}\n\n## Unmatched Samples\n${unmatchedRows.slice(0, 50).map((row) => `- Row ${row.rowNumber}: ${row.courierId || "-"} / ${row.courierName || "-"} / ${row.reason}`).join("\n") || "- None"}\n`,
    },
    {
      name: "KEETA_MAY_2026_INVOICE_IMPORT_REPORT.md",
      content: `# Keeta May 2026 Invoice Import Report\n\n- File: ${path.basename(invoicePath)}\n- Rows: ${invoice.rows}\n- Saved/updated records: ${invoice.imported.length}\n- Unmatched rows: ${invoice.unmatched.length}\n- Delivered orders: ${invoice.totals.deliveredOrders}\n- Company revenue from Keeta: ${invoice.totals.totalPayableAmount.toFixed(2)}\n- App Deduction: ${invoice.totals.deduction.toFixed(2)}\n- Food compensation: ${invoice.totals.foodCompensation.toFixed(2)}\n- TGA Deduction: ${invoice.totals.tgaDeductionVatExcluded.toFixed(2)}\n- Batch: ${invoice.batch.id}\n`,
    },
    {
      name: "KEETA_MAY_2026_RANK_IMPORT_REPORT.md",
      content: `# Keeta May 2026 Rank Import Report\n\nNo RankPlanProcess file was included in this request. Existing approved rank records for ${PROJECT_CODE}/${MONTH}: ${rankCount}.\n\nPayroll can use invoice records now, but final Keeta payroll readiness still requires approved rank records for the same month/project.\n`,
    },
    {
      name: "KEETA_MAY_2026_DATA_RECONCILIATION_REPORT.md",
      content: `# Keeta May 2026 Data Reconciliation Report\n\n- Project: ${master.project.name}\n- Month: ${MONTH}\n- Invoice records: ${invCount}\n- Performance records: ${perfCount}\n- Rank records: ${rankCount}\n- Accounts needing review: ${reviewCount}\n- Payroll readiness: ${rankCount > 0 && invCount > 0 && reviewCount === 0 ? "Ready" : "Needs review"}\n- Note: Keeta performance reports are analytical and do not block payroll generation.\n`,
    },
  ];

  for (const report of reports) {
    await fs.writeFile(path.join(process.cwd(), report.name), report.content, "utf8");
  }
}

async function main() {
  await fs.access(performancePath);
  await fs.access(invoicePath);
  const master = await ensureKeetaAhsa();
  const performance = await importPerformance(master);
  const invoice = await importInvoice(master);
  await writeReports(master, performance, invoice);
  console.log(JSON.stringify({
    cityId: master.city.id,
    applicationProjectId: master.project.id,
    duplicateKeetaAppsNormalized: master.duplicateApps.length,
    performanceRows: performance.rows,
    performanceImported: performance.imported.length,
    performanceUnmatched: performance.unmatched.length,
    invoiceRows: invoice.rows,
    invoiceImported: invoice.imported.length,
    invoiceUnmatched: invoice.unmatched.length,
    reportsWritten: [
      "KEETA_CITY_NORMALIZATION_REPORT.md",
      "KEETA_AHSA_DRIVERS_AUDIT.md",
      "KEETA_AHSA_VEHICLES_AUDIT.md",
      "KEETA_AHSA_ACCOUNT_MATCHING_REPORT.md",
      "KEETA_MAY_2026_INVOICE_IMPORT_REPORT.md",
      "KEETA_MAY_2026_RANK_IMPORT_REPORT.md",
      "KEETA_MAY_2026_DATA_RECONCILIATION_REPORT.md",
    ],
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
