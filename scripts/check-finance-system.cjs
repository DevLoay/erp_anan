/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const exists = (p) => fs.existsSync(path.join(root, p));
const read = (p) => (exists(p) ? fs.readFileSync(path.join(root, p), 'utf8') : '');

const financePages = [
  { label: 'مسير الرواتب', route: '/payroll', page: 'src/app/payroll/page.tsx', kind: 'core' },
  { label: 'إعدادات المسير', route: '/payroll/settings', page: 'src/app/payroll/settings/page.tsx', kind: 'core' },
  { label: 'مركز الماليات', route: '/finance', page: 'src/app/finance/page.tsx', kind: 'core' },
  { label: 'الفواتير العامة', route: '/invoices', page: 'src/app/invoices/page.tsx', kind: 'finance-module', moduleKey: 'invoices', api: '/api/invoices' },
  { label: 'المستحقات', route: '/receivables', page: 'src/app/receivables/page.tsx', kind: 'finance-module', moduleKey: 'receivables', api: '/api/receivables' },
  { label: 'المدفوعات', route: '/payments', page: 'src/app/payments/page.tsx', kind: 'finance-module', moduleKey: 'payments', api: '/api/payments' },
  { label: 'المصروفات', route: '/expenses', page: 'src/app/expenses/page.tsx', kind: 'finance-module', moduleKey: 'expenses', api: '/api/expenses' },
  { label: 'الإيرادات', route: '/revenues', page: 'src/app/revenues/page.tsx', kind: 'finance-module', moduleKey: 'revenues', api: '/api/revenues' },
  { label: 'السلف المالية', route: '/advances', page: 'src/app/advances/page.tsx', kind: 'special', api: '/api/advances' },
  { label: 'الخصومات', route: '/deductions', page: 'src/app/deductions/page.tsx', kind: 'finance-module', moduleKey: 'deductions', api: '/api/deductions' },
  { label: 'مالية السيارات', route: '/vehicle-finance', page: 'src/app/vehicle-finance/page.tsx', kind: 'vehicle' },
  { label: 'تكلفة السيارات', route: '/vehicle-cost', page: 'src/app/vehicle-cost/page.tsx', kind: 'vehicle' },
  { label: 'حسابات الموردين', route: '/supplier-accounts', page: 'src/app/supplier-accounts/page.tsx', kind: 'finance-module', moduleKey: 'supplier-accounts', api: '/api/supplier-accounts' },
  { label: 'العهدة والصندوق', route: '/custody-cashbox', page: 'src/app/custody-cashbox/page.tsx', kind: 'finance-module', moduleKey: 'cashbox-entries', api: '/api/cashbox-entries' },
  { label: 'الحسابات البنكية', route: '/bank-accounts', page: 'src/app/bank-accounts/page.tsx', kind: 'finance-module', moduleKey: 'bank-accounts', api: '/api/bank-accounts' },
  { label: 'ضريبة القيمة المضافة', route: '/vat', page: 'src/app/vat/page.tsx', kind: 'finance-module', moduleKey: 'vat-records', api: '/api/vat-records' },
  { label: 'الأرباح والخسائر', route: '/profit-loss', page: 'src/app/profit-loss/page.tsx', kind: 'finance-module', moduleKey: 'profit-loss', api: '/api/profit-loss' },
  { label: 'التقارير المالية', route: '/financial-reports', page: 'src/app/financial-reports/page.tsx', kind: 'finance-module', moduleKey: 'financial-reports' },
];

const prismaModels = ['Invoice','Receivable','Payment','Expense','Revenue','Advance','Deduction','SupplierAccount','CashboxEntry','BankAccount','VatRecord','ProfitLossRecord','VehicleCost','Payroll','PayrollRun'];
const directApiRoutes = ['src/app/api/advances/route.ts','src/app/api/advances/[id]/route.ts','src/app/api/deductions/route.ts','src/app/api/deductions/[id]/route.ts','src/app/api/vehicle-costs/route.ts'];
const genericApiRoutes = ['src/app/api/[resource]/route.ts','src/app/api/[resource]/[id]/route.ts'];

function result(ok, label, details = '') {
  const icon = ok ? '✅' : '❌';
  console.log(`${icon} ${label}${details ? ` — ${details}` : ''}`);
  return ok;
}

console.log('\n==============================');
console.log('FINANCE SYSTEM CLOSEOUT AUDIT');
console.log('==============================\n');

let failures = 0;
let warnings = 0;

console.log('1) Pages');
for (const item of financePages) {
  if (!result(exists(item.page), `${item.label} ${item.route}`, item.page)) failures++;
}

console.log('\n2) Shared finance engine');
const financeLib = read('src/lib/finance/financePages.ts');
const financeClient = read('src/components/finance/FinanceModulePageClient.tsx');
if (!result(Boolean(financeLib), 'src/lib/finance/financePages.ts')) failures++;
if (!result(Boolean(financeClient), 'src/components/finance/FinanceModulePageClient.tsx')) failures++;
for (const item of financePages.filter((x) => x.moduleKey)) {
  if (!result(financeLib.includes(`"${item.moduleKey}"`) || financeLib.includes(`'${item.moduleKey}'`), `module key: ${item.moduleKey}`)) failures++;
}

console.log('\n3) API routes');
for (const p of genericApiRoutes) {
  if (!result(exists(p), p)) failures++;
}
for (const p of directApiRoutes) {
  if (!result(exists(p), p)) warnings++;
}

console.log('\n4) Prisma schema models');
const schema = read('prisma/schema.prisma');
if (!schema) {
  result(false, 'prisma/schema.prisma');
  failures++;
} else {
  for (const model of prismaModels) {
    if (!result(new RegExp(`model\\s+${model}\\b`).test(schema), `model ${model}`)) failures++;
  }
}

console.log('\n5) Sidebar/navigation mapping');
const modules = read('src/lib/modules.ts');
if (!modules) {
  result(false, 'src/lib/modules.ts');
  failures++;
} else {
  for (const item of financePages) {
    if (!result(modules.includes(`href: "${item.route}"`) || modules.includes(`href: '${item.route}'`), `${item.label} in sidebar`, item.route)) failures++;
  }
  if (!modules.includes('/fiscal-year') && !modules.includes('السنة المالية')) {
    result(false, 'اختياري: صفحة السنة المالية غير موجودة كمسار مستقل', 'لو مطلوبة سنضيفها في المرحلة التالية');
    warnings++;
  }
}

console.log('\n6) Recommended browser smoke test');
console.log('شغل السيرفر: npm run dev');
console.log('ثم افتح الصفحات المالية واحدة واحدة، أو شغّل: node scripts/smoke-finance-routes.cjs');

console.log('\n==============================');
console.log(`Result: ${failures ? 'FAILED' : 'OK'} | failures=${failures} | warnings=${warnings}`);
console.log('==============================\n');

process.exitCode = failures ? 1 : 0;
