"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type {
  HungerStationCompanyPayrollPreview,
  HungerStationCompanyPayrollRow,
  HungerStationPayrollDecisionType,
} from "@/lib/payroll/hungerstationCompanyPayroll";

type LoadState = "idle" | "loading" | "error" | "ready";

type GenerateResult = {
  created?: number;
  updated?: number;
  skippedLocked?: number;
  message?: string;
};

type Props = {
  initialMonth?: string;
  initialProjectCode?: string;
  initialApplicationProjectId?: string;
};

type PayrollColumn = {
  key: string;
  label: string;
  className?: string;
  render: (row: HungerStationCompanyPayrollRow) => string | number;
};

const defaultMonth = "2026-04";

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatQty(value: number) {
  return Number(value || 0).toLocaleString("ar-SA", { maximumFractionDigits: 2 });
}

function tierBadge(tier: string) {
  if (tier === "HIGH") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (tier === "SPECIAL") return "bg-violet-50 text-violet-700 ring-violet-200";
  return "bg-amber-50 text-amber-700 ring-amber-200";
}

function decisionLabel(value: HungerStationPayrollDecisionType) {
  const labels: Record<HungerStationPayrollDecisionType, string> = {
    AUTO: "Auto",
    LOW: "اعتماد Low",
    SPECIAL: "Special",
    EXCLUDED: "استبعاد",
  };
  return labels[value];
}

function includesText(row: HungerStationCompanyPayrollRow, q: string) {
  if (!q.trim()) return true;
  const haystack = [
    row.riderId,
    row.account,
    row.accountName,
    row.actualDriverName,
    row.driverCode,
    row.city,
    row.project,
    row.tier,
    row.notes,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q.trim().toLowerCase());
}

const tableColumns: PayrollColumn[] = [
  { key: "riderId", label: "الايدى", render: (row) => row.riderId },
  { key: "city", label: "المدينة", render: (row) => row.city || "-" },
  { key: "account", label: "اسم المستخدم", render: (row) => row.account || "-" },
  { key: "vehicle", label: "السياره", render: (row) => row.vehicle || "-" },
  { key: "orders", label: "عدد الطلبات", render: (row) => formatQty(row.orders) },
  { key: "usageDays", label: "الايام", render: (row) => row.usageDays },
  { key: "km", label: "الكيلومترات", render: (row) => formatQty(row.km) },
  { key: "invoiceOrderRate", label: "متوسط سعر الطلب", render: (row) => formatQty(row.invoiceOrderRate) },
  { key: "tier", label: "الشريحة", render: (row) => row.tier },
  { key: "collected", label: "المحصل", render: (row) => formatMoney(row.companyCollected) },
  { key: "appDeductions", label: "خصومات هنجر", className: "text-red-700", render: (row) => formatMoney(row.appDeductions) },
  { key: "collectedAfterDeductions", label: "المحصل مع المخالفات", render: (row) => formatMoney(row.collectedAfterDeductions) },
  { key: "driverOrderRate", label: "سعر الطلب", render: (row) => formatMoney(row.driverOrderRate) },
  { key: "driverKmRate", label: "سعر الكيلو", render: (row) => formatMoney(row.driverKmRate) },
  { key: "orderSalary", label: "الراتب بالطلب", render: (row) => formatMoney(row.orderSalary) },
  { key: "kmSalary", label: "الراتب بالكيلو", render: (row) => formatMoney(row.kmSalary) },
  { key: "gross", label: "الإجمالي", render: (row) => formatMoney(row.grossSalary) },
  { key: "grossSalary", label: "الراتب الاجمالي", render: (row) => formatMoney(row.grossSalary) },
  { key: "noShow", label: "غرامة عدم الحضور", render: (row) => formatMoney(row.noShowDeduction) },
  { key: "stacking", label: "خصم الطلبات المتعدده", render: (row) => formatMoney(row.stackingDeduction) },
  { key: "declined", label: "رفض طلبات", render: (row) => formatMoney(row.declinedDeduction) },
  { key: "missedDays", label: "غرامه الغياب", render: (row) => formatMoney(row.missedDaysDeduction) },
  { key: "wallet", label: "المحافظ", render: (row) => formatMoney(row.walletDeduction) },
  { key: "adminDeduction", label: "خصم اداري", render: (row) => formatMoney(row.adminDeduction) },
  { key: "carryover", label: "مرحل", render: (row) => formatMoney(row.carryoverDeduction) },
  { key: "housing", label: "سكن", render: (row) => formatMoney(row.housingDeduction) },
  { key: "trafficViolation", label: "مخالفات مروريه", render: (row) => formatMoney(row.trafficViolationDeduction) },
  { key: "fuel", label: "بنزين", render: (row) => formatMoney(row.fuelDeduction) },
  { key: "advance", label: "سلفة", render: (row) => formatMoney(row.advanceDeduction) },
  { key: "sim", label: "شريحه", render: (row) => formatMoney(row.simDeduction) },
  { key: "vehicleDamage", label: "تلفيات سياره", render: (row) => formatMoney(row.vehicleDamageDeduction) },
  { key: "accident", label: "نسبه تحمل حادث", render: (row) => formatMoney(row.accidentLiabilityDeduction) },
  { key: "userDeduction", label: "يوزر", render: (row) => formatMoney(row.userDeduction) },
  { key: "vehicleCarryover", label: "مرحل سيارات", render: (row) => formatMoney(row.vehicleCarryoverDeduction) },
  { key: "carRent", label: "ايجار سياره", render: (row) => formatMoney(row.carRentDeduction) },
  { key: "vehicleRentDays", label: "ايام السياره", render: (row) => row.vehicleRentDays },
  { key: "kafala", label: "خصومات ك", render: (row) => formatMoney(row.kafalaDeduction) },
  { key: "totalDeductions", label: "إجمالي الخصومات", className: "text-red-700", render: (row) => formatMoney(row.totalDeductions) },
  { key: "netSalary", label: "صافي الراتب", className: "text-blue-700", render: (row) => formatMoney(row.netSalary) },
  { key: "negative", label: "السوالب", className: "text-red-700", render: (row) => formatMoney(row.negativeBalance) },
  { key: "profit", label: "الفايده", className: "text-emerald-700", render: (row) => formatMoney(row.companyProfit) },
  { key: "notes", label: "ملاحظات", render: (row) => row.notes || "-" },
];

export function HungerStationPayrollClient({ initialMonth, initialProjectCode, initialApplicationProjectId }: Props) {
  const [month, setMonth] = useState(initialMonth || defaultMonth);
  const [projectCode, setProjectCode] = useState(initialProjectCode || "HUNGERSTATION-MAKKAH");
  const [applicationProjectId, setApplicationProjectId] = useState(initialApplicationProjectId || "");
  const [q, setQ] = useState("");
  const [tier, setTier] = useState("");
  const [state, setState] = useState<LoadState>("idle");
  const [data, setData] = useState<HungerStationCompanyPayrollPreview | null>(null);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [generating, setGenerating] = useState(false);
  const [details, setDetails] = useState<HungerStationCompanyPayrollRow | null>(null);
  const [editing, setEditing] = useState<HungerStationCompanyPayrollRow | null>(null);
  const [savingAdjustment, setSavingAdjustment] = useState(false);

  async function loadPreview(currentMonth = month, currentProjectCode = projectCode, currentApplicationProjectId = applicationProjectId) {
    setState("loading");
    setError("");
    setActionMessage("");
    try {
      const params = new URLSearchParams({ month: currentMonth });
      if (currentApplicationProjectId) params.set("applicationProjectId", currentApplicationProjectId);
      else if (currentProjectCode) params.set("projectCode", currentProjectCode);

      const response = await fetch(`/api/payroll/hungerstation/preview?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json()) as HungerStationCompanyPayrollPreview | { error?: string };
      if (!response.ok) throw new Error("error" in payload ? payload.error || "تعذر تحميل المسير" : "تعذر تحميل المسير");
      setData(payload as HungerStationCompanyPayrollPreview);
      setState("ready");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "تعذر تحميل مسير HungerStation");
    }
  }

  useEffect(() => {
    void loadPreview(initialMonth || defaultMonth, initialProjectCode || "HUNGERSTATION-MAKKAH", initialApplicationProjectId || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialApplicationProjectId, initialMonth, initialProjectCode]);

  const selectedProject = useMemo(() => {
    if (!data?.projects.length) return null;
    return data.projects.find((project) => project.id === applicationProjectId || project.code === projectCode) || data.projects[0] || null;
  }, [applicationProjectId, data?.projects, projectCode]);

  const rows = useMemo(() => (data?.rows ?? []).filter((row) => includesText(row, q)).filter((row) => (!tier ? true : row.tier === tier)), [data?.rows, q, tier]);

  async function saveDecision(row: Pick<HungerStationCompanyPayrollRow, "riderId" | "accountName">, decision: HungerStationPayrollDecisionType) {
    let specialOrderRate: number | undefined;
    let specialKmRate: number | undefined;
    let notes = "";

    if (decision === "SPECIAL") {
      const orderRate = window.prompt("سعر الطلب Special؟", "5");
      if (orderRate == null) return;
      const kmRate = window.prompt("سعر الكيلو Special؟", "0.50");
      if (kmRate == null) return;
      specialOrderRate = Number(orderRate);
      specialKmRate = Number(kmRate);
      notes = window.prompt("ملاحظة القرار؟", "اعتماد Special من شاشة مسير HungerStation") || "";
    }

    if (decision === "EXCLUDED") {
      const ok = window.confirm(`تخطي / استبعاد الحساب ${row.accountName || row.riderId} من المسير لهذا الشهر؟`);
      if (!ok) return;
      notes = window.prompt("سبب التخطي؟", "تخطي يدوي من المسير") || "تخطي يدوي من المسير";
    }

    if (decision === "LOW") {
      const ok = window.confirm(`اعتماد الحساب ${row.accountName || row.riderId} كأداء منخفض Low؟`);
      if (!ok) return;
      notes = "اعتماد Low من شاشة مسير HungerStation";
    }

    if (decision === "AUTO") {
      notes = "اعتماد / Auto invoice tier";
    }

    setActionMessage("جاري حفظ القرار...");
    const response = await fetch("/api/payroll/hungerstation/decisions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "SAVE_DECISION", month, riderId: row.riderId, decision, specialOrderRate, specialKmRate, notes }),
    });
    const payload = (await response.json()) as { ok?: boolean; error?: string };
    if (!response.ok || !payload.ok) {
      setActionMessage(payload.error || "تعذر حفظ القرار");
      return;
    }
    setActionMessage(decision === "EXCLUDED" ? "تم تخطي الحساب وتحديث المسير." : "تم حفظ القرار وتحديث المسير.");
    await loadPreview();
  }

  async function saveAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;

    const form = new FormData(event.currentTarget);
    const num = (name: string) => Number(form.get(name) || 0);

    setSavingAdjustment(true);
    setActionMessage("جاري حفظ تعديل الراتب...");
    try {
      const response = await fetch("/api/payroll/hungerstation/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SAVE_ADJUSTMENT",
          month,
          riderId: editing.riderId,
          rowKey: editing.rowKey,
          grossSalaryOverride: num("grossSalaryOverride"),
          adminDeduction: num("adminDeduction"),
          carryoverDeduction: num("carryoverDeduction"),
          housingDeduction: num("housingDeduction"),
          trafficViolationDeduction: num("trafficViolationDeduction"),
          fuelDeduction: num("fuelDeduction"),
          advanceDeduction: num("advanceDeduction"),
          simDeduction: num("simDeduction"),
          vehicleDamageDeduction: num("vehicleDamageDeduction"),
          accidentLiabilityDeduction: num("accidentLiabilityDeduction"),
          userDeduction: num("userDeduction"),
          vehicleCarryoverDeduction: num("vehicleCarryoverDeduction"),
          carRentDeduction: num("carRentDeduction"),
          vehicleRentDays: num("vehicleRentDays"),
          kafalaDeduction: num("kafalaDeduction"),
          notes: String(form.get("notes") || ""),
        }),
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "تعذر حفظ التعديل");
      setEditing(null);
      setActionMessage("تم حفظ تعديل الراتب والخصومات.");
      await loadPreview();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "تعذر حفظ التعديل");
    } finally {
      setSavingAdjustment(false);
    }
  }

  async function generatePayrollRun() {
    if (!selectedProject) {
      setActionMessage("اختار مشروع HungerStation أولاً.");
      return;
    }

    const hardBlocked = (data?.blocked ?? []).filter((row) => row.reason !== "EXCLUDED").length;
    if (hardBlocked) {
      setActionMessage("لا يمكن توليد المسير قبل حل الحسابات غير المعتمدة أو غير المطابقة.");
      return;
    }

    const ok = window.confirm("سيتم توليد Payroll Run كمسودة من الفاتورة وفترات AccountUsage المعتمدة فقط. نكمل؟");
    if (!ok) return;

    setGenerating(true);
    setActionMessage("");
    try {
      const response = await fetch("/api/payroll/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, appName: "HungerStation", projectId: selectedProject.id, applicationProjectId: selectedProject.id }),
      });
      const payload = (await response.json()) as { data?: GenerateResult; error?: string; details?: unknown };
      if (!response.ok) throw new Error(payload.error || "تعذر توليد المسير");
      setActionMessage(payload.data?.message || `تم توليد المسير. created=${payload.data?.created ?? 0}, updated=${payload.data?.updated ?? 0}`);
      await loadPreview();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "تعذر توليد Payroll Run");
    } finally {
      setGenerating(false);
    }
  }

  const exportHref = `/api/payroll/hungerstation/export?${new URLSearchParams({
    month,
    ...(applicationProjectId ? { applicationProjectId } : projectCode ? { projectCode } : {}),
  }).toString()}`;
  const summary = data?.summary;
  const hardBlocked = (data?.blocked ?? []).filter((row) => row.reason !== "EXCLUDED").length;

  return (
    <div className="w-full max-w-none space-y-5 bg-slate-50" dir="rtl">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm font-black text-orange-600">HungerStation Payroll</p>
            <h1 className="mt-1 text-2xl font-black text-slate-950">مسير HungerStation</h1>
            <p className="mt-2 max-w-4xl text-sm font-semibold leading-7 text-slate-600">
              نفس واجهة Keeta لكن ببيانات HungerStation: اسم المندوب هنا هو اسم حساب هنجر، والراتب يعتمد على الفاتورة + فترات الاستخدام المعتمدة.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[54rem] xl:grid-cols-5">
            <label className="grid gap-1 text-sm font-black text-slate-700">
              الشهر
              <input value={month} onChange={(event) => setMonth(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-left font-black text-slate-950 outline-none focus:border-orange-500" placeholder="2026-04" />
            </label>
            <label className="grid gap-1 text-sm font-black text-slate-700">
              المشروع
              <select
                value={applicationProjectId || projectCode}
                onChange={(event) => {
                  const selected = data?.projects.find((project) => project.id === event.target.value || project.code === event.target.value);
                  setApplicationProjectId(selected?.id || "");
                  setProjectCode(selected?.code || event.target.value);
                }}
                className="rounded-xl border border-slate-200 px-3 py-2 font-black text-slate-950 outline-none focus:border-orange-500"
              >
                <option value="">كل مشاريع HungerStation</option>
                {(data?.projects ?? []).map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-black text-slate-700">
              الشريحة
              <select value={tier} onChange={(event) => setTier(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 font-black text-slate-950 outline-none focus:border-orange-500">
                <option value="">كل المستويات</option>
                <option value="HIGH">HIGH</option>
                <option value="LOW">LOW</option>
                <option value="SPECIAL">SPECIAL</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-black text-slate-700">
              بحث
              <input value={q} onChange={(event) => setQ(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 font-black text-slate-950 outline-none focus:border-orange-500" placeholder="حساب / rider_id / مندوب..." />
            </label>
            <button type="button" onClick={() => void loadPreview()} disabled={state === "loading"} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-slate-800 disabled:opacity-60">
              {state === "loading" ? "جاري التحميل..." : "تطبيق"}
            </button>
          </div>
        </div>
      </section>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-black text-red-800">{error}</div> : null}
      {actionMessage ? <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-black text-blue-800">{actionMessage}</div> : null}

      {summary ? (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <Metric title="إجمالي الفايده / ربح الشركة" value={`${formatMoney(summary.profit)} ر.س`} tone="success" />
          <Metric title="المحصل" value={formatMoney(summary.collected)} />
          <Metric title="خصومات هنجر" value={formatMoney(summary.appDeductions)} tone="danger" />
          <Metric title="صافي الرواتب" value={formatMoney(summary.netSalary)} />
          <Metric title="إجمالي الخصومات" value={formatMoney(summary.deductions)} tone="danger" />
          <Metric title="السوالب" value={formatMoney(summary.negatives)} tone={summary.negatives > 0 ? "danger" : "default"} />
          <Metric title="عدد الصفوف" value={String(summary.rows)} />
          <Metric title="حسابات تحتاج مراجعة" value={String(hardBlocked)} tone={hardBlocked ? "danger" : "success"} />
          <Metric title="High" value={String(summary.tierCounts.HIGH)} tone="success" />
          <Metric title="Low" value={String(summary.tierCounts.LOW)} tone="warning" />
          <Metric title="Special" value={String(summary.tierCounts.SPECIAL)} />
          <Metric title="حسابات مشتركة" value={String(summary.sharedAccounts)} />
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-950">إجراءات المسير</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">التصدير والتوليد يستخدمان نفس البيانات ونفس الحسبة الظاهرة في الجدول.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setQ("");
                setTier("");
              }}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50"
            >
              مسح الفلاتر
            </button>
            <a href={exportHref} className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700 hover:bg-emerald-100">
              تصدير CSV
            </a>
            <button type="button" onClick={() => void generatePayrollRun()} disabled={generating || Boolean(hardBlocked)} className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-black text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50">
              {generating ? "جاري التوليد..." : "توليد Payroll Run"}
            </button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4">
          <h2 className="text-lg font-black text-slate-950">مسير المندوبين</h2>
          <p className="mt-1 text-xs font-bold text-slate-500">كل تفاصيل المسير ظاهرة في الجدول. المعروض: {rows.length} من {data?.rows.length ?? 0}</p>
        </div>
        <div className="max-h-[72vh] overflow-auto">
          <table className="w-full min-w-[5200px] text-right text-xs">
            <thead className="sticky top-0 z-20 bg-slate-100 font-black text-slate-600 shadow-sm">
              <tr>
                <th className="sticky right-0 z-30 min-w-[220px] bg-slate-100 px-3 py-3">اسم المندوب</th>
                {tableColumns.map((column) => (
                  <th key={column.key} className="min-w-[118px] whitespace-nowrap px-3 py-3">
                    {column.label}
                  </th>
                ))}
                <th className="sticky left-0 z-30 min-w-[280px] bg-slate-100 px-3 py-3">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, index) => (
                <tr key={`${row.rowKey}-${index}`} className="hover:bg-slate-50/70">
                  <td className="sticky right-0 z-10 bg-white px-3 py-3 align-top shadow-[-12px_0_18px_-18px_rgba(15,23,42,0.75)]">
                    <div className="font-black text-slate-950">{row.accountName}</div>
                    <div className="mt-1 font-bold text-slate-500">فعليًا: {row.actualDriverName}</div>
                    <div className="mt-1 font-bold text-slate-500">{row.city}</div>
                    <span className={`mt-2 inline-flex rounded-full px-2 py-1 font-black ring-1 ${tierBadge(row.tier)}`}>{row.tier}</span>
                  </td>
                  {tableColumns.map((column) => (
                    <td key={column.key} className={`whitespace-nowrap px-3 py-3 align-top font-bold ${column.className || "text-slate-800"}`}>
                      {column.render(row)}
                    </td>
                  ))}
                  <td className="sticky left-0 z-10 bg-white px-3 py-3 align-top shadow-[12px_0_18px_-18px_rgba(15,23,42,0.75)]">
                    <div className="flex min-w-[250px] flex-wrap gap-1">
                      <button type="button" onClick={() => setDetails(row)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-black text-slate-700 hover:bg-slate-50">
                        تفاصيل
                      </button>
                      <button type="button" onClick={() => void saveDecision(row, "EXCLUDED")} className="rounded-lg bg-blue-600 px-2 py-1 font-black text-white hover:bg-blue-700">
                        تخطي
                      </button>
                      <button type="button" onClick={() => void saveDecision(row, row.decision === "SPECIAL" ? "SPECIAL" : "AUTO")} className="rounded-lg bg-emerald-600 px-2 py-1 font-black text-white hover:bg-emerald-700">
                        اعتمد
                      </button>
                      <button type="button" onClick={() => setEditing(row)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-black text-slate-700 hover:bg-slate-50">
                        إعداد حساب
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={tableColumns.length + 2} className="px-3 py-12 text-center text-sm font-black text-slate-400">
                    لا توجد صفوف مسير جاهزة لهذا الاختيار.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {data?.blocked.length ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm">
          <h2 className="text-lg font-black text-red-900">حسابات للمراجعة / مستبعدة</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[900px] text-right text-sm">
              <thead className="text-xs font-black text-red-700">
                <tr>
                  <th className="px-3 py-2">الحساب</th>
                  <th className="px-3 py-2">المشروع</th>
                  <th className="px-3 py-2">السبب</th>
                  <th className="px-3 py-2">الرسالة</th>
                  <th className="px-3 py-2">قرار</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-100">
                {data.blocked.map((row) => (
                  <tr key={`${row.riderId}-${row.reason}`}>
                    <td className="px-3 py-2 font-black">{row.account || row.riderId}</td>
                    <td className="px-3 py-2 font-bold">{row.project || "-"}</td>
                    <td className="px-3 py-2 font-black">{row.reason}</td>
                    <td className="px-3 py-2 font-semibold">{row.message}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        <button onClick={() => void saveDecision({ riderId: row.riderId, accountName: row.account || row.riderId }, "LOW")} className="rounded-lg bg-white px-2 py-1 text-xs font-black text-amber-700 ring-1 ring-amber-200">
                          اعتماد Low
                        </button>
                        <button onClick={() => void saveDecision({ riderId: row.riderId, accountName: row.account || row.riderId }, "SPECIAL")} className="rounded-lg bg-white px-2 py-1 text-xs font-black text-violet-700 ring-1 ring-violet-200">
                          Special
                        </button>
                        <button onClick={() => void saveDecision({ riderId: row.riderId, accountName: row.account || row.riderId }, "AUTO")} className="rounded-lg bg-white px-2 py-1 text-xs font-black text-slate-700 ring-1 ring-slate-200">
                          Auto
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {details ? <DetailsModal row={details} onClose={() => setDetails(null)} /> : null}
      {editing ? <EditModal row={editing} onClose={() => setEditing(null)} onSubmit={saveAdjustment} saving={savingAdjustment} /> : null}
    </div>
  );
}

function Metric({ title, value, tone = "default" }: { title: string; value: string; tone?: "default" | "success" | "warning" | "danger" }) {
  const classes = {
    default: "border-slate-200 bg-white text-slate-950",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    danger: "border-red-200 bg-red-50 text-red-800",
  }[tone];

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${classes}`}>
      <p className="text-xs font-black opacity-70">{title}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  );
}

function DetailsModal({ row, onClose }: { row: HungerStationCompanyPayrollRow; onClose: () => void }) {
  const items: Array<[string, string | number]> = [
    ["اسم حساب هنجر", row.accountName],
    ["المندوب الفعلي", row.actualDriverName],
    ["rider_id", row.riderId],
    ["المدينة", row.city],
    ["الشريحة", row.tier],
    ["نوع العلاقة", row.contractType || "-"],
    ["نوع السيارة", row.vehicleOwnershipType || "-"],
    ["فريلانسر", row.isFreelancer ? "نعم" : "لا"],
    ["سيارة شخصية", row.isPersonalCar ? "نعم" : "لا"],
    ["يوزر تلقائي", formatMoney(row.autoUserDeduction)],
    ["فترة الاستخدام", `${row.from || "-"} → ${row.to || "-"}`],
    ["المحصل", formatMoney(row.companyCollected)],
    ["خصومات هنجر", formatMoney(row.appDeductions)],
    ["المحصل مع المخالفات", formatMoney(row.collectedAfterDeductions)],
    ["الراتب الإجمالي", formatMoney(row.grossSalary)],
    ["إجمالي الخصومات", formatMoney(row.totalDeductions)],
    ["صافي الراتب", formatMoney(row.netSalary)],
    ["ربح الشركة", formatMoney(row.companyProfit)],
    ["ملاحظات", row.notes || "-"],
  ];

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[88vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black text-slate-950">تفاصيل مسير {row.accountName}</h2>
            <p className="text-sm font-bold text-slate-500">{row.riderId} · {row.city} · {row.tier}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700">
            إغلاق
          </button>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <Metric title="الراتب الإجمالي" value={formatMoney(row.grossSalary)} tone="success" />
          <Metric title="صافي الراتب" value={formatMoney(row.netSalary)} tone={row.netSalary < 0 ? "danger" : "default"} />
          <Metric title="ربح الشركة" value={formatMoney(row.companyProfit)} tone="success" />
          <Metric title="إجمالي الخصومات" value={formatMoney(row.totalDeductions)} tone="danger" />
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {items.map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs font-black text-slate-500">{label}</p>
              <p className="mt-1 text-sm font-black text-slate-950">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EditModal({ row, onClose, onSubmit, saving }: { row: HungerStationCompanyPayrollRow; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; saving: boolean }) {
  const fields: Array<[string, keyof HungerStationCompanyPayrollRow, string]> = [
    ["الراتب الاجمالي", "grossSalary", "grossSalaryOverride"],
    ["خصم اداري", "adminDeduction", "adminDeduction"],
    ["مرحل", "carryoverDeduction", "carryoverDeduction"],
    ["سكن", "housingDeduction", "housingDeduction"],
    ["مخالفات مروريه", "trafficViolationDeduction", "trafficViolationDeduction"],
    ["بنزين", "fuelDeduction", "fuelDeduction"],
    ["سلفة", "advanceDeduction", "advanceDeduction"],
    ["شريحه", "simDeduction", "simDeduction"],
    ["تلفيات سياره", "vehicleDamageDeduction", "vehicleDamageDeduction"],
    ["نسبه تحمل حادث", "accidentLiabilityDeduction", "accidentLiabilityDeduction"],
    ["يوزر", "userDeduction", "userDeduction"],
    ["مرحل سيارات", "vehicleCarryoverDeduction", "vehicleCarryoverDeduction"],
    ["ايجار سياره", "carRentDeduction", "carRentDeduction"],
    ["ايام السياره", "vehicleRentDays", "vehicleRentDays"],
    ["خصومات ك / كفالة", "kafalaDeduction", "kafalaDeduction"],
  ];

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
      <form onSubmit={onSubmit} className="max-h-[88vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black text-slate-950">إعداد حساب / تعديل راتب</h2>
            <p className="text-sm font-bold text-slate-500">{row.accountName} · {row.riderId}</p>
            <p className="mt-1 text-xs font-bold text-slate-500">لو المندوب فريلانسر يضاف 200 في اليوزر، ولو سيارة شخصية يضاف 300 في اليوزر. يمكنك تعديل اليوزر يدويًا من هنا.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700">
            إغلاق
          </button>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {fields.map(([label, key, name]) => (
            <label key={name} className="grid gap-1 text-xs font-black text-slate-800">
              {label}
              <input name={name} type="number" step="0.01" defaultValue={Number(row[key] || 0)} className="h-10 rounded-xl border border-slate-200 px-3" />
            </label>
          ))}
          <label className="grid gap-1 text-xs font-black text-slate-800 md:col-span-3">
            ملاحظات التعديل
            <input name="notes" defaultValue={row.adjustmentNotes || ""} className="h-10 rounded-xl border border-slate-200 px-3" />
          </label>
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800">
            إلغاء
          </button>
          <button type="submit" disabled={saving} className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-black text-white disabled:opacity-60">
            {saving ? "جاري الحفظ..." : "حفظ التعديل"}
          </button>
        </div>
      </form>
    </div>
  );
}
