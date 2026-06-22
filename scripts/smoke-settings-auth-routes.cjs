#!/usr/bin/env node
const BASE_URL = process.env.ERP_BASE_URL || 'http://localhost:3040';
const EMAIL = process.env.ERP_TEST_EMAIL || 'admin@logistics-erp.com';
const PASSWORD = process.env.ERP_TEST_PASSWORD || '';

const routes = [
  '/',
  '/settings',
  '/users',
  '/user-management',
  '/permissions',
  '/audit-log',
  '/settings/payroll',
  '/settings/templates',
  '/settings/application-account-review',
];

function cookieFromResponse(response) {
  const headers = response.headers;
  let setCookies = [];
  if (typeof headers.getSetCookie === 'function') setCookies = headers.getSetCookie();
  const single = headers.get('set-cookie');
  if (!setCookies.length && single) setCookies = [single];
  return setCookies.map((cookie) => cookie.split(';')[0]).join('; ');
}

async function login() {
  if (!PASSWORD) throw new Error('ERP_TEST_PASSWORD is required. Set it in PowerShell before running the script.');
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    redirect: 'manual',
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Login failed: ${response.status} ${text.slice(0, 300)}`);
  const cookie = cookieFromResponse(response);
  if (!cookie) throw new Error('Login succeeded but no session cookie was returned.');
  return cookie;
}

async function main() {
  console.log(`Settings authenticated smoke test: ${BASE_URL}`);
  let failed = 0;
  const cookie = await login();
  console.log('✅ Login OK');

  for (const route of routes) {
    try {
      const response = await fetch(`${BASE_URL}${route}`, {
        method: 'GET',
        headers: { cookie },
        redirect: 'manual',
      });
      const ok = response.status >= 200 && response.status < 300;
      console.log(`${ok ? '✅' : '❌'} ${response.status} ${route}`);
      if (!ok) failed += 1;
    } catch (error) {
      failed += 1;
      console.log(`❌ ERROR ${route}: ${error.message}`);
    }
  }

  console.log(`\nAuthenticated settings smoke result: ${failed ? 'FAILED' : 'OK'} | failed=${failed}`);
  process.exitCode = failed ? 1 : 0;
}

main().catch((error) => {
  console.error('❌ Smoke script crashed:', error);
  process.exitCode = 1;
});
