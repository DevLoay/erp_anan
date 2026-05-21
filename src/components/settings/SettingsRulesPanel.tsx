"use client";

import { useMemo, useState } from "react";
import type { KpiRules } from "@/lib/reporting";

type RulesPayload = {
  kpiTargets: {
    default: KpiRules;
    projects: Record<string, KpiRules>;
  };
  payrollRules: Record<string, unknown>;
};

type SettingsRulesPanelProps = {
  initialRules: RulesPayload;
};

const kpiFields: { key: keyof KpiRules; label: string; suffix: string }[] = [
  { key: "monthlyOrders", label: "التارجت الشهري للطلبات", suffix: "طلب" },
  { key: "dailyOrders", label: "التارجت اليومي", suffix: "طلب" },
  { key: "workingHours", label: "ساعات العمل المطلوبة", suffix: "ساعة" },
  { key: "onTimeRate", label: "أقل On-Time %", suffix: "%" },
  { key: "maxCancellationRate", label: "أقصى Cancellation %", suffix: "%" },
  { key: "maxRejectionRate", label: "أقصى Rejection %", suffix: "%" },
  { key: "minActiveDays", label: "أقل أيام نشاط", suffix: "يوم" },
];

const payrollFields = [
  { key: "basicSalary", label: "الراتب الأساسي", suffix: "ر.س" },
  { key: "targetBonus", label: "مكافأة تحقيق التارجت", suffix: "ر.س" },
  { key: "extraOrderBonus", label: "مكافأة الطلب الإضافي", suffix: "ر.س" },
  { key: "vehicleRentDeduction", label: "خصم إيجار السيارة", suffix: "ر.س" },
  { key: "housingDeduction", label: "خصم السكن", suffix: "ر.س" },
];

function numberValue(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function SettingsRulesPanel({ initialRules }: SettingsRulesPanelProps) {
  const [kpiTargets, setKpiTargets] = useState(initialRules.kpiTargets);
  const [payrollRules, setPayrollRules] = useState(initialRules.payrollRules);
  const [selectedApp, setSelectedApp] = useState(Object.keys(initialRules.kpiTargets.projects)[0] ?? "Keeta");
  const [newProject, setNewProject] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const appNames = useMemo(() => Object.keys(kpiTargets.projects), [kpiTargets.projects]);
  const currentRules = kpiTargets.projects[selectedApp] ?? kpiTargets.default;

  function updateKpiField(key: keyof KpiRules, value: string) {
    setKpiTargets((prev) => ({
      ...prev,
      projects: {
        ...prev.projects,
        [selectedApp]: {
          ...(prev.projects[selectedApp] ?? prev.default),
          [key]: Number(value),
        },
      },
    }));
  }

  function addProject() {
    const name = newProject.trim();
    if (!name) return;
    setKpiTargets((prev) => ({
      ...prev,
      projects: {
        ...prev.projects,
        [name]: prev.default,
      },
    }));
    setSelectedApp(name);
    setNewProject("");
  }

  async function saveRules() {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/settings/rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kpiTargets, payrollRules }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "تعذر حفظ الإعدادات");
      setMessage("تم حفظ إعدادات التارجت والمسير بنجاح.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حفظ الإعدادات");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section id="rules" className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-950">إعدادات التارجت والمسير</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            هذه القواعد تغذي KPI المناديب، التقارير، ترتيب المدن، وتنبيهات المسير.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void saveRules()}
          disabled={saving}
          className="rounded-md bg-slate-950 px-4 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "جاري الحفظ..." : "حفظ الإعدادات"}
        </button>
      </div>

      {message ? <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{message}</div> : null}
      {error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">{error}</div> : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-end">
            <label htmlFor="kpi-project" className="grid flex-1 gap-1 text-sm font-bold text-slate-700">
              التطبيق / المشروع
              <select
                id="kpi-project"
                value={selectedApp}
                onChange={(event) => setSelectedApp(event.target.value)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2"
              >
                {appNames.map((appName) => (
                  <option key={appName} value={appName}>
                    {appName}
                  </option>
                ))}
              </select>
            </label>

            <label htmlFor="new-project" className="grid flex-1 gap-1 text-sm font-bold text-slate-700">
              مشروع مستقبلي
              <input
                id="new-project"
                value={newProject}
                onChange={(event) => setNewProject(event.target.value)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2"
                placeholder="مثال: Jahez"
              />
            </label>

            <button type="button" onClick={addProject} className="rounded-md border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-black text-sky-700">
              إضافة مشروع
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {kpiFields.map((field) => (
              <label key={field.key} htmlFor={`kpi-${field.key}`} className="grid gap-1 text-sm font-bold text-slate-700">
                {field.label}
                <div className="flex overflow-hidden rounded-md border border-slate-300 bg-white">
                  <input
                    id={`kpi-${field.key}`}
                    type="number"
                    step="0.01"
                    value={currentRules[field.key]}
                    onChange={(event) => updateKpiField(field.key, event.target.value)}
                    className="min-w-0 flex-1 px-3 py-2 outline-none"
                  />
                  <span className="border-r border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-500">{field.suffix}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-base font-black text-slate-950">قواعد المسير</h3>
          <div className="mt-4 grid gap-3">
            {payrollFields.map((field) => (
              <label key={field.key} htmlFor={`payroll-${field.key}`} className="grid gap-1 text-sm font-bold text-slate-700">
                {field.label}
                <div className="flex overflow-hidden rounded-md border border-slate-300 bg-white">
                  <input
                    id={`payroll-${field.key}`}
                    type="number"
                    step="0.01"
                    value={numberValue(payrollRules[field.key])}
                    onChange={(event) => setPayrollRules((prev) => ({ ...prev, [field.key]: Number(event.target.value) }))}
                    className="min-w-0 flex-1 px-3 py-2 outline-none"
                  />
                  <span className="border-r border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-500">{field.suffix}</span>
                </div>
              </label>
            ))}

            <label htmlFor="lock-after-approval" className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700">
              قفل المسير بعد الاعتماد
              <select
                id="lock-after-approval"
                value={String(Boolean(payrollRules.lockAfterApproval))}
                onChange={(event) => setPayrollRules((prev) => ({ ...prev, lockAfterApproval: event.target.value === "true" }))}
                className="rounded-md border border-slate-300 px-3 py-1"
              >
                <option value="true">نعم</option>
                <option value="false">لا</option>
              </select>
            </label>
          </div>
        </div>
      </div>
    </section>
  );
}
