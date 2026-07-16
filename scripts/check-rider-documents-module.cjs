#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
let failed = 0;
function exists(rel) {
  const ok = fs.existsSync(path.join(root, rel));
  console.log(`${ok ? '✅' : '❌'} exists ${rel}`);
  if (!ok) failed++;
  return ok;
}
function contains(rel, needle, label = needle) {
  const p = path.join(root, rel);
  const ok = fs.existsSync(p) && fs.readFileSync(p, 'utf8').includes(needle);
  console.log(`${ok ? '✅' : '❌'} ${rel}: ${label}`);
  if (!ok) failed++;
}

console.log('\nRider documents module check');
console.log(`Project root: ${root}\n`);

exists('src/app/rider-documents/page.tsx');
exists('src/components/rider-documents/RiderDocumentsClient.tsx');
exists('src/lib/rider-documents/getRiderDocumentsData.ts');
exists('src/app/api/rider-documents/route.ts');
exists('src/app/api/rider-documents/[id]/route.ts');

console.log('\nContent checks');
contains('src/components/rider-documents/RiderDocumentsClient.tsx', 'مستندات المناديب');
contains('src/components/rider-documents/RiderDocumentsClient.tsx', 'تصدير إكسل');
contains('src/components/rider-documents/RiderDocumentsClient.tsx', 'طباعة / PDF');
contains('src/components/rider-documents/RiderDocumentsClient.tsx', '+ إضافة مستند');
contains('src/components/rider-documents/RiderDocumentsClient.tsx', 'تطبيق');
contains('src/components/rider-documents/RiderDocumentsClient.tsx', 'عرض الكل');
contains('src/components/rider-documents/RiderDocumentsClient.tsx', 'اعتماد');
contains('src/components/rider-documents/RiderDocumentsClient.tsx', 'رفض');
contains('src/app/api/rider-documents/route.ts', 'export async function POST');
contains('src/app/api/rider-documents/[id]/route.ts', 'export async function PATCH');
contains('src/app/api/rider-documents/[id]/route.ts', 'export async function DELETE');

console.log(`\nRider documents module check result: ${failed ? 'FAILED' : 'OK'} | failed=${failed}`);
process.exit(failed ? 1 : 0);
