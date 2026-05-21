import Link from "next/link";
import { PageAnalyticsSection } from "@/components/analytics/PageAnalyticsSection";
import { SettingsRulesPanel } from "@/components/settings/SettingsRulesPanel";
import { ResourceWorkspace } from "@/components/ui/ResourceWorkspace";
import { PageShell } from "@/components/ui/PageShell";
import { getPageAnalytics } from "@/lib/page-analytics";
import { getSystemRules } from "@/lib/reporting";
import { resources } from "@/lib/resources";

const roles = [
  ["ADMIN", "تحكم كامل في النظام والإعدادات والماليات."],
  ["OPERATION_MANAGER", "إدارة التشغيل والتقارير والمهام والتنبيهات."],
  ["SUPERVISOR", "مناديب ومهام وتنبيهات ضمن نطاق المشرف."],
  ["ACCOUNTANT", "الرواتب والسلف والخصومات والماليات."],
  ["HR", "بيانات المناديب والموارد البشرية والمستندات."],
  ["VIEWER", "قراءة فقط بدون تعديل."],
];

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [rules, analytics] = await Promise.all([getSystemRules(), getPageAnalytics("settings")]);

  return (
    <PageShell
      title="إعدادات البرنامج"
      description="نقطة التحكم في المستخدمين، الأدوار، إعدادات النظام، قواعد KPI، وإعدادات مسير الرواتب."
    >
      <PageAnalyticsSection analytics={analytics} />

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-black text-slate-950">الأدوار الأساسية</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {roles.map(([role, description]) => (
            <div key={role} className="rounded-md border border-slate-200 p-4">
              <strong className="block text-sm font-black text-slate-900">{role}</strong>
              <p className="mt-1 text-sm font-semibold text-slate-600">{description}</p>
            </div>
          ))}
        </div>
      </div>

      <SettingsRulesPanel initialRules={{ kpiTargets: rules.kpiTargets, payrollRules: rules.payrollRules }} />

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-sm" id="payroll">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-black text-amber-950">إعدادات مسير الرواتب لكل تطبيق ومشروع</h3>
            <p className="mt-1 text-sm font-bold text-amber-800">إدارة Level A/B/C والبونص والخصومات وإيجار السيارة من صفحة إعدادات المسير الجديدة.</p>
          </div>
          <Link href="/settings/payroll" className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-black text-white">
            فتح إعدادات المسير
          </Link>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-black text-slate-950">المستخدمون والصلاحيات</h2>
        <ResourceWorkspace resource={resources.users} compact />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-black text-slate-950">سجلات إعدادات النظام</h2>
        <ResourceWorkspace resource={resources["system-settings"]} compact />
      </section>
    </PageShell>
  );
}
