"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { normalizeBonusRules, normalizeCarRentRule, normalizeDeductionRules, type SalaryCalculationResult } from "@/lib/payroll/calculateSalary";
import { normalizeLevelRules } from "@/lib/payroll/levels";
import type { PayrollSettingsData, PayrollSettingRow } from "@/lib/payroll/payrollSettings";

type Props = {
  data: PayrollSettingsData;
  basePath?: string;
  scopeTitle?: string;
};

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-5 left-5 z-[90] flex max-w-sm items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-800 shadow-2xl">
      <span>{message}</span>
      <button type="button" onClick={onClose} className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
        إغلاق
      </button>
    </div>
  );
}

function MetricCard({ title, value, tone = "slate" }: { title: string; value: string | number; tone?: "slate" | "emerald" | "amber" | "blue" | "red" }) {
  const toneClass = {
    slate: "border-slate-200 bg-white text-slate-950",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
    red: "border-red-200 bg-red-50 text-red-800",
  };
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${toneClass[tone]}`}>
      <p className="text-xs font-black opacity-70">{title}</p>
      <strong className="mt-1 block text-2xl font-black">{value}</strong>
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/55 p-4">
      <div className="max-h-[92vh] w-full max-w-6xl overflow-auto rounded-2xl bg-white p-5 shadow-2xl" dir="rtl">
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <h3 className="text-xl font-black text-slate-950">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-black text-slate-700">
            إغلاق
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function numeric(form: FormData, key: string) {
  const value = Number(form.get(key) ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function text(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

function checkbox(form: FormData, key: string) {
  return form.has(key);
}

function buildPayload(form: FormData) {
  const levelRules = {
    A: {
      minimumOrders: numeric(form, "A_minimumOrders"),
      minimumOnTime: numeric(form, "A_minimumOnTime"),
      maxCancellation: numeric(form, "A_maxCancellation"),
      maxRejection: numeric(form, "A_maxRejection"),
      basicSalary: numeric(form, "A_basicSalary"),
      extraOrderPrice: numeric(form, "A_extraOrderPrice"),
      performanceBonus: numeric(form, "A_performanceBonus"),
    },
    B: {
      minimumOrders: numeric(form, "B_minimumOrders"),
      minimumOnTime: numeric(form, "B_minimumOnTime"),
      maxCancellation: numeric(form, "B_maxCancellation"),
      maxRejection: numeric(form, "B_maxRejection"),
      basicSalary: numeric(form, "B_basicSalary"),
      extraOrderPrice: numeric(form, "B_extraOrderPrice"),
      performanceBonus: numeric(form, "B_performanceBonus"),
    },
    C: {
      minimumOrders: numeric(form, "C_minimumOrders"),
      minimumOnTime: numeric(form, "C_minimumOnTime"),
      maxCancellation: numeric(form, "C_maxCancellation"),
      maxRejection: numeric(form, "C_maxRejection"),
      basicSalary: numeric(form, "C_basicSalary"),
      extraOrderPrice: numeric(form, "C_extraOrderPrice"),
      performanceBonus: numeric(form, "C_performanceBonus"),
    },
    meta: {
      contractType: text(form, "contractType"),
      minimumWorkingDays: numeric(form, "minimumWorkingDays"),
      minimumWorkingHoursPerDay: numeric(form, "minimumWorkingHoursPerDay"),
    },
  };

  const bonusRules = {
    extraOrdersBonus: checkbox(form, "extraOrdersBonus"),
    performanceBonus: checkbox(form, "performanceBonus"),
    targetAchievementBonus: numeric(form, "targetAchievementBonus"),
    noCancellationBonus: numeric(form, "noCancellationBonus"),
    highOnTimeBonus: numeric(form, "highOnTimeBonus"),
    customBonuses: text(form, "customBonuses")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, amount] = line.split(":");
        return { name: name?.trim() || "Custom Bonus", amount: Number(amount ?? 0) || 0 };
      }),
  };

  const deductionRules = {
    appDeductions: checkbox(form, "appDeductions"),
    advances: checkbox(form, "advances"),
    violations: checkbox(form, "violations"),
    fuel: checkbox(form, "fuel"),
    damages: checkbox(form, "damages"),
    accidents: checkbox(form, "accidents"),
    absenceDeductions: checkbox(form, "absenceDeductions"),
    customDeductions: text(form, "customDeductions")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, amount] = line.split(":");
        return { name: name?.trim() || "Custom Deduction", amount: Number(amount ?? 0) || 0 };
      }),
  };

  const carRentRule = {
    enabled: checkbox(form, "carRentEnabled"),
    defaultMonthlyRent: numeric(form, "defaultMonthlyRent"),
    calculateByRentalDays: checkbox(form, "calculateByRentalDays"),
    fixedMonthlyDeduction: checkbox(form, "fixedMonthlyDeduction"),
    graceDays: numeric(form, "graceDays"),
    maxMonthlyDeduction: numeric(form, "maxMonthlyDeduction"),
  };

  return {
    name: text(form, "name"),
    applicationId: text(form, "applicationId"),
    applicationProjectId: text(form, "applicationProjectId"),
    cityId: text(form, "cityId"),
    status: text(form, "status"),
    basicSalary: numeric(form, "basicSalary"),
    targetOrders: numeric(form, "targetOrders"),
    extraOrderPrice: numeric(form, "extraOrderPrice"),
    levelRules,
    bonusRules,
    deductionRules,
    carRentRule,
  };
}

function defaultFormState(row: PayrollSettingRow | null) {
  return {
    levelRules: normalizeLevelRules(row?.levelRules),
    bonusRules: normalizeBonusRules(row?.bonusRules),
    deductionRules: normalizeDeductionRules(row?.deductionRules),
    carRentRule: normalizeCarRentRule(row?.carRentRule),
  };
}

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="md:col-span-4">
      <h4 className="text-sm font-black text-slate-950">{title}</h4>
      {hint ? <p className="mt-1 text-xs font-bold text-slate-500">{hint}</p> : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2 text-xs font-black text-slate-600">
      {label}
      {children}
    </label>
  );
}

function PayrollSettingForm({
  row,
  data,
  onSubmit,
  onCancel,
}: {
  row: PayrollSettingRow | null;
  data: PayrollSettingsData;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}) {
  const defaults = defaultFormState(row);
  const levelKeys = ["A", "B", "C"] as const;
  const inputClass = "rounded-xl border border-slate-300 px-3 py-2";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(buildPayload(new FormData(event.currentTarget)));
  }

  return (
    <form onSubmit={submit} className="grid gap-4 md:grid-cols-4">
      <SectionTitle title="Basic Information" />
      <Field label="Setting Name">
        <input name="name" defaultValue={row?.name ?? ""} required className={inputClass} />
      </Field>
      <Field label="Application">
        <select name="applicationId" defaultValue={row?.applicationId ?? data.filters.applicationId} required className={inputClass}>
          <option value="">اختر التطبيق</option>
          {data.applications.map((app) => (
            <option key={app.id} value={app.id}>
              {app.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Application Project">
        <select name="applicationProjectId" defaultValue={row?.applicationProjectId ?? data.filters.applicationProjectId} className={inputClass}>
          <option value="">Default / كل المشاريع</option>
          {data.projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="City">
        <select name="cityId" defaultValue={row?.cityId ?? data.filters.cityId} className={inputClass}>
          <option value="">كل المدن</option>
          {data.cities.map((city) => (
            <option key={city.id} value={city.id}>
              {city.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Contract Type">
        <input name="contractType" defaultValue={defaults.levelRules.meta?.contractType ?? ""} className={inputClass} placeholder="Sponsorship / Ajeer / Freelancer" />
      </Field>
      <Field label="Status">
        <select name="status" defaultValue={row?.status === "غير نشط" ? "INACTIVE" : "ACTIVE"} className={inputClass}>
          <option value="ACTIVE">نشط</option>
          <option value="INACTIVE">غير نشط</option>
          <option value="PENDING">قيد المراجعة</option>
        </select>
      </Field>

      <SectionTitle title="Base Salary" />
      <Field label="Basic Salary">
        <input name="basicSalary" type="number" step="0.01" defaultValue={row?.basicSalaryValue ?? 0} className={inputClass} />
      </Field>
      <Field label="Target Orders">
        <input name="targetOrders" type="number" defaultValue={row?.targetOrders ?? 0} className={inputClass} />
      </Field>
      <Field label="Extra Order Price">
        <input name="extraOrderPrice" type="number" step="0.01" defaultValue={row?.extraOrderPriceValue ?? 0} className={inputClass} />
      </Field>
      <Field label="Minimum Working Days">
        <input name="minimumWorkingDays" type="number" defaultValue={defaults.levelRules.meta?.minimumWorkingDays ?? 0} className={inputClass} />
      </Field>
      <Field label="Minimum Working Hours / Day">
        <input name="minimumWorkingHoursPerDay" type="number" step="0.01" defaultValue={defaults.levelRules.meta?.minimumWorkingHoursPerDay ?? 0} className={inputClass} />
      </Field>

      <SectionTitle title="Level A / B / C Rules" hint="الألوان في الجدول تعتمد على Level المتوقع، والحساب التجريبي يستخدم هذه القواعد مباشرة." />
      {levelKeys.map((level) => (
        <div key={level} className={`rounded-2xl border p-4 md:col-span-4 ${level === "A" ? "border-emerald-200 bg-emerald-50" : level === "B" ? "border-blue-200 bg-blue-50" : "border-red-200 bg-red-50"}`}>
          <h5 className="mb-3 text-sm font-black text-slate-950">Level {level}</h5>
          <div className="grid gap-3 md:grid-cols-7">
            {[
              ["minimumOrders", "Minimum Orders"],
              ["minimumOnTime", "Minimum On Time"],
              ["maxCancellation", "Max Cancellation"],
              ["maxRejection", "Max Rejection"],
              ["basicSalary", "Basic Salary"],
              ["extraOrderPrice", "Extra Order Price"],
              ["performanceBonus", "Performance Bonus"],
            ].map(([key, label]) => (
              <Field key={key} label={label}>
                <input name={`${level}_${key}`} type="number" step="0.01" defaultValue={(defaults.levelRules[level] as unknown as Record<string, number>)[key] ?? 0} className={inputClass} />
              </Field>
            ))}
          </div>
        </div>
      ))}

      <SectionTitle title="Bonus Rules" />
      <label className="flex items-center gap-2 text-sm font-black text-slate-700">
        <input name="extraOrdersBonus" type="checkbox" defaultChecked={defaults.bonusRules.extraOrdersBonus} /> Extra Orders Bonus
      </label>
      <label className="flex items-center gap-2 text-sm font-black text-slate-700">
        <input name="performanceBonus" type="checkbox" defaultChecked={defaults.bonusRules.performanceBonus} /> Performance Bonus
      </label>
      <Field label="Target Achievement Bonus">
        <input name="targetAchievementBonus" type="number" step="0.01" defaultValue={defaults.bonusRules.targetAchievementBonus} className={inputClass} />
      </Field>
      <Field label="No Cancellation Bonus">
        <input name="noCancellationBonus" type="number" step="0.01" defaultValue={defaults.bonusRules.noCancellationBonus} className={inputClass} />
      </Field>
      <Field label="High On Time Bonus">
        <input name="highOnTimeBonus" type="number" step="0.01" defaultValue={defaults.bonusRules.highOnTimeBonus} className={inputClass} />
      </Field>
      <Field label="Custom Bonuses JSON-like lines">
        <textarea name="customBonuses" defaultValue={defaults.bonusRules.customBonuses.map((item) => `${item.name}:${item.amount}`).join("\n")} className={inputClass} placeholder="Bonus Name:100" />
      </Field>

      <SectionTitle title="Deduction Rules" />
      {[
        ["appDeductions", "App Deductions"],
        ["advances", "Advances"],
        ["violations", "Violations"],
        ["fuel", "Fuel"],
        ["damages", "Damages"],
        ["accidents", "Accidents"],
        ["absenceDeductions", "Absence Deductions"],
      ].map(([key, label]) => (
        <label key={key} className="flex items-center gap-2 text-sm font-black text-slate-700">
          <input name={key} type="checkbox" defaultChecked={Boolean(defaults.deductionRules[key as keyof typeof defaults.deductionRules])} /> {label}
        </label>
      ))}
      <Field label="Custom Deductions">
        <textarea name="customDeductions" defaultValue={defaults.deductionRules.customDeductions.map((item) => `${item.name}:${item.amount}`).join("\n")} className={inputClass} placeholder="Deduction Name:100" />
      </Field>

      <SectionTitle title="Car Rent Rule" />
      <label className="flex items-center gap-2 text-sm font-black text-slate-700">
        <input name="carRentEnabled" type="checkbox" defaultChecked={defaults.carRentRule.enabled} /> Enabled
      </label>
      <label className="flex items-center gap-2 text-sm font-black text-slate-700">
        <input name="calculateByRentalDays" type="checkbox" defaultChecked={defaults.carRentRule.calculateByRentalDays} /> Calculate by Rental Days
      </label>
      <label className="flex items-center gap-2 text-sm font-black text-slate-700">
        <input name="fixedMonthlyDeduction" type="checkbox" defaultChecked={defaults.carRentRule.fixedMonthlyDeduction} /> Fixed Monthly Deduction
      </label>
      <Field label="Default Monthly Rent">
        <input name="defaultMonthlyRent" type="number" step="0.01" defaultValue={defaults.carRentRule.defaultMonthlyRent} className={inputClass} />
      </Field>
      <Field label="Grace Days">
        <input name="graceDays" type="number" defaultValue={defaults.carRentRule.graceDays} className={inputClass} />
      </Field>
      <Field label="Max Monthly Deduction">
        <input name="maxMonthlyDeduction" type="number" step="0.01" defaultValue={defaults.carRentRule.maxMonthlyDeduction} className={inputClass} />
      </Field>

      <div className="flex flex-wrap gap-2 md:col-span-4">
        <button type="submit" className="rounded-xl bg-amber-600 px-5 py-2 text-sm font-black text-white hover:bg-amber-700">
          حفظ إعداد المسير
        </button>
        <button type="button" onClick={onCancel} className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-black text-slate-700 hover:bg-slate-50">
          إلغاء
        </button>
      </div>
    </form>
  );
}

function TestCalculationModal({
  rows,
  initialSettingId,
  onClose,
}: {
  rows: PayrollSettingRow[];
  initialSettingId?: string;
  onClose: () => void;
}) {
  const [result, setResult] = useState<SalaryCalculationResult | null>(null);
  const [error, setError] = useState("");
  const inputClass = "rounded-xl border border-slate-300 px-3 py-2";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    payload.hasVehicle = form.has("hasVehicle") ? "true" : "false";
    const res = await fetch("/api/payroll-settings/test-calculation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "تعذر اختبار الحساب.");
      return;
    }
    setResult(data.data);
  }

  return (
    <Modal title="اختبار حساب الراتب" onClose={onClose}>
      <form onSubmit={submit} className="grid gap-3 md:grid-cols-4">
        <Field label="Payroll Setting">
          <select name="settingId" defaultValue={initialSettingId ?? rows[0]?.id ?? ""} required className={inputClass}>
            <option value="">اختر الإعداد</option>
            {rows.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name} - {row.applicationName} - {row.projectName}
              </option>
            ))}
          </select>
        </Field>
        {[
          ["orders", "عدد الطلبات"],
          ["workingHours", "ساعات العمل"],
          ["workingDays", "أيام العمل"],
          ["onTimeRate", "On Time %"],
          ["cancellationRate", "Cancellation %"],
          ["rejectionRate", "Rejection %"],
          ["rentalDays", "أيام إيجار السيارة"],
          ["advancesTotal", "السلف"],
          ["violationsTotal", "المخالفات"],
          ["fuelTotal", "البنزين"],
          ["appDeductionsTotal", "خصومات التطبيق"],
          ["damagesTotal", "التلفيات"],
          ["accidentDeduction", "الحوادث"],
          ["otherDeductions", "خصومات أخرى"],
        ].map(([key, label]) => (
          <Field key={key} label={label}>
            <input name={key} type="number" step="0.01" defaultValue={key === "onTimeRate" ? 99 : 0} className={inputClass} />
          </Field>
        ))}
        <label className="flex items-center gap-2 self-end text-sm font-black text-slate-700">
          <input name="hasVehicle" type="checkbox" /> معه سيارة
        </label>
        <div className="md:col-span-4">
          <button type="submit" className="rounded-xl bg-slate-950 px-5 py-2 text-sm font-black text-white">
            اختبار الحساب
          </button>
        </div>
      </form>
      {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">{error}</div> : null}
      {result ? (
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          {[
            ["Level المتوقع", `Level ${result.level}`],
            ["الراتب الأساسي", result.basicSalary],
            ["بونص الطلبات الزائدة", result.extraOrdersBonus],
            ["بونص الأداء", result.performanceBonus],
            ["إجمالي المستحقات", result.totalEarnings],
            ["إيجار السيارة", result.carRent],
            ["السلف", result.advancesTotal],
            ["المخالفات", result.violationsTotal],
            ["البنزين", result.fuelTotal],
            ["إجمالي الخصومات", result.totalDeductions],
            ["صافي الراتب", result.netSalary],
          ].map(([label, value]) => (
            <MetricCard key={String(label)} title={String(label)} value={String(value)} tone={label === "Level المتوقع" ? (result.level === "A" ? "emerald" : result.level === "B" ? "blue" : "red") : "slate"} />
          ))}
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900 md:col-span-4">
            {result.warnings.length ? result.warnings.join(" | ") : "لا توجد تحذيرات في الحساب التجريبي."}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

function CopySettingModal({
  source,
  data,
  onSubmit,
  onClose,
}: {
  source: PayrollSettingRow;
  data: PayrollSettingsData;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
}) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(Object.fromEntries(new FormData(event.currentTarget).entries()));
  }

  return (
    <Modal title="نسخ إعداد المسير من مشروع آخر" onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
          <p className="text-sm font-bold text-slate-600">المصدر الحالي: {source.applicationName} / {source.projectName}</p>
          <p className="mt-1 text-xs font-bold text-slate-500">Copy payroll rules: نعم. Copy invoice/rank rules: لا.</p>
        </div>
        <Field label="Source Payroll Setting">
          <select name="sourceSettingId" defaultValue={source.id} required className="rounded-xl border border-slate-300 px-3 py-2">
            {data.rows.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name} - {row.applicationName} - {row.projectName}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Source Application / Project">
          <input readOnly value={`${source.applicationName} / ${source.projectName}`} className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2" />
        </Field>
        <Field label="Target Application">
          <select name="targetApplicationId" required className="rounded-xl border border-slate-300 px-3 py-2">
            <option value="">اختر التطبيق الهدف</option>
            {data.applications.map((app) => (
              <option key={app.id} value={app.id}>
                {app.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Target Project">
          <select name="targetApplicationProjectId" className="rounded-xl border border-slate-300 px-3 py-2">
            <option value="">Default / كل المشاريع</option>
            {data.projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="City">
          <select name="cityId" className="rounded-xl border border-slate-300 px-3 py-2">
            <option value="">كل المدن</option>
            {data.cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="New Setting Name">
          <input name="name" required defaultValue={`نسخة من ${source.name}`} className="rounded-xl border border-slate-300 px-3 py-2" />
        </Field>
        <div className="flex flex-wrap gap-2 md:col-span-2">
          <button type="submit" className="rounded-xl bg-amber-600 px-5 py-2 text-sm font-black text-white">
            نسخ الإعداد
          </button>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-5 py-2 text-sm font-black text-slate-700">
            إلغاء
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function PayrollSettingsClient({ data, basePath = "/payroll/settings", scopeTitle }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [toast, setToast] = useState("");
  const [editing, setEditing] = useState<PayrollSettingRow | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [copySource, setCopySource] = useState<PayrollSettingRow | null>(null);
  const [testSettingId, setTestSettingId] = useState<string | null>(null);
  const [details, setDetails] = useState<PayrollSettingRow | null>(null);

  const contractTypes = useMemo(() => [...new Set(data.rows.map((row) => row.contractType).filter(Boolean))], [data.rows]);

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${basePath}?${params.toString()}`);
  }

  async function saveSetting(payload: Record<string, unknown>) {
    const target = editing ? `/api/payroll-settings/${editing.id}` : "/api/payroll-settings";
    const method = editing ? "PATCH" : "POST";
    const res = await fetch(target, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const result = await res.json();
    if (!res.ok) {
      setToast(result.error ?? "تعذر حفظ إعداد المسير");
      return;
    }
    setToast("تم حفظ إعداد المسير بنجاح");
    setShowForm(false);
    setEditing(null);
    router.refresh();
  }

  async function copySetting(payload: Record<string, unknown>) {
    if (!copySource) return;
    const sourceId = String(payload.sourceSettingId ?? copySource.id);
    const res = await fetch(`/api/payroll-settings/${sourceId}/copy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (!res.ok) {
      setToast(result.error ?? "تعذر نسخ الإعداد");
      return;
    }
    setToast(result.message ?? "تم نسخ الإعداد");
    setCopySource(null);
    router.refresh();
  }

  async function toggleStatus(row: PayrollSettingRow) {
    const payload = {
      name: row.name,
      applicationId: row.applicationId,
      applicationProjectId: row.applicationProjectId,
      cityId: row.cityId,
      status: row.status === "نشط" ? "INACTIVE" : "ACTIVE",
      basicSalary: row.basicSalaryValue,
      targetOrders: row.targetOrders ?? 0,
      extraOrderPrice: row.extraOrderPriceValue,
      levelRules: row.levelRules,
      bonusRules: row.bonusRules,
      deductionRules: row.deductionRules,
      carRentRule: row.carRentRule,
    };
    const res = await fetch(`/api/payroll-settings/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (!res.ok) setToast(result.error ?? "تعذر تغيير الحالة");
    else {
      setToast("تم تحديث حالة الإعداد");
      router.refresh();
    }
  }

  if (data.databaseStatus === "offline") {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm font-bold text-red-800">{data.databaseMessage}</div>;
  }

  return (
    <section className="w-full max-w-none space-y-5 bg-slate-50" dir="rtl">
      {toast ? <Toast message={toast} onClose={() => setToast("")} /> : null}
      {showForm ? <Modal title={editing ? "تعديل إعداد المسير" : "إضافة إعداد مسير"} onClose={() => setShowForm(false)}><PayrollSettingForm row={editing} data={data} onSubmit={saveSetting} onCancel={() => setShowForm(false)} /></Modal> : null}
      {copySource ? <CopySettingModal source={copySource} data={data} onSubmit={copySetting} onClose={() => setCopySource(null)} /> : null}
      {testSettingId !== null ? <TestCalculationModal rows={data.rows} initialSettingId={testSettingId || undefined} onClose={() => setTestSettingId(null)} /> : null}
      {details ? (
        <Modal title="تفاصيل إعداد المسير" onClose={() => setDetails(null)}>
          <pre className="whitespace-pre-wrap rounded-xl bg-slate-950 p-4 text-left text-xs text-white" dir="ltr">{JSON.stringify(details, null, 2)}</pre>
        </Modal>
      ) : null}

      <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
        <MetricCard title="إجمالي إعدادات المسير" value={data.summary.total} tone="blue" />
        <MetricCard title="الإعدادات النشطة" value={data.summary.active} tone="emerald" />
        <MetricCard title="إعدادات Keeta" value={data.summary.keeta} />
        <MetricCard title="إعدادات HungerStation" value={data.summary.hungerstation} />
        <MetricCard title="إعدادات Talabat" value={data.summary.talabat} />
        <MetricCard title="إعدادات بدون مشروع" value={data.summary.withoutProject} />
        <MetricCard title="قواعد افتراضية" value={data.summary.defaultRules} tone="amber" />
        <MetricCard title="تحتاج مراجعة" value={data.summary.needsReview} tone={data.summary.needsReview ? "red" : "emerald"} />
      </div>

      {scopeTitle ? <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-900">{scopeTitle}</div> : null}

      {data.summary.keeta ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-950 shadow-sm">
          <div className="text-base font-black">سياسة Keeta المعتمدة من الصورة</div>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            <p>Target 560: راتب أساسي 2000 ريال على 28 يوم، بنزين 1100، سكن 300، اتصال 100، وبدل أداء A/B/C = 1800 / 1300 / 800.</p>
            <p>Target 460: راتب أساسي 1500 ريال على 28 يوم، بنزين 900، سكن 300، اتصال 100، وبدل أداء A/B/C = 1200 / 700 / 200.</p>
            <p>سيارة الشركة: خصم الإيجار اليومي × عدد أيام الإيجار، والحد الشهري 1500 ريال.</p>
            <p>السيارة الشخصية: لا يوجد خصم سيارة، ويظهر بدل السيارة الشخصية حسب الخطة. نقص الطلبات أقل من 460 يخصم 8 ريال لكل طلب ناقص.</p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => { setEditing(null); setShowForm(true); }} className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-black text-white hover:bg-amber-700">
          إضافة إعداد مسير
        </button>
        <button type="button" onClick={() => data.rows[0] ? setCopySource(data.rows[0]) : setToast("لا يوجد إعداد مصدر للنسخ")} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700">
          نسخ من مشروع آخر
        </button>
        <button type="button" onClick={() => setTestSettingId("")} className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-black text-blue-800">
          اختبار حساب راتب
        </button>
        <button type="button" onClick={() => router.refresh()} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700">
          تحديث البيانات
        </button>
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-6">
        <Field label="التطبيق">
          <select value={data.filters.applicationId} onChange={(event) => updateFilter("applicationId", event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2">
            <option value="">كل التطبيقات</option>
            {data.applications.map((app) => <option key={app.id} value={app.id}>{app.name}</option>)}
          </select>
        </Field>
        <Field label="المشروع">
          <select value={data.filters.applicationProjectId} onChange={(event) => updateFilter("applicationProjectId", event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2">
            <option value="">كل المشاريع</option>
            {data.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        </Field>
        <Field label="المدينة">
          <select value={data.filters.cityId} onChange={(event) => updateFilter("cityId", event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2">
            <option value="">كل المدن</option>
            {data.cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
          </select>
        </Field>
        <Field label="الحالة">
          <select value={data.filters.status} onChange={(event) => updateFilter("status", event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2">
            <option value="">كل الحالات</option>
            <option value="ACTIVE">نشط</option>
            <option value="INACTIVE">غير نشط</option>
            <option value="PENDING">قيد المراجعة</option>
          </select>
        </Field>
        <Field label="نوع العقد">
          <select value={data.filters.contractType} onChange={(event) => updateFilter("contractType", event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2">
            <option value="">كل العقود</option>
            {contractTypes.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </Field>
        <Field label="بحث باسم الإعداد">
          <input defaultValue={data.filters.q} onBlur={(event) => updateFilter("q", event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2" placeholder="بحث..." />
        </Field>
      </div>

      {!data.rows.length ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <h3 className="text-lg font-black text-slate-950">لا توجد إعدادات مسير لهذا النطاق.</h3>
          <p className="mt-2 text-sm font-bold text-slate-500">لو المشروع مفيهوش إعداد خاص سيتم استخدام الإعدادات الافتراضية الخاصة بالتطبيق إن وجدت.</p>
          <button type="button" onClick={() => { setEditing(null); setShowForm(true); }} className="mt-4 rounded-xl bg-amber-600 px-5 py-2 text-sm font-black text-white">
            إنشاء إعداد للمشروع
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-[1550px] text-right text-sm">
            <thead className="bg-slate-50 text-xs font-black text-slate-500">
              <tr>{["Setting Name", "Application", "Project", "City", "Basic Salary", "Target Orders", "Extra Order Price", "Level Rules", "Bonus Rules", "Deduction Rules", "Car Rent Rule", "Status", "Updated At", "Actions"].map((head) => <th key={head} className="whitespace-nowrap px-4 py-3">{head}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 font-black">
                    {row.name}
                    {row.isDefault ? <span className="mr-2 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-800">Default</span> : null}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">{row.applicationName}</td>
                  <td className="whitespace-nowrap px-4 py-3">{row.projectName}</td>
                  <td className="whitespace-nowrap px-4 py-3">{row.cityName}</td>
                  <td className="whitespace-nowrap px-4 py-3">{row.basicSalary}</td>
                  <td className="whitespace-nowrap px-4 py-3">{row.targetOrders ?? "-"}</td>
                  <td className="whitespace-nowrap px-4 py-3">{row.extraOrderPrice}</td>
                  <td className="whitespace-nowrap px-4 py-3">{row.levelRulesSummary}</td>
                  <td className="whitespace-nowrap px-4 py-3">{row.bonusRulesSummary}</td>
                  <td className="whitespace-nowrap px-4 py-3">{row.deductionRulesSummary}</td>
                  <td className="whitespace-nowrap px-4 py-3">{row.carRentRuleSummary}</td>
                  <td className="whitespace-nowrap px-4 py-3">{row.status}</td>
                  <td className="whitespace-nowrap px-4 py-3">{row.updatedAt}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <button type="button" onClick={() => setDetails(row)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-black text-slate-700">عرض التفاصيل</button>
                      <button type="button" onClick={() => { setEditing(row); setShowForm(true); }} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-black text-slate-700">تعديل</button>
                      <button type="button" onClick={() => setCopySource(row)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-black text-slate-700">نسخ</button>
                      <button type="button" onClick={() => setTestSettingId(row.id)} className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-black text-blue-800">اختبار الحساب</button>
                      <button type="button" onClick={() => void toggleStatus(row)} className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-black text-amber-800">تفعيل / تعطيل</button>
                      <button type="button" onClick={() => void toggleStatus(row)} className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-black text-red-800">تعطيل</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Link href="/applications" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700">مركز التطبيقات</Link>
        <Link href="/payroll" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700">مسير الرواتب</Link>
      </div>
    </section>
  );
}
