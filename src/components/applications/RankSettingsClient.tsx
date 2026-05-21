"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { MetricCard } from "@/components/analytics/MetricCard";
import { RankSettingsTable } from "./RankSettingsTable";
import type { RankSettingRow, RankSettingsData } from "@/lib/applications/rankSettings";

type Props = {
  data: RankSettingsData;
  basePath: string;
  lockedApplicationId?: string;
  lockedProjectId?: string;
};

type ModalState =
  | { type: "form"; mode: "create" | "edit"; row?: RankSettingRow }
  | { type: "details"; row: RankSettingRow }
  | null;

const featureMessage = "هذه الميزة قيد التطوير";

const defaultOnTimeRule = { excellent: { min: 99 }, good: { min: 95 }, weak: { max: 94.99 } };
const defaultCancellationRule = { valid: { max: 0 }, invalid: { min: 0.01 } };
const defaultRejectionRule = { valid: { max: 0 }, invalid: { min: 0.01 } };
const defaultWorkingHoursRule = { excellent: { min: 10 }, good: { min: 8 }, weak: { max: 7.99 } };
const defaultBonusRule = { levelA: 1000, levelB: 500, levelC: 0 };
const defaultDeductionRule = { belowTarget: "review", highCancellation: "review" };
const defaultLevelOutput = [
  { level: "Level A", minOrders: 400, minOnTime: 99, maxCancellation: 0, maxRejection: 0 },
  { level: "Level B", minOrders: 300, minOnTime: 95 },
  { level: "Level C", maxOrders: 299 },
];

function jsonText(value: unknown, fallback: unknown) {
  return JSON.stringify(value ?? fallback, null, 2);
}

function parseJsonField(form: FormData, key: string) {
  const raw = String(form.get(key) ?? "").trim();
  if (!raw) return null;
  return JSON.parse(raw) as unknown;
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-5 left-5 z-[80] flex max-w-sm items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-800 shadow-2xl">
      <span>{message}</span>
      <button type="button" onClick={onClose} className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
        إغلاق
      </button>
    </div>
  );
}

function JsonPreview({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <h4 className="text-xs font-black text-slate-500">{title}</h4>
      <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-left text-xs text-slate-700" dir="ltr">
        {JSON.stringify(value ?? null, null, 2)}
      </pre>
    </div>
  );
}

export function RankSettingsClient({ data, basePath, lockedApplicationId, lockedProjectId }: Props) {
  const router = useRouter();
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState<ModalState>(null);
  const [saving, setSaving] = useState(false);

  const lockedApplication = data.applications.find((app) => app.id === lockedApplicationId);
  const lockedProject = data.projects.find((project) => project.id === lockedProjectId);

  const cards = useMemo(
    () => [
      ["إجمالي إعدادات الرانك", data.summary.total, "slate"],
      ["إعدادات Keeta", data.summary.keeta, "amber"],
      ["إعدادات HungerStation", data.summary.hungerstation, "orange"],
      ["إعدادات Talabat", data.summary.talabat, "blue"],
      ["إعدادات نشطة", data.summary.active, "emerald"],
      ["إعدادات تحتاج مراجعة", data.summary.needsReview, data.summary.needsReview ? "red" : "emerald"],
    ] as const,
    [data.summary],
  );

  function pushFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    for (const key of ["applicationId", "applicationProjectId", "rankType", "status", "q"]) {
      const value = String(form.get(key) ?? "").trim();
      if (value) params.set(key, value);
    }
    router.push(params.toString() ? `${basePath}?${params}` : basePath);
  }

  async function submitSetting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    try {
      const payload = {
        name: String(form.get("name") ?? "").trim(),
        applicationId: lockedApplicationId || String(form.get("applicationId") ?? ""),
        applicationProjectId: lockedProjectId || String(form.get("applicationProjectId") ?? ""),
        rankType: String(form.get("rankType") ?? "").trim(),
        minimumOrders: String(form.get("minimumOrders") ?? "").trim(),
        status: String(form.get("status") ?? "ACTIVE"),
        onTimeRule: parseJsonField(form, "onTimeRule"),
        cancellationRule: parseJsonField(form, "cancellationRule"),
        rejectionRule: parseJsonField(form, "rejectionRule"),
        workingHoursRule: parseJsonField(form, "workingHoursRule"),
        bonusRule: parseJsonField(form, "bonusRule"),
        deductionRule: parseJsonField(form, "deductionRule"),
        levelOutput: parseJsonField(form, "levelOutput"),
      };
      const endpoint = modal?.type === "form" && modal.mode === "edit" && modal.row ? `/api/rank-settings/${modal.row.id}` : "/api/rank-settings";
      const res = await fetch(endpoint, {
        method: modal?.type === "form" && modal.mode === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "تعذر حفظ إعداد الرانك");
      setToast("تم حفظ إعداد الرانك بنجاح");
      setModal(null);
      router.refresh();
    } catch (error) {
      setToast(error instanceof Error ? error.message : "تعذر حفظ إعداد الرانك");
    } finally {
      setSaving(false);
    }
  }

  async function copySetting(row: RankSettingRow) {
    setSaving(true);
    try {
      const res = await fetch("/api/rank-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${row.name} - نسخة`,
          applicationId: row.applicationId,
          applicationProjectId: row.applicationProjectId,
          rankType: row.rankType === "-" ? "" : row.rankType,
          minimumOrders: row.minimumOrders,
          status: "ACTIVE",
          onTimeRule: row.onTimeRuleRaw,
          cancellationRule: row.cancellationRuleRaw,
          rejectionRule: row.rejectionRuleRaw,
          workingHoursRule: row.workingHoursRuleRaw,
          bonusRule: row.bonusRule,
          deductionRule: row.deductionRule,
          levelOutput: row.levelOutputRaw,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "تعذر نسخ الإعداد");
      setToast("تم نسخ إعداد الرانك");
      router.refresh();
    } catch (error) {
      setToast(error instanceof Error ? error.message : "تعذر نسخ الإعداد");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(row: RankSettingRow) {
    const nextStatus = row.status === "نشط" ? "INACTIVE" : "ACTIVE";
    const res = await fetch(`/api/rank-settings/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (!res.ok) {
      setToast("تعذر تحديث حالة الإعداد");
      return;
    }
    setToast("تم تحديث حالة الإعداد");
    router.refresh();
  }

  function handleAction(action: string, row: RankSettingRow) {
    if (action === "عرض التفاصيل") setModal({ type: "details", row });
    else if (action === "تعديل") setModal({ type: "form", mode: "edit", row });
    else if (action === "نسخ") void copySetting(row);
    else if (action === "تعطيل / تفعيل") void toggleStatus(row);
    else if (action === "استيراد Rank لو التطبيق Keeta") {
      if (row.applicationCode.toLowerCase().includes("keeta") || row.applicationName.toLowerCase().includes("keeta")) router.push("/applications/keeta/rank");
      else setToast("استيراد Keeta Rank متاح لتطبيق Keeta فقط");
    } else setToast(featureMessage);
  }

  if (data.databaseStatus === "offline") {
    return (
      <section className="w-full max-w-none space-y-4 bg-slate-50" dir="rtl">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-2xl font-black text-red-950">قاعدة البيانات غير متصلة</h1>
          <p className="mt-2 text-sm font-bold text-red-800">{data.databaseMessage}</p>
          <button type="button" onClick={() => router.refresh()} className="mt-4 rounded-xl bg-red-700 px-5 py-2 text-sm font-black text-white">تحديث الصفحة</button>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full max-w-none space-y-5 bg-slate-50" dir="rtl">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <nav className="mb-2 flex flex-wrap items-center gap-2 text-xs font-black text-slate-500">
              <Link href="/" className="hover:text-slate-950">الرئيسية</Link>
              <span>/</span>
              <Link href="/applications" className="hover:text-slate-950">مركز التطبيقات</Link>
              <span>/</span>
              <span className="text-slate-800">إعدادات الرانك</span>
            </nav>
            <h1 className="text-3xl font-black text-slate-950">إعدادات الرانك</h1>
            <p className="mt-2 max-w-5xl text-sm font-bold leading-7 text-slate-600">
              إدارة قواعد الرانك والتقييم لكل تطبيق ومشروع، مع دعم Keeta Rank وقواعد الـ Levels.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setModal({ type: "form", mode: "create" })} className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-black text-white shadow-sm hover:bg-amber-700">إضافة Rank Setting</button>
            <button type="button" onClick={() => setToast(featureMessage)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 shadow-sm hover:bg-slate-50">نسخ من مشروع آخر</button>
            <button type="button" onClick={() => setToast(featureMessage)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 shadow-sm hover:bg-slate-50">اختبار الرانك</button>
            <button type="button" onClick={() => router.refresh()} className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white shadow-sm hover:bg-slate-800">تحديث</button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {cards.map(([title, value, tone]) => <MetricCard key={title} title={title} value={value} tone={tone} />)}
      </div>

      <form onSubmit={pushFilters} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label className="space-y-1 text-xs font-black text-slate-600">
            <span>التطبيق</span>
            {lockedApplication ? (
              <input name="applicationLabel" value={lockedApplication.name} disabled className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm" />
            ) : (
              <select name="applicationId" defaultValue={data.filters.applicationId} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                <option value="">كل التطبيقات</option>
                {data.applications.map((app) => <option key={app.id} value={app.id}>{app.name}</option>)}
              </select>
            )}
          </label>
          <label className="space-y-1 text-xs font-black text-slate-600">
            <span>المشروع</span>
            {lockedProject ? (
              <input name="projectLabel" value={lockedProject.name} disabled className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm" />
            ) : (
              <select name="applicationProjectId" defaultValue={data.filters.applicationProjectId} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                <option value="">كل المشاريع</option>
                {data.projects.map((project) => <option key={project.id} value={project.id}>{project.name} - {project.applicationName}</option>)}
              </select>
            )}
          </label>
          <label className="space-y-1 text-xs font-black text-slate-600">
            <span>نوع الرانك</span>
            <select name="rankType" defaultValue={data.filters.rankType} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
              <option value="">كل الأنواع</option>
              {data.rankTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs font-black text-slate-600">
            <span>الحالة</span>
            <select name="status" defaultValue={data.filters.status} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
              <option value="">كل الحالات</option>
              <option value="ACTIVE">نشط</option>
              <option value="INACTIVE">غير نشط</option>
              <option value="PENDING">قيد المراجعة</option>
            </select>
          </label>
          <label className="space-y-1 text-xs font-black text-slate-600 xl:col-span-2">
            <span>بحث باسم الإعداد</span>
            <input name="q" defaultValue={data.filters.q} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="اسم الإعداد / التطبيق / المشروع" />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="submit" className="rounded-xl bg-slate-950 px-5 py-2 text-sm font-black text-white">تطبيق الفلاتر</button>
          <Link href={basePath} className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-black text-slate-700">إعادة ضبط</Link>
        </div>
      </form>

      <RankSettingsTable rows={data.rows} onAction={handleAction} />

      {modal?.type === "details" ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-4">
          <div className="mx-auto max-w-5xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-950">{modal.row.name}</h2>
                <p className="mt-1 text-sm font-bold text-slate-500">{modal.row.applicationName} / {modal.row.projectName}</p>
              </div>
              <button type="button" onClick={() => setModal(null)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-black">إغلاق</button>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <JsonPreview title="On Time Rule" value={modal.row.onTimeRuleRaw} />
              <JsonPreview title="Cancellation Rule" value={modal.row.cancellationRuleRaw} />
              <JsonPreview title="Rejection Rule" value={modal.row.rejectionRuleRaw} />
              <JsonPreview title="Working Hours Rule" value={modal.row.workingHoursRuleRaw} />
              <JsonPreview title="Bonus Rule" value={modal.row.bonusRule} />
              <JsonPreview title="Deduction Rule" value={modal.row.deductionRule} />
              <JsonPreview title="Level Output" value={modal.row.levelOutputRaw} />
            </div>
          </div>
        </div>
      ) : null}

      {modal?.type === "form" ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-4">
          <form onSubmit={submitSetting} className="mx-auto max-w-6xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-950">{modal.mode === "edit" ? "تعديل إعداد رانك" : "إضافة إعداد رانك"}</h2>
                <p className="mt-1 text-sm font-bold text-slate-500">قواعد الرانك تحفظ كـ JSON داخل PostgreSQL، ولا يتم استخدام أرقام وهمية.</p>
              </div>
              <button type="button" onClick={() => setModal(null)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-black">إلغاء</button>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <label htmlFor="rank-name" className="space-y-1 text-xs font-black text-slate-600 xl:col-span-2">
                <span>Name</span>
                <input id="rank-name" name="name" required defaultValue={modal.row?.name ?? ""} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              </label>
              <label htmlFor="rank-application" className="space-y-1 text-xs font-black text-slate-600">
                <span>Application</span>
                <select id="rank-application" name="applicationId" required disabled={Boolean(lockedApplicationId)} defaultValue={lockedApplicationId ?? modal.row?.applicationId ?? data.applications[0]?.id ?? ""} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                  {data.applications.map((app) => <option key={app.id} value={app.id}>{app.name}</option>)}
                </select>
              </label>
              <label htmlFor="rank-project" className="space-y-1 text-xs font-black text-slate-600">
                <span>Application Project</span>
                <select id="rank-project" name="applicationProjectId" disabled={Boolean(lockedProjectId)} defaultValue={lockedProjectId ?? modal.row?.applicationProjectId ?? ""} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                  <option value="">كل المشاريع</option>
                  {data.projects.map((project) => <option key={project.id} value={project.id}>{project.name} - {project.applicationName}</option>)}
                </select>
              </label>
              <label htmlFor="rank-type" className="space-y-1 text-xs font-black text-slate-600">
                <span>Rank Type</span>
                <input id="rank-type" name="rankType" defaultValue={modal.row?.rankType === "-" ? "" : modal.row?.rankType ?? "monthly"} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="monthly / keeta_rank" />
              </label>
              <label htmlFor="minimum-orders" className="space-y-1 text-xs font-black text-slate-600">
                <span>Minimum Orders</span>
                <input id="minimum-orders" name="minimumOrders" type="number" min="0" defaultValue={modal.row?.minimumOrders ?? 400} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              </label>
              <label htmlFor="rank-status" className="space-y-1 text-xs font-black text-slate-600">
                <span>Status</span>
                <select id="rank-status" name="status" defaultValue={modal.row?.status === "غير نشط" ? "INACTIVE" : "ACTIVE"} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                  <option value="ACTIVE">نشط</option>
                  <option value="INACTIVE">غير نشط</option>
                  <option value="PENDING">قيد المراجعة</option>
                </select>
              </label>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {[
                ["onTimeRule", "On Time Rule", defaultOnTimeRule, modal.row?.onTimeRuleRaw],
                ["cancellationRule", "Cancellation Rule", defaultCancellationRule, modal.row?.cancellationRuleRaw],
                ["rejectionRule", "Rejection Rule", defaultRejectionRule, modal.row?.rejectionRuleRaw],
                ["workingHoursRule", "Working Hours Rule", defaultWorkingHoursRule, modal.row?.workingHoursRuleRaw],
                ["bonusRule", "Bonus Rule", defaultBonusRule, modal.row?.bonusRule],
                ["deductionRule", "Deduction Rule", defaultDeductionRule, modal.row?.deductionRule],
                ["levelOutput", "Level Output", defaultLevelOutput, modal.row?.levelOutputRaw],
              ].map(([name, label, fallback, current]) => (
                <label key={String(name)} htmlFor={`rank-${name}`} className="space-y-1 text-xs font-black text-slate-600">
                  <span>{String(label)}</span>
                  <textarea id={`rank-${name}`} name={String(name)} rows={7} dir="ltr" defaultValue={jsonText(current, fallback)} className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs" />
                </label>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setModal(null)} className="rounded-xl border border-slate-200 px-5 py-2 text-sm font-black text-slate-700">إلغاء</button>
              <button type="submit" disabled={saving || !data.applications.length} className="rounded-xl bg-amber-600 px-5 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60">
                {saving ? "جاري الحفظ..." : "حفظ الإعداد"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {toast ? <Toast message={toast} onClose={() => setToast("")} /> : null}
    </section>
  );
}
