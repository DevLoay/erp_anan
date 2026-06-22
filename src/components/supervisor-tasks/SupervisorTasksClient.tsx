"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { SupervisorTaskPriority, SupervisorTasksData, SupervisorTaskStatusKey } from "@/lib/supervisor-tasks/getSupervisorTasksData";

type FormState = {
  title: string;
  description: string;
  category: string;
  cityId: string;
  supervisorId: string;
  driverId: string;
  priority: SupervisorTaskPriority;
  dueDate: string;
  notes: string;
};

const emptyForm: FormState = {
  title: "",
  description: "",
  category: "مهمة عامة",
  cityId: "",
  supervisorId: "",
  driverId: "",
  priority: "INFO",
  dueDate: new Date().toISOString().slice(0, 10),
  notes: "",
};

const statusOptions: Array<{ value: string; label: string }> = [
  { value: "", label: "كل الحالات" },
  { value: "PENDING", label: "قيد الانتظار" },
  { value: "IN_PROGRESS", label: "قيد التنفيذ" },
  { value: "COMPLETED", label: "مكتملة" },
  { value: "CANCELLED", label: "ملغاة" },
];

const priorityOptions: Array<{ value: string; label: string }> = [
  { value: "", label: "كل الأولويات" },
  { value: "INFO", label: "عادي" },
  { value: "WARNING", label: "مهم" },
  { value: "CRITICAL", label: "عاجل" },
];

const categoryOptions = [
  "متابعة مندوب",
  "مراجعة حساب تطبيق",
  "حل مشكلة سيارة",
  "مراجعة سلفة أو خصم",
  "مراجعة حضور",
  "متابعة مدينة",
  "مراجعة مخالفة",
  "رفع تقرير يومي",
  "حل مشكلة عميل / طلب",
  "مهمة عامة",
];

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100";

function numberText(value: number) {
  return new Intl.NumberFormat("ar-SA").format(value);
}

function cardClass(kind: "normal" | "warning" | "danger" | "success" = "normal") {
  if (kind === "danger") return "border-red-200 bg-red-50 text-red-900";
  if (kind === "warning") return "border-amber-200 bg-amber-50 text-amber-900";
  if (kind === "success") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  return "border-slate-200 bg-white text-slate-950";
}

function statusBadge(status: SupervisorTaskStatusKey) {
  const classes: Record<SupervisorTaskStatusKey, string> = {
    PENDING: "bg-slate-100 text-slate-700",
    IN_PROGRESS: "bg-blue-100 text-blue-700",
    COMPLETED: "bg-emerald-100 text-emerald-700",
    CANCELLED: "bg-rose-100 text-rose-700",
    OVERDUE: "bg-red-100 text-red-700",
  };
  return classes[status];
}

function priorityBadge(priority: SupervisorTaskPriority) {
  const classes: Record<SupervisorTaskPriority, string> = {
    INFO: "bg-slate-100 text-slate-700",
    WARNING: "bg-amber-100 text-amber-700",
    CRITICAL: "bg-red-100 text-red-700",
  };
  return classes[priority];
}

function playTaskSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const audio = new AudioContextClass();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(740, audio.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(980, audio.currentTime + 0.12);
    gain.gain.setValueAtTime(0.0001, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, audio.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.28);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + 0.3);
    window.setTimeout(() => void audio.close(), 500);
  } catch {
    // Browsers can block audio until user interaction; the toast still appears.
  }
}

export function SupervisorTasksClient({ data }: { data: SupervisorTasksData }) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>({ ...emptyForm, cityId: data.filters.cityId, supervisorId: data.filters.supervisorId });
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkSupervisorId, setBulkSupervisorId] = useState("");
  const knownTaskIds = useRef<Set<string>>(new Set(data.rows.map((row) => row.id)));
  const didPollOnce = useRef(false);

  const citySupervisors = useMemo(
    () => data.options.supervisors.filter((supervisor) => !form.cityId || supervisor.cityId === form.cityId),
    [data.options.supervisors, form.cityId],
  );
  const cityDrivers = useMemo(
    () => data.options.drivers.filter((driver) => (!form.cityId || driver.cityId === form.cityId) && (!form.supervisorId || !driver.supervisorId || driver.supervisorId === form.supervisorId)),
    [data.options.drivers, form.cityId, form.supervisorId],
  );
  const allSelected = data.rows.length > 0 && selected.size === data.rows.length;

  useEffect(() => {
    knownTaskIds.current = new Set(data.rows.map((row) => row.id));
  }, [data.rows]);

  useEffect(() => {
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch("/api/supervisor-tasks?status=PENDING", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as { data?: Array<{ id: string; title: string; priority?: string }> };
        const rows = payload.data ?? [];
        const nextIds = new Set(rows.map((row) => row.id));
        const fresh = rows.filter((row) => !knownTaskIds.current.has(row.id));
        knownTaskIds.current = nextIds;
        if (didPollOnce.current && fresh.length) {
          const urgent = fresh.some((row) => row.priority === "CRITICAL");
          setToast(urgent ? "وصلت مهمة عاجلة جديدة للمشرفين." : "وصلت مهمة جديدة للمشرفين.");
          playTaskSound();
          router.refresh();
        }
        didPollOnce.current = true;
      } catch {
        // Keep the page quiet if polling is temporarily unavailable.
      }
    }, 25000);
    return () => window.clearInterval(timer);
  }, [router]);

  function updateForm(key: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleSelected(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(data.rows.map((row) => row.id)));
  }

  async function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setToast("");
    if (!form.title.trim() || !form.description.trim() || !form.cityId || !form.supervisorId || !form.dueDate) {
      setError("راجع الحقول المطلوبة قبل الحفظ.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/supervisor-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "تعذر حفظ المهمة.");
      setToast("تم إنشاء المهمة وإرسال تنبيه للمشرف.");
      setModalOpen(false);
      setForm({ ...emptyForm, cityId: data.filters.cityId, supervisorId: data.filters.supervisorId });
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "تعذر حفظ المهمة.");
    } finally {
      setBusy(false);
    }
  }

  async function patchTask(id: string, body: Record<string, string>) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/supervisor-tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "تعذر تحديث المهمة.");
      setToast("تم تحديث المهمة بنجاح.");
      router.refresh();
    } catch (patchError) {
      setError(patchError instanceof Error ? patchError.message : "تعذر تحديث المهمة.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelTask(id: string) {
    if (!window.confirm("هل تريد إلغاء المهمة؟")) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/supervisor-tasks/${id}`, { method: "DELETE" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "تعذر إلغاء المهمة.");
      setToast("تم إلغاء المهمة.");
      router.refresh();
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "تعذر إلغاء المهمة.");
    } finally {
      setBusy(false);
    }
  }

  async function applyBulkAction() {
    const ids = Array.from(selected);
    if (!ids.length) {
      setError("اختر مهمة واحدة على الأقل.");
      return;
    }
    if (!bulkStatus && !bulkSupervisorId) {
      setError("اختر إجراء جماعي أولًا.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      for (const id of ids) {
        const body: Record<string, string> = {};
        if (bulkStatus) body.status = bulkStatus;
        if (bulkSupervisorId) body.supervisorId = bulkSupervisorId;
        const response = await fetch(`/api/supervisor-tasks/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!response.ok) {
          const payload = (await response.json()) as { error?: string };
          throw new Error(payload.error || "تعذر تنفيذ الإجراء الجماعي.");
        }
      }
      setSelected(new Set());
      setBulkStatus("");
      setBulkSupervisorId("");
      setToast("تم تنفيذ الإجراء على المهام المختارة.");
      router.refresh();
    } catch (bulkError) {
      setError(bulkError instanceof Error ? bulkError.message : "تعذر تنفيذ الإجراء الجماعي.");
    } finally {
      setBusy(false);
    }
  }

  function exportSelected() {
    const rows = selected.size ? data.rows.filter((row) => selected.has(row.id)) : data.rows;
    const csv = [
      ["العنوان", "المشرف", "المدينة", "المندوب", "الأولوية", "الحالة", "تاريخ الاستحقاق", "ملاحظات"],
      ...rows.map((row) => [row.title, row.supervisorName, row.cityName, row.driverName, row.priorityLabel, row.statusLabel, row.dueDate, row.notes]),
    ]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "supervisor-tasks.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (data.forbidden) {
    return (
      <main className="min-h-screen bg-slate-50 p-4" dir="rtl">
        <section className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-black text-slate-950">مهام المشرفين</h1>
          <p className="mt-2 text-sm font-bold text-red-700">ليس لديك صلاحية لفتح هذه الصفحة.</p>
        </section>
      </main>
    );
  }

  if (data.databaseStatus === "offline") {
    return (
      <main className="min-h-screen bg-slate-50 p-4" dir="rtl">
        <section className="rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-black text-slate-950">قاعدة البيانات غير متصلة</h1>
          <p className="mt-2 text-sm font-bold text-slate-600">{data.databaseMessage || "يرجى تشغيل PostgreSQL ثم تحديث الصفحة."}</p>
          <button type="button" onClick={() => router.refresh()} className="mt-5 rounded-xl bg-slate-950 px-5 py-2 text-sm font-black text-white">
            تحديث الصفحة
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4" dir="rtl">
      {(toast || error) && (
        <div className={`fixed left-5 top-20 z-[80] max-w-md rounded-2xl border bg-white px-4 py-3 text-sm font-black shadow-2xl ${error ? "border-red-200 text-red-700" : "border-emerald-200 text-emerald-700"}`}>
          {error || toast}
          <button type="button" onClick={() => (error ? setError("") : setToast(""))} className="mr-3 rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-700">
            إغلاق
          </button>
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black text-blue-700">الرئيسية / التشغيل / مهام المشرفين</p>
            <h1 className="mt-1 text-3xl font-black text-slate-950">مهام المشرفين</h1>
            <p className="mt-1 text-sm font-bold text-slate-500">إسناد المهام للمشرفين، إرسال تنبيهات فورية، ومتابعة التنفيذ حسب المدينة والمندوب.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setModalOpen(true)} disabled={!data.access.canCreate} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white shadow-sm disabled:cursor-not-allowed disabled:bg-slate-300">
              + إضافة مهمة
            </button>
            <button type="button" onClick={exportSelected} className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-black text-white shadow-sm">
              تصدير Excel
            </button>
            <button type="button" onClick={() => window.print()} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800 shadow-sm">
              طباعة
            </button>
            <a href="/supervisor-tasks" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800 shadow-sm">
              عرض الكل
            </a>
          </div>
        </div>
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <StatCard title="إجمالي المهام" value={data.summary.total} />
        <StatCard title="قيد الانتظار" value={data.summary.pending} />
        <StatCard title="قيد التنفيذ" value={data.summary.inProgress} />
        <StatCard title="مكتملة" value={data.summary.completed} kind="success" />
        <StatCard title="متأخرة" value={data.summary.overdue} kind="danger" />
        <StatCard title="عالية الأولوية" value={data.summary.highPriority} kind="warning" />
      </section>

      <form className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" method="get">
        <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
          <Field label="المدينة">
            <select name="cityId" defaultValue={data.filters.cityId} className={inputClass}>
              <option value="">كل المدن</option>
              {data.options.cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="المشرف">
            <select name="supervisorId" defaultValue={data.filters.supervisorId} className={inputClass}>
              <option value="">كل المشرفين</option>
              {data.options.supervisors.map((supervisor) => (
                <option key={supervisor.id} value={supervisor.id}>
                  {supervisor.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="الحالة">
            <select name="status" defaultValue={data.filters.status} className={inputClass}>
              {statusOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="الأولوية">
            <select name="priority" defaultValue={data.filters.priority} className={inputClass}>
              {priorityOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="من تاريخ">
            <input type="date" name="from" defaultValue={data.filters.from} className={inputClass} />
          </Field>
          <Field label="إلى تاريخ">
            <input type="date" name="to" defaultValue={data.filters.to} className={inputClass} />
          </Field>
          <Field label="بحث">
            <input type="search" name="q" defaultValue={data.filters.q} placeholder="عنوان / مشرف / مندوب" className={inputClass} />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="submit" className="rounded-xl bg-slate-950 px-8 py-2 text-sm font-black text-white">
            تطبيق
          </button>
          <a href="/supervisor-tasks" className="rounded-xl border border-slate-200 bg-white px-8 py-2 text-sm font-black text-slate-800">
            عرض الكل
          </a>
        </div>
      </form>

      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-950">قائمة المهام</h2>
            <p className="text-xs font-bold text-slate-500">المعروض: {numberText(data.rows.length)} مهمة</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value)} className={`${inputClass} sm:w-44`}>
              <option value="">تغيير الحالة</option>
              <option value="PENDING">قيد الانتظار</option>
              <option value="IN_PROGRESS">قيد التنفيذ</option>
              <option value="COMPLETED">مكتملة</option>
              <option value="CANCELLED">ملغاة</option>
            </select>
            {data.access.canManage ? (
              <select value={bulkSupervisorId} onChange={(event) => setBulkSupervisorId(event.target.value)} className={`${inputClass} sm:w-56`}>
                <option value="">إسناد لمشرف</option>
                {data.options.supervisors.map((supervisor) => (
                  <option key={supervisor.id} value={supervisor.id}>
                    {supervisor.name}
                  </option>
                ))}
              </select>
            ) : null}
            <button type="button" onClick={applyBulkAction} disabled={busy || !selected.size} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white disabled:bg-slate-300">
              تنفيذ على المحدد
            </button>
          </div>
        </div>

        {data.rows.length ? (
          <>
            <div className="mt-4 hidden overflow-x-auto rounded-2xl border border-slate-100 md:block">
              <table className="min-w-[1180px] w-full text-right text-sm">
                <thead className="bg-slate-100 text-xs font-black text-slate-600">
                  <tr>
                    <th className="p-3">
                      <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="اختيار الكل" />
                    </th>
                    <th className="p-3">عنوان المهمة</th>
                    <th className="p-3">المشرف</th>
                    <th className="p-3">المدينة</th>
                    <th className="p-3">المندوب المرتبط</th>
                    <th className="p-3">الأولوية</th>
                    <th className="p-3">الحالة</th>
                    <th className="p-3">تاريخ الاستحقاق</th>
                    <th className="p-3">تاريخ الإنشاء</th>
                    <th className="p-3">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr key={row.id} className={`border-t border-slate-100 ${row.isOverdue ? "bg-red-50/50" : "bg-white"}`}>
                      <td className="p-3">
                        <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleSelected(row.id)} aria-label={`اختيار ${row.title}`} />
                      </td>
                      <td className="p-3">
                        <p className="font-black text-slate-950">{row.title}</p>
                        <p className="mt-1 max-w-md truncate text-xs font-bold text-slate-500">{row.description}</p>
                      </td>
                      <td className="p-3 font-bold text-slate-800">{row.supervisorName}</td>
                      <td className="p-3 font-bold text-slate-800">{row.cityName}</td>
                      <td className="p-3 font-bold text-slate-800">{row.driverName}</td>
                      <td className="p-3">
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${priorityBadge(row.priority)}`}>{row.priorityLabel}</span>
                      </td>
                      <td className="p-3">
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${statusBadge(row.statusKey)}`}>{row.statusLabel}</span>
                      </td>
                      <td className="p-3 font-bold text-slate-800">{row.dueDate || "-"}</td>
                      <td className="p-3 font-bold text-slate-500">{row.createdAt}</td>
                      <td className="p-3">
                        <RowActions row={row} canManage={data.access.canManage} busy={busy} onPatch={patchTask} onCancel={cancelTask} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 grid gap-3 md:hidden">
              {data.rows.map((row) => (
                <article key={row.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-lg font-black text-slate-950">{row.title}</h3>
                      <p className="text-xs font-bold text-slate-500">{row.supervisorName} / {row.cityName}</p>
                    </div>
                    <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleSelected(row.id)} />
                  </div>
                  <p className="mt-3 text-sm font-bold text-slate-600">{row.description}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${priorityBadge(row.priority)}`}>{row.priorityLabel}</span>
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${statusBadge(row.statusKey)}`}>{row.statusLabel}</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">{row.dueDate || "-"}</span>
                  </div>
                  <div className="mt-3">
                    <RowActions row={row} canManage={data.access.canManage} busy={busy} onPatch={patchTask} onCancel={cancelTask} />
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
            <h3 className="text-xl font-black text-slate-950">لا توجد مهام حسب الفلاتر الحالية.</h3>
            <p className="mt-2 text-sm font-bold text-slate-500">أنشئ مهمة جديدة للمشرف أو غيّر الفلاتر.</p>
            <button type="button" onClick={() => setModalOpen(true)} disabled={!data.access.canCreate} className="mt-5 rounded-xl bg-emerald-600 px-5 py-2 text-sm font-black text-white disabled:bg-slate-300">
              + إضافة مهمة
            </button>
          </div>
        )}
      </section>

      {modalOpen ? (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/50 p-4">
          <form onSubmit={submitTask} className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black text-slate-950">إضافة مهمة للمشرف</h2>
                <p className="text-sm font-bold text-slate-500">بعد الحفظ سيتم إنشاء تنبيه للمشرف المحدد تلقائيًا.</p>
              </div>
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-800">
                إغلاق
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <Field label="عنوان المهمة">
                <input value={form.title} onChange={(event) => updateForm("title", event.target.value)} className={inputClass} required />
              </Field>
              <Field label="نوع المهمة">
                <select value={form.category} onChange={(event) => updateForm("category", event.target.value)} className={inputClass}>
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="المدينة">
                <select value={form.cityId} onChange={(event) => updateForm("cityId", event.target.value)} className={inputClass} required>
                  <option value="">اختر المدينة</option>
                  {data.options.cities.map((city) => (
                    <option key={city.id} value={city.id}>
                      {city.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="المشرف">
                <select value={form.supervisorId} onChange={(event) => updateForm("supervisorId", event.target.value)} className={inputClass} required>
                  <option value="">اختر المشرف</option>
                  {citySupervisors.map((supervisor) => (
                    <option key={supervisor.id} value={supervisor.id}>
                      {supervisor.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="الأولوية">
                <select value={form.priority} onChange={(event) => updateForm("priority", event.target.value as SupervisorTaskPriority)} className={inputClass}>
                  <option value="INFO">عادي</option>
                  <option value="WARNING">مهم</option>
                  <option value="CRITICAL">عاجل</option>
                </select>
              </Field>
              <Field label="تاريخ الاستحقاق">
                <input type="date" value={form.dueDate} onChange={(event) => updateForm("dueDate", event.target.value)} className={inputClass} required />
              </Field>
              <Field label="مندوب مرتبط">
                <select value={form.driverId} onChange={(event) => updateForm("driverId", event.target.value)} className={inputClass}>
                  <option value="">بدون مندوب</option>
                  {cityDrivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="ملاحظات">
                <input value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} className={inputClass} />
              </Field>
              <div className="md:col-span-2">
                <Field label="تفاصيل المهمة">
                  <textarea value={form.description} onChange={(event) => updateForm("description", event.target.value)} className={`${inputClass} min-h-28`} required />
                </Field>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-black text-slate-800">
                إلغاء
              </button>
              <button type="submit" disabled={busy} className="rounded-xl bg-emerald-600 px-8 py-2 text-sm font-black text-white disabled:bg-slate-300">
                {busy ? "جاري الحفظ..." : "حفظ وإرسال التنبيه"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
}

function StatCard({ title, value, kind = "normal" }: { title: string; value: number; kind?: "normal" | "warning" | "danger" | "success" }) {
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${cardClass(kind)}`}>
      <p className="text-sm font-black opacity-70">{title}</p>
      <p className="mt-3 text-3xl font-black">{numberText(value)}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-black text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function RowActions({
  row,
  canManage,
  busy,
  onPatch,
  onCancel,
}: {
  row: SupervisorTasksData["rows"][number];
  canManage: boolean;
  busy: boolean;
  onPatch: (id: string, body: Record<string, string>) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {row.statusKey !== "IN_PROGRESS" && row.statusKey !== "COMPLETED" ? (
        <button type="button" disabled={busy} onClick={() => onPatch(row.id, { status: "IN_PROGRESS" })} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-black text-blue-700 disabled:opacity-50">
          بدء
        </button>
      ) : null}
      {row.statusKey !== "COMPLETED" ? (
        <button type="button" disabled={busy} onClick={() => onPatch(row.id, { status: "COMPLETED" })} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700 disabled:opacity-50">
          مكتملة
        </button>
      ) : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          const notes = window.prompt("أضف ملاحظة للمهمة", row.notes);
          if (notes !== null) void onPatch(row.id, { notes });
        }}
        className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-black text-slate-700 disabled:opacity-50"
      >
        ملاحظة
      </button>
      {canManage ? (
        <button type="button" disabled={busy} onClick={() => onCancel(row.id)} className="rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs font-black text-red-700 disabled:opacity-50">
          إلغاء
        </button>
      ) : null}
    </div>
  );
}
