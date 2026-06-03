"use client";

import { recordStatusText, statusTone } from "@/lib/applications/applicationAnalytics";
import { applicationCardActions } from "@/lib/applications/applicationActions";
import type { ApplicationCenterApp } from "@/lib/applications/getApplicationDetails";

type ApplicationCardProps = {
  app: ApplicationCenterApp;
  onAction: (action: string, app: ApplicationCenterApp) => void;
};

const toneClass = {
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  red: "bg-red-50 text-red-700 border-red-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  slate: "bg-slate-50 text-slate-700 border-slate-200",
};

function uniqueCount(values: string[]) {
  return new Set(values.map((value) => value.trim()).filter(Boolean)).size;
}

function MiniMetric({ label, value, tone = "slate" }: { label: string; value: string | number; tone?: keyof typeof toneClass }) {
  return (
    <div className={`rounded-xl border px-3 py-2 ${toneClass[tone]}`}>
      <p className="text-[11px] font-black opacity-75">{label}</p>
      <strong className="mt-1 block text-sm font-black">{value}</strong>
    </div>
  );
}

export function ApplicationCard({ app, onAction }: ApplicationCardProps) {
  const tone = toneClass[statusTone(app.status)];
  const isKeeta = app.key === "keeta" || app.code.toLowerCase() === "keeta";
  const visibleActions = applicationCardActions.filter((action) => action !== "Rank Keeta" || isKeeta);
  const cityCoverage = uniqueCount([
    ...app.projects.map((project) => project.cityName),
    ...app.accounts.map((account) => account.cityName),
  ]);
  const linkedAccounts = Math.max(app.accountsCount - app.unlinkedAccounts, 0);
  const hasOperationalData =
    app.projectsCount > 0 ||
    app.linkedDrivers > 0 ||
    app.accountsCount > 0 ||
    app.importedReports > 0 ||
    app.totalOrders > 0 ||
    app.payrollRuns > 0;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-black text-slate-950">{app.name}</h3>
            <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${tone}`}>{recordStatusText(app.status)}</span>
          </div>
          <p className="mt-1 text-xs font-bold text-slate-500">{app.code}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600">
          {app.source === "database" ? "مسجل" : app.source === "legacy" ? "من البيانات الحالية" : "جاهز للإعداد"}
        </span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        <MiniMetric label="الحالة" value={recordStatusText(app.status)} tone={hasOperationalData ? "emerald" : "slate"} />
        <MiniMetric label="مدن التغطية" value={cityCoverage} tone="blue" />
        <MiniMetric label="مناديب" value={app.linkedDrivers} />
        <MiniMetric label="حسابات فارغة" value={app.unlinkedAccounts} tone={app.unlinkedAccounts ? "amber" : "emerald"} />
        <MiniMetric label="حسابات مرتبطة" value={linkedAccounts} tone={linkedAccounts ? "emerald" : "slate"} />
        <MiniMetric label="آخر تحديث" value={app.lastImport} />
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <MiniMetric label="المشاريع" value={app.projectsCount} />
        <MiniMetric label="تقارير مستوردة" value={app.importedReports} />
        <MiniMetric label="إجمالي الطلبات" value={app.totalOrders} tone={app.totalOrders ? "emerald" : "slate"} />
        <MiniMetric label="إجمالي التحصيل" value={app.totalCollection} tone="blue" />
        <MiniMetric label="المسيرات" value={app.payrollRuns} />
        <MiniMetric label="مسيرات معتمدة" value={app.approvedPayrolls} tone={app.approvedPayrolls ? "emerald" : "slate"} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {visibleActions.map((action) => (
          <button
            key={action}
            type="button"
            onClick={() => onAction(action, app)}
            className={
              action === "استيراد تقرير"
                ? "rounded-lg bg-amber-500 px-3 py-2 text-xs font-black text-white shadow-sm transition hover:bg-amber-600"
                : "rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            }
          >
            {action}
          </button>
        ))}
      </div>
    </article>
  );
}
