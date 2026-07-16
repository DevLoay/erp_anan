/* eslint-disable no-console */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function normalize(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/[^\p{L}\p{N}_-]/gu, "");
}

function isBadHsMakkahCode(value) {
  const code = normalize(value);
  if (!code) return false;
  return code.includes("KEETA") || code.includes("DAMMAM") || code.includes("KETA");
}

async function uniqueDriverCode(preferred, existingId) {
  let base = preferred.slice(0, 80);
  let current = await prisma.driver.findUnique({ where: { internalCode: base }, select: { id: true } });
  if (!current || current.id === existingId) return base;

  for (let i = 1; i <= 9999; i += 1) {
    const candidate = `${base}-${i}`.slice(0, 80);
    current = await prisma.driver.findUnique({ where: { internalCode: candidate }, select: { id: true } });
    if (!current || current.id === existingId) return candidate;
  }

  return `${base}-${Date.now().toString(36)}`.slice(0, 80);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const hunger = await prisma.application.findFirst({
    where: {
      OR: [
        { code: { contains: "HUNGER", mode: "insensitive" } },
        { name: { contains: "Hunger", mode: "insensitive" } },
        { name: { contains: "هنجر", mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, code: true },
  });

  const makkah = await prisma.city.findFirst({
    where: {
      OR: [
        { nameAr: { contains: "مكة", mode: "insensitive" } },
        { nameEn: { contains: "Makkah", mode: "insensitive" } },
        { nameEn: { contains: "Mecca", mode: "insensitive" } },
      ],
    },
    select: { id: true, nameAr: true, nameEn: true },
  });

  if (!hunger || !makkah) {
    console.log("Missing HungerStation application or Makkah city.", { hunger, makkah });
    return;
  }

  const project = await prisma.applicationProject.findFirst({
    where: { applicationId: hunger.id, cityId: makkah.id },
    select: { id: true, code: true, name: true },
  });

  const drivers = await prisma.driver.findMany({
    where: {
      cityId: makkah.id,
      applicationAccounts: { some: { applicationId: hunger.id } },
    },
    select: {
      id: true,
      internalCode: true,
      driverCode: true,
      name: true,
      actualName: true,
      supervisorId: true,
      supervisor: { select: { cityId: true, name: true } },
      applicationAccounts: {
        where: { applicationId: hunger.id },
        select: { id: true, appUserId: true, appUsername: true, applicationProjectId: true, cityId: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  let scanned = 0;
  let fixedCodes = 0;
  let clearedSupervisors = 0;
  let fixedAccounts = 0;

  for (const driver of drivers) {
    scanned += 1;
    const firstAccount = driver.applicationAccounts[0];
    const seed = normalize(firstAccount?.appUserId || driver.mobile || driver.id.slice(-6));
    const nextCode = await uniqueDriverCode(`HS-MAKKAH-${seed || String(scanned).padStart(3, "0")}`, driver.id);

    const update = {};
    if (isBadHsMakkahCode(driver.internalCode) || isBadHsMakkahCode(driver.driverCode)) {
      update.internalCode = nextCode;
      update.driverCode = nextCode;
      update.needsReview = true;
      update.source = "CLEANUP_HS_MAKKAH_CODE";
      fixedCodes += 1;
    }

    if (driver.supervisorId && driver.supervisor?.cityId && driver.supervisor.cityId !== makkah.id) {
      update.supervisorId = null;
      update.needsReview = true;
      clearedSupervisors += 1;
    }

    if (Object.keys(update).length) {
      console.log(`${dryRun ? "[dry-run] " : ""}Driver`, driver.name, driver.internalCode, "=>", update);
      if (!dryRun) await prisma.driver.update({ where: { id: driver.id }, data: update });
    }

    for (const account of driver.applicationAccounts) {
      const accountUpdate = {};
      if (account.cityId !== makkah.id) accountUpdate.cityId = makkah.id;
      if (project && account.applicationProjectId !== project.id) accountUpdate.applicationProjectId = project.id;

      if (Object.keys(accountUpdate).length) {
        fixedAccounts += 1;
        console.log(`${dryRun ? "[dry-run] " : ""}Account`, account.appUserId, "=>", accountUpdate);
        if (!dryRun) await prisma.applicationAccount.update({ where: { id: account.id }, data: accountUpdate });
      }
    }
  }

  console.log({
    dryRun,
    hunger,
    makkah,
    project,
    scanned,
    fixedCodes,
    clearedSupervisors,
    fixedAccounts,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
