import fs from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import { PrismaClient, Prisma, RecordStatus, DriverStatus, VehicleStatus, PayrollStatus } from "@prisma/client";

const prisma = new PrismaClient();
const MONTH = "2026-04";
const YEAR = 2026;
const MONTH_NUMBER = 4;
const PERIOD_START = new Date(Date.UTC(2026, 3, 1));
const PERIOD_END = new Date(Date.UTC(2026, 3, 30, 23, 59, 59, 999));
const SOURCE_DIR = path.resolve(process.cwd(), "..", "..", "..");
const BACKUP_DIR = path.resolve(process.cwd(), "backups");

const OPERATIONAL_MODELS = [
  "payrollAdjustment",
  "payrollItem",
  "payrollRun",
  "payroll",
  "financeEntry",
  "invoice",
  "receivable",
  "payment",
  "expense",
  "revenue",
  "fuelRecord",
  "dailyReport",
  "advance",
  "deduction",
  "violation",
  "attendanceRecord",
  "shift",
  "task",
  "notification",
  "driverWarning",
  "driverHousing",
  "driverContract",
  "driverDocument",
  "interview",
  "vehicleAssignment",
  "vehicleMovement",
  "vehicleCleaning",
  "vehicleMaintenance",
  "vehicleAuthorization",
  "vehicleCost",
  "vehicleAccident",
  "vehicleDamage",
  "keetaInvoiceDetailRecord",
  "keetaInvoiceRecord",
  "keetaPerformanceRecord",
  "keetaRankRecord",
  "applicationImportRow",
  "applicationImportBatch",
  "uploadedReport",
  "importBatch",
  "appAccountMovement",
  "cityTarget",
  "applicationAccount",
  "vehicle",
  "driver",
];

function clean(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if (value.text) return String(value.text).trim();
    if (value.richText) return value.richText.map((part) => part.text).join("").trim();
    if (value.result !== undefined && value.result !== null) return String(value.result).trim();
    if (value.formula) return String(value.result ?? value.formula).trim();
  }
  return String(value).replace(/\u00a0/g, " ").trim();
}

function norm(value) {
  return clean(value).toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeCity(value) {
  const text = clean(value);
  if (!text) return "المدينة المنورة";
  if (text.includes("مدين")) return "المدينة المنورة";
  return text;
}

function normalizeProject(value) {
  const text = clean(value);
  return text ? "Keeta" : "Keeta";
}

function normalizeRelationship(value) {
  const text = norm(value);
  if (text.includes("كفالة") || text.includes("sponsor")) return "sponsorship";
  if (text.includes("اجير") || text.includes("أجير") || text.includes("ajeer")) return "ajeer";
  if (text.includes("حر") || text.includes("free")) return "freelancer";
  return text || "sponsorship";
}

function normalizeStatus(value, fallback = RecordStatus.ACTIVE) {
  const text = norm(value);
  if (["inactive", "suspended", "موقوف", "متوقف", "مغلق"].some((word) => text.includes(word))) return RecordStatus.INACTIVE;
  if (["pending", "معلق"].some((word) => text.includes(word))) return RecordStatus.PENDING;
  return fallback;
}

function normalizeDriverStatus(value) {
  const text = norm(value);
  if (text.includes("inactive") || text.includes("موقوف") || text.includes("متوقف")) return DriverStatus.SUSPENDED;
  return DriverStatus.ACTIVE;
}

function normalizeVehicleStatus(value, driverId) {
  const text = norm(value);
  if (text.includes("صيانة") || text.includes("maintenance")) return VehicleStatus.MAINTENANCE;
  if (text.includes("حادث") || text.includes("accident")) return VehicleStatus.ACCIDENT;
  if (text.includes("inactive") || text.includes("مغلق")) return VehicleStatus.INACTIVE;
  return driverId ? VehicleStatus.ASSIGNED : VehicleStatus.AVAILABLE;
}

function normalizeLevel(value) {
  const text = clean(value).toUpperCase();
  if (text.includes("A")) return "A";
  if (text.includes("B")) return "B";
  if (text.includes("C")) return "C";
  return "C";
}

function numeric(value) {
  if (value === null || value === undefined || value === "" || clean(value) === "-") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value instanceof Date) return 0;
  const text = clean(value)
    .replace(/[٬,]/g, "")
    .replace(/SAR/gi, "")
    .replace(/[^\d.\-]/g, "");
  if (!text || text === "-" || text === ".") return 0;
  const n = Number(text);
  return Number.isFinite(n) ? n : 0;
}

function intValue(value) {
  return Math.round(numeric(value));
}

function dateValue(value, fallback = PERIOD_START) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number" && value > 20000 && value < 60000) {
    return new Date(Date.UTC(1899, 11, 30 + Math.floor(value)));
  }
  const text = clean(value);
  if (/^\d{5}$/.test(text)) {
    const serial = Number(text);
    if (serial > 20000 && serial < 60000) return new Date(Date.UTC(1899, 11, 30 + Math.floor(serial)));
  }
  if (/^\d{8}$/.test(text)) {
    return new Date(Date.UTC(Number(text.slice(0, 4)), Number(text.slice(4, 6)) - 1, Number(text.slice(6, 8))));
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return new Date(`${text.slice(0, 10)}T00:00:00.000Z`);
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime()) || parsed.getUTCFullYear() > 2100 || parsed.getUTCFullYear() < 1900) return fallback;
  return parsed;
}

function durationHours(value) {
  const text = norm(value);
  if (!text || text === "-" || text === "0 sec") return 0;
  let hours = 0;
  const hr = text.match(/([\d.]+)\s*hr/);
  const min = text.match(/([\d.]+)\s*min/);
  const sec = text.match(/([\d.]+)\s*sec/);
  if (hr) hours += Number(hr[1]) || 0;
  if (min) hours += (Number(min[1]) || 0) / 60;
  if (sec) hours += (Number(sec[1]) || 0) / 3600;
  return Math.round(hours * 100) / 100;
}

function asRate(value) {
  const n = numeric(value);
  if (n > 1) return n / 100;
  return n;
}

function decimal(value) {
  return new Prisma.Decimal(Math.round((Number(value) || 0) * 100) / 100);
}

function driverCode(value, fallbackIndex) {
  const text = clean(value);
  if (/^DRV-/i.test(text)) return text.toUpperCase();
  const n = Number(text);
  if (Number.isFinite(n) && n > 0) return `DRV-MED-${String(n).padStart(4, "0")}`;
  return `DRV-MED-AUTO-${String(fallbackIndex).padStart(4, "0")}`;
}

function rowObjects(worksheet) {
  const headers = [];
  worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
    const header = clean(cell.value);
    headers[col] = header;
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

async function loadWorkbooks() {
  const files = (await fs.readdir(SOURCE_DIR)).filter((file) => file.endsWith(".xlsx"));
  const result = {};

  for (const fileName of files) {
    const fullPath = path.join(SOURCE_DIR, fileName);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(fullPath);
    const firstSheet = workbook.worksheets[0];
    const firstRows = rowObjects(firstSheet);
    const headers = new Set(Object.keys(firstRows[0]?.record ?? {}));

    if (workbook.getWorksheet("riderDetail") && workbook.getWorksheet("riderOrderDetail")) {
      result.invoice = { fileName, fullPath, workbook };
    } else if (headers.has("Current estimated level")) {
      result.rank = { fileName, fullPath, workbook };
    } else if (headers.has("Shift_Attendance Summary")) {
      result.performance = { fileName, fullPath, workbook };
    } else if (headers.has("Driver Code") && headers.has("Iqama ID")) {
      result.drivers = { fileName, fullPath, workbook };
    } else if (headers.has("Vehicle Code") && headers.has("Plate Arabic")) {
      result.vehicles = { fileName, fullPath, workbook };
    } else if (headers.has("id") && headers.has("إجمالي الخصومات")) {
      result.deductions = { fileName, fullPath, workbook };
    }
  }

  const missing = ["invoice", "rank", "performance", "drivers", "vehicles", "deductions"].filter((key) => !result[key]);
  if (missing.length) throw new Error(`Missing required workbook(s): ${missing.join(", ")}`);
  return result;
}

function rowsFor(book, sheetName) {
  const worksheet = sheetName ? book.workbook.getWorksheet(sheetName) : book.workbook.worksheets[0];
  if (!worksheet) throw new Error(`Missing sheet ${sheetName} in ${book.fileName}`);
  return rowObjects(worksheet);
}

function validCourierId(value) {
  const text = clean(value);
  return /^\d{8,}$/.test(text) ? text : "";
}

function buildSourceData(books) {
  const drivers = rowsFor(books.drivers).map(({ rowNumber, record }, index) => ({
    rowNumber,
    internalCode: driverCode(record["Driver Code"], index + 1),
    nationalId: clean(record["Iqama ID"]),
    actualName: clean(record["Arabic Driver Name (HR Approved)"]),
    cityName: normalizeCity(record.City),
    projectName: normalizeProject(record["Current Project"]),
    appName: clean(record["Primary App Name"]) || "Keeta",
    relationshipType: clean(record["Relationship Type"]) || "كفالة",
    relationshipKey: normalizeRelationship(record["Relationship Type"]),
    nationality: clean(record.Nationality),
    profession: clean(record.Profession),
    passportNumber: clean(record["Passport Number"]),
    passportExpiry: dateValue(record["Passport Expiry"], null),
    iqamaExpiry: dateValue(record["Iqama Expiry"], null),
    birthDate: dateValue(record["Birth Date"], null),
    housingType: clean(record["Housing Type"]),
    vehicleOwnership: clean(record["Vehicle Ownership"]),
    courierId: validCourierId(record["App Courier ID"]),
    appAccountName: clean(record["app Account Name English"]),
    appStatus: clean(record["Driver App Status"]),
    phone: clean(record["Login Phone"]),
    supervisorName: clean(record["المشرف"]) || "No Supervisor",
    notes: clean(record.Notes),
  }));

  const rank = rowsFor(books.rank).map(({ rowNumber, record }) => ({
    rowNumber,
    courierId: validCourierId(record["Courier ID"]),
    name: clean(record.Name),
    currentEstimatedLevel: clean(record["Current estimated level"]),
    currentEstimatedRanking: numeric(record["Current estimated ranking"]),
    courierRankingPercentile: numeric(record["Courier ranking percentile"]),
    currentScoreForForcedAssignment: numeric(record["Current score for forced assignment"]),
    currentEstimatedRewardAmount: numeric(record["Current estimated reward amount"]),
    onTimeRate: asRate(record["On-time rate"]),
    orderCompletionRate: asRate(record["Order completion % (non-delivery related)"]),
    dropOffNotEarlyRate: asRate(record["Didn’t tap “drop-off” too early (%)"]),
    orderVolume: intValue(record["Order volume"]),
    rawData: record,
  })).filter((row) => row.courierId);

  const performance = rowsFor(books.performance).map(({ rowNumber, record }) => {
    const accepted = intValue(record["Task Volumes_Accepted Tasks"]);
    const rejected =
      intValue(record["Task Volumes_Rejected Tasks"]) +
      intValue(record["Task Volumes_Rejected Tasks (Courier)"]) +
      intValue(record["Task Volumes_Rejected Tasks (Auto)"]);
    return {
      rowNumber,
      reportDate: dateValue(record.Date),
      courierId: validCourierId(record["Courier ID"]),
      firstName: clean(record["Courier First Name"]),
      lastName: clean(record["Courier Last Name"]),
      supervisorName: clean(record.Supervisor),
      vehicleType: clean(record["Vehicle Type"]),
      shiftAttendanceSummary: clean(record["Shift_Attendance Summary"]),
      onShift: norm(record["Shift_On-Shift?"]) === "yes",
      validDay: norm(record["Shift_Valid Day?"]) === "yes",
      courierAppOnlineTime: durationHours(record["Shift_Courier App Online Time"]),
      validOnlineTime: durationHours(record["Shift_Valid Online Time"]),
      peakOnlineHours: durationHours(record["Shift_Peak Online Hours"]),
      acceptedTasks: accepted,
      tasksWithRestaurantArrivals: intValue(record["Task Volumes_Tasks with restaurant arrivals"]),
      deliveredTasks: intValue(record["Task Volumes_Delivered Tasks"]),
      largeOrderTasksCompleted: intValue(record["Task Volumes_Large Order Tasks Completed"]),
      rejectedTasks: intValue(record["Task Volumes_Rejected Tasks"]),
      rejectedTasksCourier: intValue(record["Task Volumes_Rejected Tasks (Courier)"]),
      rejectedTasksAuto: intValue(record["Task Volumes_Rejected Tasks (Auto)"]),
      cancellationRateFromDeliveryIssues: asRate(record["Task Volumes_Cancellation Rate from Delivery Issues"]),
      orderCompletionRateNonDelivery: asRate(record["Task Volumes_Order completion rate (non-delivery related)"]),
      onTimeRate: asRate(record["Delivery Experience_On-time Rate (D)"]),
      largeOrderOnTimeRate: asRate(record["Delivery Experience_Large order on-time rate"]),
      avgDeliveryTime: numeric(record["Delivery Experience_Avg Delivery Time of Delivered Orders"]),
      deliveredOrdersOver55MinPercent: asRate(record["Delivery Experience_Delivered Orders Prop. (Over 55min)"]),
      overdueOrderTasks: intValue(record["Delivery Experience_Overdue Order Tasks"]),
      severelyOverdueOrderTasks: intValue(record["Delivery Experience_Severely Overdue Order Tasks"]),
      rejectionRate: accepted > 0 ? rejected / accepted : 0,
      rawData: record,
    };
  }).filter((row) => row.courierId);

  const invoiceDetail = rowsFor(books.invoice, "riderDetail").map(({ rowNumber, record }) => ({
    rowNumber,
    partnerId: clean(record["Partner ID"]),
    partnerName: clean(record["Partner Name"]),
    billingCycle: clean(record["Billing Cycle"]),
    courierId: validCourierId(record["Courier ID"]),
    courierName: clean(record["Courier name"]),
    isValid: norm(record["Is Valid"]) === "valid",
    reason: clean(record.Reason),
    onlineDaysValid: numeric(record["Online Days-Valid"]),
    dailyOnlineHoursValid: numeric(record["Daily Onlines Hours-Valid"]),
    dailyOnlineHoursPeakValid: numeric(record["Daily Onlines Hours During Peak Time -Valid"]),
    deliveredOrders: intValue(record["Delivered Orders"]),
    orderBasedPricing: numeric(record["Order-Based pricing"]),
    distanceFromPriceIncrease: numeric(record["Distance from price increase"]),
    validDaCapacityIncentives: numeric(record["Valid DA Capacity Incentives"]),
    experienceIncentive: numeric(record["Experience incentive"]),
    dxgy: numeric(record.DXGY),
    subsidy: numeric(record.Subsidy),
    activitiesAndOtherRewards: numeric(record["Activities and other rewards"]),
    deduction: numeric(record.Deduction),
    foodCompensation: numeric(record["food compensation"]),
    registrationServiceFee: numeric(record["Registration service fee"]),
    otherAdjustment: numeric(record["Other Adjustment"]),
    tipsExcludingTax: numeric(record["Tips (excluding tax)"]),
    tgaDeductionVatExcluded: numeric(record["TGA Deduction(VAT Excluded)"]),
    totalPayableAmount: numeric(record["Total payable amount"]),
    rawData: record,
  })).filter((row) => row.courierId);

  const invoiceLines = rowsFor(books.invoice, "riderOrderDetail").map(({ rowNumber, record }) => ({
    rowNumber,
    partnerId: clean(record["Partner ID"]),
    partnerName: clean(record["Partner Name"]),
    billingCycle: clean(record["Billing Cycle"]),
    courierId: validCourierId(record["Courier ID"]),
    courierName: clean(record["Courier name"]),
    transactionType: clean(record["transaction type"]),
    businessId: clean(record["Business ID"]),
    note: clean(record.Note),
    feeType: clean(record["Fee type"]),
    detailAmount: numeric(record["detail amount"]),
    totalPayableAmount: numeric(record["Total payable amount"]),
    deliveryDistance: numeric(record["Delivery distance"]),
    ticketId: clean(record["Ticket ID"]),
    violationId: clean(record["Violation ID"]),
    violationType: clean(record["Violation type"]),
    punishmentMethods: clean(record["Punishment methods"]),
    timeOfFaceVerification: clean(record["Time of face verification"]),
    faceVerificationResult: clean(record["Face verification result"]),
    rawData: record,
  })).filter((row) => row.courierId);

  const deductions = rowsFor(books.deductions).map(({ rowNumber, record }) => ({
    rowNumber,
    courierId: validCourierId(record.id),
    userName: clean(record["اسم المستخدم"]),
    username: clean(record["يوزر"]),
    carried: numeric(record["مرحل"]),
    housing: numeric(record["سكن"]),
    trafficViolations: numeric(record["مخالفات مروريه"]),
    fuel: numeric(record["بنزين"]),
    advance: numeric(record["سلفة"]),
    appDeduction: numeric(record["خصم تطبيق"]),
    violation: numeric(record["مخالفة"]),
    foodDamage: numeric(record["تلف طعام  مخالفه تطبيق"]),
    vehicleDamage: numeric(record["تلفيات سياره"]),
    accidentCarried: numeric(record["مرحل حوادث"]),
    accidentLiabilityPercent: numeric(record["نسبه تحمل حادث"]),
    vehicleCarried: numeric(record["مرحل سيارات"]),
    carRent: numeric(record["ايجار سياره"]),
    carDays: intValue(record["ايام السياره"]),
    sponsorshipDeductions: numeric(record["خصومات كفاله"]),
    totalDeductions: numeric(record["إجمالي الخصومات"]),
    netSalary: numeric(record["صافي الراتب"]),
    notes: clean(record["ملاحظات"]),
    rawData: record,
  })).filter((row) => row.courierId);

  const vehicles = rowsFor(books.vehicles).map(({ rowNumber, record }) => ({
    rowNumber,
    vehicleCode: clean(record["Vehicle Code"]),
    plateArabic: clean(record["Plate Arabic"]),
    plateEnglish: clean(record["Plate English"]),
    vehicleType: clean(record["Vehicle Type"]),
    model: clean(record.Model),
    rentalCompany: clean(record["Rental Company"]),
    ownerCompany: clean(record["Owner Company"]),
    cityName: normalizeCity(record.City),
    projectName: normalizeProject(record.Project),
    status: clean(record.Status),
    currentDriverCode: clean(record["Current Driver Code"]),
    currentDriverIqama: clean(record["Current Driver Iqama"]),
    currentDriverName: clean(record["Current Driver Name"]),
    monthlyRent: numeric(record["Monthly Rent"]),
    receivedDate: dateValue(record["Received Date"], null),
    authorizationEnd: dateValue(record["Authorization End"], null),
    notes: clean(record.Notes),
  }));

  return { drivers, rank, performance, invoiceDetail, invoiceLines, deductions, vehicles };
}

function groupBy(rows, keyFn) {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!key) continue;
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }
  return map;
}

function latestBy(rows, keyFn) {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!key) continue;
    map.set(key, row);
  }
  return map;
}

function average(values) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) return 0;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function sum(rows, selector) {
  return rows.reduce((total, row) => total + (Number(selector(row)) || 0), 0);
}

function overlapRentalDays(startDate) {
  if (!(startDate instanceof Date) || Number.isNaN(startDate.getTime())) return 30;
  const start = startDate > PERIOD_START ? startDate : PERIOD_START;
  const end = PERIOD_END;
  const days = Math.floor((Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()) - Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())) / 86400000) + 1;
  return Math.max(0, Math.min(30, days));
}

function payrollProfile(orders, level) {
  const target560 = orders >= 560;
  const levelKey = normalizeLevel(level);
  const performance = target560
    ? { A: 1800, B: 1300, C: 800 }[levelKey]
    : { A: 1200, B: 700, C: 200 }[levelKey];
  const monthlyTargetOrders = target560 ? 560 : 460;
  const fixedSalary = 400;
  const salaryIncentive = target560 ? 1600 : 1100;
  const carAllowance = 1500;
  const fuelAllowance = target560 ? 1100 : 900;
  const housingAllowance = 300;
  const communicationAllowance = 100;
  const extraOrderRate = 8;
  const extraOrders = orders > 560 ? orders - 560 : orders > 460 ? orders - 460 : 0;
  const missingOrders = orders < 460 ? 460 - orders : 0;
  const extraOrdersBonus = extraOrders * extraOrderRate;
  const missingOrderDeduction = missingOrders * extraOrderRate;
  const grossSalary = fixedSalary + salaryIncentive + carAllowance + fuelAllowance + housingAllowance + communicationAllowance + performance + extraOrdersBonus;

  return {
    target560,
    monthlyTargetOrders,
    fixedSalary,
    salaryIncentive,
    carAllowance,
    fuelAllowance,
    housingAllowance,
    communicationAllowance,
    performanceBonus: performance,
    extraOrderRate,
    extraOrders,
    extraOrdersBonus,
    missingOrders,
    missingOrderDeduction,
    grossSalary,
  };
}

async function backupOperationalData() {
  await fs.mkdir(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(BACKUP_DIR, `operational-reset-before-april-keeta-${stamp}.json`);
  const data = {};
  const counts = {};
  for (const model of OPERATIONAL_MODELS) {
    if (!prisma[model]?.findMany) continue;
    const rows = await prisma[model].findMany();
    data[model] = rows;
    counts[model] = rows.length;
  }
  await fs.writeFile(file, JSON.stringify({ createdAt: new Date().toISOString(), month: MONTH, counts, data }, null, 2), "utf8");
  return { file, counts };
}

async function deleteOperationalData(tx) {
  await tx.user.updateMany({ data: { driverId: null } }).catch(() => undefined);
  await tx.driver.updateMany({ data: { vehicleId: null, accountId: null } }).catch(() => undefined);
  await tx.vehicle.updateMany({ data: { currentDriverId: null } }).catch(() => undefined);
  await tx.applicationAccount.updateMany({ data: { driverId: null } }).catch(() => undefined);

  const deleted = {};
  for (const model of OPERATIONAL_MODELS) {
    const delegate = tx[model];
    if (!delegate?.deleteMany) continue;
    const result = await delegate.deleteMany();
    deleted[model] = result.count;
  }
  return deleted;
}

async function findOrCreateMasterData(tx, source) {
  const cityName = "المدينة المنورة";
  let city = await tx.city.findFirst({ where: { OR: [{ nameAr: cityName }, { nameAr: "المدينة المنوره" }, { nameAr: "المدينه المنورة" }, { nameEn: "Madinah" }] } });
  city = city
    ? await tx.city.update({ where: { id: city.id }, data: { nameAr: cityName, nameEn: "Madinah", status: RecordStatus.ACTIVE } })
    : await tx.city.create({ data: { nameAr: cityName, nameEn: "Madinah", status: RecordStatus.ACTIVE } });

  const application = await tx.application.upsert({
    where: { code: "keeta" },
    update: { name: "Keeta", status: RecordStatus.ACTIVE },
    create: { code: "keeta", name: "Keeta", description: "Keeta delivery operations", status: RecordStatus.ACTIVE },
  });

  let project = await tx.project.findFirst({ where: { name: "Keeta", cityId: city.id } });
  project = project
    ? await tx.project.update({ where: { id: project.id }, data: { appName: "Keeta", status: RecordStatus.ACTIVE } })
    : await tx.project.create({ data: { name: "Keeta", appName: "Keeta", cityId: city.id, status: RecordStatus.ACTIVE } });

  const applicationProject = await tx.applicationProject.upsert({
    where: { code: "keeta-madinah" },
    update: {
      applicationId: application.id,
      projectId: project.id,
      cityId: city.id,
      name: "Keeta - المدينة المنورة",
      monthlyTarget: 460 * source.drivers.length,
      dailyTarget: 16 * source.drivers.length,
      status: RecordStatus.ACTIVE,
    },
    create: {
      code: "keeta-madinah",
      name: "Keeta - المدينة المنورة",
      applicationId: application.id,
      projectId: project.id,
      cityId: city.id,
      monthlyTarget: 460 * source.drivers.length,
      dailyTarget: 16 * source.drivers.length,
      status: RecordStatus.ACTIVE,
    },
  });

  const supervisorNames = Array.from(new Set(source.drivers.map((row) => row.supervisorName).filter((name) => name && name !== "No Supervisor")));
  const supervisors = new Map();
  for (const name of supervisorNames.length ? supervisorNames : ["صلاح شتا"]) {
    let supervisor = await tx.supervisor.findFirst({ where: { name, cityId: city.id } });
    supervisor = supervisor
      ? await tx.supervisor.update({ where: { id: supervisor.id }, data: { status: RecordStatus.ACTIVE } })
      : await tx.supervisor.create({ data: { name, cityId: city.id, status: RecordStatus.ACTIVE } });
    supervisors.set(name, supervisor);
  }

  return { city, application, project, applicationProject, supervisors };
}

async function createImportBatch(tx, args) {
  const batch = await tx.applicationImportBatch.create({
    data: {
      applicationId: args.applicationId,
      applicationProjectId: args.applicationProjectId,
      projectId: args.projectId,
      cityId: args.cityId,
      fileType: "xlsx",
      fileName: args.fileName,
      sourceFileName: args.fileName,
      importType: args.importType,
      month: MONTH,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      status: "Locked",
      sheetNames: args.sheetNames,
      totalRows: args.rows.length,
      validRows: args.rows.filter((row) => row.isValid !== false).length,
      invalidRows: args.rows.filter((row) => row.isValid === false).length,
      missingDrivers: args.rows.filter((row) => row.missingDriver).length,
      unmatchedRows: args.rows.filter((row) => row.missingDriver).length,
      previewData: { source: "direct_admin_import", month: MONTH },
      matchedColumns: args.matchedColumns ?? {},
      errorRows: args.rows.filter((row) => row.isValid === false).slice(0, 200),
      uploadedBy: "Admin",
      approvedAt: new Date(),
      lockedAt: new Date(),
      committedAt: new Date(),
    },
  });

  if (args.rows.length) {
    await tx.applicationImportRow.createMany({
      data: args.rows.map((row, index) => ({
        batchId: batch.id,
        rowNumber: row.rowNumber ?? index + 2,
        rawData: row.rawData ?? row.record ?? row,
        mappedData: row.mappedData ?? row,
        isValid: row.isValid !== false,
        errorType: row.errorType,
        errorMessage: row.errorMessage,
        driverId: row.driverId,
        applicationAccountId: row.applicationAccountId,
        status: row.isValid === false ? "error" : "ready",
      })),
      skipDuplicates: true,
    });
  }
  return batch;
}

async function upsertTemplates(tx, master, books) {
  const definitions = [
    ["keeta_rank_template", "Keeta Rank Template", books.rank],
    ["keeta_period_report_template", "Keeta Period Report Template", books.performance],
    ["keeta_driver_invoice_template", "Keeta Driver Invoice Template", books.invoice],
  ];
  for (const [key, name, book] of definitions) {
    const rows = rowsFor(book, key === "keeta_driver_invoice_template" ? "riderDetail" : undefined);
    const requiredColumns = Object.keys(rows[0]?.record ?? {}).map((column) => ({ key: column, displayName: column, required: true, dataType: "text", aliases: [column] }));
    const data = {
      applicationId: master.application.id,
      applicationProjectId: master.applicationProject.id,
      name,
      fileType: key,
      requiredColumns,
      optionalColumns: [],
      columnMapping: requiredColumns.map((column) => ({ incomingColumn: column.key, systemField: column.key, required: true })),
      status: RecordStatus.ACTIVE,
      lastUsedAt: new Date(),
    };
    const existing = await tx.applicationImportTemplate.findFirst({
      where: { name, applicationProjectId: master.applicationProject.id },
    });
    if (existing) {
      await tx.applicationImportTemplate.update({ where: { id: existing.id }, data });
    } else {
      await tx.applicationImportTemplate.create({ data });
    }
    await tx.templateConfig.upsert({
      where: { key },
      update: {
        nameAr: name,
        nameEn: name,
        projectId: "keeta",
        applicationId: master.application.id,
        applicationProjectId: master.applicationProject.id,
        scope: "project",
        importType: key,
        enabled: true,
        showInGlobalImports: false,
        showInProjectImports: true,
        showInInvoices: key === "keeta_driver_invoice_template",
        showInPayroll: true,
        showInReports: true,
        showInManagementReports: true,
        showInApplicationCenter: true,
        affectsPayroll: true,
        affectsInvoices: key === "keeta_driver_invoice_template",
        affectsReports: true,
        affectsRank: key === "keeta_rank_template",
        requiredColumns,
        optionalColumns: [],
        matchingKeys: ["Courier ID"],
        route: key === "keeta_driver_invoice_template" ? "/projects/keeta/invoices" : "/projects/keeta/imports",
      },
      create: {
        key,
        nameAr: name,
        nameEn: name,
        projectId: "keeta",
        applicationId: master.application.id,
        applicationProjectId: master.applicationProject.id,
        scope: "project",
        importType: key,
        enabled: true,
        showInGlobalImports: false,
        showInProjectImports: true,
        showInInvoices: key === "keeta_driver_invoice_template",
        showInPayroll: true,
        showInReports: true,
        showInManagementReports: true,
        showInApplicationCenter: true,
        affectsPayroll: true,
        affectsInvoices: key === "keeta_driver_invoice_template",
        affectsReports: true,
        affectsRank: key === "keeta_rank_template",
        requiredColumns,
        optionalColumns: [],
        matchingKeys: ["Courier ID"],
        route: key === "keeta_driver_invoice_template" ? "/projects/keeta/invoices" : "/projects/keeta/imports",
      },
    });
  }
}

async function importData(tx, source, books, master) {
  await upsertTemplates(tx, master, books);

  const allCourierIds = new Set([
    ...source.drivers.map((row) => row.courierId).filter(Boolean),
    ...source.rank.map((row) => row.courierId),
    ...source.performance.map((row) => row.courierId),
    ...source.invoiceDetail.map((row) => row.courierId),
  ]);
  const rankByCourier = latestBy(source.rank, (row) => row.courierId);
  const perfByCourier = groupBy(source.performance, (row) => row.courierId);
  const invoiceByCourier = latestBy(source.invoiceDetail, (row) => row.courierId);
  const deductionByCourier = latestBy(source.deductions, (row) => row.courierId);
  const driverSourceByCourier = latestBy(source.drivers, (row) => row.courierId);

  const driversByCourier = new Map();
  const driversByCode = new Map();
  const driversByIqama = new Map();
  const vehicleByDriverId = new Map();
  let generatedIndex = source.drivers.length + 1;

  for (const courierId of allCourierIds) {
    const sourceRow = driverSourceByCourier.get(courierId);
    const perf = perfByCourier.get(courierId)?.[0];
    const invoice = invoiceByCourier.get(courierId);
    const rank = rankByCourier.get(courierId);
    const internalCode = sourceRow?.internalCode ?? driverCode("", generatedIndex++);
    const actualName = sourceRow?.actualName || invoice?.courierName || [perf?.firstName, perf?.lastName].filter(Boolean).join(" ") || rank?.name || `Courier ${courierId}`;
    const supervisor = sourceRow?.supervisorName && sourceRow.supervisorName !== "No Supervisor" ? master.supervisors.get(sourceRow.supervisorName) : null;

    const driver = await tx.driver.create({
      data: {
        internalCode,
        driverCode: internalCode,
        name: actualName,
        actualName,
        phone: sourceRow?.phone || null,
        mobile: sourceRow?.phone || null,
        nationalId: sourceRow?.nationalId || null,
        nationality: sourceRow?.nationality || null,
        cityId: master.city.id,
        projectId: master.project.id,
        supervisorId: supervisor?.id ?? null,
        status: normalizeDriverStatus(sourceRow?.appStatus),
        contractType: sourceRow?.relationshipType || "كفالة",
        sponsorshipType: sourceRow?.relationshipKey || "sponsorship",
        accommodationType: sourceRow?.housingType || null,
        housingStatus: sourceRow?.housingType || null,
      },
    });

    const account = await tx.applicationAccount.create({
      data: {
        appName: "Keeta",
        username: `keeta:${courierId}`,
        appUserId: courierId,
        appUsername: sourceRow?.appAccountName || invoice?.courierName || rank?.name || courierId,
        applicationId: master.application.id,
        applicationProjectId: master.applicationProject.id,
        projectId: master.project.id,
        cityId: master.city.id,
        driverId: driver.id,
        isEmpty: false,
        status: normalizeStatus(sourceRow?.appStatus),
        linkedAt: new Date(),
      },
    });

    await tx.driver.update({ where: { id: driver.id }, data: { accountId: account.id } });

    if (sourceRow?.passportNumber) {
      await tx.driverDocument.create({
        data: {
          driverId: driver.id,
          type: "passport",
          documentType: "Passport",
          documentNumber: sourceRow.passportNumber,
          expiryDate: sourceRow.passportExpiry,
          status: RecordStatus.ACTIVE,
          verificationStatus: "imported",
          notes: "Imported from April 2026 driver sheet",
        },
      });
    }
    if (sourceRow?.nationalId) {
      await tx.driverDocument.create({
        data: {
          driverId: driver.id,
          type: "iqama",
          documentType: "Iqama",
          documentNumber: sourceRow.nationalId,
          expiryDate: sourceRow.iqamaExpiry,
          status: RecordStatus.ACTIVE,
          verificationStatus: "imported",
          notes: "Imported from April 2026 driver sheet",
        },
      });
    }
    await tx.driverContract.create({
      data: {
        driverId: driver.id,
        contractType: sourceRow?.relationshipType || "كفالة",
        sponsor: "ANAN AL-ASMA",
        status: RecordStatus.ACTIVE,
        notes: "Imported April 2026",
      },
    });
    await tx.driverHousing.create({
      data: {
        driverId: driver.id,
        housingType: sourceRow?.housingType || "غير محدد",
        accommodationType: sourceRow?.housingType || null,
        status: RecordStatus.ACTIVE,
        notes: "Imported April 2026",
      },
    });

    driversByCourier.set(courierId, { ...driver, accountId: account.id, account });
    driversByCode.set(internalCode, driver);
    if (sourceRow?.nationalId) driversByIqama.set(sourceRow.nationalId, driver);
  }

  const importedVehicles = [];
  for (const vehicleRow of source.vehicles) {
    const driver = driversByCode.get(vehicleRow.currentDriverCode) || driversByIqama.get(vehicleRow.currentDriverIqama) || null;
    const vehicle = await tx.vehicle.create({
      data: {
        vehicleCode: vehicleRow.vehicleCode,
        plateAr: vehicleRow.plateArabic,
        plateArabic: vehicleRow.plateArabic,
        plateEn: vehicleRow.plateEnglish || vehicleRow.vehicleCode,
        plateEnglish: vehicleRow.plateEnglish,
        brand: vehicleRow.vehicleType,
        model: vehicleRow.model,
        rentalCompany: vehicleRow.rentalCompany,
        monthlyRent: decimal(vehicleRow.monthlyRent),
        status: normalizeVehicleStatus(vehicleRow.status, driver?.id),
        currentDriverId: driver?.id ?? null,
        cityId: master.city.id,
      },
    });
    if (driver) {
      const rentalDays = overlapRentalDays(vehicleRow.receivedDate);
      await tx.driver.update({ where: { id: driver.id }, data: { vehicleId: vehicle.id } });
      vehicleByDriverId.set(driver.id, vehicle.id);
      for (const [courierId, mappedDriver] of driversByCourier.entries()) {
        if (mappedDriver.id === driver.id) {
          driversByCourier.set(courierId, { ...mappedDriver, vehicleId: vehicle.id });
          break;
        }
      }
      await tx.vehicleAssignment.create({
        data: {
          vehicleId: vehicle.id,
          driverId: driver.id,
          startDate: vehicleRow.receivedDate || PERIOD_START,
          rentalDays,
          calculatedRent: decimal((vehicleRow.monthlyRent / 30) * rentalDays),
          status: RecordStatus.ACTIVE,
          notes: `Imported April 2026 - ${vehicleRow.ownerCompany || ""}`.trim(),
        },
      });
      await tx.vehicleMovement.create({
        data: {
          vehicleId: vehicle.id,
          toDriverId: driver.id,
          cityId: master.city.id,
          movementType: "handover",
          handoverDate: vehicleRow.receivedDate || PERIOD_START,
          status: RecordStatus.ACTIVE,
          notes: "Imported from Keeta vehicle sheet",
        },
      });
    }
    importedVehicles.push({ ...vehicle, source: vehicleRow });
  }

  const batchDrivers = await createImportBatch(tx, {
    ...masterIds(master),
    fileName: books.drivers.fileName,
    importType: "drivers_master",
    sheetNames: ["drivers_master_template"],
    rows: source.drivers.map((row) => ({ rowNumber: row.rowNumber, rawData: row, driverId: driversByCourier.get(row.courierId)?.id })),
  });
  const batchVehicles = await createImportBatch(tx, {
    ...masterIds(master),
    fileName: books.vehicles.fileName,
    importType: "vehicles_master",
    sheetNames: ["vehicles_template"],
    rows: source.vehicles.map((row) => ({ rowNumber: row.rowNumber, rawData: row })),
  });
  const batchRank = await createImportBatch(tx, {
    ...masterIds(master),
    fileName: books.rank.fileName,
    importType: "keeta_rank_template",
    sheetNames: ["sheet1"],
    rows: source.rank.map((row) => ({ rowNumber: row.rowNumber, rawData: row.rawData, driverId: driversByCourier.get(row.courierId)?.id, applicationAccountId: driversByCourier.get(row.courierId)?.accountId, missingDriver: !driversByCourier.get(row.courierId) })),
  });
  const batchPerformance = await createImportBatch(tx, {
    ...masterIds(master),
    fileName: books.performance.fileName,
    importType: "keeta_period_report_template",
    sheetNames: ["0"],
    rows: source.performance.map((row) => ({ rowNumber: row.rowNumber, rawData: row.rawData, driverId: driversByCourier.get(row.courierId)?.id, applicationAccountId: driversByCourier.get(row.courierId)?.accountId, missingDriver: !driversByCourier.get(row.courierId) })),
  });
  const batchInvoice = await createImportBatch(tx, {
    ...masterIds(master),
    fileName: books.invoice.fileName,
    importType: "keeta_driver_invoice_template",
    sheetNames: ["riderDetail", "riderOrderDetail"],
    rows: [
      ...source.invoiceDetail.map((row) => ({ rowNumber: row.rowNumber, rawData: row.rawData, driverId: driversByCourier.get(row.courierId)?.id, applicationAccountId: driversByCourier.get(row.courierId)?.accountId, missingDriver: !driversByCourier.get(row.courierId) })),
      ...source.invoiceLines.map((row) => ({ rowNumber: row.rowNumber, rawData: row.rawData, driverId: driversByCourier.get(row.courierId)?.id, applicationAccountId: driversByCourier.get(row.courierId)?.accountId, missingDriver: !driversByCourier.get(row.courierId) })),
    ],
  });
  const batchDeductions = await createImportBatch(tx, {
    ...masterIds(master),
    fileName: books.deductions.fileName,
    importType: "april_deductions_advances",
    sheetNames: ["deductions"],
    rows: source.deductions.map((row) => ({ rowNumber: row.rowNumber, rawData: row.rawData, driverId: driversByCourier.get(row.courierId)?.id, applicationAccountId: driversByCourier.get(row.courierId)?.accountId, missingDriver: !driversByCourier.get(row.courierId) })),
  });

  await tx.uploadedReport.createMany({
    data: [
      { fileName: books.drivers.fileName, importType: "drivers_master", appName: "Keeta", cityId: master.city.id, month: MONTH, status: RecordStatus.APPROVED, rowsCount: source.drivers.length, uploadedBy: "Admin" },
      { fileName: books.vehicles.fileName, importType: "vehicles_master", appName: "Keeta", cityId: master.city.id, month: MONTH, status: RecordStatus.APPROVED, rowsCount: source.vehicles.length, uploadedBy: "Admin" },
      { fileName: books.rank.fileName, importType: "keeta_rank_template", appName: "Keeta", cityId: master.city.id, month: MONTH, status: RecordStatus.APPROVED, rowsCount: source.rank.length, uploadedBy: "Admin" },
      { fileName: books.performance.fileName, importType: "keeta_period_report_template", appName: "Keeta", cityId: master.city.id, month: MONTH, status: RecordStatus.APPROVED, rowsCount: source.performance.length, uploadedBy: "Admin" },
      { fileName: books.invoice.fileName, importType: "keeta_driver_invoice_template", appName: "Keeta", cityId: master.city.id, month: MONTH, status: RecordStatus.APPROVED, rowsCount: source.invoiceDetail.length + source.invoiceLines.length, uploadedBy: "Admin" },
      { fileName: books.deductions.fileName, importType: "april_deductions_advances", appName: "Keeta", cityId: master.city.id, month: MONTH, status: RecordStatus.APPROVED, rowsCount: source.deductions.length, uploadedBy: "Admin" },
    ],
  });

  for (const row of source.rank) {
    const driver = driversByCourier.get(row.courierId);
    await tx.keetaRankRecord.create({
      data: {
        projectId: "keeta",
        applicationProjectId: master.applicationProject.id,
        driverId: driver?.id,
        applicationAccountId: driver?.accountId,
        courierId: row.courierId,
        courierName: row.name,
        cityId: master.city.id,
        month: MONTH,
        periodStart: PERIOD_START,
        periodEnd: PERIOD_END,
        currentEstimatedLevel: row.currentEstimatedLevel,
        currentEstimatedRanking: decimal(row.currentEstimatedRanking),
        courierRankingPercentile: new Prisma.Decimal(row.courierRankingPercentile || 0),
        currentScoreForForcedAssignment: new Prisma.Decimal(row.currentScoreForForcedAssignment || 0),
        currentEstimatedRewardAmount: decimal(row.currentEstimatedRewardAmount),
        onTimeRate: new Prisma.Decimal(row.onTimeRate || 0),
        orderCompletionRate: new Prisma.Decimal(row.orderCompletionRate || 0),
        dropOffNotEarlyRate: new Prisma.Decimal(row.dropOffNotEarlyRate || 0),
        orderVolume: row.orderVolume,
        rawData: row.rawData,
        importBatchId: batchRank.id,
        status: "Approved",
        approvedBy: "Admin",
        approvedAt: new Date(),
      },
    });
  }

  for (const row of source.performance) {
    const driver = driversByCourier.get(row.courierId);
    await tx.keetaPerformanceRecord.create({
      data: {
        projectId: "keeta",
        applicationProjectId: master.applicationProject.id,
        driverId: driver?.id,
        applicationAccountId: driver?.accountId,
        courierId: row.courierId,
        courierFirstName: row.firstName,
        courierLastName: row.lastName,
        supervisorName: row.supervisorName,
        vehicleType: row.vehicleType,
        cityId: master.city.id,
        reportDate: row.reportDate,
        month: MONTH,
        periodStart: PERIOD_START,
        periodEnd: PERIOD_END,
        shiftAttendanceSummary: row.shiftAttendanceSummary,
        onShift: row.onShift,
        validDay: row.validDay,
        courierAppOnlineTime: decimal(row.courierAppOnlineTime),
        validOnlineTime: decimal(row.validOnlineTime),
        peakOnlineHours: decimal(row.peakOnlineHours),
        acceptedTasks: row.acceptedTasks,
        tasksWithRestaurantArrivals: row.tasksWithRestaurantArrivals,
        deliveredTasks: row.deliveredTasks,
        largeOrderTasksCompleted: row.largeOrderTasksCompleted,
        rejectedTasks: row.rejectedTasks,
        rejectedTasksCourier: row.rejectedTasksCourier,
        rejectedTasksAuto: row.rejectedTasksAuto,
        cancellationRateFromDeliveryIssues: new Prisma.Decimal(row.cancellationRateFromDeliveryIssues || 0),
        orderCompletionRateNonDelivery: new Prisma.Decimal(row.orderCompletionRateNonDelivery || 0),
        onTimeRate: new Prisma.Decimal(row.onTimeRate || 0),
        largeOrderOnTimeRate: new Prisma.Decimal(row.largeOrderOnTimeRate || 0),
        avgDeliveryTime: decimal(row.avgDeliveryTime),
        deliveredOrdersOver55MinPercent: new Prisma.Decimal(row.deliveredOrdersOver55MinPercent || 0),
        overdueOrderTasks: row.overdueOrderTasks,
        severelyOverdueOrderTasks: row.severelyOverdueOrderTasks,
        rawData: row.rawData,
        importBatchId: batchPerformance.id,
        status: "Approved",
        approvedBy: "Admin",
        approvedAt: new Date(),
      },
    });

    await tx.dailyReport.create({
      data: {
        reportDate: row.reportDate,
        month: MONTH,
        driverId: driver?.id,
        cityId: master.city.id,
        projectId: master.project.id,
        appName: "Keeta",
        orders: row.deliveredTasks,
        workingHours: decimal(row.validOnlineTime || row.courierAppOnlineTime),
        onTimeRate: decimal(row.onTimeRate * 100),
        cancellationRate: decimal(row.cancellationRateFromDeliveryIssues * 100),
        rejectionRate: decimal(row.rejectionRate * 100),
      },
    });
  }

  for (const row of source.invoiceDetail) {
    const driver = driversByCourier.get(row.courierId);
    await tx.keetaInvoiceRecord.create({
      data: {
        projectId: "keeta",
        applicationProjectId: master.applicationProject.id,
        driverId: driver?.id,
        applicationAccountId: driver?.accountId,
        courierId: row.courierId,
        courierName: row.courierName,
        partnerId: row.partnerId,
        partnerName: row.partnerName,
        billingCycle: row.billingCycle,
        cityId: master.city.id,
        month: MONTH,
        periodStart: PERIOD_START,
        periodEnd: PERIOD_END,
        isValid: row.isValid,
        reason: row.reason,
        onlineDaysValid: decimal(row.onlineDaysValid),
        dailyOnlineHoursValid: decimal(row.dailyOnlineHoursValid),
        dailyOnlineHoursPeakValid: decimal(row.dailyOnlineHoursPeakValid),
        deliveredOrders: row.deliveredOrders,
        orderBasedPricing: decimal(row.orderBasedPricing),
        distanceFromPriceIncrease: decimal(row.distanceFromPriceIncrease),
        validDaCapacityIncentives: decimal(row.validDaCapacityIncentives),
        experienceIncentive: decimal(row.experienceIncentive),
        dxgy: decimal(row.dxgy),
        subsidy: decimal(row.subsidy),
        activitiesAndOtherRewards: decimal(row.activitiesAndOtherRewards),
        deduction: decimal(row.deduction),
        foodCompensation: decimal(row.foodCompensation),
        registrationServiceFee: decimal(row.registrationServiceFee),
        otherAdjustment: decimal(row.otherAdjustment),
        tipsExcludingTax: decimal(row.tipsExcludingTax),
        tgaDeductionVatExcluded: decimal(row.tgaDeductionVatExcluded),
        totalPayableAmount: decimal(row.totalPayableAmount),
        rawData: row.rawData,
        invoiceBatchId: batchInvoice.id,
        status: "Approved",
        approvedBy: "Admin",
        approvedAt: new Date(),
      },
    });
  }

  for (const row of source.invoiceLines) {
    const driver = driversByCourier.get(row.courierId);
    await tx.keetaInvoiceDetailRecord.create({
      data: {
        projectId: "keeta",
        applicationProjectId: master.applicationProject.id,
        invoiceBatchId: batchInvoice.id,
        driverId: driver?.id,
        applicationAccountId: driver?.accountId,
        courierId: row.courierId,
        courierName: row.courierName,
        partnerId: row.partnerId,
        partnerName: row.partnerName,
        billingCycle: row.billingCycle,
        transactionType: row.transactionType,
        businessId: row.businessId,
        note: row.note,
        feeType: row.feeType,
        detailAmount: decimal(row.detailAmount),
        totalPayableAmount: decimal(row.totalPayableAmount),
        deliveryDistance: decimal(row.deliveryDistance),
        ticketId: row.ticketId,
        violationId: row.violationId,
        violationType: row.violationType,
        punishmentMethods: row.punishmentMethods,
        timeOfFaceVerification: row.timeOfFaceVerification,
        faceVerificationResult: row.faceVerificationResult,
        rawData: row.rawData,
      },
    });
  }

  for (const row of source.deductions) {
    const driver = driversByCourier.get(row.courierId);
    if (!driver) continue;
    if (row.advance) {
      await tx.advance.create({
        data: {
          driverId: driver.id,
          amount: decimal(row.advance),
          remainingAmount: decimal(row.advance),
          reason: "سلفة مستوردة من ملف شهر 4",
          deductionMonth: MONTH,
          status: RecordStatus.APPROVED,
        },
      });
    }
    const deductionEntries = [
      ["مرحل", row.carried],
      ["سكن", row.housing],
      ["خصم تطبيق", row.appDeduction],
      ["تلف طعام / مخالفة تطبيق", row.foodDamage],
      ["تلفيات سيارة", row.vehicleDamage],
      ["مرحل حوادث", row.accidentCarried],
      ["مرحل سيارات", row.vehicleCarried],
      ["إيجار سيارة", row.carRent],
      ["خصومات كفالة", row.sponsorshipDeductions],
    ];
    for (const [type, amount] of deductionEntries) {
      if (!amount) continue;
      await tx.deduction.create({ data: { driverId: driver.id, type, amount: decimal(amount), month: MONTH, status: RecordStatus.APPROVED, notes: row.notes || "Imported April 2026" } });
    }
    if (row.trafficViolations) await tx.violation.create({ data: { driverId: driver.id, type: "مخالفات مرورية", amount: decimal(row.trafficViolations), status: RecordStatus.APPROVED, occurredAt: PERIOD_START, notes: row.notes || "Imported April 2026" } });
    if (row.violation) await tx.violation.create({ data: { driverId: driver.id, type: "مخالفة تشغيلية", amount: decimal(row.violation), status: RecordStatus.APPROVED, occurredAt: PERIOD_START, notes: row.notes || "Imported April 2026" } });
    if (row.fuel) await tx.fuelRecord.create({ data: { driverId: driver.id, amount: decimal(row.fuel), fuelDate: PERIOD_START, notes: "بنزين مستورد من ملف شهر 4", status: RecordStatus.APPROVED } });
  }

  await ensurePayrollPlans(tx, master);
  const payroll = await createPayroll(tx, master, {
    driversByCourier,
    vehicleByDriverId,
    rankByCourier,
    perfByCourier,
    invoiceByCourier,
    deductionByCourier,
  });

  const totalRevenue = source.invoiceDetail.reduce((total, row) => total + row.totalPayableAmount, 0);
  const invoice = await tx.invoice.create({
    data: {
      number: `KEETA-MADINAH-${MONTH}`,
      client: "Keeta",
      projectId: master.project.id,
      applicationProjectId: master.applicationProject.id,
      importBatchId: batchInvoice.id,
      month: MONTH,
      amount: decimal(totalRevenue),
      vatAmount: decimal(0),
      status: RecordStatus.APPROVED,
      invoiceStatus: "Approved",
      issuedAt: PERIOD_END,
      approvedAt: new Date(),
      lockedAt: new Date(),
    },
  });
  await tx.revenue.create({ data: { source: "Keeta Invoice Income", amount: decimal(totalRevenue), month: MONTH, status: RecordStatus.APPROVED, notes: "Company revenue from Keeta invoice" } });
  await tx.expense.create({ data: { type: "Payroll Cost", amount: decimal(payroll.netTotal), month: MONTH, status: RecordStatus.APPROVED, notes: "April Keeta payroll cost" } });
  await tx.financeEntry.create({ data: { sourceType: "Invoice", sourceId: invoice.id, entryType: "project_revenue", applicationId: master.application.id, applicationProjectId: master.applicationProject.id, cityId: master.city.id, amount: decimal(totalRevenue), direction: "in", description: "مستحق الشركة من كيتا - أبريل 2026", status: RecordStatus.ACTIVE, entryDate: PERIOD_END } });
  await tx.financeEntry.create({ data: { sourceType: "PayrollRun", sourceId: payroll.id, entryType: "payroll_cost", applicationId: master.application.id, applicationProjectId: master.applicationProject.id, cityId: master.city.id, payrollRunId: payroll.id, amount: decimal(payroll.netTotal), direction: "out", description: "تكلفة مسير رواتب كيتا - أبريل 2026", status: RecordStatus.ACTIVE, entryDate: PERIOD_END } });

  await tx.cityTarget.create({
    data: {
      cityId: master.city.id,
      projectId: master.project.id,
      appName: "Keeta",
      month: MONTH,
      monthlyTarget: driversByCourier.size * 460,
      requiredValidRiders: driversByCourier.size,
      status: payroll.totalOrders >= driversByCourier.size * 460 ? RecordStatus.APPROVED : RecordStatus.PENDING,
      notes: "Generated from April 2026 Keeta import",
    },
  });

  for (const [title, count] of [
    ["مناديب بدون فاتورة كيتا معتمدة", [...driversByCourier.keys()].filter((id) => !invoiceByCourier.has(id)).length],
    ["مناديب بدون تقرير أداء كيتا", [...driversByCourier.keys()].filter((id) => !perfByCourier.has(id)).length],
    ["مناديب بدون Rank كيتا", [...driversByCourier.keys()].filter((id) => !rankByCourier.has(id)).length],
  ]) {
    if (!count) continue;
    await tx.notification.create({
      data: {
        title,
        body: `${count} مندوب يحتاج مراجعة بعد استيراد شهر 4.`,
        severity: "WARNING",
        status: RecordStatus.PENDING,
        entityType: "AprilImport",
        entityId: MONTH,
      },
    });
  }

  await tx.auditLog.create({
    data: {
      user: "Admin",
      action: "RESET_AND_IMPORT_APRIL_2026_OPERATIONAL_DATA",
      entityType: "OperationalData",
      entityId: MONTH,
      after: {
        files: Object.fromEntries(Object.entries(books).map(([key, value]) => [key, value.fileName])),
        counts: {
          drivers: driversByCourier.size,
          vehicles: importedVehicles.length,
          performanceRows: source.performance.length,
          rankRows: source.rank.length,
          invoiceRows: source.invoiceDetail.length,
          invoiceDetailRows: source.invoiceLines.length,
          deductionRows: source.deductions.length,
          payrollItems: payroll.items,
          totalOrders: payroll.totalOrders,
          totalRevenue,
          netPayroll: payroll.netTotal,
        },
      },
    },
  });

  return {
    drivers: driversByCourier.size,
    vehicles: importedVehicles.length,
    accounts: driversByCourier.size,
    performanceRows: source.performance.length,
    rankRows: source.rank.length,
    invoiceRows: source.invoiceDetail.length,
    invoiceDetailRows: source.invoiceLines.length,
    deductionRows: source.deductions.length,
    payrollItems: payroll.items,
    payrollRunId: payroll.id,
    totalOrders: payroll.totalOrders,
    totalRevenue,
    netPayroll: payroll.netTotal,
    batches: {
      drivers: batchDrivers.id,
      vehicles: batchVehicles.id,
      rank: batchRank.id,
      performance: batchPerformance.id,
      invoice: batchInvoice.id,
      deductions: batchDeductions.id,
    },
  };
}

function masterIds(master) {
  return {
    applicationId: master.application.id,
    applicationProjectId: master.applicationProject.id,
    projectId: master.project.id,
    cityId: master.city.id,
  };
}

async function ensurePayrollPlans(tx, master) {
  const plans = [
    ["sponsorship", "A", 400, 0, 560, 8, 1800, 0, 0],
    ["sponsorship", "B", 400, 0, 460, 8, 700, 0, 0],
    ["sponsorship", "C", 400, 0, 460, 8, 200, 0, 0],
    ["freelancer", "A", 0, 0, 560, 8, 0, 0, 0],
    ["freelancer", "B", 0, 0, 460, 8, 0, 0, 0],
    ["freelancer", "C", 0, 0, 460, 8, 0, 0, 0],
  ];
  for (const [relationshipType, level, baseSalary, fixedAllowance, target, extraRate, bonus, carRent, fuel] of plans) {
    const data = {
        projectId: "keeta",
        applicationProjectId: master.applicationProject.id,
        cityId: master.city.id,
        name: `Keeta ${relationshipType} Level ${level} April 2026`,
        relationshipType,
        level,
        baseSalary: decimal(baseSalary),
        fixedAllowance: decimal(fixedAllowance),
        monthlyTargetOrders: target,
        extraOrderRate: decimal(extraRate),
        bonusAmount: decimal(bonus),
        bonusCondition: { importedRule: "old_ui_april_2026" },
        carRentDeduction: decimal(carRent),
        fuelDeduction: decimal(fuel),
        internalPenaltyEnabled: true,
        salaryCalculationSource: "payroll_plan",
        useKeetaInvoiceAsSalaryBase: false,
        active: true,
    };
    const existing = await tx.keetaPayrollPlan.findFirst({
      where: { projectId: "keeta", applicationProjectId: master.applicationProject.id, cityId: master.city.id, relationshipType, level },
    });
    if (existing) {
      await tx.keetaPayrollPlan.update({ where: { id: existing.id }, data });
    } else {
      await tx.keetaPayrollPlan.create({ data });
    }
  }
}

async function createPayroll(tx, master, maps) {
  const payrollRun = await tx.payrollRun.create({
    data: {
      month: MONTH_NUMBER,
      year: YEAR,
      applicationId: master.application.id,
      applicationProjectId: master.applicationProject.id,
      cityId: master.city.id,
      status: PayrollStatus.DRAFT,
    },
  });

  let totalOrders = 0;
  let totalEarnings = 0;
  let totalDeductions = 0;
  let netTotal = 0;
  let totalCompanyRevenue = 0;
  let estimatedCompanyProfit = 0;
  let items = 0;

  for (const [courierId, driver] of maps.driversByCourier.entries()) {
    const rank = maps.rankByCourier.get(courierId);
    const performanceRows = maps.perfByCourier.get(courierId) ?? [];
    const invoice = maps.invoiceByCourier.get(courierId);
    const deduction = maps.deductionByCourier.get(courierId);
    const deliveredOrders = performanceRows.length ? sum(performanceRows, (row) => row.deliveredTasks) : invoice?.deliveredOrders ?? rank?.orderVolume ?? 0;
    const profile = payrollProfile(deliveredOrders, rank?.currentEstimatedLevel);
    const level = normalizeLevel(rank?.currentEstimatedLevel);
    const relationshipType = normalizeRelationship(driver.contractType);
    const salaryPlan = await tx.keetaPayrollPlan.findFirst({
      where: {
        projectId: "keeta",
        applicationProjectId: master.applicationProject.id,
        cityId: master.city.id,
        relationshipType,
        level,
        active: true,
        salaryCalculationSource: "payroll_plan",
        useKeetaInvoiceAsSalaryBase: false,
      },
      orderBy: [{ updatedAt: "desc" }],
    });
    const validDays = performanceRows.filter((row) => row.validDay).length || Math.round(invoice?.onlineDaysValid ?? 0);
    const workingHours = performanceRows.length
      ? sum(performanceRows, (row) => row.validOnlineTime || row.courierAppOnlineTime)
      : (invoice?.onlineDaysValid ?? 0) * (invoice?.dailyOnlineHoursValid ?? 0);
    const onTimeRate = average(performanceRows.map((row) => row.onTimeRate || rank?.onTimeRate || 0)) * 100;
    const cancellationRate = average(performanceRows.map((row) => row.cancellationRateFromDeliveryIssues || 0)) * 100;
    const accepted = sum(performanceRows, (row) => row.acceptedTasks);
    const rejected = sum(performanceRows, (row) => row.rejectedTasks + row.rejectedTasksCourier + row.rejectedTasksAuto);
    const rejectionRate = accepted > 0 ? (rejected / accepted) * 100 : 0;

    const internalAdvances = deduction?.advance ?? 0;
    const internalPenalties = (deduction?.trafficViolations ?? 0) + (deduction?.violation ?? 0);
    const fuelDeduction = deduction?.fuel ?? 0;
    const carRentDeduction = deduction?.carRent ?? 0;
    const appDeductionsTotal = (deduction?.appDeduction ?? 0) + (deduction?.foodDamage ?? 0);
    const damagesTotal = (deduction?.vehicleDamage ?? 0) + (deduction?.vehicleCarried ?? 0) + (deduction?.accidentCarried ?? 0);
    const otherDeductions = (deduction?.carried ?? 0) + (deduction?.housing ?? 0) + (deduction?.sponsorshipDeductions ?? 0);
    const manualDeduction = profile.missingOrderDeduction;
    const allDeductions = internalAdvances + internalPenalties + fuelDeduction + carRentDeduction + appDeductionsTotal + damagesTotal + otherDeductions + manualDeduction;
    const finalSalary = profile.grossSalary - allDeductions;
    const companyRevenue = invoice?.totalPayableAmount ?? 0;
    const keetaDeductions =
      (invoice?.deduction ?? 0) +
      (invoice?.foodCompensation ?? 0) +
      (invoice?.registrationServiceFee ?? 0) +
      (invoice?.otherAdjustment ?? 0) +
      (invoice?.tgaDeductionVatExcluded ?? 0);
    const keetaIncentives =
      (invoice?.validDaCapacityIncentives ?? 0) +
      (invoice?.experienceIncentive ?? 0) +
      (invoice?.dxgy ?? 0) +
      (invoice?.subsidy ?? 0) +
      (invoice?.activitiesAndOtherRewards ?? 0) +
      (invoice?.tipsExcludingTax ?? 0);
    const profit = companyRevenue - finalSalary;
    const notes = [];
    if (!rank) notes.push("لا يوجد Rank معتمد لهذا المندوب في أبريل 2026.");
    if (!performanceRows.length) notes.push("لا يوجد تقرير أداء Keeta لهذا المندوب في أبريل 2026.");
    if (!invoice) notes.push("لا يوجد إيراد كيتا معتمد لهذا المندوب في أبريل 2026.");
    if (!salaryPlan) notes.push("لا يوجد Payroll Plan مناسب لهذا المندوب، ويجب مراجعته قبل اعتماد المسير.");

    await tx.payrollItem.create({
      data: {
        payrollRunId: payrollRun.id,
        driverId: driver.id,
        applicationAccountId: driver.accountId,
        vehicleId: maps.vehicleByDriverId.get(driver.id) ?? driver.vehicleId,
        orders: deliveredOrders,
        deliveredOrders,
        extraOrders: profile.extraOrders,
        workingHours: decimal(workingHours),
        onTimeRate: decimal(onTimeRate),
        cancellationRate: decimal(cancellationRate),
        rejectionRate: decimal(rejectionRate),
        level,
        basicSalary: decimal(profile.fixedSalary),
        extraOrdersBonus: decimal(profile.extraOrdersBonus),
        performanceBonus: decimal(profile.salaryIncentive),
        totalEarnings: decimal(profile.grossSalary),
        rentalDays: validDays,
        carRent: decimal(profile.carAllowance),
        advancesTotal: decimal(internalAdvances),
        violationsTotal: decimal(internalPenalties),
        fuelTotal: decimal(profile.fuelAllowance),
        appDeductionsTotal: decimal(appDeductionsTotal),
        damagesTotal: decimal(damagesTotal),
        accidentDeduction: decimal(deduction?.accidentCarried ?? 0),
        otherDeductions: decimal(otherDeductions),
        totalDeductions: decimal(allDeductions),
        netSalary: decimal(finalSalary),
        salaryPlanId: salaryPlan?.id,
        relationshipType,
        monthlyTargetOrders: profile.monthlyTargetOrders,
        extraOrderRate: decimal(profile.extraOrderRate),
        levelBonus: decimal(profile.performanceBonus),
        manualBonus: decimal(profile.housingAllowance + profile.communicationAllowance),
        grossSalary: decimal(profile.grossSalary),
        internalAdvances: decimal(internalAdvances),
        internalPenalties: decimal(internalPenalties),
        carRentDeduction: decimal(carRentDeduction),
        fuelDeduction: decimal(fuelDeduction),
        manualDeduction: decimal(manualDeduction),
        finalSalary: decimal(finalSalary),
        companyRevenueFromKeeta: decimal(companyRevenue),
        keetaTotalPayableAmount: decimal(companyRevenue),
        keetaDeductions: decimal(keetaDeductions),
        keetaIncentives: decimal(keetaIncentives),
        companyGrossRevenue: decimal(companyRevenue),
        estimatedCompanyProfit: decimal(profit),
        costPerOrder: decimal(deliveredOrders > 0 ? finalSalary / deliveredOrders : 0),
        status: notes.length ? "review" : "draft",
        notes: notes.join(" | "),
      },
    });

    totalOrders += deliveredOrders;
    totalEarnings += profile.grossSalary;
    totalDeductions += allDeductions;
    netTotal += finalSalary;
    totalCompanyRevenue += companyRevenue;
    estimatedCompanyProfit += profit;
    items += 1;
  }

  const updated = await tx.payrollRun.update({
    where: { id: payrollRun.id },
    data: {
      totalDrivers: items,
      totalOrders,
      totalEarnings: decimal(totalEarnings),
      totalDeductions: decimal(totalDeductions),
      netTotal: decimal(netTotal),
      totalCompanyRevenue: decimal(totalCompanyRevenue),
      estimatedCompanyProfit: decimal(estimatedCompanyProfit),
    },
  });

  return { ...updated, items, totalOrders, netTotal };
}

async function main() {
  const books = await loadWorkbooks();
  const source = buildSourceData(books);
  const backup = await backupOperationalData();
  const result = await prisma.$transaction(
    async (tx) => {
      const deleted = await deleteOperationalData(tx);
      const master = await findOrCreateMasterData(tx, source);
      const imported = await importData(tx, source, books, master);
      return { deleted, imported, master: { city: master.city.nameAr, applicationProject: master.applicationProject.name } };
    },
    { timeout: 180000, maxWait: 20000 },
  );

  console.log(JSON.stringify({ ok: true, month: MONTH, backupFile: backup.file, backupCounts: backup.counts, ...result }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
