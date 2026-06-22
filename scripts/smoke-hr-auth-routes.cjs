#!/usr/bin/env node
const BASE_URL = process.env.ERP_BASE_URL || 'http://localhost:3040';
const EMAIL = process.env.ERP_TEST_EMAIL;
const PASSWORD = process.env.ERP_TEST_PASSWORD;

function statusOk(status) {
  return status >= 200 && status < 400;
}
function parseCookies(headers) {
  const raw = headers.getSetCookie ? headers.getSetCookie() : [];
  const fallback = headers.get('set-cookie') ? [headers.get('set-cookie')] : [];
  return (raw.length ? raw : fallback)
    .flatMap((v) => String(v).split(/,(?=[^;]+?=)/g))
    .map((cookie) => cookie.split(';')[0])
    .filter(Boolean)
    .join('; ');
}
async function login() {
  if (!EMAIL) throw new Error('ERP_TEST_EMAIL is required');
  if (!PASSWORD) throw new Error('ERP_TEST_PASSWORD is required');
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    redirect: 'manual',
  });
  if (!statusOk(res.status) && res.status !== 401) {
    const body = await res.text().catch(() => '');
    throw new Error(`Login failed with status ${res.status}: ${body.slice(0, 300)}`);
  }
  if (res.status === 401) throw new Error('Login returned 401. Check ERP_TEST_EMAIL / ERP_TEST_PASSWORD.');
  const cookie = parseCookies(res.headers);
  if (!cookie) throw new Error('Login did not return auth cookie.');
  return cookie;
}
async function checkRoute(cookie, route, requiredTexts = []) {
  const res = await fetch(`${BASE_URL}${route}`, {
    headers: { cookie },
    redirect: 'manual',
  });
  const body = await res.text().catch(() => '');
  if (!statusOk(res.status)) {
    console.log(`❌ ${route}: ${res.status}`);
    return 1;
  }
  console.log(`✅ ${route}: ${res.status}`);
  let failures = 0;
  for (const text of requiredTexts) {
    if (body.includes(text)) console.log(`✅ ${route}: contains ${text}`);
    else { console.log(`⚠️ ${route}: missing visible text ${text}`); }
  }
  return failures;
}

async function main() {
  console.log(`HR/operations authenticated smoke test: ${BASE_URL}`);
  let failed = 0;
  try {
    const cookie = await login();
    console.log('✅ Login OK');
    const routes = [
      ['/', ['لوحة']],
      ['/drivers', ['المناديب']],
      ['/drivers/new', ['مندوب']],
      ['/supervisors', ['المشرف']],
      ['/attendance', ['الحضور']],
      ['/shifts', ['شفت']],
      ['/supervisor-tasks', ['مهام']],
      ['/interviews', ['المقابلات']],
    ];
    for (const [route, texts] of routes) {
      failed += await checkRoute(cookie, route, texts);
    }
  } catch (err) {
    console.error('❌ Smoke script crashed:', err);
    process.exit(1);
  }
  console.log(`\nHR/operations authenticated smoke result: ${failed ? 'FAILED' : 'OK'} | failed=${failed}`);
  process.exit(failed ? 1 : 0);
}
main();
