# Finance System Closeout Audit

الغرض من هذه المرحلة هو مراجعة صفحات **الماليات والمسير** قبل أي تعديل كبير، حتى لا يتكرر سيناريو حذف ملفات أو كسر صفحات شغالة.

## الصفحات الداخلة في الإغلاق

- `/payroll` — مسير الرواتب
- `/payroll/settings` — إعدادات المسير
- `/finance` — مركز الماليات
- `/invoices` — الفواتير العامة
- `/receivables` — المستحقات
- `/payments` — المدفوعات
- `/expenses` — المصروفات
- `/revenues` — الإيرادات
- `/advances` — السلف المالية
- `/deductions` — الخصومات
- `/vehicle-finance` — مالية السيارات
- `/vehicle-cost` — تكلفة السيارات
- `/supplier-accounts` — حسابات الموردين
- `/custody-cashbox` — العهدة والصندوق
- `/bank-accounts` — الحسابات البنكية
- `/vat` — ضريبة القيمة المضافة
- `/profit-loss` — الأرباح والخسائر
- `/financial-reports` — التقارير المالية

## طريقة التشغيل

```powershell
node scripts/check-finance-system.cjs
```

ثم شغل السيرفر:

```powershell
npm run dev
```

وفي PowerShell آخر:

```powershell
node scripts/smoke-finance-routes.cjs
```

## ملاحظات

- لو ظهر `TcpTestSucceeded : False` على PostgreSQL، شغّل Docker container الخاص بالداتابيز أولًا.
- أي Route يرجع `500` في smoke test يعتبر Bug لازم يتصلح.
- أي Route يرجع `200/302/401/403` أثناء smoke test يعتبر غير مكسور من ناحية routing.
- صفحة `السنة المالية` غير موجودة كصفحة مستقلة في المراجعة الحالية؛ لو مطلوبة نضيفها كمرحلة مستقلة.
