#!/usr/bin/env node
/*
  Authenticated smoke test for finance routes.
  Usage (PowerShell):
    $env:ERP_TEST_EMAIL="admin@logistics-erp.com"
    $env:ERP_TEST_PASSWORD="YOUR_PASSWORD"
    node scripts/smoke-finance-auth-routes.cjs
*/

const BASE_URL = process.env.ERP_BASE_URL || "http://localhost:3040";
const EMAIL = process.env.ERP_TEST_EMAIL || process.env.TEST_EMAIL || "";
const PASSWORD = process.env.ERP_TEST_PASSWORD || process.env.TEST_PASSWORD || "";

const routes = [
  "/",
  "/finance",
  "/payroll",
  "/payroll/settings",
  "/invoices",
  "/receivables",
  "/payments",
  "/expenses",
  "/revenues",
  "/advances",
  "/deductions",
  "/vehicle-finance",
  "/vehicle-cost",
  "/supplier-accounts",
  "/custody-cashbox",
  "/bank-accounts",
  "/vat",
  "/profit-loss",
  "/financial-reports",
];

function extractCookies(headers) {
  const cookies = [];
  if (typeof headers.getSetCookie === "function") {
    for (const value of headers.getSetCookie()) {
      const firstPart = value.split(";")[0];
      if (firstPart) cookies.push(firstPart);
    }
  }
  const combined = headers.get("set-cookie");
  if (combined) {
    // Login route uses Max-Age cookies, so this split is safe enough for this local smoke test.
    for (const value of combined.split(/,\s*(?=[^;,]+=)/g)) {
      const firstPart = value.split(";")[0];
      if (firstPart && !cookies.includes(firstPart)) cookies.push(firstPart);
    }
  }
  return cookies.join("; ");
}

async function login() {
  if (!EMAIL || !PASSWORD) {
    console.error("❌ Missing test credentials.");
    console.error("Set them first:");
    console.error('  $env:ERP_TEST_EMAIL="admin@logistics-erp.com"');
    console.error('  $env:ERP_TEST_PASSWORD="YOUR_PASSWORD"');
    process.exit(2);
  }

  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    redirect: "manual",
  });

  const text = await response.text();
  if (!response.ok) {
    console.error(`❌ Login failed: ${response.status}`);
    console.error(text.slice(0, 500));
    process.exit(1);
  }

  const cookie = extractCookies(response.headers);
  if (!cookie.includes("erp_session=")) {
    console.error("❌ Login succeeded but session cookie was not found.");
    console.error("Set-Cookie header:", response.headers.get("set-cookie"));
    process.exit(1);
  }
  return cookie;
}

async function checkRoute(route, cookie) {
  const response = await fetch(`${BASE_URL}${route}`, {
    method: "GET",
    headers: { Cookie: cookie },
    redirect: "manual",
  });

  const location = response.headers.get("location") || "";
  const ok = response.status >= 200 && response.status < 300;
  const redirectedToLogin = response.status >= 300 && response.status < 400 && location.includes("/login");

  if (ok) return { route, status: response.status, ok: true };
  if (redirectedToLogin) return { route, status: response.status, ok: false, error: `redirected to login (${location})` };

  const body = await response.text().catch(() => "");
  return { route, status: response.status, ok: false, error: body.slice(0, 350).replace(/\s+/g, " ") };
}

async function main() {
  console.log(`Finance authenticated smoke test: ${BASE_URL}`);
  const cookie = await login();
  console.log("✅ Login OK");

  let failed = 0;
  for (const route of routes) {
    const result = await checkRoute(route, cookie);
    if (result.ok) {
      console.log(`✅ ${result.status} ${route}`);
    } else {
      failed += 1;
      console.log(`❌ ${result.status} ${route} :: ${result.error}`);
    }
  }

  console.log(`\nAuthenticated smoke result: ${failed === 0 ? "OK" : "FAILED"} | failed=${failed}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("❌ Smoke script crashed:", error);
  process.exit(1);
});
