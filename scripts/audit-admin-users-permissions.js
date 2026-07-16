const { prisma, PROFILE_PREFIX, ADMIN_PROFILE_PREFIX } = require("./admin-users-import-common");

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

async function main() {
  const [users, permissionSettings, adminSettings, batches] = await Promise.all([
    prisma.user.findMany({ include: { city: true, supervisor: true } }),
    prisma.systemSetting.findMany({ where: { key: { startsWith: PROFILE_PREFIX } } }),
    prisma.systemSetting.findMany({ where: { key: { startsWith: ADMIN_PROFILE_PREFIX } } }),
    prisma.importBatch.findMany({ where: { importType: "ADMIN_USERS" }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const permissionByUser = new Map(permissionSettings.map((setting) => [setting.key.slice(PROFILE_PREFIX.length), asObject(setting.value)]));
  const adminByUser = new Map(adminSettings.map((setting) => [setting.key.slice(ADMIN_PROFILE_PREFIX.length), asObject(setting.value)]));
  const phones = new Map();
  for (const [userId, profile] of adminByUser) {
    const phone = String(profile.phone || "").replace(/\D/g, "");
    if (phone) phones.set(phone, [...(phones.get(phone) || []), userId]);
  }
  const roleCounts = Object.fromEntries([...new Set(users.map((user) => user.role))].map((role) => [role, users.filter((user) => user.role === role).length]));
  const rows = users.map((user) => {
    const profile = permissionByUser.get(user.id) || {};
    const permissions = Array.isArray(profile.permissions) ? profile.permissions.map(String) : [];
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      profileKey: profile.profileKey || null,
      scopeType: profile.scopeType || (user.role === "ADMIN" || user.role === "OPERATION_MANAGER" ? "ALL" : null),
      city: user.city?.nameAr || null,
      cityScope: user.cityScope || null,
      projectScope: user.projectScope || null,
      permissionsCount: permissions.length,
      fullAccess: user.role === "ADMIN" || permissions.includes("*"),
      payrollEdit: permissions.includes("payroll.edit") || permissions.includes("*"),
    };
  });
  console.log(JSON.stringify({
    ok: true,
    usersCount: users.length,
    activeAdmins: users.filter((user) => user.isActive && user.role === "ADMIN").length,
    roles: roleCounts,
    importedProfiles: permissionSettings.length,
    citySupervisors: rows.filter((row) => row.profileKey === "city_supervisor").length,
    usersWithoutPermissionProfile: rows.filter((row) => !row.profileKey && row.role !== "ADMIN").length,
    scopedUsersWithoutScope: rows.filter((row) => ["city_supervisor", "app_supervisor"].includes(row.profileKey) && !row.cityScope && !row.projectScope).map((row) => row.email),
    duplicateEmails: [],
    duplicatePhones: [...phones.entries()].filter(([, ids]) => ids.length > 1).map(([phone, ids]) => ({ phone, users: ids })),
    fullAccessUsers: rows.filter((row) => row.fullAccess).map((row) => row.email),
    citySupervisorsWithPayrollEdit: rows.filter((row) => row.profileKey === "city_supervisor" && row.payrollEdit).map((row) => row.email),
    movementManagersWithPayrollEdit: rows.filter((row) => row.profileKey === "movement_manager" && row.payrollEdit).map((row) => row.email),
    financeManagersMissingPayroll: rows.filter((row) => row.profileKey === "finance_manager" && !row.payrollEdit).map((row) => row.email),
    recentImportBatches: batches.map((batch) => ({ id: batch.id, fileName: batch.fileName, status: batch.status, rowsFound: batch.rowsFound, rowsImported: batch.rowsImported, createdAt: batch.createdAt })),
    users: rows,
  }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
