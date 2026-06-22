const BASE_URL = process.env.ERP_BASE_URL || 'http://localhost:3040';
const EMAIL = process.env.ERP_TEST_EMAIL || 'admin@logistics-erp.com';
const PASSWORD = process.env.ERP_TEST_PASSWORD || '';

const routes = [
  '/',
  '/dashboard',
  '/reports',
  '/notifications',
  '/management-reports',
  '/daily-reports',
  '/operations-alerts',
  '/uploaded-reports',
  '/report-templates',
];

function cookieHeader(headers) {
  const raw = [];
  if (typeof headers.getSetCookie === 'function') raw.push(...headers.getSetCookie());
  const single = headers.get('set-cookie');
  if (single) raw.push(single);
  return raw.map((c) => c.split(';')[0]).filter(Boolean).join('; ');
}

async function login() {
  if (!PASSWORD) throw new Error('ERP_TEST_PASSWORD is required');
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    redirect: 'manual',
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Login failed ${res.status}: ${body.slice(0, 300)}`);
  const cookies = cookieHeader(res.headers);
  if (!cookies) throw new Error('Login OK but no Set-Cookie header was returned');
  return cookies;
}

async function checkRoute(route, cookies) {
  const res = await fetch(`${BASE_URL}${route}`, {
    headers: { cookie: cookies },
    redirect: 'manual',
  });
  const ok = res.status >= 200 && res.status < 300;
  console.log(`${ok ? '✅' : '❌'} ${res.status} ${route}`);
  return ok;
}

async function main() {
  console.log(`Home/dashboard authenticated smoke test: ${BASE_URL}`);
  const cookies = await login();
  console.log('✅ Login OK');
  let failed = 0;
  for (const route of routes) {
    const ok = await checkRoute(route, cookies);
    if (!ok) failed++;
  }
  console.log(`\nHome/dashboard smoke result: ${failed ? 'FAILED' : 'OK'} | failed=${failed}`);
  process.exitCode = failed ? 1 : 0;
}

main().catch((err) => {
  console.error('❌ Smoke script crashed:', err);
  process.exitCode = 1;
});
