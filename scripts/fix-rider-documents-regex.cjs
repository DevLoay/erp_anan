const fs = require('fs');
const path = require('path');

const root = process.cwd();
const target = path.join(root, 'src', 'lib', 'rider-documents', 'getRiderDocumentsData.ts');

console.log('\nRIDER DOCUMENTS REGEX FIX');
console.log('Project root:', root);

if (!fs.existsSync(target)) {
  console.error('❌ Missing file:', path.relative(root, target));
  process.exit(1);
}

let text = fs.readFileSync(target, 'utf8');
const before = text;

// Fix invalid JavaScript/TypeScript regex character classes such as /[s-_/\\.]+/g
// or /[\s-_/\\.]+/g where '-' creates an invalid range. Keep '-' at the end.
const replacements = [
  [/\/\[s-_\\\/\\\.\]\+\/g/g, '/[\\s_./-]+/g'],
  [/\/\[s-_\/\\\.\]\+\/g/g, '/[\\s_./-]+/g'],
  [/\/\[\\s-_\\\/\\\.\]\+\/g/g, '/[\\s_./-]+/g'],
  [/\/\[\\s-_\/\\\.\]\+\/g/g, '/[\\s_./-]+/g'],
  [/\/\[\\s-_\/\.\]\+\/g/g, '/[\\s_./-]+/g'],
  [/\/\[s-_\/\.\]\+\/g/g, '/[\\s_./-]+/g'],
];

for (const [find, repl] of replacements) {
  text = text.replace(find, repl);
}

// More defensive line-level repair for normalizer functions.
text = text.replace(/\.replace\(\/\[[^\]\n]*-_[^\]\n]*\]\+\/g,\s*(['"])\1\)/g, ".replace(/[\\s_./-]+/g, '')");
text = text.replace(/\.replace\(\/\[[^\]\n]*-_[^\]\n]*\]\+\/g,\s*(['"])(.*?)\1\)/g, ".replace(/[\\s_./-]+/g, '$2')");

if (text === before) {
  console.log('⚠️ No invalid regex pattern was found automatically. Checking for remaining dangerous patterns...');
} else {
  fs.writeFileSync(target, text, 'utf8');
  console.log('✅ updated', path.relative(root, target));
}

// Verify TypeScript source no longer contains known invalid patterns.
const after = fs.readFileSync(target, 'utf8');
const badPatterns = [
  '/[s-_/\\.]+/g',
  '/[s-_/\.]+/g',
  '/[\\s-_/\\.]+/g',
  '/[\\s-_/\.]+/g',
];
const found = badPatterns.filter((p) => after.includes(p));
if (found.length) {
  console.error('❌ Still found invalid regex pattern(s):', found.join(', '));
  console.error('Open src/lib/rider-documents/getRiderDocumentsData.ts and replace them with /[\\s_./-]+/g');
  process.exit(1);
}

console.log('✅ regex check passed');
console.log('\nNext:');
console.log('taskkill /F /IM node.exe');
console.log('Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue');
console.log('npm run dev');
