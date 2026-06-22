#!/usr/bin/env node
/* HR / Operations final closeout check */
const fs = require('fs');
const path = require('path');

const root = process.cwd();
let failed = 0;
let warnings = 0;

function rel(p){ return p.replace(/\\/g, '/'); }
function exists(p){ return fs.existsSync(path.join(root, p)); }
function read(p){ try { return fs.readFileSync(path.join(root, p), 'utf8'); } catch { return ''; } }
function ok(label){ console.log(`✅ ${label}`); }
function fail(label){ failed++; console.log(`❌ ${label}`); }
function warn(label){ warnings++; console.log(`⚠️ ${label}`); }
function mustExist(p, label=p){ exists(p) ? ok(`exists ${label}`) : fail(`missing ${label}`); }
function shouldContain(file, needles, label){
  const content = read(file);
  if (!content) return fail(`cannot read ${file} for ${label}`);
  for (const n of needles) {
    if (content.includes(n)) ok(`${label}: ${n}`);
    else fail(`${label}: missing ${n}`);
  }
}
function shouldContainAny(file, needles, label){
  const content = read(file);
  if (!content) return fail(`cannot read ${file} for ${label}`);
  if (needles.some(n => content.includes(n))) ok(label);
  else fail(`${label}: missing any of ${needles.join(', ')}`);
}

console.log('\nHR / Operations final closeout check');
console.log(`Project root: ${root}\n`);

const requiredFiles = [
  'src/app/drivers/page.tsx',
  'src/app/drivers/new/page.tsx',
  'src/app/drivers/[id]/page.tsx',
  'src/app/supervisors/page.tsx',
  'src/app/attendance/page.tsx',
  'src/app/shifts/page.tsx',
  'src/app/supervisor-tasks/page.tsx',
  'src/app/interviews/page.tsx',
  'src/app/housing/page.tsx',
  'src/app/documents/page.tsx',
  'src/app/warnings/page.tsx',
  'src/app/rider-housing/page.tsx',
  'src/app/rider-documents/page.tsx',
  'src/app/api/drivers/bulk/route.ts',
  'src/app/api/drivers/manual/route.ts',
  'src/app/api/attendance/capture/route.ts',
  'src/app/api/supervisor-tasks/route.ts',
  'src/app/api/supervisor-tasks/[id]/route.ts',
  'src/components/drivers/DriverManagementClient.tsx',
  'src/components/supervisors/SupervisorsOperationsClient.tsx',
  'src/components/attendance/AttendanceCameraClient.tsx',
  'src/components/supervisor-tasks/SupervisorTasksClient.tsx',
  'src/lib/drivers/getDriverManagementData.ts',
  'src/lib/attendance/getAttendancePageData.ts',
  'src/lib/supervisor-tasks/getSupervisorTasksData.ts',
  'scripts/check-hr-operations-system.cjs',
  'scripts/smoke-hr-auth-routes.cjs',
  'scripts/smoke-hr-functional-crud.cjs',
  'docs/HR_OPERATIONS_CLOSEOUT_AUDIT.md',
];

for (const f of requiredFiles) mustExist(f);

console.log('\nNavigation / permissions');
shouldContain('src/lib/modules.ts', ['/drivers','/supervisors','/attendance','/shifts','/supervisor-tasks','/interviews','/rider-housing','/rider-documents'], 'sidebar/navigation route configured');
shouldContain('src/lib/permissions.ts', ['/drivers','/supervisors','/attendance','/shifts','/supervisor-tasks','/interviews','/rider-housing','/rider-documents'], 'permission route configured');

console.log('\nUI controls');
shouldContainAny('src/components/drivers/DriverManagementClient.tsx', ['downloadCsv','CSV','تصدير'], 'drivers export control exists');
shouldContainAny('src/components/drivers/DriverManagementClient.tsx', ['print','طباعة'], 'drivers print control exists');
shouldContain('src/components/drivers/DriverManagementClient.tsx', ['name="q"','تطبيق','عرض الكل'], 'drivers filters controls');
shouldContainAny('src/components/supervisors/SupervisorsOperationsClient.tsx', ['CSV','تصدير'], 'supervisors export control exists');
shouldContainAny('src/components/supervisors/SupervisorsOperationsClient.tsx', ['print','طباعة'], 'supervisors print control exists');
shouldContainAny('src/components/supervisors/SupervisorsOperationsClient.tsx', ['تفاصيل','details'], 'supervisors details control exists');
shouldContain('src/components/attendance/AttendanceCameraClient.tsx', ['exportCsv','CaptureModal','check-in','check-out'], 'attendance capture/export controls');
shouldContain('src/components/supervisor-tasks/SupervisorTasksClient.tsx', ['fetch(','POST','PATCH','DELETE','تطبيق'], 'supervisor tasks CRUD controls');

console.log('\nPrisma models');
shouldContain('prisma/schema.prisma', ['model Driver','model Supervisor','model AttendanceRecord','model Shift','model Task','model Interview','model DriverDocument','model DriverHousing','model DriverWarning'], 'schema model exists');

console.log('\nFinal QA notes');
if (exists('docs/HR_OPERATIONS_FUNCTIONAL_QA.md')) ok('exists docs/HR_OPERATIONS_FUNCTIONAL_QA.md'); else warn('optional missing docs/HR_OPERATIONS_FUNCTIONAL_QA.md');
if (exists('docs/HR_OPERATIONS_FINAL_CLOSEOUT.md')) ok('exists docs/HR_OPERATIONS_FINAL_CLOSEOUT.md'); else warn('optional missing docs/HR_OPERATIONS_FINAL_CLOSEOUT.md');

console.log(`\nHR/Operations final closeout result: ${failed ? 'FAILED' : 'OK'} | failed=${failed} | warnings=${warnings}`);
if (failed) process.exit(1);
