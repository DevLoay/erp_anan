import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canReadResource, canWriteResource, roleFromHeaders } from "@/lib/permissions";

function text(value: unknown) {
  return String(value ?? "").trim();
}

function nullableText(value: unknown) {
  const raw = text(value);
  return raw || null;
}

function parseDate(value: unknown) {
  const raw = text(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function recordStatus(value: unknown) {
  const raw = text(value).toUpperCase();
  if (["ACTIVE", "INACTIVE", "PENDING", "APPROVED", "REJECTED", "LOCKED", "CANCELLED", "DEDUCTED", "PARTIALLY_DEDUCTED"].includes(raw)) return raw;
  return "PENDING";
}

function serialize(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function normalizeKey(value: unknown) {
  const arabicDigits: Record<string, string> = {
    "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
    "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
  };
  return String(value ?? "")
    .trim()
    .replace(/[٠-٩۰-۹]/g, (digit) => arabicDigits[digit] || digit)
    .replace(/[\s\-_/\\.]+/g, "")
    .toUpperCase();
}

function includesText(value: unknown, q: string) {
  return String(value ?? "").toLowerCase().includes(q.toLowerCase());
}

async function canRead(request: Request) {
  const role = roleFromHeaders(request.headers);
  return canReadResource(role, "driver-documents") || canReadResource(role, "drivers");
}

async function canWrite(request: Request) {
  const role = roleFromHeaders(request.headers);
  return canWriteResource(role, "driver-documents") || canWriteResource(role, "drivers");
}

function driverDisplayName(driver?: any | null) {
  if (!driver) return null;
  const name = [driver.actualName, driver.name].filter(Boolean).join(" / ");
  const code = driver.internalCode || driver.driverCode || driver.nationalId || null;
  if (name && code) return `${name} - ${code}`;
  return name || code || null;
}

function buildDriverIndexes(drivers: any[]) {
  const byId = new Map(drivers.map((driver: any) => [driver.id, driver]));
  const byKey = new Map<string, { driver: any; matchedBy: string }>();
  const addKey = (key: unknown, driver: any, matchedBy: string) => {
    const normalized = normalizeKey(key);
    if (normalized && !byKey.has(normalized)) byKey.set(normalized, { driver, matchedBy });
  };

  for (const driver of drivers) {
    addKey(driver.id, driver, "driverId");
    addKey(driver.internalCode, driver, "internalCode");
    addKey(driver.driverCode, driver, "driverCode");
    addKey(driver.nationalId, driver, "nationalId");
    addKey(driver.phone, driver, "phone");
    addKey(driver.mobile, driver, "mobile");
  }

  return { byId, byKey };
}

function attachDrivers(documentsRaw: any[], drivers: any[]) {
  const { byId, byKey } = buildDriverIndexes(drivers);

  return documentsRaw.map((doc: any) => {
    let hit: { driver: any; matchedBy: string } | null = null;
    if (doc.driverId && byId.has(doc.driverId)) {
      hit = { driver: byId.get(doc.driverId), matchedBy: "driverId" };
    } else {
      hit = byKey.get(normalizeKey(doc.driverId)) || null;
      if (!hit) {
        const documentNumberHit = byKey.get(normalizeKey(doc.documentNumber));
        if (documentNumberHit) hit = { driver: documentNumberHit.driver, matchedBy: `documentNumber:${documentNumberHit.matchedBy}` };
      }
    }

    const driver = hit?.driver || null;
    return {
      ...doc,
      driver,
      driverMatchedBy: hit?.matchedBy || null,
      driverDisplayName: driverDisplayName(driver),
      driverCodeDisplay: driver?.internalCode || driver?.driverCode || null,
      driverCityName: driver?.city?.nameAr || driver?.city?.nameEn || null,
      driverProjectName: driver?.project?.name || driver?.project?.appName || null,
      driverPhoneDisplay: driver?.phone || driver?.mobile || null,
      driverLinkStatus: driver ? (driver.id === doc.driverId ? "LINKED" : "AUTO_MATCHED") : "UNMATCHED",
    };
  });
}

function matchesSearch(doc: any, q: string) {
  if (!q) return true;
  const driver = doc.driver || {};
  return [
    doc.type, doc.documentType, doc.documentNumber, doc.notes, doc.driverId,
    doc.driverDisplayName, doc.driverCodeDisplay, doc.driverCityName, doc.driverProjectName,
    driver.name, driver.actualName, driver.internalCode, driver.driverCode, driver.nationalId,
    driver.phone, driver.mobile, driver.city?.nameAr, driver.city?.nameEn, driver.project?.name, driver.project?.appName,
  ].some((value) => includesText(value, q));
}

const driverSelect = {
  id: true,
  internalCode: true,
  driverCode: true,
  nationalId: true,
  name: true,
  actualName: true,
  phone: true,
  mobile: true,
  status: true,
  city: { select: { id: true, nameAr: true, nameEn: true } },
  project: { select: { id: true, name: true, appName: true } },
} as const;

export async function GET(request: Request) {
  if (!(await canRead(request))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const url = new URL(request.url);
  const q = text(url.searchParams.get("q"));
  const status = text(url.searchParams.get("status"));
  const driverId = text(url.searchParams.get("driverId"));
  const where: any = {};
  if (status) where.status = status;
  if (driverId) where.driverId = driverId;

  const documentsRaw = await prisma.driverDocument.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 1000,
  });

  const drivers = await prisma.driver.findMany({
    select: driverSelect,
    orderBy: [{ name: "asc" }],
    take: 10000,
  });

  const documentsWithDrivers = attachDrivers(documentsRaw, drivers);
  const documents = q ? documentsWithDrivers.filter((doc: any) => matchesSearch(doc, q)) : documentsWithDrivers;

  return NextResponse.json({ documents: serialize(documents) });
}

export async function POST(request: Request) {
  if (!(await canWrite(request))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const driverId = text(body.driverId);
  const type = text(body.type) || text(body.documentType) || "other";
  if (!driverId) return NextResponse.json({ error: "المندوب مطلوب." }, { status: 400 });
  const driver = await prisma.driver.findUnique({ where: { id: driverId }, select: { id: true } });
  if (!driver) return NextResponse.json({ error: "المندوب غير موجود." }, { status: 404 });

  const document = await prisma.driverDocument.create({
    data: {
      driverId,
      type,
      documentType: nullableText(body.documentType) || type,
      documentNumber: nullableText(body.documentNumber),
      issueDate: parseDate(body.issueDate),
      expiryDate: parseDate(body.expiryDate),
      status: recordStatus(body.status) as any,
      verificationStatus: text(body.verificationStatus) || "pending",
      fileUrl: nullableText(body.fileUrl),
      notes: nullableText(body.notes),
    },
    include: {
      driver: {
        select: {
          id: true,
          name: true,
          actualName: true,
          internalCode: true,
          driverCode: true,
          nationalId: true,
          phone: true,
          mobile: true,
          city: { select: { id: true, nameAr: true, nameEn: true } },
          project: { select: { id: true, name: true, appName: true } },
        },
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      user: request.headers.get("x-user-email") || undefined,
      action: "CREATE_DRIVER_DOCUMENT",
      entityType: "DriverDocument",
      entityId: document.id,
      newValue: serialize(document),
    },
  }).catch(() => null);

  return NextResponse.json({ document: serialize(document) }, { status: 201 });
}
