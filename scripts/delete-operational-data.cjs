const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;

    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    value = value.replace(/^["']|["']$/g, "");
    process.env[key] = value;
  }
}

loadEnv();

const prisma = new PrismaClient();

const deleteOrder = [
  "PayrollItem",
  "PayrollRun",
  "KeetaInvoiceDetailRecord",
  "KeetaInvoiceRecord",
  "KeetaPerformanceRecord",
  "KeetaRankRecord",
  "DailyReport",
  "ImportRow",
  "ImportBatch"
];

async function tableExists(tx, table) {
  const result = await tx.$queryRawUnsafe(`SELECT to_regclass('public."${table}"')::text AS name`);
  return Boolean(result?.[0]?.name);
}

async function main() {
  console.log("Database:", process.env.DATABASE_URL?.split("@")[1] || "unknown");

  const result = [];

  await prisma.$transaction(async (tx) => {
    for (const table of deleteOrder) {
      if (!(await tableExists(tx, table))) {
        result.push({ table, status: "missing", deleted: 0 });
        continue;
      }

      const before = await tx.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM "${table}"`);
      const count = Number(before?.[0]?.count ?? 0);

      await tx.$executeRawUnsafe(`DELETE FROM "${table}"`);

      result.push({ table, status: "deleted", deleted: count });
    }
  });

  console.table(result);
  console.log("Operational data deleted successfully.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
