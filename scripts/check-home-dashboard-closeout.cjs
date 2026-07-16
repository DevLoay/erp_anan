const fs = require('fs');
const path = require('path');

const root = process.cwd();
let failed = 0;
let warnings = 0;

function ok(msg) { console.log(`✅ ${msg}`); }
function warn(msg) { warnings += 1; console.log(`⚠️ ${msg}`); }
function fail(msg) { failed += 1; console.log(`❌ ${msg}`); }
function exists(rel) {
  const p = path.join(root, rel);
  if (fs.existsSync(p)) ok(`exists ${rel}`);
  else fail(`missing ${rel}`);
}
function read(rel) {
  const p = path.join(root, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
}

console.log('\nHome/Dashboard final closeout check');
console.log(`Project root: ${root}\n`);

const pages = [
  'src/app/page.tsx',
  'src/app/dashboard/page.tsx',
  'src/app/notifications/page.tsx',
  'src/app/management-reports/page.tsx',
  'src/app/daily-reports/page.tsx',
  'src/app/operations-alerts/page.tsx',
  'src/app/imports/history/page.tsx',
  'src/app/settings/templates/page.tsx',
];
pages.forEach(exists);

[
  'src/lib/dashboard/getAdminDashboardOldData.ts',
  'src/components/dashboard/AdminDashboardOldClient.tsx',
  'src/lib/notifications/getNotificationsData.ts',
  'src/components/notifications/NotificationsAlertsClient.tsx',
  'src/lib/reporting.ts',
  'src/lib/page-analytics.ts',
  'scripts/check-home-dashboard-system.cjs',
  'scripts/smoke-home-auth-routes.cjs',
  'docs/HOME_DASHBOARD_CLOSEOUT_AUDIT.md',
  'docs/HOME_DASHBOARD_NAV_PERMISSION_FIX.md',
  'docs/HOME_DASHBOARD_UI_UX_CLOSEOUT.md',
].forEach(exists);

const modules = read('src/lib/modules.ts');
for (const route of ['/dashboard','/notifications','/management-reports','/daily-reports','/operations-alerts','/imports/history','/settings/templates']) {
  if (modules.includes(`href: "${route}"`) || modules.includes(`href: '${route}'`) || modules.includes(route)) ok(`sidebar/navigation route configured ${route}`);
  else warn(`sidebar/navigation route not found ${route}`);
}

const perms = read('src/lib/permissions.ts');
for (const route of ['/dashboard','/notifications','/management-reports','/daily-reports','/operations-alerts','/imports/history','/settings/templates']) {
  if (perms.includes(`route: "${route}"`) || perms.includes(`route: '${route}'`) || perms.includes(route)) ok(`permission route configured ${route}`);
  else warn(`permission route not found ${route}`);
}

const globals = read('src/app/globals.css');
if (globals.includes('HOME_DASHBOARD_CLOSEOUT_PRINT_AND_LAYOUT')) ok('print/responsive CSS polish installed');
else warn('print/responsive CSS polish marker not found');

console.log(`\nHome/Dashboard final closeout result: ${failed ? 'FAILED' : 'OK'} | failed=${failed} | warnings=${warnings}`);
process.exit(failed ? 1 : 0);
