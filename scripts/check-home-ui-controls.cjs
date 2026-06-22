#!/usr/bin/env node
/*
  Home/dashboard UI controls audit
  - Static source checks for filters/buttons/export/print/search/pagination/details
  - Optional authenticated HTML checks if NEXT dev server is running
*/
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const BASE_URL = process.env.BASE_URL || 'http://localhost:3040';
const EMAIL = process.env.ERP_TEST_EMAIL || 'admin@logistics-erp.com';
const PASSWORD = process.env.ERP_TEST_PASSWORD || 'Admin@123456';

let failed = 0;
let warned = 0;

function ok(msg) { console.log(`✅ ${msg}`); }
function warn(msg) { warned += 1; console.log(`⚠️ ${msg}`); }
function fail(msg) { failed += 1; console.log(`❌ ${msg}`); }
function read(rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, 'utf8');
}
function includesAll(label, rel, required, optional = []) {
  const content = read(rel);
  if (!content) return fail(`${label}: missing ${rel}`);
  ok(`${label}: exists ${rel}`);
  for (const item of required) {
    if (content.includes(item)) ok(`${label}: ${item}`);
    else fail(`${label}: missing ${item}`);
  }
  for (const item of optional) {
    if (content.includes(item)) ok(`${label}: optional ${item}`);
    else warn(`${label}: optional missing ${item}`);
  }
}

function checkStatic() {
  console.log('\n==============================');
  console.log('HOME UI CONTROLS STATIC AUDIT');
  console.log('==============================');

  includesAll(
    'Dashboard controls',
    'src/components/dashboard/AdminDashboardOldClient.tsx',
    ['printPage', 'downloadCsv', 'name="q"', 'name="fromDate"', 'name="toDate"', 'تطبيق', 'عرض الكل'],
    ['استيراد Excel / PDF']
  );

  includesAll(
    'Management reports controls',
    'src/components/reports/ManagementReportsOldClient.tsx',
    ['exportCsv', 'pageSize', 'management-search', 'management-city', 'management-project', 'management-app', 'management-supervisor', 'management-status', 'toggleVisibleRows', 'فتح التقرير', 'تطبيق'],
    ['saveLevelViewOnly', 'فتح تقرير المندوب']
  );

  includesAll(
    'Notifications controls',
    'src/components/notifications/NotificationsAlertsClient.tsx',
    ['exportCsv', 'notifications-search', 'notifications-severity', 'notifications-city', 'notifications-app', 'notifications-source', 'notifications-status', 'rowAction', 'تطبيق'],
    ['DELETE', 'طباعة / PDF']
  );

  includesAll(
    'Reports filter bar',
    'src/components/reports/ReportFilterBar.tsx',
    ['name="dateFrom"', 'name="dateTo"', 'name="q"', 'تطبيق'],
    ['resetHref', 'عرض الكل']
  );

  includesAll(
    'Generic resource workspace',
    'src/components/ui/ResourceWorkspace.tsx',
    ['fetch(', 'POST', 'PATCH', 'DELETE'],
    ['تصدير', 'طباعة', 'إضافة', 'تعديل', 'حذف', 'بحث']
  );
}

async function fetchWithCookie(url, cookie) {
  return fetch(url, { headers: cookie ? { cookie } : {} });
}
function cookieFrom(res) {
  const raw = res.headers.get('set-cookie') || '';
  return raw.split(',').map((part) => part.split(';')[0]).filter(Boolean).join('; ');
}
async function checkRuntime() {
  console.log('\n==============================');
  console.log('HOME UI CONTROLS RUNTIME AUDIT');
  console.log('==============================');
  let cookie = '';
  try {
    const login = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    if (!login.ok) {
      warn(`Runtime skipped: login returned ${login.status}. Check credentials.`);
      return;
    }
    cookie = cookieFrom(login);
    ok('Login OK');
  } catch (err) {
    warn(`Runtime skipped: server not reachable at ${BASE_URL}. Start npm run dev first.`);
    return;
  }

  const pages = [
    { route: '/', must: ['لوحة', 'التقارير', 'الإشعارات'] },
    { route: '/dashboard', must: ['تطبيق', 'عرض الكل', 'تصدير', 'طباعة'] },
    { route: '/reports', must: ['التقارير العامة', 'تطبيق'] },
    { route: '/notifications', must: ['الإشعارات', 'تطبيق', 'تصدير'] },
    { route: '/management-reports', must: ['تطبيق', 'تصدير', 'طباعة'] },
    { route: '/daily-reports', must: ['تطبيق'] },
    { route: '/operations-alerts', must: ['تطبيق'] },
    { route: '/uploaded-reports', must: ['إضافة', 'تعديل', 'حذف'] },
    { route: '/report-templates', must: ['إضافة', 'تعديل', 'حذف'] },
  ];

  for (const page of pages) {
    const res = await fetchWithCookie(`${BASE_URL}${page.route}`, cookie);
    if (!res.ok) {
      fail(`${page.route}: status ${res.status}`);
      continue;
    }
    const html = await res.text();
    ok(`${page.route}: 200`);
    for (const text of page.must) {
      if (html.includes(text)) ok(`${page.route}: contains ${text}`);
      else warn(`${page.route}: missing visible text ${text}`);
    }
  }
}

(async function main() {
  checkStatic();
  await checkRuntime();
  console.log('\n==============================');
  console.log(`Home UI controls result: ${failed ? 'FAILED' : 'OK'} | failed=${failed} | warnings=${warned}`);
  console.log('==============================');
  process.exit(failed ? 1 : 0);
})();
