const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const apply = process.argv.includes("--apply");
const confirmArg = (process.argv.find((a) => a.startsWith("--confirm=")) || "").split("=")[1];

const targetTables = [
  "PayrollItem",
  "PayrollRun",

  "Advance",
  "Deduction",
  "Violation",
  "FuelRecord",

  "VehicleAssignment",
  "DriverVehicleAssignment",
  "VehicleMovement",

  "RiderDocument",
  "DriverDocument",

  "HungerStationAccountUsage",
  "AccountUsage",

  "HungerStationDailyPerformanceRecord",
  "HungerStationInvoiceRecord",

  "KeetaInvoiceDetailRecord",
  "KeetaInvoiceRecord",
  "KeetaRankRecord",
  "KeetaPerformanceRecord",

  "DailyReportRow",
  "DailyReport",
  "DriverDailyReport",
  "ManagementReportRow",
  "ManagementReport",

  "ApplicationImportRow",
  "ApplicationImportBatch",
  "ImportRow",
  "ImportBatch",

  "ApplicationAccount",

  "Driver"
];

function qid(name) {
  return '"' + String(name).replace(/"/g, '""') + '"';
}

async function tableExists(tableName) {
  const rows = await prisma.$queryRawUnsafe(
    `
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = $1
    ) AS exists
    `,
    tableName
  );
  return Boolean(rows[0]?.exists);
}

async function columnExists(tableName, columnName) {
  const rows = await prisma.$queryRawUnsafe(
    `
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = $2
    ) AS exists
    `,
    tableName,
    columnName
  );
  return Boolean(rows[0]?.exists);
}

async function countRows(tableName) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS count FROM ${qid(tableName)}`
  );
  return rows[0]?.count || 0;
}

async function main() {
  const existingTables = [];

  for (const tableName of targetTables) {
    if (await tableExists(tableName)) {
      existingTables.push(tableName);
    }
  }

  const counts = [];
  for (const tableName of existingTables) {
    counts.push({
      table: tableName,
      rows: await countRows(tableName)
    });
  }

  console.log("\nOperational data cleanup preview:");
  console.table(counts);

  const total = counts.reduce((sum, x) => sum + Number(x.rows || 0), 0);
  console.log("Total rows planned for deletion:", total);

  console.log("\nKept tables:");
  console.log("User, Supervisor, City, Project, ApplicationProject, Vehicle, Settings");

  if (!apply) {
    console.log("\nDry-run only. Nothing was deleted.");
    console.log("To apply:");
    console.log("node scripts\\cleanup-operational-data.js --apply --confirm=DELETE_OPERATIONAL_DATA");
    return;
  }

  if (confirmArg !== "DELETE_OPERATIONAL_DATA") {
    console.error("\nMissing confirmation.");
    console.error("Use:");
    console.error("node scripts\\cleanup-operational-data.js --apply --confirm=DELETE_OPERATIONAL_DATA");
    process.exit(1);
  }

  await prisma.$transaction(async (tx) => {
    if (await tableExists("User")) {
      if (await columnExists("User", "driverId")) {
        await tx.$executeRawUnsafe(`UPDATE "User" SET "driverId" = NULL WHERE "driverId" IS NOT NULL`);
      }
    }

    if (await tableExists("Vehicle")) {
      const vehicleNullableDriverColumns = [
        "driverId",
        "currentDriverId",
        "assignedDriverId",
        "riderId"
      ];

      for (const col of vehicleNullableDriverColumns) {
        if (await columnExists("Vehicle", col)) {
          try {
            await tx.$executeRawUnsafe(`UPDATE "Vehicle" SET ${qid(col)} = NULL WHERE ${qid(col)} IS NOT NULL`);
          } catch (e) {
            console.warn(`Could not clear Vehicle.${col}:`, e.message);
          }
        }
      }
    }

    for (const tableName of existingTables) {
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

  const afterCounts = [];
  for (const tableName of existingTables) {
    afterCounts.push({
      table: tableName,
      rows: await countRows(tableName)
    });
  }

  console.log("\nAfter cleanup:");
  console.table(afterCounts);
}

main()
  .catch((e) => {
    console.error("\nCleanup failed. No partial transaction should remain if the failure happened inside transaction.");
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
