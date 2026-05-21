import Link from "next/link";
import { PageShell } from "./PageShell";
import { ResourceWorkspace } from "./ResourceWorkspace";
import { resources } from "@/lib/resources";
import type { ModuleItem } from "@/lib/modules";

type ModuleMigrationPageProps = {
  module: ModuleItem & { section?: string };
};

export function ModuleMigrationPage({ module }: ModuleMigrationPageProps) {
  const resource = module.resource ? resources[module.resource as keyof typeof resources] : null;

  return (
    <PageShell title={module.label} description={module.description}>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-black text-slate-700">
                {module.section ?? "ERP"}
              </span>
              <span className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-black text-emerald-800">
                صفحة تشغيل مرتبطة
              </span>
              {module.oldKey ? (
                <span className="rounded-md bg-sky-100 px-2 py-1 text-xs font-black text-sky-800">
                  old key: {module.oldKey}
                </span>
              ) : null}
            </div>

            <h3 className="mt-4 text-lg font-black text-slate-950">الصفحة جاهزة داخل الهيكل الجديد</h3>
            <p className="mt-2 text-sm font-semibold leading-7 text-slate-600">
              هذه الصفحة لم تختف من النظام. تم ربطها الآن بمصدر بيانات واضح داخل PostgreSQL، وبها بحث وإضافة وتعديل وحذف
              وتصدير حسب الصلاحيات. أي وظائف تفصيلية من النسخة القديمة ستظهر هنا كأزرار تشغيل منظمة بدلا من كود متداخل يسبب
              تعليق الصفحات.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/imports" className="rounded-md bg-slate-950 px-4 py-2 text-sm font-black text-white">
                فتح الاستيراد
              </Link>
              <Link href="/reports" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-black text-slate-800">
                فتح التقارير
              </Link>
            </div>
          </div>

          {resource ? (
            <div className="space-y-3">
              <h3 className="text-lg font-black text-slate-950">البيانات والإجراءات</h3>
              <ResourceWorkspace resource={resource} />
            </div>
          ) : null}
        </div>

        <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-black text-slate-950">ما تم تفعيله في الصفحة</h3>
          <ol className="mt-4 list-decimal space-y-3 pr-5 text-sm font-semibold leading-7 text-slate-600">
            <li>مسار مستقل لا يرجع للداشبورد بالخطأ.</li>
            <li>جدول بيانات مرتبط بموديل Prisma/API.</li>
            <li>أزرار عرض وتعديل وحذف وإضافة.</li>
            <li>بحث وتحديث وتصدير CSV.</li>
            <li>رسائل تحميل وفراغ وخطأ واضحة.</li>
          </ol>
        </aside>
      </div>
    </PageShell>
  );
}
