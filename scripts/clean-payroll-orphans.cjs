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
    let value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    process.env[key] = value;
  }
}

loadEnv();

const prisma = new PrismaClient();

async function tableExists(table) {
  const result = await prisma.$queryRawUnsafe(
    `SELECT to_regclass('public."${table}"')::text AS name`
  );
  return Boolean(result?.[0]?.name);
}

async function deleteTable(table) {
  if (!(await tableExists(table))) {
    console.log(`${table}: missing`);
    return;
  }

  const before = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM "${table}"`);
  const count = Number(before?.[0]?.count ?? 0);

  await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`);
  console.log(`${table}: deleted ${count}`);
}

async function main() {
  await deleteTable("Payroll");
  await deleteTable("PayrollItem");
  await deleteTable("PayrollRun");

  console.log("Payroll tables cleaned.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
