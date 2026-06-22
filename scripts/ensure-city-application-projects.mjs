import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient, RecordStatus } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const reportPath = path.resolve(__dirname, "..", "CITY_PROJECTS_CLEANUP_REPORT.md");

const approvedCities = [
  { key: "abha", ar: "أبها", en: "Abha", code: "ABHA" },
  { key: "aflaj", ar: "الأفلاج", en: "Aflaj", code: "AFLAJ" },
  { key: "ahsa", ar: "الإحساء", en: "Al Ahsa", code: "AHSA", aliases: ["الاحساء", "Al Ahsa", "AHS"] },
  { key: "dammam", ar: "الدمام", en: "Dammam", code: "DAMMAM" },
  { key: "riyadh", ar: "الرياض", en: "Riyadh", code: "RIYADH" },
  { key: "taif", ar: "الطائف", en: "Taif", code: "TAIF" },
  { key: "madinah", ar: "المدينة المنورة", en: "Madinah", code: "MADINAH", aliases: ["Medina", "Madinah"] },
  { key: "jeddah", ar: "جدة", en: "Jeddah", code: "JEDDAH" },
  { key: "makkah", ar: "مكة", en: "Makkah", code: "MAKKAH", aliases: ["Makkah", "Mecca"] },
];

const applicationDefinitions = [
  { key: "keeta", code: "KEETA", name: "Keeta" },
  { key: "hungerstation", code: "HUNGERSTATION", name: "HungerStation" },
];

function normalizeArabic(value) {
  return String(value ?? "")
    .trim()
    .replace(/[إأآا]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function hasMojibake(value) {
  const text = String(value ?? "");
  return /ط§|ظ„|ظٹ|ط¶|ط±|ط©|ط£|ط­|ط³|ط¹|ط؛|ظ…|ظƒ|ظ†/.test(text);
}

function cityKey(city) {
  const text = `${city.nameAr ?? ""} ${city.nameEn ?? ""}`;
  for (const approved of approvedCities) {
    const haystack = [approved.ar, approved.en, approved.code, ...(approved.aliases ?? [])].map(normalizeArabic);
    if (haystack.some((item) => item && normalizeArabic(text).includes(item))) return approved.key;
    if (String(city.nameEn ?? "").trim().toLowerCase() === approved.en.toLowerCase()) return approved.key;
    if (String(city.nameEn ?? "").trim().toUpperCase() === approved.code) return approved.key;
  }
  return "";
}

function appKey(application) {
  const text = `${application.code ?? ""} ${application.name ?? ""}`.toLowerCase().replace(/\s+/g, "");
  if (text.includes("keeta") || text.includes("kita") || text.includes("كيتا")) return "keeta";
  if (text.includes("hungerstation") || text.includes("hunger") || text.includes("هنجر") || text.includes("هنقر")) return "hungerstation";
  return "";
}

function projectName(applicationName, cityName) {
  return `${applicationName} - ${cityName}`;
}

async function linkedCounts(cityId) {
  const [
    drivers,
    legacyProjects,
    applicationProjects,
    supervisors,
    vehicles,
    accounts,
    payrollRuns,
    ranks,
    invoices,
    performance,
    finance,
    reports,
    batches,
  ] = await Promise.all([
    prisma.driver.count({ where: { cityId } }),
    prisma.project.count({ where: { cityId } }),
    prisma.applicationProject.count({ where: { cityId } }),
    prisma.supervisor.count({ where: { cityId } }),
    prisma.vehicle.count({ where: { cityId } }),
    prisma.applicationAccount.count({ where: { cityId } }),
    prisma.payrollRun.count({ where: { cityId } }),
    prisma.keetaRankRecord.count({ where: { cityId } }),
    prisma.keetaInvoiceRecord.count({ where: { cityId } }),
    prisma.keetaPerformanceRecord.count({ where: { cityId } }),
    prisma.financeEntry.count({ where: { cityId } }),
    prisma.dailyReport.count({ where: { cityId } }),
    prisma.applicationImportBatch.count({ where: { cityId } }),
  ]);
  return { drivers, legacyProjects, applicationProjects, supervisors, vehicles, accounts, payrollRuns, ranks, invoices, performance, finance, reports, batches };
}

async function migrateCityReferences(fromCityId, toCityId) {
  const operations = [
    prisma.driver.updateMany({ where: { cityId: fromCityId }, data: { cityId: toCityId } }),
    prisma.project.updateMany({ where: { cityId: fromCityId }, data: { cityId: toCityId } }),
    prisma.applicationProject.updateMany({ where: { cityId: fromCityId }, data: { cityId: toCityId } }),
    prisma.supervisor.updateMany({ where: { cityId: fromCityId }, data: { cityId: toCityId } }),
    prisma.vehicle.updateMany({ where: { cityId: fromCityId }, data: { cityId: toCityId } }),
    prisma.applicationAccount.updateMany({ where: { cityId: fromCityId }, data: { cityId: toCityId } }),
    prisma.payrollRun.updateMany({ where: { cityId: fromCityId }, data: { cityId: toCityId } }),
    prisma.keetaRankRecord.updateMany({ where: { cityId: fromCityId }, data: { cityId: toCityId } }),
    prisma.keetaInvoiceRecord.updateMany({ where: { cityId: fromCityId }, data: { cityId: toCityId } }),
    prisma.keetaPerformanceRecord.updateMany({ where: { cityId: fromCityId }, data: { cityId: toCityId } }),
    prisma.financeEntry.updateMany({ where: { cityId: fromCityId }, data: { cityId: toCityId } }),
    prisma.dailyReport.updateMany({ where: { cityId: fromCityId }, data: { cityId: toCityId } }),
    prisma.applicationImportBatch.updateMany({ where: { cityId: fromCityId }, data: { cityId: toCityId } }),
  ];
  return prisma.$transaction(operations);
}

async function ensureApplication(definition, applications) {
  const matching = applications.filter((application) => appKey(application) === definition.key);
  const exact = matching.find((application) => application.code === definition.code) ?? matching[0];
  if (exact) {
    if (apply) {
      return prisma.application.update({
        where: { id: exact.id },
        data: { code: definition.code, name: definition.name, status: RecordStatus.ACTIVE },
      });
    }
    return exact;
  }
  if (!apply) return { id: `dry-${definition.code}`, code: definition.code, name: definition.name, status: RecordStatus.ACTIVE };
  return prisma.application.create({
    data: { code: definition.code, name: definition.name, status: RecordStatus.ACTIVE },
  });
}

async function main() {
  const created = [];
  const updated = [];
  const skipped = [];
  const warnings = [];
  const migratedCities = [];
  const inactiveCities = [];

  const [cities, applications] = await Promise.all([
    prisma.city.findMany({ orderBy: { nameAr: "asc" } }),
    prisma.application.findMany({ orderBy: { name: "asc" } }),
  ]);

  const cityBuckets = new Map();
  for (const city of cities) {
    const key = cityKey(city);
    if (!key) {
      warnings.push(`City skipped: ${city.nameAr} (${city.id}) is not an approved city or has no recognizable name.`);
      continue;
    }
    const current = cityBuckets.get(key) ?? [];
    current.push(city);
    cityBuckets.set(key, current);
  }

  const approvedCityRecords = [];
  const duplicateCities = [];
  const corruptedCities = cities.filter((city) => hasMojibake(city.nameAr) || hasMojibake(city.nameEn));

  for (const approved of approvedCities) {
    const bucket = cityBuckets.get(approved.key) ?? [];
    if (!bucket.length) {
      warnings.push(`Approved city missing from DB: ${approved.ar} (${approved.code}).`);
      continue;
    }
    const canonical =
      bucket.find((city) => city.status === RecordStatus.ACTIVE && !hasMojibake(city.nameAr) && normalizeArabic(city.nameAr) === normalizeArabic(approved.ar)) ??
      bucket.find((city) => city.status === RecordStatus.ACTIVE && !hasMojibake(city.nameAr)) ??
      bucket[0];
    approvedCityRecords.push({ ...approved, record: canonical });

    for (const duplicate of bucket.filter((city) => city.id !== canonical.id)) {
      duplicateCities.push({ duplicate, canonical, approved });
      const counts = await linkedCounts(duplicate.id);
      if (apply) {
        const updates = await migrateCityReferences(duplicate.id, canonical.id);
        await prisma.city.update({ where: { id: duplicate.id }, data: { status: RecordStatus.INACTIVE } });
        migratedCities.push({ from: duplicate, to: canonical, counts, updates: updates.map((result) => result.count) });
        inactiveCities.push(duplicate);
      } else {
        warnings.push(`Duplicate city would be migrated: ${duplicate.nameAr} (${duplicate.id}) -> ${canonical.nameAr} (${canonical.id}).`);
      }
    }
  }

  const refreshedApplications = apply ? await prisma.application.findMany() : applications;
  const canonicalApps = [];
  for (const definition of applicationDefinitions) {
    const app = await ensureApplication(definition, refreshedApplications);
    canonicalApps.push({ definition, app });
  }

  if (apply) {
    const allApps = await prisma.application.findMany();
    for (const application of allApps) {
      const key = appKey(application);
      const canonical = canonicalApps.find((item) => item.definition.key === key)?.app;
      if (!canonical || application.id === canonical.id) continue;
      const result = await prisma.applicationProject.updateMany({
        where: { applicationId: application.id },
        data: { applicationId: canonical.id },
      });
      if (result.count) warnings.push(`Moved ${result.count} ApplicationProjects from duplicate app ${application.code} to ${canonical.code}.`);
    }
  }

  for (const { definition, app } of canonicalApps) {
    for (const city of approvedCityRecords) {
      const code = `${definition.code}-${city.code}`;
      const name = projectName(definition.name, city.record.nameAr || city.ar);
      const existingByCode = await prisma.applicationProject.findUnique({ where: { code } }).catch(() => null);
      const existingByPair = await prisma.applicationProject.findFirst({
        where: {
          applicationId: app.id,
          cityId: city.record.id,
        },
      });
      const existing = existingByPair ?? existingByCode;
      if (!apply) {
        skipped.push(existing ? `${code} exists or would be updated` : `${code} would be created`);
        continue;
      }
      if (existing) {
        const data = {
          applicationId: app.id,
          cityId: city.record.id,
          projectId: null,
          name,
          status: RecordStatus.ACTIVE,
          ...(existing.code === code || !existingByCode ? { code } : {}),
        };
        const updatedProject = await prisma.applicationProject.update({ where: { id: existing.id }, data });
        updated.push(updatedProject.code);
      } else {
        const project = await prisma.applicationProject.create({
          data: {
            applicationId: app.id,
            cityId: city.record.id,
            projectId: null,
            code,
            name,
            status: RecordStatus.ACTIVE,
          },
        });
        created.push(project.code);
      }
    }
  }

  const remainingProjects = await prisma.applicationProject.findMany({
    include: { application: true, city: true },
    orderBy: [{ application: { name: "asc" } }, { city: { nameAr: "asc" } }],
  });

  const report = [
    "# CITY_PROJECTS_CLEANUP_REPORT",
    "",
    `Generated at: ${new Date().toISOString()}`,
    `Mode: ${apply ? "APPLY" : "DRY RUN"}`,
    "",
    "## Approved Cities",
    ...approvedCities.map((city) => `- ${city.ar} / ${city.en} / ${city.code}`),
    "",
    "## Duplicate Cities Found",
    duplicateCities.length
      ? duplicateCities.map(({ duplicate, canonical }) => `- ${duplicate.nameAr} (${duplicate.id}) -> ${canonical.nameAr} (${canonical.id})`).join("\n")
      : "- None",
    "",
    "## Corrupted Cities Found",
    corruptedCities.length ? corruptedCities.map((city) => `- ${city.nameAr} (${city.id})`).join("\n") : "- None",
    "",
    "## Cities Migrated",
    migratedCities.length
      ? migratedCities.map((item) => `- ${item.from.nameAr} -> ${item.to.nameAr}; counts=${JSON.stringify(item.counts)}; updates=${item.updates.join(",")}`).join("\n")
      : "- None",
    "",
    "## Cities Marked Inactive",
    inactiveCities.length ? inactiveCities.map((city) => `- ${city.nameAr} (${city.id})`).join("\n") : "- None",
    "",
    "## Created ApplicationProjects",
    created.length ? created.map((code) => `- ${code}`).join("\n") : "- None",
    "",
    "## Updated ApplicationProjects",
    updated.length ? updated.map((code) => `- ${code}`).join("\n") : "- None",
    "",
    "## Skipped / Dry Run Items",
    skipped.length ? skipped.map((item) => `- ${item}`).join("\n") : "- None",
    "",
    "## Current Keeta/HungerStation City Projects",
    ...remainingProjects
      .filter((project) => ["keeta", "hungerstation"].includes(appKey(project.application)))
      .map((project) => `- ${project.application.name} | ${project.code} | ${project.name} | ${project.city?.nameAr ?? "No city"} | ${project.status}`),
    "",
    "## Remaining Risks",
    warnings.length ? warnings.map((warning) => `- ${warning}`).join("\n") : "- No remaining risks detected by the script.",
    "",
  ].join("\n");

  await fs.writeFile(reportPath, report, "utf8");
  console.log(JSON.stringify({ apply, created: created.length, updated: updated.length, duplicateCities: duplicateCities.length, corruptedCities: corruptedCities.length, reportPath, warnings }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
