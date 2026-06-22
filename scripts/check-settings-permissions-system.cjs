#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
let failures = 0;
let warnings = 0;

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function read(rel) {
  try { return fs.readFileSync(path.join(root, rel), 'utf8'); } catch { return ''; }
}

function ok(label) { console.log(`✅ ${label}`); }
function fail(label) { failures += 1; console.log(`❌ ${label}`); }
function warn(label) { warnings += 1; console.log(`⚠️ ${label}`); }
function checkFile(rel, label = rel) { exists(rel) ? ok(`${label} — ${rel}`) : fail(`${label} — missing ${rel}`); }
function checkOptional(rel, label = rel) { exists(rel) ? ok(`${label} — ${rel}`) : warn(`${label} — optional missing ${rel}`); }
function checkIncludes(file, needle, label) {
  const txt = read(file);
  txt.includes(needle) ? ok(label) : fail(`${label} — not found in ${file}`);
}
function checkAnyIncludes(file, needles, label) {
  const txt = read(file);
  needles.some((needle) => txt.includes(needle)) ? ok(label) : fail(`${label} — not found in ${file}`);
}

console.log('\n===================================');
console.log('SETTINGS & PERMISSIONS CLOSEOUT AUDIT');
console.log('===================================\n');

console.log('1) Pages');
const pages = [
  ['الإعدادات', '/settings', 'src/app/settings/page.tsx'],
  ['المستخدمون والصلاحيات', '/users', 'src/app/users/page.tsx'],
  ['إدارة المستخدمين', '/user-management', 'src/app/user-management/page.tsx'],
  ['مصفوفة الصلاحيات', '/permissions', 'src/app/permissions/page.tsx'],
  ['سجل العمليات', '/audit-log', 'src/app/audit-log/page.tsx'],
  ['إعدادات المسير', '/settings/payroll', 'src/app/settings/payroll/page.tsx'],
  ['إعدادات القوالب', '/settings/templates', 'src/app/settings/templates/page.tsx'],
  ['مراجعة ربط الحسابات', '/settings/application-account-review', 'src/app/settings/application-account-review/page.tsx'],
];
for (const [label, route, file] of pages) checkFile(file, `${label} ${route}`);

console.log('\n2) Shared settings/users engine');
[
  'src/components/users/UserManagementOldPageClient.tsx',
  'src/lib/users/getUserManagementOldPageData.ts',
  'src/lib/users/userManagementMutations.ts',
  'src/lib/permissions.ts',
  'src/lib/auth/session.ts',
  'src/lib/auth/accessScope.ts',
  'src/lib/accessControlPage.ts',
  'src/components/settings/SettingsRulesPanel.tsx',
  'src/components/layout/Sidebar.tsx',
  'src/components/layout/Header.tsx',
  'src/lib/navigation.ts',
  'src/lib/modules.ts',
].forEach((file) => checkFile(file));

console.log('\n3) API routes');
[
  ['settings rules API', 'src/app/api/settings/rules/route.ts'],
  ['user create/list API', 'src/app/api/user-management/route.ts'],
  ['user update/deactivate API', 'src/app/api/user-management/[id]/route.ts'],
  ['user reset password API', 'src/app/api/user-management/[id]/reset-password/route.ts'],
  ['generic resource API', 'src/app/api/[resource]/route.ts'],
  ['generic resource item API', 'src/app/api/[resource]/[id]/route.ts'],
].forEach(([label, file]) => checkFile(file, label));

console.log('\n4) Prisma schema models');
const schema = read('prisma/schema.prisma');
for (const model of ['User', 'AuditLog', 'SystemSetting', 'City', 'Project', 'Supervisor', 'Driver']) {
  schema.includes(`model ${model} `) ? ok(`model ${model}`) : fail(`model ${model} missing in prisma/schema.prisma`);
}

console.log('\n5) Permission roles/resources');
const permissions = read('src/lib/permissions.ts');
for (const role of ['ADMIN', 'OPERATION_MANAGER', 'SUPERVISOR', 'ACCOUNTANT', 'HR', 'VIEWER']) {
  permissions.includes(role) ? ok(`role ${role}`) : fail(`role ${role} missing`);
}
for (const resource of ['users', 'audit-logs', 'system-settings', 'payroll-settings']) {
  permissions.includes(resource) ? ok(`resource ${resource}`) : fail(`resource ${resource} missing in permissions.ts`);
}
checkIncludes('src/lib/permissions.ts', 'canReadResource', 'canReadResource helper');
checkIncludes('src/lib/permissions.ts', 'canWriteResource', 'canWriteResource helper');
checkIncludes('src/lib/permissions.ts', 'roleFromHeaders', 'roleFromHeaders helper');

console.log('\n6) Sidebar/navigation mapping');
const modules = read('src/lib/modules.ts');
const nav = read('src/lib/navigation.ts');
if (!modules && !nav) {
  fail('navigation files are missing');
} else {
  const combined = `${modules}\n${nav}`;
  const navChecks = [
    ['/settings', 'الإعدادات'],
    ['/users', 'المستخدمين والصلاحيات'],
    ['/permissions', 'مصفوفة الصلاحيات'],
    ['/audit-log', 'سجل العمليات'],
  ];
  for (const [route, label] of navChecks) {
    combined.includes(route) ? ok(`${label} in navigation — ${route}`) : fail(`${label} missing in navigation — ${route}`);
  }
}

console.log('\n7) User management UI capabilities');
checkIncludes('src/components/users/UserManagementOldPageClient.tsx', 'buildCsv', 'users CSV export helper');
checkAnyIncludes('src/components/users/UserManagementOldPageClient.tsx', ['reset', 'Reset', 'كلمة المرور'], 'password reset UI/action');
checkAnyIncludes('src/components/users/UserManagementOldPageClient.tsx', ['DELETE', 'deactivate', 'تعطيل'], 'deactivate/delete UI/action');
checkAnyIncludes('src/components/users/UserManagementOldPageClient.tsx', ['PATCH', 'تعديل'], 'edit user UI/action');
checkAnyIncludes('src/components/users/UserManagementOldPageClient.tsx', ['POST', 'إضافة', 'إنشاء'], 'create user UI/action');

console.log('\n8) Recommended authenticated smoke test');
console.log('شغل السيرفر: npm run dev');
console.log('ثم شغّل: node scripts/smoke-settings-auth-routes.cjs');
console.log('ثم شغّل: node scripts/smoke-user-management-crud.cjs');

console.log('\n===================================');
console.log(`Result: ${failures ? 'FAILED' : 'OK'} | failures=${failures} | warnings=${warnings}`);
console.log('===================================\n');

process.exitCode = failures ? 1 : 0;
