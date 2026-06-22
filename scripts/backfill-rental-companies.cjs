const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    process.env[key] = value;
  }
}

loadEnv();
const prisma = new PrismaClient();

async function columnExists(table, column) {
  const result = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS count
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = '${table}'
      AND column_name = '${column}'
  `);
  return Number(result?.[0]?.count ?? 0) > 0;
}

async function main() {
  if (!(await columnExists("Vehicle", "rentalCompanyId"))) {
    throw new Error('Column Vehicle.rentalCompanyId is missing. Run: node scripts/apply-vehicle-rental-company-schema-patch.cjs then npx prisma db push && npx prisma generate');
  }

  const vehicles = await prisma.$queryRawUnsafe(`
    SELECT id, TRIM(COALESCE("rentalCompany", '')) AS "rentalCompany"
    FROM "Vehicle"
    WHERE TRIM(COALESCE("rentalCompany", '')) <> ''
      AND "rentalCompanyId" IS NULL
  `);

  let created = 0;
  let linked = 0;

  for (const vehicle of vehicles) {
    const name = String(vehicle.rentalCompany || "").trim();
    if (!name) continue;

    let company = await prisma.rentalCompany.findFirst({ where: { name } });
    if (!company) {
      company = await prisma.rentalCompany.create({ data: { name, status: "ACTIVE" } });
      created += 1;
    }

    await prisma.$executeRawUnsafe(`UPDATE "Vehicle" SET "rentalCompanyId" = $1 WHERE id = $2`, company.id, vehicle.id);
    linked += 1;
  }

  // تثبيت قاعدة إيجار سيارة الشركة في جدول السيارات.
  await prisma.$executeRawUnsafe(`
    UPDATE "Vehicle"
    SET "monthlyRent" = 2000, "dailyRent" = 66.67
    WHERE LOWER(COALESCE("ownershipType", 'company')) NOT LIKE '%personal%'
      AND COALESCE("ownershipType", '') NOT LIKE '%شخص%'
  `);

  await prisma.$executeRawUnsafe(`
    UPDATE "Vehicle"
    SET "monthlyRent" = 0, "dailyRent" = 0
    WHERE LOWER(COALESCE("ownershipType", '')) LIKE '%personal%'
      OR COALESCE("ownershipType", '') LIKE '%شخص%'
  `);

  console.log(`Rental companies created: ${created}`);
  console.log(`Vehicles linked to rental companies: ${linked}`);
  console.log("Vehicle rent defaults normalized: company/rental = 2000 monthly / 66.67 daily, personal = 0.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
