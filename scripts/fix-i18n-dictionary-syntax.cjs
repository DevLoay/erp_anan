const fs = require('fs');
const path = require('path');

const root = process.cwd();
const file = path.join(root, 'src', 'lib', 'i18n', 'dictionary.ts');

function fail(msg) {
  console.error('❌ ' + msg);
  process.exit(1);
}

if (!fs.existsSync(file)) fail('Missing src/lib/i18n/dictionary.ts');

let text = fs.readFileSync(file, 'utf8');
const backup = file + '.bak-before-syntax-fix';
if (!fs.existsSync(backup)) fs.writeFileSync(backup, text, 'utf8');

const fixedVehicleAccountEntry = '  "لو اخترت سيارة، النظام سيرفض السيارة المرتبطة بمندوب نشط. ولو اخترت حساب تطبيق مرتبط بمندوب آخر سيتم إيقافه تلقائيًا.": { en: "If you choose a vehicle, the system will reject vehicles already assigned to an active driver. If you choose an app account linked to another driver, it will be disabled automatically." },';

let lines = text.split(/\r?\n/);
let out = [];
let changed = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  // A previous i18n patch may leave this long Arabic text as an unfinished object key,
  // which makes the next property ("الاسم") fail with: Expected ',', got string literal.
  if (line.includes('لو اخترت سيارة، النظام سيرفض')) {
    changed = true;
    out.push(fixedVehicleAccountEntry);

    // Skip any broken continuation lines until we reach the next valid dictionary key.
    while (i + 1 < lines.length && !/^\s*"الاسم"\s*:/.test(lines[i + 1])) {
      i++;
    }
    continue;
  }

  out.push(line);
}

text = out.join('\n');

// Safety cleanups: if the same fixed entry was duplicated, keep the first one only.
const entryLine = fixedVehicleAccountEntry.trim();
lines = text.split(/\r?\n/);
out = [];
let seenFixed = false;
for (const line of lines) {
  if (line.trim() === entryLine) {
    if (seenFixed) {
      changed = true;
      continue;
    }
    seenFixed = true;
  }
  out.push(line);
}
text = out.join('\n');

fs.writeFileSync(file, text, 'utf8');

console.log(changed ? '✅ Fixed dictionary syntax issue.' : '✅ No broken vehicle/account dictionary line found. File left unchanged.');
console.log('Backup:', path.relative(root, backup));
console.log('Next: restart Next.js and open http://localhost:3040');
