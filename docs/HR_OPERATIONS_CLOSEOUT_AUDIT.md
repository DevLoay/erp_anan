# HR / Operations Closeout Audit

هذا الملف يخص مراجعة قسم التشغيل والموارد البشرية قبل الإغلاق النهائي المحلي.

## النطاق

- إدارة المناديب `/drivers`
- إضافة مندوب `/drivers/new`
- ملف المندوب `/drivers/[id]`
- المشرفون `/supervisors`
- الحضور والانصراف `/attendance`
- الشفتات `/shifts`
- مهام المشرفين `/supervisor-tasks`
- المقابلات `/interviews`
- صفحات HR الاختيارية إن كانت موجودة: السكن، المستندات، الإنذارات

## سكريبتات الفحص

```powershell
node scripts/check-hr-operations-system.cjs
```

يفحص وجود الصفحات، الـ APIs، الـ data loaders، الـ clients، نماذج Prisma، الربط في Sidebar، والربط في الصلاحيات.

```powershell
$env:ERP_TEST_EMAIL="admin@logistics-erp.com"
$env:ERP_TEST_PASSWORD="Admin@123456"
node scripts/smoke-hr-auth-routes.cjs
```

يفتح الصفحات الأساسية بعد تسجيل الدخول ويتأكد من أنها لا ترجع 404 أو 500.

## ملاحظات

- التحذيرات الخاصة بالصفحات الاختيارية لا تعتبر فشلًا إلا لو قررت أن الصفحة مطلوبة في القائمة النهائية.
- بعد نجاح الفحص الأول، يتم تنفيذ مراحل إضافية لفحص الأزرار والفلاتر وعمليات CRUD حسب كل صفحة.
