const fs = require('fs');
const path = require('path');

const root = process.cwd();
const dataPath = path.join(root, 'src', 'lib', 'rider-documents', 'getRiderDocumentsData.ts');
const listRoutePath = path.join(root, 'src', 'app', 'api', 'rider-documents', 'route.ts');
const itemRoutePath = path.join(root, 'src', 'app', 'api', 'rider-documents', '[id]', 'route.ts');
const clientPath = path.join(root, 'src', 'components', 'rider-documents', 'RiderDocumentsClient.tsx');

function ensureDir(file) { fs.mkdirSync(path.dirname(file), { recursive: true }); }
function read(file) { return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''; }
function write(file, content) { ensureDir(file); fs.writeFileSync(file, content, 'utf8'); console.log(`✅ updated ${path.relative(root, file)}`); }
function writeIfChanged(file, next) {
  const before = read(file);
  if (before !== next) write(file, next);
  else console.log(`ℹ️ no change ${path.relative(root, file)}`);
}

console.log('\nRIDER DOCUMENTS DRIVER LINKING FIX');
console.log(`Project root: ${root}`);

const enhancedData = `import { prisma } from "@/lib/prisma";

export type RiderDocumentFilters = {
  q: string;
  status: string;
  verificationStatus: string;
  type: string;
  driverId: string;
  expiry: string;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function toJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
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

export function resolveRiderDocumentFilters(params: Record<string, string | string[] | undefined> = {}): RiderDocumentFilters {
  return {
    q: clean(first(params.q)),
    status: clean(first(params.status)),
    verificationStatus: clean(first(params.verificationStatus)),
    type: clean(first(params.type)),
    driverId: clean(first(params.driverId)),
    expiry: clean(first(params.expiry)),
  };
}

function expiryWhere(expiry: string) {
  const now = new Date();
  const in30 = new Date(now);
  in30.setDate(in30.getDate() + 30);
  const in60 = new Date(now);
  in60.setDate(in60.getDate() + 60);

  if (expiry === "expired") return { expiryDate: { lt: now } };
  if (expiry === "30") return { expiryDate: { gte: now, lte: in30 } };
  if (expiry === "60") return { expiryDate: { gte: now, lte: in60 } };
  if (expiry === "missing") return { expiryDate: null };
  return {};
}

const driverSelect = {
  id: true,
  internalCode: true,
  driverCode: true,
  name: true,
  actualName: true,
  phone: true,
  mobile: true,
  nationalId: true,
  city: { select: { id: true, nameAr: true, nameEn: true } },
  project: { select: { id: true, name: true, appName: true, status: true } },
  supervisor: { select: { id: true, name: true } },
} as const;

type DriverLookupRow = {
  id: string;
  internalCode?: string | null;
  driverCode?: string | null;
  nationalId?: string | null;
  name?: string | null;
  actualName?: string | null;
};

function buildDriverIndexes(drivers: DriverLookupRow[]) {
  const byId = new Map<string, DriverLookupRow>();
  const byKey = new Map<string, DriverLookupRow>();

  const addKey = (key: unknown, driver: DriverLookupRow) => {
    const normalized = normalizeKey(key);
    if (normalized && !byKey.has(normalized)) byKey.set(normalized, driver);
  };

  for (const driver of drivers) {
    byId.set(driver.id, driver);
    addKey(driver.id, driver);
    addKey(driver.internalCode, driver);
    addKey(driver.driverCode, driver);
    addKey(driver.nationalId, driver);
  }

  return { byId, byKey };
}

function attachDrivers(documentsRaw: any[], drivers: any[]) {
  const { byId, byKey } = buildDriverIndexes(drivers);

  return documentsRaw.map((doc: any) => {
    const matchedDriver =
      (doc.driverId ? byId.get(doc.driverId) : null) ||
      byKey.get(normalizeKey(doc.driverId)) ||
      byKey.get(normalizeKey(doc.documentNumber)) ||
      null;

    return {
      ...doc,
      driver: matchedDriver,
      driverMatchedBy: matchedDriver
        ? matchedDriver.id === doc.driverId
          ? "driverId"
          : normalizeKey(doc.documentNumber) && byKey.get(normalizeKey(doc.documentNumber))?.id === matchedDriver.id
            ? "documentNumber"
            : "driverCode"
        : null,
    };
  });
}

function matchesSearch(doc: any, q: string) {
  if (!q) return true;
  const driver = doc.driver || {};
  return [
    doc.type,
    doc.documentType,
    doc.documentNumber,
    doc.notes,
    driver.name,
    driver.actualName,
    driver.internalCode,
    driver.driverCode,
    driver.nationalId,
    driver.phone,
    driver.mobile,
    driver.city?.nameAr,
    driver.city?.nameEn,
    driver.project?.name,
    driver.project?.appName,
  ].some((value) => includesText(value, q));
}

export async function getRiderDocumentsData(filters: RiderDocumentFilters) {
  const and: any[] = [];
  if (filters.status) and.push({ status: filters.status });
  if (filters.verificationStatus) and.push({ verificationStatus: filters.verificationStatus });
  if (filters.type) and.push({ OR: [{ type: filters.type }, { documentType: filters.type }] });
  if (filters.driverId) and.push({ driverId: filters.driverId });
  if (filters.expiry) and.push(expiryWhere(filters.expiry));

  const where = and.length ? { AND: and } : {};

  // Important: do NOT include the required Driver relation directly here.
  // Some old/imported DriverDocument rows can be orphaned or can store a legacy key
  // instead of the current Driver.id. We enrich the rows manually below.
  const documentsRaw = await prisma.driverDocument.findMany({
    where,
    orderBy: [{ expiryDate: "asc" }, { createdAt: "desc" }],
    take: 500,
  });

  // Load drivers broadly, then match documents by:
  // 1) real driverId, 2) legacy driverId/internal code, 3) documentNumber vs nationalId.
  // This fixes imported Iqama/Passport rows showing blank delegate/city even when
  // the delegate exists in the drivers table.
  const drivers = await prisma.driver.findMany({
    where: { status: { not: "INACTIVE" } },
    select: driverSelect,
    orderBy: [{ name: "asc" }],
    take: 3000,
  });

  const [counts] = await Promise.all([
    prisma.driverDocument.groupBy({
      by: ["status"],
      _count: { _all: true },
    }).catch(() => []),
  ]);

  const documentsWithDrivers = attachDrivers(documentsRaw, drivers);
  const documents = filters.q ? documentsWithDrivers.filter((doc: any) => matchesSearch(doc, filters.q)) : documentsWithDrivers;

  const now = new Date();
  const in30 = new Date(now);
  in30.setDate(in30.getDate() + 30);

  const expiringSoon = documents.filter((doc: any) => doc.expiryDate && doc.expiryDate >= now && doc.expiryDate <= in30).length;
  const expired = documents.filter((doc: any) => doc.expiryDate && doc.expiryDate < now).length;
  const pending = documents.filter((doc: any) => doc.status === "PENDING" || doc.verificationStatus === "pending").length;

  return toJson({
    filters,
    documents,
    drivers,
    summary: {
      total: documents.length,
      expiringSoon,
      expired,
      pending,
      approved: documents.filter((doc: any) => doc.status === "APPROVED" || doc.verificationStatus === "verified").length,
      byStatus: counts,
      orphaned: documents.filter((doc: any) => doc.driverId && !doc.driver).length,
      linkedByDocumentNumber: documents.filter((doc: any) => doc.driverMatchedBy === "documentNumber").length,
    },
    documentTypes: [
      { value: "Iqama", label: "إقامة" },
      { value: "iqama", label: "إقامة" },
      { value: "Passport", label: "جواز سفر" },
      { value: "passport", label: "جواز سفر" },
      { value: "license", label: "رخصة قيادة" },
      { value: "contract", label: "عقد" },
      { value: "insurance", label: "تأمين" },
      { value: "medical", label: "كشف طبي" },
      { value: "other", label: "أخرى" },
    ],
  });
}

export type RiderDocumentsData = Awaited<ReturnType<typeof getRiderDocumentsData>>;
`;

writeIfChanged(dataPath, enhancedData);

const enhancedListRoute = `import { NextResponse } from "next/server";
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
    .replace(/[\\s\\-_/\\\\.]+/g, "")
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

function attachDrivers(documentsRaw: any[], drivers: any[]) {
  const byId = new Map(drivers.map((driver: any) => [driver.id, driver]));
  const byKey = new Map<string, any>();
  const addKey = (key: unknown, driver: any) => {
    const normalized = normalizeKey(key);
    if (normalized && !byKey.has(normalized)) byKey.set(normalized, driver);
  };

  for (const driver of drivers) {
    addKey(driver.id, driver);
    addKey(driver.internalCode, driver);
    addKey(driver.driverCode, driver);
    addKey(driver.nationalId, driver);
  }

  return documentsRaw.map((doc: any) => {
    const driver =
      (doc.driverId ? byId.get(doc.driverId) : null) ||
      byKey.get(normalizeKey(doc.driverId)) ||
      byKey.get(normalizeKey(doc.documentNumber)) ||
      null;
    return { ...doc, driver };
  });
}

function matchesSearch(doc: any, q: string) {
  if (!q) return true;
  const driver = doc.driver || {};
  return [
    doc.type, doc.documentType, doc.documentNumber, doc.notes,
    driver.name, driver.actualName, driver.internalCode, driver.driverCode, driver.nationalId,
    driver.city?.nameAr, driver.city?.nameEn, driver.project?.name, driver.project?.appName,
  ].some((value) => includesText(value, q));
}

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
    take: 500,
  });

  const drivers = await prisma.driver.findMany({
    where: { status: { not: "INACTIVE" } },
    select: {
      id: true,
      internalCode: true,
      driverCode: true,
      nationalId: true,
      name: true,
      actualName: true,
      city: { select: { id: true, nameAr: true, nameEn: true } },
      project: { select: { id: true, name: true, appName: true } },
    },
    take: 3000,
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
    include: { driver: { select: { id: true, name: true, actualName: true, internalCode: true } } },
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
`;

writeIfChanged(listRoutePath, enhancedListRoute);

let itemRoute = read(itemRoutePath);
if (itemRoute) {
  itemRoute = itemRoute.replace(/select: \{ id: true, name: true, actualName: true, internalCode: true \}/g, 'select: { id: true, name: true, actualName: true, internalCode: true, driverCode: true, nationalId: true }');
  writeIfChanged(itemRoutePath, itemRoute);
}

let client = read(clientPath);
if (client) {
  client = client.replace(/row\.driver\?\.project\?\.nameAr\s*\|\|\s*row\.driver\?\.project\?\.name/g, 'row.driver?.project?.name || row.driver?.project?.appName');
  client = client.replace(/\{row\.driver\?\.project\?\.nameAr\s*\|\|\s*row\.driver\?\.project\?\.name\s*\|\|\s*"—"\}/g, '{row.driver?.project?.name || row.driver?.project?.appName || "—"}');
  // Add a small hint for linked imported rows without changing layout if the exact spot exists.
  if (!client.includes('driverMatchedBy === "documentNumber"')) {
    client = client.replace(
      /<div className="text-xs font-bold text-slate-400">\{row\.driver\?\.phone \|\| "—"\}<\/div>/,
      '<div className="text-xs font-bold text-slate-400">{row.driver?.phone || "—"}</div>\n                    {row.driverMatchedBy === "documentNumber" ? <div className="text-xs font-black text-emerald-600">تم الربط برقم المستند</div> : null}'
    );
  }
  writeIfChanged(clientPath, client);
}

const doc = `# Rider Documents Driver Linking Fix

This patch fixes imported rider documents that show blank delegate/city/project even though the rider exists.

## Cause
Old/imported DriverDocument rows may have a stale driverId or may not be linked to the current Driver.id. The document number usually matches Driver.nationalId/internalCode/driverCode, so the page now enriches rows manually instead of relying only on Prisma's required relation include.

## Verification
Run:

\`\`\`powershell
node scripts/check-rider-documents-module.cjs
node scripts/smoke-rider-documents-crud.cjs
\`\`\`

Then open /rider-documents and confirm delegate/city/project columns are populated for matched rows.
`;
writeIfChanged(path.join(root, 'docs', 'RIDER_DOCUMENTS_DRIVER_LINKING_FIX.md'), doc);

console.log('\n✅ Done. Clear Next cache, restart dev server, then open /rider-documents.');
console.log('Run: node scripts/check-rider-documents-module.cjs && node scripts/smoke-rider-documents-crud.cjs');
