const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");
const os = require("os");

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

const tables = [
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

function replacer(key, value) {
  if (typeof value === "bigint") return value.toString();
  if (value && typeof value === "object" && value.constructor?.name === "Decimal") return value.toString();
  return value;
}

async function tableExists(table) {
  const result = await prisma.$queryRawUnsafe(`SELECT to_regclass('public."${table}"')::text AS name`);
  return Boolean(result?.[0]?.name);
}

async function main() {
  console.log("Database:", process.env.DATABASE_URL?.split("@")[1] || "unknown");

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = path.join(os.homedir(), "Desktop", `mshawki_erp_operational_backup_${stamp}`);
  fs.mkdirSync(dir, { recursive: true });

  const summary = [];

  for (const table of tables) {
    if (!(await tableExists(table))) {
      summary.push({ table, status: "missing", count: 0 });
      continue;
    }

    const rows = await prisma.$queryRawUnsafe(`SELECT * FROM "${table}"`);
    fs.writeFileSync(path.join(dir, `${table}.json`), JSON.stringify(rows, replacer, 2), "utf8");
    summary.push({ table, status: "ok", count: rows.length });
  }

  fs.writeFileSync(path.join(dir, "summary.json"), JSON.stringify(summary, null, 2), "utf8");
  console.table(summary);
  console.log("Backup saved to:", dir);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
