const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const DEFAULT_MONTH = "2026-04";
const TAG_PREFIX = "TEST_FULL_PAYROLL";

const TARGET_CITY_NAMES = [
  "أبها",
  "الأفلاج",
  "الأحساء",
  "الإحساء",
  "الدمام",
  "الرياض",
  "الطائف",
  "المدينة المنورة",
  "جدة",
  "مكة",
];

const TARGET_APPS = ["KEETA", "HUNGERSTATION"];

const SCENARIOS = [
  {
    key: "COMPANY_CAR",
    label: "مندوب سيارة شركة",
    contractType: "sponsorship",
    vehicleOwnershipType: "company_car",
    companyCar: true,
  },
  {
    key: "PERSONAL_CAR",
    label: "مندوب سيارة شخصية",
    contractType: "sponsorship",
    vehicleOwnershipType: "personal_car",
  },
  {
    key: "FREELANCER",
    label: "مندوب فريلانسر",
    contractType: "freelancer",
    vehicleOwnershipType: "no_vehicle",
  },
  {
    key: "FREELANCER_PERSONAL_CAR",
    label: "فريلانسر سيارة شخصية",
    contractType: "freelancer",
    vehicleOwnershipType: "personal_car",
  },
  {
    key: "ADVANCE",
    label: "مندوب عليه سلفة",
    contractType: "sponsorship",
    vehicleOwnershipType: "no_vehicle",
    advance: 350,
  },
  {
    key: "HOUSING",
    label: "مندوب عليه سكن",
    contractType: "sponsorship",
    vehicleOwnershipType: "no_vehicle",
    deductions: [{ type: "HOUSING", amount: 300 }],
  },
  {
    key: "TRAFFIC_VIOLATION",
    label: "مندوب عليه مخالفة مرورية",
    contractType: "sponsorship",
    vehicleOwnershipType: "company_car",
    companyCar: true,
    violation: 450,
  },
  {
    key: "VEHICLE_DAMAGE",
    label: "مندوب عليه تلفيات سيارة",
    contractType: "sponsorship",
    vehicleOwnershipType: "company_car",
    companyCar: true,
    deductions: [{ type: "VEHICLE_DAMAGE", amount: 275 }],
  },
  {
    key: "ACCIDENT_LIABILITY",
    label: "مندوب عليه نسبة تحمل حادث",
    contractType: "sponsorship",
    vehicleOwnershipType: "company_car",
    companyCar: true,
    deductions: [{ type: "ACCIDENT_LIABILITY", amount: 650 }],
  },
  {
    key: "SIM",
    label: "مندوب عليه شريحة",
    contractType: "sponsorship",
    vehicleOwnershipType: "no_vehicle",
    deductions: [{ type: "SIM", amount: 100 }],
  },
  {
    key: "KAFALA",
    label: "مندوب عليه خصم كفالة",
    contractType: "sponsorship",
    vehicleOwnershipType: "no_vehicle",
    deductions: [{ type: "KAFALA_DEDUCTION", amount: 500 }],
  },
  {
    key: "MULTI_DEDUCTIONS",
    label: "مندوب عليه أكثر من خصم",
    contractType: "freelancer",
    vehicleOwnershipType: "personal_car",
    advance: 250,
    violation: 320,
    fuel: 180,
    deductions: [
      { type: "HOUSING", amount: 250 },
      { type: "SIM", amount: 80 },
      { type: "KAFALA_DEDUCTION", amount: 220 },
    ],
  },
  {
    key: "NEGATIVE_NET",
    label: "مندوب صافيه سالب",
    contractType: "freelancer",
    vehicleOwnershipType: "personal_car",
    advance: 3200,
    violation: 1100,
    fuel: 500,
    deductions: [
      { type: "HOUSING", amount: 700 },
      { type: "SIM", amount: 150 },
      { type: "KAFALA_DEDUCTION", amount: 1800 },
      { type: "VEHICLE_DAMAGE", amount: 1200 },
      { type: "ACCIDENT_LIABILITY", amount: 900 },
    ],
  },
  {
    key: "APP_DEDUCTIONS",
    label: "مندوب عليه خصومات تطبيق",
    contractType: "sponsorship",
    vehicleOwnershipType: "no_vehicle",
    appDeductions: true,
  },
  {
    key: "WEAK_LOW",
    label: "حساب ضعيف يدخل LOW",
    contractType: "sponsorship",
    vehicleOwnershipType: "no_vehicle",
    weakLow: true,
  },
  {
    key: "INVOICE_WITHOUT_RANK",
    label: "كيتا فاتورة بدون رانك",
    contractType: "sponsorship",
    vehicleOwnershipType: "no_vehicle",
    keetaNoRank: true,
  },
  {
    key: "RANK_WITHOUT_INVOICE",
    label: "كيتا رانك بدون فاتورة",
    contractType: "sponsorship",
    vehicleOwnershipType: "no_vehicle",
    keetaNoInvoice: true,
  },
  {
    key: "NO_APPROVED_USAGE",
    label: "هنجر بدون استخدام معتمد",
    contractType: "sponsorship",
    vehicleOwnershipType: "no_vehicle",
    hsNoUsage: true,
  },
];

function parseArgs(argv = process.argv.slice(2)) {
  const args = { month: DEFAULT_MONTH, apply: false, dryRun: true, confirm: "" };
  for (const arg of argv) {
    if (arg === "--apply") {
      args.apply = true;
      args.dryRun = false;
    } else if (arg === "--dry-run") {
      args.dryRun = true;
      args.apply = false;
    } else if (arg.startsWith("--month=")) {
      args.month = arg.slice("--month=".length);
    } else if (arg.startsWith("--confirm=")) {
      args.confirm = arg.slice("--confirm=".length);
    }
  }
  if (!/^\d{4}-\d{2}$/.test(args.month)) {
    throw new Error("Use --month=YYYY-MM");
  }
  return args;
}

function tagForMonth(month) {
  return `${TAG_PREFIX}_${month.replace("-", "_")}`;
}

function monthParts(month) {
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  const start = new Date(Date.UTC(year, monthNumber - 1, 1));
  const end = new Date(Date.UTC(year, monthNumber, 0, 23, 59, 59, 999));
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { year, monthNumber, start, end, days };
}

function cityCode(project) {
  const raw = project.code.split("-").slice(1).join("-") || project.city?.nameEn || project.city?.nameAr || "CITY";
  return raw
    .normalize("NFKD")
    .replace(/[^\w]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase()
    .slice(0, 20) || "CITY";
}

function appCode(project) {
  return String(project.application.code || project.application.name || "").toUpperCase();
}

function isTargetCity(project) {
  const city = project.city;
  if (!city) return false;
  const ar = city.nameAr || "";
  const en = city.nameEn || "";
  return TARGET_CITY_NAMES.some((name) => ar.includes(name) || en.toLowerCase().includes(name.toLowerCase()));
}

async function loadTargetProjects() {
  const projects = await prisma.applicationProject.findMany({
    where: { status: "ACTIVE", cityId: { not: null } },
    include: {
      application: true,
      city: true,
    },
    orderBy: [{ code: "asc" }],
  });
  return projects.filter((project) => TARGET_APPS.includes(appCode(project)) && isTargetCity(project));
}

async function loadMissingCoverage() {
  const projects = await loadTargetProjects();
  const seen = new Set(projects.map((project) => `${appCode(project)}:${project.city?.nameAr || project.city?.nameEn}`));
  const missing = [];
  for (const app of TARGET_APPS) {
    for (const city of TARGET_CITY_NAMES) {
      const found = [...seen].some((item) => item.startsWith(`${app}:`) && item.includes(city));
      if (!found) missing.push({ app, city });
    }
  }
  return missing;
}

function hashDigits(input, length = 7) {
  let hash = 0;
  const text = String(input);
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return String(hash).padStart(length, "0").slice(0, length);
}

function scenarioRiderId(tag, project, scenarioKey, suffix = "") {
  const prefix = appCode(project) === "HUNGERSTATION" ? "7" : "5";
  return `${prefix}${hashDigits(`${tag}:${project.code}:${scenarioKey}:${suffix}`, 8)}`;
}

function scenarioInternalCode(tag, project, scenarioKey, suffix = "") {
  return `${tag}_${appCode(project)}_${cityCode(project)}_${scenarioKey}${suffix ? `_${suffix}` : ""}`.slice(0, 190);
}

function scenarioDriverCode(project, scenarioKey, riderId, suffix = "") {
  const prefix = appCode(project) === "HUNGERSTATION" ? "HS" : "KEETA";
  return `${prefix}-${cityCode(project)}-${scenarioKey}${suffix ? `-${suffix}` : ""}-${riderId}`.slice(0, 190);
}

function scenarioUsername(tag, project, scenarioKey, riderId, suffix = "") {
  return `${tag}:${project.code}:${scenarioKey}:${riderId}${suffix ? `:${suffix}` : ""}`.slice(0, 190);
}

function toDate(month, day) {
  const { year, monthNumber, days } = monthParts(month);
  return new Date(Date.UTC(year, monthNumber - 1, Math.min(day, days), 12, 0, 0, 0));
}

function jsonTag(tag, extra = {}) {
  return { testTag: tag, ...extra };
}

async function upsertByFindFirst({ model, where, create, update, apply }) {
  if (!apply) return { dryRun: true, created: true };
  const existing = await prisma[model].findFirst({ where, select: { id: true } });
  if (existing) {
    await prisma[model].update({ where: { id: existing.id }, data: update || create });
    return { id: existing.id, created: false };
  }
  return prisma[model].create({ data: create });
}

async function ensureDriver({ tag, project, scenario, suffix = "", apply }) {
  const riderId = scenarioRiderId(tag, project, scenario.key, suffix);
  const internalCode = scenarioInternalCode(tag, project, scenario.key, suffix);
  const driverCode = scenarioDriverCode(project, scenario.key, riderId, suffix);
  const cityName = project.city?.nameAr || project.city?.nameEn || cityCode(project);
  const data = {
    internalCode,
    driverCode,
    name: `${scenario.label} - ${project.name}${suffix ? ` ${suffix}` : ""}`,
    actualName: `اختبار ${scenario.label} ${cityName}${suffix ? ` ${suffix}` : ""}`,
    phone: `05${hashDigits(internalCode, 8)}`,
    mobile: `05${hashDigits(`${internalCode}:m`, 8)}`,
    nationalId: `T${hashDigits(`${internalCode}:iqama`, 9)}`,
    nationality: suffix === "B" ? "مصري" : "سعودي",
    cityId: project.cityId,
    projectId: project.projectId || null,
    supervisorId: null,
    vehicleOwnershipType: scenario.vehicleOwnershipType,
    status: "ACTIVE",
    contractType: scenario.contractType,
    sponsorshipType: scenario.contractType,
    accommodationType: scenario.key === "HOUSING" || scenario.key === "MULTI_DEDUCTIONS" ? "company" : "external",
    housingStatus: scenario.key === "HOUSING" || scenario.key === "MULTI_DEDUCTIONS" ? "COMPANY_HOUSING" : "EXTERNAL",
    source: tag,
    needsReview: false,
    joinDate: toDate("2026-04", 1),
  };
  if (!apply) return { ...data, id: null, riderId };
  const driver = await prisma.driver.upsert({
    where: { internalCode },
    update: data,
    create: data,
  });
  return { ...driver, riderId };
}

async function ensureVehicleForDriver({ tag, project, driver, scenario, apply }) {
  if (!scenario.companyCar) return null;
  const plateEn = `${appCode(project).slice(0, 2)}-${cityCode(project).slice(0, 6)}-${scenario.key.slice(0, 8)}-${hashDigits(driver.internalCode, 4)}`.slice(0, 190);
  const vehicleData = {
    vehicleCode: `${tag}_${plateEn}`.slice(0, 190),
    plateAr: `اختبار ${plateEn}`,
    plateArabic: `اختبار ${plateEn}`,
    plateEn,
    plateEnglish: plateEn,
    brand: "TEST",
    model: "Payroll Case",
    year: 2026,
    ownershipType: "company",
    rentalCompany: "TEST Rental",
    dailyRent: 66.67,
    monthlyRent: 2000,
    status: "ASSIGNED",
    currentDriverId: driver.id,
    cityId: project.cityId,
  };
  if (!apply) return { ...vehicleData, id: null };
  const vehicle = await prisma.vehicle.upsert({
    where: { plateEn },
    update: vehicleData,
    create: vehicleData,
  });
  await prisma.driver.update({
    where: { id: driver.id },
    data: { vehicleId: vehicle.id, vehicleOwnershipType: "company_car" },
  });
  await upsertByFindFirst({
    model: "vehicleAssignment",
    where: { vehicleId: vehicle.id, driverId: driver.id, notes: { contains: tag } },
    create: {
      vehicleId: vehicle.id,
      driverId: driver.id,
      startDate: toDate("2026-04", 1),
      endDate: toDate("2026-04", 20),
      rentalDays: 20,
      calculatedRent: 1333.33,
      status: "ACTIVE",
      notes: `${tag} ${project.code} ${scenario.key}`,
    },
    update: {
      startDate: toDate("2026-04", 1),
      endDate: toDate("2026-04", 20),
      rentalDays: 20,
      calculatedRent: 1333.33,
      status: "ACTIVE",
      notes: `${tag} ${project.code} ${scenario.key}`,
    },
    apply,
  });
  return vehicle;
}

async function ensureAccount({ tag, project, driver, scenario, riderId, suffix = "", apply }) {
  const username = scenarioUsername(tag, project, scenario.key, riderId, suffix);
  const data = {
    appName: appCode(project) === "HUNGERSTATION" ? "HungerStation" : "Keeta",
    username,
    appUserId: riderId,
    appUsername: driver.actualName || driver.name,
    applicationId: project.applicationId,
    applicationProjectId: project.id,
    projectId: project.projectId || null,
    cityId: project.cityId,
    driverId: driver.id,
    isEmpty: false,
    needsReview: false,
    unmatchedReason: null,
    source: tag,
    status: "ACTIVE",
    linkedAt: toDate("2026-04", 1),
  };
  if (!apply) return { ...data, id: null };
  return prisma.applicationAccount.upsert({
    where: { username },
    update: data,
    create: data,
  });
}

function scenarioMetrics(project, scenario) {
  const app = appCode(project);
  const weak = scenario.weakLow;
  const appDeductions = scenario.appDeductions;
  const high = !weak && !["WEAK_LOW", "NO_APPROVED_USAGE"].includes(scenario.key);
  const orders = weak ? 80 : appDeductions ? 220 : high ? 320 : 150;
  const invoiceOrderRate = weak ? 6.5 : high ? 10 : 8.5;
  const km = weak ? 55 : high ? 210 : 120;
  const cityPayment = app === "HUNGERSTATION" ? (high ? 90 : 40) : 0;
  return {
    orders,
    invoiceOrderRate,
    km,
    basicPayment: Number((orders * invoiceOrderRate).toFixed(2)),
    distancePayment: Number((km * 1.25).toFixed(2)),
    cityPayment,
    workingDays: weak ? 14 : 28,
    hours: weak ? 92 : 220,
    appDeductions: appDeductions
      ? {
          acceptanceRatePenalties: 25,
          contactRatePenalties: 20,
          stackingDeduction: 35,
          declinedPenaltiesDayLogic: 45,
          latePenalty: 15,
          noShowPenalty: 30,
          noShowPenaltySpecialCities: 10,
          dailyAcceptanceRatePenalty: 25,
          missedDaysPenalty: 40,
          riderBalance: 55,
        }
      : {
          acceptanceRatePenalties: 0,
          contactRatePenalties: 0,
          stackingDeduction: 0,
          declinedPenaltiesDayLogic: 0,
          latePenalty: 0,
          noShowPenalty: 0,
          noShowPenaltySpecialCities: 0,
          dailyAcceptanceRatePenalty: 0,
          missedDaysPenalty: 0,
          riderBalance: 0,
        },
  };
}

async function disconnect() {
  await prisma.$disconnect();
}

module.exports = {
  prisma,
  parseArgs,
  tagForMonth,
  monthParts,
  loadTargetProjects,
  loadMissingCoverage,
  SCENARIOS,
  TARGET_APPS,
  TARGET_CITY_NAMES,
  appCode,
  cityCode,
  scenarioRiderId,
  scenarioInternalCode,
  scenarioDriverCode,
  scenarioUsername,
  scenarioMetrics,
  toDate,
  jsonTag,
  ensureDriver,
  ensureVehicleForDriver,
  ensureAccount,
  upsertByFindFirst,
  disconnect,
};
