const fs = require('fs');
const path = require('path');

const root = process.cwd();
const dictionaryPath = path.join(root, 'src/lib/i18n/dictionary.ts');
const required = [
  'الحالة',
  'المندوب',
  'المدينة / المشروع',
  'مسير الرواتب',
  'السيارة',
  'حسابات التطبيقات',
  'صلاحيات غير كافية',
  'استيراد البيانات العامة',
  'تقرير تشغيلي',
  'رقم المستند',
];

let failed = 0;
function ok(label) { console.log('✅ ' + label); }
function fail(label) { failed += 1; console.log('❌ ' + label); }

console.log('i18n phase 3 check');
if (!fs.existsSync(dictionaryPath)) fail('missing src/lib/i18n/dictionary.ts');
else {
  const content = fs.readFileSync(dictionaryPath, 'utf8');
  for (const key of required) {
    if (content.includes(JSON.stringify(key))) ok('dictionary key: ' + key);
    else fail('missing dictionary key: ' + key);
  }
}

const scanUi = path.join(root, 'scripts/scan-i18n-ui.cjs');
if (fs.existsSync(scanUi)) ok('exists scripts/scan-i18n-ui.cjs');
else fail('missing scripts/scan-i18n-ui.cjs');

console.log(`i18n phase 3 result: ${failed ? 'FAILED' : 'OK'} | failed=${failed}`);
process.exitCode = failed ? 1 : 0;
