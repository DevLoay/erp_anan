"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type Option = { id: string; name?: string; code?: string; nameAr?: string; nameEn?: string | null; applicationId?: string | null; cityId?: string | null };

type AccountIssueRow = {
  id: string;
  appName: string;
  appUserId: string | null;
  appUsername: string | null;
  username: string;
  applicationName: string;
  applicationProjectName: string;
  cityName: string;
  driverName: string;
  needsReview: boolean;
  unmatchedReason: string | null;
  status: string;
};

type UsageReviewRow = {
  id: string;
  month: string;
  applicationName: string;
  applicationProjectName: string;
  cityName: string;
  appUserId: string;
  accountName: string;
  accountOwner: string;
  actualWorkers: string[];
  dailyRecordsCount: number;
  invoiceExists: boolean;
  completedOrders: number;
  actualWorkingHours: number;
  riskLevel: string;
  reviewReason: string;
  status: string;
  applicationAccountId: string;
};

type Props = {
  filters: { month?: string; applicationId?: string; applicationProjectId?: string; cityId?: string; q?: string };
  options: { applications: Option[]; projects: Option[]; cities: Option[] };
  accountIssueRows: AccountIssueRow[];
  reviewRows: UsageReviewRow[];
  readiness: {
    invoiceRecords: number;
    dailyRecords: number;
    matchedAccounts: number;
    matchedDrivers: number;
    missingActualWorkers: number;
    sharedAccountWarnings: number;
    criticalConflicts: number;
    invoiceWithoutDaily: number;
    dailyWithoutInvoice: number;
  };
};

function riskClass(value: string) {
  if (value === "CRITICAL") return "border-red-200 bg-red-50 text-red-800";
  if (value === "HIGH") return "border-orange-200 bg-orange-50 text-orange-800";
  if (value === "MEDIUM") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-emerald-200 bg-emerald-50 text-emerald-800";
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    PENDING: "قيد المراجعة",
    APPROVED: "معتمد",
    REJECTED: "مرفوض",
    ARCHIVED: "مؤرشف",
    MATCHED: "مطابق",
    NEEDS_REVIEW: "يحتاج مراجعة",
    ACTIVE: "نشط",
    INACTIVE: "موقوف",
  };
  return labels[value] || value || "-";
}

function optionLabel(option: Option) {
  return option.nameAr || option.nameEn || option.name || option.code || option.id;
}

export function ApplicationAccountReviewClient({ filters, options, accountIssueRows, reviewRows, readiness }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");

  const filteredProjects = useMemo(() => {
    if (!filters.applicationId) return options.projects;
    return options.projects.filter((project) => project.applicationId === filters.applicationId);
  }, [filters.applicationId, options.projects]);

  function applyFilters(formData: FormData) {
    const query = new URLSearchParams();
    for (const key of ["month", "applicationId", "applicationProjectId", "cityId", "q"]) {
      const value = String(formData.get(key) || "").trim();
      if (value) query.set(key, value);
    }
    router.push(`/settings/application-account-review?${query.toString()}`);
  }

  async function runCleanup(dryRun = false) {
    setBusy(dryRun ? "dry" : "cleanup");
    setMessage("");
    try {
      const response = await fetch("/api/application-accounts/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "تعذر تشغيل الإصلاح.");
      setMessage(
        dryRun
          ? `معاينة الإصلاح: ${payload.data.beforeNeedsLinking} حساب يحتاج ربط.`
          : `تم الإصلاح: قبل ${payload.data.beforeNeedsLinking} / بعد ${payload.data.afterNeedsLinking}.`,
      );
      if (!dryRun) router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر تشغيل الإصلاح.");
    } finally {
      setBusy("");
    }
  }

  async function usageAction(id: string, action: string) {
    setBusy(`${action}-${id}`);
    setMessage("");
    try {
      const response = await fetch(`/api/account-usages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "تعذر تنفيذ الإجراء.");
      setMessage("تم تنفيذ الإجراء بنجاح.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر تنفيذ الإجراء.");
    } finally {
      setBusy("");
    }
  }

  async function accountAction(id: string, action: string) {
    setBusy(`${action}-${id}`);
    setMessage("");
    try {
      const response = await fetch(`/api/application-accounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "تعذر تنفيذ الإجراء.");
      setMessage(payload.blocked ? `تم تعطيل الحساب بدل الحذف لوجود ${payload.linkedRecords} سجلات مرتبطة.` : "تم تنفيذ الإجراء بنجاح.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر تنفيذ الإجراء.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-slate-950">مراجعة ربط حسابات التطبيقات</h1>
            <p className="mt-1 text-sm font-bold text-slate-500">
              فصل مالك الحساب عن العامل الفعلي، ومراجعة حسابات HungerStation المشتركة بدون خلطها مع Keeta.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button disabled={Boolean(busy)} onClick={() => runCleanup(true)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black">
              معاينة الإصلاح
            </button>
            <button disabled={Boolean(busy)} onClick={() => runCleanup(false)} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white">
              إصلاح تلقائي
            </button>
          </div>
        </div>
        {message ? <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900">{message}</div> : null}
      </section>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          applyFilters(new FormData(event.currentTarget));
        }}
        className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-6"
      >
        <label className="grid gap-1 text-xs font-black text-slate-600">
          الشهر
          <input name="month" type="month" defaultValue={filters.month || ""} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold" />
        </label>
        <label className="grid gap-1 text-xs font-black text-slate-600">
          التطبيق
          <select name="applicationId" defaultValue={filters.applicationId || ""} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold">
            <option value="">كل التطبيقات</option>
            {options.applications.map((option) => <option key={option.id} value={option.id}>{optionLabel(option)}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-black text-slate-600">
          مشروع التشغيل
          <select name="applicationProjectId" defaultValue={filters.applicationProjectId || ""} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold">
            <option value="">كل المشاريع</option>
            {filteredProjects.map((option) => <option key={option.id} value={option.id}>{optionLabel(option)}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-black text-slate-600">
          المدينة
          <select name="cityId" defaultValue={filters.cityId || ""} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold">
            <option value="">كل المدن</option>
            {options.cities.map((option) => <option key={option.id} value={option.id}>{optionLabel(option)}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-black text-slate-600">
          بحث
          <input name="q" defaultValue={filters.q || ""} placeholder="App User ID / مندوب / حساب" className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold" />
        </label>
        <div className="flex items-end gap-2">
          <button className="h-11 flex-1 rounded-xl bg-slate-950 px-4 text-sm font-black text-white">تطبيق</button>
          <button type="button" onClick={() => router.push("/settings/application-account-review")} className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black">
            مسح
          </button>
        </div>
      </form>

      <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
        <Metric title="فواتير HS" value={readiness.invoiceRecords} />
        <Metric title="تقارير يومية HS" value={readiness.dailyRecords} />
        <Metric title="حسابات مطابقة" value={readiness.matchedAccounts} />
        <Metric title="مناديب مطابقة" value={readiness.matchedDrivers} />
        <Metric title="عامل فعلي ناقص" value={readiness.missingActualWorkers} tone="amber" />
        <Metric title="حسابات مشتركة" value={readiness.sharedAccountWarnings} tone="orange" />
        <Metric title="مخاطر حرجة" value={readiness.criticalConflicts} tone="red" />
        <Metric title="فواتير بلا يومي" value={readiness.invoiceWithoutDaily} tone="blue" />
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4">
          <h2 className="text-lg font-black text-slate-950">الاستخدام الفعلي للحسابات</h2>
          <p className="mt-1 text-xs font-bold text-slate-500">يعرض الحساب، مالكه، من اشتغل عليه فعليًا، وهل توجد مشاركة أو نقص يحتاج اعتماد.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1500px] text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                {["الشهر", "التطبيق", "المشروع", "المدينة", "App User ID", "اسم الحساب", "مالك الحساب", "العامل الفعلي", "تقارير يومية", "فاتورة", "الطلبات", "الساعات", "المخاطر", "سبب المراجعة", "الحالة", "إجراءات"].map((header) => (
                  <th key={header} className="whitespace-nowrap px-3 py-3 text-right font-black">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reviewRows.length ? reviewRows.map((row) => (
                <tr key={`${row.id}-${row.applicationAccountId}`} className="border-t border-slate-100">
                  <td className="whitespace-nowrap px-3 py-3 font-bold">{row.month}</td>
                  <td className="whitespace-nowrap px-3 py-3">{row.applicationName}</td>
                  <td className="whitespace-nowrap px-3 py-3">{row.applicationProjectName}</td>
                  <td className="whitespace-nowrap px-3 py-3">{row.cityName}</td>
                  <td className="whitespace-nowrap px-3 py-3 font-black">{row.appUserId}</td>
                  <td className="whitespace-nowrap px-3 py-3">{row.accountName}</td>
                  <td className="whitespace-nowrap px-3 py-3">{row.accountOwner}</td>
                  <td className="min-w-[220px] px-3 py-3">{row.actualWorkers.length ? row.actualWorkers.join("، ") : "-"}</td>
                  <td className="whitespace-nowrap px-3 py-3">{row.dailyRecordsCount}</td>
                  <td className="whitespace-nowrap px-3 py-3">{row.invoiceExists ? "نعم" : "لا"}</td>
                  <td className="whitespace-nowrap px-3 py-3">{row.completedOrders.toLocaleString("ar-SA")}</td>
                  <td className="whitespace-nowrap px-3 py-3">{row.actualWorkingHours.toLocaleString("ar-SA")}</td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <span className={`rounded-full border px-3 py-1 text-xs font-black ${riskClass(row.riskLevel)}`}>{row.riskLevel}</span>
                  </td>
                  <td className="min-w-[260px] px-3 py-3 text-rose-700">{row.reviewReason || "-"}</td>
                  <td className="whitespace-nowrap px-3 py-3">{statusLabel(row.status)}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button disabled={Boolean(busy)} onClick={() => usageAction(row.id, "approve")} className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-black text-white">اعتماد</button>
                      <button disabled={Boolean(busy)} onClick={() => usageAction(row.id, "reject")} className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-black">رفض</button>
                      <button disabled={Boolean(busy)} onClick={() => accountAction(row.applicationAccountId, "sendReview")} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-black text-amber-800">مراجعة</button>
                      <button disabled={Boolean(busy)} onClick={() => accountAction(row.applicationAccountId, "suspend")} className="rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs font-black text-red-800">تعليق</button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={16} className="px-4 py-10 text-center font-bold text-slate-500">لا يوجد استخدام فعلي لهذا الشهر حسب الفلاتر الحالية.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4">
          <h2 className="text-lg font-black text-slate-950">حسابات تحتاج مراجعة ربط</h2>
          <p className="mt-1 text-xs font-bold text-slate-500">حسابات ناقصها مشروع تشغيل أو مدينة أو مالك داخلي واضح.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1200px] text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                {["التطبيق", "App User ID", "اسم الحساب", "Application", "مشروع التشغيل", "المدينة", "مالك الحساب", "سبب المراجعة", "الحالة", "إجراءات"].map((header) => (
                  <th key={header} className="whitespace-nowrap px-3 py-3 text-right font-black">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {accountIssueRows.length ? accountIssueRows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="whitespace-nowrap px-3 py-3 font-bold">{row.appName}</td>
                  <td className="whitespace-nowrap px-3 py-3">{row.appUserId || row.username}</td>
                  <td className="whitespace-nowrap px-3 py-3">{row.appUsername || row.username}</td>
                  <td className="whitespace-nowrap px-3 py-3">{row.applicationName || "-"}</td>
                  <td className="whitespace-nowrap px-3 py-3">{row.applicationProjectName || "-"}</td>
                  <td className="whitespace-nowrap px-3 py-3">{row.cityName || "-"}</td>
                  <td className="whitespace-nowrap px-3 py-3">{row.driverName || "-"}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-rose-700">{row.unmatchedReason || "-"}</td>
                  <td className="whitespace-nowrap px-3 py-3">{row.needsReview ? "تحتاج مراجعة" : statusLabel(row.status)}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button disabled={Boolean(busy)} onClick={() => accountAction(row.id, "reactivate")} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800">تفعيل</button>
                      <button disabled={Boolean(busy)} onClick={() => accountAction(row.id, "unlink")} className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-black">فك الربط</button>
                      <button disabled={Boolean(busy)} onClick={() => accountAction(row.id, "safeDelete")} className="rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs font-black text-red-800">حذف آمن</button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center font-bold text-slate-500">لا توجد حسابات تحتاج مراجعة حاليًا.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Metric({ title, value, tone = "slate" }: { title: string; value: number; tone?: "slate" | "amber" | "orange" | "red" | "blue" }) {
  const toneClass = {
    slate: "border-slate-200 bg-white text-slate-950",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    orange: "border-orange-200 bg-orange-50 text-orange-800",
    red: "border-red-200 bg-red-50 text-red-800",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
  }[tone];
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${toneClass}`}>
      <p className="text-xs font-black text-slate-500">{title}</p>
      <strong className="mt-1 block text-2xl font-black">{value.toLocaleString("ar-SA")}</strong>
    </div>
  );
}
