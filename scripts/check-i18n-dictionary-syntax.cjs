const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src', 'lib', 'i18n', 'dictionary.ts');
if (!fs.existsSync(file)) {
  console.error('❌ Missing src/lib/i18n/dictionary.ts');
  process.exit(1);
}
const text = fs.readFileSync(file, 'utf8');
const lines = text.split(/\r?\n/);
const bad = [];
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (l.includes('لو اخترت سيارة، النظام سيرفض') && !l.includes(': { en:')) bad.push(i + 1);
}
if (bad.length) {
  console.error('❌ Still has broken dictionary line(s):', bad.join(', '));
  process.exit(1);
}
console.log('✅ Dictionary syntax pre-check passed.');
console.log('Run npm run dev to let Next.js validate the full TypeScript parse.');
