import { PrismaClient, RecordStatus } from "@prisma/client";

const prisma = new PrismaClient();
const CITY_AR = "\u0627\u0644\u0623\u062d\u0633\u0627\u0621";
const CITY_EN = "Al Ahsa";
const PROJECT_CODE = "KEETA-AHSA";

async function main() {
  const candidates = await prisma.city.findMany({
    where: {
      OR: [
        { nameEn: { equals: CITY_EN, mode: "insensitive" } },
        { nameEn: { equals: "AHS", mode: "insensitive" } },
        { nameAr: { contains: "\u062d\u0633\u0627" } },
      ],
    },
    include: {
      _count: {
        select: {
          drivers: true,
          vehicles: true,
          applicationAccounts: true,
          applicationProjects: true,
          keetaInvoiceRecords: true,
          keetaPerformanceRecords: true,
          keetaRankRecords: true,
        },
      },
    },
  });
  if (!candidates.length) {
    console.log("No Al Ahsa city candidates found.");
    return;
  }
  const score = (city) => city._count.drivers * 100000 + city._count.vehicles * 10000 + city._count.applicationProjects * 1000 + city._count.applicationAccounts * 100 + city._count.keetaInvoiceRecords + city._count.keetaPerformanceRecords + city._count.keetaRankRecords;
  const canonical = candidates.sort((a, b) => score(b) - score(a))[0];
  const duplicateIds = candidates.filter((city) => city.id !== canonical.id).map((city) => city.id);

  await prisma.city.update({ where: { id: canonical.id }, data: { nameAr: CITY_AR, nameEn: CITY_EN, status: RecordStatus.ACTIVE } });
  if (duplicateIds.length) {
    await prisma.driver.updateMany({ where: { cityId: { in: duplicateIds } }, data: { cityId: canonical.id } });
    await prisma.vehicle.updateMany({ where: { cityId: { in: duplicateIds } }, data: { cityId: canonical.id } });
    await prisma.supervisor.updateMany({ where: { cityId: { in: duplicateIds } }, data: { cityId: canonical.id } });
    await prisma.applicationAccount.updateMany({ where: { cityId: { in: duplicateIds } }, data: { cityId: canonical.id } });
    await prisma.applicationProject.updateMany({ where: { cityId: { in: duplicateIds } }, data: { cityId: canonical.id } });
    await prisma.applicationImportBatch.updateMany({ where: { cityId: { in: duplicateIds } }, data: { cityId: canonical.id } });
    await prisma.dailyReport.updateMany({ where: { cityId: { in: duplicateIds } }, data: { cityId: canonical.id } });
    await prisma.payrollRun.updateMany({ where: { cityId: { in: duplicateIds } }, data: { cityId: canonical.id } });
    await prisma.financeEntry.updateMany({ where: { cityId: { in: duplicateIds } }, data: { cityId: canonical.id } });
    await prisma.advance.updateMany({ where: { cityId: { in: duplicateIds } }, data: { cityId: canonical.id } });
    await prisma.keetaInvoiceRecord.updateMany({ where: { cityId: { in: duplicateIds } }, data: { cityId: canonical.id } });
    await prisma.keetaPerformanceRecord.updateMany({ where: { cityId: { in: duplicateIds } }, data: { cityId: canonical.id } });
    await prisma.keetaRankRecord.updateMany({ where: { cityId: { in: duplicateIds } }, data: { cityId: canonical.id } });
    await prisma.city.updateMany({ where: { id: { in: duplicateIds } }, data: { status: RecordStatus.INACTIVE } });
  }

  const keeta = await prisma.application.findFirst({ where: { code: "KEETA" }, select: { id: true } });
  if (keeta) {
    await prisma.applicationProject.update({ where: { code: PROJECT_CODE }, data: { applicationId: keeta.id, cityId: canonical.id, name: `Keeta - ${CITY_AR}`, status: RecordStatus.ACTIVE } }).catch(() => null);
    const project = await prisma.applicationProject.findUnique({ where: { code: PROJECT_CODE }, select: { id: true } });
    if (project) {
      await prisma.applicationAccount.updateMany({ where: { applicationProjectId: project.id }, data: { applicationId: keeta.id, cityId: canonical.id, appName: "Keeta", projectId: null } });
      await prisma.keetaInvoiceRecord.updateMany({ where: { applicationProjectId: project.id }, data: { cityId: canonical.id } });
      await prisma.keetaPerformanceRecord.updateMany({ where: { applicationProjectId: project.id }, data: { cityId: canonical.id } });
      await prisma.keetaRankRecord.updateMany({ where: { applicationProjectId: project.id }, data: { cityId: canonical.id } });
      await prisma.applicationImportBatch.updateMany({ where: { applicationProjectId: project.id }, data: { cityId: canonical.id } });
    }
  }

  console.log(JSON.stringify({ canonicalCityId: canonical.id, duplicateCityIds: duplicateIds }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
