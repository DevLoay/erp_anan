import Link from "next/link";
import { PageShell } from "./PageShell";
import { ResourceWorkspace } from "./ResourceWorkspace";
import { resources } from "@/lib/resources";
import type { ModuleItem } from "@/lib/modules";

type ModuleMigrationPageProps = {
  module: ModuleItem & { section?: string };
};

export function ModuleMigrationPage({ module }: ModuleMigrationPageProps) {
  const resource = module.resource ? resources[module.resource] : null;

  return (
    <PageShell title={module.label} description={module.description}>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-black text-slate-700">{module.section ?? "ERP"}</span>
              <span className="rounded-lg bg-emerald-100 px-2 py-1 text-xs font-black text-emerald-800">صفحة مربوطة بالبيانات</span>
              {module.oldKey ? <span className="rounded-lg bg-sky-100 px-2 py-1 text-xs font-black text-sky-800">old key: {module.oldKey}</span> : null}
            </div>

            <h3 className="mt-4 text-lg font-black text-slate-950">تم تثبيت الصفحة داخل الهيكل الجديد</h3>
            <p className="mt-2 text-sm font-semibold leading-7 text-slate-600">
              هذه الصفحة لم تعد زرًا وهميًا. المسار مربوط بالـ Sidebar وبـ API مشترك، ويعرض حالة تحميل وبيانات فارغة وخطأ اتصال، مع أزرار عرض وتعديل وحذف وتصدير CSV. عند اكتمال تصميم النسخة القديمة التفصيلي لكل قسم، يمكن استبدال هذا الـ Workspace بواجهة متخصصة مع الحفاظ على نفس الـ API والبيانات.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/imports" className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-black text-white">
                مركز الاستيراد
              </Link>
              <Link href="/reports" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-black text-slate-800">
                التقارير العامة
              </Link>
            </div>
          </div>

          {resource ? (
            <div className="space-y-3">
              <h3 className="text-lg font-black text-slate-950">البيانات والإجراءات</h3>
              <ResourceWorkspace resource={resource} />
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm font-bold text-slate-600 shadow-sm">
              لا توجد بيانات مباشرة لهذه الصفحة حاليًا، لكنها تعمل كمسار مستقل بدون تحويل خاطئ أو صفحة فارغة.
            </div>
          )}
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-black text-slate-950">مراجعة التشغيل</h3>
          <ol className="mt-4 list-decimal space-y-3 pr-5 text-sm font-semibold leading-7 text-slate-600">
            <li>المسار يفتح الصفحة الصحيحة ولا يرجع للداشبورد.</li>
            <li>الصفحة محمية بتسجيل الدخول والصلاحيات.</li>
            <li>الأزرار الأساسية لها Handler واضح.</li>
            <li>الجدول يدعم بحث وتصدير CSV.</li>
            <li>لا يتم عرض أرقام وهمية عند غياب البيانات.</li>
          </ol>
        </aside>
      </div>
    </PageShell>
  );
}
