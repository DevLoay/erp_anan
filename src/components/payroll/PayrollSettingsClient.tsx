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


type KeetaSalaryMode = "PER_ORDER" | "FIXED_PRORATED_BY_PAID_DAYS";

type KeetaSalarySlab = {
  minOrders: number;
  maxOrders: number | null;
  salaryMode: KeetaSalaryMode;
  fixedSalary: number;
  bonus: number;
  perOrderRate: number;
  extraOrderThreshold: number | null;
  extraOrderRate: number;
};

const DEFAULT_KEETA_SALARY_SLABS: KeetaSalarySlab[] = [
  { minOrders: 0, maxOrders: 349, salaryMode: "PER_ORDER", fixedSalary: 0, bonus: 0, perOrderRate: 8, extraOrderThreshold: null, extraOrderRate: 0 },
  { minOrders: 350, maxOrders: 409, salaryMode: "FIXED_PRORATED_BY_PAID_DAYS", fixedSalary: 4500, bonus: 0, perOrderRate: 0, extraOrderThreshold: null, extraOrderRate: 0 },
  { minOrders: 410, maxOrders: 459, salaryMode: "FIXED_PRORATED_BY_PAID_DAYS", fixedSalary: 5200, bonus: 800, perOrderRate: 0, extraOrderThreshold: null, extraOrderRate: 0 },
  { minOrders: 460, maxOrders: 509, salaryMode: "FIXED_PRORATED_BY_PAID_DAYS", fixedSalary: 5200, bonus: 1100, perOrderRate: 0, extraOrderThreshold: null, extraOrderRate: 0 },
  { minOrders: 510, maxOrders: null, salaryMode: "FIXED_PRORATED_BY_PAID_DAYS", fixedSalary: 5200, bonus: 1800, perOrderRate: 0, extraOrderThreshold: 510, extraOrderRate: 8 },
];

const DEFAULT_KEETA_META = {
  payrollMonthDays: 30,
  paidLeaveDaysAllowed: 2,
  prorateBaseSalaryByPaidDays: true,
  bonusProratedByWorkingDays: false,
  paidLeaveCountsForTarget: false,
  expectedExperienceIncentiveAmount: 2000,
  experienceIncentiveDeductionEnabled: true,
  markMissingExperienceIncentiveAsReview: true,
  allowManualExperienceIncentiveOverride: false,
};

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function boolValue(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true" || value === "on" || value === "1";
  return fallback;
}

function numberOrDefault(value: unknown, fallback: number) {
  const numeric = Number(value ?? fallback);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeSalaryMode(value: unknown): KeetaSalaryMode {
  return value === "PER_ORDER" ? "PER_ORDER" : "FIXED_PRORATED_BY_PAID_DAYS";
}

function normalizeKeetaSalarySlabs(value: unknown): KeetaSalarySlab[] {
  if (!Array.isArray(value)) return DEFAULT_KEETA_SALARY_SLABS;
  const normalized = value.map((item, index) => {
    const row = objectRecord(item);
    const fallback = DEFAULT_KEETA_SALARY_SLABS[index] ?? DEFAULT_KEETA_SALARY_SLABS[DEFAULT_KEETA_SALARY_SLABS.length - 1];
    const rawMax = row.maxOrders;
    const rawExtraThreshold = row.extraOrderThreshold;
    return {
      minOrders: numberOrDefault(row.minOrders, fallback.minOrders),
      maxOrders: rawMax === null || rawMax === "" || rawMax === undefined ? null : numberOrDefault(rawMax, fallback.maxOrders ?? 0),
      salaryMode: normalizeSalaryMode(row.salaryMode ?? fallback.salaryMode),
      fixedSalary: numberOrDefault(row.fixedSalary, fallback.fixedSalary),
      bonus: numberOrDefault(row.bonus, fallback.bonus),
      perOrderRate: numberOrDefault(row.perOrderRate, fallback.perOrderRate),
      extraOrderThreshold: rawExtraThreshold === null || rawExtraThreshold === "" || rawExtraThreshold === undefined ? null : numberOrDefault(rawExtraThreshold, fallback.extraOrderThreshold ?? 0),
      extraOrderRate: numberOrDefault(row.extraOrderRate, fallback.extraOrderRate),
    } satisfies KeetaSalarySlab;
  });
  return normalized.length ? normalized : DEFAULT_KEETA_SALARY_SLABS;
}

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

function numericNullable(form: FormData, key: string) {
  const raw = String(form.get(key) ?? "").trim();
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function buildPayload(form: FormData) {
  const salarySlabs = DEFAULT_KEETA_SALARY_SLABS.map((fallback, index) => ({
    minOrders: numeric(form, `slab_${index}_minOrders`),
    maxOrders: numericNullable(form, `slab_${index}_maxOrders`),
    salaryMode: normalizeSalaryMode(text(form, `slab_${index}_salaryMode`) || fallback.salaryMode),
    fixedSalary: numeric(form, `slab_${index}_fixedSalary`),
    bonus: numeric(form, `slab_${index}_bonus`),
    perOrderRate: numeric(form, `slab_${index}_perOrderRate`),
    extraOrderThreshold: numericNullable(form, `slab_${index}_extraOrderThreshold`),
    extraOrderRate: numeric(form, `slab_${index}_extraOrderRate`),
  }));

  const payrollMonthDays = numeric(form, "payrollMonthDays") || DEFAULT_KEETA_META.payrollMonthDays;
  const paidLeaveDaysAllowed = numeric(form, "paidLeaveDaysAllowed");
  const expectedExperienceIncentiveAmount = numeric(form, "expectedExperienceIncentiveAmount");
  const experienceIncentiveDeductionEnabled = checkbox(form, "experienceIncentiveDeductionEnabled");
  const markMissingExperienceIncentiveAsReview = checkbox(form, "markMissingExperienceIncentiveAsReview");
  const allowManualExperienceIncentiveOverride = checkbox(form, "allowManualExperienceIncentiveOverride");

  const levelRules = {
    A: { minimumOrders: 510, minimumOnTime: 0, maxCancellation: 100, maxRejection: 100, basicSalary: 5200, extraOrderPrice: 8, performanceBonus: 1800 },
    B: { minimumOrders: 460, minimumOnTime: 0, maxCancellation: 100, maxRejection: 100, basicSalary: 5200, extraOrderPrice: 8, performanceBonus: 1100 },
    C: { minimumOrders: 350, minimumOnTime: 0, maxCancellation: 100, maxRejection: 100, basicSalary: 4500, extraOrderPrice: 8, performanceBonus: 0 },
    meta: {
      contractType: text(form, "contractType") || "all",
      keetaPayrollVersion: "v2_order_slabs_experience_shortfall",
      salarySlabs,
      payrollMonthDays,
      paidLeaveDaysAllowed,
      prorateBaseSalaryByPaidDays: checkbox(form, "prorateBaseSalaryByPaidDays"),
      bonusProratedByWorkingDays: checkbox(form, "bonusProratedByWorkingDays"),
      paidLeaveCountsForTarget: checkbox(form, "paidLeaveCountsForTarget"),
      expectedExperienceIncentiveAmount,
      experienceIncentiveDeductionEnabled,
      markMissingExperienceIncentiveAsReview,
      allowManualExperienceIncentiveOverride,
      salaryProration: "fixedSalary / payrollMonthDays * paidSalaryDays",
    },
  };

  const bonusRules = {
    extraOrdersBonus: true,
    performanceBonus: true,
    targetAchievementBonus: 0,
    noCancellationBonus: 0,
    highOnTimeBonus: 0,
    bonusPaidInFullWhenTargetReached: !checkbox(form, "bonusProratedByWorkingDays"),
    customBonuses: [],
  };

  const deductionRules = {
    appDeductions: checkbox(form, "appDeductions"),
    advances: checkbox(form, "advances"),
    violations: checkbox(form, "violations"),
    fuel: checkbox(form, "fuel"),
    damages: checkbox(form, "damages"),
    accidents: checkbox(form, "accidents"),
    absenceDeductions: checkbox(form, "absenceDeductions"),
    experienceIncentive: {
      enabled: experienceIncentiveDeductionEnabled,
      expectedAmount: expectedExperienceIncentiveAmount,
      markMissingAsReview: markMissingExperienceIncentiveAsReview,
      allowManualOverride: allowManualExperienceIncentiveOverride,
      formula: "max(expectedAmount - invoiceExperienceIncentiveAmount, 0)",
    },
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
    basicSalary: numeric(form, "basicSalary") || 5200,
    targetOrders: numeric(form, "targetOrders") || 410,
    extraOrderPrice: numeric(form, "extraOrderPrice") || 8,
    salarySlabs,
    payrollMonthDays,
    paidLeaveDaysAllowed,
    prorateBaseSalaryByPaidDays: checkbox(form, "prorateBaseSalaryByPaidDays"),
    bonusProratedByWorkingDays: checkbox(form, "bonusProratedByWorkingDays"),
    paidLeaveCountsForTarget: checkbox(form, "paidLeaveCountsForTarget"),
    expectedExperienceIncentiveAmount,
    experienceIncentiveDeductionEnabled,
    markMissingExperienceIncentiveAsReview,
    allowManualExperienceIncentiveOverride,
    levelRules,
    bonusRules,
    deductionRules,
    carRentRule,
  };
}

function defaultFormState(row: PayrollSettingRow | null) {
  const levelRules = normalizeLevelRules(row?.levelRules);
  const meta = objectRecord((row?.levelRules as Record<string, unknown> | null | undefined)?.meta);
  const deductionRules = normalizeDeductionRules(row?.deductionRules);
  const rawDeductionRules = objectRecord(row?.deductionRules);
  const experienceRule = objectRecord(rawDeductionRules.experienceIncentive);
  return {
    levelRules,
    levelMeta: meta,
    salarySlabs: normalizeKeetaSalarySlabs(meta.salarySlabs),
    payrollMonthDays: numberOrDefault(meta.payrollMonthDays, DEFAULT_KEETA_META.payrollMonthDays),
    paidLeaveDaysAllowed: numberOrDefault(meta.paidLeaveDaysAllowed, DEFAULT_KEETA_META.paidLeaveDaysAllowed),
    prorateBaseSalaryByPaidDays: boolValue(meta.prorateBaseSalaryByPaidDays, DEFAULT_KEETA_META.prorateBaseSalaryByPaidDays),
    bonusProratedByWorkingDays: boolValue(meta.bonusProratedByWorkingDays, DEFAULT_KEETA_META.bonusProratedByWorkingDays),
    paidLeaveCountsForTarget: boolValue(meta.paidLeaveCountsForTarget, DEFAULT_KEETA_META.paidLeaveCountsForTarget),
    expectedExperienceIncentiveAmount: numberOrDefault(meta.expectedExperienceIncentiveAmount ?? experienceRule.expectedAmount, DEFAULT_KEETA_META.expectedExperienceIncentiveAmount),
    experienceIncentiveDeductionEnabled: boolValue(experienceRule.enabled, DEFAULT_KEETA_META.experienceIncentiveDeductionEnabled),
    markMissingExperienceIncentiveAsReview: boolValue(experienceRule.markMissingAsReview, DEFAULT_KEETA_META.markMissingExperienceIncentiveAsReview),
    allowManualExperienceIncentiveOverride: boolValue(experienceRule.allowManualOverride, DEFAULT_KEETA_META.allowManualExperienceIncentiveOverride),
    bonusRules: normalizeBonusRules(row?.bonusRules),
    deductionRules,
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
  const inputClass = "rounded-xl border border-slate-300 px-3 py-2";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(buildPayload(new FormData(event.currentTarget)));
  }

  return (
    <form onSubmit={submit} className="grid gap-4 md:grid-cols-4">
      <SectionTitle title="البيانات الأساسية" hint="هذه الإعدادات يمكن تطبيقها على كل مدن Keeta أو مدينة/مشروع محدد." />
      <Field label="اسم الإعداد">
        <input name="name" defaultValue={row?.name ?? "Keeta - إعدادات الرواتب الشهرية"} required className={inputClass} />
      </Field>
      <Field label="التطبيق">
        <select name="applicationId" defaultValue={row?.applicationId ?? data.filters.applicationId} required className={inputClass}>
          <option value="">اختر التطبيق</option>
          {data.applications.map((app) => (
            <option key={app.id} value={app.id}>
              {app.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="المشروع">
        <select name="applicationProjectId" defaultValue={row?.applicationProjectId ?? data.filters.applicationProjectId} className={inputClass}>
          <option value="">Default / كل المشاريع</option>
          {data.projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="المدينة">
        <select name="cityId" defaultValue={row?.cityId ?? data.filters.cityId} className={inputClass}>
          <option value="">كل المدن</option>
          {data.cities.map((city) => (
            <option key={city.id} value={city.id}>
              {city.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="نوع العقد">
        <input name="contractType" defaultValue={defaults.levelRules.meta?.contractType ?? "all"} className={inputClass} placeholder="all / sponsorship / ajeer / freelancer" />
      </Field>
      <Field label="الحالة">
        <select name="status" defaultValue={row?.status === "غير نشط" ? "INACTIVE" : "ACTIVE"} className={inputClass}>
          <option value="ACTIVE">نشط</option>
          <option value="INACTIVE">غير نشط</option>
          <option value="PENDING">قيد المراجعة</option>
        </select>
      </Field>

      <input type="hidden" name="basicSalary" value={row?.basicSalaryValue || 5200} />
      <input type="hidden" name="targetOrders" value={row?.targetOrders ?? 410} />
      <input type="hidden" name="extraOrderPrice" value={row?.extraOrderPriceValue || 8} />

      <SectionTitle title="شرائح رواتب Keeta حسب عدد الطلبات" hint="القيم التالية قابلة للتغيير شهريًا، والحساب الفعلي يتم من Backend وليس من الواجهة." />
      {DEFAULT_KEETA_SALARY_SLABS.map((fallback, index) => {
        const slab = defaults.salarySlabs[index] ?? fallback;
        return (
          <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 md:col-span-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h5 className="text-sm font-black text-slate-950">شريحة {index + 1}</h5>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600">
                {slab.maxOrders === null ? `${slab.minOrders}+ طلب` : `${slab.minOrders} - ${slab.maxOrders} طلب`}
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-8">
              <Field label="من طلب">
                <input name={`slab_${index}_minOrders`} type="number" defaultValue={slab.minOrders} className={inputClass} />
              </Field>
              <Field label="إلى طلب">
                <input name={`slab_${index}_maxOrders`} type="number" defaultValue={slab.maxOrders ?? ""} placeholder="مفتوح" className={inputClass} />
              </Field>
              <Field label="نوع الحساب">
                <select name={`slab_${index}_salaryMode`} defaultValue={slab.salaryMode} className={inputClass}>
                  <option value="PER_ORDER">بالطلب</option>
                  <option value="FIXED_PRORATED_BY_PAID_DAYS">راتب ثابت حسب الأيام</option>
                </select>
              </Field>
              <Field label="راتب ثابت">
                <input name={`slab_${index}_fixedSalary`} type="number" step="0.01" defaultValue={slab.fixedSalary} className={inputClass} />
              </Field>
              <Field label="البونص">
                <input name={`slab_${index}_bonus`} type="number" step="0.01" defaultValue={slab.bonus} className={inputClass} />
              </Field>
              <Field label="سعر الطلب">
                <input name={`slab_${index}_perOrderRate`} type="number" step="0.01" defaultValue={slab.perOrderRate} className={inputClass} />
              </Field>
              <Field label="حد الطلبات الزائدة">
                <input name={`slab_${index}_extraOrderThreshold`} type="number" defaultValue={slab.extraOrderThreshold ?? ""} placeholder="لا يوجد" className={inputClass} />
              </Field>
              <Field label="سعر الطلب الزائد">
                <input name={`slab_${index}_extraOrderRate`} type="number" step="0.01" defaultValue={slab.extraOrderRate} className={inputClass} />
              </Field>
            </div>
          </div>
        );
      })}

      <SectionTitle title="إعدادات الأيام والإجازة" hint="الإجازة المدفوعة تدخل في أيام الراتب الأساسي فقط، ولا تزود الطلبات ولا تحقق التارجت." />
      <Field label="عدد أيام الشهر المعتمد">
        <input name="payrollMonthDays" type="number" defaultValue={defaults.payrollMonthDays} className={inputClass} />
      </Field>
      <Field label="أيام الإجازة المدفوعة">
        <input name="paidLeaveDaysAllowed" type="number" defaultValue={defaults.paidLeaveDaysAllowed} className={inputClass} />
      </Field>
      <label className="flex items-center gap-2 self-end text-sm font-black text-slate-700">
        <input name="prorateBaseSalaryByPaidDays" type="checkbox" defaultChecked={defaults.prorateBaseSalaryByPaidDays} /> احتساب الراتب الأساسي حسب الأيام المدفوعة
      </label>
      <label className="flex items-center gap-2 self-end text-sm font-black text-slate-700">
        <input name="bonusProratedByWorkingDays" type="checkbox" defaultChecked={defaults.bonusProratedByWorkingDays} /> تقسيم البونص على الأيام
      </label>
      <label className="flex items-center gap-2 self-end text-sm font-black text-slate-700">
        <input name="paidLeaveCountsForTarget" type="checkbox" defaultChecked={defaults.paidLeaveCountsForTarget} /> الإجازة تدخل في تحقيق التارجت
      </label>

      <SectionTitle title="إعدادات خصم فرق Experience Incentive" hint="الخصم = القيمة الأساسية المتوقعة - Experience Incentive من فاتورة Keeta، ولا يتم استخدام Level A/B/C/D كخصم ثابت." />
      <Field label="قيمة Experience Incentive الأساسية">
        <input name="expectedExperienceIncentiveAmount" type="number" step="0.01" defaultValue={defaults.expectedExperienceIncentiveAmount} className={inputClass} />
      </Field>
      <label className="flex items-center gap-2 self-end text-sm font-black text-slate-700">
        <input name="experienceIncentiveDeductionEnabled" type="checkbox" defaultChecked={defaults.experienceIncentiveDeductionEnabled} /> تفعيل خصم الفرق
      </label>
      <label className="flex items-center gap-2 self-end text-sm font-black text-slate-700">
        <input name="markMissingExperienceIncentiveAsReview" type="checkbox" defaultChecked={defaults.markMissingExperienceIncentiveAsReview} /> عدم وجود Experience يحتاج مراجعة
      </label>
      <label className="flex items-center gap-2 self-end text-sm font-black text-slate-700">
        <input name="allowManualExperienceIncentiveOverride" type="checkbox" defaultChecked={defaults.allowManualExperienceIncentiveOverride} /> السماح بالتعديل اليدوي بصلاحية
      </label>

      <SectionTitle title="الخصومات الأخرى" hint="هذه الخصومات منفصلة عن فرق Experience Incentive." />
      {[
        ["appDeductions", "خصومات التطبيق"],
        ["advances", "السلف"],
        ["violations", "المخالفات"],
        ["fuel", "البنزين"],
        ["damages", "التلفيات"],
        ["accidents", "الحوادث"],
        ["absenceDeductions", "خصومات الغياب"],
      ].map(([key, label]) => (
        <label key={key} className="flex items-center gap-2 text-sm font-black text-slate-700">
          <input name={key} type="checkbox" defaultChecked={Boolean(defaults.deductionRules[key as keyof typeof defaults.deductionRules])} /> {label}
        </label>
      ))}
      <Field label="خصومات مخصصة">
        <textarea name="customDeductions" defaultValue={defaults.deductionRules.customDeductions.map((item) => `${item.name}:${item.amount}`).join("\n")} className={inputClass} placeholder="Deduction Name:100" />
      </Field>

      <SectionTitle title="إيجار السيارة" />
      <label className="flex items-center gap-2 text-sm font-black text-slate-700">
        <input name="carRentEnabled" type="checkbox" defaultChecked={defaults.carRentRule.enabled} /> مفعل
      </label>
      <label className="flex items-center gap-2 text-sm font-black text-slate-700">
        <input name="calculateByRentalDays" type="checkbox" defaultChecked={defaults.carRentRule.calculateByRentalDays} /> حسب أيام الإيجار
      </label>
      <label className="flex items-center gap-2 text-sm font-black text-slate-700">
        <input name="fixedMonthlyDeduction" type="checkbox" defaultChecked={defaults.carRentRule.fixedMonthlyDeduction} /> خصم شهري ثابت
      </label>
      <Field label="الإيجار الشهري الافتراضي">
        <input name="defaultMonthlyRent" type="number" step="0.01" defaultValue={defaults.carRentRule.defaultMonthlyRent} className={inputClass} />
      </Field>
      <Field label="أيام السماح">
        <input name="graceDays" type="number" defaultValue={defaults.carRentRule.graceDays} className={inputClass} />
      </Field>
      <Field label="أقصى خصم شهري">
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
          ["paidLeaveDaysUsed", "أيام الإجازة المدفوعة"],
          ["invoiceExperienceIncentiveAmount", "Experience Incentive من الفاتورة"],
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
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-950 shadow-sm">
          <div className="text-base font-black">سياسة Keeta الحالية</div>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            <p>0 - 349 طلب: الراتب = عدد الطلبات × 8 ريال، ولا يوجد بونص.</p>
            <p>350 - 409 طلب: راتب ثابت 4500 ريال محسوب حسب الأيام المدفوعة.</p>
            <p>410 - 459 طلب: راتب ثابت 5200 ريال حسب الأيام المدفوعة + بونص 800 ريال كامل.</p>
            <p>460 - 509 طلب: راتب ثابت 5200 ريال حسب الأيام المدفوعة + بونص 1100 ريال كامل.</p>
            <p>510 طلب فأكثر: راتب ثابت 5200 ريال + بونص 1800 ريال + كل طلب فوق 510 × 8 ريال.</p>
            <p>Experience Incentive: الخصم = القيمة الأساسية المتوقعة 2000 - القيمة الموجودة في فاتورة Keeta، والفرق فقط هو الذي يخصم.</p>
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
