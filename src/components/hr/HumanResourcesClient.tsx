"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { HumanResourcesData, HrPersonType, HrRow } from "@/lib/hr/getHumanResourcesData";

type Props = {
  data: HumanResourcesData;
};

const tabs = [
  { key: "all", label: "الكل" },
  { key: "admin", label: "موظفون إداريون" },
  { key: "drivers", label: "المناديب" },
  { key: "supervisors", label: "المشرفون" },
  { key: "sponsored", label: "كفالة" },
  { key: "freelancers", label: "فريلانسر" },
  { key: "contracts", label: "العقود" },
  { key: "housing", label: "السكن" },
  { key: "attendance", label: "الحضور" },
  { key: "documents", label: "المستندات" },
  { key: "issues", label: "المراجعات" },
];

function num(value: number) {
  return new Intl.NumberFormat("ar-SA").format(value);
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-5 left-5 z-[90] flex max-w-lg items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-800 shadow-2xl">
      <span>{message}</span>
      <button type="button" onClick={onClose} className="rounded-xl bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
        إغلاق
      </button>
    </div>
  );
}

function SummaryCard({ title, value, tone = "slate" }: { title: string; value: string | number; tone?: "slate" | "emerald" | "amber" | "red" | "blue" }) {
  const classes = {
    slate: "border-slate-200 bg-white text-slate-950",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    red: "border-red-200 bg-red-50 text-red-800",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
  };
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${classes[tone]}`}>
      <p className="text-xs font-black opacity-70">{title}</p>
      <strong className="mt-2 block text-2xl font-black">{value}</strong>
    </div>
  );
}

function Badge({ text, tone }: { text: string; tone: HrRow["statusTone"] }) {
  const classes = {
    emerald: "bg-emerald-100 text-emerald-800",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-red-100 text-red-800",
    slate: "bg-slate-100 text-slate-700",
  };
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${classes[tone]}`}>{text}</span>;
}

function exportCsv(filename: string, rows: HrRow[]) {
  const headers = ["الاسم", "النوع", "الكود", "الجوال", "الهوية", "المدينة", "المشروع", "المشرف", "العقد", "الكفالة", "السكن", "الحضور", "المستندات", "الحالة"];
  const lines = rows.map((row) =>
    [row.name, row.typeLabel, row.internalCode, row.phone, row.nationalId, row.city, row.project, row.supervisor, row.contractType, row.sponsorshipType, row.housingStatus, row.attendanceStatus, row.documentStatus, row.statusLabel]
      .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
      .join(","),
  );
  const blob = new Blob([`\uFEFF${headers.join(",")}\n${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function field(form: FormData, key: string) {
  return String(form.get(key) || "").trim();
}

function personApiType(type: HrPersonType) {
  if (type === "driver") return "driver";
  if (type === "supervisor") return "supervisor";
  return "user";
}

function EditModal({ row, data, onClose, onDone }: { row: HrRow; data: HumanResourcesData; onClose: () => void; onDone: (message: string) => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const fields: Record<string, string | null> = {};
    if (row.type === "driver") {
      fields.status = field(form, "status");
      fields.joinDate = field(form, "joinDate") || null;
      fields.cityId = field(form, "cityId") || null;
      fields.supervisorId = field(form, "supervisorId") || null;
      fields.contractType = field(form, "contractType") || null;
      fields.sponsorshipType = field(form, "sponsorshipType") || null;
      fields.housingStatus = field(form, "housingStatus") || null;
      fields.accommodationType = field(form, "accommodationType") || null;
    } else if (row.type === "supervisor") {
      fields.status = field(form, "status");
      fields.cityId = field(form, "cityId") || null;
    } else {
      fields.status = field(form, "status") || "active";
      fields.cityId = field(form, "cityId") || null;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/hr/people", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personType: personApiType(row.type), id: row.id, fields }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!response.ok) throw new Error(payload.error || "تعذر حفظ بيانات الموارد البشرية.");
      onDone(payload.message || "تم تحديث بيانات الموارد البشرية.");
      router.refresh();
    } catch (error) {
      onDone(error instanceof Error ? error.message : "تعذر حفظ بيانات الموارد البشرية.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
      <form onSubmit={submit} className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black text-slate-500">تعديل إداري</p>
            <h2 className="text-2xl font-black text-slate-950">{row.name}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700">
            إغلاق
          </button>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-xs font-black text-slate-800">
            الحالة
            <select name="status" defaultValue={row.type === "user" ? row.status : row.status.toUpperCase()} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
              {row.type === "user" ? (
                <>
                  <option value="active">نشط</option>
                  <option value="inactive">غير نشط</option>
                </>
              ) : (
                <>
                  <option value="ACTIVE">نشط</option>
                  <option value="SUSPENDED">موقوف</option>
                  <option value="INACTIVE">تم إنهاء العمل</option>
                </>
              )}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-black text-slate-800">
            المدينة
            <select name="cityId" defaultValue={row.cityId} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
              <option value="">بدون مدينة</option>
              {data.cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
          </label>
          {row.type === "driver" ? (
            <>
              <label className="grid gap-1 text-xs font-black text-slate-800">
                المشرف
                <select name="supervisorId" defaultValue={row.supervisorId} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
                  <option value="">بدون مشرف</option>
                  {data.supervisors.map((supervisor) => (
                    <option key={supervisor.id} value={supervisor.id}>
                      {supervisor.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-black text-slate-800">
                تاريخ بداية الدوام
                <input name="joinDate" type="date" defaultValue={row.joinDate === "-" ? "" : row.joinDate} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold" />
              </label>
              <label className="grid gap-1 text-xs font-black text-slate-800">
                نوع العلاقة
                <input name="contractType" defaultValue={row.contractType === "-" ? "" : row.contractType} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold" />
              </label>
              <label className="grid gap-1 text-xs font-black text-slate-800">
                نوع الكفالة
                <input name="sponsorshipType" defaultValue={row.sponsorshipType === "-" ? "" : row.sponsorshipType} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold" />
              </label>
              <label className="grid gap-1 text-xs font-black text-slate-800">
                حالة السكن
                <select name="housingStatus" defaultValue={row.housingStatus === "-" ? "" : row.housingStatus} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
                  <option value="">غير محدد</option>
                  <option value="company_housing">سكن شركة</option>
                  <option value="external_housing">سكن خارجي</option>
                  <option value="no_housing">بدون سكن</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs font-black text-slate-800">
                نوع السكن
                <input name="accommodationType" defaultValue={row.housingStatus === "-" ? "" : row.housingStatus} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold" />
              </label>
            </>
          ) : null}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-black text-slate-800">
            إلغاء
          </button>
          <button type="submit" disabled={saving} className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-black text-white shadow-sm disabled:opacity-60">
            {saving ? "جاري الحفظ..." : "حفظ التعديل"}
          </button>
        </div>
      </form>
    </div>
  );
}

function DetailModal({ row, onClose }: { row: HrRow; onClose: () => void }) {
  const details = [
    ["النوع", row.typeLabel],
    ["الكود الداخلي", row.internalCode],
    ["كود المندوب", row.driverCode],
    ["الجوال", row.phone],
    ["الهوية / الإقامة", row.nationalId],
    ["الجنسية", row.nationality],
    ["المدينة", row.city],
    ["المشروع", row.project],
    ["التطبيق", row.application],
    ["المشرف", row.supervisor],
    ["نوع العلاقة", row.contractType],
    ["نوع الكفالة", row.sponsorshipType],
    ["السكن", row.housingStatus],
    ["الحضور اليوم", row.attendanceStatus],
    ["المستندات", row.documentStatus],
    ["تاريخ بداية الدوام", row.joinDate],
  ];

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[88vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black text-slate-500">ملف موارد بشرية</p>
            <h2 className="text-2xl font-black text-slate-950">{row.name}</h2>
            <p className="mt-1 text-sm font-bold text-slate-500">{row.typeLabel} · {row.city}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700">
            إغلاق
          </button>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <SummaryCard title="الحالة" value={row.statusLabel} tone={row.statusTone} />
          <SummaryCard title="المستندات" value={row.documentStatus} tone={row.documentStatus === "مكتمل" ? "emerald" : "amber"} />
          <SummaryCard title="الحضور اليوم" value={row.attendanceStatus} tone={row.attendanceStatus.includes("حاضر") ? "emerald" : "slate"} />
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {details.map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black text-slate-500">{label}</p>
              <p className="mt-1 text-sm font-black text-slate-950">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href={row.operationsLink} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white shadow-sm">
            فتح الملف التشغيلي
          </Link>
          <Link href={row.adminLink} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800 shadow-sm">
            المستندات / الإدارة
          </Link>
          <Link href={row.payrollLink} className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-800 shadow-sm">
            سياق المسير
          </Link>
          {row.type === "driver" ? (
            <>
              <Link href={`/rider-housing?driverId=${row.id}`} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-black text-amber-800 shadow-sm">
                السكن
              </Link>
              <Link href={`/attendance?driverId=${row.id}`} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800 shadow-sm">
                الحضور
              </Link>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function HumanResourcesClient({ data }: Props) {
  const router = useRouter();
  const [toast, setToast] = useState("");
  const [selected, setSelected] = useState<HrRow | null>(null);
  const [editing, setEditing] = useState<HrRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkSupervisorId, setBulkSupervisorId] = useState("");
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const rows = data.rows;
  const visibleRows = useMemo(() => rows.slice(0, 250), [rows]);
  const selectedDrivers = useMemo(() => rows.filter((row) => selectedIds.includes(`${row.type}:${row.id}`) && row.type === "driver"), [rows, selectedIds]);
  const allSelected = visibleRows.length > 0 && visibleRows.every((row) => selectedIds.includes(`${row.type}:${row.id}`));

  function rowKey(row: HrRow) {
    return `${row.type}:${row.id}`;
  }

  function toggleRow(row: HrRow) {
    const key = rowKey(row);
    setSelectedIds((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  }

  function toggleAll() {
    setSelectedIds((current) => {
      if (allSelected) return current.filter((id) => !visibleRows.some((row) => rowKey(row) === id));
      return [...new Set([...current, ...visibleRows.map(rowKey)])];
    });
  }

  async function deletePerson(row: HrRow) {
    const ok = window.confirm(row.type === "driver" ? "سيتم تعطيل المندوب بدل الحذف الفعلي لحماية المسيرات والتقارير. تأكيد؟" : "تأكيد تعطيل السجل؟");
    if (!ok) return;
    const response = await fetch(`/api/hr/people?personType=${personApiType(row.type)}&id=${row.id}`, { method: "DELETE" });
    const payload = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
    if (!response.ok) {
      setToast(payload.error || "تعذر تعطيل السجل.");
      return;
    }
    setToast(payload.message || "تم تعطيل السجل.");
    router.refresh();
  }

  async function applyBulk() {
    const driverIds = selectedIds
      .map((key) => {
        const [type, id] = key.split(":");
        return type === "driver" ? id : "";
      })
      .filter(Boolean);
    if (!driverIds.length) {
      setToast("اختار مناديب فقط لتنفيذ التعديل الجماعي.");
      return;
    }
    if (!bulkSupervisorId && !bulkStatus) {
      setToast("اختار مشرف أو حالة قبل التطبيق.");
      return;
    }
    setBulkSaving(true);
    try {
      const fields: Record<string, string> = {};
      if (bulkSupervisorId) fields.supervisorId = bulkSupervisorId;
      if (bulkStatus) fields.status = bulkStatus;
      const response = await fetch("/api/hr/people", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personType: "driver", ids: driverIds, fields }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!response.ok) throw new Error(payload.error || "تعذر تنفيذ التعديل الجماعي.");
      setToast(payload.message || "تم تنفيذ التعديل الجماعي.");
      setSelectedIds([]);
      setBulkSupervisorId("");
      setBulkStatus("");
      router.refresh();
    } catch (error) {
      setToast(error instanceof Error ? error.message : "تعذر تنفيذ التعديل الجماعي.");
    } finally {
      setBulkSaving(false);
    }
  }

  if (data.databaseStatus === "offline") {
    return (
      <section className="w-full max-w-none space-y-4" dir="rtl">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800 shadow-sm">
          <h1 className="text-2xl font-black">الموارد البشرية</h1>
          <p className="mt-2 text-sm font-bold">{data.databaseMessage || "قاعدة البيانات غير متصلة. يرجى تشغيل PostgreSQL ثم تحديث الصفحة."}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full max-w-none space-y-4" dir="rtl">
      {toast ? <Toast message={toast} onClose={() => setToast("")} /> : null}
      {selected ? <DetailModal row={selected} onClose={() => setSelected(null)} /> : null}
      {editing ? <EditModal row={editing} data={data} onClose={() => setEditing(null)} onDone={(message) => { setToast(message); setEditing(null); router.refresh(); }} /> : null}

      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <nav className="mb-1 text-xs font-black text-slate-500">الرئيسية &gt; المناديب والموارد البشرية &gt; الموارد البشرية</nav>
          <h1 className="text-3xl font-black text-slate-950">الموارد البشرية</h1>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            صفحة إدارية عليا لكل أفراد الشركة. التفاصيل التشغيلية تفتح من المناديب والسيارات والمسير، والتفاصيل الإدارية من HR والمستخدمين.
          </p>
        </div>
        <Link href="/dashboard" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800 shadow-sm hover:bg-slate-50">
          رجوع
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <Link href="/drivers?newDriver=1" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-emerald-700">
              + إضافة مندوب
            </Link>
            <Link href="/users" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800 shadow-sm hover:bg-slate-50">
              إدارة المستخدمين
            </Link>
            <Link href="/rider-housing" className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-amber-600">
              سكن المناديب
            </Link>
            <button type="button" onClick={() => exportCsv("human-resources.csv", rows)} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-blue-700">
              تصدير Excel
            </button>
            <button type="button" onClick={() => window.print()} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800 shadow-sm hover:bg-slate-50">
              طباعة / PDF
            </button>
          </div>
          <form method="get" className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-xs font-black text-slate-800">
              من تاريخ
              <input name="fromDate" defaultValue={data.filters.fromDate} type="date" className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
            </label>
            <label className="grid gap-1 text-xs font-black text-slate-800">
              إلى تاريخ
              <input name="toDate" defaultValue={data.filters.toDate} type="date" className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
            </label>
          </form>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={`/hr?tab=${tab.key}`}
            className={`rounded-xl px-4 py-2 text-sm font-black shadow-sm ${data.filters.tab === tab.key ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50"}`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <SummaryCard title="إجمالي الأفراد" value={num(data.summary.total)} tone="blue" />
        <SummaryCard title="موظفون إداريون" value={num(data.summary.adminUsers)} />
        <SummaryCard title="المناديب" value={num(data.summary.drivers)} />
        <SummaryCard title="المشرفون" value={num(data.summary.supervisors)} />
        <SummaryCard title="نشط" value={num(data.summary.active)} tone="emerald" />
        <SummaryCard title="موقوف / منتهي" value={num(data.summary.inactive)} tone={data.summary.inactive ? "red" : "slate"} />
        <SummaryCard title="كفالة" value={num(data.summary.sponsored)} />
        <SummaryCard title="فريلانسر" value={num(data.summary.freelancers)} />
        <SummaryCard title="مستندات ناقصة" value={num(data.summary.missingDocuments)} tone={data.summary.missingDocuments ? "amber" : "emerald"} />
        <SummaryCard title="مستندات قاربت الانتهاء" value={num(data.summary.expiringDocuments)} tone={data.summary.expiringDocuments ? "red" : "emerald"} />
        <SummaryCard title="سكن شركة" value={num(data.summary.companyHousing)} tone="blue" />
        <SummaryCard title="سكن خارجي" value={num(data.summary.externalHousing)} tone="emerald" />
      </div>

      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-950 shadow-sm">{data.insight}</div>

      <form method="get" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <input type="hidden" name="tab" value={data.filters.tab} />
        <input type="hidden" name="fromDate" value={data.filters.fromDate} />
        <input type="hidden" name="toDate" value={data.filters.toDate} />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <input name="q" defaultValue={data.filters.q} placeholder="بحث بالاسم / الكود / الهوية / الجوال" className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-blue-400 xl:col-span-2" />
          <select name="personType" defaultValue={data.filters.personType} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
            <option value="">كل الأنواع</option>
            <option value="user">موظفون إداريون</option>
            <option value="driver">مناديب</option>
            <option value="supervisor">مشرفون</option>
          </select>
          <select name="cityId" defaultValue={data.filters.cityId} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
            <option value="">كل المدن</option>
            {data.cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
          </select>
          <select name="applicationProjectId" defaultValue={data.filters.applicationProjectId} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
            <option value="">كل المشاريع</option>
            {data.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
          <select name="supervisorId" defaultValue={data.filters.supervisorId} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
            <option value="">كل المشرفين</option>
            {data.supervisors.map((supervisor) => <option key={supervisor.id} value={supervisor.id}>{supervisor.name}</option>)}
          </select>
          <input name="contractType" defaultValue={data.filters.contractType} placeholder="نوع العلاقة" className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold" />
          <input name="sponsorshipType" defaultValue={data.filters.sponsorshipType} placeholder="نوع الكفالة" className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold" />
          <select name="housingStatus" defaultValue={data.filters.housingStatus} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
            <option value="">كل السكن</option>
            <option value="company">سكن شركة</option>
            <option value="external">سكن خارجي</option>
            <option value="no_housing">بدون سكن</option>
          </select>
          <select name="nationality" defaultValue={data.filters.nationality} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
            <option value="">كل الجنسيات</option>
            {data.nationalities.map((nationality) => <option key={nationality} value={nationality}>{nationality}</option>)}
          </select>
          <select name="status" defaultValue={data.filters.status} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
            <option value="">كل الحالات</option>
            <option value="ACTIVE">نشط</option>
            <option value="SUSPENDED">موقوف</option>
            <option value="INACTIVE">تم إنهاء / غير نشط</option>
          </select>
          <select name="documentStatus" defaultValue={data.filters.documentStatus} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
            <option value="">كل المستندات</option>
            <option value="مكتمل">مكتمل</option>
            <option value="ناقص مستندات">ناقص مستندات</option>
            <option value="ينتهي قريبًا">ينتهي قريبًا</option>
            <option value="منتهي">منتهي</option>
          </select>
          <button type="submit" className="h-11 rounded-xl bg-slate-900 px-4 text-sm font-black text-white shadow-sm hover:bg-slate-800">
            تطبيق
          </button>
        </div>
        <div className="mt-3 flex justify-end">
          <Link href="/hr" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700">
            عرض الكل
          </Link>
        </div>
      </form>

      {selectedIds.length ? (
        <div className="sticky top-2 z-20 rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-black text-amber-950">تم تحديد {num(selectedIds.length)} سجل. التعديل الجماعي يطبق على المناديب فقط.</p>
            <div className="flex flex-wrap items-center gap-2">
              <select value={bulkSupervisorId} onChange={(event) => setBulkSupervisorId(event.target.value)} className="h-11 min-w-56 rounded-xl border border-amber-200 bg-white px-3 text-sm font-bold">
                <option value="">تعيين مشرف</option>
                {data.supervisors.map((supervisor) => <option key={supervisor.id} value={supervisor.id}>{supervisor.name}</option>)}
              </select>
              <select value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value)} className="h-11 min-w-44 rounded-xl border border-amber-200 bg-white px-3 text-sm font-bold">
                <option value="">تغيير حالة</option>
                <option value="ACTIVE">نشط</option>
                <option value="SUSPENDED">موقوف</option>
                <option value="INACTIVE">تم إنهاء العمل</option>
              </select>
              <button type="button" onClick={applyBulk} disabled={bulkSaving} className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-black text-white disabled:opacity-60">
                {bulkSaving ? "جاري التنفيذ..." : "تطبيق"}
              </button>
              <button type="button" onClick={() => setSelectedIds([])} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700">
                إلغاء التحديد
              </button>
            </div>
          </div>
          {selectedDrivers.length ? <p className="mt-2 text-xs font-bold text-amber-900">مناديب محددة: {selectedDrivers.slice(0, 5).map((row) => row.name).join("، ")}</p> : null}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {visibleRows.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-[1800px] w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="bg-slate-100 text-xs font-black text-slate-700">
                  <th className="rounded-r-xl px-3 py-3 text-right"><input type="checkbox" checked={allSelected} onChange={toggleAll} /></th>
                  <th className="px-3 py-3 text-right">الاسم</th>
                  <th className="px-3 py-3 text-right">النوع</th>
                  <th className="px-3 py-3 text-right">الكود الداخلي</th>
                  <th className="px-3 py-3 text-right">كود المندوب</th>
                  <th className="px-3 py-3 text-right">الجوال</th>
                  <th className="px-3 py-3 text-right">الإقامة</th>
                  <th className="px-3 py-3 text-right">الجنسية</th>
                  <th className="px-3 py-3 text-right">المدينة</th>
                  <th className="px-3 py-3 text-right">المشروع</th>
                  <th className="px-3 py-3 text-right">التطبيق</th>
                  <th className="px-3 py-3 text-right">المشرف</th>
                  <th className="px-3 py-3 text-right">نوع العلاقة</th>
                  <th className="px-3 py-3 text-right">الكفالة</th>
                  <th className="px-3 py-3 text-right">السكن</th>
                  <th className="px-3 py-3 text-right">الحضور</th>
                  <th className="px-3 py-3 text-right">المستندات</th>
                  <th className="px-3 py-3 text-right">الحالة</th>
                  <th className="rounded-l-xl px-3 py-3 text-right">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={rowKey(row)} className="border-b border-slate-100">
                    <td className="border-b border-slate-100 px-3 py-4"><input type="checkbox" checked={selectedIds.includes(rowKey(row))} onChange={() => toggleRow(row)} /></td>
                    <td className="sticky right-0 z-10 border-b border-slate-100 bg-white px-3 py-4 shadow-[-8px_0_16px_-14px_rgba(15,23,42,0.45)]">
                      <button type="button" onClick={() => setSelected(row)} className="text-right font-black text-slate-950 hover:text-blue-700">{row.name}</button>
                      <div className="text-xs font-bold text-slate-500">{row.internalCode}</div>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">{row.typeLabel}</td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">{row.internalCode}</td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">{row.driverCode}</td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">{row.phone}</td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">{row.nationalId}</td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">{row.nationality}</td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">{row.city}</td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">{row.project}</td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">{row.application}</td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">{row.supervisor}</td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">{row.contractType}</td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">{row.sponsorshipType}</td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">{row.housingStatus}</td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">{row.attendanceStatus}</td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">{row.documentStatus}</td>
                    <td className="border-b border-slate-100 px-3 py-4"><Badge text={row.statusLabel} tone={row.statusTone} /></td>
                    <td className="border-b border-slate-100 px-3 py-4">
                      <div className="flex min-w-[360px] flex-wrap gap-1">
                        <button type="button" onClick={() => setSelected(row)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-black text-slate-800 hover:bg-slate-50">تفاصيل</button>
                        <button type="button" onClick={() => setEditing(row)} className="rounded-lg bg-blue-600 px-2 py-1 text-xs font-black text-white hover:bg-blue-700">تعديل</button>
                        {row.type === "driver" ? (
                          <>
                            <Link href={`/rider-documents?driverId=${row.id}`} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-black text-slate-800 hover:bg-slate-50">مستندات</Link>
                            <Link href={`/contracts-sponsorship?driverId=${row.id}`} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-black text-slate-800 hover:bg-slate-50">العقد</Link>
                            <Link href={`/rider-housing?driverId=${row.id}`} className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-black text-amber-800 hover:bg-amber-100">السكن</Link>
                            <Link href={`/attendance?driverId=${row.id}`} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-black text-slate-800 hover:bg-slate-50">الحضور</Link>
                          </>
                        ) : null}
                        <button type="button" onClick={() => deletePerson(row)} className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-black text-red-700 hover:bg-red-100">تعطيل</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <h2 className="text-xl font-black text-slate-900">لا توجد بيانات موارد بشرية حسب الفلاتر الحالية</h2>
            <p className="mt-2 text-sm font-bold text-slate-500">غيّر الفلاتر أو أضف مندوبًا/مستخدمًا من الصفحات المتخصصة.</p>
          </div>
        )}
        <div className="mt-4 flex items-center justify-between text-xs font-bold text-slate-500">
          <span>عدد السجلات: {num(rows.length)} | المعروض: {num(visibleRows.length)}</span>
          <span>صفحة 1 / 1</span>
        </div>
      </div>
    </section>
  );
}
