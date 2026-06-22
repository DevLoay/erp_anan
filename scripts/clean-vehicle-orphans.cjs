const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const i = trimmed.indexOf('=');
    if (i === -1) continue;
    const key = trimmed.slice(0, i).trim();
    const value = trimmed.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    process.env[key] = value;
  }
}

loadEnv();
const prisma = new PrismaClient();

async function tableExists(table) {
  const result = await prisma.$queryRawUnsafe(`SELECT to_regclass('public."${table}"')::text AS name`);
  return Boolean(result?.[0]?.name);
}

async function deleteOrphanRows(table, driverColumn = 'driverId') {
  if (!(await tableExists(table))) {
    console.log(`${table}: missing`);
    return;
  }
  const rows = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS count
    FROM "${table}" t
    WHERE t."${driverColumn}" IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM "Driver" d WHERE d.id = t."${driverColumn}")
  `);
  const count = Number(rows?.[0]?.count ?? 0);
  if (count > 0) {
    await prisma.$executeRawUnsafe(`
      DELETE FROM "${table}" t
      WHERE t."${driverColumn}" IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM "Driver" d WHERE d.id = t."${driverColumn}")
    `);
  }
  console.log(`${table}: deleted orphan rows = ${count}`);
}

async function nullOrphanDriverColumn(table, driverColumn = 'driverId') {
  if (!(await tableExists(table))) {
    console.log(`${table}: missing`);
    return;
  }
  const rows = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS count
    FROM "${table}" t
    WHERE t."${driverColumn}" IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM "Driver" d WHERE d.id = t."${driverColumn}")
  `);
  const count = Number(rows?.[0]?.count ?? 0);
  if (count > 0) {
    await prisma.$executeRawUnsafe(`
      UPDATE "${table}" t
      SET "${driverColumn}" = NULL
      WHERE t."${driverColumn}" IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM "Driver" d WHERE d.id = t."${driverColumn}")
    `);
  }
  console.log(`${table}.${driverColumn}: cleared orphan references = ${count}`);
}

async function main() {
  console.log('Cleaning vehicle-related orphan driver references...');

  if (await tableExists('Vehicle')) {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS count
      FROM "Vehicle" v
      WHERE v."currentDriverId" IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM "Driver" d WHERE d.id = v."currentDriverId")
    `);
    const count = Number(rows?.[0]?.count ?? 0);
    if (count > 0) {
      await prisma.$executeRawUnsafe(`
        UPDATE "Vehicle"
        SET "currentDriverId" = NULL, "status" = 'AVAILABLE'
        WHERE "currentDriverId" IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM "Driver" d WHERE d.id = "Vehicle"."currentDriverId")
      `);
    }
    console.log(`Vehicle.currentDriverId: cleared orphan references = ${count}`);
  }

  await deleteOrphanRows('VehicleAssignment', 'driverId');
  await deleteOrphanRows('FuelRecord', 'driverId');
  await deleteOrphanRows('Violation', 'driverId');

  await nullOrphanDriverColumn('VehicleCleaning', 'driverId');
  await nullOrphanDriverColumn('VehicleMaintenance', 'driverId');
  await nullOrphanDriverColumn('VehicleAuthorization', 'driverId');
  await nullOrphanDriverColumn('VehicleAccident', 'driverId');
  await nullOrphanDriverColumn('VehicleDamage', 'driverId');

  if (await tableExists('VehicleMovement')) {
    await nullOrphanDriverColumn('VehicleMovement', 'fromDriverId');
    await nullOrphanDriverColumn('VehicleMovement', 'toDriverId');
  }

  console.log('Done.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
