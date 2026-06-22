#!/usr/bin/env node
const BASE_URL = process.env.ERP_TEST_BASE_URL || 'http://localhost:3040';
const email = process.env.ERP_TEST_EMAIL;
const password = process.env.ERP_TEST_PASSWORD;
let failed = 0;

function ok(msg) { console.log(`✅ ${msg}`); }
function warn(msg) { console.log(`⚠️ ${msg}`); }
function fail(msg) { failed++; console.log(`❌ ${msg}`); }

async function login() {
  if (!email) throw new Error('ERP_TEST_EMAIL is required');
  if (!password) throw new Error('ERP_TEST_PASSWORD is required');
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
    redirect: 'manual',
  });
  if (!res.ok && res.status !== 307 && res.status !== 302) throw new Error(`Login failed: ${res.status}`);
  const cookie = res.headers.getSetCookie ? res.headers.getSetCookie().join('; ') : (res.headers.get('set-cookie') || '');
  ok('Login OK');
  return cookie;
}

async function get(path, cookie) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: cookie ? { cookie } : {},
    redirect: 'manual',
  });
  const text = await res.text().catch(() => '');
  return { status: res.status, text, location: res.headers.get('location') };
}

function statusOk(status) {
  return status >= 200 && status < 400;
}

async function checkRoute(path, expectedText, cookie, allowRedirect = true) {
  const res = await get(path, cookie);
  if (statusOk(res.status)) ok(`${path}: ${res.status}`);
  else fail(`${path}: ${res.status}`);
  if (res.status >= 300 && res.status < 400 && allowRedirect) {
    warn(`${path}: redirected${res.location ? ` -> ${res.location}` : ''}`);
    return res;
  }
  if (expectedText && !res.text.includes(expectedText)) warn(`${path}: missing visible text ${expectedText}`);
  else if (expectedText) ok(`${path}: contains ${expectedText}`);
  return res;
}

function extractProjectId(projectsHtml) {
  const patterns = [
    /href=["']\/projects\/([^\/"'#?]+)\/dashboard["']/,
    /href=["']\/projects\/([^\/"'#?]+)["']/,
    /\/projects\/([^\/"'#?]+)\/accounts/,
  ];
  for (const p of patterns) {
    const m = projectsHtml.match(p);
    if (m && m[1] && !['new', 'page'].includes(m[1])) return m[1];
  }
  return null;
}

async function main() {
  console.log(`Projects/services authenticated smoke test: ${BASE_URL}`);
  const cookie = await login();
  await checkRoute('/', 'لوحة', cookie);
  const projects = await checkRoute('/projects', 'المشاريع', cookie);
  await checkRoute('/cities', 'المدن', cookie);
  await checkRoute('/settings/application-account-review', 'ربط', cookie);

  const projectId = extractProjectId(projects.text);
  if (projectId) {
    console.log(`\nProject workspace smoke: ${projectId}`);
    const sub = ['dashboard', 'accounts', 'drivers', 'imports', 'invoices', 'payroll', 'reports', 'settings'];
    for (const s of sub) await checkRoute(`/projects/${projectId}/${s}`, '', cookie);
  } else {
    warn('Project workspace routes skipped — no project link found on /projects');
  }

  console.log(`\nProjects/services authenticated smoke result: ${failed ? 'FAILED' : 'OK'} | failed=${failed}`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error('❌ Smoke script crashed:', err);
  process.exit(1);
});
