#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
let failures = 0;
let warnings = 0;

function rel(p) {
  return path.join(root, p);
}
function exists(p) {
  return fs.existsSync(rel(p));
}
function read(p) {
  try { return fs.readFileSync(rel(p), 'utf8'); } catch { return ''; }
}
function ok(msg) { console.log(`✅ ${msg}`); }
function warn(msg) { warnings += 1; console.log(`⚠️ ${msg}`); }
function fail(msg) { failures += 1; console.log(`❌ ${msg}`); }
function checkFile(label, p, required = true) {
  if (exists(p)) ok(`${label} — ${p}`);
  else required ? fail(`${label} missing — ${p}`) : warn(`${label} optional missing — ${p}`);
}
function contentHas(label, file, needle, required = true) {
  const text = read(file);
  if (text.includes(needle)) ok(`${label}`);
  else required ? fail(`${label} missing ${needle}`) : warn(`${label} optional missing ${needle}`);
}
function anyContentHas(label, file, needles, required = true) {
  const text = read(file);
  if (needles.some((needle) => text.includes(needle))) ok(label);
  else required ? fail(`${label} missing any of: ${needles.join(', ')}`) : warn(`${label} optional missing any of: ${needles.join(', ')}`);
}

console.log('\n==============================');
console.log('HR / OPERATIONS CLOSEOUT AUDIT');
console.log('==============================\n');

console.log('1) Pages');
[
  ['إدارة المناديب /drivers', 'src/app/drivers/page.tsx', true],
  ['إضافة مندوب /drivers/new', 'src/app/drivers/new/page.tsx', true],
  ['ملف مندوب /drivers/[id]', 'src/app/drivers/[id]/page.tsx', true],
  ['المشرفون /supervisors', 'src/app/supervisors/page.tsx', true],
  ['الحضور والانصراف /attendance', 'src/app/attendance/page.tsx', true],
  ['الشفتات /shifts', 'src/app/shifts/page.tsx', true],
  ['مهام المشرفين /supervisor-tasks', 'src/app/supervisor-tasks/page.tsx', true],
  ['المقابلات /interviews', 'src/app/interviews/page.tsx', true],
  ['السكن /housing', 'src/app/housing/page.tsx', false],
  ['المستندات /documents', 'src/app/documents/page.tsx', false],
  ['الإنذارات /warnings', 'src/app/warnings/page.tsx', false],
  ['سكن المناديب /rider-housing', 'src/app/rider-housing/page.tsx', false],
  ['مستندات المناديب /rider-documents', 'src/app/rider-documents/page.tsx', false],
].forEach(([label, p, required]) => checkFile(label, p, required));

console.log('\n2) API routes');
[
  ['استيراد المناديب /api/drivers/bulk', 'src/app/api/drivers/bulk/route.ts', true],
  ['إضافة مندوب يدوي /api/drivers/manual', 'src/app/api/drivers/manual/route.ts', true],
  ['التقاط الحضور /api/attendance/capture', 'src/app/api/attendance/capture/route.ts', true],
  ['مهام المشرفين /api/supervisor-tasks', 'src/app/api/supervisor-tasks/route.ts', true],
  ['تعديل مهمة مشرف /api/supervisor-tasks/[id]', 'src/app/api/supervisor-tasks/[id]/route.ts', true],
  ['المشرفون /api/supervisors', 'src/app/api/supervisors/route.ts', false],
  ['الشفتات /api/shifts', 'src/app/api/shifts/route.ts', false],
].forEach(([label, p, required]) => checkFile(label, p, required));

console.log('\n3) Data loaders / clients');
[
  ['DriverManagementClient', 'src/components/drivers/DriverManagementClient.tsx', true],
  ['getDriverManagementData', 'src/lib/drivers/getDriverManagementData.ts', true],
  ['SupervisorsOperationsClient', 'src/components/supervisors/SupervisorsOperationsClient.tsx', true],
  ['AttendanceCameraClient', 'src/components/attendance/AttendanceCameraClient.tsx', true],
  ['getAttendancePageData', 'src/lib/attendance/getAttendancePageData.ts', true],
  ['SupervisorTasksClient', 'src/components/supervisor-tasks/SupervisorTasksClient.tsx', true],
  ['getSupervisorTasksData', 'src/lib/supervisor-tasks/getSupervisorTasksData.ts', true],
].forEach(([label, p, required]) => checkFile(label, p, required));

console.log('\n4) Prisma schema models');
const schema = read('prisma/schema.prisma');
[
  'Driver',
  'Supervisor',
  'AttendanceRecord',
  'Shift',
  'Task',
  'Interview',
  'DriverDocument',
  'DriverContract',
  'DriverHousing',
  'DriverWarning',
  'City',
  'Project',
].forEach((model) => {
  if (schema.includes(`model ${model} `)) ok(`model ${model}`);
  else fail(`model ${model} missing in prisma/schema.prisma`);
});

console.log('\n5) Sidebar/navigation mapping');
const modulesFile = 'src/lib/modules.ts';
[
  ['/drivers', true],
  ['/supervisors', true],
  ['/attendance', true],
  ['/shifts', false],
  ['/supervisor-tasks', true],
  ['/interviews', false],
  ['/rider-housing', false],
  ['/rider-documents', false],
].forEach(([route, required]) => contentHas(`${route} in modules/sidebar`, modulesFile, `href: "${route}"`, required));

console.log('\n6) Permission resources');
const permissionsFile = 'src/lib/permissions.ts';
[
  ['/drivers', true],
  ['/supervisors', true],
  ['/attendance', true],
  ['/shifts', false],
  ['/supervisor-tasks', true],
  ['/interviews', false],
  ['/rider-housing', false],
  ['/rider-documents', false],
].forEach(([route, required]) => contentHas(`permission includes ${route}`, permissionsFile, `route: "${route}"`, required));

console.log('\n7) UI controls static checks');
const driverClient = read('src/components/drivers/DriverManagementClient.tsx');
if (driverClient) {
  ['downloadCsv', 'print', 'name="q"', 'تطبيق', 'عرض الكل'].forEach((token) => driverClient.includes(token) ? ok(`Drivers controls: ${token}`) : warn(`Drivers controls optional missing: ${token}`));
}
const supervisorsClient = read('src/components/supervisors/SupervisorsOperationsClient.tsx');
if (supervisorsClient) {
  ['print', 'CSV', 'تطبيق', 'تفاصيل'].forEach((token) => supervisorsClient.includes(token) ? ok(`Supervisors controls: ${token}`) : warn(`Supervisors controls optional missing: ${token}`));
}
const attendanceClient = read('src/components/attendance/AttendanceCameraClient.tsx');
if (attendanceClient) {
  ['exportCsv', 'CaptureModal', 'check-in', 'check-out'].forEach((token) => attendanceClient.includes(token) ? ok(`Attendance controls: ${token}`) : warn(`Attendance controls optional missing: ${token}`));
}
const tasksClient = read('src/components/supervisor-tasks/SupervisorTasksClient.tsx');
if (tasksClient) {
  ['fetch(', 'POST', 'PATCH', 'DELETE', 'تطبيق'].forEach((token) => tasksClient.includes(token) ? ok(`Supervisor tasks controls: ${token}`) : warn(`Supervisor tasks controls optional missing: ${token}`));
}

console.log('\n8) Recommended tests');
console.log('شغل السيرفر: docker start erp-postgres-1 ثم npm run dev');
console.log('ثم: node scripts/smoke-hr-auth-routes.cjs');

console.log('\n==============================');
console.log(`Result: ${failures ? 'FAILED' : 'OK'} | failures=${failures} | warnings=${warnings}`);
console.log('==============================\n');
process.exit(failures ? 1 : 0);
