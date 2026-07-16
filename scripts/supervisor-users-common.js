const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const TEMPORARY_PASSWORD = "Supervisor@123";
const PROFILE_PREFIX = "USER_PERMISSION_PROFILE:";
const ADMIN_PROFILE_PREFIX = "ADMIN_PROFILE:";
const PATCH_SOURCE = "CREATE_SUPERVISOR_USERS_PATCH";

function normalizeEmail(value) {
  return String(value ?? "").trim().toLowerCase();
}

function splitScope(value) {
  return String(value ?? "")
    .split(/[;,|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function safeJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function citySupervisorProfile(supervisor) {
  return {
    profileKey: "city_supervisor",
    labelAr: "مشرف المدينة",
    labelEn: "City Supervisor",
    permissions: [
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
      "advances.view",
      "deductions.view",
      "violations.view",
      "payroll.view",
      "invoices.view",
      "notifications.view",
      "tasks.view",
      "tasks.create",
      "tasks.edit",
      "attendance.view",
      "attendance.create",
    ],
    scopeType: "CITY",
    cityIds: supervisor.cityId ? [supervisor.cityId] : [],
    applicationIds: [],
    applicationProjectIds: [],
    source: PATCH_SOURCE,
  };
}

function adminProfile(supervisor) {
  return {
    phone: supervisor.phone || "",
    jobTitle: "مشرف مدينة",
    notes: "تم إنشاء حساب الدخول من سجل المشرف الحالي.",
    supervisorId: supervisor.id,
    cityId: supervisor.cityId || "",
    source: PATCH_SOURCE,
  };
}

function archiveRoot() {
  const workspaceRoot = path.resolve(__dirname, "..", "..", "..");
  return path.join(workspaceRoot, "_delivery-archive", "supervisor-user-backups");
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

async function loadState() {
  const [supervisors, users] = await Promise.all([
    prisma.supervisor.findMany({
      include: { city: { select: { id: true, nameAr: true, nameEn: true } } },
      orderBy: [{ status: "asc" }, { name: "asc" }],
    }),
    prisma.user.findMany({ orderBy: { email: "asc" } }),
  ]);
  return { supervisors, users };
}

function duplicateSupervisorEmails(supervisors) {
  const groups = new Map();
  for (const supervisor of supervisors) {
    const email = normalizeEmail(supervisor.email);
    if (!email) continue;
    const rows = groups.get(email) || [];
    rows.push(supervisor);
    groups.set(email, rows);
  }
  return new Map([...groups].filter(([, rows]) => rows.length > 1));
}

function buildPlan(state) {
  const usersBySupervisor = new Map();
  const usersByEmail = new Map();
  for (const user of state.users) {
    if (user.supervisorId) {
      const rows = usersBySupervisor.get(user.supervisorId) || [];
      rows.push(user);
      usersBySupervisor.set(user.supervisorId, rows);
    }
    usersByEmail.set(normalizeEmail(user.email), user);
  }
  const duplicateEmails = duplicateSupervisorEmails(state.supervisors);
  const rows = [];

  for (const supervisor of state.supervisors) {
    const email = normalizeEmail(supervisor.email);
    const linkedUsers = usersBySupervisor.get(supervisor.id) || [];
    const existingByEmail = email ? usersByEmail.get(email) : null;
    let action = "skip_inactive";
    let warning = "";

    if (supervisor.status === "ACTIVE") {
      if (linkedUsers.length) {
        action = "already_linked";
        if (linkedUsers.length > 1) warning = "يوجد أكثر من User مربوط بنفس المشرف.";
      } else if (!email) {
        action = "missing_email";
        warning = "المشرف النشط بدون بريد إلكتروني.";
      } else if (!supervisor.cityId) {
        action = "missing_city";
        warning = "المشرف النشط بدون مدينة؛ لم يتم إنشاء Login حتى لا يحصل على نطاق غير مقيد.";
      } else if (duplicateEmails.has(email)) {
        action = "duplicate_email";
        warning = "البريد مكرر بين أكثر من Supervisor ويحتاج مراجعة قبل الربط.";
      } else if (existingByEmail) {
        if (!existingByEmail.supervisorId) action = "link_existing_user";
        else if (existingByEmail.supervisorId === supervisor.id) action = "already_linked";
        else {
          action = "email_link_conflict";
          warning = "User بنفس البريد مربوط بمشرف آخر؛ لم يتم تغيير الربط.";
        }
      } else {
        action = "create_user";
      }
    }

    rows.push({
      supervisorId: supervisor.id,
      name: supervisor.name,
      email,
      cityId: supervisor.cityId || "",
      city: supervisor.city?.nameAr || supervisor.city?.nameEn || "-",
      supervisorStatus: supervisor.status,
      role: "SUPERVISOR",
      action,
      warning,
      existingUserId: existingByEmail?.id || linkedUsers[0]?.id || "",
      existingUserRole: existingByEmail?.role || linkedUsers[0]?.role || "",
    });
  }

  return {
    rows,
    duplicateEmails: [...duplicateEmails].map(([email, supervisors]) => ({
      email,
      supervisors: supervisors.map((supervisor) => ({ id: supervisor.id, name: supervisor.name })),
    })),
    summary: {
      supervisors: state.supervisors.length,
      activeSupervisors: state.supervisors.filter((row) => row.status === "ACTIVE").length,
      inactiveSupervisors: state.supervisors.filter((row) => row.status !== "ACTIVE").length,
      users: state.users.length,
      supervisorsWithUser: rows.filter((row) => row.action === "already_linked").length,
      usersToCreate: rows.filter((row) => row.action === "create_user").length,
      usersToLink: rows.filter((row) => row.action === "link_existing_user").length,
      supervisorsWithoutEmail: state.supervisors.filter((row) => !normalizeEmail(row.email)).length,
      supervisorsWithoutCity: state.supervisors.filter((row) => !row.cityId).length,
      duplicateEmails: duplicateEmails.size,
      warnings: rows.filter((row) => row.warning).length,
    },
  };
}

module.exports = {
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
  splitScope,
};
