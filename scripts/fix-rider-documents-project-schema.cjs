const fs = require('fs');
const path = require('path');

const root = process.cwd();
const dataPath = path.join(root, 'src', 'lib', 'rider-documents', 'getRiderDocumentsData.ts');
const clientPath = path.join(root, 'src', 'components', 'rider-documents', 'RiderDocumentsClient.tsx');

function read(file) {
  if (!fs.existsSync(file)) throw new Error(`Missing file: ${path.relative(root, file)}`);
  return fs.readFileSync(file, 'utf8');
}

function writeIfChanged(file, before, after) {
  if (before !== after) {
    fs.writeFileSync(file, after, 'utf8');
    console.log(`✅ updated ${path.relative(root, file)}`);
  } else {
    console.log(`ℹ️ no change ${path.relative(root, file)}`);
  }
}

console.log('\nRIDER DOCUMENTS PROJECT SCHEMA FIX');
console.log(`Project root: ${root}`);

let data = read(dataPath);
const beforeData = data;

// Project model in this ERP schema does not have nameAr/nameEn. Keep only existing Project fields.
data = data.replace(
  /project:\s*\{\s*select:\s*\{\s*id:\s*true,\s*name:\s*true,\s*nameAr:\s*true,\s*nameEn:\s*true\s*\}\s*\},/g,
  'project: { select: { id: true, name: true, appName: true, status: true } },'
);

data = data.replace(
  /project:\s*\{\s*select:\s*\{\s*id:\s*true,\s*name:\s*true,\s*nameAr:\s*true\s*\}\s*\},/g,
  'project: { select: { id: true, name: true, appName: true, status: true } },'
);

writeIfChanged(dataPath, beforeData, data);

let client = read(clientPath);
const beforeClient = client;

client = client.replace(
  /\{row\.driver\?\.project\?\.nameAr\s*\|\|\s*row\.driver\?\.project\?\.name\s*\|\|\s*"—"\}/g,
  '{row.driver?.project?.name || row.driver?.project?.appName || "—"}'
);

client = client.replace(
  /row\.driver\?\.project\?\.nameAr\s*\|\|\s*row\.driver\?\.project\?\.name/g,
  'row.driver?.project?.name || row.driver?.project?.appName'
);

writeIfChanged(clientPath, beforeClient, client);

console.log('\n✅ Done. Re-run:');
console.log('node scripts/check-rider-documents-module.cjs');
console.log('node scripts/smoke-rider-documents-crud.cjs');
