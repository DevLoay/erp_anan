#!/usr/bin/env node
const BASE_URL = process.env.ERP_BASE_URL || 'http://localhost:3040';
const EMAIL = process.env.ERP_TEST_EMAIL || 'admin@logistics-erp.com';
const PASSWORD = process.env.ERP_TEST_PASSWORD || '';

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

async function request(method, path, cookie, body) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { cookie, 'content-type': 'application/json' },
    redirect: 'manual',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* ignore */ }
  return { response, text, json };
}

function userIdFrom(json) {
  return json?.data?.id || json?.data?.user?.id || json?.user?.id || json?.id;
}

async function main() {
  console.log(`User management CRUD smoke test: ${BASE_URL}`);
  let failed = 0;
  const cookie = await login();
  console.log('✅ Login OK');

  const stamp = Date.now();
  const email = `qa-settings-${stamp}@example.test`;
  const createPayload = {
    name: `QA Settings User ${stamp}`,
    email,
    role: 'VIEWER',
    status: 'active',
    password: `QA-${stamp}`,
    cityId: '',
    supervisorId: '',
    driverId: '',
    cityScope: [],
    projectScope: [],
  };

  const created = await request('POST', '/api/user-management', cookie, createPayload);
  if (created.response.status !== 201) {
    console.log(`❌ POST /api/user-management -> ${created.response.status} ${created.text.slice(0, 400)}`);
    process.exitCode = 1;
    return;
  }
  const id = userIdFrom(created.json);
  if (!id) {
    console.log('❌ POST /api/user-management returned no user id');
    process.exitCode = 1;
    return;
  }
  console.log(`✅ POST /api/user-management -> ${id}`);

  const patched = await request('PATCH', `/api/user-management/${id}`, cookie, {
    ...createPayload,
    name: `QA Settings User Updated ${stamp}`,
    role: 'ACCOUNTANT',
    status: 'active',
  });
  if (!patched.response.ok) {
    failed += 1;
    console.log(`❌ PATCH /api/user-management/${id} -> ${patched.response.status} ${patched.text.slice(0, 400)}`);
  } else {
    console.log(`✅ PATCH /api/user-management/${id}`);
  }

  const reset = await request('POST', `/api/user-management/${id}/reset-password`, cookie, {});
  if (!reset.response.ok) {
    failed += 1;
    console.log(`❌ POST /api/user-management/${id}/reset-password -> ${reset.response.status} ${reset.text.slice(0, 400)}`);
  } else {
    console.log(`✅ POST /api/user-management/${id}/reset-password`);
  }

  const deleted = await request('DELETE', `/api/user-management/${id}`, cookie, undefined);
  if (!deleted.response.ok) {
    failed += 1;
    console.log(`❌ DELETE /api/user-management/${id} -> ${deleted.response.status} ${deleted.text.slice(0, 400)}`);
  } else {
    console.log(`✅ DELETE /api/user-management/${id}`);
  }

  console.log(`\nUser management CRUD result: ${failed ? 'FAILED' : 'OK'} | failed=${failed}`);
  process.exitCode = failed ? 1 : 0;
}

main().catch((error) => {
  console.error('❌ Unexpected error', error);
  process.exitCode = 1;
});
