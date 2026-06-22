/*
  Fix finance final closeout checks and sidebar mapping.
  Run from apps/erp:
    node scripts/fix-finance-closeout.cjs
*/
const fs = require('fs');
const path = require('path');

const root = process.cwd();
function p(rel) { return path.join(root, rel); }
function exists(rel) { return fs.existsSync(p(rel)); }
function read(rel) { return fs.readFileSync(p(rel), 'utf8'); }
function write(rel, text) { fs.writeFileSync(p(rel), text, 'utf8'); }
function backup(rel) {
  if (!exists(rel)) return;
  const backupPath = p(`${rel}.finance-closeout-fix.bak`);
  if (!fs.existsSync(backupPath)) fs.copyFileSync(p(rel), backupPath);
}

let changed = 0;
let notes = [];

// 1) Fix sidebar/navigation mapping in src/lib/modules.ts
const modulesRel = 'src/lib/modules.ts';
if (exists(modulesRel)) {
  backup(modulesRel);
  let text = read(modulesRel);
  const original = text;

  // invoices should be connected in the finance sidebar.
  text = text.replace(
    /(href:\s*"\/invoices"[\s\S]*?status:\s*)migration(\s*,\s*resource:\s*"invoices")/,
    '$1connected$2'
  );

  // Add /vehicle-cost under finance sidebar if missing.
  if (!text.includes('href: "/vehicle-cost"')) {
    const vehicleFinanceLine = /(^\s*\{\s*href:\s*"\/vehicle-finance",[^\n]*\},\s*$)/m;
    const insert = '$1\n      { href: "/vehicle-cost", label: "تكلفة السيارات", oldKey: "vehicleCost", status: connected, resource: "vehicle-costs", description: "تكلفة السيارات الشهرية ومراجعة التكلفة المحسوبة." },';
    if (vehicleFinanceLine.test(text)) {
      text = text.replace(vehicleFinanceLine, insert);
    } else {
      notes.push('لم أجد سطر /vehicle-finance لإضافة /vehicle-cost بعده تلقائيًا.');
    }
  }

  if (text !== original) {
    write(modulesRel, text);
    changed++;
    notes.push('تم تحديث src/lib/modules.ts');
  } else {
    notes.push('src/lib/modules.ts لا يحتاج تعديل.');
  }
} else {
  notes.push('لم أجد src/lib/modules.ts');
}

// 2) Fix final closeout checker: financePages.ts contains only generic finance modules,
// not dashboard/payroll landing pages. Those pages are checked through requiredFiles and smoke tests.
const closeoutRel = 'scripts/check-finance-closeout.cjs';
if (exists(closeoutRel)) {
  backup(closeoutRel);
  let text = read(closeoutRel);
  const original = text;

  const newExpectedRoutes = `const expectedRoutes = [
  '/invoices',
  '/receivables',
  '/payments',
  '/expenses',
  '/revenues',
  '/advances',
  '/deductions',
  '/vehicle-finance',
  '/vehicle-cost',
  '/supplier-accounts',
  '/custody-cashbox',
  '/bank-accounts',
  '/vat',
  '/profit-loss',
  '/financial-reports',
];`;

  text = text.replace(/const expectedRoutes = \[[\s\S]*?\];/, newExpectedRoutes);

  // Make message more accurate.
  text = text.replace('route not found in financePages.ts', 'module route not found in financePages.ts');

  if (text !== original) {
    write(closeoutRel, text);
    changed++;
    notes.push('تم تحديث scripts/check-finance-closeout.cjs');
  } else {
    notes.push('scripts/check-finance-closeout.cjs لا يحتاج تعديل.');
  }
} else {
  notes.push('لم أجد scripts/check-finance-closeout.cjs');
}

console.log('Finance closeout fix completed.');
console.log(`Changed files: ${changed}`);
for (const note of notes) console.log('-', note);
console.log('');
console.log('Next:');
console.log('  node scripts/check-finance-system.cjs');
console.log('  node scripts/check-finance-closeout.cjs');
