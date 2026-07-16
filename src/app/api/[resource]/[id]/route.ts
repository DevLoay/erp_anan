import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getResource } from "@/lib/resources";
import { canReadResource, canWriteResource, roleFromHeaders } from "@/lib/permissions";
import { getAccessScope, type AccessScope } from "@/lib/auth/accessScope";

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
  return /amount|cost|rent|salary|bonus|deduction|balance|hours|rate|percent|orders|rows|target|riders|days|year|payroll|revenues|expenses|profit/i.test(key);
}

function jsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? null));
}

async function audit(request: Request, action: string, entityType: string, entityId: string, before: unknown, after: unknown) {
  await prisma.auditLog
    .create({
      data: {
        userId: request.headers.get("x-user-id") || undefined,
        user: request.headers.get("x-user-email") || undefined,
        action,
        entityType,
        entityId,
        before: jsonValue(before),
        after: jsonValue(after),
        oldValue: jsonValue(before),
        newValue: jsonValue(after),
      },
    })
    .catch(() => null);
}

function vehicleStatusFromBody(body: Record<string, unknown>) {
  const raw = String(body.status ?? "").toUpperCase();
  if (["AVAILABLE", "ASSIGNED", "MAINTENANCE", "ACCIDENT", "INACTIVE"].includes(raw)) return raw;
  return "";
}

async function updateVehicleWithDriverSync(id: string, body: Record<string, unknown>, select: Record<string, boolean>) {
  const status = vehicleStatusFromBody(body);
  const requestedDriverId = "currentDriverId" in body ? String(body.currentDriverId ?? "").trim() : "";
  const normalizedBody = { ...body };
  if (status && status !== "ASSIGNED") {
    normalizedBody.currentDriverId = null;
  }

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const beforeVehicle = await tx.vehicle.findUnique({ where: { id }, select: { id: true, currentDriverId: true, status: true } });
    if (!beforeVehicle) throw new Error("السيارة غير موجودة.");
    const effectiveDriverId = requestedDriverId || beforeVehicle.currentDriverId || "";
    if (status === "ASSIGNED" && !effectiveDriverId) {
      throw new Error("اختار المندوب قبل حفظ سيارة حالتها مع مندوب.");
    }
    if (status === "ASSIGNED" && effectiveDriverId) {
      normalizedBody.currentDriverId = effectiveDriverId;
    }

    const updated = await tx.vehicle.update({ where: { id }, data: normalizedBody as Prisma.VehicleUncheckedUpdateInput });
    const driverId = String(updated.currentDriverId ?? "").trim();
    const activeAssignment = await tx.vehicleAssignment.findFirst({
      where: { vehicleId: id, status: "ACTIVE", endDate: null },
      orderBy: { startDate: "desc" },
    });

    if (driverId && String(updated.status) === "ASSIGNED") {
      if (beforeVehicle.currentDriverId && beforeVehicle.currentDriverId !== driverId) {
        await tx.driver.update({ where: { id: beforeVehicle.currentDriverId }, data: { vehicleId: null } }).catch(() => null);
      }
      if (activeAssignment && activeAssignment.driverId !== driverId) {
        await tx.vehicleAssignment.update({
          where: { id: activeAssignment.id },
          data: { endDate: new Date(), status: "INACTIVE" },
        });
        await tx.vehicleAssignment.create({
          data: { vehicleId: id, driverId, startDate: new Date(), status: "ACTIVE", notes: "تم تحديث الربط من شاشة السيارات." },
        });
      } else if (!activeAssignment) {
        await tx.vehicleAssignment.create({
          data: { vehicleId: id, driverId, startDate: new Date(), status: "ACTIVE", notes: "تم تحديث الربط من شاشة السيارات." },
        });
      }
      await tx.driver.update({ where: { id: driverId }, data: { vehicleId: id, vehicleOwnershipType: "company_car" } }).catch(() => null);
    }

    if ((!driverId || String(updated.status) !== "ASSIGNED") && activeAssignment) {
      await tx.vehicleAssignment.update({ where: { id: activeAssignment.id }, data: { endDate: new Date(), status: "INACTIVE" } });
      await tx.driver.update({ where: { id: activeAssignment.driverId }, data: { vehicleId: null } }).catch(() => null);
    }

    return tx.vehicle.findUnique({ where: { id }, select });
  });
}

function safeSelect(resource: string, fields: string[]) {
  const unsafeRelations = new Set(["city", "project", "driver", "supervisor", "vehicle", "account", "application", "applicationProject"]);
  const always = ["id", "createdAt"];
  const fieldSet = new Set([...always, ...fields].filter((field) => field && !unsafeRelations.has(field) && !field.includes(".")));

  const knownExistingFields: Record<string, string[]> = {
    drivers: ["id", "internalCode", "name", "phone", "nationalId", "cityId", "projectId", "supervisorId", "vehicleId", "accountId", "status", "contractType", "housingStatus", "createdAt", "updatedAt"],
    vehicles: ["id", "vehicleCode", "plateAr", "plateArabic", "plateEn", "plateEnglish", "brand", "model", "year", "ownershipType", "rentalCompany", "dailyRent", "monthlyRent", "status", "currentDriverId", "cityId", "createdAt", "updatedAt"],
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

async function recordAllowed(resource: string, record: unknown, scope: AccessScope) {
  if (scope.isGlobal) return true;
  const row = (record ?? {}) as Record<string, unknown>;
  const id = String(row.id ?? "");
  const driverId = String(row.driverId ?? "");
  const currentDriverId = String(row.currentDriverId ?? "");
  const supervisorId = String(row.supervisorId ?? "");
  const cityId = String(row.cityId ?? "");
  const projectId = String(row.projectId ?? "");

  if (resource === "drivers" && scope.driverId && id === scope.driverId) return true;
  if (resource === "supervisors" && scope.projectIds.length && scope.supervisorId) return id === scope.supervisorId;
  if (scope.driverId && (driverId === scope.driverId || currentDriverId === scope.driverId)) return true;
  if (scope.supervisorId && supervisorId === scope.supervisorId) return true;
  if (cityId && scope.cityIds.length && !scope.cityIds.includes(cityId)) return false;
  if (projectId && scope.projectIds.includes(projectId)) return true;

  const scopedDriverId = resource === "drivers" ? id : driverId || currentDriverId;
  if (scopedDriverId) {
    const allowedDriver = await prisma.driver.count({
      where: {
        id: scopedDriverId,
        AND: [
          scope.cityIds.length ? { cityId: { in: scope.cityIds } } : {},
          scope.projectIds.length
            ? { applicationAccounts: { some: { applicationProjectId: { in: scope.projectIds } } } }
            : {},
        ],
      },
    });
    return allowedDriver > 0;
  }

  if (resource === "vehicles") {
    const allowedVehicle = await prisma.vehicle.count({
      where: {
        id,
        AND: [
          scope.cityIds.length ? { cityId: { in: scope.cityIds } } : {},
          scope.projectIds.length
            ? { currentDriver: { is: { applicationAccounts: { some: { applicationProjectId: { in: scope.projectIds } } } } } }
            : {},
        ],
      },
    });
    return allowedVehicle > 0;
  }

  if (cityId && scope.cityIds.includes(cityId) && !scope.projectIds.length) return true;

  return false;
}

export async function GET(request: Request, context: { params: Promise<{ resource: string; id: string }> }) {
  const { resource, id } = await context.params;
  const config = getResource(resource);
  if (!config) return NextResponse.json({ error: "Unknown resource" }, { status: 404 });

  const role = roleFromHeaders(request.headers);
  if (!canReadResource(role, config.key)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const scope = await getAccessScope(request.headers);

  const select = safeSelect(config.key, [...config.searchFields, ...config.columns.map((column) => column.key)]);
  const data = await delegate(config.delegate).findUnique({ where: { id }, select });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await recordAllowed(config.key, data, scope))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ data });
}

export async function PATCH(request: Request, context: { params: Promise<{ resource: string; id: string }> }) {
  const { resource, id } = await context.params;
  const config = getResource(resource);
  if (!config) return NextResponse.json({ error: "Unknown resource" }, { status: 404 });

  const role = roleFromHeaders(request.headers);
  if (!canWriteResource(role, config.key)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const scope = await getAccessScope(request.headers);

  const body = normalizePayload((await request.json()) as Record<string, unknown>);
  const select = safeSelect(config.key, [...config.searchFields, ...config.columns.map((column) => column.key)]);
  const before = await delegate(config.delegate).findUnique({ where: { id }, select });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await recordAllowed(config.key, before, scope))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let data: unknown;
  try {
    data = config.key === "vehicles" ? await updateVehicleWithDriverSync(id, body, select) : await delegate(config.delegate).update({ where: { id }, data: body, select });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر تحديث السجل." }, { status: 409 });
  }
  await audit(request, "UPDATE", config.key, id, before, data);
  return NextResponse.json({ data });
}

export async function DELETE(request: Request, context: { params: Promise<{ resource: string; id: string }> }) {
  const { resource, id } = await context.params;
  const config = getResource(resource);
  if (!config) return NextResponse.json({ error: "Unknown resource" }, { status: 404 });

  const role = roleFromHeaders(request.headers);
  if (!canWriteResource(role, config.key)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (role !== "ADMIN") return NextResponse.json({ error: "Delete requires Admin permission" }, { status: 403 });
  const scope = await getAccessScope(request.headers);

  const select = safeSelect(config.key, [...config.searchFields, ...config.columns.map((column) => column.key)]);
  const before = await delegate(config.delegate).findUnique({ where: { id }, select });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await recordAllowed(config.key, before, scope))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let data: unknown;
  if (config.key === "drivers") {
    data = await delegate(config.delegate).update({ where: { id }, data: { status: "INACTIVE" }, select });
    await audit(request, "DRIVER_DEACTIVATE", config.key, id, before, data);
    return NextResponse.json({ data });
  }
  if (config.key === "vehicles") {
    data = await delegate(config.delegate).update({ where: { id }, data: { status: "INACTIVE" }, select });
    await audit(request, "VEHICLE_DEACTIVATE", config.key, id, before, data);
    return NextResponse.json({ data });
  }
  data = await delegate(config.delegate).delete({ where: { id }, select });
  await audit(request, "DELETE", config.key, id, before, data);
  return NextResponse.json({ data });
}
