const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const PROFILE_PREFIX = "USER_PERMISSION_PROFILE:";
const SOURCE = "SYNC_SUPERVISOR_ACCESS_SCOPES";

const permissions = [
  "dashboard.view",
  "projects.view",
  "cities.view",
  "applicationAccounts.view",
  "drivers.view",
  "supervisors.view",
  "driverDocuments.view",
  "driverHousing.view",
  "hr.view",
  "vehicles.view",
  "vehicleMovements.view",
  "vehicleMaintenance.view",
  "vehicleAuthorizations.view",
  "vehicleAccidents.view",
  "vehicleDamages.view",
  "vehicleCleaning.view",
  "vehicleCosts.view",
  "dailyReports.view",
  "managementReports.view",
  "operationsAlerts.view",
  "reports.view",
  "payroll.view",
  "advances.view",
  "deductions.view",
  "violations.view",
  "invoices.view",
  "notifications.view",
  "tasks.view",
  "tasks.create",
  "tasks.edit",
  "attendance.view",
  "attendance.create",
];

function parseMode() {
  if (process.argv.includes("--apply")) return "apply";
  return "dry-run";
}

function inferApplicationCode(user, supervisor) {
  const value = `${user.email || ""} ${user.name || ""} ${supervisor?.name || ""}`.toLowerCase();
  if (value.includes("hungerstation") || value.includes("hunger") || value.includes("هنجر") || value.includes("هنقر")) return "HUNGERSTATION";
  if (value.includes("keeta") || value.includes("كيتا")) return "KEETA";
  return "";
}

function profileFor(user, project) {
  const cityId = user.supervisor?.cityId || user.cityId || "";
  const projectIds = project ? [project.id] : [];
  return {
    profileKey: project ? "project_supervisor" : "city_supervisor",
    labelAr: project ? "مشرف مشروع" : "مشرف مدينة",
    labelEn: project ? "Project Supervisor" : "City Supervisor",
    permissions,
    scopeType: project ? "APPLICATION_PROJECT" : "CITY",
    cityIds: cityId ? [cityId] : [],
    applicationIds: project ? [project.applicationId] : [],
    applicationProjectIds: projectIds,
    source: SOURCE,
  };
}

async function main() {
  const mode = parseMode();
  const [users, projects] = await Promise.all([
    prisma.user.findMany({
      where: { role: "SUPERVISOR", isActive: true },
      include: { supervisor: true },
      orderBy: { email: "asc" },
    }),
    prisma.applicationProject.findMany({
      where: { status: "ACTIVE" },
      include: { application: { select: { code: true, name: true } }, city: { select: { nameAr: true, nameEn: true } } },
    }),
  ]);

  const plan = users.map((user) => {
    const cityId = user.supervisor?.cityId || user.cityId || "";
    const applicationCode = inferApplicationCode(user, user.supervisor);
    const matches = applicationCode
      ? projects.filter((project) => project.cityId === cityId && project.application.code.toUpperCase() === applicationCode)
      : [];
    const project = matches.length === 1 ? matches[0] : null;
    const action = project ? "project_supervisor" : "city_supervisor";
    const warning = !cityId
      ? "missing_city"
      : applicationCode && matches.length !== 1
        ? `project_match_count_${matches.length}`
        : "";
    return { user, cityId, applicationCode, project, action, warning };
  });

  const preview = plan.map(({ user, cityId, applicationCode, project, action, warning }) => ({
    userId: user.id,
    email: user.email,
    cityId,
    applicationCode,
    applicationProjectId: project?.id || "",
    applicationProject: project?.name || "كل مشاريع المدينة",
    action,
    warning,
  }));

  if (mode === "dry-run") {
    console.log(JSON.stringify({ ok: true, mode, count: preview.length, preview }, null, 2));
    return;
  }

  const result = { updated: 0, projectSupervisors: 0, citySupervisors: 0, skipped: 0, warnings: [] };
  for (const item of plan) {
    if (!item.cityId) {
      result.skipped += 1;
      result.warnings.push(`${item.user.email}: missing_city`);
      continue;
    }
    const profile = profileFor(item.user, item.project);
    await prisma.$transaction(async (tx) => {
      const before = {
        cityId: item.user.cityId,
        cityScope: item.user.cityScope,
        projectScope: item.user.projectScope,
      };
      const updated = await tx.user.update({
        where: { id: item.user.id },
        data: {
          cityId: item.cityId,
          cityScope: item.cityId,
          projectScope: item.project?.id || "",
        },
      });
      await tx.systemSetting.upsert({
        where: { key: `${PROFILE_PREFIX}${item.user.id}` },
        update: { value: profile, updatedBy: SOURCE },
        create: { key: `${PROFILE_PREFIX}${item.user.id}`, value: profile, updatedBy: SOURCE },
      });
      await tx.auditLog.create({
        data: {
          action: "SUPERVISOR_SCOPE_SYNC",
          entityType: "User",
          entityId: item.user.id,
          before,
          after: {
            cityId: updated.cityId,
            cityScope: updated.cityScope,
            projectScope: updated.projectScope,
            profileKey: profile.profileKey,
            source: SOURCE,
          },
        },
      });
    });
    result.updated += 1;
    if (item.project) result.projectSupervisors += 1;
    else result.citySupervisors += 1;
    if (item.warning) result.warnings.push(`${item.user.email}: ${item.warning}`);
  }

  console.log(JSON.stringify({ ok: true, mode, result, preview }, null, 2));
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
