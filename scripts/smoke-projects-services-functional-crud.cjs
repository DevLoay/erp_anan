#!/usr/bin/env node
/* eslint-disable no-console */

const { PrismaClient } = require('@prisma/client');

const BASE_URL = process.env.ERP_BASE_URL || 'http://localhost:3040';
const EMAIL = process.env.ERP_TEST_EMAIL;
const PASSWORD = process.env.ERP_TEST_PASSWORD;

const prisma = new PrismaClient();
const now = Date.now();
const mark = `qa-projects-services-${now}`;

const created = {
  cityId: null,
  applicationId: null,
  projectId: null,
  applicationProjectId: null,
  accountId: null,
};

let failed = 0;

function ok(message) {
  console.log(`✅ ${message}`);
}

function warn(message) {
  console.log(`⚠️ ${message}`);
}

function fail(message, error) {
  failed += 1;
  console.log(`❌ ${message}`);
  if (error) console.log(String(error?.stack || error?.message || error));
}

function cookieHeader(headers) {
  const raw = headers.get('set-cookie') || '';
  return raw
    .split(/,(?=\s*[^;,]+=)/)
    .map((part) => part.split(';')[0].trim())
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

  if (![200, 204, 302, 303, 307].includes(res.status)) {
    throw new Error(`Login failed with HTTP ${res.status}`);
  }

  const cookie = cookieHeader(res.headers);
  if (!cookie) warn('login returned no cookie; route checks may still work if auth is headerless');
  ok('Login OK');
  return cookie;
}

async function fetchPage(path, cookie, expectedText) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: cookie ? { cookie } : {},
    redirect: 'manual',
  });
  if (res.status !== 200) {
    fail(`${path}: expected 200 got ${res.status}`);
    return;
  }
  ok(`${path}: 200`);
  if (expectedText) {
    const html = await res.text();
    if (html.includes(expectedText)) ok(`${path}: contains ${expectedText}`);
    else warn(`${path}: visible text not found: ${expectedText}`);
  }
}

async function createReferences() {
  console.log('\n1) Create city/project/application references');

  const city = await prisma.city.create({
    data: {
      nameAr: `مدينة اختبار ${mark}`,
      nameEn: `QA City ${now}`,
      status: 'ACTIVE',
    },
  });
  created.cityId = city.id;
  ok(`created city — ${city.nameAr}`);

  const application = await prisma.application.create({
    data: {
      code: `QAAPP${now}`,
      name: `تطبيق اختبار ${now}`,
      description: 'Created by projects/services closeout smoke test',
      status: 'ACTIVE',
    },
  });
  created.applicationId = application.id;
  ok(`created application — ${application.code}`);

  const project = await prisma.project.create({
    data: {
      name: `مشروع اختبار ${mark}`,
      appName: application.name,
      cityId: city.id,
      status: 'ACTIVE',
    },
  });
  created.projectId = project.id;
  ok(`created legacy project — ${project.name}`);

  const applicationProject = await prisma.applicationProject.create({
    data: {
      applicationId: application.id,
      projectId: project.id,
      cityId: city.id,
      code: `QAPRJ${now}`,
      name: `مشروع خدمة اختبار ${now}`,
      monthlyTarget: 1000,
      dailyTarget: 50,
      status: 'ACTIVE',
    },
  });
  created.applicationProjectId = applicationProject.id;
  ok(`created application project — ${applicationProject.code}`);

  const account = await prisma.applicationAccount.create({
    data: {
      appName: application.name,
      username: `qa-account-${now}@example.test`,
      appUserId: `qa-user-${now}`,
      appUsername: `QA User ${now}`,
      applicationId: application.id,
      applicationProjectId: applicationProject.id,
      projectId: project.id,
      cityId: city.id,
      isEmpty: false,
      needsReview: true,
      unmatchedReason: 'QA account linking review smoke test',
      source: 'qa-smoke',
      status: 'ACTIVE',
    },
  });
  created.accountId = account.id;
  ok(`created account needing review — ${account.username}`);

  return { city, application, project, applicationProject, account };
}

async function updateReferences() {
  console.log('\n2) Update records / account-linking review behavior');

  const city = await prisma.city.update({
    where: { id: created.cityId },
    data: { nameEn: `QA City Updated ${now}` },
  });
  ok(`updated city — ${city.nameEn}`);

  const applicationProject = await prisma.applicationProject.update({
    where: { id: created.applicationProjectId },
    data: { monthlyTarget: 1200, dailyTarget: 60 },
  });
  ok(`updated project targets — monthly=${applicationProject.monthlyTarget} daily=${applicationProject.dailyTarget}`);

  const account = await prisma.applicationAccount.update({
    where: { id: created.accountId },
    data: {
      needsReview: false,
      unmatchedReason: null,
      linkedAt: new Date(),
    },
  });
  ok(`updated account review state — needsReview=${account.needsReview}`);
}

async function cleanup() {
  console.log('\n4) Cleanup test records');

  const steps = [
    ['application account', async () => created.accountId && prisma.applicationAccount.deleteMany({ where: { id: created.accountId } })],
    ['application project', async () => created.applicationProjectId && prisma.applicationProject.deleteMany({ where: { id: created.applicationProjectId } })],
    ['legacy project', async () => created.projectId && prisma.project.deleteMany({ where: { id: created.projectId } })],
    ['application', async () => created.applicationId && prisma.application.deleteMany({ where: { id: created.applicationId } })],
    ['city', async () => created.cityId && prisma.city.deleteMany({ where: { id: created.cityId } })],
  ];

  for (const [label, fn] of steps) {
    try {
      const result = await fn();
      const count = typeof result?.count === 'number' ? result.count : 0;
      ok(`cleanup ${label} — ${count}`);
    } catch (error) {
      fail(`cleanup ${label} failed`, error);
    }
  }
}

async function main() {
  console.log(`Projects/services functional CRUD smoke test: ${BASE_URL}`);
  let cookie = '';

  try {
    cookie = await login();
    const { applicationProject } = await createReferences();
    await updateReferences();

    console.log('\n3) Runtime page checks with created project');
    await fetchPage('/projects', cookie, 'المشاريع');
    await fetchPage('/cities', cookie, 'المدن');
    await fetchPage('/settings/application-account-review', cookie, 'ربط');
    await fetchPage(`/projects/${applicationProject.id}/dashboard`, cookie, null);
    await fetchPage(`/projects/${applicationProject.id}/accounts`, cookie, null);
    await fetchPage(`/projects/${applicationProject.id}/drivers`, cookie, null);
    await fetchPage(`/projects/${applicationProject.id}/imports`, cookie, null);
    await fetchPage(`/projects/${applicationProject.id}/invoices`, cookie, null);
    await fetchPage(`/projects/${applicationProject.id}/payroll`, cookie, null);
    await fetchPage(`/projects/${applicationProject.id}/reports`, cookie, null);
    await fetchPage(`/projects/${applicationProject.id}/settings`, cookie, null);
  } catch (error) {
    fail('Projects/services functional CRUD smoke crashed', error);
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }

  console.log(`\nProjects/services functional CRUD result: ${failed ? 'FAILED' : 'OK'} | failed=${failed}`);
  process.exitCode = failed ? 1 : 0;
}

main();
