const fs = require("node:fs");
const path = require("node:path");
const {
  prisma,
  PROFILE_PREFIX,
  ADMIN_PROFILE_PREFIX,
  parseArgs,
  readAdminSheet,
  buildImportPlan,
  hashPassword,
  generatePassword,
  safeJson,
  archiveRoot,
  csvCell,
} = require("./admin-users-import-common");

async function main() {
  const args = parseArgs();
  const sheet = await readAdminSheet(args.file);
  const plan = await buildImportPlan(sheet);
  const publicRows = plan.rows.map(({ password: _password, ...row }) => row);
  const report = {
    ok: plan.summary.invalidRows === 0,
    mode: args.apply ? "apply" : "dry-run",
    file: sheet.absolute,
    headerRow: sheet.headerRow,
    headers: sheet.headers,
    mapping: sheet.mapping,
    summary: plan.summary,
    preview: publicRows,
  };

  if (!args.apply) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  if (plan.summary.invalidRows) throw new Error(`لا يمكن التنفيذ: يوجد ${plan.summary.invalidRows} صف يحتاج مراجعة.`);

  const archive = archiveRoot();
  fs.mkdirSync(archive, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const existingIds = plan.rows.map((row) => row.existingUserId).filter(Boolean);
  const [existingUsers, existingSettings] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: existingIds } } }),
    prisma.systemSetting.findMany({ where: { OR: [
      { key: { in: existingIds.map((id) => `${PROFILE_PREFIX}${id}`) } },
      { key: { in: existingIds.map((id) => `${ADMIN_PROFILE_PREFIX}${id}`) } },
    ] } }),
  ]);
  const backupPath = path.join(archive, `backup-${timestamp}.json`);
  fs.writeFileSync(backupPath, JSON.stringify({ file: sheet.absolute, users: existingUsers, settings: existingSettings }, null, 2), "utf8");

  const credentials = [];
  const result = await prisma.$transaction(async (tx) => {
    const batch = await tx.importBatch.create({
      data: {
        fileName: path.basename(sheet.absolute),
        importType: "ADMIN_USERS",
        status: "PENDING",
        rowsFound: plan.rows.length,
        rowsImported: 0,
        rowsSkipped: 0,
        errors: safeJson({ source: sheet.absolute, backupPath }),
        createdBy: "System Admin Import",
      },
    });
    const records = [];

    for (const row of plan.rows) {
      const beforeUser = row.existingUserId ? await tx.user.findUnique({ where: { id: row.existingUserId } }) : null;
      const beforePermission = row.existingUserId ? await tx.systemSetting.findUnique({ where: { key: `${PROFILE_PREFIX}${row.existingUserId}` } }) : null;
      const beforeAdminProfile = row.existingUserId ? await tx.systemSetting.findUnique({ where: { key: `${ADMIN_PROFILE_PREFIX}${row.existingUserId}` } }) : null;
      const password = row.password || generatePassword();
      const data = {
        name: row.name,
        email: row.email,
        role: row.role,
        cityId: row.cityId,
        cityScope: row.cityIds.join(","),
        projectScope: row.applicationProjectIds.join(","),
        status: row.status,
        isActive: row.isActive,
      };
      let user;
      if (beforeUser) {
        user = await tx.user.update({
          where: { id: beforeUser.id },
          data: {
            ...data,
            ...(args.updatePassword && row.password ? { passwordHash: hashPassword(row.password) } : {}),
          },
        });
      } else {
        user = await tx.user.create({ data: { ...data, passwordHash: hashPassword(password) } });
        credentials.push({ name: user.name, email: user.email, password });
      }

      if (["city_supervisor", "app_supervisor"].includes(row.roleKey) && row.cityId) {
        let supervisor = await tx.supervisor.findFirst({
          where: { cityId: row.cityId, OR: [{ email: row.email }, ...(row.phone ? [{ phone: row.phone }] : []), { name: row.name }] },
        });
        if (!supervisor) {
          supervisor = await tx.supervisor.create({ data: { name: row.name, email: row.email, phone: row.phone || null, cityId: row.cityId, status: "ACTIVE" } });
        }
        user = await tx.user.update({ where: { id: user.id }, data: { supervisorId: supervisor.id } });
      }

      const permissionValue = {
        profileKey: row.roleKey,
        labelAr: row.roleLabel,
        permissions: row.permissions,
        scopeType: row.scopeType,
        cityIds: row.cityIds,
        applicationIds: row.applicationIds,
        applicationProjectIds: row.applicationProjectIds,
        importBatchId: batch.id,
      };
      const adminValue = {
        phone: row.phone,
        jobTitle: row.jobTitle,
        notes: row.notes,
        applicationId: row.applicationId,
        applicationName: row.applicationName,
        applicationProjectId: row.applicationProjectId,
        applicationProjectName: row.applicationProjectName,
        importBatchId: batch.id,
      };
      await tx.systemSetting.upsert({
        where: { key: `${PROFILE_PREFIX}${user.id}` },
        create: { key: `${PROFILE_PREFIX}${user.id}`, value: permissionValue, updatedBy: batch.id },
        update: { value: permissionValue, updatedBy: batch.id },
      });
      await tx.systemSetting.upsert({
        where: { key: `${ADMIN_PROFILE_PREFIX}${user.id}` },
        create: { key: `${ADMIN_PROFILE_PREFIX}${user.id}`, value: adminValue, updatedBy: batch.id },
        update: { value: adminValue, updatedBy: batch.id },
      });
      await tx.auditLog.create({
        data: {
          action: beforeUser ? "ADMIN_USER_IMPORT_UPDATE" : "ADMIN_USER_IMPORT_CREATE",
          entityType: "User",
          entityId: user.id,
          before: safeJson(beforeUser),
          after: safeJson({ ...user, permissionProfile: permissionValue, adminProfile: adminValue, importBatchId: batch.id }),
          oldValue: safeJson(beforeUser),
          newValue: safeJson({ ...user, permissionProfile: permissionValue, adminProfile: adminValue }),
        },
      });
      records.push({
        rowNumber: row.rowNumber,
        userId: user.id,
        action: beforeUser ? "update" : "create",
        beforeUser: safeJson(beforeUser),
        beforePermission: safeJson(beforePermission?.value),
        beforeAdminProfile: safeJson(beforeAdminProfile?.value),
      });
    }

    await tx.importBatch.update({
      where: { id: batch.id },
      data: {
        status: "APPROVED",
        rowsImported: records.length,
        rowsSkipped: 0,
        errors: safeJson({ source: sheet.absolute, backupPath, records }),
      },
    });
    await tx.auditLog.create({ data: { action: "ADMIN_USERS_IMPORT_APPROVE", entityType: "ImportBatch", entityId: batch.id, after: safeJson({ rows: records.length, file: sheet.absolute }) } });
    return { batchId: batch.id, records };
  });

  let credentialsPath = null;
  if (credentials.length) {
    credentialsPath = path.join(archive, `credentials-${result.batchId}.csv`);
    const csv = [["الاسم", "البريد الإلكتروني", "كلمة المرور المبدئية"], ...credentials.map((item) => [item.name, item.email, item.password])]
      .map((row) => row.map(csvCell).join(","))
      .join("\r\n");
    fs.writeFileSync(credentialsPath, `\uFEFF${csv}`, "utf8");
  }
  console.log(JSON.stringify({ ...report, ok: true, batchId: result.batchId, backupPath, credentialsPath, credentialsCreated: credentials.length }, null, 2));
}

main().catch((error) => { console.error(JSON.stringify({ ok: false, error: error.message }, null, 2)); process.exitCode = 1; }).finally(() => prisma.$disconnect());
