/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function norm(v) { return String(v || '').trim(); }
function appLabel(account) { return norm(account.application?.name || account.appName || account.application?.code); }
function isHunger(account) { return /hunger|هنجر|هنقر/i.test(appLabel(account)); }
function isKeeta(account) { return /keeta|كيتا/i.test(appLabel(account)); }

async function main() {
  const drivers = await prisma.driver.findMany({
    where: { applicationAccounts: { some: {} } },
    include: {
      city: true,
      applicationAccounts: {
        include: { application: true, applicationProject: true, city: true },
        orderBy: [{ appName: 'asc' }, { updatedAt: 'desc' }],
      },
    },
    take: 1000,
  });

  const multiAppDrivers = [];
  const hungerNeedsUsage = [];
  const keetaSharedRisk = [];

  for (const driver of drivers) {
    const appNames = new Set(driver.applicationAccounts.map(appLabel).filter(Boolean));
    if (appNames.size > 1) {
      multiAppDrivers.push({
        driver: `${driver.actualName || driver.name} (${driver.internalCode})`,
        city: driver.city?.nameAr || driver.city?.nameEn || '-',
        accounts: driver.applicationAccounts.map((a) => `${appLabel(a)}:${a.applicationProject?.name || '-'}:${a.appUserId || a.username}`).join(' | '),
      });
    }
    for (const account of driver.applicationAccounts) {
      if (isHunger(account)) {
        const usageCount = await prisma.hungerStationAccountUsage.count({ where: { applicationAccountId: account.id, driverId: driver.id } });
        if (!usageCount) {
          hungerNeedsUsage.push({
            driver: `${driver.actualName || driver.name} (${driver.internalCode})`,
            account: account.appUserId || account.username,
            project: account.applicationProject?.name || '-',
          });
        }
      }
      if (isKeeta(account)) {
        const duplicateKeetaAccounts = await prisma.applicationAccount.count({
          where: {
            id: { not: account.id },
            applicationId: account.applicationId || undefined,
            appUserId: account.appUserId || undefined,
            driverId: { not: driver.id },
          },
        });
        if (duplicateKeetaAccounts) {
          keetaSharedRisk.push({
            driver: `${driver.actualName || driver.name} (${driver.internalCode})`,
            account: account.appUserId || account.username,
            duplicateKeetaAccounts,
          });
        }
      }
    }
  }

  console.log(JSON.stringify({
    scannedDrivers: drivers.length,
    multiAppDriversCount: multiAppDrivers.length,
    hungerNeedsUsageCount: hungerNeedsUsage.length,
    keetaSharedRiskCount: keetaSharedRisk.length,
    multiAppDrivers: multiAppDrivers.slice(0, 50),
    hungerNeedsUsage: hungerNeedsUsage.slice(0, 50),
    keetaSharedRisk: keetaSharedRisk.slice(0, 50),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
