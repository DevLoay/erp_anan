import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const COMPANY_CAR_FULL_MONTH_RENT = 2000;
const RENT_DAYS_BASE = 30;
const DAY_MS = 86_400_000;
const IGNORED_STATUSES = new Set(["CANCELLED", "REJECTED", "INACTIVE"]);

type MonthKey = string;
type Bucket = {
  vehicleId: string;
  month: MonthKey;
  rentCost: number;
  maintenanceCost: number;
  cleaningCost: number;
  accidentCost: number;
  damageCost: number;
  otherCost: number;
};

function toNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function toDate(value: unknown, fallback = new Date()) {
  const date = value instanceof Date ? value : new Date(String(value ?? ""));
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthStart(month: string) {
  const [year, rawMonth] = month.split("-").map(Number);
  return new Date(year, (rawMonth || 1) - 1, 1);
}

function monthEnd(month: string) {
  const start = monthStart(month);
  return new Date(start.getFullYear(), start.getMonth() + 1, 0);
}

function monthsBetween(start: Date, end: Date) {
  const keys: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= last) {
    keys.push(monthKey(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return keys;
}

function overlapDays(start: Date, end: Date, month: string) {
  const a = startOfDay(start);
  const b = startOfDay(end);
  const mStart = monthStart(month);
  const mEnd = monthEnd(month);
  const from = new Date(Math.max(a.getTime(), mStart.getTime()));
  const to = new Date(Math.min(b.getTime(), mEnd.getTime()));
  if (to < from) return 0;
  return Math.floor((to.getTime() - from.getTime()) / DAY_MS) + 1;
}

function isPersonalVehicle(vehicle: any) {
  const ownership = String(vehicle?.ownershipType ?? "").toLowerCase();
  return ownership.includes("personal") || ownership.includes("شخص");
}

function monthlyRent(vehicle: any) {
  if (isPersonalVehicle(vehicle)) return 0;
  const configured = toNumber(vehicle?.monthlyRent);
  return configured > 0 ? configured : COMPANY_CAR_FULL_MONTH_RENT;
}

function shouldInclude(status: unknown) {
  return !IGNORED_STATUSES.has(String(status ?? "").toUpperCase());
}

function bucket(map: Map<string, Bucket>, vehicleId: string, month: string) {
  const key = `${vehicleId}::${month}`;
  let item = map.get(key);
  if (!item) {
    item = { vehicleId, month, rentCost: 0, maintenanceCost: 0, cleaningCost: 0, accidentCost: 0, damageCost: 0, otherCost: 0 };
    map.set(key, item);
  }
  return item;
}

async function recalculateVehicleCosts(targetMonth?: string) {
  const client = prisma as any;
  const today = new Date();

  const [vehicles, assignments, maintenance, cleanings, accidents, damages, violations, deductions] = await Promise.all([
    client.vehicle.findMany({ select: { id: true, monthlyRent: true, ownershipType: true } }),
    client.vehicleAssignment.findMany({ select: { vehicleId: true, startDate: true, endDate: true, status: true } }),
    client.vehicleMaintenance.findMany({ select: { vehicleId: true, date: true, cost: true, status: true } }),
    client.vehicleCleaning.findMany({ select: { vehicleId: true, cleanDate: true, cost: true, status: true } }),
    client.vehicleAccident.findMany({ select: { vehicleId: true, date: true, cost: true, status: true } }),
    client.vehicleDamage.findMany({ select: { vehicleId: true, date: true, estimatedCost: true, finalCost: true, status: true } }),
    client.violation.findMany({ select: { vehicleId: true, occurredAt: true, amount: true, status: true } }),
    client.deduction.findMany({ select: { vehicleId: true, month: true, amount: true, status: true } }).catch(() => []),
  ]);

  const vehicleMap = new Map(vehicles.map((vehicle: any) => [vehicle.id, vehicle]));
  const months = new Set<string>();
  if (targetMonth) months.add(targetMonth);
  else months.add(monthKey(today));

  for (const assignment of assignments) {
    const start = toDate(assignment.startDate, today);
    const end = assignment.endDate ? toDate(assignment.endDate, today) : today;
    for (const month of monthsBetween(start, end)) months.add(month);
  }
  for (const row of [...maintenance, ...cleanings, ...accidents, ...damages, ...violations]) {
    const date = toDate((row as any).date ?? (row as any).cleanDate ?? (row as any).occurredAt, today);
    months.add(monthKey(date));
  }
  for (const row of deductions) {
    if (row.month) months.add(String(row.month).slice(0, 7));
  }

  const selectedMonths = targetMonth ? new Set([targetMonth]) : months;
  const buckets = new Map<string, Bucket>();

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

  const updated: any[] = [];
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
    const record = await client.vehicleCost.upsert({
      where: { vehicleId_month: { vehicleId: item.vehicleId, month: item.month } },
      create: { vehicleId: item.vehicleId, month: item.month, ...data },
      update: data,
    });
    updated.push(record);
  }

  return updated;
}

export async function POST(request: Request) {
  try {
    const input = await request.json().catch(() => ({}));
    const month = typeof input?.month === "string" && /^\d{4}-\d{2}$/.test(input.month) ? input.month : undefined;
    const updated = await recalculateVehicleCosts(month);
    return NextResponse.json({ ok: true, count: updated.length, data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر تجميع تكاليف السيارات.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
