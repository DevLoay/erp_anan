const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function normalizeKey(value) {
  const arabicDigits = {
    "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
    "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
  };
  return String(value ?? "")
    .trim()
    .replace(/[٠-٩۰-۹]/g, (digit) => arabicDigits[digit] || digit)
    .replace(/[\s\-_/\\.]+/g, "")
    .toUpperCase();
}

function buildDriverIndexes(drivers) {
  const byId = new Map(drivers.map((driver) => [driver.id, driver]));
  const byKey = new Map();
  const addKey = (key, driver, matchedBy) => {
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

function findDriver(doc, indexes) {
  if (doc.driverId && indexes.byId.has(doc.driverId)) {
    return { driver: indexes.byId.get(doc.driverId), matchedBy: "driverId" };
  }
  const legacy = indexes.byKey.get(normalizeKey(doc.driverId));
  if (legacy) return legacy;
  const byDoc = indexes.byKey.get(normalizeKey(doc.documentNumber));
  if (byDoc) return { driver: byDoc.driver, matchedBy: `documentNumber:${byDoc.matchedBy}` };
  return null;
}

function driverName(driver) {
  if (!driver) return null;
  return [driver.actualName, driver.name, driver.internalCode || driver.driverCode || driver.nationalId].filter(Boolean).join(" / ");
}

async function main() {
  const [documents, drivers] = await Promise.all([
    prisma.driverDocument.findMany({ orderBy: { createdAt: "desc" }, take: 5000 }),
    prisma.driver.findMany({
      select: {
        id: true,
        internalCode: true,
        driverCode: true,
        name: true,
        actualName: true,
        nationalId: true,
        phone: true,
        mobile: true,
        status: true,
        city: { select: { nameAr: true, nameEn: true } },
      },
      take: 10000,
    }),
  ]);

  const indexes = buildDriverIndexes(drivers);
  const results = documents.map((doc) => {
    const hit = findDriver(doc, indexes);
    return {
      id: doc.id,
      driverId: doc.driverId,
      documentType: doc.documentType || doc.type,
      documentNumber: doc.documentNumber,
      matched: Boolean(hit),
      matchedBy: hit?.matchedBy || null,
      matchedDriverId: hit?.driver?.id || null,
      matchedDriverName: driverName(hit?.driver),
      matchedCity: hit?.driver?.city?.nameAr || hit?.driver?.city?.nameEn || null,
      needsRelink: Boolean(hit && hit.driver.id !== doc.driverId),
    };
  });

  const summary = {
    documents: documents.length,
    drivers: drivers.length,
    linkedByDriverId: results.filter((item) => item.matchedBy === "driverId").length,
    autoMatched: results.filter((item) => item.matched && item.matchedBy !== "driverId").length,
    unmatched: results.filter((item) => !item.matched).length,
    needsRelink: results.filter((item) => item.needsRelink).length,
  };

  console.log(JSON.stringify({
    ok: true,
    summary,
    autoMatchedSamples: results.filter((item) => item.needsRelink).slice(0, 20),
    unmatchedSamples: results.filter((item) => !item.matched).slice(0, 20),
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
