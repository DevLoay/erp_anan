const {
  prisma,
  parseArgs,
  tagForMonth,
  monthParts,
  loadTargetProjects,
  loadMissingCoverage,
  SCENARIOS,
  appCode,
  cityCode,
  scenarioRiderId,
  scenarioMetrics,
  toDate,
  jsonTag,
  ensureDriver,
  ensureVehicleForDriver,
  ensureAccount,
  upsertByFindFirst,
  disconnect,
} = require("./full-payroll-test-data-common");

function logStep(plan, message) {
  plan.steps.push(message);
}

async function seedInternalFinancials({ tag, month, project, driver, scenario, apply, plan }) {
  const notes = `${tag} ${project.code} ${scenario.key}`;

  if (scenario.advance) {
    logStep(plan, `Advance ${scenario.advance}: ${driver.internalCode}`);
    await upsertByFindFirst({
      model: "advance",
      where: { referenceNumber: `${tag}-${project.code}-${scenario.key}-${driver.internalCode}`.slice(0, 190) },
      create: {
        driverId: driver.id,
        applicationProjectId: project.id,
        cityId: project.cityId,
        referenceNumber: `${tag}-${project.code}-${scenario.key}-${driver.internalCode}`.slice(0, 190),
        amount: scenario.advance,
        remainingAmount: scenario.advance,
        reason: notes,
        deductionMonth: month,
        advanceDate: toDate(month, 5),
        status: "APPROVED",
        isDeducted: false,
        approvedAt: toDate(month, 5),
      },
      update: {
        amount: scenario.advance,
        remainingAmount: scenario.advance,
        reason: notes,
        deductionMonth: month,
        status: "APPROVED",
        isDeducted: false,
      },
      apply,
    });
  }

  for (const deduction of scenario.deductions || []) {
    logStep(plan, `Deduction ${deduction.type} ${deduction.amount}: ${driver.internalCode}`);
    await upsertByFindFirst({
      model: "deduction",
      where: { driverId: driver.id, month, type: deduction.type, notes: { contains: notes } },
      create: {
        driverId: driver.id,
        type: deduction.type,
        amount: deduction.amount,
        month,
        status: "APPROVED",
        notes,
      },
      update: {
        amount: deduction.amount,
        status: "APPROVED",
        notes,
      },
      apply,
    });
  }

  if (scenario.violation) {
    logStep(plan, `Traffic violation ${scenario.violation}: ${driver.internalCode}`);
    await upsertByFindFirst({
      model: "violation",
      where: { driverId: driver.id, type: "TRAFFIC_VIOLATION", notes: { contains: notes } },
      create: {
        driverId: driver.id,
        vehicleId: driver.vehicleId || null,
        type: "TRAFFIC_VIOLATION",
        amount: scenario.violation,
        status: "APPROVED",
        occurredAt: toDate(month, 9),
        notes,
      },
      update: {
        amount: scenario.violation,
        status: "APPROVED",
        occurredAt: toDate(month, 9),
        notes,
      },
      apply,
    });
  }

  if (scenario.fuel) {
    logStep(plan, `Fuel deduction ${scenario.fuel}: ${driver.internalCode}`);
    await upsertByFindFirst({
      model: "fuelRecord",
      where: { driverId: driver.id, fuelDate: toDate(month, 12), notes: { contains: notes } },
      create: {
        driverId: driver.id,
        vehicleId: driver.vehicleId || null,
        amount: scenario.fuel,
        liters: 0,
        fuelDate: toDate(month, 12),
        status: "APPROVED",
        notes,
      },
      update: {
        amount: scenario.fuel,
        fuelDate: toDate(month, 12),
        status: "APPROVED",
        notes,
      },
      apply,
    });
  }
}

async function seedHungerStationRecords({ tag, month, project, driver, account, scenario, apply, plan }) {
  const metrics = scenarioMetrics(project, scenario);
  const riderId = account.appUserId;
  const noUsage = Boolean(scenario.hsNoUsage);
  const invoiceReviewReason = `${tag}:${project.code}:${scenario.key}`;

  logStep(plan, `HungerStation invoice ${riderId}: ${project.code} ${scenario.key}`);
  await upsertByFindFirst({
    model: "hungerStationInvoiceRecord",
    where: { month, applicationProjectId: project.id, riderIdFromFile: riderId, reviewReason: invoiceReviewReason },
    create: {
      month,
      applicationId: project.applicationId,
      applicationProjectId: project.id,
      cityId: project.cityId,
      riderIdFromFile: riderId,
      applicationAccountId: account.id,
      driverId: driver.id,
      contractName: scenario.contractType,
      completedOrders: metrics.orders,
      cityPayment: metrics.cityPayment,
      basicPayment: metrics.basicPayment,
      distancePayment: metrics.distancePayment,
      acceptanceRatePenalties: metrics.appDeductions.acceptanceRatePenalties,
      contactRatePenalties: metrics.appDeductions.contactRatePenalties,
      stackingDeduction: metrics.appDeductions.stackingDeduction,
      declinedPenaltiesDayLogic: metrics.appDeductions.declinedPenaltiesDayLogic,
      latePenalty: metrics.appDeductions.latePenalty,
      noShowPenalty: metrics.appDeductions.noShowPenalty,
      noShowPenaltySpecialCities: metrics.appDeductions.noShowPenaltySpecialCities,
      dailyAcceptanceRatePenalty: metrics.appDeductions.dailyAcceptanceRatePenalty,
      missedDaysPenalty: metrics.appDeductions.missedDaysPenalty,
      riderBalance: metrics.appDeductions.riderBalance,
      matchingStatus: noUsage ? "NEEDS_REVIEW" : "MATCHED",
      reviewReason: invoiceReviewReason,
      rawData: jsonTag(tag, { application: "HungerStation", scenario: scenario.key, projectCode: project.code }),
    },
    update: {
      applicationAccountId: account.id,
      driverId: driver.id,
      completedOrders: metrics.orders,
      cityPayment: metrics.cityPayment,
      basicPayment: metrics.basicPayment,
      distancePayment: metrics.distancePayment,
      acceptanceRatePenalties: metrics.appDeductions.acceptanceRatePenalties,
      contactRatePenalties: metrics.appDeductions.contactRatePenalties,
      stackingDeduction: metrics.appDeductions.stackingDeduction,
      declinedPenaltiesDayLogic: metrics.appDeductions.declinedPenaltiesDayLogic,
      latePenalty: metrics.appDeductions.latePenalty,
      noShowPenalty: metrics.appDeductions.noShowPenalty,
      noShowPenaltySpecialCities: metrics.appDeductions.noShowPenaltySpecialCities,
      dailyAcceptanceRatePenalty: metrics.appDeductions.dailyAcceptanceRatePenalty,
      missedDaysPenalty: metrics.appDeductions.missedDaysPenalty,
      riderBalance: metrics.appDeductions.riderBalance,
      matchingStatus: noUsage ? "NEEDS_REVIEW" : "MATCHED",
      reviewReason: invoiceReviewReason,
      rawData: jsonTag(tag, { application: "HungerStation", scenario: scenario.key, projectCode: project.code }),
    },
    apply,
  });

  if (!noUsage) {
    logStep(plan, `AccountUsage APPROVED ${riderId}: ${driver.internalCode}`);
    await upsertByFindFirst({
      model: "accountUsage",
      where: {
        applicationAccountId: account.id,
        actualDriverId: driver.id,
        month,
        source: tag,
        reviewReason: `${tag}:${project.code}:${scenario.key}:usage`,
      },
      create: {
        applicationAccountId: account.id,
        applicationId: project.applicationId,
        applicationProjectId: project.id,
        cityId: project.cityId,
        ownerDriverId: driver.id,
        actualDriverId: driver.id,
        month,
        dateFrom: toDate(month, 1),
        dateTo: toDate(month, monthParts(month).days),
        source: tag,
        status: "APPROVED",
        usageType: "ACTUAL_WORKER",
        approvedAt: toDate(month, 1),
        reviewReason: `${tag}:${project.code}:${scenario.key}:usage`,
        rawData: jsonTag(tag, { scenario: scenario.key, usage: "single" }),
      },
      update: {
        applicationId: project.applicationId,
        applicationProjectId: project.id,
        cityId: project.cityId,
        ownerDriverId: driver.id,
        actualDriverId: driver.id,
        dateFrom: toDate(month, 1),
        dateTo: toDate(month, monthParts(month).days),
        status: "APPROVED",
        usageType: "ACTUAL_WORKER",
        approvedAt: toDate(month, 1),
        rawData: jsonTag(tag, { scenario: scenario.key, usage: "single" }),
      },
      apply,
    });
  }

  if (apply) {
    const perDayOrders = Math.max(1, Math.round(metrics.orders / monthParts(month).days));
    for (let day = 1; day <= monthParts(month).days; day += 1) {
      const reportDate = toDate(month, day);
      await prisma.hungerStationDailyPerformanceRecord.upsert({
        where: {
          applicationProjectId_cityId_reportDate_riderIdFromFile: {
            applicationProjectId: project.id,
            cityId: project.cityId,
            reportDate,
            riderIdFromFile: riderId,
          },
        },
        update: {
          applicationId: project.applicationId,
          applicationAccountId: account.id,
          driverId: noUsage ? null : driver.id,
          completedDeliveries: perDayOrders,
          acceptedDeliveries: perDayOrders + 1,
          declinedDeliveries: scenario.appDeductions ? 1 : 0,
          actualWorkingHours: Number((metrics.hours / monthParts(month).days).toFixed(2)),
          workingDays: 1,
          attendanceRate: scenario.weakLow ? 0.75 : 0.96,
          acceptanceRate: scenario.weakLow ? 0.7 : 0.97,
          matchingStatus: noUsage ? "NEEDS_REVIEW" : "MATCHED",
          reviewReason: `${tag}:${project.code}:${scenario.key}:daily`,
          rawData: jsonTag(tag, { scenario: scenario.key, day }),
        },
        create: {
          reportDate,
          month,
          applicationId: project.applicationId,
          applicationProjectId: project.id,
          cityId: project.cityId,
          riderIdFromFile: riderId,
          applicationAccountId: account.id,
          driverId: noUsage ? null : driver.id,
          completedDeliveries: perDayOrders,
          acceptedDeliveries: perDayOrders + 1,
          declinedDeliveries: scenario.appDeductions ? 1 : 0,
          actualWorkingHours: Number((metrics.hours / monthParts(month).days).toFixed(2)),
          workingDays: 1,
          attendanceRate: scenario.weakLow ? 0.75 : 0.96,
          acceptanceRate: scenario.weakLow ? 0.7 : 0.97,
          matchingStatus: noUsage ? "NEEDS_REVIEW" : "MATCHED",
          reviewReason: `${tag}:${project.code}:${scenario.key}:daily`,
          rawData: jsonTag(tag, { scenario: scenario.key, day }),
        },
      });
    }
  } else {
    logStep(plan, `HungerStation daily records ${monthParts(month).days}: ${riderId}`);
  }
}

async function seedHungerStationSharedCase({ tag, month, project, apply, plan }) {
  const scenario = {
    key: "SHARED_ACCOUNT",
    label: "حساب هنجر مشترك",
    contractType: "sponsorship",
    vehicleOwnershipType: "no_vehicle",
  };
  const driverA = await ensureDriver({ tag, project, scenario, suffix: "A", apply });
  const driverB = await ensureDriver({ tag, project, scenario, suffix: "B", apply });
  const riderId = scenarioRiderId(tag, project, scenario.key, "SHARED");
  const account = await ensureAccount({ tag, project, driver: driverA, scenario, riderId, suffix: "SHARED", apply });
  const metrics = { ...scenarioMetrics(project, scenario), orders: 400, basicPayment: 4000, distancePayment: 625, cityPayment: 120 };

  logStep(plan, `HungerStation shared invoice ${riderId}: ${project.code}`);
  await upsertByFindFirst({
    model: "hungerStationInvoiceRecord",
    where: { month, applicationProjectId: project.id, riderIdFromFile: riderId, reviewReason: `${tag}:${project.code}:SHARED_ACCOUNT` },
    create: {
      month,
      applicationId: project.applicationId,
      applicationProjectId: project.id,
      cityId: project.cityId,
      riderIdFromFile: riderId,
      applicationAccountId: account.id,
      driverId: driverA.id,
      contractName: "shared",
      completedOrders: metrics.orders,
      cityPayment: metrics.cityPayment,
      basicPayment: metrics.basicPayment,
      distancePayment: metrics.distancePayment,
      acceptanceRatePenalties: 10,
      contactRatePenalties: 10,
      stackingDeduction: 20,
      declinedPenaltiesDayLogic: 20,
      latePenalty: 0,
      noShowPenalty: 0,
      noShowPenaltySpecialCities: 0,
      dailyAcceptanceRatePenalty: 10,
      missedDaysPenalty: 0,
      riderBalance: 50,
      matchingStatus: "MATCHED",
      reviewReason: `${tag}:${project.code}:SHARED_ACCOUNT`,
      rawData: jsonTag(tag, { application: "HungerStation", scenario: "SHARED_ACCOUNT", projectCode: project.code }),
    },
    update: {
      applicationAccountId: account.id,
      driverId: driverA.id,
      completedOrders: metrics.orders,
      cityPayment: metrics.cityPayment,
      basicPayment: metrics.basicPayment,
      distancePayment: metrics.distancePayment,
      matchingStatus: "MATCHED",
      rawData: jsonTag(tag, { application: "HungerStation", scenario: "SHARED_ACCOUNT", projectCode: project.code }),
    },
    apply,
  });

  for (const usage of [
    { driver: driverA, suffix: "A", from: 1, to: 15 },
    { driver: driverB, suffix: "B", from: 16, to: monthParts(month).days },
  ]) {
    logStep(plan, `Shared AccountUsage ${riderId} ${usage.suffix}: ${usage.driver.internalCode}`);
    await upsertByFindFirst({
      model: "accountUsage",
      where: {
        applicationAccountId: account.id,
        actualDriverId: usage.driver.id,
        month,
        source: tag,
        reviewReason: `${tag}:${project.code}:SHARED_ACCOUNT:${usage.suffix}`,
      },
      create: {
        applicationAccountId: account.id,
        applicationId: project.applicationId,
        applicationProjectId: project.id,
        cityId: project.cityId,
        ownerDriverId: driverA.id,
        actualDriverId: usage.driver.id,
        month,
        dateFrom: toDate(month, usage.from),
        dateTo: toDate(month, usage.to),
        source: tag,
        status: "APPROVED",
        usageType: "SHARED",
        approvedAt: toDate(month, 1),
        reviewReason: `${tag}:${project.code}:SHARED_ACCOUNT:${usage.suffix}`,
        rawData: jsonTag(tag, { scenario: "SHARED_ACCOUNT", split: usage.suffix }),
      },
      update: {
        dateFrom: toDate(month, usage.from),
        dateTo: toDate(month, usage.to),
        status: "APPROVED",
        usageType: "SHARED",
        rawData: jsonTag(tag, { scenario: "SHARED_ACCOUNT", split: usage.suffix }),
      },
      apply,
    });
  }
}

async function seedKeetaRecords({ tag, month, project, driver, account, scenario, apply, plan }) {
  const metrics = scenarioMetrics(project, scenario);
  const courierId = account.appUserId;
  const hasRank = !scenario.keetaNoRank;
  const hasInvoice = !scenario.keetaNoInvoice;
  const fullName = driver.actualName || driver.name;
  const [firstName, ...rest] = fullName.split(" ");
  const level = scenario.weakLow ? "C" : scenario.key.includes("PERSONAL") || scenario.key === "FREELANCER" ? "B" : "A";

  if (hasRank) {
    logStep(plan, `Keeta rank ${courierId}: ${project.code} ${scenario.key}`);
    await upsertByFindFirst({
      model: "keetaRankRecord",
      where: { courierId, month, applicationProjectId: project.id, rawData: { path: ["testTag"], equals: tag } },
      create: {
        projectId: "keeta",
        applicationProjectId: project.id,
        driverId: driver.id,
        applicationAccountId: account.id,
        courierId,
        courierName: fullName,
        cityId: project.cityId,
        month,
        periodStart: toDate(month, 1),
        periodEnd: toDate(month, monthParts(month).days),
        currentEstimatedLevel: level,
        currentEstimatedRanking: scenario.weakLow ? 80 : 12,
        courierRankingPercentile: scenario.weakLow ? 0.25 : 0.92,
        currentScoreForForcedAssignment: scenario.weakLow ? 70 : 96,
        currentEstimatedRewardAmount: level === "A" ? 800 : level === "B" ? 500 : 200,
        onTimeRate: scenario.weakLow ? 0.78 : 0.96,
        orderCompletionRate: scenario.weakLow ? 0.85 : 0.98,
        dropOffNotEarlyRate: 0.99,
        orderVolume: metrics.orders,
        rawData: jsonTag(tag, { application: "Keeta", scenario: scenario.key, projectCode: project.code }),
        status: "Approved",
        approvedBy: tag,
        approvedAt: toDate(month, 1),
      },
      update: {
        driverId: driver.id,
        applicationAccountId: account.id,
        currentEstimatedLevel: level,
        orderVolume: metrics.orders,
        rawData: jsonTag(tag, { application: "Keeta", scenario: scenario.key, projectCode: project.code }),
        status: "Approved",
        approvedBy: tag,
        approvedAt: toDate(month, 1),
      },
      apply,
    });
  }

  if (hasInvoice) {
    const appDeduction = scenario.appDeductions ? 100 : 0;
    const food = scenario.appDeductions ? 50 : 0;
    const tga = scenario.appDeductions ? 25 : 0;
    const payable = Number((metrics.basicPayment + metrics.distancePayment + 350 - appDeduction - food - tga).toFixed(2));
    logStep(plan, `Keeta invoice ${courierId}: ${project.code} ${scenario.key}`);
    await upsertByFindFirst({
      model: "keetaInvoiceRecord",
      where: { courierId, month, applicationProjectId: project.id, rawData: { path: ["testTag"], equals: tag } },
      create: {
        projectId: "keeta",
        applicationProjectId: project.id,
        driverId: driver.id,
        applicationAccountId: account.id,
        courierId,
        courierName: fullName,
        partnerId: `TEST-PARTNER-${cityCode(project)}`,
        partnerName: "TEST Partner",
        billingCycle: month,
        cityId: project.cityId,
        month,
        periodStart: toDate(month, 1),
        periodEnd: toDate(month, monthParts(month).days),
        isValid: scenario.weakLow ? false : true,
        reason: scenario.weakLow ? `${tag} weak test invoice` : `${tag} valid test invoice`,
        onlineDaysValid: metrics.workingDays,
        dailyOnlineHoursValid: Number((metrics.hours / Math.max(1, metrics.workingDays)).toFixed(2)),
        dailyOnlineHoursPeakValid: 3,
        deliveredOrders: metrics.orders,
        orderBasedPricing: metrics.basicPayment,
        distanceFromPriceIncrease: metrics.distancePayment,
        validDaCapacityIncentives: level === "A" ? 600 : 250,
        experienceIncentive: scenario.weakLow ? 0 : 300,
        dxgy: 0,
        subsidy: 0,
        activitiesAndOtherRewards: 50,
        deduction: appDeduction,
        foodCompensation: food,
        registrationServiceFee: 0,
        otherAdjustment: 0,
        tipsExcludingTax: 0,
        tgaDeductionVatExcluded: tga,
        totalPayableAmount: payable,
        rawData: jsonTag(tag, { application: "Keeta", scenario: scenario.key, projectCode: project.code }),
        status: "Approved",
        approvedBy: tag,
        approvedAt: toDate(month, 1),
      },
      update: {
        driverId: driver.id,
        applicationAccountId: account.id,
        isValid: scenario.weakLow ? false : true,
        deliveredOrders: metrics.orders,
        orderBasedPricing: metrics.basicPayment,
        distanceFromPriceIncrease: metrics.distancePayment,
        deduction: appDeduction,
        foodCompensation: food,
        tgaDeductionVatExcluded: tga,
        totalPayableAmount: payable,
        rawData: jsonTag(tag, { application: "Keeta", scenario: scenario.key, projectCode: project.code }),
        status: "Approved",
        approvedBy: tag,
        approvedAt: toDate(month, 1),
      },
      apply,
    });

    if (scenario.appDeductions) {
      for (const detail of [
        { feeType: "Deduction", violationType: "مخالفة تطبيق", detailAmount: appDeduction },
        { feeType: "food compensation", violationType: "تلف طعام", detailAmount: food },
        { feeType: "TGA Deduction(VAT Excluded)", violationType: "خصم TGA", detailAmount: tga },
      ]) {
        await upsertByFindFirst({
          model: "keetaInvoiceDetailRecord",
          where: { courierId, applicationProjectId: project.id, feeType: detail.feeType, rawData: { path: ["testTag"], equals: tag } },
          create: {
            projectId: "keeta",
            applicationProjectId: project.id,
            driverId: driver.id,
            applicationAccountId: account.id,
            courierId,
            courierName: fullName,
            partnerId: `TEST-PARTNER-${cityCode(project)}`,
            partnerName: "TEST Partner",
            billingCycle: month,
            transactionType: "TEST_DEDUCTION",
            businessId: `${tag}-${scenario.key}`,
            note: `${tag} ${detail.violationType}`,
            feeType: detail.feeType,
            detailAmount: detail.detailAmount,
            totalPayableAmount: detail.detailAmount,
            deliveryDistance: 0,
            violationId: `${tag}-${detail.feeType}`.slice(0, 190),
            violationType: detail.violationType,
            rawData: jsonTag(tag, { application: "Keeta", scenario: scenario.key, feeType: detail.feeType }),
          },
          update: {
            driverId: driver.id,
            applicationAccountId: account.id,
            detailAmount: detail.detailAmount,
            totalPayableAmount: detail.detailAmount,
            rawData: jsonTag(tag, { application: "Keeta", scenario: scenario.key, feeType: detail.feeType }),
          },
          apply,
        });
      }
    }
  }

  if (apply) {
    const perDayOrders = Math.max(1, Math.round(metrics.orders / monthParts(month).days));
    for (let day = 1; day <= monthParts(month).days; day += 1) {
      await upsertByFindFirst({
        model: "keetaPerformanceRecord",
        where: {
          courierId,
          applicationProjectId: project.id,
          reportDate: toDate(month, day),
          rawData: { path: ["testTag"], equals: tag },
        },
        create: {
          projectId: "keeta",
          applicationProjectId: project.id,
          driverId: driver.id,
          applicationAccountId: account.id,
          courierId,
          courierFirstName: firstName || fullName,
          courierLastName: rest.join(" "),
          supervisorName: "TEST Supervisor",
          vehicleType: scenario.vehicleOwnershipType,
          cityId: project.cityId,
          reportDate: toDate(month, day),
          month,
          periodStart: toDate(month, 1),
          periodEnd: toDate(month, monthParts(month).days),
          shiftAttendanceSummary: "Valid",
          onShift: true,
          validDay: day <= metrics.workingDays,
          courierAppOnlineTime: 8,
          validOnlineTime: 7.5,
          peakOnlineHours: 3,
          acceptedTasks: perDayOrders + 1,
          deliveredTasks: perDayOrders,
          rejectedTasks: scenario.weakLow ? 2 : 0,
          cancellationRateFromDeliveryIssues: scenario.weakLow ? 0.07 : 0.01,
          orderCompletionRateNonDelivery: scenario.weakLow ? 0.85 : 0.98,
          onTimeRate: scenario.weakLow ? 0.78 : 0.96,
          rawData: jsonTag(tag, { application: "Keeta", scenario: scenario.key, day }),
          status: "Approved",
          approvedBy: tag,
          approvedAt: toDate(month, 1),
        },
        update: {
          driverId: driver.id,
          applicationAccountId: account.id,
          deliveredTasks: perDayOrders,
          validDay: day <= metrics.workingDays,
          rawData: jsonTag(tag, { application: "Keeta", scenario: scenario.key, day }),
          status: "Approved",
          approvedBy: tag,
          approvedAt: toDate(month, 1),
        },
        apply,
      });
    }
  } else {
    logStep(plan, `Keeta performance records ${monthParts(month).days}: ${courierId}`);
  }
}

async function seedProject({ tag, month, project, apply, plan }) {
  const app = appCode(project);
  const scenarios = SCENARIOS.filter((scenario) => {
    if (app === "HUNGERSTATION") return !scenario.keetaNoRank && !scenario.keetaNoInvoice;
    if (app === "KEETA") return !scenario.hsNoUsage;
    return false;
  });

  for (const scenario of scenarios) {
    const driver = await ensureDriver({ tag, project, scenario, apply });
    await ensureVehicleForDriver({ tag, project, driver, scenario, apply });
    const riderId = scenarioRiderId(tag, project, scenario.key);
    const account = await ensureAccount({ tag, project, driver, scenario, riderId, apply });
    await seedInternalFinancials({ tag, month, project, driver, scenario, apply, plan });

    if (app === "HUNGERSTATION") {
      await seedHungerStationRecords({ tag, month, project, driver, account, scenario, apply, plan });
    } else if (app === "KEETA") {
      await seedKeetaRecords({ tag, month, project, driver, account, scenario, apply, plan });
    }
  }

  if (app === "HUNGERSTATION") {
    await seedHungerStationSharedCase({ tag, month, project, apply, plan });
  }
}

async function main() {
  const args = parseArgs();
  const tag = tagForMonth(args.month);
  const projects = await loadTargetProjects();
  const missing = await loadMissingCoverage();
  const plan = { tag, month: args.month, mode: args.apply ? "apply" : "dry-run", projects: projects.length, missing, steps: [] };

  for (const project of projects) {
    logStep(plan, `Project ${project.code} (${project.city?.nameAr || project.city?.nameEn || "no city"})`);
    await seedProject({ tag, month: args.month, project, apply: args.apply, plan });
  }

  if (args.apply) {
    await prisma.auditLog.create({
      data: {
        user: "System Admin",
        action: "SEED_FULL_PAYROLL_TEST_DATA",
        entityType: "TestData",
        entityId: tag,
        after: jsonTag(tag, { month: args.month, projects: projects.length, steps: plan.steps.length }),
      },
    });
  }

  console.log(JSON.stringify({
    ok: true,
    tag,
    month: args.month,
    mode: plan.mode,
    projects: projects.map((project) => ({ code: project.code, app: appCode(project), city: project.city?.nameAr || project.city?.nameEn })),
    missing,
    plannedSteps: plan.steps.length,
    sampleSteps: plan.steps.slice(0, 40),
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(disconnect);
