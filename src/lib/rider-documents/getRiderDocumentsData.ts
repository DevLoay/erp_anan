import { prisma } from "@/lib/prisma";

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
    .replace(/[\s_./\\-]+/g, "")
    .toUpperCase();
}

function includesText(value: unknown, q: string) {
  return String(value ?? "").toLowerCase().includes(q.toLowerCase());
}

function asDate(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
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
  status: true,
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
  phone?: string | null;
  mobile?: string | null;
  city?: { id?: string | null; nameAr?: string | null; nameEn?: string | null } | null;
  project?: { id?: string | null; name?: string | null; appName?: string | null } | null;
};

type DriverIndexHit = {
  driver: DriverLookupRow;
  matchedBy: string;
};

function buildDriverIndexes(drivers: DriverLookupRow[]) {
  const byId = new Map<string, DriverLookupRow>();
  const byKey = new Map<string, DriverIndexHit>();

  const addKey = (key: unknown, driver: DriverLookupRow, matchedBy: string) => {
    const normalized = normalizeKey(key);
    if (normalized && !byKey.has(normalized)) byKey.set(normalized, { driver, matchedBy });
  };

  for (const driver of drivers) {
    byId.set(driver.id, driver);
    addKey(driver.id, driver, "driverId");
    addKey(driver.internalCode, driver, "internalCode");
    addKey(driver.driverCode, driver, "driverCode");
    addKey(driver.nationalId, driver, "nationalId");
    addKey(driver.phone, driver, "phone");
    addKey(driver.mobile, driver, "mobile");
  }

  return { byId, byKey };
}

function driverDisplayName(driver?: DriverLookupRow | null) {
  if (!driver) return null;
  const name = [driver.actualName, driver.name].filter(Boolean).join(" / ");
  const code = driver.internalCode || driver.driverCode || driver.nationalId || null;
  if (name && code) return `${name} - ${code}`;
  return name || code || null;
}

function findDriverForDocument(doc: any, byId: Map<string, DriverLookupRow>, byKey: Map<string, DriverIndexHit>) {
  if (doc.driverId && byId.has(doc.driverId)) {
    return { driver: byId.get(doc.driverId)!, matchedBy: "driverId" };
  }

  const legacyDriverKey = byKey.get(normalizeKey(doc.driverId));
  if (legacyDriverKey) return legacyDriverKey;

  const documentNumberKey = byKey.get(normalizeKey(doc.documentNumber));
  if (documentNumberKey) return { driver: documentNumberKey.driver, matchedBy: `documentNumber:${documentNumberKey.matchedBy}` };

  return null;
}

function attachDrivers(documentsRaw: any[], drivers: DriverLookupRow[]) {
  const { byId, byKey } = buildDriverIndexes(drivers);

  return documentsRaw.map((doc: any) => {
    const hit = findDriverForDocument(doc, byId, byKey);
    const matchedDriver = hit?.driver || null;
    const displayName = driverDisplayName(matchedDriver);

    return {
      ...doc,
      driver: matchedDriver,
      driverMatchedBy: hit?.matchedBy || null,
      driverDisplayName: displayName || null,
      driverCodeDisplay: matchedDriver?.internalCode || matchedDriver?.driverCode || null,
      driverCityName: matchedDriver?.city?.nameAr || matchedDriver?.city?.nameEn || null,
      driverProjectName: matchedDriver?.project?.name || matchedDriver?.project?.appName || null,
      driverPhoneDisplay: matchedDriver?.phone || matchedDriver?.mobile || null,
      driverLinkStatus: matchedDriver ? (matchedDriver.id === doc.driverId ? "LINKED" : "AUTO_MATCHED") : "UNMATCHED",
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
    doc.driverId,
    doc.driverDisplayName,
    doc.driverCodeDisplay,
    doc.driverCityName,
    doc.driverProjectName,
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
  // relationMode="prisma" means old/imported rows can contain a legacy key in driverId.
  // We load drivers separately and resolve by id/internalCode/driverCode/nationalId/phone.
  const documentsRaw = await prisma.driverDocument.findMany({
    where,
    orderBy: [{ expiryDate: "asc" }, { createdAt: "desc" }],
    take: 1000,
  });

  // Load all drivers, including inactive ones, because old documents can belong to inactive drivers.
  // Excluding inactive drivers was one common reason the delegate name appeared blank.
  const drivers = await prisma.driver.findMany({
    select: driverSelect,
    orderBy: [{ name: "asc" }],
    take: 10000,
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

  const expiringSoon = documents.filter((doc: any) => {
    const expiryDate = asDate(doc.expiryDate);
    return expiryDate && expiryDate >= now && expiryDate <= in30;
  }).length;

  const expired = documents.filter((doc: any) => {
    const expiryDate = asDate(doc.expiryDate);
    return expiryDate && expiryDate < now;
  }).length;

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
      autoMatched: documents.filter((doc: any) => doc.driverLinkStatus === "AUTO_MATCHED").length,
      linkedByDocumentNumber: documents.filter((doc: any) => String(doc.driverMatchedBy || "").startsWith("documentNumber")).length,
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
