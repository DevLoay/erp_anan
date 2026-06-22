#!/usr/bin/env node
/*
  Finance CRUD smoke test for MOHAMED SHAWKI ERP.
  - Logs in using ERP_TEST_EMAIL / ERP_TEST_PASSWORD
  - Creates a small TEST record in finance resources
  - Patches it
  - Deletes it
  The script is intentionally conservative and skips modules that need missing references.
*/

const BASE_URL = process.env.ERP_BASE_URL || "http://localhost:3040";
const EMAIL = process.env.ERP_TEST_EMAIL || "admin@logistics-erp.com";
const PASSWORD = process.env.ERP_TEST_PASSWORD;

if (!PASSWORD) {
  console.error('❌ Missing ERP_TEST_PASSWORD. Example: $env:ERP_TEST_PASSWORD="Admin@123456"');
  process.exit(1);
}

function nowKey() {
  return new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
}

function month() {
  return new Date().toISOString().slice(0, 7);
}

function date() {
  return new Date().toISOString().slice(0, 10);
}

function getSetCookie(headers) {
  if (typeof headers.getSetCookie === "function") return headers.getSetCookie();
  const single = headers.get("set-cookie");
  return single ? [single] : [];
}

function cookieHeaderFrom(response) {
  return getSetCookie(response.headers).map((value) => value.split(";")[0]).join("; ");
}

async function request(path, options = {}, cookie = "") {
  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(cookie ? { Cookie: cookie } : {}),
    ...(options.headers || {}),
  };
  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers, redirect: "manual" });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { response, body, text };
}

async function login() {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    redirect: "manual",
  });
  const cookie = cookieHeaderFrom(res);
  const text = await res.text();
  if (!res.ok || !cookie) {
    console.error("❌ Login failed", res.status, text.slice(0, 400));
    process.exit(1);
  }
  console.log("✅ Login OK");
  return cookie;
}

async function getFirstId(cookie, resource) {
  const { response, body } = await request(`/api/${resource}?take=1`, {}, cookie);
  if (!response.ok) return "";
  return body?.data?.[0]?.id || "";
}

async function crud(cookie, item) {
  const payload = typeof item.payload === "function" ? await item.payload(cookie) : item.payload;
  if (!payload) {
    console.log(`⏭️  SKIP ${item.resource}: missing required reference`);
    return { resource: item.resource, ok: true, skipped: true };
  }

  const create = await request(`/api/${item.resource}`, {
    method: "POST",
    body: JSON.stringify(payload),
  }, cookie);

  if (![200, 201].includes(create.response.status)) {
    console.log(`❌ POST /api/${item.resource} -> ${create.response.status}`, JSON.stringify(create.body).slice(0, 300));
    return { resource: item.resource, ok: false, step: "POST", status: create.response.status };
  }

  const id = create.body?.data?.id;
  if (!id) {
    console.log(`❌ POST /api/${item.resource}: created response has no id`);
    return { resource: item.resource, ok: false, step: "POST_ID" };
  }
  console.log(`✅ POST /api/${item.resource} -> ${id}`);

  const patch = await request(`/api/${item.resource}/${id}`, {
    method: "PATCH",
    body: JSON.stringify(item.patch || { notes: "CRUD smoke updated" }),
  }, cookie);

  if (!patch.response.ok) {
    console.log(`❌ PATCH /api/${item.resource}/${id} -> ${patch.response.status}`, JSON.stringify(patch.body).slice(0, 300));
    return { resource: item.resource, ok: false, step: "PATCH", status: patch.response.status, id };
  }
  console.log(`✅ PATCH /api/${item.resource}/${id}`);

  const del = await request(`/api/${item.resource}/${id}`, { method: "DELETE" }, cookie);
  if (!del.response.ok) {
    console.log(`❌ DELETE /api/${item.resource}/${id} -> ${del.response.status}`, JSON.stringify(del.body).slice(0, 300));
    return { resource: item.resource, ok: false, step: "DELETE", status: del.response.status, id };
  }
  console.log(`✅ DELETE /api/${item.resource}/${id}`);
  return { resource: item.resource, ok: true };
}

async function main() {
  const key = nowKey();
  console.log(`Finance CRUD smoke test: ${BASE_URL}`);
  const cookie = await login();

  const resources = [
    {
      resource: "invoices",
      payload: { number: `TEST-INV-${key}`, client: "CRUD Smoke Test", month: month(), amount: 100, vatAmount: 15, invoiceStatus: "Draft", status: "PENDING", issuedAt: date(), dueDate: date() },
      patch: { client: "CRUD Smoke Test Updated", amount: 110 },
    },
    { resource: "receivables", payload: { client: "CRUD Smoke Test", amount: 100, paidAmount: 10, dueDate: date(), status: "PENDING", notes: "test" }, patch: { paidAmount: 20, notes: "updated" } },
    { resource: "payments", payload: { payee: "CRUD Smoke Test", amount: 100, method: "cash", referenceNo: `REF-${key}`, status: "PENDING", paidAt: date(), notes: "test" }, patch: { amount: 120, notes: "updated" } },
    { resource: "expenses", payload: { type: "CRUD Smoke Test", amount: 100, month: month(), status: "PENDING", notes: "test" }, patch: { amount: 130, notes: "updated" } },
    { resource: "revenues", payload: { source: "CRUD Smoke Test", amount: 100, month: month(), status: "PENDING", notes: "test" }, patch: { amount: 140, notes: "updated" } },
    { resource: "supplier-accounts", payload: { supplier: "CRUD Smoke Test", balance: 100, dueDate: date(), status: "ACTIVE", notes: "test" }, patch: { balance: 150, notes: "updated" } },
    { resource: "cashbox-entries", payload: { type: "CRUD Smoke Test", amount: 100, balance: 100, responsible: "Admin", status: "ACTIVE", notes: "test" }, patch: { balance: 160, notes: "updated" } },
    { resource: "bank-accounts", payload: { bankName: "CRUD Smoke Bank", iban: `SA${key}`.slice(0, 24), balance: 100, status: "ACTIVE", notes: "test" }, patch: { balance: 170, notes: "updated" } },
    { resource: "vat-records", payload: { month: `${month()}-test-${key}`.slice(0, 32), salesVat: 15, purchaseVat: 5, netVat: 10, status: "PENDING" }, patch: { netVat: 12 } },
    { resource: "profit-loss", payload: { month: `${month()}-test-${key}`.slice(0, 32), revenues: 300, expenses: 100, payroll: 50, vehicleCosts: 25, netProfit: 125, status: "PENDING" }, patch: { netProfit: 130 } },
    {
      resource: "deductions",
      payload: async (cookie) => {
        const driverId = await getFirstId(cookie, "drivers");
        return driverId ? { driverId, type: "CRUD Smoke Test", amount: 10, month: month(), status: "PENDING", notes: "test" } : null;
      },
      patch: { amount: 11, notes: "updated" },
    },
    {
      resource: "vehicle-costs",
      payload: async (cookie) => {
        const vehicleId = await getFirstId(cookie, "vehicles");
        return vehicleId ? { vehicleId, month: `${month()}-test-${key}`.slice(0, 32), rentCost: 1, maintenanceCost: 1, cleaningCost: 1, accidentCost: 1, damageCost: 1, otherCost: 1, totalCost: 6, status: "PENDING" } : null;
      },
      patch: { totalCost: 7 },
    },
  ];

  const results = [];
  for (const item of resources) {
    results.push(await crud(cookie, item));
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\nCRUD result: ${failed.length ? "FAILED" : "OK"} | failed=${failed.length} | skipped=${results.filter((r) => r.skipped).length}`);
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error("❌ Unexpected error", error);
  process.exit(1);
});
