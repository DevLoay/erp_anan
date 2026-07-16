const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const ExcelJS = require("exceljs");
const { parse: parseCsv } = require("csv-parse/sync");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const roleProfiles = require("../config/admin-role-profiles.json");
const PROFILE_PREFIX = "USER_PERMISSION_PROFILE:";
const ADMIN_PROFILE_PREFIX = "ADMIN_PROFILE:";

const headerAliases = {
  name: ["الاسم", "اسم الموظف", "اسم الاداري", "اسم الإداري", "name", "employee name"],
  phone: ["رقم الهاتف", "الهاتف", "الجوال", "رقم الجوال", "phone", "mobile"],
  email: ["البريد الإلكتروني", "البريد الالكتروني", "الايميل", "الإيميل", "email", "e-mail"],
  jobTitle: ["المسمى الوظيفي", "الوظيفة", "المسمي الوظيفي", "job title", "position"],
  role: ["الدور", "الصلاحية", "role", "system role"],
  city: ["المدينة", "المدينه", "city"],
  application: ["التطبيق", "application", "app"],
  project: ["المشروع", "مشروع التطبيق", "application project", "project"],
  canView: ["صلاحية مشاهدة", "مشاهدة", "عرض", "can view", "view"],
  canEdit: ["صلاحية تعديل", "تعديل", "can edit", "edit"],
  canApprove: ["صلاحية اعتماد", "اعتماد", "can approve", "approve"],
  canExport: ["صلاحية تصدير", "تصدير", "can export", "export"],
  status: ["الحالة", "الحاله", "status"],
  password: ["كلمة مرور مبدئية", "كلمة المرور", "الباسورد", "password", "temporary password"],
  notes: ["ملاحظات", "ملحوظات", "notes", "note"],
};

const roleAliases = {
  company_manager: ["مدير الشركة", "مدير شركه", "مدير عام", "company manager", "general manager", "admin", "مدير النظام"],
  operations_manager: ["مدير التشغيل", "مدير عمليات", "operations manager", "operation manager"],
  finance_manager: ["المدير المالي", "مدير مالي", "مدير المالية", "finance manager", "accountant manager"],
  movement_manager: ["مدير الحركة", "مدير حركه", "movement manager", "fleet manager"],
  city_supervisor: ["مشرف المدينة", "مشرف مدينه", "مشرف", "city supervisor", "supervisor"],
  app_supervisor: ["مشرف تطبيق", "مشرف كيتا", "مشرف هنجر", "app supervisor", "application supervisor"],
  hr_manager: ["مدير الموارد البشرية", "موارد بشرية", "hr manager", "hr"],
  viewer: ["مشاهد", "عرض فقط", "viewer", "view only"],
};

function parseArgs(argv = process.argv.slice(2)) {
  const args = { file: "", apply: false, dryRun: false, updatePassword: false, batchId: "" };
  for (const arg of argv) {
    if (arg === "--apply") args.apply = true;
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--update-password") args.updatePassword = true;
    else if (arg.startsWith("--file=")) args.file = arg.slice(7).replace(/^['\"]|['\"]$/g, "");
    else if (arg.startsWith("--batch=")) args.batchId = arg.slice(8).replace(/^['\"]|['\"]$/g, "");
  }
  if (!args.apply) args.dryRun = true;
  return args;
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/[إأآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLowerCase();
}

function clean(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (value && typeof value === "object") {
    if (value.text) return String(value.text).trim();
    if (value.result !== undefined) return clean(value.result);
    if (Array.isArray(value.richText)) return value.richText.map((part) => part.text || "").join("").trim();
  }
  return String(value ?? "").trim();
}

function boolValue(value, fallback) {
  const text = normalizeText(value);
  if (!text) return fallback;
  if (["نعم", "yes", "true", "1", "مسموح", "allow"].includes(text)) return true;
  if (["لا", "no", "false", "0", "ممنوع", "deny"].includes(text)) return false;
  return fallback;
}

function normalizeStatus(value) {
  const text = normalizeText(value);
  return !text || ["active", "نشط", "فعال", "مفعل"].includes(text) ? { status: "active", isActive: true } : { status: "inactive", isActive: false };
}

function resolveRoleKey(role, jobTitle) {
  const target = normalizeText(role || jobTitle);
  if (!target) return "";
  const aliases = Object.entries(roleAliases).flatMap(([key, values]) =>
    values.map((value) => ({ key, value: normalizeText(value) })),
  );
  const exact = aliases.find((alias) => alias.value === target);
  if (exact) return exact.key;
  return aliases
    .filter((alias) => alias.value.length >= 4 && target.includes(alias.value))
    .sort((left, right) => right.value.length - left.value.length)[0]?.key || "";
}

function stableEmail(name, phone, city, roleKey) {
  const digits = phone.replace(/\D/g, "");
  if (digits) return `admin-${digits}@local.erp`;
  const hash = crypto.createHash("sha256").update(`${name}|${city}|${roleKey}`).digest("hex").slice(0, 12);
  return `admin-${hash}@local.erp`;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function generatePassword() {
  return `ERP-${crypto.randomBytes(4).toString("hex").toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
}

function convertLegacyXls(filePath) {
  const output = path.join(os.tmpdir(), `admin-import-${Date.now()}-${crypto.randomBytes(3).toString("hex")}.xlsx`);
  const escapedInput = filePath.replace(/'/g, "''");
  const escapedOutput = output.replace(/'/g, "''");
  const command = [
    "$excel = New-Object -ComObject Excel.Application",
    "$excel.Visible = $false",
    "$excel.DisplayAlerts = $false",
    `try { $book = $excel.Workbooks.Open('${escapedInput}'); $book.SaveAs('${escapedOutput}', 51); $book.Close($false) } finally { $excel.Quit(); [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null }`,
  ].join("; ");
  const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], { encoding: "utf8", timeout: 120000 });
  if (result.status !== 0 || !fs.existsSync(output)) {
    throw new Error("تعذر قراءة ملف XLS القديم. افتحه في Excel واحفظه بصيغة XLSX ثم أعد المحاولة.");
  }
  return output;
}

function mapHeaders(headers) {
  const normalized = headers.map(normalizeText);
  const mapping = {};
  for (const [field, aliases] of Object.entries(headerAliases)) {
    const aliasSet = aliases.map(normalizeText);
    const index = normalized.findIndex((header) => aliasSet.includes(header));
    if (index >= 0) mapping[field] = index;
  }
  return mapping;
}

async function readAdminSheet(filePath) {
  if (!filePath) throw new Error("مسار الملف مطلوب عبر --file.");
  const absolute = path.resolve(filePath);
  if (!fs.existsSync(absolute)) throw new Error(`الملف غير موجود: ${absolute}`);
  if (fs.statSync(absolute).size === 0) throw new Error("ملف الإداريين فارغ (0 بايت). أعد تصدير الشيت ثم ارفعه من جديد.");

  let workingFile = absolute;
  let converted = false;
  const extension = path.extname(absolute).toLowerCase();
  if (extension === ".xls") {
    workingFile = convertLegacyXls(absolute);
    converted = true;
  }

  try {
    let matrix;
    if (extension === ".csv") {
      matrix = parseCsv(fs.readFileSync(workingFile, "utf8"), { relax_column_count: true, skip_empty_lines: true });
    } else {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(workingFile);
      const sheet = workbook.worksheets[0];
      if (!sheet) throw new Error("الملف لا يحتوي على Sheet قابل للقراءة.");
      matrix = [];
      sheet.eachRow({ includeEmpty: false }, (row) => matrix.push(row.values.slice(1).map(clean)));
    }
    if (!matrix.length) throw new Error("الشيت لا يحتوي على صفوف.");

    let best = { index: -1, mapping: {}, score: 0 };
    matrix.slice(0, 20).forEach((row, index) => {
      const mapping = mapHeaders(row.map(clean));
      const score = Object.keys(mapping).length;
      if (score > best.score) best = { index, mapping, score };
    });
    if (best.index < 0 || best.score < 2 || best.mapping.name === undefined) {
      throw new Error("لم يتم التعرف على صف العناوين. تأكد من وجود عمود الاسم والدور أو المسمى الوظيفي.");
    }

    const headers = matrix[best.index].map(clean);
    const rows = matrix.slice(best.index + 1).map((row, offset) => {
      const record = { rowNumber: best.index + offset + 2, raw: {} };
      headers.forEach((header, index) => { if (header) record.raw[header] = clean(row[index]); });
      for (const [field, index] of Object.entries(best.mapping)) record[field] = clean(row[index]);
      return record;
    }).filter((row) => Object.values(row.raw).some(Boolean));

    return { absolute, sheetRows: rows, headers, mapping: best.mapping, headerRow: best.index + 1 };
  } finally {
    if (converted && fs.existsSync(workingFile)) fs.rmSync(workingFile, { force: true });
  }
}

function addActions(permissions, action) {
  const prefixes = [...new Set(permissions.map((permission) => permission.split(".")[0]).filter((prefix) => prefix && prefix !== "*"))];
  for (const prefix of prefixes) permissions.push(`${prefix}.${action}`);
}

function permissionsForRow(profile, row) {
  let permissions = [...profile.permissions];
  const view = boolValue(row.canView, true);
  const edit = boolValue(row.canEdit, undefined);
  const approve = boolValue(row.canApprove, undefined);
  const exportAllowed = boolValue(row.canExport, undefined);
  if (!view && permissions[0] !== "*") permissions = permissions.filter((permission) => !permission.endsWith(".view"));
  if (edit === true) { addActions(permissions, "create"); addActions(permissions, "edit"); }
  if (edit === false) permissions = permissions.filter((permission) => !/\.(create|edit|delete)$/.test(permission));
  if (approve === true) addActions(permissions, "approve");
  if (approve === false) permissions = permissions.filter((permission) => !permission.endsWith(".approve"));
  if (exportAllowed === true) addActions(permissions, "export");
  if (exportAllowed === false) permissions = permissions.filter((permission) => !permission.endsWith(".export"));
  return [...new Set(permissions)];
}

async function buildImportPlan(sheet) {
  const [cities, applications, projects, users, adminProfiles] = await Promise.all([
    prisma.city.findMany(),
    prisma.application.findMany(),
    prisma.applicationProject.findMany({ include: { application: true, city: true } }),
    prisma.user.findMany(),
    prisma.systemSetting.findMany({ where: { key: { startsWith: ADMIN_PROFILE_PREFIX } } }),
  ]);
  const cityByName = new Map();
  for (const city of cities) for (const value of [city.nameAr, city.nameEn]) if (value) cityByName.set(normalizeText(value), city);
  const appByName = new Map();
  for (const app of applications) for (const value of [app.code, app.name]) if (value) appByName.set(normalizeText(value), app);
  const userByEmail = new Map(users.map((user) => [user.email.toLowerCase(), user]));
  const phoneToUserId = new Map();
  for (const setting of adminProfiles) {
    const value = setting.value && typeof setting.value === "object" && !Array.isArray(setting.value) ? setting.value : {};
    const phone = clean(value.phone).replace(/\D/g, "");
    if (phone) phoneToUserId.set(phone, setting.key.slice(ADMIN_PROFILE_PREFIX.length));
  }
  const userById = new Map(users.map((user) => [user.id, user]));
  const seenEmails = new Set();
  const preview = [];

  for (const source of sheet.sheetRows) {
    const name = clean(source.name);
    const phone = clean(source.phone);
    const roleKey = resolveRoleKey(source.role, source.jobTitle);
    const profile = roleProfiles[roleKey];
    const city = cityByName.get(normalizeText(source.city)) || null;
    const application = appByName.get(normalizeText(source.application)) || null;
    let applicationProject = null;
    if (source.project) {
      const projectName = normalizeText(source.project);
      applicationProject = projects.find((project) => [project.id, project.code, project.name].some((value) => normalizeText(value) === projectName)) || null;
    } else if (application && city) {
      const matches = projects.filter((project) => project.applicationId === application.id && project.cityId === city.id);
      if (matches.length === 1) applicationProject = matches[0];
    }

    const email = clean(source.email).toLowerCase() || stableEmail(name, phone, clean(source.city), roleKey);
    const errors = [];
    const warnings = [];
    if (!name) errors.push("الاسم مطلوب");
    if (!profile) errors.push(`دور غير معروف: ${source.role || source.jobTitle || "فارغ"}`);
    if (profile?.scope === "CITY" && !city) errors.push(`مدينة غير معروفة: ${source.city || "فارغ"}`);
    if (profile?.scope === "APPLICATION_PROJECT" && !applicationProject) errors.push("مشرف التطبيق يحتاج مشروع تطبيق معروف");
    if (source.city && !city) warnings.push(`لم يتم التعرف على المدينة: ${source.city}`);
    if (source.application && !application) warnings.push(`لم يتم التعرف على التطبيق: ${source.application}`);
    if (source.project && !applicationProject) warnings.push(`لم يتم التعرف على المشروع: ${source.project}`);
    if (seenEmails.has(email)) errors.push("البريد مكرر داخل الشيت");
    seenEmails.add(email);

    const byPhone = phone ? userById.get(phoneToUserId.get(phone.replace(/\D/g, ""))) : null;
    const existing = userByEmail.get(email) || byPhone || users.find((user) => user.name === name && user.cityId === city?.id && user.role === profile?.role) || null;
    const resolvedCity = city || applicationProject?.city || null;
    const resolvedApplication = application || applicationProject?.application || null;
    const scopeType = profile?.scope || "CITY";
    let cityIds = scopeType === "CITY" || scopeType === "APPLICATION_PROJECT" ? (resolvedCity ? [resolvedCity.id] : []) : [];
    let applicationIds = scopeType === "APPLICATION" || scopeType === "APPLICATION_PROJECT" ? (resolvedApplication ? [resolvedApplication.id] : []) : [];
    let applicationProjectIds = scopeType === "APPLICATION_PROJECT" && applicationProject ? [applicationProject.id] : [];
    if (scopeType === "ALL" || scopeType === "SELF") {
      cityIds = [];
      applicationIds = [];
      applicationProjectIds = [];
    }
    const status = normalizeStatus(source.status);
    const permissions = profile ? permissionsForRow(profile, source) : [];

    preview.push({
      rowNumber: source.rowNumber,
      action: existing ? "update" : "create",
      existingUserId: existing?.id || null,
      name,
      phone,
      email,
      generatedEmail: !clean(source.email),
      jobTitle: clean(source.jobTitle),
      roleKey,
      role: profile?.role || "VIEWER",
      roleLabel: profile?.labelAr || source.role || source.jobTitle || "غير معروف",
      cityId: resolvedCity?.id || null,
      cityName: resolvedCity?.nameAr || source.city || null,
      applicationId: resolvedApplication?.id || null,
      applicationName: resolvedApplication?.name || source.application || null,
      applicationProjectId: applicationProject?.id || null,
      applicationProjectName: applicationProject?.name || source.project || null,
      scopeType,
      cityIds,
      applicationIds,
      applicationProjectIds,
      permissions,
      status: status.status,
      isActive: status.isActive,
      password: clean(source.password),
      notes: clean(source.notes),
      errors,
      warnings,
    });
  }

  return {
    rows: preview,
    summary: {
      totalRows: preview.length,
      createUsers: preview.filter((row) => row.action === "create" && !row.errors.length).length,
      updateUsers: preview.filter((row) => row.action === "update" && !row.errors.length).length,
      invalidRows: preview.filter((row) => row.errors.length).length,
      knownCities: new Set(preview.filter((row) => row.cityId).map((row) => row.cityId)).size,
      unknownCities: new Set(preview.filter((row) => row.cityName && !row.cityId).map((row) => row.cityName)).size,
      knownRoles: preview.filter((row) => row.roleKey).length,
      unknownRoles: preview.filter((row) => !row.roleKey).length,
    },
  };
}

function safeJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function archiveRoot() {
  return path.resolve(process.cwd(), "..", "..", "_delivery-archive", "admin-user-imports");
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

module.exports = {
  prisma,
  roleProfiles,
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
};
