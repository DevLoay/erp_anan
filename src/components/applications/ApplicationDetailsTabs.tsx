"use client";

import { useState } from "react";
import { ApplicationAccountsTable } from "./ApplicationAccountsTable";
import { ApplicationProjectsTable } from "./ApplicationProjectsTable";
import {
  FinanceSummaryPanel,
  ImportHistoryTable,
  ImportTemplatesTable,
  InvoiceSettingsTable,
  PayrollRunsTable,
  PayrollSettingsTable,
  RankSettingsTable,
} from "./ApplicationSettingsTables";
import type { ApplicationCenterApp } from "@/lib/applications/getApplicationDetails";

export type ApplicationDetailsTab =
  | "overview"
  | "projects"
  | "accounts"
  | "invoice"
  | "rank"
  | "payroll-settings"
  | "templates"
  | "imports"
  | "payroll-runs"
  | "finance";

type Props = {
  app: ApplicationCenterApp;
  initialTab?: ApplicationDetailsTab;
  onClose: () => void;
  onAction: (action: string, payload?: unknown) => void;
};

const tabs: { key: ApplicationDetailsTab; label: string }[] = [
  { key: "overview", label: "نظرة عامة" },
  { key: "projects", label: "المشاريع" },
  { key: "accounts", label: "حسابات التطبيق" },
  { key: "invoice", label: "إعدادات الفاتورة" },
  { key: "rank", label: "إعدادات الرانك" },
  { key: "payroll-settings", label: "إعدادات المسير" },
  { key: "templates", label: "قوالب الاستيراد" },
  { key: "imports", label: "سجل الاستيراد" },
  { key: "payroll-runs", label: "مسيرات الرواتب" },
  { key: "finance", label: "الملخص المالي" },
];

function OverviewMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-black text-slate-500">{label}</p>
      <strong className="mt-2 block text-lg font-black text-slate-950">{value}</strong>
    </div>
  );
}

export function ApplicationDetailsTabs({ app, initialTab = "overview", onClose, onAction }: Props) {
  const [activeTab, setActiveTab] = useState<ApplicationDetailsTab>(initialTab);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-3">
      <div className="flex max-h-[92vh] w-full max-w-[1500px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" dir="rtl">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-black text-blue-700">مركز التطبيقات</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">{app.name}</h2>
            <p className="mt-1 text-sm font-bold text-slate-500">{app.description}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-700 hover:bg-slate-50">
            إغلاق
          </button>
        </div>

        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-black transition ${
                  activeTab === tab.key ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-5">
          {activeTab === "overview" ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <OverviewMetric label="كود التطبيق" value={app.code} />
                <OverviewMetric label="الحالة" value={app.status} />
                <OverviewMetric label="المشاريع" value={app.projectsCount} />
                <OverviewMetric label="الحسابات" value={app.accountsCount} />
                <OverviewMetric label="حسابات فارغة" value={app.unlinkedAccounts} />
                <OverviewMetric label="إجمالي الطلبات" value={app.totalOrders} />
                <OverviewMetric label="إجمالي التحصيل" value={app.totalCollection} />
                <OverviewMetric label="آخر استيراد" value={app.lastImport} />
                <OverviewMetric label="آخر مسير معتمد" value={app.payrollRunRows.find((row) => row.approvedAt !== "-")?.approvedAt ?? "-"} />
              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <h3 className="text-sm font-black text-blue-950">تحليل التطبيق</h3>
                <p className="mt-2 text-sm font-bold leading-7 text-blue-800">{app.insight}</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-black text-slate-950">تنبيهات التطبيق</h3>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {app.unlinkedAccounts > 0 ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">يوجد {app.unlinkedAccounts} حسابات غير مربوطة بمناديب.</div> : null}
                  {app.projectsCount === 0 ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-600">لا توجد مشاريع مرتبطة بهذا التطبيق.</div> : null}
                  {app.importedReports === 0 ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-600">لا توجد عمليات استيراد محفوظة.</div> : null}
                  {app.unlinkedAccounts === 0 && app.projectsCount > 0 && app.importedReports > 0 ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">لا توجد تنبيهات حرجة حاليًا.</div> : null}
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === "projects" ? <ApplicationProjectsTable rows={app.projects} onAction={onAction} /> : null}
          {activeTab === "accounts" ? <ApplicationAccountsTable rows={app.accounts} onAction={onAction} /> : null}
          {activeTab === "invoice" ? <InvoiceSettingsTable rows={app.invoiceSettings} onAction={onAction} /> : null}
          {activeTab === "rank" ? <RankSettingsTable rows={app.rankSettings} onAction={onAction} isKeeta={app.key === "keeta"} /> : null}
          {activeTab === "payroll-settings" ? <PayrollSettingsTable rows={app.payrollSettings} onAction={onAction} /> : null}
          {activeTab === "templates" ? <ImportTemplatesTable rows={app.importTemplates} onAction={onAction} /> : null}
          {activeTab === "imports" ? <ImportHistoryTable rows={app.importHistory} onAction={onAction} /> : null}
          {activeTab === "payroll-runs" ? <PayrollRunsTable rows={app.payrollRunRows} onAction={onAction} /> : null}
          {activeTab === "finance" ? <FinanceSummaryPanel summary={app.financeSummary} rows={app.financeEntries} /> : null}
        </div>
      </div>
    </div>
  );
}
