const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const systemTables = [
  "City", "Project", "Application", "ApplicationProject", "User", "Supervisor",
  "ApplicationPayrollSetting", "KeetaPayrollPlan", "PayrollFieldRule",
];
const operationalTables = [
  "Driver", "Vehicle", "ApplicationAccount", "AccountUsage", "HungerStationAccountUsage",
  "HungerStationDailyPerformanceRecord", "HungerStationInvoiceRecord", "KeetaInvoiceRecord",
  "KeetaInvoiceDetailRecord", "KeetaRankRecord", "PayrollRun", "PayrollItem", "Advance",
  "Deduction", "Violation",
];
const references = [
  ["User", "supervisorId", "Supervisor"], ["User", "cityId", "City"],
  ["Supervisor", "cityId", "City"], ["ApplicationProject", "applicationId", "Application"],
  ["ApplicationProject", "cityId", "City"], ["Driver", "cityId", "City"],
  ["Driver", "supervisorId", "Supervisor"], ["Vehicle", "cityId", "City"],
  ["ApplicationAccount", "driverId", "Driver"], ["ApplicationAccount", "applicationId", "Application"],
  ["ApplicationAccount", "applicationProjectId", "ApplicationProject"],
  ["ApplicationAccount", "cityId", "City"], ["AccountUsage", "applicationAccountId", "ApplicationAccount"],
  ["AccountUsage", "actualDriverId", "Driver"], ["PayrollItem", "payrollRunId", "PayrollRun"],
  ["PayrollItem", "driverId", "Driver"],
];

function exists(relativePath) {
  return fs.existsSync(path.join(process.cwd(), relativePath));
}

async function tableCount(table) {
  const rows = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM "${table}"`);
  return Number(rows[0]?.count ?? 0);
}

async function main() {
  const report = {
    ok: false,
    databaseConnected: false,
    prismaClientOk: false,
    requiredTables: {},
    systemData: {},
    operationalDataCounts: {},
    brokenReferences: [],
    projectFiles: {
      packageJson: exists("package.json"),
      tsconfig: exists("tsconfig.json"),
      nextConfig: exists("next.config.ts") || exists("next.config.js"),
      prismaSchema: exists("prisma/schema.prisma"),
      migrationHistory: exists("prisma/migrations"),
      proxy: exists("src/proxy.ts"),
      healthRoute: exists("src/app/api/health/route.ts"),
      productionEnvExample: exists(".env.production.example"),
      productionReadme: exists("README-PRODUCTION-DEPLOYMENT.md"),
    },
    warnings: [],
    nextActions: [],
  };

  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    report.databaseConnected = true;
    report.prismaClientOk = true;

    const rows = await prisma.$queryRawUnsafe(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
    );
    const tables = new Set(rows.map((row) => row.table_name));
    for (const table of [...new Set([...systemTables, ...operationalTables])]) {
      report.requiredTables[table] = tables.has(table);
      if (!tables.has(table)) continue;
      const target = systemTables.includes(table) ? report.systemData : report.operationalDataCounts;
      target[table] = await tableCount(table);
    }

    for (const [child, foreignKey, parent] of references) {
      if (!tables.has(child) || !tables.has(parent)) continue;
      const columns = await prisma.$queryRawUnsafe(
        "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1",
        child,
      );
      if (!columns.some((column) => column.column_name === foreignKey)) continue;
      const query = `SELECT COUNT(*)::int AS count FROM "${child}" c LEFT JOIN "${parent}" p ON c."${foreignKey}" = p."id" WHERE c."${foreignKey}" IS NOT NULL AND p."id" IS NULL`;
      const count = Number((await prisma.$queryRawUnsafe(query))[0]?.count ?? 0);
      if (count) report.brokenReferences.push({ child, foreignKey, parent, count });
    }

    if (!report.systemData.User) report.warnings.push("No users exist; first login cannot succeed.");
    if (!report.systemData.City) report.warnings.push("No cities exist; system configuration is incomplete.");
    if (!report.systemData.ApplicationProject) report.warnings.push("No application projects exist.");
    if (Object.values(report.operationalDataCounts).every((count) => count === 0)) {
      report.warnings.push("Operational tables are empty. This is allowed for a clean production start.");
    }

    const missingTables = Object.entries(report.requiredTables).filter(([, present]) => !present).map(([table]) => table);
    const missingFiles = Object.entries(report.projectFiles).filter(([, present]) => !present).map(([file]) => file);
    if (missingTables.length) report.nextActions.push(`Create or deploy missing tables: ${missingTables.join(", ")}`);
    if (missingFiles.length) report.nextActions.push(`Add missing production files: ${missingFiles.join(", ")}`);
    if (report.brokenReferences.length) report.nextActions.push("Repair broken references before deployment.");
    report.ok = missingTables.length === 0 && missingFiles.length === 0 && report.brokenReferences.length === 0;
  } catch (error) {
    report.warnings.push(error instanceof Error ? error.message.split("\n").at(-1) : String(error));
    report.nextActions.push("Verify DATABASE_URL and PostgreSQL availability.");
  } finally {
    await prisma.$disconnect();
  }

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main();
