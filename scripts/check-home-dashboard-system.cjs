const fs = require('fs');
const path = require('path');

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
function fail(label) { failures++; console.log(`❌ ${label}`); }
function warn(label) { warnings++; console.log(`⚠️ ${label}`); }
function checkExists(label, rel, required = true) {
  if (exists(rel)) ok(`${label} — ${rel}`);
  else required ? fail(`${label} missing — ${rel}`) : warn(`${label} optional missing — ${rel}`);
}
function includes(label, rel, needle, required = true) {
  const text = read(rel);
  if (text.includes(needle)) ok(label);
  else required ? fail(`${label} missing in ${rel}`) : warn(`${label} not found in ${rel}`);
}

console.log('\n==============================');
console.log('HOME / DASHBOARD CLOSEOUT AUDIT');
console.log('==============================\n');

console.log('1) Pages');
[
  ['لوحة الإدارة /dashboard', 'src/app/dashboard/page.tsx'],
  ['الإشعارات والتنبيهات /notifications', 'src/app/notifications/page.tsx'],
  ['التقارير العامة /management-reports', 'src/app/management-reports/page.tsx'],
  ['التقارير اليومية /daily-reports', 'src/app/daily-reports/page.tsx'],
  ['تنبيهات العمليات /operations-alerts', 'src/app/operations-alerts/page.tsx'],
  ['سجل الملفات والاستيراد /imports/history', 'src/app/imports/history/page.tsx'],
  ['إعدادات القوالب /settings/templates', 'src/app/settings/templates/page.tsx'],
].forEach(([label, rel]) => checkExists(label, rel));
checkExists('الرئيسية /', 'src/app/page.tsx', false);

console.log('\n2) Dashboard / reports engines');
[
  ['Dashboard data loader', 'src/lib/dashboard/getAdminDashboardOldData.ts'],
  ['Dashboard client', 'src/components/dashboard/AdminDashboardOldClient.tsx'],
  ['Notifications data loader', 'src/lib/notifications/getNotificationsData.ts'],
  ['Notifications client', 'src/components/notifications/NotificationsAlertsClient.tsx'],
  ['Reporting engine', 'src/lib/reporting.ts'],
  ['Analytics helpers', 'src/lib/page-analytics.ts'],
].forEach(([label, rel]) => checkExists(label, rel));

console.log('\n3) UI components');
[
  'src/components/analytics/MetricCard.tsx',
  'src/components/analytics/AlertPanel.tsx',
  'src/components/analytics/PageAnalyticsSection.tsx',
  'src/components/reports/ManagementReportsOldClient.tsx',
  'src/components/reports/ReportFilterBar.tsx',
  'src/components/reports/StatusBadge.tsx',
].forEach((rel) => checkExists(path.basename(rel), rel, false));

console.log('\n4) Prisma schema models');
const schema = read('prisma/schema.prisma');
['DailyReport', 'Task', 'Notification', 'ApplicationImportBatch', 'ApplicationImportTemplate', 'AuditLog'].forEach((model) => {
  schema.includes(`model ${model}`) ? ok(`model ${model}`) : fail(`model ${model} missing`);
});

console.log('\n5) Sidebar/navigation mapping');
const sidebarText = read('src/lib/modules.ts') + '\n' + read('src/lib/navigation.ts') + '\n' + read('src/components/layout/Sidebar.tsx');
[
  ['لوحة الإدارة', '/dashboard'],
  ['التقارير العامة', '/management-reports'],
  ['الإشعارات والتنبيهات', '/notifications'],
  ['التقارير اليومية', '/daily-reports'],
  ['تنبيهات العمليات', '/operations-alerts'],
  ['سجل الملفات والاستيراد', '/imports/history'],
  ['إعدادات القوالب', '/settings/templates'],
].forEach(([label, route]) => sidebarText.includes(route) ? ok(`${label} in sidebar — ${route}`) : warn(`${label} not found in sidebar — ${route}`));

console.log('\n6) Permission resources');
const permissions = read('src/lib/permissions.ts');
['/dashboard', '/management-reports', '/notifications', '/imports/history', '/settings/templates'].forEach((route) => {
  permissions.includes(route) ? ok(`permission includes ${route}`) : warn(`permission missing ${route}`);
});

console.log('\n7) Recommended tests');
console.log('شغل السيرفر: docker start erp-postgres-1 ثم npm run dev');
console.log('ثم: node scripts/smoke-home-auth-routes.cjs');

console.log('\n==============================');
console.log(`Result: ${failures ? 'FAILED' : 'OK'} | failures=${failures} | warnings=${warnings}`);
console.log('==============================\n');
process.exitCode = failures ? 1 : 0;
