import { DriverStatus, Prisma, RecordStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

export type OperationalScope = {
  applicationId?: string | null;
  applicationProjectId?: string | null;
  cityId?: string | null;
};

export type AccountIdentifiers = {
  appUserId?: string | null;
  appUsername?: string | null;
  username?: string | null;
  driverCode?: string | null;
  nationalId?: string | null;
  mobile?: string | null;
  name?: string | null;
};

const APP_ALIASES = [
  { canonical: "Keeta", code: "KEETA", aliases: ["keeta", "kita", "كيتا"] },
  { canonical: "HungerStation", code: "HUNGERSTATION", aliases: ["hungerstation", "hunger station", "hunger", "هنجر", "هنقر", "هنقرستيشن", "هنجرستيشن"] },
  { canonical: "Talabat", code: "TALABAT", aliases: ["talabat", "طلبات"] },
  { canonical: "Ninja", code: "NINJA", aliases: ["ninja", "نينجا"] },
  { canonical: "ToYou", code: "TOYOU", aliases: ["toyou", "to you", "تويو", "تو يو"] },
];

function text(value: unknown) {
  return String(value ?? "").trim();
}

function compact(value: unknown) {
  return text(value).toLowerCase().replace(/[\s_\-.]+/g, "");
}

function codePart(value: string) {
  return value
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\p{L}\p{N}_-]/gu, "")
    .toUpperCase()
    .slice(0, 36) || "PROJECT";
}

export function canonicalApplication(value: unknown) {
  const raw = text(value);
  const key = compact(raw);
  const match = APP_ALIASES.find((app) => app.aliases.some((alias) => key.includes(compact(alias))));
  return match ?? { canonical: raw || "Unknown", code: codePart(raw || "UNKNOWN"), aliases: [raw] };
}

export function hasBadArabicEncoding(value: unknown) {
  const raw = text(value);
  if (!raw) return false;
  const markers = ["ط§", "ط¨", "طھ", "ط±", "ط©", "ظ„", "ظ…", "ظ†", "ظٹ", "ظ‡", "ط¹", "ط³", "طµ"];
  return markers.filter((marker) => raw.includes(marker)).length >= 2;
}

export async function findOrCreateApplication(db: Db, appName: string) {
  const app = canonicalApplication(appName);
  const insensitive = "insensitive" as Prisma.QueryMode;
  const existing = await db.application.findFirst({
    where: {
      OR: [
        { code: app.code },
        { name: { equals: app.canonical, mode: insensitive } },
        ...app.aliases.map((alias) => ({ name: { equals: alias, mode: insensitive } })),
      ],
    },
    select: { id: true, code: true, name: true },
  });
  if (existing) return existing;

  return db.application.create({
    data: { code: app.code, name: app.canonical, status: RecordStatus.ACTIVE },
    select: { id: true, code: true, name: true },
  });
}

export async function resolveOperationalProject(db: Db, scope: {
  applicationId?: string | null;
  applicationName?: string | null;
  applicationProjectId?: string | null;
  cityId?: string | null;
}) {
  if (scope.applicationProjectId) {
    return db.applicationProject.findUnique({
      where: { id: scope.applicationProjectId },
      select: { id: true, applicationId: true, cityId: true, name: true, code: true, projectId: true },
    });
  }

  let applicationId = scope.applicationId || null;
  let applicationName = scope.applicationName || "";
  if (!applicationId && applicationName) {
    const app = await findOrCreateApplication(db, applicationName);
    applicationId = app.id;
    applicationName = app.name;
  }
  if (!applicationId) return null;

  if (scope.cityId) {
    const existing = await db.applicationProject.findFirst({
      where: { applicationId, cityId: scope.cityId },
      select: { id: true, applicationId: true, cityId: true, name: true, code: true, projectId: true },
    });
    if (existing) return existing;

    const [application, city] = await Promise.all([
      db.application.findUnique({ where: { id: applicationId }, select: { name: true, code: true } }),
      db.city.findUnique({ where: { id: scope.cityId }, select: { nameAr: true, nameEn: true } }),
    ]);
    const appLabel = application?.name || applicationName || "Application";
    const cityLabel = city?.nameAr || city?.nameEn || "City";
    return db.applicationProject.create({
      data: {
        applicationId,
        cityId: scope.cityId,
        code: `${codePart(application?.code || appLabel)}_${codePart(city?.nameEn || cityLabel)}`,
        name: `${appLabel} - ${cityLabel}`,
        status: RecordStatus.ACTIVE,
      },
      select: { id: true, applicationId: true, cityId: true, name: true, code: true, projectId: true },
    });
  }

  return db.applicationProject.findFirst({
    where: { applicationId },
    select: { id: true, applicationId: true, cityId: true, name: true, code: true, projectId: true },
    orderBy: [{ cityId: "desc" }, { createdAt: "asc" }],
  });
}

export async function findDriverByIdentifiers(db: Db, identifiers: AccountIdentifiers) {
  const driverCode = text(identifiers.driverCode);
  const nationalId = text(identifiers.nationalId);
  const mobile = text(identifiers.mobile);
  const appUserId = text(identifiers.appUserId);
  const appUsername = text(identifiers.appUsername || identifiers.username);
  const name = text(identifiers.name);

  const account = appUserId || appUsername
    ? await db.applicationAccount.findFirst({
        where: {
          OR: [
            appUserId ? { appUserId } : undefined,
            appUserId ? { username: appUserId } : undefined,
            appUserId ? { appUsername: appUserId } : undefined,
            appUsername ? { appUsername } : undefined,
            appUsername ? { username: appUsername } : undefined,
          ].filter(Boolean) as Prisma.ApplicationAccountWhereInput[],
          driverId: { not: null },
        },
        select: { driverId: true },
      })
    : null;

  return db.driver.findFirst({
    where: {
      OR: [
        account?.driverId ? { id: account.driverId } : undefined,
        driverCode ? { internalCode: driverCode } : undefined,
        driverCode ? { driverCode } : undefined,
        nationalId ? { nationalId } : undefined,
        mobile ? { mobile } : undefined,
        mobile ? { phone: mobile } : undefined,
        name ? { actualName: { equals: name, mode: "insensitive" } } : undefined,
        name ? { name: { equals: name, mode: "insensitive" } } : undefined,
      ].filter(Boolean) as Prisma.DriverWhereInput[],
    },
    select: { id: true, internalCode: true, driverCode: true, name: true, actualName: true, nationalId: true, cityId: true, projectId: true },
  });
}

export async function findOperationalAccount(db: Db, scope: OperationalScope, identifiers: AccountIdentifiers) {
  const appUserId = text(identifiers.appUserId);
  const appUsername = text(identifiers.appUsername || identifiers.username);
  if (!appUserId && !appUsername) return null;

  const identityOr = [
    appUserId ? { appUserId } : undefined,
    appUserId ? { username: appUserId } : undefined,
    appUserId ? { appUsername: appUserId } : undefined,
    appUsername ? { appUsername } : undefined,
    appUsername ? { username: appUsername } : undefined,
  ].filter(Boolean) as Prisma.ApplicationAccountWhereInput[];

  const stagedWhere: Prisma.ApplicationAccountWhereInput[] = [
    {
      ...(scope.applicationId ? { applicationId: scope.applicationId } : {}),
      ...(scope.applicationProjectId ? { applicationProjectId: scope.applicationProjectId } : {}),
      ...(scope.cityId ? { cityId: scope.cityId } : {}),
      OR: identityOr,
    },
    {
      ...(scope.applicationId ? { applicationId: scope.applicationId } : {}),
      ...(scope.cityId ? { cityId: scope.cityId } : {}),
      OR: identityOr,
    },
    {
      ...(scope.applicationId ? { applicationId: scope.applicationId } : {}),
      OR: identityOr,
    },
    { OR: identityOr },
  ];

  for (const where of stagedWhere) {
    const matches = await db.applicationAccount.findMany({
      where,
      select: {
        id: true,
        appName: true,
        username: true,
        appUserId: true,
        appUsername: true,
        applicationId: true,
        applicationProjectId: true,
        cityId: true,
        driverId: true,
        driver: { select: { id: true, internalCode: true, driverCode: true, name: true, actualName: true, nationalId: true } },
      },
      take: 3,
    });
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) return { duplicate: true as const, matches };
  }
  return null;
}

function reviewReason(args: { applicationProjectId?: string | null; cityId?: string | null; driverId?: string | null; badEncoding?: boolean }) {
  const reasons: string[] = [];
  if (!args.applicationProjectId) reasons.push("missing_application_project");
  if (!args.cityId) reasons.push("missing_city");
  if (!args.driverId) reasons.push("missing_driver");
  if (args.badEncoding) reasons.push("invalid_encoding");
  return reasons.join(",") || null;
}

export async function createImportedDriver(db: Db, args: {
  name: string;
  cityId?: string | null;
  driverCode?: string | null;
  nationalId?: string | null;
  mobile?: string | null;
}) {
  const safeCode = text(args.driverCode) || text(args.nationalId) || text(args.mobile) || `DRV-IMPORT-${Date.now()}`;
  return db.driver.create({
    data: {
      internalCode: safeCode,
      driverCode: safeCode,
      name: args.name || safeCode,
      actualName: args.name || safeCode,
      nationalId: text(args.nationalId) || null,
      phone: text(args.mobile) || null,
      mobile: text(args.mobile) || null,
      cityId: args.cityId || null,
      status: DriverStatus.ACTIVE,
      source: "IMPORT",
      needsReview: true,
    },
    select: { id: true, internalCode: true, driverCode: true, name: true, actualName: true, nationalId: true, cityId: true, projectId: true },
  });
}

export async function cleanupApplicationAccounts(dryRun = false) {
  const before = await prisma.applicationAccount.aggregate({
    _count: { _all: true },
    where: { OR: [{ applicationProjectId: null }, { cityId: null }, { driverId: null }] },
  });

  const result = await prisma.$transaction(async (tx) => {
    const accounts = await tx.applicationAccount.findMany({
      include: {
        driver: { select: { id: true, cityId: true, internalCode: true, driverCode: true, nationalId: true, mobile: true, phone: true, name: true, actualName: true } },
        application: { select: { id: true, name: true } },
        applicationProject: { select: { id: true, cityId: true, applicationId: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    const counts = {
      scanned: accounts.length,
      normalizedAppName: 0,
      fixedApplicationId: 0,
      fixedApplicationProjectId: 0,
      fixedCityId: 0,
      fixedDriverId: 0,
      markedReview: 0,
    };

    for (const account of accounts) {
      const canonical = canonicalApplication(account.appName || account.application?.name || "");
      let applicationId = account.applicationId;
      let cityId = account.cityId || account.driver?.cityId || account.applicationProject?.cityId || null;
      let applicationProjectId = account.applicationProjectId;
      let driverId = account.driverId;

      if (!applicationId && canonical.canonical !== "Unknown") {
        const application = await findOrCreateApplication(tx, canonical.canonical);
        applicationId = application.id;
        counts.fixedApplicationId += 1;
      }

      if (!applicationProjectId && applicationId) {
        const project = await resolveOperationalProject(tx, { applicationId, cityId, applicationName: canonical.canonical });
        applicationProjectId = project?.id ?? null;
        if (!cityId && project?.cityId) cityId = project.cityId;
        if (applicationProjectId) counts.fixedApplicationProjectId += 1;
      }

      if (!driverId) {
        const driver = await findDriverByIdentifiers(tx, {
          appUserId: account.appUserId,
          appUsername: account.appUsername,
          username: account.username,
        });
        driverId = driver?.id ?? null;
        if (!cityId && driver?.cityId) cityId = driver.cityId;
        if (driverId) counts.fixedDriverId += 1;
      }

      if (!account.cityId && cityId) counts.fixedCityId += 1;

      const badEncoding = [account.appUsername, account.username].some(hasBadArabicEncoding);
      const unmatchedReason = reviewReason({ applicationProjectId, cityId, driverId, badEncoding });
      const needsReview = Boolean(unmatchedReason);
      if (needsReview && !account.needsReview) counts.markedReview += 1;
      if (canonical.canonical && canonical.canonical !== account.appName) counts.normalizedAppName += 1;

      if (!dryRun) {
        await tx.applicationAccount.update({
          where: { id: account.id },
          data: {
            appName: canonical.canonical || account.appName,
            applicationId,
            applicationProjectId,
            cityId,
            driverId,
            isEmpty: !driverId,
            needsReview,
            unmatchedReason,
            source: account.source || "CLEANUP",
            linkedAt: driverId ? account.linkedAt ?? new Date() : null,
          },
        });
      }
    }

    if (!dryRun) {
      await tx.auditLog.create({
        data: {
          action: "APPLICATION_ACCOUNT_CLEANUP",
          entityType: "ApplicationAccount",
          after: counts as Prisma.InputJsonValue,
        },
      }).catch(() => null);
    }

    return counts;
  }, { maxWait: 10000, timeout: 60000 });

  const after = await prisma.applicationAccount.aggregate({
    _count: { _all: true },
    where: { OR: [{ applicationProjectId: null }, { cityId: null }, { driverId: null }] },
  });

  return {
    beforeNeedsLinking: before._count._all,
    afterNeedsLinking: after._count._all,
    ...result,
  };
}
