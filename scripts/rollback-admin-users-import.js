const { prisma, PROFILE_PREFIX, ADMIN_PROFILE_PREFIX, parseArgs, safeJson } = require("./admin-users-import-common");

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

async function main() {
  const args = parseArgs();
  if (!args.batchId) throw new Error("حدد Batch ID عبر --batch=...");
  const batch = await prisma.importBatch.findFirst({ where: { id: args.batchId, importType: "ADMIN_USERS" } });
  if (!batch) throw new Error("Batch الإداريين غير موجود.");
  const metadata = object(batch.errors);
  const records = Array.isArray(metadata.records) ? metadata.records : [];
  const report = {
    ok: true,
    mode: args.apply ? "apply" : "dry-run",
    batchId: batch.id,
    createdUsersToDeactivate: records.filter((record) => record.action === "create").length,
    updatedUsersToRestore: records.filter((record) => record.action === "update").length,
  };
  if (!args.apply) { console.log(JSON.stringify(report, null, 2)); return; }

  await prisma.$transaction(async (tx) => {
    for (const record of records) {
      if (record.action === "create") {
        await tx.user.update({ where: { id: record.userId }, data: { isActive: false, status: "inactive" } }).catch(() => null);
        await tx.systemSetting.deleteMany({ where: { key: { in: [`${PROFILE_PREFIX}${record.userId}`, `${ADMIN_PROFILE_PREFIX}${record.userId}`] } } });
      } else if (record.beforeUser) {
        const before = record.beforeUser;
        await tx.user.update({
          where: { id: record.userId },
          data: {
            name: before.name,
            email: before.email,
            role: before.role,
            cityId: before.cityId,
            supervisorId: before.supervisorId,
            driverId: before.driverId,
            cityScope: before.cityScope,
            projectScope: before.projectScope,
            status: before.status,
            isActive: before.isActive,
          },
        });
        for (const [key, value] of [[`${PROFILE_PREFIX}${record.userId}`, record.beforePermission], [`${ADMIN_PROFILE_PREFIX}${record.userId}`, record.beforeAdminProfile]]) {
          if (value) await tx.systemSetting.upsert({ where: { key }, create: { key, value: safeJson(value), updatedBy: batch.id }, update: { value: safeJson(value), updatedBy: batch.id } });
          else await tx.systemSetting.deleteMany({ where: { key } });
        }
      }
      await tx.auditLog.create({ data: { action: "ADMIN_USER_IMPORT_ROLLBACK", entityType: "User", entityId: record.userId, after: safeJson({ batchId: batch.id, action: record.action }) } });
    }
    await tx.importBatch.update({ where: { id: batch.id }, data: { status: "CANCELLED" } });
  });
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => { console.error(JSON.stringify({ ok: false, error: error.message }, null, 2)); process.exitCode = 1; }).finally(() => prisma.$disconnect());
