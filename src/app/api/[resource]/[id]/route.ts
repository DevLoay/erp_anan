import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getResource } from "@/lib/resources";
import { canReadResource, canWriteResource, roleFromHeaders } from "@/lib/permissions";

type Delegate = {
  findUnique(args: unknown): Promise<unknown>;
  update(args: unknown): Promise<unknown>;
  delete(args: unknown): Promise<unknown>;
};

function delegate(name: string): Delegate {
  return (prisma as unknown as Record<string, Delegate>)[name];
}

function normalizePayload(input: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (["id", "createdAt", "updatedAt"].includes(key)) continue;
    if (value === "") continue;
    if (key.endsWith("At") || key.endsWith("Date") || ["reportDate", "dueDate", "occurredAt", "lockedAt"].includes(key)) {
      out[key] = value ? new Date(String(value)) : null;
    } else if (typeof value === "string" && (value === "true" || value === "false")) {
      out[key] = value === "true";
    } else if (typeof value === "string" && isNumericField(key) && value.trim() !== "") {
      out[key] = Number(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function isNumericField(key: string) {
  return /amount|cost|rent|salary|bonus|deduction|balance|hours|rate|percent|orders|rows|target|riders|days|payroll|revenues|expenses|profit/i.test(key);
}

function safeSelect(resource: string, fields: string[]) {
  const unsafeRelations = new Set(["city", "project", "driver", "supervisor", "vehicle", "account", "application", "applicationProject"]);
  const always = ["id", "createdAt", "updatedAt"];
  const fieldSet = new Set([...always, ...fields].filter((field) => field && !unsafeRelations.has(field) && !field.includes(".")));

  const knownExistingFields: Record<string, string[]> = {
    drivers: ["id", "internalCode", "name", "phone", "nationalId", "cityId", "projectId", "supervisorId", "vehicleId", "accountId", "status", "contractType", "housingStatus", "createdAt", "updatedAt"],
    vehicles: ["id", "plateAr", "plateEn", "model", "rentalCompany", "monthlyRent", "status", "currentDriverId", "cityId", "createdAt", "updatedAt"],
    advances: ["id", "driverId", "amount", "remainingAmount", "reason", "deductionMonth", "status", "createdAt", "updatedAt"],
    deductions: ["id", "driverId", "type", "amount", "month", "status", "notes", "createdAt", "updatedAt"],
    violations: ["id", "driverId", "type", "amount", "status", "occurredAt", "notes", "createdAt", "updatedAt"],
    "driver-documents": ["id", "driverId", "type", "issueDate", "expiryDate", "status", "fileUrl", "notes", "createdAt", "updatedAt"],
    "driver-housing": ["id", "driverId", "housingType", "location", "monthlyCost", "status", "startDate", "endDate", "notes", "createdAt", "updatedAt"],
  };
  const allowed = knownExistingFields[resource];
  const selectedFields = allowed ? [...fieldSet].filter((field) => allowed.includes(field)) : [...fieldSet];
  return Object.fromEntries(selectedFields.map((field) => [field, true]));
}

export async function GET(request: Request, context: { params: Promise<{ resource: string; id: string }> }) {
  const { resource, id } = await context.params;
  const config = getResource(resource);
  if (!config) return NextResponse.json({ error: "Unknown resource" }, { status: 404 });

  const role = roleFromHeaders(request.headers);
  if (!canReadResource(role, config.key)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const select = safeSelect(config.key, [...config.searchFields, ...config.columns.map((column) => column.key)]);
  const data = await delegate(config.delegate).findUnique({ where: { id }, select });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data });
}

export async function PATCH(request: Request, context: { params: Promise<{ resource: string; id: string }> }) {
  const { resource, id } = await context.params;
  const config = getResource(resource);
  if (!config) return NextResponse.json({ error: "Unknown resource" }, { status: 404 });

  const role = roleFromHeaders(request.headers);
  if (!canWriteResource(role, config.key)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = normalizePayload((await request.json()) as Record<string, unknown>);
  const select = safeSelect(config.key, [...config.searchFields, ...config.columns.map((column) => column.key)]);
  const data = await delegate(config.delegate).update({ where: { id }, data: body, select });
  return NextResponse.json({ data });
}

export async function DELETE(request: Request, context: { params: Promise<{ resource: string; id: string }> }) {
  const { resource, id } = await context.params;
  const config = getResource(resource);
  if (!config) return NextResponse.json({ error: "Unknown resource" }, { status: 404 });

  const role = roleFromHeaders(request.headers);
  if (!canWriteResource(role, config.key)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const select = safeSelect(config.key, [...config.searchFields, ...config.columns.map((column) => column.key)]);
  const data = await delegate(config.delegate).delete({ where: { id }, select });
  return NextResponse.json({ data });
}
