const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i === -1) continue;
    const key = trimmed.slice(0, i).trim();
    const value = trimmed.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    process.env[key] = value;
  }
}

loadEnv();

const prisma = new PrismaClient();
const COMPANY_CAR_FULL_MONTH_RENT = 2000;
const RENT_DAYS_BASE = 30;
const DAY_MS = 86_400_000;
const IGNORED_STATUSES = new Set(["CANCELLED", "REJECTED", "INACTIVE"]);

function toNumber(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}
function toDate(value, fallback = new Date()) {
  const date = value instanceof Date ? value : new Date(String(value ?? ""));
  return Number.isNaN(date.getTime()) ? fallback : date;
}
function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
function monthStart(month) {
  const [year, rawMonth] = month.split("-").map(Number);
  return new Date(year, (rawMonth || 1) - 1, 1);
}
function monthEnd(month) {
  const start = monthStart(month);
  return new Date(start.getFullYear(), start.getMonth() + 1, 0);
}
function monthsBetween(start, end) {
  const keys = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= last) {
    keys.push(monthKey(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return keys;
}
function overlapDays(start, end, month) {
  const a = startOfDay(start);
  const b = startOfDay(end);
  const mStart = monthStart(month);
  const mEnd = monthEnd(month);
  const from = new Date(Math.max(a.getTime(), mStart.getTime()));
  const to = new Date(Math.min(b.getTime(), mEnd.getTime()));
  if (to < from) return 0;
  return Math.floor((to.getTime() - from.getTime()) / DAY_MS) + 1;
}
function isPersonalVehicle(vehicle) {
  const ownership = String(vehicle?.ownershipType ?? "").toLowerCase();
  return ownership.includes("personal") || ownership.includes("شخص");
}
function monthlyRent(vehicle) {
  if (isPersonalVehicle(vehicle)) return 0;
  const configured = toNumber(vehicle?.monthlyRent);
  return configured > 0 ? configured : COMPANY_CAR_FULL_MONTH_RENT;
}
function shouldInclude(status) {
  return !IGNORED_STATUSES.has(String(status ?? "").toUpperCase());
}
function bucket(map, vehicleId, month) {
  const key = `${vehicleId}::${month}`;
  let item = map.get(key);
  if (!item) {
    item = { vehicleId, month, rentCost: 0, maintenanceCost: 0, cleaningCost: 0, accidentCost: 0, damageCost: 0, otherCost: 0 };
    map.set(key, item);
  }
  return item;
}

async function main() {
  const targetMonthArg = process.argv.find((arg) => /^\d{4}-\d{2}$/.test(arg));
  const today = new Date();
  const [vehicles, assignments, maintenance, cleanings, accidents, damages, violations, deductions] = await Promise.all([
    prisma.vehicle.findMany({ select: { id: true, monthlyRent: true, ownershipType: true } }),
    prisma.vehicleAssignment.findMany({ select: { vehicleId: true, startDate: true, endDate: true, status: true } }),
    prisma.vehicleMaintenance.findMany({ select: { vehicleId: true, date: true, cost: true, status: true } }),
    prisma.vehicleCleaning.findMany({ select: { vehicleId: true, cleanDate: true, cost: true, status: true } }),
    prisma.vehicleAccident.findMany({ select: { vehicleId: true, date: true, cost: true, status: true } }),
    prisma.vehicleDamage.findMany({ select: { vehicleId: true, date: true, estimatedCost: true, finalCost: true, status: true } }),
    prisma.violation.findMany({ select: { vehicleId: true, occurredAt: true, amount: true, status: true } }),
    prisma.deduction.findMany({ select: { vehicleId: true, month: true, amount: true, status: true } }).catch(() => []),
  ]);

  const vehicleMap = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const months = new Set();
  if (targetMonthArg) months.add(targetMonthArg);
  else months.add(monthKey(today));

  for (const assignment of assignments) {
    const start = toDate(assignment.startDate, today);
    const end = assignment.endDate ? toDate(assignment.endDate, today) : today;
    for (const month of monthsBetween(start, end)) months.add(month);
  }
  for (const row of [...maintenance, ...cleanings, ...accidents, ...damages, ...violations]) {
    const date = toDate(row.date ?? row.cleanDate ?? row.occurredAt, today);
    months.add(monthKey(date));
  }
  for (const row of deductions) if (row.month) months.add(String(row.month).slice(0, 7));

  const selectedMonths = targetMonthArg ? new Set([targetMonthArg]) : months;
  const buckets = new Map();

  for (const assignment of assignments) {
    if (!shouldInclude(assignment.status)) continue;
    const vehicle = vehicleMap.get(assignment.vehicleId);
    if (!vehicle) continue;
    const rent = monthlyRent(vehicle);
    if (rent <= 0) continue;
    const start = toDate(assignment.startDate, today);
    const end = assignment.endDate ? toDate(assignment.endDate, today) : today;
    for (const month of selectedMonths) {
      const days = overlapDays(start, end, month);
      if (days <= 0) continue;
      const chargedDays = Math.min(days, RENT_DAYS_BASE);
      bucket(buckets, assignment.vehicleId, month).rentCost += Math.min(rent, (rent / RENT_DAYS_BASE) * chargedDays);
    }
  }

  for (const item of buckets.values()) {
    const vehicle = vehicleMap.get(item.vehicleId);
    item.rentCost = Math.min(monthlyRent(vehicle), item.rentCost);
  }
  for (const row of maintenance) {
    if (!row.vehicleId || !shouldInclude(row.status)) continue;
    const month = monthKey(toDate(row.date, today));
    if (!selectedMonths.has(month)) continue;
    bucket(buckets, row.vehicleId, month).maintenanceCost += toNumber(row.cost);
  }
  for (const row of cleanings) {
    if (!row.vehicleId || !shouldInclude(row.status)) continue;
    const month = monthKey(toDate(row.cleanDate, today));
    if (!selectedMonths.has(month)) continue;
    bucket(buckets, row.vehicleId, month).cleaningCost += toNumber(row.cost);
  }
  for (const row of accidents) {
    if (!row.vehicleId || !shouldInclude(row.status)) continue;
    const month = monthKey(toDate(row.date, today));
    if (!selectedMonths.has(month)) continue;
    bucket(buckets, row.vehicleId, month).accidentCost += toNumber(row.cost);
  }
  for (const row of damages) {
    if (!row.vehicleId || !shouldInclude(row.status)) continue;
    const month = monthKey(toDate(row.date, today));
    if (!selectedMonths.has(month)) continue;
    bucket(buckets, row.vehicleId, month).damageCost += toNumber(row.finalCost) || toNumber(row.estimatedCost);
  }
  for (const row of violations) {
    if (!row.vehicleId || !shouldInclude(row.status)) continue;
    const month = monthKey(toDate(row.occurredAt, today));
    if (!selectedMonths.has(month)) continue;
    bucket(buckets, row.vehicleId, month).otherCost += toNumber(row.amount);
  }
  for (const row of deductions) {
    if (!row.vehicleId || !shouldInclude(row.status)) continue;
    const month = String(row.month || monthKey(today)).slice(0, 7);
    if (!selectedMonths.has(month)) continue;
    bucket(buckets, row.vehicleId, month).otherCost += toNumber(row.amount);
  }

  let count = 0;
  for (const item of buckets.values()) {
    const totalCost = item.rentCost + item.maintenanceCost + item.cleaningCost + item.accidentCost + item.damageCost + item.otherCost;
    const data = {
      rentCost: Number(item.rentCost.toFixed(2)),
      maintenanceCost: Number(item.maintenanceCost.toFixed(2)),
      cleaningCost: Number(item.cleaningCost.toFixed(2)),
      accidentCost: Number(item.accidentCost.toFixed(2)),
      damageCost: Number(item.damageCost.toFixed(2)),
      otherCost: Number(item.otherCost.toFixed(2)),
      totalCost: Number(totalCost.toFixed(2)),
      status: "ACTIVE",
    };
    await prisma.vehicleCost.upsert({
      where: { vehicleId_month: { vehicleId: item.vehicleId, month: item.month } },
      create: { vehicleId: item.vehicleId, month: item.month, ...data },
      update: data,
    });
    count += 1;
  }

  console.log(`Vehicle cost records recalculated: ${count}`);
  if (targetMonthArg) console.log(`Month: ${targetMonthArg}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
