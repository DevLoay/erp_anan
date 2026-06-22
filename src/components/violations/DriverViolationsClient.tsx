"use client";

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { DriverViolationRow, DriverViolationsPageData } from "@/lib/violations/driverViolations";

type Props = {
  data: DriverViolationsPageData;
};

type ModalMode = "violation" | "warning" | null;

const statusLabels: Record<string, string> = {
  PENDING: "قيد المتابعة",
  APPROVED: "معتمد",
  REJECTED: "مرفوض",
  CANCELLED: "ملغي",
  DEDUCTED: "تم الخصم",
  PARTIALLY_DEDUCTED: "خصم جزئي",
  ACTIVE: "نشط",
  INACTIVE: "غير نشط",
  LOCKED: "مقفل",
};

const severityOptions = [
  { value: "WARNING", label: "تحذير" },
  { value: "CRITICAL", label: "حرج" },
  { value: "INFO", label: "معلومة" },
];

function money(value: number) {
  return new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(value || 0);
}

function number(value: number) {
  return new Intl.NumberFormat("ar-SA").format(value || 0);
}

function date(value: string) {
  return value ? new Date(value).toLocaleDateString("ar-SA") : "-";
}

function dateInput(value: string) {
  return value ? value.slice(0, 10) : "";
}

function statusTone(status: string) {
  if (["APPROVED", "DEDUCTED", "LOCKED"].includes(status)) return "bg-emerald-100 text-emerald-800";
  if (["REJECTED", "CANCELLED"].includes(status)) return "bg-rose-100 text-rose-800";
  return "bg-amber-100 text-amber-800";
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-5 left-5 z-[120] flex max-w-md items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-950 shadow-2xl">
      <span>{message}</span>
      <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black">
        إغلاق
      </button>
    </div>
  );
}

function Button({
  children,
  tone = "white",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "white" | "green" | "blue" | "orange" | "red" | "dark" }) {
  const tones = {
    white: "border-slate-200 bg-white text-slate-950 hover:bg-slate-50",
    green: "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700",
    blue: "border-blue-600 bg-blue-600 text-white hover:bg-blue-700",
    orange: "border-orange-500 bg-orange-500 text-white hover:bg-orange-600",
    red: "border-rose-600 bg-rose-600 text-white hover:bg-rose-700",
    dark: "border-slate-950 bg-slate-950 text-white hover:bg-slate-800",
  };
  return (
    <button {...props} className={`rounded-xl border px-4 py-2 text-sm font-black shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${tones[tone]} ${props.className ?? ""}`}>
      {children}
    </button>
  );
}

function LinkButton({ href, children, tone = "white" }: { href: string; children: ReactNode; tone?: "white" | "dark" | "blue" }) {
  const tones = {
    white: "border-slate-200 bg-white text-slate-950 hover:bg-slate-50",
    dark: "border-slate-950 bg-slate-950 text-white hover:bg-slate-800",
    blue: "border-blue-600 bg-blue-600 text-white hover:bg-blue-700",
  };
  return <Link href={href} className={`rounded-xl border px-4 py-2 text-sm font-black shadow-sm transition ${tones[tone]}`}>{children}</Link>;
}

function SummaryCard({ title, value, tone = "slate" }: { title: string; value: string | number; tone?: "slate" | "green" | "blue" | "amber" | "red" }) {
  const tones = {
    slate: "border-slate-200 bg-white text-slate-950",
    green: "border-emerald-200 bg-emerald-50 text-emerald-900",
    blue: "border-blue-200 bg-blue-50 text-blue-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    red: "border-rose-200 bg-rose-50 text-rose-900",
  };
  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${tones[tone]}`}>
      <p className="text-xs font-black opacity-70">{title}</p>
      <strong className="mt-2 block text-2xl font-black">{value}</strong>
    </div>
  );
}

function buildHref(data: DriverViolationsPageData, updates: Record<string, string | number | null>) {
  const params = new URLSearchParams();
  Object.entries(data.filters).forEach(([key, value]) => {
    if (value !== "" && value !== 1 && value !== null && value !== undefined) params.set(key, String(value));
  });
  Object.entries(updates).forEach(([key, value]) => {
    if (value === null || value === "") params.delete(key);
    else params.set(key, String(value));
  });
  return `/violations?${params.toString()}`;
}

function sortHref(data: DriverViolationsPageData, key: string) {
  const nextDir = data.filters.sort === key && data.filters.dir === "asc" ? "desc" : "asc";
  return buildHref(data, { sort: key, dir: nextDir, page: 1 });
}

function DetailsModal({ row, onClose }: { row: DriverViolationRow; onClose: () => void }) {
  const items = [
    ["المندوب", `${row.driverName} - ${row.driverCode}`],
    ["رقم الهوية", row.nationalId],
    ["الجوال", row.mobile],
    ["المدينة", row.cityName],
    ["المشروع", row.projectName],
    ["التطبيق", row.applicationName],
    ["المشرف", row.supervisorName],
    ["السيارة", row.vehiclePlate],
    ["نوع المخالفة", row.type],
    ["القيمة", money(row.amount)],
    ["الحالة", statusLabels[row.status] || row.status],
    ["التاريخ", date(row.occurredAt)],
    ["الإشعار", row.notificationCount ? "تم إرسال إشعار للمندوب" : "لا يوجد إشعار مرتبط"],
    ["ملاحظات", row.notes || "-"],
  ];
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black">تفاصيل المخالفة</h2>
            <p className="text-sm font-bold text-slate-500">{row.driverName} / {row.type}</p>
          </div>
          <Button type="button" onClick={onClose}>إغلاق</Button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {items.map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black text-slate-500">{label}</p>
              <p className="mt-1 text-base font-black text-slate-950">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CreateModal({ data, mode, onClose, onDone }: { data: DriverViolationsPageData; mode: Exclude<ModalMode, null>; onClose: () => void; onDone: (message: string) => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const isWarning = mode === "warning";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    const response = await fetch(isWarning ? "/api/driver-warnings" : "/api/violations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      onDone(result.error || "تعذر حفظ العملية.");
      return;
    }
    onDone(isWarning ? "تم إنشاء التحذير وإرسال إشعار للمندوب." : "تم إنشاء المخالفة وإرسال إشعار للمندوب.");
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4">
      <form onSubmit={submit} className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black">{isWarning ? "إنشاء تحذير مندوب" : "إنشاء مخالفة مندوب"}</h2>
            <p className="text-sm font-bold text-slate-500">سيتم إنشاء إشعار مرتبط بالمندوب تلقائيًا.</p>
          </div>
          <Button type="button" onClick={onClose}>إغلاق</Button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm font-black text-slate-700">
            المندوب
            <select name="driverId" required className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-blue-500">
              <option value="">اختر المندوب</option>
              {data.options.drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>{driver.label}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-black text-slate-700">
            النوع
            <input name="type" required list="violation-types" defaultValue={isWarning ? "تحذير تشغيلي" : "مخالفة تشغيلية"} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-blue-500" />
            <datalist id="violation-types">
              {data.options.types.map((type) => <option key={type} value={type} />)}
            </datalist>
          </label>
          {isWarning ? (
            <label className="grid gap-1 text-sm font-black text-slate-700">
              الشدة
              <select name="severity" defaultValue="WARNING" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-blue-500">
                {severityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          ) : (
            <label className="grid gap-1 text-sm font-black text-slate-700">
              قيمة المخالفة
              <input name="amount" type="number" step="0.01" min="0" defaultValue="0" className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-blue-500" />
            </label>
          )}
          <label className="grid gap-1 text-sm font-black text-slate-700">
            الحالة
            <select name="status" defaultValue="PENDING" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-blue-500">
              {data.options.statuses.map((status) => <option key={status} value={status}>{statusLabels[status] || status}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-black text-slate-700">
            التاريخ
            <input name={isWarning ? "issuedAt" : "occurredAt"} type="date" defaultValue={data.filters.toDate} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-blue-500" />
          </label>
          {isWarning ? (
            <label className="grid gap-1 text-sm font-black text-slate-700">
              تاريخ المتابعة
              <input name="followUpAt" type="date" className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-blue-500" />
            </label>
          ) : null}
          <label className="grid gap-1 text-sm font-black text-slate-700 md:col-span-2">
            ملاحظات
            <textarea name="notes" rows={3} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-blue-500" />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" onClick={onClose}>إلغاء</Button>
          <Button type="submit" tone="green" disabled={saving}>{saving ? "جاري الحفظ..." : "حفظ وإرسال إشعار"}</Button>
        </div>
      </form>
    </div>
  );
}

function FilterBar({ data }: { data: DriverViolationsPageData }) {
  const router = useRouter();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(event.currentTarget).entries()) {
      const text = String(value).trim();
      if (text) params.set(key, text);
    }
    params.set("page", "1");
    router.push(`/violations?${params.toString()}`);
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
        <label className="grid gap-1 text-xs font-black text-slate-600">
          من تاريخ
          <input name="fromDate" type="date" defaultValue={data.filters.fromDate} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold" />
        </label>
        <label className="grid gap-1 text-xs font-black text-slate-600">
          إلى تاريخ
          <input name="toDate" type="date" defaultValue={data.filters.toDate} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold" />
        </label>
        <label className="grid gap-1 text-xs font-black text-slate-600">
          المدينة
          <select name="cityId" defaultValue={data.filters.cityId} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold">
            <option value="">كل المدن</option>
            {data.options.cities.map((city) => <option key={city.id} value={city.id}>{city.label}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-black text-slate-600">
          المشروع
          <select name="applicationProjectId" defaultValue={data.filters.applicationProjectId} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold">
            <option value="">كل المشاريع</option>
            {data.options.applicationProjects.map((project) => <option key={project.id} value={project.id}>{project.label}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-black text-slate-600">
          المشرف
          <select name="supervisorId" defaultValue={data.filters.supervisorId} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold">
            <option value="">كل المشرفين</option>
            {data.options.supervisors.map((supervisor) => <option key={supervisor.id} value={supervisor.id}>{supervisor.label}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-black text-slate-600">
          الحالة
          <select name="status" defaultValue={data.filters.status} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold">
            <option value="">كل الحالات</option>
            {data.options.statuses.map((status) => <option key={status} value={status}>{statusLabels[status] || status}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-black text-slate-600">
          عدد الصفوف
          <select name="pageSize" defaultValue={data.filters.pageSize} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold">
            {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size} صف</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-black text-slate-600">
          بحث
          <input name="q" defaultValue={data.filters.q} placeholder="مندوب / هوية / جوال / نوع..." className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold" />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="submit" tone="dark">تطبيق</Button>
        <LinkButton href="/violations">مسح الفلاتر</LinkButton>
      </div>
    </form>
  );
}

export function DriverViolationsClient({ data }: Props) {
  const router = useRouter();
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState<ModalMode>(null);
  const [details, setDetails] = useState<DriverViolationRow | null>(null);

  if (data.databaseOffline) {
    return (
      <main dir="rtl" className="min-h-screen w-full max-w-none bg-slate-50 p-4 text-slate-950">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center shadow-sm">
          <h1 className="text-2xl font-black text-rose-900">قاعدة البيانات غير متصلة</h1>
          <p className="mt-2 text-sm font-bold text-rose-700">يرجى تشغيل PostgreSQL ثم تحديث الصفحة.</p>
        </div>
      </main>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen w-full max-w-none space-y-4 bg-slate-50 p-4 text-slate-950">
      {toast ? <Toast message={toast} onClose={() => setToast("")} /> : null}
      {modal ? <CreateModal data={data} mode={modal} onClose={() => setModal(null)} onDone={setToast} /> : null}
      {details ? <DetailsModal row={details} onClose={() => setDetails(null)} /> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black text-blue-700">MOHAMED SHAWKI ERP</p>
            <h1 className="mt-1 text-3xl font-black">مخالفات وتحذيرات المناديب</h1>
            <p className="mt-1 text-sm font-bold text-slate-500">إدارة مخالفات المناديب والتحذيرات مع إرسال إشعارات مباشرة لتطبيق المندوب.</p>
            <p className="mt-2 text-xs font-bold text-slate-400">الرئيسية / السيارات والحركة / المخالفات</p>
          </div>
          <LinkButton href="/finance">رجوع للماليات</LinkButton>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <Button type="button" tone="green" onClick={() => setModal("violation")}>+ إضافة مخالفة</Button>
          <Button type="button" tone="orange" onClick={() => setModal("warning")}>+ إنشاء تحذير</Button>
          <Button type="button" tone="blue" onClick={() => window.print()}>طباعة / PDF</Button>
          <Button type="button" onClick={() => router.refresh()}>تحديث البيانات</Button>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <SummaryCard title="إجمالي السجلات" value={number(data.summary.total)} />
        <SummaryCard title="قيد المتابعة" value={number(data.summary.pending)} tone="amber" />
        <SummaryCard title="معتمدة" value={number(data.summary.approved)} tone="green" />
        <SummaryCard title="تم خصمها" value={number(data.summary.deducted)} tone="blue" />
        <SummaryCard title="إجمالي المبالغ" value={money(data.summary.totalAmount)} tone="red" />
        <SummaryCard title="إشعارات مرسلة" value={number(data.summary.notified)} tone="blue" />
      </section>

      <FilterBar data={data} />

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs font-black text-slate-500">
          <span>عدد السجلات: {number(data.pagination.total)} / الصفحة {number(data.pagination.page)} من {number(data.pagination.pages)}</span>
          <span>الفرز الحالي: {data.filters.sort} / {data.filters.dir === "asc" ? "تصاعدي" : "تنازلي"}</span>
        </div>
        <div className="overflow-auto">
          <table className="min-w-[1250px] border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100 text-slate-700">
                <th className="sticky right-0 z-10 whitespace-nowrap bg-slate-100 px-3 py-3 text-right font-black">المندوب</th>
                <th className="whitespace-nowrap px-3 py-3 text-right font-black">الكود / الهوية</th>
                <th className="whitespace-nowrap px-3 py-3 text-right font-black">المدينة</th>
                <th className="whitespace-nowrap px-3 py-3 text-right font-black">المشروع</th>
                <th className="whitespace-nowrap px-3 py-3 text-right font-black">المشرف</th>
                <th className="whitespace-nowrap px-3 py-3 text-right font-black">السيارة</th>
                <th className="whitespace-nowrap px-3 py-3 text-right font-black"><Link href={sortHref(data, "type")}>النوع</Link></th>
                <th className="whitespace-nowrap px-3 py-3 text-right font-black"><Link href={sortHref(data, "amount")}>القيمة</Link></th>
                <th className="whitespace-nowrap px-3 py-3 text-right font-black"><Link href={sortHref(data, "status")}>الحالة</Link></th>
                <th className="whitespace-nowrap px-3 py-3 text-right font-black"><Link href={sortHref(data, "occurredAt")}>التاريخ</Link></th>
                <th className="whitespace-nowrap px-3 py-3 text-right font-black">الإشعار</th>
                <th className="whitespace-nowrap px-3 py-3 text-right font-black">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.length ? data.rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="sticky right-0 z-10 min-w-56 bg-white px-3 py-3 font-black">
                    {row.driverName}
                    <small className="block text-xs text-slate-500">{row.driverCode}</small>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 font-bold">{row.nationalId}<small className="block text-xs text-slate-500">{row.mobile}</small></td>
                  <td className="whitespace-nowrap px-3 py-3 font-bold">{row.cityName}</td>
                  <td className="whitespace-nowrap px-3 py-3 font-bold">{row.projectName}<small className="block text-xs text-slate-500">{row.applicationName}</small></td>
                  <td className="whitespace-nowrap px-3 py-3 font-bold">{row.supervisorName}</td>
                  <td className="whitespace-nowrap px-3 py-3 font-bold">{row.vehiclePlate}</td>
                  <td className="whitespace-nowrap px-3 py-3 font-bold">{row.type}</td>
                  <td className="whitespace-nowrap px-3 py-3 font-black text-rose-700">{money(row.amount)}</td>
                  <td className="whitespace-nowrap px-3 py-3"><span className={`rounded-full px-3 py-1 text-xs font-black ${statusTone(row.status)}`}>{statusLabels[row.status] || row.status}</span></td>
                  <td className="whitespace-nowrap px-3 py-3 font-bold">{date(row.occurredAt)}</td>
                  <td className="whitespace-nowrap px-3 py-3 font-bold">{row.notificationCount ? "تم الإرسال" : "-"}</td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" onClick={() => setDetails(row)}>عرض التفاصيل</Button>
                      <LinkButton href={`/notifications?entityId=${row.id}`}>الإشعار</LinkButton>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={12} className="px-3 py-10 text-center">
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8">
                      <p className="text-xl font-black text-slate-800">لا توجد مخالفات حسب الفلاتر الحالية</p>
                      <p className="mt-2 text-sm font-bold text-slate-500">غيّر التاريخ أو المدينة أو المشروع، أو أضف مخالفة جديدة.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-black text-slate-500">صفحة {number(data.pagination.page)} من {number(data.pagination.pages)}</div>
          <div className="flex flex-wrap gap-2">
            <LinkButton href={buildHref(data, { page: Math.max(data.pagination.page - 1, 1) })}>السابق</LinkButton>
            <LinkButton href={buildHref(data, { page: Math.min(data.pagination.page + 1, data.pagination.pages) })}>التالي</LinkButton>
          </div>
        </div>
      </section>
    </main>
  );
}
