const fs = require("node:fs");
const path = require("node:path");
const {
  ADMIN_PROFILE_PREFIX,
  PATCH_SOURCE,
  PROFILE_PREFIX,
  TEMPORARY_PASSWORD,
  adminProfile,
  archiveRoot,
  buildPlan,
  citySupervisorProfile,
  csvCell,
  hashPassword,
  loadState,
  normalizeEmail,
  prisma,
  safeJson,
} = require("./supervisor-users-common");

function parseMode() {
  const apply = process.argv.includes("--apply");
  const dryRun = process.argv.includes("--dry-run");
  if (apply && dryRun) throw new Error("استخدم --dry-run أو --apply فقط، وليس الاثنين معًا.");
  return apply ? "apply" : "dry-run";
}

async function upsertSupervisorProfiles(tx, user, supervisor) {
  if (user.role !== "SUPERVISOR") return false;
  await tx.systemSetting.upsert({
    where: { key: `${PROFILE_PREFIX}${user.id}` },
    create: { key: `${PROFILE_PREFIX}${user.id}`, value: citySupervisorProfile(supervisor), updatedBy: PATCH_SOURCE },
    update: { value: citySupervisorProfile(supervisor), updatedBy: PATCH_SOURCE },
  });
  await tx.systemSetting.upsert({
    where: { key: `${ADMIN_PROFILE_PREFIX}${user.id}` },
    create: { key: `${ADMIN_PROFILE_PREFIX}${user.id}`, value: adminProfile(supervisor), updatedBy: PATCH_SOURCE },
    update: { value: adminProfile(supervisor), updatedBy: PATCH_SOURCE },
  });
  return true;
}

async function main() {
  const mode = parseMode();
  const state = await loadState();
  const plan = buildPlan(state);
  const preview = plan.rows.map(({ existingUserId: _id, ...row }) => row);
  const baseReport = {
    ok: true,
    mode,
    summary: plan.summary,
    supervisorsWithoutEmail: state.supervisors
      .filter((row) => !normalizeEmail(row.email))
      .map((row) => ({ id: row.id, name: row.name, status: row.status })),
    duplicateEmails: plan.duplicateEmails,
    preview,
  };

  if (mode === "dry-run") {
    console.log(JSON.stringify(baseReport, null, 2));
    return;
  }

  const executableRows = plan.rows.filter((row) => ["create_user", "link_existing_user"].includes(row.action));
  const archive = archiveRoot();
  fs.mkdirSync(archive, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const usersToLinkIds = executableRows.filter((row) => row.existingUserId).map((row) => row.existingUserId);
  const beforeSettings = usersToLinkIds.length
    ? await prisma.systemSetting.findMany({
        where: {
          key: {
            in: usersToLinkIds.flatMap((id) => [`${PROFILE_PREFIX}${id}`, `${ADMIN_PROFILE_PREFIX}${id}`]),
          },
        },
      })
    : [];
  const backupPath = path.join(archive, `supervisor-users-backup-${timestamp}.json`);
  fs.writeFileSync(
    backupPath,
    JSON.stringify(
      {
        source: PATCH_SOURCE,
        createdAt: new Date().toISOString(),
        plan: executableRows,
        usersBefore: state.users.filter((user) => usersToLinkIds.includes(user.id)),
        settingsBefore: beforeSettings,
      },
      null,
      2,
    ),
    "utf8",
  );

  const credentials = [];
  const result = await prisma.$transaction(async (tx) => {
    const counters = {
      createdUsers: 0,
      linkedUsers: 0,
      skipped: plan.rows.length - executableRows.length,
      profilesCreated: 0,
      warnings: plan.rows.filter((row) => row.warning).map((row) => `${row.email || row.name}: ${row.warning}`),
    };

    for (const planned of executableRows) {
      const supervisor = await tx.supervisor.findUnique({
        where: { id: planned.supervisorId },
        include: { city: { select: { id: true, nameAr: true, nameEn: true } } },
      });
      if (!supervisor || supervisor.status !== "ACTIVE" || !supervisor.email || !supervisor.cityId) {
        counters.skipped += 1;
        counters.warnings.push(`${planned.email || planned.name}: تغيرت بيانات المشرف قبل التنفيذ، تم التخطي.`);
        continue;
      }

      const alreadyLinked = await tx.user.findFirst({ where: { supervisorId: supervisor.id } });
      if (alreadyLinked) {
        counters.skipped += 1;
        continue;
      }

      const email = normalizeEmail(supervisor.email);
      const existingByEmail = await tx.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
      if (existingByEmail) {
        if (existingByEmail.supervisorId && existingByEmail.supervisorId !== supervisor.id) {
          counters.skipped += 1;
          counters.warnings.push(`${email}: User مربوط بمشرف آخر، تم التخطي.`);
          continue;
        }
        const before = safeJson(existingByEmail);
        const user = await tx.user.update({
          where: { id: existingByEmail.id },
          data: {
            supervisorId: supervisor.id,
            ...(!existingByEmail.cityId ? { cityId: supervisor.cityId } : {}),
            ...(!existingByEmail.cityScope ? { cityScope: supervisor.cityId } : {}),
          },
        });
        counters.linkedUsers += 1;
        if (await upsertSupervisorProfiles(tx, user, supervisor)) counters.profilesCreated += 1;
        else counters.warnings.push(`${email}: تم الربط دون تغيير الدور ${user.role} أو صلاحياته الحالية.`);
        await tx.auditLog.create({
          data: {
            action: "SUPERVISOR_USER_LINK",
            entityType: "User",
            entityId: user.id,
            before,
            after: safeJson({ id: user.id, email: user.email, role: user.role, supervisorId: user.supervisorId, cityId: user.cityId, cityScope: user.cityScope }),
            oldValue: before,
            newValue: safeJson({ supervisorId: user.supervisorId, cityId: user.cityId, cityScope: user.cityScope }),
          },
        });
        continue;
      }

      const user = await tx.user.create({
        data: {
          name: supervisor.name,
          email,
          passwordHash: hashPassword(TEMPORARY_PASSWORD),
          role: "SUPERVISOR",
          cityId: supervisor.cityId,
          supervisorId: supervisor.id,
          cityScope: supervisor.cityId,
          projectScope: "",
          status: "active",
          isActive: true,
        },
      });
      await upsertSupervisorProfiles(tx, user, supervisor);
      counters.createdUsers += 1;
      counters.profilesCreated += 1;
      credentials.push({ name: user.name, email: user.email, temporaryPassword: TEMPORARY_PASSWORD });
      await tx.auditLog.create({
        data: {
          action: "SUPERVISOR_USER_CREATE",
          entityType: "User",
          entityId: user.id,
          after: safeJson({ id: user.id, name: user.name, email: user.email, role: user.role, supervisorId: user.supervisorId, cityId: user.cityId, cityScope: user.cityScope }),
          newValue: safeJson({ id: user.id, email: user.email, role: user.role, supervisorId: user.supervisorId, source: PATCH_SOURCE }),
        },
      });
    }

    return counters;
  });

  let credentialsPath = null;
  if (credentials.length) {
    credentialsPath = path.join(archive, `supervisor-credentials-${timestamp}.csv`);
    const csv = [["الاسم", "البريد الإلكتروني", "كلمة المرور المبدئية"], ...credentials.map((row) => [row.name, row.email, row.temporaryPassword])]
      .map((row) => row.map(csvCell).join(","))
      .join("\r\n");
    fs.writeFileSync(credentialsPath, `\uFEFF${csv}`, "utf8");
  }

  console.log(JSON.stringify({ ...baseReport, result, backupPath, credentialsPath, loginCredentials: credentials }, null, 2));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
