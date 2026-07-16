#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

function loadDotEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!process.env[key]) process.env[key] = value;
  }
}
loadDotEnv();

const prisma = new PrismaClient();
const BASE_URL = process.env.ERP_BASE_URL || 'http://localhost:3040';
const EMAIL = process.env.ERP_TEST_EMAIL;
const PASSWORD = process.env.ERP_TEST_PASSWORD;
const QA = `qa-rider-documents-${Date.now()}`;
let failed = 0;
const created = { cityId: null, driverId: null, docId: null };

function ok(label, extra='') { console.log(`✅ ${label}${extra ? ` — ${extra}` : ''}`); }
function warn(label, extra='') { console.log(`⚠️ ${label}${extra ? ` — ${extra}` : ''}`); }
function fail(label, extra='') { failed++; console.log(`❌ ${label}${extra ? ` — ${extra}` : ''}`); }
function statusOk(status) { return status >= 200 && status < 300; }
function parseCookies(headers) {
  const raw = headers.getSetCookie ? headers.getSetCookie() : [];
  const fallback = headers.get('set-cookie') ? [headers.get('set-cookie')] : [];
  return (raw.length ? raw : fallback)
    .flatMap((v) => String(v).split(/,(?=[^;]+?=)/g))
    .map((cookie) => cookie.split(';')[0])
    .filter(Boolean)
    .join('; ');
}
async function requestJson(cookie, route, options={}) {
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
  try { json = text ? JSON.parse(text) : null; } catch {}
  return { res, text, json };
}
async function login() {
  if (!EMAIL) throw new Error('ERP_TEST_EMAIL is required');
  if (!PASSWORD) throw new Error('ERP_TEST_PASSWORD is required');
  const { res, text } = await requestJson('', '/api/auth/login', { method: 'POST', body: JSON.stringify({ email: EMAIL, password: PASSWORD }) });
  if (!statusOk(res.status)) throw new Error(`Login failed ${res.status}: ${text.slice(0, 300)}`);
  const cookie = parseCookies(res.headers);
  if (!cookie) throw new Error('Login did not return auth cookie');
  return cookie;
}
async function ensureDriver() {
  let driver = await prisma.driver.findFirst({ select: { id: true, name: true, actualName: true, internalCode: true } }).catch(() => null);
  if (driver) { ok('reference driver', driver.actualName || driver.name || driver.internalCode); return driver; }
  const city = await prisma.city.create({ data: { nameAr: `مدينة ${QA}`, nameEn: `City ${QA}`, status: 'ACTIVE' }, select: { id: true } });
  created.cityId = city.id;
  driver = await prisma.driver.create({
    data: { internalCode: `DOC-${Date.now()}`, name: `مندوب اختبار ${QA}`, actualName: `مندوب اختبار ${QA}`, cityId: city.id, status: 'ACTIVE', source: 'qa-rider-documents' },
    select: { id: true, name: true, actualName: true, internalCode: true },
  });
  created.driverId = driver.id;
  ok('created QA driver', driver.actualName || driver.id);
  return driver;
}
async function cleanup() {
  console.log('\n4) Cleanup test records');
  if (created.docId) await prisma.driverDocument.deleteMany({ where: { id: created.docId } }).then((r) => ok('cleanup document', String(r.count))).catch((e) => warn('cleanup document failed', e.message));
  await prisma.driverDocument.deleteMany({ where: { documentNumber: { contains: QA } } }).catch(() => null);
  if (created.driverId) await prisma.driver.deleteMany({ where: { id: created.driverId } }).then((r) => ok('cleanup driver', String(r.count))).catch((e) => warn('cleanup driver failed', e.message));
  if (created.cityId) await prisma.city.deleteMany({ where: { id: created.cityId } }).then((r) => ok('cleanup city', String(r.count))).catch((e) => warn('cleanup city failed', e.message));
}

async function main() {
  console.log(`Rider documents CRUD smoke test: ${BASE_URL}`);
  let cookie = '';
  try {
    cookie = await login();
    ok('Login OK');
    const driver = await ensureDriver();
    console.log('\n1) Page runtime');
    const page = await fetch(`${BASE_URL}/rider-documents`, { headers: { cookie } });
    const html = await page.text();
    if (page.status === 200 && html.includes('مستندات المناديب')) ok('/rider-documents page', '200'); else fail('/rider-documents page', `status=${page.status}`);

    console.log('\n2) Create/update/delete document');
    const expiry = new Date(); expiry.setDate(expiry.getDate() + 25);
    const create = await requestJson(cookie, '/api/rider-documents', {
      method: 'POST',
      body: JSON.stringify({
        driverId: driver.id,
        type: 'iqama',
        documentType: 'إقامة',
        documentNumber: QA,
        issueDate: new Date().toISOString(),
        expiryDate: expiry.toISOString(),
        status: 'PENDING',
        verificationStatus: 'pending',
        notes: 'QA rider documents smoke',
      }),
    });
    if (create.res.status === 201 && create.json?.document?.id) { created.docId = create.json.document.id; ok('POST /api/rider-documents', created.docId); } else fail('POST /api/rider-documents', `${create.res.status} ${create.text.slice(0, 200)}`);

    if (created.docId) {
      const patch = await requestJson(cookie, `/api/rider-documents/${created.docId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'APPROVED', verificationStatus: 'verified', notes: 'QA updated and verified' }),
      });
      if (statusOk(patch.res.status) && patch.json?.document?.verificationStatus === 'verified') ok('PATCH /api/rider-documents/:id', 'verified'); else fail('PATCH /api/rider-documents/:id', `${patch.res.status} ${patch.text.slice(0, 200)}`);

      const list = await requestJson(cookie, `/api/rider-documents?q=${encodeURIComponent(QA)}`);
      if (statusOk(list.res.status) && Array.isArray(list.json?.documents)) ok('GET /api/rider-documents?q=', `${list.json.documents.length} rows`); else fail('GET /api/rider-documents', `${list.res.status}`);

      const del = await requestJson(cookie, `/api/rider-documents/${created.docId}`, { method: 'DELETE' });
      if (statusOk(del.res.status)) { ok('DELETE /api/rider-documents/:id'); created.docId = null; } else fail('DELETE /api/rider-documents/:id', `${del.res.status} ${del.text.slice(0, 200)}`);
    }
  } catch (err) {
    fail('Rider documents smoke crashed', err && err.message ? err.message : String(err));
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
  console.log(`\nRider documents CRUD result: ${failed ? 'FAILED' : 'OK'} | failed=${failed}`);
  process.exit(failed ? 1 : 0);
}
main();
