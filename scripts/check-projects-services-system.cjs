#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
let failures = 0;
let warnings = 0;

function rel(p) { return path.join(root, p); }
function exists(p) { return fs.existsSync(rel(p)); }
function read(p) { try { return fs.readFileSync(rel(p), 'utf8'); } catch { return ''; } }
function ok(msg) { console.log(`✅ ${msg}`); }
function warn(msg) { warnings++; console.log(`⚠️ ${msg}`); }
function fail(msg) { failures++; console.log(`❌ ${msg}`); }
function checkFile(label, file, optional = false) {
  if (exists(file)) ok(`${label} — ${file}`);
  else optional ? warn(`${label} optional missing — ${file}`) : fail(`${label} missing — ${file}`);
}
function checkContent(label, file, needles, optional = false) {
  const txt = read(file);
  const missing = needles.filter((n) => !txt.includes(n));
  if (!exists(file)) return optional ? warn(`${label} optional file missing — ${file}`) : fail(`${label} file missing — ${file}`);
  if (!missing.length) ok(label);
  else optional ? warn(`${label} optional missing: ${missing.join(', ')}`) : fail(`${label} missing: ${missing.join(', ')}`);
}
function anyFile(files) { return files.find(exists); }

console.log('\n==============================');
console.log('PROJECTS / SERVICES CLOSEOUT AUDIT');
console.log('==============================\n');

console.log('1) Pages');
checkFile('المشاريع /projects', 'src/app/projects/page.tsx');
checkFile('لوحة مشروع /projects/[projectId]/dashboard', 'src/app/projects/[projectId]/dashboard/page.tsx');
checkFile('حسابات مشروع /projects/[projectId]/accounts', 'src/app/projects/[projectId]/accounts/page.tsx');
checkFile('مناديب مشروع /projects/[projectId]/drivers', 'src/app/projects/[projectId]/drivers/page.tsx');
checkFile('استيراد مشروع /projects/[projectId]/imports', 'src/app/projects/[projectId]/imports/page.tsx');
checkFile('فواتير مشروع /projects/[projectId]/invoices', 'src/app/projects/[projectId]/invoices/page.tsx');
checkFile('رواتب مشروع /projects/[projectId]/payroll', 'src/app/projects/[projectId]/payroll/page.tsx');
checkFile('تقارير مشروع /projects/[projectId]/reports', 'src/app/projects/[projectId]/reports/page.tsx');
checkFile('إعدادات مشروع /projects/[projectId]/settings', 'src/app/projects/[projectId]/settings/page.tsx');
checkFile('المدن /cities', 'src/app/cities/page.tsx');
const accountReviewPage = anyFile([
  'src/app/settings/application-account-review/page.tsx',
  'src/app/account-linking-review/page.tsx',
]);
if (accountReviewPage) ok(`مراجعة ربط الحسابات — ${accountReviewPage}`);
else warn('مراجعة ربط الحسابات optional missing — expected src/app/settings/application-account-review/page.tsx');

console.log('\n2) API routes');
checkFile('المشاريع /api/projects', 'src/app/api/projects/route.ts', true);
checkFile('مشروع مفرد /api/projects/[id]', 'src/app/api/projects/[id]/route.ts', true);
checkFile('المدن /api/cities', 'src/app/api/cities/route.ts', true);
checkFile('مدينة مفردة /api/cities/[id]', 'src/app/api/cities/[id]/route.ts', true);
const accountApi = anyFile([
  'src/app/api/settings/application-account-review/route.ts',
  'src/app/api/account-linking/route.ts',
  'src/app/api/account-linking-review/route.ts',
  'src/app/api/application-account-review/route.ts',
]);
if (accountApi) ok(`ربط الحسابات API — ${accountApi}`);
else warn('ربط الحسابات API optional missing');

console.log('\n3) Data loaders / clients');
checkFile('Projects page', 'src/app/projects/page.tsx');
checkFile('ProjectWorkspaceViews', 'src/app/projects/ProjectWorkspaceViews.tsx', true);
checkFile('projectWorkspace data', 'src/lib/projects/projectWorkspace.ts', true);
checkFile('legacyProjectRedirect', 'src/lib/projects/legacyProjectRedirect.ts', true);
checkFile('CityOldPagesClient', 'src/components/cities/CityOldPagesClient.tsx', true);
checkFile('getCityOldPagesData', 'src/lib/cities/getCityOldPagesData.ts', true);
checkFile('cityNormalization', 'src/lib/cities/cityNormalization.ts', true);
const accountClient = anyFile([
  'src/components/account-linking/ApplicationAccountReviewClient.tsx',
  'src/components/settings/ApplicationAccountReviewClient.tsx',
  'src/components/application-account-review/ApplicationAccountReviewClient.tsx',
]);
if (accountClient) ok(`ApplicationAccountReviewClient — ${accountClient}`);
else warn('ApplicationAccountReviewClient optional missing');
const accountLib = anyFile([
  'src/lib/account-linking/accountLinking.ts',
  'src/lib/account-linking.ts',
  'src/lib/settings/accountLinking.ts',
]);
if (accountLib) ok(`account linking data/mutations — ${accountLib}`);
else warn('account linking lib optional missing');

console.log('\n4) Prisma schema models');
const schema = read('prisma/schema.prisma');
['City', 'Project', 'Application', 'ApplicationProject', 'ApplicationAccount'].forEach((m) => {
  schema.includes(`model ${m} `) ? ok(`model ${m}`) : warn(`model ${m} optional missing`);
});

console.log('\n5) Sidebar/navigation mapping');
const modules = read('src/lib/modules.ts') || read('src/components/layout/Sidebar.tsx');
[
  ['/projects', 'المشاريع'],
  ['/settings/application-account-review', 'مراجعة ربط الحسابات'],
  ['/cities', 'المدن'],
].forEach(([href, label]) => {
  modules.includes(href) ? ok(`${label} in modules/sidebar — ${href}`) : warn(`${label} not found in modules/sidebar — ${href}`);
});

console.log('\n6) Permission resources');
const perms = read('src/lib/permissions.ts');
[
  ['/projects', 'projects'],
  ['/settings/application-account-review', 'application-accounts'],
  ['/cities', 'cities'],
].forEach(([route, resource]) => {
  perms.includes(route) || perms.includes(`"${resource}"`) || perms.includes(`'${resource}'`) ? ok(`permission includes ${route}`) : warn(`permission missing ${route}`);
});

console.log('\n7) UI controls static checks');
checkContent('Projects controls', 'src/app/projects/page.tsx', ['name="q"', 'تطبيق', 'عرض الكل'], true);
checkContent('Projects workspace controls', 'src/app/projects/ProjectWorkspaceViews.tsx', ['تطبيق'], true);
checkContent('Cities controls', 'src/components/cities/CityOldPagesClient.tsx', ['fetch(', 'POST', 'name="q"', 'تطبيق', 'عرض الكل'], true);
if (accountClient) {
  checkContent('Account linking review controls', accountClient, ['fetch('], true);
}

console.log('\n8) Recommended tests');
console.log('شغل السيرفر: docker start erp-postgres-1 ثم npm run dev');
console.log('ثم: node scripts/smoke-projects-services-auth-routes.cjs');

console.log('\n==============================');
console.log(`Result: ${failures ? 'FAILED' : 'OK'} | failures=${failures} | warnings=${warnings}`);
console.log('==============================\n');
process.exit(failures ? 1 : 0);
