import Link from "next/link";
import { getPermissionsPageData, resolvePermissionsFilters } from "@/lib/accessControlPage";
import { appRoles, roleLabels, type AppRole } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function numberText(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function Badge({ children, tone }: { children: React.ReactNode; tone: "green" | "red" | "amber" | "blue" | "slate" }) {
  const klass = {
    green: "bg-emerald-100 text-emerald-800",
    red: "bg-red-100 text-red-800",
    amber: "bg-amber-100 text-amber-800",
    blue: "bg-blue-100 text-blue-800",
    slate: "bg-slate-100 text-slate-700",
  }[tone];
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${klass}`}>{children}</span>;
}

function PermissionBadge({ enabled, label }: { enabled: boolean; label: string }) {
  return <Badge tone={enabled ? "green" : "slate"}>{enabled ? label : "-"}</Badge>;
}

function SummaryCard({ title, value, note }: { title: string; value: number; note: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-bold text-slate-500">{title}</p>
      <strong className="mt-2 block text-3xl font-black text-slate-950">{numberText(value)}</strong>
      <p className="mt-2 text-xs font-bold text-slate-500">{note}</p>
    </div>
  );
}

function rolePermissionSummary(role: AppRole) {
  if (role === "ADMIN") return "صلاحية كاملة على كل المدن والمشاريع والإعدادات والاعتمادات.";
  if (role === "OPERATION_MANAGER") return "تشغيل وتقارير ومشاريع بدون صلاحيات الإدارة الحساسة.";
  if (role === "SUPERVISOR") return "مناديب الفريق، الحضور، المهام، والتنبيهات داخل نطاقه.";
  if (role === "ACCOUNTANT") return "الماليات، الفواتير، المسير، السلف والخصومات.";
  if (role === "HR") return "المناديب، HR، العقود، المستندات، والسكن.";
  return "عرض فقط بدون تعديل.";
}

export default async function PermissionsPage({ searchParams }: PageProps) {
  const filters = resolvePermissionsFilters(await searchParams);
  const data = await getPermissionsPageData(filters);

  return (
    <main className="min-h-screen bg-slate-50 text-right" dir="rtl">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
        <Link href="/settings" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800 shadow-sm hover:bg-slate-50">
          رجوع
        </Link>
        <div>
          <h1 className="text-3xl font-black text-slate-950">إدارة الصلاحيات</h1>
          <p className="mt-1 text-sm font-bold text-slate-500">مراجعة الأدوار ونطاق المدن والمشاريع وتطبيق الصلاحيات على الواجهة والـ API.</p>
        </div>
      </header>

      <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <Link href="/users" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-emerald-700">
              إدارة المستخدمين
            </Link>
            <Link href="/audit-log" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800 shadow-sm hover:bg-slate-50">
              سجل العمليات
            </Link>
            <Link href="/settings/templates" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-black text-amber-800 shadow-sm hover:bg-amber-100">
              إعدادات القوالب
            </Link>
            <Link href="/permissions" className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-black text-blue-800 shadow-sm hover:bg-blue-100">
              تحديث البيانات
            </Link>
          </div>

          <form action="/permissions" className="grid min-w-[640px] flex-1 grid-cols-1 gap-3 md:grid-cols-4">
            <label className="text-xs font-black text-slate-800">
              بحث
              <input name="q" defaultValue={data.filters.q} placeholder="موديول / مورد / مسار" className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold" />
            </label>
            <label className="text-xs font-black text-slate-800">
              القسم
              <select name="section" defaultValue={data.filters.section} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
                <option value="">كل الأقسام</option>
                {data.sections.map((section) => (
                  <option key={section} value={section}>
                    {section}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-black text-slate-800">
              الدور
              <select name="role" defaultValue={data.filters.role} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
                <option value="">كل الأدوار</option>
                {appRoles.map((role) => (
                  <option key={role} value={role}>
                    {roleLabels[role]}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end gap-2">
              <button type="submit" className="h-10 flex-1 rounded-xl bg-slate-900 px-4 text-sm font-black text-white shadow-sm">
                تطبيق
              </button>
              <Link href="/permissions" className="grid h-10 flex-1 place-items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-800 shadow-sm">
                عرض الكل
              </Link>
            </div>
          </form>
        </div>
      </section>

      {data.databaseStatus === "offline" ? (
        <section className="mb-4 rounded-2xl border border-red-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black text-red-700">قاعدة البيانات غير متصلة</h2>
          <p className="mt-2 text-sm font-bold text-slate-600">سيتم عرض مصفوفة الصلاحيات الثابتة فقط. شغّل PostgreSQL ثم حدّث الصفحة لقراءة المستخدمين والنطاقات.</p>
          <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">{data.databaseMessage}</p>
        </section>
      ) : null}

      <section className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <SummaryCard title="المستخدمون" value={data.summary.users} note="كل حسابات الدخول" />
        <SummaryCard title="النشطون" value={data.summary.activeUsers} note="حسابات مفعلة" />
        <SummaryCard title="لهم نطاق" value={data.summary.scopedUsers} note="مدينة / مشرف / مندوب / مشروع" />
        <SummaryCard title="بدون نطاق" value={data.summary.usersWithoutScope} note="تحتاج مراجعة صلاحية" />
        <SummaryCard title="مشرفون بلا مستخدم" value={data.summary.supervisorsWithoutUser} note="يحتاجون حساب دخول" />
        <SummaryCard title="Audit Logs" value={data.summary.auditLogs} note="عمليات مسجلة" />
      </section>

      <section className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {data.roles.map((role) => (
          <div key={role.value} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <Badge tone={role.value === "ADMIN" ? "red" : role.value === "VIEWER" ? "slate" : "blue"}>{role.value}</Badge>
              <div>
                <h2 className="text-xl font-black text-slate-950">{role.label}</h2>
                <p className="mt-1 text-xs font-bold text-slate-500">{rolePermissionSummary(role.value)}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-bold text-slate-500">المستخدمون</p>
                <strong className="text-xl font-black text-slate-950">{numberText(role.users)}</strong>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3">
                <p className="text-xs font-bold text-emerald-700">نشط</p>
                <strong className="text-xl font-black text-emerald-900">{numberText(role.activeUsers)}</strong>
              </div>
              <div className="rounded-xl bg-blue-50 p-3">
                <p className="text-xs font-bold text-blue-700">له نطاق</p>
                <strong className="text-xl font-black text-blue-900">{numberText(role.scopedUsers)}</strong>
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-black text-slate-950">مصفوفة الصلاحيات حسب الموديول</h2>
          <div className="flex gap-2">
            <Badge tone="green">قراءة / تعديل مسموح</Badge>
            <Badge tone="amber">اعتماد محدود</Badge>
            <Badge tone="red">Admin فقط</Badge>
          </div>
        </div>

        {data.modules.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1500px] border-separate border-spacing-0 text-right text-sm">
              <thead>
                <tr className="bg-slate-100 text-xs font-black text-slate-600">
                  <th className="rounded-r-xl px-3 py-3">القسم</th>
                  <th className="px-3 py-3">الموديول</th>
                  <th className="px-3 py-3">المورد</th>
                  <th className="px-3 py-3">المسار</th>
                  <th className="px-3 py-3">الحماية</th>
                  {appRoles.map((role) => (
                    <th key={role} className="px-3 py-3">
                      {roleLabels[role]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.modules.map((module) => (
                  <tr key={module.resource} className="align-top">
                    <td className="border-b border-slate-100 px-3 py-3 font-bold text-slate-600">{module.section}</td>
                    <td className="border-b border-slate-100 px-3 py-3 font-black text-slate-950">{module.label}</td>
                    <td className="border-b border-slate-100 px-3 py-3 font-bold text-slate-700" dir="ltr">{module.resource}</td>
                    <td className="border-b border-slate-100 px-3 py-3">
                      <Link href={module.route} className="font-bold text-blue-700 hover:underline" dir="ltr">
                        {module.route}
                      </Link>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3">{module.adminOnly ? <Badge tone="red">Admin فقط</Badge> : <Badge tone="blue">حسب الدور</Badge>}</td>
                    {appRoles.map((role) => {
                      const state = module.roles[role];
                      return (
                        <td key={`${module.resource}-${role}`} className="border-b border-slate-100 px-3 py-3">
                          <div className="flex flex-wrap gap-1">
                            <PermissionBadge enabled={state.read} label="قراءة" />
                            <PermissionBadge enabled={state.write} label="تعديل" />
                            {state.approve ? <Badge tone="amber">اعتماد</Badge> : null}
                            {state.delete ? <Badge tone="red">حذف</Badge> : null}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm font-bold text-slate-500">
            لا توجد موديولات مطابقة للفلاتر الحالية.
          </div>
        )}
      </section>
    </main>
  );
}
