#!/usr/bin/env node
const BASE_URL = process.env.ERP_BASE_URL || 'http://localhost:3040';
const ADMIN_EMAIL = process.env.ERP_TEST_EMAIL || 'admin@logistics-erp.com';
const ADMIN_PASSWORD = process.env.ERP_TEST_PASSWORD || '';

function cookieFromResponse(response) {
  const headers = response.headers;
  let setCookies = [];
  if (typeof headers.getSetCookie === 'function') setCookies = headers.getSetCookie();
  const single = headers.get('set-cookie');
  if (!setCookies.length && single) setCookies = [single];
  return setCookies.map((cookie) => cookie.split(';')[0]).join('; ');
}

async function login(email, password) {
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    redirect: 'manual',
    body: JSON.stringify({ email, password }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Login failed for ${email}: ${response.status} ${text.slice(0, 300)}`);
  const cookie = cookieFromResponse(response);
  if (!cookie) throw new Error(`Login OK but no cookie returned for ${email}`);
  return cookie;
}

async function request(method, path, cookie, body) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { cookie, 'content-type': 'application/json' },
    redirect: 'manual',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  return { response, text, json };
}

function userIdFrom(json) {
  return json?.data?.id || json?.data?.user?.id || json?.user?.id || json?.id;
}

function isAllowedStatus(status) {
  return status === 200;
}

function isDeniedStatus(status, location = '') {
  return status === 401 || status === 403 || status === 307 || status === 308 || String(location).includes('/access-denied') || String(location).includes('/login');
}

async function createUser(adminCookie, role, password) {
  const stamp = Date.now() + Math.floor(Math.random() * 100000);
  const payload = {
    name: `QA Role ${role} ${stamp}`,
    email: `qa-role-${role.toLowerCase()}-${stamp}@example.test`,
    role,
    status: 'active',
    password,
    cityId: '',
    supervisorId: '',
    driverId: '',
    cityScope: [],
    projectScope: [],
  };
  const created = await request('POST', '/api/user-management', adminCookie, payload);
  if (created.response.status !== 201) {
    throw new Error(`Could not create ${role}: ${created.response.status} ${created.text.slice(0, 400)}`);
  }
  const id = userIdFrom(created.json);
  if (!id) throw new Error(`Create ${role} returned no id`);
  return { id, ...payload };
}

async function deleteUser(adminCookie, id) {
  try { await request('DELETE', `/api/user-management/${id}`, adminCookie); } catch {}
}

const cases = [
  {
    role: 'ACCOUNTANT',
    shouldAllow: ['/finance', '/invoices', '/expenses', '/revenues', '/payments', '/receivables', '/vat', '/profit-loss', '/financial-reports'],
    shouldDeny: ['/users', '/user-management', '/permissions', '/audit-log', '/settings', '/drivers', '/vehicles'],
  },
  {
    role: 'HR',
    shouldAllow: ['/drivers', '/supervisors', '/advances'],
    shouldDeny: ['/users', '/user-management', '/permissions', '/audit-log', '/finance', '/invoices', '/profit-loss', '/vehicles'],
  },
  {
    role: 'SUPERVISOR',
    shouldAllow: ['/drivers', '/attendance', '/supervisor-tasks'],
    shouldDeny: ['/users', '/user-management', '/permissions', '/audit-log', '/finance', '/invoices', '/payroll', '/vehicles'],
  },
  {
    role: 'VIEWER',
    shouldAllow: ['/'],
    shouldDeny: ['/users', '/user-management', '/permissions', '/audit-log', '/settings', '/finance', '/invoices', '/expenses', '/payroll'],
  },
];

async function checkRoute(cookie, role, route, expected) {
  const res = await fetch(`${BASE_URL}${route}`, { headers: { cookie }, redirect: 'manual' });
  const location = res.headers.get('location') || '';
  const ok = expected === 'allow' ? isAllowedStatus(res.status) : isDeniedStatus(res.status, location) || !isAllowedStatus(res.status);
  const icon = ok ? '✅' : '❌';
  const suffix = location ? ` -> ${location}` : '';
  console.log(`${icon} ${role} ${expected.toUpperCase()} ${route} => ${res.status}${suffix}`);
  return ok ? 0 : 1;
}

async function main() {
  if (!ADMIN_PASSWORD) throw new Error('ERP_TEST_PASSWORD is required.');
  console.log(`Permission role enforcement smoke test: ${BASE_URL}`);
  let failed = 0;
  const adminCookie = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  console.log('✅ Admin Login OK');
  const createdUsers = [];

  try {
    for (const testCase of cases) {
      const password = `Role-${testCase.role}-${Date.now()}!`;
      const user = await createUser(adminCookie, testCase.role, password);
      createdUsers.push(user);
      console.log(`\n👤 Created ${testCase.role}: ${user.email}`);
      const cookie = await login(user.email, password);
      console.log(`✅ ${testCase.role} Login OK`);

      for (const route of testCase.shouldAllow) failed += await checkRoute(cookie, testCase.role, route, 'allow');
      for (const route of testCase.shouldDeny) failed += await checkRoute(cookie, testCase.role, route, 'deny');
    }
  } finally {
    for (const user of createdUsers.reverse()) {
      await deleteUser(adminCookie, user.id);
      console.log(`🧹 deleted ${user.role}: ${user.email}`);
    }
  }

  console.log(`\nPermission role enforcement result: ${failed ? 'FAILED' : 'OK'} | failed=${failed}`);
  process.exitCode = failed ? 1 : 0;
}

main().catch((error) => {
  console.error('❌ Unexpected error', error);
  process.exitCode = 1;
});
