# Vehicle System Final QA — اختبار إغلاق جزء السيارات

نفّذ الاختبار ده قبل ما تعتبر جزء السيارات مقفول نهائيًا.

## 1) تشغيل النظام

```powershell
cd "C:\Users\hp\Desktop\أخر نسخه\MOHAMED SHAWKI ERP V85.12\apps\erp"
taskkill /F /IM node.exe
Remove-Item -Recurse -Force .next
npm run dev
```

لو `node.exe not found` أو `.next not found` عادي.

## 2) افتح الصفحات الأساسية

- `/vehicles`
- `/vehicles/new`
- `/vehicle-movements`
- `/vehicle-maintenance`
- `/authorizations`
- `/vehicle-accidents`
- `/vehicle-damages`
- `/vehicle-cleaning`
- `/vehicle-finance`
- `/vehicle-cost`
- `/vehicle-deductions`
- `/vehicle-violations`

## 3) اختبار جدول السيارات

- البحث باللوحة أو المندوب.
- فلترة الحالة.
- Pagination: الأول / السابق / التالي / الأخير.
- تغيير عدد السجلات: 25 / 50 / 100 / الكل.
- تصدير CSV بعد البحث/الفلتر.
- طباعة الصفحة.
- نسخ الملخص.

## 4) اختبار الفورم الموحد

في الصفحات دي:

- `/vehicle-movements`
- `/vehicle-maintenance`
- `/authorizations`
- `/vehicle-accidents`
- `/vehicle-damages`
- `/vehicle-cleaning`

اختبر:

- فتح إضافة جديد.
- اختيار السيارة.
- ظهور كارت السيارة المختارة.
- تعبئة المندوب تلقائيًا.
- تعبئة المدينة تلقائيًا لو موجودة في الصفحة.
- رفع الملفات في الحوادث/التلفيات/النظافة.
- الحفظ.
- التعديل.
- الحذف لسجل تجريبي فقط.

## 5) اختبار Quick Actions

من `/vehicles` جرّب أزرار:

- ملف السيارة.
- حركة.
- صيانة.
- تفويض.
- حادث.

ومن ملف السيارة جرّب:

- تسجيل حركة.
- إضافة صيانة.
- إضافة تفويض.
- إضافة حادث.
- إضافة تلفيات.
- تسجيل نظافة.
- تسجيل مخالفة.
- تسجيل خصم.

المتوقع: الصفحة تفتح والفورم مفتوح والسيارة مختارة تلقائيًا.

## 6) اختبار ملف السيارة

افتح ملف سيارة وتأكد من:

- بيانات السيارة الأساسية.
- المندوب الحالي.
- المدينة.
- الحالة.
- لوحة التنبيهات.
- زر طباعة ملف السيارة.
- أقسام الحركات، الصيانة، التفويضات، الحوادث، التلفيات، النظافة، المالية، المخالفات.

## 7) ملاحظات مهمة

تحذير `fdprocessedid` غالبًا من إضافة Chrome Autofill/Password Manager، وليس خطأ من النظام. اختبر في Incognito لو حبيت تتأكد.

أي خطأ أحمر في Terminal هو المهم؛ ابعته كما هو لو ظهر.
