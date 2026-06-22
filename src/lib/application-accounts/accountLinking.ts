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

export type UpsertOperationalAccountInput = {
  appName?: string | null;
  applicationId?: string | null;
  applicationProjectId?: string | null;
  cityId?: string | null;
  driverId?: string | null;
  appUserId?: string | null;
  appUsername?: string | null;
  username?: string | null;
  status?: RecordStatus | null;
  source?: string | null;
  existingId?: string | null;
  updateDriverPrimaryAccount?: boolean;
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

async function uniqueAccountUsername(db: Db, preferred: string, scopeKey?: string | null, existingId?: string | null) {
  const base = preferred || `account-${scopeKey || "import"}`;
  const current = await db.applicationAccount.findUnique({ where: { username: base }, select: { id: true } });
  if (!current || current.id === existingId) return base;

  const suffix = (scopeKey || "scoped").replace(/[^a-zA-Z0-9_-]/g, "").slice(-8) || "scoped";
  const scoped = `${base}-${suffix}`;
  const scopedCurrent = await db.applicationAccount.findUnique({ where: { username: scoped }, select: { id: true } });
  if (!scopedCurrent || scopedCurrent.id === existingId) return scoped;
  return `${base}-${suffix}-${Date.now().toString(36)}`;
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
  if (/[ØÙÃÂ�]/.test(raw)) return true;
  return markers.filter((marker) => raw.includes(marker)).length >= 4;
}

export async function findOrCreateApplication(db: Db, appName: string) {
  const app = canonicalApplication(appName);
  const insensitive = "insensitive" as Prisma.QueryMode;
  const byCode = await db.application.findFirst({
    where: { code: app.code },
    select: { id: true, code: true, name: true },
  });
  if (byCode) return byCode;

  const existing = await db.application.findFirst({
    where: {
      OR: [
        { code: { equals: app.code, mode: insensitive } },
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

export async function findDriverByIdentifiers(db: Db, identifiers: AccountIdentifiers, scope: OperationalScope = {}) {
  const driverCode = text(identifiers.driverCode);
  const nationalId = text(identifiers.nationalId);
  const mobile = text(identifiers.mobile);
  const appUserId = text(identifiers.appUserId);
  const appUsername = text(identifiers.appUsername || identifiers.username);
  const name = text(identifiers.name);

  const identityOr = [
    appUserId ? { appUserId } : undefined,
    appUserId ? { username: appUserId } : undefined,
    appUserId ? { appUsername: appUserId } : undefined,
    appUsername ? { appUsername } : undefined,
    appUsername ? { username: appUsername } : undefined,
  ].filter(Boolean) as Prisma.ApplicationAccountWhereInput[];

  const account =
    identityOr.length
      ? await db.applicationAccount.findFirst({
          where: {
            ...(scope.applicationId ? { applicationId: scope.applicationId } : {}),
            ...(scope.applicationProjectId ? { applicationProjectId: scope.applicationProjectId } : {}),
            ...(scope.cityId ? { cityId: scope.cityId } : {}),
            OR: identityOr,
            driverId: { not: null },
          },
          select: { driverId: true },
        })
      : null;

  // Important for Keeta city moves:
  // If the account is not found in the selected city/project, look for the same
  // account inside the same application without city/project restrictions.
  // This prevents imports from saying "driver not found" when the rider already
  // exists but the Keeta account is still linked to another city/project.
  const accountInOtherScopeMatches =
    !account && identityOr.length && scope.applicationId
      ? await db.applicationAccount.findMany({
          where: {
            applicationId: scope.applicationId,
            OR: identityOr,
            driverId: { not: null },
          },
          select: { driverId: true },
          take: 3,
        })
      : [];

  const uniqueOtherScopeDriverIds = Array.from(new Set(accountInOtherScopeMatches.map((match) => match.driverId).filter(Boolean) as string[]));
  const accountInOtherScopeDriverId = uniqueOtherScopeDriverIds.length === 1 ? uniqueOtherScopeDriverIds[0] : null;

  const select = { id: true, internalCode: true, driverCode: true, name: true, actualName: true, nationalId: true, cityId: true, projectId: true };

  const matchedAccountDriverId = account?.driverId || accountInOtherScopeDriverId;
  if (matchedAccountDriverId) {
    const driver = await db.driver.findUnique({ where: { id: matchedAccountDriverId }, select });
    if (driver) return driver;
  }

  const stages: Prisma.DriverWhereInput[] = [
    driverCode ? { internalCode: driverCode } : undefined,
    driverCode ? { driverCode } : undefined,
    mobile ? { mobile } : undefined,
    mobile ? { phone: mobile } : undefined,
    nationalId ? { nationalId } : undefined,
    name ? { actualName: { equals: name, mode: "insensitive" } } : undefined,
    name ? { name: { equals: name, mode: "insensitive" } } : undefined,
  ].filter(Boolean) as Prisma.DriverWhereInput[];

  for (const where of stages) {
    const matches = await db.driver.findMany({ where, select, take: 2 });
    if (matches.length === 1) return matches[0];
    // National ID/Iqama can be shared across operational app accounts. Ambiguous
    // matches are intentionally left for preview/manual linking instead of
    // blocking new driver imports as duplicates.
    if (matches.length > 1) return null;
  }

  return null;
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

  const scoped = Boolean(scope.applicationId || scope.applicationProjectId || scope.cityId);
  const stagedWhere: Prisma.ApplicationAccountWhereInput[] = [];

  if (scope.applicationProjectId) {
    stagedWhere.push({
      applicationProjectId: scope.applicationProjectId,
      OR: identityOr,
    });
  }

  if (scoped) {
    stagedWhere.push({
      ...(scope.applicationId ? { applicationId: scope.applicationId } : {}),
      ...(scope.applicationProjectId ? { applicationProjectId: scope.applicationProjectId } : {}),
      ...(scope.cityId ? { cityId: scope.cityId } : {}),
      OR: identityOr,
    });
  }

  if (scope.applicationId && scope.cityId && scope.applicationProjectId) {
    stagedWhere.push({
      applicationId: scope.applicationId,
      cityId: scope.cityId,
      applicationProjectId: null,
      OR: identityOr,
    });
  }

  if (scope.applicationId && scope.cityId) {
    stagedWhere.push({
      applicationId: scope.applicationId,
      cityId: scope.cityId,
      OR: identityOr,
    });
  }

  if (scope.applicationId && !scope.applicationProjectId && !scope.cityId) {
    stagedWhere.push({
      applicationId: scope.applicationId,
      OR: identityOr,
    });
  }

  if (!scoped) stagedWhere.push({ OR: identityOr });

  // Keeta reports can arrive under a different city/project while the account is
  // already linked elsewhere. After trying the exact operational scope, fall back
  // to the same application without project/city restrictions. If there is one
  // unique match, upsertOperationalApplicationAccount will update that account
  // into the current operational scope instead of creating a duplicate.
  if (scope.applicationId && (scope.applicationProjectId || scope.cityId)) {
    stagedWhere.push({
      applicationId: scope.applicationId,
      OR: identityOr,
    });
  }

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

export async function upsertOperationalApplicationAccount(db: Db, input: UpsertOperationalAccountInput) {
  const rawAppName = text(input.appName);
  const canonical = canonicalApplication(rawAppName);
  let applicationId = input.applicationId || null;
  let applicationProjectId = input.applicationProjectId || null;
  let cityId = input.cityId || null;

  let operationalProject = await resolveOperationalProject(db, {
    applicationId,
    applicationName: rawAppName || canonical.canonical,
    applicationProjectId,
    cityId,
  });

  if (operationalProject) {
    applicationProjectId = operationalProject.id;
    applicationId = applicationId || operationalProject.applicationId;
    cityId = cityId || operationalProject.cityId;
  }

  if (!applicationId && canonical.canonical !== "Unknown") {
    const application = await findOrCreateApplication(db, canonical.canonical);
    applicationId = application.id;
  }

  if (!applicationProjectId && applicationId) {
    operationalProject = await resolveOperationalProject(db, {
      applicationId,
      applicationName: rawAppName || canonical.canonical,
      cityId,
    });
    applicationProjectId = operationalProject?.id ?? null;
    cityId = cityId || operationalProject?.cityId || null;
  }

  const appUserId = text(input.appUserId);
  const appUsername = text(input.appUsername || input.username);
  const preferredUsername = appUsername || text(input.username) || appUserId;

  let existing: { id: string; username?: string | null; linkedAt?: Date | null; driverId?: string | null } | null = input.existingId
    ? await db.applicationAccount.findUnique({
        where: { id: input.existingId },
        select: { id: true, username: true, linkedAt: true, driverId: true },
      })
    : null;

  if (!existing && (appUserId || appUsername)) {
    const found = await findOperationalAccount(db, { applicationId, applicationProjectId, cityId }, { appUserId, appUsername, username: input.username });
    if (found && "duplicate" in found) {
      const preferred =
        found.matches.find((match) => match.applicationProjectId === applicationProjectId && match.cityId === cityId) ??
        found.matches.find((match) => !match.applicationProjectId && match.applicationId === applicationId && match.cityId === cityId) ??
        found.matches.find((match) => match.driverId && match.driverId === input.driverId) ??
        null;
      existing = preferred ? { id: preferred.id, username: preferred.username, driverId: preferred.driverId } : null;
    } else if (found) {
      existing = { id: found.id, username: found.username, driverId: found.driverId };
    }
  }

  const username = await uniqueAccountUsername(db, preferredUsername, applicationProjectId || cityId || applicationId, existing?.id);
  const badEncoding = [appUsername, username].some(hasBadArabicEncoding);
  const unmatchedReason = reviewReason({
    applicationProjectId,
    cityId,
    driverId: input.driverId,
    badEncoding,
  });
  const needsReview = Boolean(unmatchedReason);
  const appName = canonical.canonical === "Unknown" ? rawAppName || "Unknown" : canonical.canonical;

  const accountData = {
    appName,
    username,
    appUserId: appUserId || null,
    appUsername: appUsername || username,
    applicationId,
    applicationProjectId,
    projectId: null,
    cityId,
    driverId: input.driverId || null,
    isEmpty: !input.driverId,
    needsReview,
    unmatchedReason,
    source: input.source || "IMPORT",
    status: input.status ?? RecordStatus.ACTIVE,
    linkedAt: input.driverId ? existing?.linkedAt ?? new Date() : null,
  };

  const wasCreated = !existing;
  const account = existing
    ? await db.applicationAccount.update({
        where: { id: existing.id },
        data: accountData,
        select: { id: true, driverId: true, applicationProjectId: true, cityId: true, needsReview: true, unmatchedReason: true },
      })
    : await db.applicationAccount.create({
        data: accountData,
        select: { id: true, driverId: true, applicationProjectId: true, cityId: true, needsReview: true, unmatchedReason: true },
      });

  if (input.driverId && input.updateDriverPrimaryAccount !== false) {
    await db.driver.update({ where: { id: input.driverId }, data: { accountId: account.id } }).catch(() => null);
  }

  return { ...account, wasCreated };
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
        let project: Awaited<ReturnType<typeof resolveOperationalProject>> | null = null;

        if (cityId) {
          project = await resolveOperationalProject(tx, { applicationId, cityId, applicationName: canonical.canonical });
        } else {
          const projects = await tx.applicationProject.findMany({
            where: { applicationId },
            select: { id: true, applicationId: true, cityId: true, name: true, code: true, projectId: true },
            take: 2,
          });
          project = projects.length === 1 ? projects[0] : null;
        }

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
