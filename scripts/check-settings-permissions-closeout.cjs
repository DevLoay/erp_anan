#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const requiredFiles = [
  'src/lib/permissions.ts',
  'src/lib/auth/accessScope.ts',
  'src/lib/auth/session.ts',
  'src/components/users/UserManagementOldPageClient.tsx',
  'src/lib/users/getUserManagementOldPageData.ts',
  'src/lib/users/userManagementMutations.ts',
  'src/app/users/page.tsx',
  'src/app/user-management/page.tsx',
  'src/app/permissions/page.tsx',
  'src/app/audit-log/page.tsx',
  'src/app/api/user-management/route.ts',
  'src/app/api/user-management/[id]/route.ts',
  'src/app/api/user-management/[id]/reset-password/route.ts',
  'scripts/check-settings-permissions-system.cjs',
  'scripts/smoke-settings-auth-routes.cjs',
  'scripts/smoke-user-management-crud.cjs',
  'scripts/smoke-permission-role-enforcement.cjs',
  'docs/SETTINGS_PERMISSIONS_CLOSEOUT_AUDIT.md',
  'docs/SETTINGS_PERMISSIONS_ASSIGNMENT_GUIDE.md',
  'docs/SETTINGS_PERMISSIONS_ENFORCEMENT_QA.md',
];

let failed = 0;
console.log('Settings & Permissions final closeout check');
console.log(`Project root: ${root}\n`);

for (const file of requiredFiles) {
  const full = path.join(root, file);
  if (fs.existsSync(full)) console.log(`✅ exists ${file}`);
  else { console.log(`❌ missing ${file}`); failed++; }
}

function checkContent(file, checks) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) return;
  const content = fs.readFileSync(full, 'utf8');
  for (const [label, pattern] of checks) {
    if (pattern.test(content)) console.log(`✅ ${label}`);
    else { console.log(`❌ ${label}`); failed++; }
  }
}

console.log('\nContent checks');
checkContent('src/lib/permissions.ts', [
  ['permissions include finance resources', /receivables[\s\S]*payments[\s\S]*expenses[\s\S]*revenues/],
  ['permissions include vehicle resources', /vehicle-maintenance[\s\S]*vehicle-authorizations[\s\S]*vehicle-accidents[\s\S]*vehicle-cleaning/],
  ['admin only resources protected', /adminOnlyResources/],
  ['read checker exists', /function canReadResource/],
  ['write checker exists', /function canWriteResource/],
]);
checkContent('src/components/users/UserManagementOldPageClient.tsx', [
  ['role preview/helper exists', /rolePreview|permissionPreview|معاينة|صلاحية/],
  ['scope warning exists', /نطاق|scope/i],
]);

console.log(`\nSettings permissions closeout result: ${failed ? 'NEEDS ATTENTION' : 'OK'} | failed=${failed}`);
process.exitCode = failed ? 1 : 0;
