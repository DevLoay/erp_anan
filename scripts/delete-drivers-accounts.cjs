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

async function tableExists(tx, table) {
  const result = await tx.$queryRawUnsafe(
    `SELECT to_regclass('public."${table}"')::text AS name`
  );
  return Boolean(result?.[0]?.name);
}

async function deleteIfExists(tx, table, result) {
  if (!(await tableExists(tx, table))) {
    result.push({ table, action: "missing", affected: 0 });
    return;
  }

  const before = await tx.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM "${table}"`);
  const count = Number(before?.[0]?.count ?? 0);

  await tx.$executeRawUnsafe(`DELETE FROM "${table}"`);
  result.push({ table, action: "deleted", affected: count });
}

async function nullIfColumnExists(tx, table, column, result) {
  if (!(await tableExists(tx, table))) return;

  const exists = await tx.$queryRawUnsafe(`
    SELECT column_name::text
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = '${table}'
      AND column_name = '${column}'
    LIMIT 1
  `);

  if (!exists?.length) return;

  await tx.$executeRawUnsafe(`UPDATE "${table}" SET "${column}" = NULL WHERE "${column}" IS NOT NULL`);
  result.push({ table, action: `nulled ${column}`, affected: "-" });
}

async function getForeignKeyChildren(tx) {
  return tx.$queryRawUnsafe(`
    SELECT DISTINCT
      tc.table_name::text AS table_name,
      kcu.column_name::text AS column_name,
      ccu.table_name::text AS referenced_table
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND ccu.table_name IN ('Driver', 'ApplicationAccount')
  `);
}

async function main() {
  console.log("Database:", process.env.DATABASE_URL?.split("@")[1] || "unknown");

  const result = [];

  await prisma.$transaction(async (tx) => {
    await nullIfColumnExists(tx, "Vehicle", "currentDriverId", result);

    const children = await getForeignKeyChildren(tx);

    const protectedTables = new Set(["Vehicle", "Driver", "ApplicationAccount"]);

    for (const child of children) {
      const table = child.table_name;
      const column = child.column_name;

      if (protectedTables.has(table)) continue;
      if (!(await tableExists(tx, table))) continue;

      const before = await tx.$queryRawUnsafe(
        `SELECT COUNT(*)::int AS count FROM "${table}" WHERE "${column}" IS NOT NULL`
      );
      const count = Number(before?.[0]?.count ?? 0);

      await tx.$executeRawUnsafe(`DELETE FROM "${table}" WHERE "${column}" IS NOT NULL`);
      result.push({ table, action: `deleted by ${column}`, affected: count });
    }

    await deleteIfExists(tx, "ApplicationAccount", result);
    await deleteIfExists(tx, "Driver", result);
  }, { timeout: 60000 });

  console.table(result);
  console.log("Drivers and application accounts deleted successfully.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
