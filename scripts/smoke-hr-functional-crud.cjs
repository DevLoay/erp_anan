#!/usr/bin/env node
/*
  HR / Operations functional smoke test.
  Covers safe CRUD-style workflows for:
  - Driver manual creation API with cleanup
  - Supervisor task create / update / cancel API with cleanup
  - Attendance check-in / check-out API with cleanup

  v2 note:
  If the database has no City/Supervisor reference records, the script creates
  temporary QA-only references directly with Prisma, uses them for the test,
  then cleans them up safely at the end.
*/
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

function loadDotEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}
loadDotEnv();

const prisma = new PrismaClient();
const BASE_URL = process.env.ERP_BASE_URL || 'http://localhost:3040';
const EMAIL = process.env.ERP_TEST_EMAIL;
const PASSWORD = process.env.ERP_TEST_PASSWORD;
const QA_PREFIX = `QA-HR-${Date.now()}`;
const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

function statusOk(status) {
  return status >= 200 && status < 300;
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

async function requestJson(cookie, route, options = {}) {
  const res = await fetch(`${BASE_URL}${route}`, {
    redirect: 'manual',
    ...options,
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await res.text().catch(() => '');
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (_) {}
  return { res, text, json };
}

async function login() {
  if (!EMAIL) throw new Error('ERP_TEST_EMAIL is required');
  if (!PASSWORD) throw new Error('ERP_TEST_PASSWORD is required');
  const { res, text } = await requestJson('', '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (res.status === 401) throw new Error('Login returned 401. Check ERP_TEST_EMAIL / ERP_TEST_PASSWORD.');
  if (!statusOk(res.status)) throw new Error(`Login failed ${res.status}: ${text.slice(0, 300)}`);
  const cookie = parseCookies(res.headers);
  if (!cookie) throw new Error('Login did not return auth cookie.');
  return cookie;
}

async function requireServer() {
  try {
    const res = await fetch(`${BASE_URL}/`, { redirect: 'manual' });
    return res.status > 0;
  } catch (err) {
    throw new Error(`Server is not reachable at ${BASE_URL}. Start: docker start erp-postgres-1 ثم npm run dev`);
  }
}

function logOk(label, extra = '') { console.log(`✅ ${label}${extra ? ` — ${extra}` : ''}`); }
function logWarn(label, extra = '') { console.log(`⚠️ ${label}${extra ? ` — ${extra}` : ''}`); }
function logFail(label, extra = '') { console.log(`❌ ${label}${extra ? ` — ${extra}` : ''}`); }

async function getRefs() {
  const city = await prisma.city.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { id: true, nameAr: true, nameEn: true },
  }).catch(() => null);

  const supervisor = await prisma.supervisor.findFirst({
    where: city ? { OR: [{ cityId: city.id }, { cityId: null }] } : undefined,
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, cityId: true },
  }).catch(() => null);

  const resolvedCity = supervisor?.cityId
    ? await prisma.city.findUnique({ where: { id: supervisor.cityId }, select: { id: true, nameAr: true, nameEn: true } }).catch(() => city)
    : city;

  const driver = await prisma.driver.findFirst({
    where: resolvedCity ? { cityId: resolvedCity.id } : undefined,
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, actualName: true, cityId: true, supervisorId: true },
  }).catch(() => null);

  return { city: resolvedCity || city, supervisor, driver };
}

async function ensureFunctionalRefs(refs, created) {
  if (!refs.city?.id) {
    const city = await prisma.city.create({
      data: {
        nameAr: `${QA_PREFIX} مدينة اختبار`,
        nameEn: `${QA_PREFIX} Test City`,
        status: 'ACTIVE',
      },
      select: { id: true, nameAr: true, nameEn: true },
    });
    created.cityId = city.id;
    refs.city = city;
    logOk('created QA reference city', city.nameAr || city.id);
  }

  if (!refs.supervisor?.id || (refs.supervisor.cityId && refs.supervisor.cityId !== refs.city.id)) {
    const supervisor = await prisma.supervisor.create({
      data: {
        name: `${QA_PREFIX} مشرف اختبار`,
        phone: '+966500000099',
        email: `${QA_PREFIX.toLowerCase()}@example.test`,
        cityId: refs.city.id,
        status: 'ACTIVE',
      },
      select: { id: true, name: true, cityId: true },
    });
    created.supervisorId = supervisor.id;
    refs.supervisor = supervisor;
    logOk('created QA reference supervisor', supervisor.name || supervisor.id);
  }

  return refs;
}

async function cleanup(created) {
  if (created.taskId) {
    await prisma.notification.deleteMany({ where: { entityType: 'Task', entityId: created.taskId } }).catch(() => null);
    await prisma.auditLog.deleteMany({ where: { entityType: 'Task', entityId: created.taskId } }).catch(() => null);
    await prisma.task.deleteMany({ where: { id: created.taskId } }).catch(() => null);
    logOk('cleanup supervisor task', created.taskId);
  }
  if (created.attendanceId) {
    await prisma.auditLog.deleteMany({ where: { entityType: 'AttendanceRecord', entityId: created.attendanceId } }).catch(() => null);
    await prisma.attendanceRecord.deleteMany({ where: { id: created.attendanceId } }).catch(() => null);
    logOk('cleanup attendance record', created.attendanceId);
  }
  if (created.driverId) {
    await prisma.auditLog.deleteMany({ where: { entityType: { in: ['drivers', 'Driver'] }, entityId: created.driverId } }).catch(() => null);
    await prisma.driver.deleteMany({ where: { id: created.driverId } }).catch(() => null);
    logOk('cleanup manual driver', created.driverId);
  }
  if (created.supervisorId) {
    await prisma.auditLog.deleteMany({ where: { entityType: { in: ['supervisors', 'Supervisor'] }, entityId: created.supervisorId } }).catch(() => null);
    await prisma.supervisor.deleteMany({ where: { id: created.supervisorId } }).catch(() => null);
    logOk('cleanup QA reference supervisor', created.supervisorId);
  }
  if (created.cityId) {
    await prisma.auditLog.deleteMany({ where: { entityType: { in: ['cities', 'City'] }, entityId: created.cityId } }).catch(() => null);
    await prisma.city.deleteMany({ where: { id: created.cityId } }).catch(() => null);
    logOk('cleanup QA reference city', created.cityId);
  }
}

async function testDriverManual(cookie, refs, created) {
  console.log('\n1) Driver manual create API');
  if (!refs.city?.id) {
    logWarn('SKIPPED driver create', 'no city found');
    return 0;
  }
  const internalCode = `${QA_PREFIX}-DRV`;
  const body = {
    internalCode,
    name: 'QA HR Functional Driver',
    actualName: 'QA HR Functional Driver',
    phone: '+966500000001',
    mobile: '+966500000001',
    cityId: refs.city.id,
    supervisorId: refs.supervisor?.cityId === refs.city.id ? refs.supervisor.id : undefined,
    status: 'ACTIVE',
    source: 'QA_FUNCTIONAL_SMOKE',
    vehicleOwnershipType: 'no_vehicle',
  };
  const { res, text, json } = await requestJson(cookie, '/api/drivers/manual', { method: 'POST', body: JSON.stringify(body) });
  if (res.status !== 201 || !json?.data?.driver?.id) {
    logFail('POST /api/drivers/manual', `${res.status}: ${text.slice(0, 300)}`);
    return 1;
  }
  created.driverId = json.data.driver.id;
  refs.driver = {
    id: json.data.driver.id,
    name: json.data.driver.name || body.name,
    actualName: json.data.driver.actualName || body.actualName,
    cityId: refs.city.id,
    supervisorId: refs.supervisor?.id,
  };
  logOk('POST /api/drivers/manual', `created ${created.driverId}`);
  return 0;
}

async function testSupervisorTaskCrud(cookie, refs, created) {
  console.log('\n2) Supervisor task API create/update/cancel');
  if (!refs.city?.id || !refs.supervisor?.id) {
    logWarn('SKIPPED supervisor task CRUD', 'city or supervisor missing');
    return 0;
  }
  const due = new Date(Date.now() + 86400000).toISOString();
  const driverId = refs.driver && refs.driver.cityId === refs.city.id ? refs.driver.id : undefined;
  const createBody = {
    title: `${QA_PREFIX} مهمة اختبار`,
    description: 'اختبار وظيفي مؤقت لقسم الموارد البشرية والتشغيل.',
    category: 'QA',
    cityId: refs.city.id,
    supervisorId: refs.supervisor.id,
    driverId,
    priority: 'INFO',
    dueDate: due,
    notes: 'created by smoke-hr-functional-crud',
  };
  const post = await requestJson(cookie, '/api/supervisor-tasks', { method: 'POST', body: JSON.stringify(createBody) });
  const taskId = post.json?.data?.task?.id;
  if (post.res.status !== 201 || !taskId) {
    logFail('POST /api/supervisor-tasks', `${post.res.status}: ${post.text.slice(0, 300)}`);
    return 1;
  }
  created.taskId = taskId;
  logOk('POST /api/supervisor-tasks', `created ${taskId}`);

  const patch = await requestJson(cookie, `/api/supervisor-tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'ACTIVE', notes: 'updated by QA smoke' }),
  });
  if (!statusOk(patch.res.status) || patch.json?.data?.status !== 'ACTIVE') {
    logFail('PATCH /api/supervisor-tasks/:id', `${patch.res.status}: ${patch.text.slice(0, 300)}`);
    return 1;
  }
  logOk('PATCH /api/supervisor-tasks/:id', 'status ACTIVE');

  const del = await requestJson(cookie, `/api/supervisor-tasks/${taskId}`, { method: 'DELETE' });
  if (!statusOk(del.res.status) || del.json?.data?.status !== 'CANCELLED') {
    logFail('DELETE /api/supervisor-tasks/:id', `${del.res.status}: ${del.text.slice(0, 300)}`);
    return 1;
  }
  logOk('DELETE /api/supervisor-tasks/:id', 'status CANCELLED');
  return 0;
}

async function testAttendanceCapture(cookie, refs, created) {
  console.log('\n3) Attendance check-in/check-out API');
  const personType = refs.driver?.id ? 'driver' : refs.supervisor?.id ? 'supervisor' : '';
  const personId = refs.driver?.id || refs.supervisor?.id;
  if (!personType || !personId) {
    logWarn('SKIPPED attendance capture', 'no driver or supervisor found');
    return 0;
  }
  const day = String((Date.now() % 20) + 1).padStart(2, '0');
  const workDate = `2099-12-${day}`;
  const checkInBody = {
    personType,
    personId,
    action: 'check-in',
    workDate,
    capturedAt: `${workDate}T08:00:00.000Z`,
    photoDataUrl: TINY_PNG,
  };
  const checkIn = await requestJson(cookie, '/api/attendance/capture', { method: 'POST', body: JSON.stringify(checkInBody) });
  const attendanceId = checkIn.json?.data?.id;
  if (!statusOk(checkIn.res.status) || !attendanceId) {
    logFail('POST /api/attendance/capture check-in', `${checkIn.res.status}: ${checkIn.text.slice(0, 300)}`);
    return 1;
  }
  created.attendanceId = attendanceId;
  logOk('POST /api/attendance/capture check-in', attendanceId);

  const checkOut = await requestJson(cookie, '/api/attendance/capture', {
    method: 'POST',
    body: JSON.stringify({ ...checkInBody, action: 'check-out', capturedAt: `${workDate}T17:00:00.000Z` }),
  });
  if (!statusOk(checkOut.res.status) || !checkOut.json?.data?.checkOut) {
    logFail('POST /api/attendance/capture check-out', `${checkOut.res.status}: ${checkOut.text.slice(0, 300)}`);
    return 1;
  }
  logOk('POST /api/attendance/capture check-out', `workingHours=${checkOut.json?.data?.workingHours ?? '-'}`);
  return 0;
}

async function main() {
  console.log(`HR/operations functional CRUD smoke test: ${BASE_URL}`);
  let failed = 0;
  const created = {};
  try {
    await requireServer();
    const cookie = await login();
    logOk('Login OK');
    const refs = await getRefs();
    if (refs.city) logOk('reference city', refs.city.nameAr || refs.city.nameEn || refs.city.id);
    else logWarn('reference city missing');
    if (refs.supervisor) logOk('reference supervisor', refs.supervisor.name || refs.supervisor.id);
    else logWarn('reference supervisor missing');
    if (refs.driver) logOk('reference driver', refs.driver.actualName || refs.driver.name || refs.driver.id);
    else logWarn('reference driver missing');

    await ensureFunctionalRefs(refs, created);

    failed += await testDriverManual(cookie, refs, created);
    failed += await testSupervisorTaskCrud(cookie, refs, created);
    failed += await testAttendanceCapture(cookie, refs, created);
  } catch (err) {
    console.error('❌ Functional smoke crashed:', err);
    failed += 1;
  } finally {
    await cleanup(created).catch((err) => console.warn('⚠️ cleanup warning:', err.message));
    await prisma.$disconnect().catch(() => null);
  }
  console.log(`\nHR/operations functional CRUD result: ${failed ? 'FAILED' : 'OK'} | failed=${failed}`);
  process.exit(failed ? 1 : 0);
}

main();
