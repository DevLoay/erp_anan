import Link from "next/link";
import { databaseOfflineMessage } from "@/lib/imports/templates";
import { getTemplateConfigs } from "@/lib/templates/templateConfig";

export const dynamic = "force-dynamic";

function Flag({ active, label }: { active: boolean; label: string }) {
  return (
    <span className={`rounded-full px-2 py-1 text-[11px] font-black ${active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
      {label}
    </span>
  );
}

export default async function TemplateManagerPage() {
  try {
    const templates = await getTemplateConfigs({ includeDisabled: true });
    return (
      <main className="w-full max-w-none space-y-5 bg-slate-50 p-4" dir="rtl">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <nav className="mb-2 flex flex-wrap items-center gap-2 text-xs font-black text-slate-500">
            <Link href="/" className="hover:text-slate-950">الرئيسية</Link>
            <span>/</span>
            <Link href="/settings" className="hover:text-slate-950">الإعدادات</Link>
            <span>/</span>
            <span className="text-slate-800">Template Manager</span>
          </nav>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-black text-slate-950">إدارة قوالب الاستيراد</h1>
              <p className="mt-2 max-w-4xl text-sm font-bold leading-7 text-slate-600">
                التحكم في ظهور القوالب حسب المشروع والصفحة، وربطها بالمسير والفواتير والتقارير بدون إظهار قوالب Keeta في الاستيراد العام.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/projects?application=keeta" className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-black text-white">قوالب Keeta</Link>
              <Link href="/imports" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700">الاستيراد العام</Link>
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-black text-slate-500">إجمالي القوالب</p>
            <strong className="mt-1 block text-2xl font-black">{templates.length}</strong>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 shadow-sm">
            <p className="text-xs font-black">قوالب نشطة</p>
            <strong className="mt-1 block text-2xl font-black">{templates.filter((item) => item.enabled).length}</strong>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800 shadow-sm">
            <p className="text-xs font-black">قوالب Keeta</p>
            <strong className="mt-1 block text-2xl font-black">{templates.filter((item) => item.projectId === "keeta").length}</strong>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-800 shadow-sm">
            <p className="text-xs font-black">تؤثر على المسير</p>
            <strong className="mt-1 block text-2xl font-black">{templates.filter((item) => item.affectsPayroll).length}</strong>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-[1200px] w-full text-right text-sm">
            <thead className="bg-slate-100 text-xs font-black text-slate-600">
              <tr>
                {["القالب", "Project", "Import Type", "Global", "Project Imports", "Invoices", "Payroll", "Reports", "Management", "Application Center", "Effects", "Route"].map((head) => (
                  <th key={head} className="px-4 py-3">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {templates.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3">
                    <strong className="block text-slate-950">{item.nameAr}</strong>
                    <span className="text-xs text-slate-500">{item.nameEn}</span>
                  </td>
                  <td className="px-4 py-3">{item.projectId || item.applicationProject?.name || "-"}</td>
                  <td className="px-4 py-3 font-mono text-xs">{item.importType}</td>
                  <td className="px-4 py-3"><Flag active={item.showInGlobalImports} label={item.showInGlobalImports ? "ظاهر" : "مخفي"} /></td>
                  <td className="px-4 py-3"><Flag active={item.showInProjectImports} label={item.showInProjectImports ? "ظاهر" : "مخفي"} /></td>
                  <td className="px-4 py-3"><Flag active={item.showInInvoices} label={item.showInInvoices ? "ظاهر" : "مخفي"} /></td>
                  <td className="px-4 py-3"><Flag active={item.showInPayroll} label={item.showInPayroll ? "ظاهر" : "مخفي"} /></td>
                  <td className="px-4 py-3"><Flag active={item.showInReports} label={item.showInReports ? "ظاهر" : "مخفي"} /></td>
                  <td className="px-4 py-3"><Flag active={item.showInManagementReports} label={item.showInManagementReports ? "ظاهر" : "مخفي"} /></td>
                  <td className="px-4 py-3"><Flag active={item.showInApplicationCenter} label={item.showInApplicationCenter ? "ظاهر" : "مخفي"} /></td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <Flag active={item.affectsPayroll} label="Payroll" />
                      <Flag active={item.affectsInvoices} label="Invoices" />
                      <Flag active={item.affectsReports} label="Reports" />
                      <Flag active={item.affectsRank} label="Rank" />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {item.route ? <Link href={item.route} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-black">فتح</Link> : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    );
  } catch (error) {
    const offline = databaseOfflineMessage(error);
    return (
      <main className="w-full max-w-none bg-slate-50 p-4" dir="rtl">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900 shadow-sm">
          <h1 className="text-2xl font-black">قاعدة البيانات غير متصلة</h1>
          <p className="mt-2 text-sm font-bold">{offline || (error instanceof Error ? error.message : "تعذر تحميل قوالب الاستيراد.")}</p>
        </div>
      </main>
    );
  }
}
