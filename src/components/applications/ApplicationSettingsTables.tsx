"use client";

import type {
  ApplicationFinanceEntryRow,
  ApplicationFinanceSummary,
  ApplicationImportHistoryRow,
  ApplicationImportTemplateRow,
  ApplicationPayrollRunRow,
  ApplicationSettingRow,
} from "@/lib/applications/getApplicationDetails";

type Handler<T> = (action: string, row: T) => void;

function EmptyBlock({ message }: { message: string }) {
  return <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm font-bold text-slate-500">{message}</div>;
}

function ActionButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-black text-slate-700 hover:bg-slate-50">
      {label}
    </button>
  );
}

export function InvoiceSettingsTable({ rows, onAction }: { rows: ApplicationSettingRow[]; onAction: Handler<ApplicationSettingRow> }) {
  if (!rows.length) return <EmptyBlock message="لا توجد إعدادات فاتورة لهذا التطبيق حتى الآن." />;
  const actions = ["إضافة إعداد", "تعديل", "نسخ من مشروع آخر", "اختبار القالب", "تعطيل"];
  return (
    <div className="table-scroll rounded-2xl border border-slate-200 bg-white">
      <table className="min-w-[980px] text-right text-sm">
        <thead className="bg-slate-50 text-xs font-black text-slate-500">
          <tr>{["اسم الإعداد", "المشروع", "نوع الفاتورة", "الأعمدة المطلوبة", "حالة الربط", "الحالة", "آخر تحديث", "إجراءات"].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-4 py-3 font-black">{row.name}</td>
              <td className="px-4 py-3">{row.projectName}</td>
              <td className="px-4 py-3">{row.type}</td>
              <td className="px-4 py-3">{row.requiredColumnsCount}</td>
              <td className="px-4 py-3">{row.mappingStatus}</td>
              <td className="px-4 py-3">{row.status}</td>
              <td className="px-4 py-3">{row.updatedAt}</td>
              <td className="px-4 py-3"><div className="flex flex-wrap gap-1.5">{actions.map((action) => <ActionButton key={action} label={action} onClick={() => onAction(action, row)} />)}</div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RankSettingsTable({ rows, onAction, isKeeta }: { rows: ApplicationSettingRow[]; onAction: Handler<ApplicationSettingRow>; isKeeta: boolean }) {
  if (!rows.length) return <EmptyBlock message="لا توجد إعدادات رانك لهذا التطبيق حتى الآن." />;
  const actions = ["إضافة Rank", "تعديل", "اختبار", "تعطيل", ...(isKeeta ? ["استيراد Rank Keeta"] : [])];
  return (
    <div className="table-scroll rounded-2xl border border-slate-200 bg-white">
      <table className="min-w-[1120px] text-right text-sm">
        <thead className="bg-slate-50 text-xs font-black text-slate-500">
          <tr>{["اسم الرانك", "المشروع", "نوع الرانك", "أقل طلبات", "قاعدة On Time", "قاعدة Cancellation", "قاعدة Rejection", "قاعدة ساعات العمل", "الحالة", "إجراءات"].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-4 py-3 font-black">{row.name}</td>
              <td className="px-4 py-3">{row.projectName}</td>
              <td className="px-4 py-3">{row.type}</td>
              <td className="px-4 py-3">{row.minimumOrders ?? "-"}</td>
              <td className="px-4 py-3">{row.onTimeRule ?? "-"}</td>
              <td className="px-4 py-3">{row.cancellationRule ?? "-"}</td>
              <td className="px-4 py-3">{row.rejectionRule ?? "-"}</td>
              <td className="px-4 py-3">{row.workingHoursRule ?? "-"}</td>
              <td className="px-4 py-3">{row.status}</td>
              <td className="px-4 py-3"><div className="flex flex-wrap gap-1.5">{actions.map((action) => <ActionButton key={action} label={action} onClick={() => onAction(action, row)} />)}</div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PayrollSettingsTable({ rows, onAction }: { rows: ApplicationSettingRow[]; onAction: Handler<ApplicationSettingRow> }) {
  if (!rows.length) return <EmptyBlock message="لا توجد إعدادات مسير لهذا التطبيق حتى الآن." />;
  const actions = ["إضافة إعداد مسير", "تعديل", "نسخ من مشروع آخر", "اختبار حساب الراتب", "تعطيل"];
  return (
    <div className="table-scroll rounded-2xl border border-slate-200 bg-white">
      <table className="min-w-[1040px] text-right text-sm">
        <thead className="bg-slate-50 text-xs font-black text-slate-500">
          <tr>{["اسم الإعداد", "المشروع", "الراتب الأساسي", "تارجت الطلبات", "سعر الطلب الزائد", "قواعد Level", "قاعدة إيجار السيارة", "الحالة", "إجراءات"].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-4 py-3 font-black">{row.name}</td>
              <td className="px-4 py-3">{row.projectName}</td>
              <td className="px-4 py-3">{row.basicSalary ?? "-"}</td>
              <td className="px-4 py-3">{row.targetOrders ?? "-"}</td>
              <td className="px-4 py-3">{row.extraOrderPrice ?? "-"}</td>
              <td className="px-4 py-3">{row.levelRules ?? "-"}</td>
              <td className="px-4 py-3">{row.carRentRule ?? "-"}</td>
              <td className="px-4 py-3">{row.status}</td>
              <td className="px-4 py-3"><div className="flex flex-wrap gap-1.5">{actions.map((action) => <ActionButton key={action} label={action} onClick={() => onAction(action, row)} />)}</div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ImportTemplatesTable({ rows, onAction }: { rows: ApplicationImportTemplateRow[]; onAction: Handler<ApplicationImportTemplateRow> }) {
  if (!rows.length) return <EmptyBlock message="لا توجد قوالب استيراد لهذا التطبيق حتى الآن." />;
  const actions = ["تحميل القالب", "تعديل Mapping", "اختبار القالب", "رفع ملف", "نسخ", "تعطيل"];
  return (
    <div className="table-scroll rounded-2xl border border-slate-200 bg-white">
      <table className="min-w-[980px] text-right text-sm">
        <thead className="bg-slate-50 text-xs font-black text-slate-500">
          <tr>{["اسم القالب", "نوع الملف", "المشروع", "الأعمدة المطلوبة", "الأعمدة الاختيارية", "آخر استخدام", "الحالة", "إجراءات"].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-4 py-3 font-black">{row.name}</td>
              <td className="px-4 py-3">{row.fileType}</td>
              <td className="px-4 py-3">{row.projectName}</td>
              <td className="px-4 py-3">{row.requiredColumnsCount}</td>
              <td className="px-4 py-3">{row.optionalColumnsCount}</td>
              <td className="px-4 py-3">{row.lastUsedAt}</td>
              <td className="px-4 py-3">{row.status}</td>
              <td className="px-4 py-3"><div className="flex flex-wrap gap-1.5">{actions.map((action) => <ActionButton key={action} label={action} onClick={() => onAction(action, row)} />)}</div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ImportHistoryTable({ rows, onAction }: { rows: ApplicationImportHistoryRow[]; onAction: Handler<ApplicationImportHistoryRow> }) {
  if (!rows.length) return <EmptyBlock message="لا توجد عمليات استيراد لهذا التطبيق حتى الآن." />;
  const actions = ["عرض Preview", "عرض الأخطاء", "اعتماد لو ما زال Preview", "إلغاء", "تصدير الأخطاء"];
  return (
    <div className="table-scroll rounded-2xl border border-slate-200 bg-white">
      <table className="min-w-[1100px] text-right text-sm">
        <thead className="bg-slate-50 text-xs font-black text-slate-500">
          <tr>{["اسم الملف", "نوع الملف", "المشروع", "إجمالي الصفوف", "صفوف صحيحة", "صفوف خطأ", "مناديب غير موجودة", "حسابات غير مربوطة", "الحالة", "تاريخ الإنشاء", "إجراءات"].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-4 py-3 font-black">{row.fileName}</td>
              <td className="px-4 py-3">{row.fileType}</td>
              <td className="px-4 py-3">{row.projectName}</td>
              <td className="px-4 py-3">{row.totalRows}</td>
              <td className="px-4 py-3">{row.validRows}</td>
              <td className="px-4 py-3">{row.invalidRows}</td>
              <td className="px-4 py-3">{row.missingDrivers}</td>
              <td className="px-4 py-3">{row.unlinkedAccounts}</td>
              <td className="px-4 py-3">{row.status}</td>
              <td className="px-4 py-3">{row.createdAt}</td>
              <td className="px-4 py-3"><div className="flex flex-wrap gap-1.5">{actions.map((action) => <ActionButton key={action} label={action} onClick={() => onAction(action, row)} />)}</div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PayrollRunsTable({ rows, onAction }: { rows: ApplicationPayrollRunRow[]; onAction: Handler<ApplicationPayrollRunRow> }) {
  if (!rows.length) return <EmptyBlock message="لا توجد مسيرات مرتبطة بهذا التطبيق حتى الآن." />;
  const actions = ["عرض المسير", "إعادة حساب", "اعتماد", "إلغاء اعتماد", "إرسال للماليات"];
  return (
    <div className="table-scroll rounded-2xl border border-slate-200 bg-white">
      <table className="min-w-[1100px] text-right text-sm">
        <thead className="bg-slate-50 text-xs font-black text-slate-500">
          <tr>{["الشهر", "السنة", "المشروع", "المدينة", "إجمالي المناديب", "إجمالي الطلبات", "إجمالي المستحقات", "إجمالي الخصومات", "الصافي", "الحالة", "تاريخ الاعتماد", "إجراءات"].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-4 py-3">{row.month}</td>
              <td className="px-4 py-3">{row.year}</td>
              <td className="px-4 py-3 font-black">{row.projectName}</td>
              <td className="px-4 py-3">{row.cityName}</td>
              <td className="px-4 py-3">{row.totalDrivers}</td>
              <td className="px-4 py-3">{row.totalOrders}</td>
              <td className="px-4 py-3">{row.totalEarnings}</td>
              <td className="px-4 py-3">{row.totalDeductions}</td>
              <td className="px-4 py-3 font-black">{row.netTotal}</td>
              <td className="px-4 py-3">{row.status}</td>
              <td className="px-4 py-3">{row.approvedAt}</td>
              <td className="px-4 py-3"><div className="flex flex-wrap gap-1.5">{actions.map((action) => <ActionButton key={action} label={action} onClick={() => onAction(action, row)} />)}</div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FinanceSummaryPanel({ summary, rows }: { summary: ApplicationFinanceSummary; rows: ApplicationFinanceEntryRow[] }) {
  const items = [
    ["إجمالي الرواتب المعتمدة", summary.approvedPayrollTotal],
    ["إجمالي الخصومات", summary.totalDeductions],
    ["إجمالي السلف المخصومة", summary.advancesDeducted],
    ["إجمالي إيجارات السيارات", summary.carRentTotal],
    ["صافي المصروفات", summary.netExpenses],
    ["قيود الماليات المرتبطة", `${summary.financeEntriesCount} / ${summary.financeEntriesTotal}`],
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black text-slate-500">{label}</p>
            <strong className="mt-2 block text-lg font-black text-slate-950">{value}</strong>
          </div>
        ))}
      </div>
      {!rows.length ? <EmptyBlock message="لا توجد قيود مالية مرتبطة بهذا التطبيق." /> : (
        <div className="table-scroll rounded-2xl border border-slate-200 bg-white">
          <table className="min-w-[900px] text-right text-sm">
            <thead className="bg-slate-50 text-xs font-black text-slate-500">
              <tr>{["المصدر", "نوع القيد", "المبلغ", "الاتجاه", "الوصف", "التاريخ", "الحالة"].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3">{row.sourceType}</td>
                  <td className="px-4 py-3">{row.entryType}</td>
                  <td className="px-4 py-3 font-black">{row.amount}</td>
                  <td className="px-4 py-3">{row.direction}</td>
                  <td className="px-4 py-3">{row.description}</td>
                  <td className="px-4 py-3">{row.entryDate}</td>
                  <td className="px-4 py-3">{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
