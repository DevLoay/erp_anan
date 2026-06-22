/*
  Vehicle system final audit script.
  Run from apps/erp:
    node scripts/check-vehicle-system.cjs
*/
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const required = [
  "src/components/vehicles/VehicleModernClient.tsx",
  "src/components/vehicles/VehicleModulePage.tsx",
  "src/lib/vehicles/vehicleModuleData.ts",
  "src/app/vehicles/page.tsx",
  "src/app/vehicles/new/page.tsx",
  "src/app/vehicles/[id]/page.tsx",
  "src/app/vehicle-movements/page.tsx",
  "src/app/vehicle-maintenance/page.tsx",
  "src/app/authorizations/page.tsx",
  "src/app/vehicle-accidents/page.tsx",
  "src/app/vehicle-damages/page.tsx",
  "src/app/vehicle-cleaning/page.tsx",
  "src/app/vehicle-finance/page.tsx",
  "src/app/vehicle-cost/page.tsx",
  "src/app/vehicle-deductions/page.tsx",
  "src/app/vehicle-violations/page.tsx",
  "prisma/schema.prisma",
];

const activeFilesToScan = [
  "src/components/vehicles/VehicleModernClient.tsx",
  "src/components/vehicles/VehicleModulePage.tsx",
  "src/app/vehicles/page.tsx",
  "src/app/vehicles/new/page.tsx",
  "src/app/vehicles/[id]/page.tsx",
  "src/app/vehicle-movements/page.tsx",
  "src/app/vehicle-maintenance/page.tsx",
  "src/app/authorizations/page.tsx",
  "src/app/vehicle-accidents/page.tsx",
  "src/app/vehicle-damages/page.tsx",
  "src/app/vehicle-cleaning/page.tsx",
  "src/app/vehicle-finance/page.tsx",
  "src/app/vehicle-cost/page.tsx",
  "src/app/vehicle-deductions/page.tsx",
  "src/app/vehicle-violations/page.tsx",
];

function exists(relative) {
  return fs.existsSync(path.join(root, relative));
}

function read(relative) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

let failed = false;
const warnings = [];

console.log("\n🚗 Vehicle System Final Audit\n");

console.log("1) Required files");
for (const file of required) {
  const ok = exists(file);
  console.log(`${ok ? "✅" : "❌"} ${file}`);
  if (!ok) failed = true;
}

console.log("\n2) Modern UI checks");
const modernPath = "src/components/vehicles/VehicleModernClient.tsx";
if (exists(modernPath)) {
  const modern = read(modernPath);
  const checks = [
    ["reads rows data", /\.rows\b/.test(modern)],
    ["does not depend on data.vehicles", !/data\.vehicles/.test(modern)],
    ["supports query params", /useSearchParams/.test(modern)],
    ["supports quick create", /openCreate/.test(modern)],
    ["supports CSV export", /CSV|downloadCsv|تصدير/.test(modern)],
    ["supports pagination", /pageSize|currentPage|totalPages/.test(modern)],
    ["suppresses extension hydration on buttons", /suppressHydrationWarning/.test(modern)],
  ];
  for (const [label, ok] of checks) {
    console.log(`${ok ? "✅" : "⚠️"} ${label}`);
    if (!ok) warnings.push(label);
  }
}

console.log("\n3) Legacy import scan");
for (const file of activeFilesToScan) {
  if (!exists(file)) continue;
  const content = read(file);
  const hasLegacyImport = /VehicleLegacyClient/.test(content) && !/VehicleLegacyClient\.tsx/.test(file);
  console.log(`${hasLegacyImport ? "❌" : "✅"} ${file}`);
  if (hasLegacyImport) failed = true;
}

console.log("\n4) Routes to manually open");
[
  "/vehicles",
  "/vehicles/new",
  "/vehicle-movements",
  "/vehicle-maintenance",
  "/authorizations",
  "/vehicle-accidents",
  "/vehicle-damages",
  "/vehicle-cleaning",
  "/vehicle-finance",
  "/vehicle-cost",
  "/vehicle-deductions",
  "/vehicle-violations",
].forEach((route) => console.log(`• http://localhost:3040${route}`));

console.log("\nResult");
if (failed) {
  console.log("❌ Audit failed. Fix the missing/legacy items above before closing the vehicle module.");
  process.exitCode = 1;
} else if (warnings.length) {
  console.log("⚠️ Audit passed with warnings. Review these checks:");
  warnings.forEach((item) => console.log(`- ${item}`));
} else {
  console.log("✅ Vehicle module structure looks ready for final manual QA.");
}
