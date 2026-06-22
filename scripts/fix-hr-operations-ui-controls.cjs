#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
function rel(p) { return path.join(root, p); }
function read(p) { try { return fs.readFileSync(rel(p), 'utf8'); } catch { return ''; } }
function write(p, text) { fs.mkdirSync(path.dirname(rel(p)), { recursive: true }); fs.writeFileSync(rel(p), text, 'utf8'); console.log(`✅ updated ${p}`); }
function ensureFile(p, text) { if (fs.existsSync(rel(p))) { console.log(`✅ exists ${p}`); return; } write(p, text); }

console.log('\nHR OPERATIONS UI CONTROLS FIX');
console.log(`Project root: ${root}`);

const driverFile = 'src/components/drivers/DriverManagementClient.tsx';
let driver = read(driverFile);
if (driver) {
  if (!driver.includes('function downloadCsv(')) {
    const marker = '\nfunction field(form: FormData, key: string)';
    const alias = `\nfunction downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number>>) {\n  exportCsv(filename, headers, rows);\n}\n`;
    if (driver.includes(marker)) {
      driver = driver.replace(marker, `${alias}${marker}`);
    } else {
      driver += alias;
    }
  }
  driver = driver.replace(/exportCsv\(\s*`drivers-/g, 'downloadCsv(`drivers-');
  driver = driver.replace(/exportCsv\("drivers-template\.csv"/g, 'downloadCsv("drivers-template.csv"');
  write(driverFile, driver);
} else {
  console.log(`⚠️ missing ${driverFile}`);
}

const supervisorsFile = 'src/components/supervisors/SupervisorsOperationsClient.tsx';
let supervisors = read(supervisorsFile);
if (supervisors) {
  supervisors = supervisors.replace('تصدير Excel', 'تصدير Excel / CSV');
  supervisors = supervisors.replace(/>\s*خصائص\s*<\/button>/, '>\n                        تفاصيل / خصائص\n                      </button>');
  write(supervisorsFile, supervisors);
} else {
  console.log(`⚠️ missing ${supervisorsFile}`);
}

ensureFile('src/app/housing/page.tsx', `import { redirect } from "next/navigation";\n\nexport default function HousingAliasPage() {\n  redirect("/rider-housing");\n}\n`);
ensureFile('src/app/documents/page.tsx', `import { redirect } from "next/navigation";\n\nexport default function DocumentsAliasPage() {\n  redirect("/rider-documents");\n}\n`);
ensureFile('src/app/warnings/page.tsx', `import { redirect } from "next/navigation";\n\nexport default function WarningsAliasPage() {\n  redirect("/operations-alerts");\n}\n`);

console.log('\n✅ Done. Re-run:');
console.log('node scripts/check-hr-operations-system.cjs');
console.log('node scripts/smoke-hr-auth-routes.cjs');
