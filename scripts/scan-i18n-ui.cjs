const fs = require('fs');
const path = require('path');

const root = process.cwd();
const includeExt = new Set(['.ts', '.tsx']);
const ignoreParts = [
  path.normalize('node_modules'),
  path.normalize('.next'),
  path.normalize('src/lib/i18n'),
  path.normalize('scripts'),
  path.normalize('docs'),
  path.normalize('src/app/api'),
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    const rel = path.relative(root, full);
    if (ignoreParts.some((part) => rel.includes(part))) continue;
    if (item.isDirectory()) walk(full, out);
    else if (includeExt.has(path.extname(item.name))) out.push(full);
  }
  return out;
}

const rows = [];
for (const file of walk(path.join(root, 'src'))) {
  const rel = path.relative(root, file).replace(/\/g, '/');
  const text = fs.readFileSync(file, 'utf8');
  text.split(/\r?\n/).forEach((line, index) => {
    if (/[\u0600-\u06FF]/.test(line)) rows.push({ file: rel, line: index + 1, text: line.trim() });
  });
}

const byFile = new Map();
for (const row of rows) byFile.set(row.file, (byFile.get(row.file) || 0) + 1);
const top = [...byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40);
console.log('UI Arabic hardcoded scan (ignores i18n dictionary and API routes): ' + rows.length + ' lines');
console.log('');
console.log('Top files:');
for (const [file, count] of top) console.log(String(count).padStart(4) + '  ' + file);
console.log('');
console.log('Sample rows:');
for (const row of rows.slice(0, 200)) console.log(row.file + ':' + row.line + '  ' + row.text);
