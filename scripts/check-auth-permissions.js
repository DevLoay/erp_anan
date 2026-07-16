const fs = require("node:fs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const splitScope = (value) => [...new Set(String(value ?? "").split(/[;,|]/).map((item) => item.trim()).filter(Boolean))];

async function main() {
  const [users, supervisors, cities, projects] = await Promise.all([
    prisma.user.findMany({ select: { id: true, email: true, role: true, status: true, isActive: true, cityId: true, cityScope: true, projectScope: true, supervisorId: true } }),
    prisma.supervisor.findMany({ select: { id: true, email: true, status: true, cityId: true } }),
    prisma.city.findMany({ select: { id: true } }),
    prisma.applicationProject.findMany({ select: { id: true } }),
  ]);
  const cityIds = new Set(cities.map((city) => city.id));
  const projectIds = new Set(projects.map((project) => project.id));
  const usersBySupervisor = new Map(users.filter((user) => user.supervisorId).map((user) => [user.supervisorId, user]));
  const usersByEmail = new Map(users.map((user) => [user.email.toLowerCase(), user]));
  const supervisorsWithoutUser = supervisors.filter((supervisor) => !usersBySupervisor.has(supervisor.id) && !(supervisor.email && usersByEmail.has(supervisor.email.toLowerCase())));
  const invalidScopes = users.flatMap((user) => {
    const invalidCities = [...new Set([user.cityId, ...splitScope(user.cityScope)].filter(Boolean))].filter((id) => !cityIds.has(id));
    const invalidProjects = splitScope(user.projectScope).filter((id) => !projectIds.has(id));
    return invalidCities.length || invalidProjects.length ? [{ email: user.email, invalidCities, invalidProjects }] : [];
  });
  const linkedSupervisorRoleWarnings = users
    .filter((user) => user.supervisorId && user.role !== "SUPERVISOR" && user.role !== "ADMIN")
    .map((user) => ({ email: user.email, role: user.role }));
  const report = {
    ok: users.some((user) => user.role === "ADMIN" && user.isActive) && supervisorsWithoutUser.length === 0 && invalidScopes.length === 0,
    users: users.length,
    activeUsers: users.filter((user) => user.isActive && user.status !== "inactive").length,
    admins: users.filter((user) => user.role === "ADMIN").length,
    supervisors: supervisors.length,
    usersLinkedToSupervisors: users.filter((user) => user.supervisorId).length,
    supervisorsWithoutUser: supervisorsWithoutUser.map((supervisor) => ({ id: supervisor.id, email: supervisor.email })),
    usersWithoutRole: users.filter((user) => !user.role).map((user) => user.email),
    invalidScopes,
    linkedSupervisorRoleWarnings,
    routeProtection: {
      proxyExists: fs.existsSync("src/proxy.ts"),
      sessionModuleExists: fs.existsSync("src/lib/auth/session.ts"),
      loginRouteExists: fs.existsSync("src/app/api/auth/login/route.ts"),
    },
  };
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
