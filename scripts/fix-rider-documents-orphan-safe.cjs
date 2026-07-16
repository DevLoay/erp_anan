const fs = require('fs');
const path = require('path');

const root = process.cwd();
const dataPath = path.join(root, 'src', 'lib', 'rider-documents', 'getRiderDocumentsData.ts');
const listRoutePath = path.join(root, 'src', 'app', 'api', 'rider-documents', 'route.ts');
const itemRoutePath = path.join(root, 'src', 'app', 'api', 'rider-documents', '[id]', 'route.ts');
const clientPath = path.join(root, 'src', 'components', 'rider-documents', 'RiderDocumentsClient.tsx');

function ensureDir(file) { fs.mkdirSync(path.dirname(file), { recursive: true }); }
function read(file) { if (!fs.existsSync(file)) return ''; return fs.readFileSync(file, 'utf8'); }
function write(file, content) { ensureDir(file); fs.writeFileSync(file, content, 'utf8'); console.log(`✅ updated ${path.relative(root, file)}`); }
function writeIfChanged(file, next) { const before = read(file); if (before !== next) write(file, next); else console.log(`ℹ️ no change ${path.relative(root, file)}`); }

console.log('\nRIDER DOCUMENTS ORPHAN-SAFE FIX');
console.log(`Project root: ${root}`);

const robustData = `import { prisma } from "@/lib/prisma";

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
  name: true,
  actualName: true,
  phone: true,
  city: { select: { id: true, nameAr: true, nameEn: true } },
  project: { select: { id: true, name: true, appName: true, status: true } },
  supervisor: { select: { id: true, name: true } },
} as const;

export async function getRiderDocumentsData(filters: RiderDocumentFilters) {
  const and: any[] = [];
  if (filters.status) and.push({ status: filters.status });
  if (filters.verificationStatus) and.push({ verificationStatus: filters.verificationStatus });
  if (filters.type) and.push({ OR: [{ type: filters.type }, { documentType: filters.type }] });
  if (filters.driverId) and.push({ driverId: filters.driverId });
  if (filters.expiry) and.push(expiryWhere(filters.expiry));
  if (filters.q) {
    and.push({
      OR: [
        { type: { contains: filters.q, mode: "insensitive" } },
        { documentType: { contains: filters.q, mode: "insensitive" } },
        { documentNumber: { contains: filters.q, mode: "insensitive" } },
        { notes: { contains: filters.q, mode: "insensitive" } },
        { driver: { name: { contains: filters.q, mode: "insensitive" } } },
        { driver: { actualName: { contains: filters.q, mode: "insensitive" } } },
        { driver: { internalCode: { contains: filters.q, mode: "insensitive" } } },
      ],
    });
  }

  const where = and.length ? { AND: and } : {};

  // Important: do NOT include the required Driver relation directly here.
  // Some old/imported DriverDocument rows can be orphaned in the database.
  // A required include would crash Prisma with: Field driver is required to return data, got null instead.
  const documentsRaw = await prisma.driverDocument.findMany({
    where,
    orderBy: [{ expiryDate: "asc" }, { createdAt: "desc" }],
    take: 500,
  });

  const documentDriverIds = [...new Set(documentsRaw.map((doc: any) => doc.driverId).filter(Boolean))];

  const [documentDrivers, drivers, counts] = await Promise.all([
    documentDriverIds.length
      ? prisma.driver.findMany({
          where: { id: { in: documentDriverIds } },
          select: driverSelect,
        })
      : Promise.resolve([]),
    prisma.driver.findMany({
      where: { status: { not: "INACTIVE" } },
      select: {
        id: true,
        internalCode: true,
        name: true,
        actualName: true,
        city: { select: { nameAr: true, nameEn: true } },
      },
      orderBy: [{ name: "asc" }],
      take: 1000,
    }),
    prisma.driverDocument.groupBy({
      by: ["status"],
      _count: { _all: true },
    }).catch(() => []),
  ]);

  const driversById = new Map((documentDrivers as any[]).map((driver) => [driver.id, driver]));
  const documents = documentsRaw.map((doc: any) => ({
    ...doc,
    driver: doc.driverId ? driversById.get(doc.driverId) ?? null : null,
  }));

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
    },
    documentTypes: [
      { value: "iqama", label: "إقامة" },
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

writeIfChanged(dataPath, robustData);

let listRoute = read(listRoutePath);
if (listRoute) {
  const before = listRoute;
  listRoute = listRoute.replace(
    /const documents = await prisma\.driverDocument\.findMany\(\{[\s\S]*?\n  return NextResponse\.json\(\{ documents: serialize\(documents\) \}\);\n\}/,
    `const documentsRaw = await prisma.driverDocument.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  const driverIds = [...new Set(documentsRaw.map((doc: any) => doc.driverId).filter(Boolean))];
  const drivers = driverIds.length
    ? await prisma.driver.findMany({
        where: { id: { in: driverIds } },
        select: { id: true, name: true, actualName: true, internalCode: true },
      })
    : [];
  const driversById = new Map(drivers.map((driver) => [driver.id, driver]));
  const documents = documentsRaw.map((doc: any) => ({ ...doc, driver: doc.driverId ? driversById.get(doc.driverId) ?? null : null }));
  return NextResponse.json({ documents: serialize(documents) });
}`
  );
  writeIfChanged(listRoutePath, listRoute);
  if (before === listRoute) console.log('⚠️ list API GET pattern was not replaced; page fix is still applied.');
}

let itemRoute = read(itemRoutePath);
if (itemRoute) {
  const before = itemRoute;
  itemRoute = itemRoute.replace(
    /const document = await prisma\.driverDocument\.findUnique\(\{\s*where: \{ id: params\.id \},\s*include: \{ driver: \{ select: \{ id: true, name: true, actualName: true, internalCode: true \} \} \},\s*\}\);\s*if \(!document\) return NextResponse\.json\(\{ error: "Not found" \}, \{ status: 404 \}\);\s*return NextResponse\.json\(\{ document: serialize\(document\) \}\);/,
    `const documentRaw = await prisma.driverDocument.findUnique({ where: { id: params.id } });
  if (!documentRaw) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const driver = documentRaw.driverId
    ? await prisma.driver.findUnique({
        where: { id: documentRaw.driverId },
        select: { id: true, name: true, actualName: true, internalCode: true },
      })
    : null;
  return NextResponse.json({ document: serialize({ ...documentRaw, driver }) });`
  );
  writeIfChanged(itemRoutePath, itemRoute);
  if (before === itemRoute) console.log('⚠️ item API GET pattern was not replaced; page fix is still applied.');
}

let client = read(clientPath);
if (client) {
  client = client.replace(/row\.driver\?\.project\?\.nameAr\s*\|\|\s*row\.driver\?\.project\?\.name/g, 'row.driver?.project?.name || row.driver?.project?.appName');
  client = client.replace(/\{row\.driver\?\.project\?\.nameAr\s*\|\|\s*row\.driver\?\.project\?\.name\s*\|\|\s*"—"\}/g, '{row.driver?.project?.name || row.driver?.project?.appName || "—"}');
  writeIfChanged(clientPath, client);
}

console.log('\n✅ Done. Re-run:');
console.log('node scripts/check-rider-documents-module.cjs');
console.log('node scripts/smoke-rider-documents-crud.cjs');
