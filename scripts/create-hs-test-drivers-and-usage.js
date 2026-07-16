const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const month = "2026-04";

const plan = [
  {
    riderId: "1730514",
    drivers: [
      {
        code: "TEST-HS-MAK-1730514",
        name: "مندوب تيست هنجر 1730514",
        from: "2026-04-01",
        to: "2026-04-30",
      },
    ],
  },
  {
    riderId: "2531677",
    drivers: [
      {
        code: "TEST-HS-MAK-2531677",
        name: "مندوب تيست هنجر 2531677",
        from: "2026-04-01",
        to: "2026-04-30",
      },
    ],
  },
  {
    riderId: "3868266",
    drivers: [
      {
        code: "TEST-HS-MAK-3868266",
        name: "مندوب تيست هنجر 3868266",
        from: "2026-04-01",
        to: "2026-04-30",
      },
    ],
  },
  {
    riderId: "3878707",
    drivers: [
      {
        code: "TEST-HS-MAK-3878707",
        name: "مندوب تيست هنجر 3878707",
        from: "2026-04-01",
        to: "2026-04-30",
      },
    ],
  },
  {
    riderId: "3993271",
    drivers: [
      {
        code: "TEST-HS-MAK-3993271",
        name: "مندوب تيست هنجر 3993271",
        from: "2026-04-01",
        to: "2026-04-30",
      },
    ],
  },
  {
    riderId: "3994209",
    drivers: [
      {
        code: "TEST-HS-MAK-3994209-A",
        name: "مندوب تيست هنجر 3994209 - فترة أولى",
        from: "2026-04-01",
        to: "2026-04-15",
      },
      {
        code: "TEST-HS-MAK-3994209-B",
        name: "مندوب تيست هنجر 3994209 - فترة ثانية",
        from: "2026-04-16",
        to: "2026-04-30",
      },
    ],
  },
];

function startDate(value) {
  return new Date(`${value}T00:00:00.000Z`);
}

function endDate(value) {
  return new Date(`${value}T23:59:59.999Z`);
}

async function upsertTestDriver({ code, name, cityId }) {
  return prisma.driver.upsert({
    where: { internalCode: code },
    update: {
      driverCode: code,
      name,
      actualName: name,
      cityId,
      status: "ACTIVE",
      source: "TEST_HUNGERSTATION_PAYROLL_REVIEW",
      needsReview: true,
      vehicleOwnershipType: "no_vehicle",
    },
    create: {
      internalCode: code,
      driverCode: code,
      name,
      actualName: name,
      cityId,
      status: "ACTIVE",
      source: "TEST_HUNGERSTATION_PAYROLL_REVIEW",
      needsReview: true,
      vehicleOwnershipType: "no_vehicle",
      joinDate: startDate("2026-04-01"),
    },
    select: {
      id: true,
      name: true,
      internalCode: true,
      driverCode: true,
    },
  });
}

async function main() {
  const results = [];

  for (const item of plan) {
    const invoice = await prisma.hungerStationInvoiceRecord.findFirst({
      where: {
        month,
        riderIdFromFile: item.riderId,
      },
      select: {
        id: true,
        riderIdFromFile: true,
        applicationId: true,
        applicationProjectId: true,
        cityId: true,
        applicationAccountId: true,
        completedOrders: true,
        basicPayment: true,
      },
    });

    if (!invoice || !invoice.applicationAccountId) {
      results.push({
        riderId: item.riderId,
        status: "INVOICE_OR_ACCOUNT_NOT_FOUND",
      });
      continue;
    }

    const createdDrivers = [];

    for (const d of item.drivers) {
      const driver = await upsertTestDriver({
        code: d.code,
        name: d.name,
        cityId: invoice.cityId,
      });

      createdDrivers.push({ ...d, driver });
    }

    const ownerDriver = createdDrivers[0].driver;
    const isShared = createdDrivers.length > 1;

    await prisma.applicationAccount.update({
      where: { id: invoice.applicationAccountId },
      data: {
        driverId: ownerDriver.id,
        isEmpty: false,
        needsReview: false,
        unmatchedReason: null,
        linkedAt: new Date(),
      },
    });

    await prisma.accountUsage.deleteMany({
      where: {
        month,
        applicationAccountId: invoice.applicationAccountId,
        source: {
          in: [
            "HUNGERSTATION_MONTHLY_INVOICE",
            "TEST_HUNGERSTATION_PAYROLL_REVIEW",
          ],
        },
      },
    });

    for (const d of createdDrivers) {
      await prisma.accountUsage.create({
        data: {
          applicationAccountId: invoice.applicationAccountId,
          applicationId: invoice.applicationId,
          applicationProjectId: invoice.applicationProjectId,
          cityId: invoice.cityId,
          ownerDriverId: ownerDriver.id,
          actualDriverId: d.driver.id,
          month,
          dateFrom: startDate(d.from),
          dateTo: endDate(d.to),
          source: "TEST_HUNGERSTATION_PAYROLL_REVIEW",
          status: "APPROVED",
          usageType: isShared ? "SHARED" : "ACTUAL_WORKER",
          approvedAt: new Date(),
          reviewReason: null,
          rawData: {
            riderIdFromFile: item.riderId,
            testData: true,
            note: isShared
              ? "Shared HungerStation account test usage"
              : "Single HungerStation account test usage",
          },
        },
      });
    }

    await prisma.hungerStationAccountUsage.deleteMany({
      where: {
        month,
        applicationAccountId: invoice.applicationAccountId,
      },
    }).catch(() => {});

    for (const d of createdDrivers) {
      await prisma.hungerStationAccountUsage.create({
        data: {
          month,
          applicationId: invoice.applicationId,
          applicationProjectId: invoice.applicationProjectId,
          cityId: invoice.cityId,
          riderIdFromFile: item.riderId,
          applicationAccountId: invoice.applicationAccountId,
          driverId: d.driver.id,
          usageSource: "TEST_HUNGERSTATION_PAYROLL_REVIEW",
          usageDate: startDate(d.from),
          invoiceCompletedOrders: invoice.completedOrders,
          invoiceRiderBalance: 0,
          status: "APPROVED",
          riskLevel: isShared ? "MEDIUM" : "LOW",
          reviewReason: isShared ? "shared_account_test" : null,
          approvedAt: new Date(),
        },
      });
    }

    await prisma.hungerStationInvoiceRecord.updateMany({
      where: {
        month,
        riderIdFromFile: item.riderId,
      },
      data: {
        driverId: isShared ? null : ownerDriver.id,
        matchingStatus: isShared ? "SHARED" : "MATCHED",
        reviewReason: null,
      },
    });

    results.push({
      riderId: item.riderId,
      accountOwner: `${ownerDriver.name} (${ownerDriver.driverCode || ownerDriver.internalCode})`,
      actualWorkers: createdDrivers.map((d) => `${d.driver.name}: ${d.from} -> ${d.to}`).join(" | "),
      usageType: isShared ? "SHARED" : "ACTUAL_WORKER",
      status: "APPROVED",
    });
  }

  console.table(results);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
