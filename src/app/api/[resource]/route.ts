import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getResource } from "@/lib/resources";
import { canReadResource, canWriteResource, roleFromHeaders } from "@/lib/permissions";
import { getAccessScope, type AccessScope } from "@/lib/auth/accessScope";

type Delegate = {
  findMany(args?: unknown): Promise<unknown[]>;
  count(args?: unknown): Promise<number>;
  create(args: unknown): Promise<unknown>;
};

function delegate(name: string): Delegate {
  return (prisma as unknown as Record<string, Delegate>)[name];
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

async function findRows(source: Delegate, take: number, select?: Record<string, boolean>, where?: Record<string, unknown>) {
  try {
    return await source.findMany({ take, where, orderBy: { updatedAt: "desc" }, ...(select ? { select } : {}) });
  } catch {
    try {
      return await source.findMany({ take, where, orderBy: { createdAt: "desc" }, ...(select ? { select } : {}) });
    } catch {
      return source.findMany({ take, where, ...(select ? { select } : {}) });
    }
  }
}

function scopedAnd(scope: AccessScope, clauses: Array<Record<string, unknown>>) {
  if (scope.isGlobal) return {};
  const active = clauses.filter((clause) => Object.keys(clause).length > 0);
  return active.length ? { AND: active } : { id: "__NO_ACCESS_SCOPE__" };
}

function scopedWhere(resource: string, scope: AccessScope): Record<string, unknown> {
  if (scope.isGlobal) return {};
  const cityClause = scope.cityIds.length ? { cityId: { in: scope.cityIds } } : {};
  const projectAccountClause = scope.projectIds.length
    ? { applicationAccounts: { some: { applicationProjectId: { in: scope.projectIds } } } }
    : {};
  const driverClause = scope.driverId ? { driverId: scope.driverId } : {};
  const supervisorClause = scope.supervisorId && !scope.cityIds.length && !scope.projectIds.length ? { supervisorId: scope.supervisorId } : {};

  switch (resource) {
    case "drivers":
      return scopedAnd(scope, [
        scope.driverId ? { id: scope.driverId } : {},
        supervisorClause,
        cityClause,
        projectAccountClause,
      ]);
    case "supervisors":
      return scopedAnd(scope, [
        scope.projectIds.length && scope.supervisorId ? { id: scope.supervisorId } : {},
        cityClause,
      ]);
    case "vehicles":
      return scopedAnd(scope, [
        scope.driverId ? { currentDriverId: scope.driverId } : {},
        cityClause,
        scope.projectIds.length
          ? { currentDriver: { is: { applicationAccounts: { some: { applicationProjectId: { in: scope.projectIds } } } } } }
          : {},
      ]);
    case "application-accounts":
      return scopedAnd(scope, [
        driverClause,
        cityClause,
        scope.driverId ? { driverId: scope.driverId } : {},
        scope.projectIds.length ? { applicationProjectId: { in: scope.projectIds } } : {},
      ]);
    case "daily-reports":
    case "advances":
      return scopedAnd(scope, [
        driverClause,
        supervisorClause,
        cityClause,
        scope.projectIds.length ? { applicationProjectId: { in: scope.projectIds } } : {},
      ]);
    case "deductions":
    case "violations":
    case "attendance":
    case "tasks":
    case "notifications":
      return scopedAnd(scope, [
        driverClause,
        supervisorClause,
        cityClause,
        scope.projectIds.length ? { driver: { is: projectAccountClause } } : {},
      ]);
    case "driver-documents":
    case "driver-housing":
    case "driver-contracts":
      return scopedAnd(scope, [
        scope.driverId ? { driverId: scope.driverId } : {},
        scope.cityIds.length ? { driver: { is: { cityId: { in: scope.cityIds } } } } : {},
        scope.projectIds.length ? { driver: { is: projectAccountClause } } : {},
      ]);
    case "vehicle-movements":
    case "vehicle-cleaning":
    case "vehicle-maintenance":
    case "vehicle-authorizations":
    case "vehicle-accidents":
    case "vehicle-damages":
    case "vehicle-costs":
      return scopedAnd(scope, [driverClause, cityClause]);
    case "payroll":
      return scopedAnd(scope, [
        driverClause,
        cityClause,
        scope.projectIds.length ? { driver: { is: projectAccountClause } } : {},
      ]);
    case "invoices":
      return scopedAnd(scope, [
        scope.cityIds.length ? { applicationProject: { is: { cityId: { in: scope.cityIds } } } } : {},
        scope.projectIds.length ? { applicationProjectId: { in: scope.projectIds } } : {},
      ]);
    case "revenues":
    case "expenses":
    case "receivables":
    case "payments":
    case "cashbox-entries":
    case "bank-accounts":
    case "profit-loss":
    case "vat-records":
      return scopedAnd(scope, [
        driverClause,
        cityClause,
        scope.projectIds.length ? { driver: { is: projectAccountClause } } : {},
      ]);
    default:
      return {};
  }
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

function jsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? null));
}

async function audit(request: Request, action: string, entityType: string, entityId: string | undefined, after: unknown) {
  await prisma.auditLog
    .create({
      data: {
        userId: request.headers.get("x-user-id") || undefined,
        user: request.headers.get("x-user-email") || undefined,
        action,
        entityType,
        entityId,
        after: jsonValue(after),
        newValue: jsonValue(after),
      },
    })
    .catch(() => null);
}

function lowerText(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function isAssignMovement(value: unknown) {
  const text = lowerText(value);
  return text.includes("assign") || text.includes("handover") || text.includes("تسليم") || text.includes("نقل");
}

function isReturnMovement(value: unknown) {
  const text = lowerText(value);
  return text.includes("return") || text.includes("استلام") || text.includes("إرجاع") || text.includes("ارجاع") || text.includes("صيانة");
}

function isMaintenanceEntryMovement(value: unknown) {
  const text = lowerText(value);
  return text.includes("دخول صيانة") || text.includes("maintenance in") || text.includes("enter maintenance");
}

function isMaintenanceExitMovement(value: unknown) {
  const text = lowerText(value);
  return text.includes("خروج من صيانة") || text.includes("maintenance out") || text.includes("exit maintenance");
}

function isOwnerReturnMovement(value: unknown) {
  const text = lowerText(value);
  return text.includes("إرجاع للشركة") || text.includes("ارجاع للشركة") || text.includes("return to owner") || text.includes("return to company");
}

async function handleVehicleMovementCreate(request: Request, body: Record<string, unknown>) {
  const vehicleId = String(body.vehicleId ?? "").trim();
  const toDriverId = String(body.toDriverId ?? body.driverId ?? "").trim();
  const movementType = String(body.movementType ?? "").trim();
  const movementDate = body.handoverDate instanceof Date ? body.handoverDate : body.handoverDate ? new Date(String(body.handoverDate)) : new Date();

  if (!vehicleId || !movementType) {
    return NextResponse.json({ error: "السيارة ونوع الحركة مطلوبان." }, { status: 400 });
  }

  const rawStatus = String(body.status ?? "ACTIVE").toUpperCase();
  const status = ["ACTIVE", "INACTIVE", "PENDING", "APPROVED", "REJECTED", "LOCKED"].includes(rawStatus) ? rawStatus : "ACTIVE";
  const movementData: Prisma.VehicleMovementUncheckedCreateInput = {
    vehicleId,
    fromDriverId: body.fromDriverId ? String(body.fromDriverId) : null,
    toDriverId: toDriverId || null,
    cityId: body.cityId ? String(body.cityId) : null,
    movementType,
    handoverDate: body.handoverDate instanceof Date ? body.handoverDate : body.handoverDate ? new Date(String(body.handoverDate)) : movementDate,
    returnDate: body.returnDate instanceof Date ? body.returnDate : body.returnDate ? new Date(String(body.returnDate)) : null,
    status: status as Prisma.VehicleMovementUncheckedCreateInput["status"],
    notes: body.notes ? String(body.notes) : null,
  };

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const vehicle = await tx.vehicle.findUnique({ where: { id: vehicleId }, select: { id: true, currentDriverId: true, status: true } });
    if (!vehicle) throw new Error("السيارة غير موجودة.");

    const activeVehicleAssignment = await tx.vehicleAssignment.findFirst({
      where: { vehicleId, status: "ACTIVE", endDate: null },
      orderBy: { startDate: "desc" },
    });

    if (isAssignMovement(movementType)) {
      if (!toDriverId) throw new Error("المندوب مطلوب عند تسليم السيارة.");
      if (activeVehicleAssignment && activeVehicleAssignment.driverId !== toDriverId) {
        throw new Error("لا يمكن تسليم نفس السيارة لمندوبين في نفس الفترة.");
      }

      const role = roleFromHeaders(request.headers);
      const activeDriverAssignment = await tx.vehicleAssignment.findFirst({
        where: { driverId: toDriverId, status: "ACTIVE", endDate: null },
      });
      if (activeDriverAssignment && activeDriverAssignment.vehicleId !== vehicleId && role !== "ADMIN") {
        throw new Error("لا يمكن تسليم المندوب أكثر من سيارة نشطة إلا بصلاحية المدير.");
      }

      const movement = await tx.vehicleMovement.create({ data: movementData });
      const assignment =
        activeVehicleAssignment && activeVehicleAssignment.driverId === toDriverId
          ? activeVehicleAssignment
          : await tx.vehicleAssignment.create({
              data: {
                vehicleId,
                driverId: toDriverId,
                startDate: movementDate,
                status: "ACTIVE",
                notes: String(body.notes ?? ""),
              },
            });

      await tx.vehicle.update({ where: { id: vehicleId }, data: { currentDriverId: toDriverId, status: "ASSIGNED" } });
      await tx.driver.update({ where: { id: toDriverId }, data: { vehicleId, vehicleOwnershipType: "company_car" } }).catch(() => null);

      return { movement, assignment };
    }

    if (isReturnMovement(movementType)) {
      const movement = await tx.vehicleMovement.create({ data: movementData });
      if (activeVehicleAssignment) {
        await tx.vehicleAssignment.update({
          where: { id: activeVehicleAssignment.id },
          data: { endDate: movementDate, status: "INACTIVE" },
        });
        await tx.driver.update({ where: { id: activeVehicleAssignment.driverId }, data: { vehicleId: null } }).catch(() => null);
      }
      const nextStatus = isMaintenanceEntryMovement(movementType)
        ? "MAINTENANCE"
        : isOwnerReturnMovement(movementType)
          ? "INACTIVE"
          : isMaintenanceExitMovement(movementType)
            ? "AVAILABLE"
            : "AVAILABLE";
      await tx.vehicle.update({ where: { id: vehicleId }, data: { currentDriverId: null, status: nextStatus } });
      return { movement, closedAssignmentId: activeVehicleAssignment?.id ?? null };
    }

    const movement = await tx.vehicleMovement.create({ data: movementData });
    return { movement };
  });

  await audit(request, "CREATE_VEHICLE_MOVEMENT", "vehicle-movements", (result.movement as { id?: string })?.id, result);
  return NextResponse.json({ data: result }, { status: 201 });
}

function vehicleStatusFromBody(body: Record<string, unknown>) {
  const raw = String(body.status ?? "").toUpperCase();
  if (["AVAILABLE", "ASSIGNED", "MAINTENANCE", "ACCIDENT", "INACTIVE"].includes(raw)) return raw;
  return "";
}

async function handleVehicleCreate(request: Request, body: Record<string, unknown>) {
  const currentDriverId = String(body.currentDriverId ?? "").trim();
  const status = vehicleStatusFromBody(body) || (currentDriverId ? "ASSIGNED" : "AVAILABLE");
  if (status === "ASSIGNED" && !currentDriverId) {
    return NextResponse.json({ error: "اختار المندوب قبل حفظ سيارة حالتها مع مندوب." }, { status: 400 });
  }

  const vehicleData = {
    ...body,
    status,
    currentDriverId: status === "ASSIGNED" ? currentDriverId : null,
  };

  const result = await prisma.$transaction(async (tx) => {
    const vehicle = await tx.vehicle.create({ data: vehicleData as Prisma.VehicleUncheckedCreateInput });
    if (currentDriverId && status === "ASSIGNED") {
      await tx.vehicleAssignment.create({
        data: {
          vehicleId: vehicle.id,
          driverId: currentDriverId,
          startDate: new Date(),
          status: "ACTIVE",
          notes: "تم إنشاء الربط من شاشة السيارات.",
        },
      });
      await tx.driver.update({ where: { id: currentDriverId }, data: { vehicleId: vehicle.id, vehicleOwnershipType: "company_car" } }).catch(() => null);
    }
    return vehicle;
  });

  await audit(request, "CREATE_VEHICLE", "vehicles", result.id, result);
  return NextResponse.json({ data: result }, { status: 201 });
}

function isNumericField(key: string) {
  return /amount|cost|rent|salary|bonus|deduction|balance|hours|rate|percent|orders|rows|target|riders|days|year|payroll|revenues|expenses|profit/i.test(key);
}

export async function GET(request: Request, context: { params: Promise<{ resource: string }> }) {
  const { resource } = await context.params;
  const config = getResource(resource);
  if (!config) return NextResponse.json({ error: "Unknown resource" }, { status: 404 });

  const role = roleFromHeaders(request.headers);
  if (!canReadResource(role, config.key)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const scope = await getAccessScope(request.headers);

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").toLowerCase().trim();
  const take = Math.min(Number(url.searchParams.get("take") ?? 50), 500);

  const source = delegate(config.delegate);
  const select = safeSelect(config.key, [...config.searchFields, ...config.columns.map((column) => column.key)]);
  const where = scopedWhere(config.key, scope);
  const [rows, total] = await Promise.all([findRows(source, take, select, where), source.count({ where })]);

  const filterableFields = new Set([...config.searchFields, ...config.columns.map((column) => column.key)]);
  const fieldFilters = Array.from(url.searchParams.entries()).filter(
    ([key, value]) => filterableFields.has(key) && value.trim() && !["q", "take"].includes(key),
  );

  const filtered = rows.filter((row) => {
    const record = row as Record<string, unknown>;
    const matchesSearch = q
      ? config.searchFields.some((field) =>
          String(record[field] ?? "")
            .toLowerCase()
            .includes(q),
        )
      : true;

    const matchesFilters = fieldFilters.every(([field, value]) =>
      String(record[field] ?? "")
        .toLowerCase()
        .includes(value.toLowerCase()),
    );

    return matchesSearch && matchesFilters;
  });

  return NextResponse.json({ data: filtered, meta: { count: filtered.length, total, resource: config.key } });
}

export async function POST(request: Request, context: { params: Promise<{ resource: string }> }) {
  const { resource } = await context.params;
  const config = getResource(resource);
  if (!config) return NextResponse.json({ error: "Unknown resource" }, { status: 404 });

  const role = roleFromHeaders(request.headers);
  if (!canWriteResource(role, config.key)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = normalizePayload((await request.json()) as Record<string, unknown>);
  if (config.key === "vehicle-movements") {
    try {
      return await handleVehicleMovementCreate(request, body);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر حفظ حركة السيارة." }, { status: 409 });
    }
  }
  if (config.key === "vehicles") {
    try {
      return await handleVehicleCreate(request, body);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر حفظ السيارة." }, { status: 409 });
    }
  }
  const data = await delegate(config.delegate).create({ data: body });
  await audit(request, "CREATE", config.key, (data as { id?: string })?.id, data);
  return NextResponse.json({ data }, { status: 201 });
}
