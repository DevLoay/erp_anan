"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { DriverManagementData, DriverManagementRow } from "@/lib/drivers/getDriverManagementData";

type Props = {
  data: DriverManagementData;
};

type DriverAction = {
  type: "report" | "advance" | "violation";
  row: DriverManagementRow;
};

const statusOptions = [
  { value: "", label: "كل الحالات" },
  { value: "ACTIVE", label: "نشط" },
  { value: "SUSPENDED", label: "موقوف" },
  { value: "INACTIVE", label: "غير نشط" },
];

function money(value: number) {
  return new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(value);
}

function number(value: number) {
  return new Intl.NumberFormat("ar-SA").format(value);
}

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function monthInput() {
  return new Date().toISOString().slice(0, 7);
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-5 left-5 z-[90] flex max-w-sm items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-800 shadow-2xl">
      <span>{message}</span>
      <button type="button" onClick={onClose} className="rounded-xl bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
        إغلاق
      </button>
    </div>
  );
}

function SummaryCard({ title, value, icon, tone = "slate" }: { title: string; value: string | number; icon: string; tone?: "slate" | "emerald" | "amber" | "red" | "blue" }) {
  const classes = {
    slate: "border-slate-200 bg-white text-slate-900",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    red: "border-red-200 bg-red-50 text-red-800",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
  };
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${classes[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-black opacity-70">{title}</p>
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/75 text-lg shadow-sm">{icon}</span>
      </div>
      <strong className="mt-2 block text-2xl font-black">{value}</strong>
    </div>
  );
}

function StatusBadge({ row }: { row: DriverManagementRow }) {
  const classes = {
    emerald: "bg-emerald-100 text-emerald-800",
    red: "bg-red-100 text-red-800",
    amber: "bg-amber-100 text-amber-800",
    slate: "bg-slate-100 text-slate-700",
  }[row.statusTone];
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${classes}`}>{row.statusLabel}</span>;
}

function Rating({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs font-bold text-slate-400">لا يوجد أداء</span>;
  const tone = value >= 4.3 ? "text-emerald-700" : value >= 3.5 ? "text-amber-700" : "text-red-700";
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-black ${tone}`}>
      {value.toFixed(1)}
      <span className="text-amber-400">★</span>
    </span>
  );
}

function buildCsv(rows: DriverManagementRow[]) {
  const headers = ["كود المندوب", "رقم الإقامة", "الاسم", "الجوال", "الجنسية", "المدينة", "المشروع", "التطبيق", "المشرف", "لوحة السيارة", "الحالة", "طلبات الشهر"];
  const lines = rows.map((row) =>
    [
      row.driverCode,
      row.nationalId,
      row.name,
      row.mobile,
      row.nationality,
      row.city,
      row.project,
      row.application,
      row.supervisor,
      row.vehiclePlate,
      row.statusLabel,
      row.monthOrders,
    ]
      .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
      .join(","),
  );
  return `\uFEFF${headers.join(",")}\n${lines.join("\n")}`;
}

export function DriverManagementClient({ data }: Props) {
  const router = useRouter();
  const [toast, setToast] = useState("");
  const [selectedDriver, setSelectedDriver] = useState<DriverManagementRow | null>(null);
  const [driverAction, setDriverAction] = useState<DriverAction | null>(null);
  const [savingAction, setSavingAction] = useState(false);
  const rows = data.rows;

  const visibleRows = useMemo(() => rows.slice(0, 100), [rows]);

  function askToPickDriver(action: string) {
    setToast(`اختر مندوبًا من الجدول ثم اضغط زر ${action} داخل صف المندوب.`);
  }

  async function createResource(resource: "advances" | "violations", body: Record<string, unknown>, successMessage: string) {
    setSavingAction(true);
    try {
      const response = await fetch(`/api/${resource}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "تعذر حفظ العملية. يرجى المحاولة مرة أخرى.");
      setDriverAction(null);
      setToast(successMessage);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "تعذر حفظ العملية. يرجى المحاولة مرة أخرى.");
    } finally {
      setSavingAction(false);
    }
  }

  async function submitAdvance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!driverAction || driverAction.type !== "advance") return;

    const form = new FormData(event.currentTarget);
    const amount = Number(form.get("amount") || 0);
    const deductionMonth = String(form.get("deductionMonth") || monthInput());
    const reason = String(form.get("reason") || "").trim();
    if (!amount || amount <= 0) {
      setToast("قيمة السلفة مطلوبة ويجب أن تكون أكبر من صفر.");
      return;
    }

    await createResource(
      "advances",
      {
        driverId: driverAction.row.id,
        amount,
        remainingAmount: amount,
        deductionMonth,
        reason: reason || "طلب سلفة من صفحة إدارة المناديب",
        status: "PENDING",
      },
      `تم تسجيل طلب سلفة للمندوب ${driverAction.row.name}.`,
    );
  }

  async function submitViolation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!driverAction || driverAction.type !== "violation") return;

    const form = new FormData(event.currentTarget);
    const amount = Number(form.get("amount") || 0);
    const type = String(form.get("type") || "تشغيلية").trim();
    const occurredAt = String(form.get("occurredAt") || todayInput());
    const notes = String(form.get("notes") || "").trim();
    if (!amount || amount < 0) {
      setToast("قيمة المخالفة مطلوبة ويجب ألا تكون سالبة.");
      return;
    }

    await createResource(
      "violations",
      {
        driverId: driverAction.row.id,
        type,
        amount,
        occurredAt,
        notes: notes || "مخالفة مسجلة من صفحة إدارة المناديب",
        status: "PENDING",
      },
      `تم تسجيل مخالفة للمندوب ${driverAction.row.name}.`,
    );
  }

  function exportExcel() {
    const blob = new Blob([buildCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `drivers-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setToast("تم تجهيز ملف CSV قابل للفتح على Excel");
  }

  if (data.databaseStatus === "offline") {
    return (
      <section className="w-full max-w-none space-y-4" dir="rtl">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900 shadow-sm">
          <h1 className="text-2xl font-black">إدارة المناديب</h1>
          <p className="mt-2 text-sm font-bold">{data.databaseMessage || "قاعدة البيانات غير متصلة. يرجى تشغيل PostgreSQL ثم تحديث الصفحة."}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full max-w-none space-y-4" dir="rtl">
      {toast ? <Toast message={toast} onClose={() => setToast("")} /> : null}

      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <nav className="mb-1 text-xs font-black text-slate-500">الرئيسية &gt; المناديب والموارد البشرية &gt; إدارة المناديب</nav>
          <h1 className="text-3xl font-black text-slate-950">إدارة المناديب</h1>
          <p className="mt-1 text-sm font-semibold text-slate-500">صفحة مرتبطة ببيانات النظام والصلاحيات الحالية.</p>
        </div>
        <Link href="/dashboard" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800 shadow-sm hover:bg-slate-50">
          رجوع
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => router.push("/imports/preview?importType=drivers&mode=create")} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-emerald-700">
              + إضافة
            </button>
            <Link href="/imports/preview?importType=drivers" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-blue-700">
              استيراد Excel / PDF
            </Link>
            <button type="button" onClick={() => askToPickDriver("تعديل")} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800 shadow-sm hover:bg-slate-50">
              تعديل
            </button>
            <button type="button" onClick={() => askToPickDriver("حذف / تعطيل")} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-red-700">
              حذف
            </button>
            <button type="button" onClick={exportExcel} className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-amber-600">
              تصدير إكسل
            </button>
            <button type="button" onClick={() => window.print()} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800 shadow-sm hover:bg-slate-50">
              طباعة / PDF
            </button>
          </div>

          <form method="get" className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-xs font-black text-slate-800" htmlFor="drivers-from-date">
              من تاريخ
              <input id="drivers-from-date" name="fromDate" defaultValue={data.filters.fromDate} type="date" className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
            </label>
            <label className="grid gap-1 text-xs font-black text-slate-800" htmlFor="drivers-to-date">
              إلى تاريخ
              <input id="drivers-to-date" name="toDate" defaultValue={data.filters.toDate} type="date" className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
            </label>
          </form>
        </div>
      </div>

      <form method="get" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <input type="hidden" name="fromDate" value={data.filters.fromDate} />
        <input type="hidden" name="toDate" value={data.filters.toDate} />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label className="sr-only" htmlFor="drivers-search">
            بحث
          </label>
          <input
            id="drivers-search"
            name="q"
            defaultValue={data.filters.q}
            placeholder="بحث"
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-blue-400"
          />

          <label className="sr-only" htmlFor="drivers-city">
            المدينة
          </label>
          <select id="drivers-city" name="cityId" defaultValue={data.filters.cityId} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
            <option value="">كل المدن</option>
            {data.cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor="drivers-status">
            الحالة
          </label>
          <select id="drivers-status" name="status" defaultValue={data.filters.status} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor="drivers-project">
            المشروع
          </label>
          <select id="drivers-project" name="projectId" defaultValue={data.filters.projectId} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
            <option value="">كل التطبيقات</option>
            {data.projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor="drivers-nationality">
            الجنسية
          </label>
          <select id="drivers-nationality" name="nationality" defaultValue={data.filters.nationality} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
            <option value="">كل الجنسيات</option>
            {data.nationalities.map((nationality) => (
              <option key={nationality} value={nationality}>
                {nationality}
              </option>
            ))}
          </select>

          <button type="submit" className="h-11 rounded-xl bg-slate-900 px-4 text-sm font-black text-white shadow-sm hover:bg-slate-800">
            تطبيق
          </button>
        </div>
      </form>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard title="إجمالي المناديب" value={number(data.summary.totalDrivers)} icon="ID" tone="blue" />
        <SummaryCard title="نشط" value={number(data.summary.activeDrivers)} icon="✓" tone="emerald" />
        <SummaryCard title="موقوف" value={number(data.summary.suspendedDrivers)} icon="!" tone={data.summary.suspendedDrivers ? "red" : "slate"} />
        <SummaryCard title="طلبات الفترة" value={number(data.summary.monthOrders)} icon="ORD" tone="slate" />
        <SummaryCard title="بدون حساب تطبيق" value={number(data.summary.withoutAppAccount)} icon="@" tone={data.summary.withoutAppAccount ? "amber" : "emerald"} />
      </div>

      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-950 shadow-sm">
        {data.insight}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link href="/rider-kpi" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-blue-700">
          عرض KPI المناديب
        </Link>
        <button type="button" onClick={() => askToPickDriver("سلفة")} className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-amber-600">
          طلب سلفة
        </button>
        <button type="button" onClick={exportExcel} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-blue-700">
          تصدير إكسل
        </button>
        <button type="button" onClick={() => window.print()} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800 shadow-sm hover:bg-slate-50">
          طباعة / PDF
        </button>
        <span className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm">100 صف</span>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {visibleRows.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-[1320px] w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="bg-slate-100 text-xs font-black text-slate-700">
                  <th className="rounded-r-xl px-3 py-3 text-right">
                    <label className="sr-only" htmlFor="drivers-select-all">
                      تحديد الكل
                    </label>
                    <input id="drivers-select-all" type="checkbox" className="h-4 w-4 rounded border-slate-300" />
                  </th>
                  <th className="px-3 py-3 text-right">الاسم</th>
                  <th className="px-3 py-3 text-right">الجوال</th>
                  <th className="px-3 py-3 text-right">الجنسية</th>
                  <th className="px-3 py-3 text-right">المدينة</th>
                  <th className="px-3 py-3 text-right">التطبيق</th>
                  <th className="px-3 py-3 text-right">المشرف</th>
                  <th className="px-3 py-3 text-right">لوحة السيارة</th>
                  <th className="px-3 py-3 text-right">نوع السيارة</th>
                  <th className="px-3 py-3 text-right">الحالة</th>
                  <th className="px-3 py-3 text-right">طلبات شهر</th>
                  <th className="px-3 py-3 text-right">سلف معتمدة</th>
                  <th className="px-3 py-3 text-right">سلف معلقة</th>
                  <th className="px-3 py-3 text-right">التقييم</th>
                  <th className="sticky left-0 z-10 rounded-l-xl bg-slate-100 px-3 py-3 text-right">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="sticky left-0 z-10 border-b border-slate-100 bg-white px-3 py-4">
                      <label className="sr-only" htmlFor={`driver-${row.id}`}>
                        تحديد {row.name}
                      </label>
                      <input id={`driver-${row.id}`} type="checkbox" className="h-4 w-4 rounded border-slate-300" />
                    </td>
                    <td className="border-b border-slate-100 px-3 py-4">
                      <button type="button" onClick={() => setSelectedDriver(row)} className="text-right font-black text-slate-950 hover:text-blue-700">
                        {row.name}
                      </button>
                      <div className="text-xs font-medium text-slate-500">{row.nationalId}</div>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">{row.mobile}</td>
                    <td className="border-b border-slate-100 px-3 py-4">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">{row.nationality}</span>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">{row.city}</td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">{row.application}</td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">{row.supervisor}</td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">{row.vehiclePlate}</td>
                    <td className="border-b border-slate-100 px-3 py-4">{row.vehicleType}</td>
                    <td className="border-b border-slate-100 px-3 py-4">
                      <StatusBadge row={row} />
                    </td>
                    <td className="border-b border-slate-100 px-3 py-4 font-black">{number(row.monthOrders)}</td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">{money(row.approvedAdvances)}</td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">{money(row.pendingAdvances)}</td>
                    <td className="border-b border-slate-100 px-3 py-4">
                      <Rating value={row.rating} />
                    </td>
                    <td className="border-b border-slate-100 px-3 py-4">
                      <div className="flex min-w-[160px] flex-wrap gap-1">
                        <button type="button" onClick={() => setDriverAction({ type: "report", row })} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-black text-slate-800 hover:bg-slate-50">
                          تقرير
                        </button>
                        <button type="button" onClick={() => setDriverAction({ type: "violation", row })} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-black text-slate-800 hover:bg-slate-50">
                          مخالفة
                        </button>
                        <button type="button" onClick={() => setDriverAction({ type: "advance", row })} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-black text-slate-800 hover:bg-slate-50">
                          سلفة
                        </button>
                        <button type="button" onClick={() => setSelectedDriver(row)} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-xs font-black text-slate-800 hover:bg-slate-50" aria-label={`عرض ${row.name}`}>
                          عين
                        </button>
                        <button type="button" onClick={() => setSelectedDriver(row)} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-xs font-black text-slate-800 hover:bg-slate-50" aria-label={`تعديل ${row.name}`}>
                          قلم
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <h2 className="text-xl font-black text-slate-900">لا توجد مناديب مطابقة للفلاتر الحالية</h2>
            <p className="mt-2 text-sm font-bold text-slate-500">يمكن رفع ملف المناديب الرسمي من زر الاستيراد وسيظهر Preview قبل الحفظ.</p>
            <Link href="/imports/preview?importType=drivers" className="mt-4 inline-flex rounded-xl bg-blue-600 px-5 py-2 text-sm font-black text-white shadow-sm hover:bg-blue-700">
              رفع ملف المناديب
            </Link>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between text-xs font-bold text-slate-500">
          <div className="flex gap-2">
            <button type="button" onClick={() => setToast("أنت بالفعل في الصفحة الأولى حسب البيانات المعروضة حاليًا.")} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-700">
              السابق
            </button>
            <button type="button" onClick={() => setToast("لا توجد صفحة تالية محفوظة في نتائج الفلاتر الحالية.")} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-700">
              التالي
            </button>
          </div>
          <span>
            عدد السجلات: {number(rows.length)} | صفحة 1 / 1
          </span>
        </div>
      </div>

      {selectedDriver ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black text-slate-950">{selectedDriver.name}</h2>
                <p className="text-sm font-bold text-slate-500">
                  {selectedDriver.driverCode} · {selectedDriver.nationalId}
                </p>
              </div>
              <button type="button" onClick={() => setSelectedDriver(null)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700">
                إغلاق
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <SummaryCard title="طلبات الفترة" value={number(selectedDriver.monthOrders)} icon="ORD" tone="blue" />
              <SummaryCard title="سلف معتمدة" value={money(selectedDriver.approvedAdvances)} icon="SAR" tone="emerald" />
              <SummaryCard title="صافي آخر مسير" value={money(selectedDriver.netPayroll)} icon="NET" tone={selectedDriver.netPayroll < 0 ? "red" : "slate"} />
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {[
                ["الجوال", selectedDriver.mobile],
                ["المدينة", selectedDriver.city],
                ["المشروع", selectedDriver.project],
                ["التطبيق", selectedDriver.application],
                ["حساب التطبيق", selectedDriver.appUserId],
                ["اسم الحساب", selectedDriver.appUsername],
                ["المشرف", selectedDriver.supervisor],
                ["لوحة السيارة", selectedDriver.vehiclePlate],
                ["أيام الإيجار", selectedDriver.rentalDays],
                ["آخر تقرير", selectedDriver.lastReportDate],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-black text-slate-500">{label}</p>
                  <p className="mt-1 text-sm font-black text-slate-950">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {driverAction ? (
        <div className="fixed inset-0 z-[85] grid place-items-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black text-slate-500">إدارة المناديب</p>
                <h2 className="text-2xl font-black text-slate-950">
                  {driverAction.type === "report" ? "تقرير المندوب" : driverAction.type === "advance" ? "طلب سلفة" : "تسجيل مخالفة"}
                </h2>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  {driverAction.row.name} · {driverAction.row.driverCode}
                </p>
              </div>
              <button type="button" onClick={() => setDriverAction(null)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700">
                إغلاق
              </button>
            </div>

            {driverAction.type === "report" ? (
              <div className="mt-5 space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <SummaryCard title="طلبات الفترة" value={number(driverAction.row.monthOrders)} icon="ORD" tone="blue" />
                  <SummaryCard title="السلف المعلقة" value={money(driverAction.row.pendingAdvances)} icon="SAR" tone={driverAction.row.pendingAdvances ? "amber" : "slate"} />
                  <SummaryCard title="إجمالي المخالفات" value={money(driverAction.row.violationsTotal)} icon="!" tone={driverAction.row.violationsTotal ? "red" : "slate"} />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-sm font-black text-slate-950">روابط التقرير</h3>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <button type="button" onClick={() => window.location.assign(`/rider-kpi?driverId=${driverAction.row.id}`)} className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-blue-700">
                      فتح KPI المندوب
                    </button>
                    <button type="button" onClick={() => window.location.assign(`/rider-reports?driverId=${driverAction.row.id}`)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 shadow-sm hover:bg-slate-50">
                      التقارير اليومية
                    </button>
                    <button type="button" onClick={() => window.location.assign(`/payroll?driverId=${driverAction.row.id}`)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 shadow-sm hover:bg-slate-50">
                      المسير والمالية
                    </button>
                    <button type="button" onClick={() => window.location.assign(`/notifications?driverId=${driverAction.row.id}`)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 shadow-sm hover:bg-slate-50">
                      التنبيهات
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {driverAction.type === "advance" ? (
              <form onSubmit={submitAdvance} className="mt-5 grid gap-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="grid gap-1 text-xs font-black text-slate-800" htmlFor="driver-advance-amount">
                    قيمة السلفة
                    <input id="driver-advance-amount" name="amount" type="number" min="1" step="0.01" required className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold outline-none focus:border-blue-400" />
                  </label>
                  <label className="grid gap-1 text-xs font-black text-slate-800" htmlFor="driver-advance-month">
                    شهر الخصم
                    <input id="driver-advance-month" name="deductionMonth" type="month" defaultValue={monthInput()} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold outline-none focus:border-blue-400" />
                  </label>
                </div>
                <label className="grid gap-1 text-xs font-black text-slate-800" htmlFor="driver-advance-reason">
                  سبب السلفة
                  <textarea id="driver-advance-reason" name="reason" rows={3} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-blue-400" placeholder="مثال: طلب سلفة تشغيلية للمندوب" />
                </label>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
                  سيتم حفظ الطلب كحالة Pending حتى يتم اعتماده من المستخدم المصرح له، ولن يتم اعتماده أو خصمه تلقائيًا من المسير.
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <button type="button" onClick={() => setDriverAction(null)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800">
                    إلغاء
                  </button>
                  <button type="submit" disabled={savingAction} className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-amber-600 disabled:opacity-60">
                    {savingAction ? "جاري الحفظ..." : "حفظ طلب السلفة"}
                  </button>
                </div>
              </form>
            ) : null}

            {driverAction.type === "violation" ? (
              <form onSubmit={submitViolation} className="mt-5 grid gap-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="grid gap-1 text-xs font-black text-slate-800" htmlFor="driver-violation-type">
                    نوع المخالفة
                    <select id="driver-violation-type" name="type" className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-blue-400">
                      <option value="تشغيلية">تشغيلية</option>
                      <option value="حضور">حضور</option>
                      <option value="تطبيق">تطبيق</option>
                      <option value="سيارة">سيارة</option>
                      <option value="مالية">مالية</option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-xs font-black text-slate-800" htmlFor="driver-violation-amount">
                    قيمة المخالفة
                    <input id="driver-violation-amount" name="amount" type="number" min="0" step="0.01" required className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold outline-none focus:border-blue-400" />
                  </label>
                  <label className="grid gap-1 text-xs font-black text-slate-800" htmlFor="driver-violation-date">
                    تاريخ المخالفة
                    <input id="driver-violation-date" name="occurredAt" type="date" defaultValue={todayInput()} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold outline-none focus:border-blue-400" />
                  </label>
                </div>
                <label className="grid gap-1 text-xs font-black text-slate-800" htmlFor="driver-violation-notes">
                  ملاحظات
                  <textarea id="driver-violation-notes" name="notes" rows={3} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-blue-400" placeholder="اكتب سبب المخالفة أو رقم التقرير المرتبط بها" />
                </label>
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-900">
                  سيتم حفظ المخالفة كحالة Pending، ولا يتم خصمها من المسير إلا بعد الاعتماد حسب صلاحيات المالية.
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <button type="button" onClick={() => setDriverAction(null)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800">
                    إلغاء
                  </button>
                  <button type="submit" disabled={savingAction} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-red-700 disabled:opacity-60">
                    {savingAction ? "جاري الحفظ..." : "حفظ المخالفة"}
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
