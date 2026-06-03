import { prisma } from "@/lib/prisma";
import { appRoles, permissionModules, permissionState, roleLabels, type AppRole } from "@/lib/permissions";

export type PermissionsPageFilters = {
  q: string;
  role: string;
  section: string;
};

export type PermissionsPageData = {
  databaseStatus: "online" | "offline";
  databaseMessage?: string;
  filters: PermissionsPageFilters;
  roles: { value: AppRole; label: string; users: number; activeUsers: number; scopedUsers: number }[];
  sections: string[];
  summary: {
    users: number;
    activeUsers: number;
    scopedUsers: number;
    usersWithoutScope: number;
    supervisorsWithoutUser: number;
    auditLogs: number;
  };
  modules: Array<{
    section: string;
    resource: string;
    label: string;
    route: string;
    adminOnly: boolean;
    roles: Record<AppRole, ReturnType<typeof permissionState>>;
  }>;
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export function resolvePermissionsFilters(searchParams: SearchParams): PermissionsPageFilters {
  return {
    q: first(searchParams.q).trim(),
    role: first(searchParams.role),
    section: first(searchParams.section),
  };
}

function emptyData(filters: PermissionsPageFilters, message?: string): PermissionsPageData {
  const modules = permissionModules.map((module) => ({
    ...module,
    adminOnly: permissionState("VIEWER", module.resource).adminOnly,
    roles: Object.fromEntries(appRoles.map((role) => [role, permissionState(role, module.resource)])) as Record<AppRole, ReturnType<typeof permissionState>>,
  }));

  return {
    databaseStatus: message ? "offline" : "online",
    databaseMessage: message,
    filters,
    roles: appRoles.map((role) => ({ value: role, label: roleLabels[role], users: 0, activeUsers: 0, scopedUsers: 0 })),
    sections: [...new Set(permissionModules.map((module) => module.section))],
    summary: { users: 0, activeUsers: 0, scopedUsers: 0, usersWithoutScope: 0, supervisorsWithoutUser: 0, auditLogs: 0 },
    modules,
  };
}

export async function getPermissionsPageData(filters: PermissionsPageFilters): Promise<PermissionsPageData> {
  try {
    const [users, supervisorsWithoutUser, auditLogs] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          role: true,
          isActive: true,
          cityId: true,
          supervisorId: true,
          driverId: true,
          cityScope: true,
          projectScope: true,
        },
      }),
      prisma.supervisor.count({ where: { users: { none: {} } } }),
      prisma.auditLog.count(),
    ]);

    const roleRows = appRoles.map((role) => {
      const roleUsers = users.filter((user) => user.role === role);
      const scopedUsers = roleUsers.filter((user) => user.cityId || user.supervisorId || user.driverId || user.cityScope || user.projectScope).length;
      return {
        value: role,
        label: roleLabels[role],
        users: roleUsers.length,
        activeUsers: roleUsers.filter((user) => user.isActive).length,
        scopedUsers,
      };
    });

    const q = filters.q.toLowerCase();
    const modules = permissionModules
      .filter((module) => !filters.section || module.section === filters.section)
      .filter((module) => !q || [module.label, module.resource, module.route, module.section].some((value) => value.toLowerCase().includes(q)))
      .map((module) => ({
        ...module,
        adminOnly: permissionState("VIEWER", module.resource).adminOnly,
        roles: Object.fromEntries(appRoles.map((role) => [role, permissionState(role, module.resource)])) as Record<AppRole, ReturnType<typeof permissionState>>,
      }));

    const scopedUsers = users.filter((user) => user.cityId || user.supervisorId || user.driverId || user.cityScope || user.projectScope).length;

    return {
      databaseStatus: "online",
      filters,
      roles: filters.role ? roleRows.filter((role) => role.value === filters.role) : roleRows,
      sections: [...new Set(permissionModules.map((module) => module.section))],
      summary: {
        users: users.length,
        activeUsers: users.filter((user) => user.isActive).length,
        scopedUsers,
        usersWithoutScope: users.length - scopedUsers,
        supervisorsWithoutUser,
        auditLogs,
      },
      modules,
    };
  } catch (error) {
    return emptyData(filters, error instanceof Error ? error.message : "Database is not available");
  }
}
