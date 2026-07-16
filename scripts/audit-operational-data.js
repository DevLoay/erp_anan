const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

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

function classify(tableName) {
  const n = tableName.toLowerCase();

  if (n === "driver" || n.includes("rider")) return "drivers_riders";
  if (n.includes("document")) return "documents";
  if (n.includes("vehicle") || n.includes("fuel")) return "vehicles_movement";
  if (n.includes("daily") || n.includes("performance") || n.includes("report")) return "daily_reports";
  if (n.includes("invoice")) return "invoices";
  if (n.includes("payroll")) return "payroll";
  if (n.includes("advance")) return "advances";
  if (n.includes("deduction")) return "deductions";
  if (n.includes("violation")) return "violations";
  if (n.includes("applicationaccount") || n.includes("accountusage") || n.includes("account")) return "application_accounts";
  if (n.includes("import") || n.includes("batch") || n.includes("row")) return "imports";
  if (n.includes("hungerstation") || n.includes("keeta")) return "application_data";

  return null;
}

async function groupByIfExists(tableName, columnName, limit = 20) {
  if (!(await tableExists(tableName))) return;
  if (!(await columnExists(tableName, columnName))) return;

  const rows = await prisma.$queryRawUnsafe(`
    SELECT ${qid(columnName)}::text AS key, COUNT(*)::int AS count
    FROM ${qid(tableName)}
    GROUP BY ${qid(columnName)}
    ORDER BY count DESC
    LIMIT ${Number(limit)}
  `);

  console.log(`\n${tableName} by ${columnName}:`);
  console.table(rows);
}

async function main() {
  const tables = await getTables();

  const operational = [];

  for (const tableName of tables) {
    const category = classify(tableName);
    if (!category) continue;

    operational.push({
      category,
      table: tableName,
      rows: await countRows(tableName)
    });
  }

  operational.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return b.rows - a.rows;
  });

  console.log("\n=== Operational Data Tables ===");
  console.table(operational);

  const totalsByCategory = {};
  for (const x of operational) {
    totalsByCategory[x.category] = (totalsByCategory[x.category] || 0) + Number(x.rows || 0);
  }

  console.log("\n=== Totals By Category ===");
  console.table(Object.entries(totalsByCategory).map(([category, rows]) => ({ category, rows })));

  const totalRows = operational.reduce((sum, x) => sum + Number(x.rows || 0), 0);
  console.log("\nTotal operational rows:", totalRows);

  console.log("\n=== Key Summaries ===");

  await groupByIfExists("Driver", "status");
  await groupByIfExists("Driver", "cityId");
  await groupByIfExists("Vehicle", "status");
  await groupByIfExists("Vehicle", "cityId");
  await groupByIfExists("ApplicationAccount", "applicationProjectId");
  await groupByIfExists("AccountUsage", "status");
  await groupByIfExists("HungerStationAccountUsage", "status");
  await groupByIfExists("PayrollRun", "month");
  await groupByIfExists("PayrollRun", "status");
  await groupByIfExists("Advance", "status");
  await groupByIfExists("Advance", "deductionMonth");
  await groupByIfExists("Deduction", "type");
  await groupByIfExists("Violation", "status");
  await groupByIfExists("ApplicationImportBatch", "sourceType");
  await groupByIfExists("ApplicationImportBatch", "status");

  console.log("\nRead-only audit completed. Nothing was changed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
