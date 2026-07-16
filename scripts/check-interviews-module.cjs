const fs = require("fs");
const path = require("path");

const root = process.cwd();
let failed = 0;
let warnings = 0;

function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { failed++; console.log(`❌ ${msg}`); }
function warn(msg) { warnings++; console.log(`⚠️ ${msg}`); }
function exists(rel) {
  const full = path.join(root, rel);
  if (fs.existsSync(full)) ok(`exists ${rel}`); else fail(`missing ${rel}`);
}
function contains(rel, needle, label = needle) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) return fail(`missing ${rel}`);
  const content = fs.readFileSync(full, "utf8");
  if (content.includes(needle)) ok(`${rel}: ${label}`); else fail(`${rel}: missing ${label}`);
}

console.log("\n==============================");
console.log("INTERVIEWS MODULE CHECK");
console.log("==============================\n");

console.log("1) Files");
[
  "src/app/interviews/page.tsx",
  "src/components/interviews/InterviewsClient.tsx",
  "src/lib/interviews/getInterviewsPageData.ts",
  "src/app/api/interviews/route.ts",
  "src/app/api/interviews/[id]/route.ts",
  "src/app/api/interviews/[id]/convert/route.ts",
  "scripts/smoke-interviews-crud.cjs",
  "docs/INTERVIEWS_FIX_QA.md",
].forEach(exists);

console.log("\n2) UI controls");
[
  ["src/components/interviews/InterviewsClient.tsx", "إضافة مقابلة"],
  ["src/components/interviews/InterviewsClient.tsx", "تصدير إكسل"],
  ["src/components/interviews/InterviewsClient.tsx", "طباعة / PDF"],
  ["src/components/interviews/InterviewsClient.tsx", "name=\"q\"", "search filter"],
  ["src/components/interviews/InterviewsClient.tsx", "name=\"status\"", "status filter"],
  ["src/components/interviews/InterviewsClient.tsx", "name=\"cityId\"", "city filter"],
  ["src/components/interviews/InterviewsClient.tsx", "name=\"projectId\"", "project filter"],
  ["src/components/interviews/InterviewsClient.tsx", "تحويل لمندوب"],
  ["src/components/interviews/InterviewsClient.tsx", "حذف"],
].forEach(([rel, needle, label]) => contains(rel, needle, label));

console.log("\n3) API controls");
contains("src/app/api/interviews/route.ts", "export async function POST", "POST create");
contains("src/app/api/interviews/[id]/route.ts", "export async function PATCH", "PATCH update");
contains("src/app/api/interviews/[id]/route.ts", "export async function DELETE", "DELETE remove");
contains("src/app/api/interviews/[id]/convert/route.ts", "tx.driver.create", "convert to driver");

console.log("\n4) Navigation / permissions");
const modules = fs.existsSync(path.join(root, "src/lib/modules.ts")) ? fs.readFileSync(path.join(root, "src/lib/modules.ts"), "utf8") : "";
const permissions = fs.existsSync(path.join(root, "src/lib/permissions.ts")) ? fs.readFileSync(path.join(root, "src/lib/permissions.ts"), "utf8") : "";
if (modules.includes('href: "/interviews"')) ok("/interviews in modules/sidebar"); else warn("/interviews missing in modules/sidebar");
if (permissions.includes('route: "/interviews"') || permissions.includes('["/interviews", "interviews"]')) ok("/interviews in permissions"); else warn("/interviews missing in permissions route map");

console.log("\n==============================");
console.log(`Interviews module check result: ${failed ? "FAILED" : "OK"} | failed=${failed} | warnings=${warnings}`);
console.log("==============================\n");
process.exit(failed ? 1 : 0);
