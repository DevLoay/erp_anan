const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const BASE_URL = process.env.ERP_TEST_BASE_URL || "http://localhost:3040";
const EMAIL = process.env.ERP_TEST_EMAIL;
const PASSWORD = process.env.ERP_TEST_PASSWORD;
const stamp = Date.now();
let failed = 0;
let cookie = "";
let createdCityId = "";
let createdProjectId = "";
let createdInterviewId = "";
let convertedDriverId = "";

function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { failed++; console.log(`❌ ${msg}`); }
function warn(msg) { console.log(`⚠️ ${msg}`); }

async function login() {
  if (!EMAIL) throw new Error("ERP_TEST_EMAIL is required");
  if (!PASSWORD) throw new Error("ERP_TEST_PASSWORD is required");
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const setCookie = res.headers.get("set-cookie") || "";
  cookie = setCookie.split(",").map((part) => part.split(";")[0]).join("; ");
  if (!res.ok || !cookie) throw new Error(`Login failed: ${res.status}`);
  ok("Login OK");
}

async function api(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Cookie: cookie,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${options.method || "GET"} ${path} => ${res.status} ${payload.error || ""}`);
  return payload;
}

async function page(path, contains) {
  const res = await fetch(`${BASE_URL}${path}`, { headers: { Cookie: cookie } });
  if (res.status !== 200) return fail(`${path}: ${res.status}`);
  const html = await res.text();
  ok(`${path}: 200`);
  if (contains && !html.includes(contains)) fail(`${path}: missing ${contains}`); else if (contains) ok(`${path}: contains ${contains}`);
}

async function cleanup() {
  console.log("\n4) Cleanup test records");
  if (createdInterviewId) {
    await prisma.interview.deleteMany({ where: { id: createdInterviewId } }).then((r) => ok(`cleanup interview — ${r.count}`)).catch((e) => warn(`cleanup interview failed: ${e.message}`));
  }
  if (convertedDriverId) {
    await prisma.driver.deleteMany({ where: { id: convertedDriverId } }).then((r) => ok(`cleanup converted driver — ${r.count}`)).catch((e) => warn(`cleanup driver failed: ${e.message}`));
  }
  if (createdProjectId) {
    await prisma.project.deleteMany({ where: { id: createdProjectId } }).then((r) => ok(`cleanup project — ${r.count}`)).catch((e) => warn(`cleanup project failed: ${e.message}`));
  }
  if (createdCityId) {
    await prisma.city.deleteMany({ where: { id: createdCityId } }).then((r) => ok(`cleanup city — ${r.count}`)).catch((e) => warn(`cleanup city failed: ${e.message}`));
  }
}

async function main() {
  console.log(`Interviews CRUD smoke test: ${BASE_URL}`);
  try {
    await login();

    console.log("\n1) Create references");
    const city = await prisma.city.create({ data: { nameAr: `مدينة مقابلات QA ${stamp}`, nameEn: `interviews qa ${stamp}`, status: "ACTIVE" } });
    createdCityId = city.id;
    ok(`created city — ${city.nameAr}`);
    const project = await prisma.project.create({ data: { name: `مشروع مقابلات QA ${stamp}`, appName: "Keeta", cityId: city.id, status: "ACTIVE" } });
    createdProjectId = project.id;
    ok(`created project — ${project.name}`);

    console.log("\n2) Interview API create/update/convert/delete");
    const created = await api("/api/interviews", {
      method: "POST",
      body: JSON.stringify({
        candidateName: `مرشح مقابلة QA ${stamp}`,
        phone: `05${String(stamp).slice(-8)}`,
        cityId: city.id,
        projectId: project.id,
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
        notes: "created by smoke-interviews-crud",
      }),
    });
    createdInterviewId = created.data.id;
    ok(`POST /api/interviews — created ${createdInterviewId}`);

    const updated = await api(`/api/interviews/${createdInterviewId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "APPROVED", notes: "updated by smoke" }),
    });
    if (updated.data.status !== "APPROVED") fail("PATCH /api/interviews/:id did not approve interview"); else ok("PATCH /api/interviews/:id — APPROVED");

    const converted = await api(`/api/interviews/${createdInterviewId}/convert`, { method: "POST", body: JSON.stringify({}) });
    convertedDriverId = converted.driver?.id || converted.data?.convertedDriverId || "";
    if (!convertedDriverId) fail("POST convert did not return driver id"); else ok(`POST convert — driver ${convertedDriverId}`);

    console.log("\n3) Runtime page checks");
    await page("/interviews", "المقابلات");
    await page(`/interviews?q=${encodeURIComponent(String(stamp))}`, "المقابلات");

    await api(`/api/interviews/${createdInterviewId}`, { method: "DELETE", body: JSON.stringify({}) });
    ok("DELETE /api/interviews/:id");
    createdInterviewId = "";
  } catch (error) {
    fail(error.message || String(error));
  } finally {
    await cleanup();
    await prisma.$disconnect();
    console.log("\n==============================");
    console.log(`Interviews CRUD result: ${failed ? "FAILED" : "OK"} | failed=${failed}`);
    console.log("==============================");
    process.exit(failed ? 1 : 0);
  }
}

main();
