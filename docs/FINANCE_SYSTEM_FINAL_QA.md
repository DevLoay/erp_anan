# Finance System Final QA

## الهدف
تقفيل جزء الماليات بعد التأكد من فتح الصفحات، تسجيل الدخول، وعمليات الإضافة/التعديل/الحذف.

## أوامر الاختبار

```powershell
docker start erp-postgres-1
npm run dev
```

في PowerShell آخر:

```powershell
$env:ERP_TEST_EMAIL="admin@logistics-erp.com"
$env:ERP_TEST_PASSWORD="Admin@123456"

node scripts/check-finance-system.cjs
node scripts/smoke-finance-routes.cjs
node scripts/smoke-finance-auth-routes.cjs
node scripts/smoke-finance-crud.cjs
node scripts/check-finance-closeout.cjs
```

## الصفحات المطلوب مراجعتها يدويًا

- /finance
- /payroll
- /payroll/settings
- /invoices
- /receivables
- /payments
- /expenses
- /revenues
- /advances
- /deductions
- /vehicle-finance
- /vehicle-cost
- /supplier-accounts
- /custody-cashbox
- /bank-accounts
- /vat
- /profit-loss
- /financial-reports

## عناصر UI المطلوبة

- كروت ملخص واضحة.
- فلاتر تاريخ/شهر/حالة/بحث.
- إضافة سجل من الصفحات التي تدعم الإضافة.
- فتح تفاصيل السجل.
- تعديل السجل.
- حذف/تعطيل السجل.
- تصدير CSV.
- طباعة/PDF.
- Pagination للجداول الكبيرة.

## معايير الإغلاق

- Authenticated smoke result: OK | failed=0
- CRUD result: OK | failed=0
- Finance final closeout result: OK
- لا يوجد 500 في Terminal أثناء فتح الصفحات يدويًا.
- قاعدة البيانات تعمل على localhost:5432.
