const {
  PROFILE_PREFIX,
  buildPlan,
  loadState,
  normalizeEmail,
  prisma,
  splitScope,
} = require("./supervisor-users-common");

function settingObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

async function main() {
  const state = await loadState();
  const plan = buildPlan(state);
  const profileSettings = await prisma.systemSetting.findMany({
    where: { key: { startsWith: PROFILE_PREFIX } },
    select: { key: true, value: true },
  });
  const profilesByUser = new Map(
    profileSettings.map((setting) => [setting.key.slice(PROFILE_PREFIX.length), settingObject(setting.value)]),
  );
  const usersBySupervisor = new Map();
  for (const user of state.users) {
    if (!user.supervisorId) continue;
    const rows = usersBySupervisor.get(user.supervisorId) || [];
    rows.push(user);
    usersBySupervisor.set(user.supervisorId, rows);
  }

  const supervisorsWithoutUser = [];
  const cityScopeMismatches = [];
  const roleMismatches = [];
  const permissionProfileMismatches = [];

  for (const supervisor of state.supervisors) {
    const linkedUsers = usersBySupervisor.get(supervisor.id) || [];
    if (!linkedUsers.length) {
      supervisorsWithoutUser.push({
        id: supervisor.id,
        name: supervisor.name,
        email: normalizeEmail(supervisor.email),
        city: supervisor.city?.nameAr || supervisor.city?.nameEn || "-",
        status: supervisor.status,
      });
      continue;
    }

    for (const user of linkedUsers) {
      const cityScope = splitScope(user.cityScope);
      if (supervisor.cityId && (user.cityId !== supervisor.cityId || !cityScope.includes(supervisor.cityId))) {
        cityScopeMismatches.push({
          supervisor: supervisor.name,
          email: user.email,
          supervisorCityId: supervisor.cityId,
          userCityId: user.cityId,
          userCityScope: cityScope,
        });
      }
      if (user.role !== "SUPERVISOR") {
        roleMismatches.push({ supervisor: supervisor.name, email: user.email, role: user.role });
      }
      const profile = profilesByUser.get(user.id);
      const profileCities = Array.isArray(profile?.cityIds) ? profile.cityIds.map(String) : [];
      if (user.role === "SUPERVISOR" && (!profile || profile.profileKey !== "city_supervisor" || !profileCities.includes(supervisor.cityId))) {
        permissionProfileMismatches.push({
          supervisor: supervisor.name,
          email: user.email,
          profileKey: profile?.profileKey || "missing",
          profileCities,
        });
      }
    }
  }

  const report = {
    ok: true,
    counts: {
      supervisors: state.supervisors.length,
      users: state.users.length,
      activeSupervisors: state.supervisors.filter((row) => row.status === "ACTIVE").length,
      inactiveSupervisors: state.supervisors.filter((row) => row.status !== "ACTIVE").length,
      supervisorsWithoutUser: supervisorsWithoutUser.length,
      activeSupervisorsWithoutUser: supervisorsWithoutUser.filter((row) => row.status === "ACTIVE").length,
      usersLinkedToSupervisors: state.users.filter((row) => row.supervisorId).length,
      supervisorsWithoutEmail: state.supervisors.filter((row) => !normalizeEmail(row.email)).length,
      duplicateSupervisorEmails: plan.duplicateEmails.length,
      cityScopeMismatches: cityScopeMismatches.length,
      roleMismatches: roleMismatches.length,
      permissionProfileMismatches: permissionProfileMismatches.length,
    },
    supervisorsWithoutUser,
    supervisorsWithoutEmail: state.supervisors
      .filter((row) => !normalizeEmail(row.email))
      .map((row) => ({ id: row.id, name: row.name, status: row.status })),
    duplicateSupervisorEmails: plan.duplicateEmails,
    inactiveSupervisors: state.supervisors
      .filter((row) => row.status !== "ACTIVE")
      .map((row) => ({ id: row.id, name: row.name, email: normalizeEmail(row.email), status: row.status })),
    cityScopeMismatches,
    roleMismatches,
    permissionProfileMismatches,
  };
  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
