# Interviews Module Fix / QA

هذا التصحيح يستبدل صفحة `/interviews` القديمة التي كانت تعتمد على ResourceModulePage العامة بصفحة تشغيلية كاملة للمقابلات.

## ما تم إضافته

- صفحة مقابلات كاملة: `/interviews`
- Data loader مستقل: `src/lib/interviews/getInterviewsPageData.ts`
- Client UI مستقل: `src/components/interviews/InterviewsClient.tsx`
- APIs:
  - `GET/POST /api/interviews`
  - `GET/PATCH/DELETE /api/interviews/[id]`
  - `POST /api/interviews/[id]/convert`
- فلاتر: بحث، حالة، مدينة، مشروع، من تاريخ، إلى تاريخ
- أزرار: إضافة، تعديل، قبول، رفض، حذف، تحويل لمندوب، تصدير، طباعة
- تحديث sidebar/permissions لإضافة `/interviews`
- سكريبتات QA:
  - `scripts/check-interviews-module.cjs`
  - `scripts/smoke-interviews-crud.cjs`

## اختبار سريع

```powershell
node scripts/fix-interviews-module.cjs
node scripts/check-interviews-module.cjs

$env:ERP_TEST_EMAIL="admin@logistics-erp.com"
$env:ERP_TEST_PASSWORD="Admin@123456"
node scripts/smoke-interviews-crud.cjs
```

## نتيجة الإغلاق المطلوبة

```text
Interviews module check result: OK | failed=0
Interviews CRUD result: OK | failed=0
```
