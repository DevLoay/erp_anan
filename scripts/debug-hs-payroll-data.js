const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function safeCount(modelName, where) {
  if (!prisma[modelName]) {
    console.log(modelName + ": MODEL_NOT_FOUND");
    return;
  }

  try {
    const count = await prisma[modelName].count({ where });
    const sample = await prisma[modelName].findFirst({ where });
    console.log("\n" + modelName + " count:", count);
    console.log(modelName + " sample:", sample);
  } catch (err) {
    console.log("\n" + modelName + " ERROR:", err.message);
  }
}

async function main() {
  console.log("Available Hunger models:");
  console.log(Object.keys(prisma).filter(k => k.toLowerCase().includes("hunger")));

  await safeCount("hungerStationInvoiceRecord", { month: "2026-04" });
  await safeCount("hungerStationDailyPerformanceRecord", { month: "2026-04" });
  await safeCount("accountUsage", { month: "2026-04" });

  if (prisma.applicationProject) {
    const projects = await prisma.applicationProject.findMany({
      take: 50
    });
    console.log("\nApplicationProjects sample:");
    console.log(projects);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
