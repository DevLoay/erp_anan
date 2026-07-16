const fs = require('fs');
const path = require('path');

const root = process.cwd();
const dictionaryPath = path.join(root, 'src/lib/i18n/dictionary.ts');

const entries = {
  // System / generic
  'الكل': 'All',
  'إجراءات': 'Actions',
  'الحالة': 'Status',
  'النوع': 'Type',
  'الاسم': 'Name',
  'التاريخ': 'Date',
  'القيمة': 'Value',
  'المصدر': 'Source',
  'ملاحظات': 'Notes',
  'الملف': 'File',
  'المطلوب': 'Required',
  'غير محدد': 'Not specified',
  'بدون بيانات': 'No data',
  'لا توجد بيانات': 'No data found',
  'لا توجد نتائج': 'No results found',
  'جاري التحميل...': 'Loading...',
  'حدث خطأ': 'An error occurred',
  'حاول مرة أخرى': 'Try again',
  'تحديث': 'Refresh',
  'إعادة تحميل': 'Reload',
  'تنزيل': 'Download',
  'تصدير CSV': 'Export CSV',
  'استيراد ملف': 'Import file',
  'رفع ملف': 'Upload file',
  'اختر ملف': 'Choose file',
  'من تاريخ': 'From date',
  'إلى تاريخ': 'To date',
  'كل الحالات': 'All statuses',
  'كل المدن': 'All cities',
  'كل المشاريع': 'All projects',
  'كل التطبيقات': 'All applications',
  'كل المشرفين': 'All supervisors',
  'مراجعة': 'Review',
  'المراجعة': 'Review',
  'عرض': 'View',
  'فتح': 'Open',
  'المزيد': 'More',
  'ملخص': 'Summary',
  'إجمالي': 'Total',
  'الإجمالي': 'Total',
  'اليوم': 'Today',
  'هذا الشهر': 'This month',
  'الشهر': 'Month',
  'السنة': 'Year',
  'الفترة': 'Period',
  'البيانات': 'Data',
  'النتائج': 'Results',
  'الرصيد': 'Balance',
  'العملة': 'Currency',
  'ر.س': 'SAR',

  // Statuses
  'نشط': 'Active',
  'غير نشط': 'Inactive',
  'موقوف': 'Suspended',
  'منتهي': 'Expired',
  'منتهية': 'Expired',
  'معلّق': 'Pending',
  'معلق': 'Pending',
  'بانتظار': 'Pending',
  'بانتظار المراجعة': 'Pending review',
  'معتمد': 'Approved',
  'معتمدة': 'Approved',
  'مرفوض': 'Rejected',
  'مرفوضة': 'Rejected',
  'ملغي': 'Cancelled',
  'ملغية': 'Cancelled',
  'موثق': 'Verified',
  'موثقة': 'Verified',
  'مؤهل': 'Qualified',
  'غير مؤهل': 'Not qualified',
  'جيد': 'Good',
  'تحذير': 'Warning',
  'حرج': 'Critical',
  'خطر': 'Danger',
  'عاجل': 'Urgent',
  'طبيعي': 'Normal',
  'مفتوح': 'Open',
  'مغلق': 'Closed',
  'محذوف': 'Deleted',

  // Drivers / HR
  'المندوب': 'Driver',
  'المندوبين': 'Drivers',
  'كود المندوب': 'Driver code',
  'اسم المندوب': 'Driver name',
  'رقم الهوية': 'National ID',
  'رقم الجوال': 'Phone number',
  'الجوال': 'Phone',
  'الحساب': 'Account',
  'اسم الحساب': 'Account name',
  'حسابات التطبيقات': 'Application accounts',
  'الحسابات': 'Accounts',
  'المشرف': 'Supervisor',
  'المشرفين': 'Supervisors',
  'كل المشرفين': 'All supervisors',
  'إجمالي المناديب': 'Total drivers',
  'مناديب نشطين': 'Active drivers',
  'بدون مشرف': 'Without supervisor',
  'بدون مدينة': 'Without city',
  'بدون مشروع': 'Without project',
  'بدون سيارة': 'Without vehicle',
  'بدون حساب': 'Without account',
  'إضافة يدوية': 'Manual add',
  'إضافة مندوب يدوي': 'Add driver manually',
  'البيانات الأساسية': 'Basic information',
  'بيانات الاتصال': 'Contact information',
  'الربط التشغيلي': 'Operational linking',
  'رقم الإقامة': 'Iqama number',
  'الإقامة': 'Iqama',
  'رخصة القيادة': 'Driving license',
  'نوع العقد': 'Contract type',
  'تاريخ الانضمام': 'Joining date',
  'ملف المندوب': 'Driver profile',

  // Attendance / tasks / interviews
  'الشفت': 'Shift',
  'الشفتات': 'Shifts',
  'الساعات': 'Hours',
  'ساعات العمل': 'Working hours',
  'تسجيل حضور': 'Check in',
  'تسجيل انصراف': 'Check out',
  'وقت الحضور': 'Check-in time',
  'وقت الانصراف': 'Check-out time',
  'الكاميرا': 'Camera',
  'المهام': 'Tasks',
  'المهمة': 'Task',
  'نوع المهمة': 'Task type',
  'إنشاء مهمة': 'Create task',
  'المقابلة': 'Interview',
  'المقابلات': 'Interviews',
  'نتيجة المقابلة': 'Interview result',
  'موعد المقابلة': 'Interview date',
  'قبول': 'Accept',
  'تحويل إلى مندوب': 'Convert to driver',

  // Documents / housing / warnings
  'المستند': 'Document',
  'المستندات': 'Documents',
  'نوع المستند': 'Document type',
  'رقم المستند': 'Document number',
  'تاريخ الإصدار': 'Issue date',
  'الإصدار': 'Issue',
  'تاريخ الانتهاء': 'Expiry date',
  'الانتهاء': 'Expiry',
  'تنتهي خلال 30 يوم': 'Expiring within 30 days',
  'موثقة / معتمدة': 'Verified / Approved',
  'السكن': 'Housing',
  'سكن المناديب': 'Driver housing',
  'الإنذارات': 'Warnings',
  'التحذيرات': 'Warnings',
  'العقود': 'Contracts',
  'الكفالة': 'Sponsorship',
  'العقود والكفالة': 'Contracts & Sponsorship',

  // Projects / cities / applications
  'المدينة': 'City',
  'المدن': 'Cities',
  'المشروع': 'Project',
  'المشاريع': 'Projects',
  'مشروع التطبيق': 'Application project',
  'المدينة / المشروع': 'City / Project',
  'مركز التطبيقات': 'Applications center',
  'التطبيق': 'Application',
  'التطبيقات': 'Applications',
  'كل التطبيقات': 'All applications',
  'مراجعة ربط الحسابات': 'Account linking review',
  'حساب التطبيق': 'Application account',
  'App User ID / اسم المندوب / الكود': 'App User ID / Driver name / Code',
  'إعدادات التطبيقات': 'Application settings',
  'إعدادات البرنامج': 'System settings',
  'الخدمات': 'Services',
  'هدف شهري': 'Monthly target',
  'هدف يومي': 'Daily target',
  'الطلبات': 'Orders',
  'طلبات الفترة': 'Period orders',

  // Finance / payroll
  'مسير الرواتب': 'Payroll',
  'الرواتب': 'Salaries',
  'الراتب': 'Salary',
  'الراتب الأساسي': 'Basic salary',
  'صافي الراتب': 'Net salary',
  'البدلات': 'Allowances',
  'الخصومات': 'Deductions',
  'السلف': 'Advances',
  'الفواتير': 'Invoices',
  'المصروفات': 'Expenses',
  'الإيرادات': 'Revenues',
  'المدفوعات': 'Payments',
  'المستحقات': 'Receivables',
  'ضريبة القيمة المضافة': 'VAT',
  'الأرباح والخسائر': 'Profit & Loss',
  'التقارير المالية': 'Financial Reports',
  'الحسابات البنكية': 'Bank Accounts',
  'العهدة والصندوق': 'Custody & Cashbox',
  'حسابات الموردين': 'Supplier Accounts',
  'المبلغ': 'Amount',
  'طريقة الدفع': 'Payment method',
  'رقم الفاتورة': 'Invoice number',
  'تاريخ الفاتورة': 'Invoice date',
  'تاريخ السلفة': 'Advance date',
  'شهر الخصم': 'Deduction month',
  'مدفوع': 'Paid',
  'غير مدفوع': 'Unpaid',
  'جزئي': 'Partial',

  // Vehicles
  'السيارات': 'Vehicles',
  'السيارة': 'Vehicle',
  'حركة السيارات': 'Vehicle movements',
  'صيانة السيارات': 'Vehicle maintenance',
  'تفويضات السيارات': 'Vehicle authorizations',
  'شركات التأجير': 'Rental companies',
  'مخالفات السيارات': 'Vehicle violations',
  'خصومات السيارات': 'Vehicle deductions',
  'تكلفة السيارات': 'Vehicle cost',
  'تمويل السيارات': 'Vehicle finance',
  'نوع السيارة': 'Vehicle type',
  'لوحة السيارة': 'Plate number',
  'رقم اللوحة': 'Plate number',
  'سيارة شركة': 'Company car',
  'سيارة شخصية': 'Personal car',
  'إيجار السيارة': 'Vehicle rent',
  'تكلفة الوقود': 'Fuel cost',
  'حادث': 'Accident',
  'أضرار': 'Damages',
  'تنظيف': 'Cleaning',

  // Reports / dashboard / alerts
  'الرئيسية والتقارير': 'Home & Reports',
  'إحصائيات': 'Statistics',
  'المؤشرات': 'KPIs',
  'مؤشرات الأداء': 'Performance KPIs',
  'تقرير': 'Report',
  'تقرير يومي': 'Daily report',
  'تقرير مالي': 'Financial report',
  'تقرير تشغيلي': 'Operational report',
  'تقرير المندوب': 'Driver report',
  'تقرير المدينة': 'City report',
  'التنبيهات': 'Alerts',
  'الشدة': 'Severity',
  'حل التنبيه': 'Resolve alert',
  'غير مغلق': 'Open',
  'مغلق': 'Closed',

  // Import / data tools
  'الاستيراد': 'Import',
  'استيراد البيانات العامة': 'General data import',
  'استيراد المناديب': 'Drivers import',
  'قوالب الاستيراد': 'Import templates',
  'معاينة الاستيراد': 'Import preview',
  'سجل الاستيراد': 'Import history',
  'ملف Excel': 'Excel file',
  'تحميل القالب': 'Download template',
  'تجهيز القالب': 'Prepare template',
  'تنظيف البيانات': 'Data cleaning',
  'فحص البيانات': 'Data scan',

  // Access / permissions
  'صلاحيات غير كافية': 'Insufficient permissions',
  'لا يمكنك فتح هذه الصفحة': 'You cannot open this page',
  'العودة للوحة الإدارة': 'Back to admin dashboard',
  'الصلاحيات': 'Permissions',
  'الأدوار': 'Roles',
  'المستخدمين': 'Users',
  'إدارة المستخدمين': 'User management',
  'سجل التدقيق': 'Audit log',
};

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function upsertDictionary() {
  if (!fs.existsSync(dictionaryPath)) {
    throw new Error('Missing src/lib/i18n/dictionary.ts. Install foundation first.');
  }
  let content = fs.readFileSync(dictionaryPath, 'utf8');
  const missing = Object.entries(entries).filter(([key]) => !content.includes(JSON.stringify(key) + ':'));
  if (!missing.length) {
    console.log('i18n phase 3: dictionary already contains all phase 3 entries.');
    return;
  }
  const insert = missing.map(([key, en]) => `  ${JSON.stringify(key)}: { en: ${JSON.stringify(en)} },`).join('\n') + '\n';
  const marker = '\n};\n\nfunction escapeRegex';
  if (!content.includes(marker)) {
    throw new Error('Could not locate TEXT_MAP closing marker in dictionary.ts');
  }
  content = content.replace(marker, '\n' + insert + '};\n\nfunction escapeRegex');
  fs.writeFileSync(dictionaryPath, content, 'utf8');
  console.log(`i18n phase 3: added ${missing.length} dictionary entries.`);
}

function writeHelpers() {
  const scanPath = path.join(root, 'scripts/scan-i18n-ui.cjs');
  ensureDir(scanPath);
  fs.writeFileSync(scanPath, `const fs = require('fs');
const path = require('path');

const root = process.cwd();
const includeExt = new Set(['.ts', '.tsx']);
const ignoreParts = [
  path.normalize('node_modules'),
  path.normalize('.next'),
  path.normalize('src/lib/i18n'),
  path.normalize('scripts'),
  path.normalize('docs'),
  path.normalize('src/app/api'),
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    const rel = path.relative(root, full);
    if (ignoreParts.some((part) => rel.includes(part))) continue;
    if (item.isDirectory()) walk(full, out);
    else if (includeExt.has(path.extname(item.name))) out.push(full);
  }
  return out;
}

const rows = [];
for (const file of walk(path.join(root, 'src'))) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  const text = fs.readFileSync(file, 'utf8');
  text.split(/\\r?\\n/).forEach((line, index) => {
    if (/[\\u0600-\\u06FF]/.test(line)) rows.push({ file: rel, line: index + 1, text: line.trim() });
  });
}

const byFile = new Map();
for (const row of rows) byFile.set(row.file, (byFile.get(row.file) || 0) + 1);
const top = [...byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40);
console.log('UI Arabic hardcoded scan (ignores i18n dictionary and API routes): ' + rows.length + ' lines');
console.log('');
console.log('Top files:');
for (const [file, count] of top) console.log(String(count).padStart(4) + '  ' + file);
console.log('');
console.log('Sample rows:');
for (const row of rows.slice(0, 200)) console.log(row.file + ':' + row.line + '  ' + row.text);
`, 'utf8');
}

upsertDictionary();
writeHelpers();
console.log('i18n phase 3 installed successfully.');
