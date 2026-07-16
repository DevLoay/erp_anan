const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const apply = process.argv.includes("--apply");
const confirmArg = (process.argv.find((a) => a.startsWith("--confirm=")) || "").split("=")[1];

const preferredDeleteOrder = [
  "KeetaInvoiceDetailRecord",
  "KeetaInvoiceRecord",
  "HungerStationInvoiceRecord",

  "VehicleAssignment",
  "DriverVehicleAssignment",
  "VehicleMovement",
  "VehicleMaintenance",
  "VehicleRepair",
  "VehicleDamage",
  "VehicleAccident",
  "VehicleExpense",
  "VehicleViolation",
  "VehicleFuelRecord",
  "FuelRecord",

  "Vehicle"
];

function qid(name) {
  return '"' + String(name).replace(/"/g, '""') + '"';
}

async function getTables() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  return rows.map(r => r.table_name);
}

async function tableExists(tableName) {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = $1
    ) AS exists
  `, tableName);
  return Boolean(rows[0]?.exists);
}

async function columnExists(tableName, columnName) {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = $2
    ) AS exists
  `, tableName, columnName);
  return Boolean(rows[0]?.exists);
}

async function countRows(tableName) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS count FROM ${qid(tableName)}`
  );
  return rows[0]?.count || 0;
}

function isTargetTable(tableName) {
  if (preferredDeleteOrder.includes(tableName)) return true;

  const lower = tableName.toLowerCase();

  if (lower.includes("invoice")) return true;

  if (
    lower.includes("vehicle") &&
    !lower.includes("vehicletype") &&
    !lower.includes("vehiclebrand") &&
    !lower.includes("vehiclemodel") &&
    !lower.includes("vehiclestatus") &&
    !lower.includes("vehiclecategory") &&
    !lower.includes("vehiclesetting")
  ) {
    return true;
  }

  return false;
}

async function clearNullableVehicleReferences(tx) {
  const possibleRefs = [
    { table: "Driver", columns: ["vehicleId", "currentVehicleId", "assignedVehicleId"] },
    { table: "User", columns: ["vehicleId"] },
    { table: "PayrollItem", columns: ["vehicleId"] }
  ];

  for (const ref of possibleRefs) {
    if (!(await tableExists(ref.table))) continue;

    for (const col of ref.columns) {
      if (!(await columnExists(ref.table, col))) continue;

      try {
        await tx.$executeRawUnsafe(
          `UPDATE ${qid(ref.table)} SET ${qid(col)} = NULL WHERE ${qid(col)} IS NOT NULL`
        );
        console.log(`Cleared ${ref.table}.${col}`);
      } catch (e) {
        console.warn(`Could not clear ${ref.table}.${col}: ${e.message}`);
      }
    }
  }
}

async function main() {
  const allTables = await getTables();

  const discoveredTargets = allTables.filter(isTargetTable);

  const orderedTargets = [
    ...preferredDeleteOrder.filter(t => discoveredTargets.includes(t)),
    ...discoveredTargets.filter(t => !preferredDeleteOrder.includes(t)).sort()
  ];

  const counts = [];
  for (const tableName of orderedTargets) {
    counts.push({
      table: tableName,
      rows: await countRows(tableName)
    });
  }

  console.log("\nDelete vehicles and invoices preview:");
  console.table(counts);

  console.log("\nKept important tables:");
  console.log("User, Supervisor, City, Project, ApplicationProject, Driver, Daily Reports");

  const total = counts.reduce((sum, x) => sum + Number(x.rows || 0), 0);
  console.log("\nTotal rows planned for deletion:", total);

  if (!apply) {
    console.log("\nDry-run only. Nothing was deleted.");
    console.log("To apply:");
    console.log("node scripts\\cleanup-vehicles-invoices.js --apply --confirm=DELETE_VEHICLES_INVOICES");
    return;
  }

  if (confirmArg !== "DELETE_VEHICLES_INVOICES") {
    console.error("\nMissing confirmation.");
    console.error("Use:");
    console.error("node scripts\\cleanup-vehicles-invoices.js --apply --confirm=DELETE_VEHICLES_INVOICES");
    process.exit(1);
  }

  await prisma.$transaction(async (tx) => {
    await clearNullableVehicleReferences(tx);

    for (const tableName of orderedTargets) {
      const before = await tx.$queryRawUnsafe(
        `SELECT COUNT(*)::int AS count FROM ${qid(tableName)}`
      );

      const count = before[0]?.count || 0;

      if (count > 0) {
        console.log(`Deleting ${count} rows from ${tableName}...`);
        await tx.$executeRawUnsafe(`DELETE FROM ${qid(tableName)}`);
      } else {
        console.log(`Skipping ${tableName}, already empty.`);
      }
    }
  }, {
    timeout: 300000,
    maxWait: 300000
  });

  console.log("\nCleanup completed successfully.");

  const after = [];
  for (const tableName of orderedTargets) {
    after.push({
      table: tableName,
      rows: await countRows(tableName)
    });
  }

  console.log("\nAfter cleanup:");
  console.table(after);
}

main()
  .catch((e) => {
    console.error("\nCleanup failed:");
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
