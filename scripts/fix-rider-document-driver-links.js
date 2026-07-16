const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const apply = process.argv.includes("--apply");
const dryRun = process.argv.includes("--dry-run") || !apply;

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
  if (doc.driverId && indexes.byId.has(doc.driverId)) return null;
  const legacy = indexes.byKey.get(normalizeKey(doc.driverId));
  if (legacy) return legacy;
  const byDoc = indexes.byKey.get(normalizeKey(doc.documentNumber));
  if (byDoc) return { driver: byDoc.driver, matchedBy: `documentNumber:${byDoc.matchedBy}` };
  return null;
}

async function main() {
  const [documents, drivers] = await Promise.all([
    prisma.driverDocument.findMany({ orderBy: { createdAt: "desc" }, take: 5000 }),
    prisma.driver.findMany({
      select: { id: true, internalCode: true, driverCode: true, name: true, actualName: true, nationalId: true, phone: true, mobile: true },
      take: 10000,
    }),
  ]);

  const indexes = buildDriverIndexes(drivers);
  const candidates = documents.map((doc) => ({ doc, hit: findDriver(doc, indexes) })).filter((item) => item.hit && item.hit.driver.id !== item.doc.driverId);

  if (dryRun) {
    console.log(JSON.stringify({
      ok: true,
      mode: "dry-run",
      message: "لم يتم تعديل قاعدة البيانات. شغل --apply بعد المراجعة لو النتائج صحيحة.",
      candidates: candidates.length,
      samples: candidates.slice(0, 30).map(({ doc, hit }) => ({
        documentId: doc.id,
        oldDriverId: doc.driverId,
        newDriverId: hit.driver.id,
        matchedBy: hit.matchedBy,
        driverName: [hit.driver.actualName, hit.driver.name, hit.driver.internalCode || hit.driver.driverCode].filter(Boolean).join(" / "),
        documentNumber: doc.documentNumber,
        documentType: doc.documentType || doc.type,
      })),
    }, null, 2));
    return;
  }

  let updated = 0;
  for (const { doc, hit } of candidates) {
    await prisma.driverDocument.update({ where: { id: doc.id }, data: { driverId: hit.driver.id } });
    updated += 1;
  }

  console.log(JSON.stringify({ ok: true, mode: "apply", updated }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
