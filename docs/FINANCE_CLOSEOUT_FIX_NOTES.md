# Finance Closeout Fix Notes

هذا التصحيح يعالج نقطتين ظهرتا في فحص الإغلاق:

1. إضافة `/vehicle-cost` إلى قائمة الماليات في `src/lib/modules.ts` إذا كانت غير موجودة.
2. تعديل `scripts/check-finance-closeout.cjs` حتى لا يعتبر صفحات الهبوط مثل `/finance` و`/payroll` جزءًا من `financePages.ts`؛ لأن `financePages.ts` مخصص للصفحات المالية الموحدة فقط.

بعد تطبيق التصحيح، شغّل:

```powershell
node scripts/fix-finance-closeout.cjs
node scripts/check-finance-system.cjs
node scripts/check-finance-closeout.cjs
```

اختبارات `smoke-finance-auth-routes` و`smoke-finance-crud` تحتاج أن يكون `npm run dev` شغال في نافذة أخرى.
