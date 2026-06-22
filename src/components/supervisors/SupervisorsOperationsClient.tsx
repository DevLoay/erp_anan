"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { SupervisorPerformanceReport, SupervisorPerformanceRow } from "@/lib/supervisor-performance";

type Props = {
  report: SupervisorPerformanceReport;
};

function scoreText(score: number | null) {
  return score === null ? "غير كاف" : `${score}%`;
}

function scoreClass(score: number | null) {
  if (score === null) return "bg-slate-100 text-slate-600";
  if (score >= 85) return "bg-emerald-100 text-emerald-800";
  if (score >= 70) return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
}

function statusClass(status: SupervisorPerformanceRow["statusLabel"]) {
  if (status === "طبيعي") return "bg-emerald-100 text-emerald-800";
  if (status === "لا يوجد مناديب") return "bg-amber-100 text-amber-800";
  if (status === "لا توجد تقارير") return "bg-blue-100 text-blue-800";
  return "bg-red-100 text-red-800";
}

function downloadCsv(rows: SupervisorPerformanceRow[]) {
  const header = ["المشرف", "المدينة", "المناديب", "التقارير", "المهام", "الشخصي", "العملي", "KPI النهائي", "التنبيهات"];
  const lines = rows.map((row) =>
    [
      row.name,
      row.cityName,
      row.linkedDrivers,
      row.reportsCount,
      row.tasksCount,
      row.personalScore,
      row.operationalScore ?? "",
      row.finalKpi ?? "",
      row.warnings.join(" | "),
    ]
      .map((value) => `"${String(value).replaceAll('"', '""')}"`)
      .join(","),
  );
  const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "supervisors-performance.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function openCrudSection() {
  const details = document.getElementById("supervisor-crud") as HTMLDetailsElement | null;
  if (details) {
    details.open = true;
    details.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function ProgressRow({ label, score, note }: { label: string; score: number | null; note: string }) {
  const width = score ?? 0;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-black text-slate-950">{label}</h4>
          <p className="mt-1 text-xs font-bold text-slate-500">{note}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-black ${scoreClass(score)}`}>{scoreText(score)}</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-gradient-to-l from-sky-500 to-teal-600" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function EvaluationModal({ row, onClose, onCreateTask }: { row: SupervisorPerformanceRow; onClose: () => void; onCreateTask: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl" dir="rtl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-xl font-black text-slate-950">تقييم المشرف - {row.name}</h2>
            <p className="mt-1 text-xs font-bold text-slate-500">
              التقييم محسوب من بيانات المشرف، الفريق، التقارير اليومية، والمهام المحفوظة.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-black text-slate-700 hover:bg-slate-50">
            إغلاق
          </button>
        </div>

        <div className="max-h-[78vh] space-y-4 overflow-auto p-5">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
              <p className="text-sm font-black text-slate-700">KPI النهائي</p>
              <strong className={`mt-2 block text-3xl font-black ${row.finalKpi === null ? "text-slate-500" : "text-slate-950"}`}>{scoreText(row.finalKpi)}</strong>
              <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-black ${statusClass(row.statusLabel)}`}>{row.statusLabel}</span>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
              <p className="text-sm font-black text-slate-700">التقييم الشخصي 50%</p>
              <strong className="mt-2 block text-3xl font-black text-slate-950">{row.personalScore}%</strong>
              <p className="mt-1 text-xs font-bold text-slate-500">من ملف المشرف، تنظيم الفريق، ومتابعة المهام.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
              <p className="text-sm font-black text-slate-700">التقييم العملي 50%</p>
              <strong className={`mt-2 block text-3xl font-black ${row.operationalScore === null ? "text-slate-500" : "text-slate-950"}`}>{scoreText(row.operationalScore)}</strong>
              <p className="mt-1 text-xs font-bold text-slate-500">من أداء المناديب والتقارير والتارجت.</p>
            </div>
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-lg font-black text-slate-950">التقييم الشخصي - 50%</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {row.personalItems.map((item) => (
                <ProgressRow key={item.label} label={item.label} score={item.score} note={item.note} />
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-lg font-black text-slate-950">التقييم العملي - 50%</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {row.operationalItems.map((item) => (
                <ProgressRow key={item.label} label={item.label} score={item.score} note={item.note} />
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <h3 className="text-lg font-black text-slate-950">مهام المشرف</h3>
              <button type="button" onClick={onCreateTask} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-black text-white">
                إنشاء مهمة
              </button>
            </div>
            <div className="mt-3 grid gap-2">
              {row.tasks.map((task) => (
                <div key={task.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-sm font-black text-slate-950">{task.title}</strong>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-slate-700">{task.status}</span>
                  </div>
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    {task.description || "بدون وصف"} {task.dueDate ? `- استحقاق ${task.dueDate}` : ""}
                  </p>
                </div>
              ))}
              {!row.tasks.length ? <p className="rounded-xl bg-slate-50 p-4 text-sm font-bold text-slate-500">لا توجد مهام محفوظة لهذا المشرف حالياً.</p> : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function ProfileModal({ row, onClose }: { row: SupervisorPerformanceRow; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-2xl bg-white p-5 shadow-2xl" dir="rtl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-xl font-black text-slate-950">خصائص المشرف - {row.name}</h2>
            <p className="mt-1 text-sm font-bold text-slate-500">{row.email || "لا يوجد بريد"} - {row.phone || "لا يوجد جوال"}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-black text-slate-700">
            إغلاق
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-black text-slate-500">المدينة</p>
            <strong className="mt-1 block text-sm font-black text-slate-950">{row.cityName}</strong>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-black text-slate-500">المناديب</p>
            <strong className="mt-1 block text-sm font-black text-slate-950">{row.linkedDrivers}</strong>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-black text-slate-500">التقارير</p>
            <strong className="mt-1 block text-sm font-black text-slate-950">{row.reportsCount}</strong>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-black text-slate-500">المهام المفتوحة</p>
            <strong className="mt-1 block text-sm font-black text-slate-950">{row.openTasks}</strong>
          </div>
        </div>

        <h3 className="mt-5 text-lg font-black text-slate-950">المناديب المرتبطين</h3>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {row.teamDrivers.map((driver) => (
            <div key={driver.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <strong className="block text-sm font-black text-slate-950">{driver.name}</strong>
              <p className="mt-1 text-xs font-bold text-slate-500">
                {driver.code} - {driver.cityName} - {driver.projectName} - {driver.status}
              </p>
            </div>
          ))}
          {!row.teamDrivers.length ? <p className="rounded-xl bg-slate-50 p-4 text-sm font-bold text-slate-500">لا يوجد مناديب مرتبطون بهذا المشرف.</p> : null}
        </div>
      </div>
    </div>
  );
}

function TaskModal({ row, onClose }: { row: SupervisorPerformanceRow; onClose: () => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const payload = {
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? ""),
      cityId: row.cityId,
      supervisorId: row.id,
      priority: String(form.get("priority") ?? "INFO"),
      category: "متابعة مشرف",
      status: "PENDING",
      dueDate: String(form.get("dueDate") ?? ""),
    };
    try {
      const res = await fetch("/api/supervisor-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "تعذر إنشاء المهمة");
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر إنشاء المهمة");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
      <form onSubmit={submit} className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl" dir="rtl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-xl font-black text-slate-950">إنشاء مهمة للمشرف</h2>
            <p className="mt-1 text-sm font-bold text-slate-500">{row.name}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-black text-slate-700">
            إغلاق
          </button>
        </div>

        <div className="mt-4 grid gap-3">
          <label className="grid gap-1 text-sm font-bold text-slate-700">
            عنوان المهمة
            <input name="title" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold outline-none focus:border-sky-500" />
          </label>
          <label className="grid gap-1 text-sm font-bold text-slate-700">
            الوصف
            <textarea name="description" rows={4} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold outline-none focus:border-sky-500" />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm font-bold text-slate-700">
              الأولوية
              <select name="priority" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">
                <option value="INFO">معلومة</option>
                <option value="WARNING">تحذير</option>
                <option value="CRITICAL">حرج</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-bold text-slate-700">
              تاريخ الاستحقاق
              <input name="dueDate" type="date" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold" />
            </label>
          </div>
          {error ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null}
        </div>

        <div className="mt-5 flex justify-end gap-2 border-t border-slate-200 pt-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-black text-slate-700" disabled={saving}>
            إلغاء
          </button>
          <button type="submit" className="rounded-lg bg-slate-950 px-5 py-2 text-sm font-black text-white disabled:opacity-60" disabled={saving}>
            {saving ? "جاري الحفظ..." : "حفظ المهمة"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function SupervisorsOperationsClient({ report }: Props) {
  const [evaluationRow, setEvaluationRow] = useState<SupervisorPerformanceRow | null>(null);
  const [profileRow, setProfileRow] = useState<SupervisorPerformanceRow | null>(null);
  const [taskRow, setTaskRow] = useState<SupervisorPerformanceRow | null>(null);
  const rows = report.rows;
  const weakRows = useMemo(() => rows.filter((row) => row.finalKpi !== null && row.finalKpi < 75), [rows]);

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={openCrudSection} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-emerald-700">
          + إضافة مشرف
        </button>
        <a href="/rider-kpi" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800 shadow-sm hover:bg-slate-50">
          KPI المناديب
        </a>
        <a href="/performance-analysis" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800 shadow-sm hover:bg-slate-50">
          تحليل الأداء
        </a>
        <button type="button" onClick={() => window.print()} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800 shadow-sm hover:bg-slate-50">
          Print / PDF
        </button>
        <button type="button" onClick={() => downloadCsv(rows)} className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-blue-800">
          تصدير Excel
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-black text-slate-500">المشرفين</p>
          <strong className="mt-2 block text-2xl font-black text-slate-950">{report.summary.supervisors}</strong>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-black text-slate-500">المناديب المرتبطين</p>
          <strong className="mt-2 block text-2xl font-black text-slate-950">{report.summary.linkedDrivers}</strong>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-black text-slate-500">تقارير الفترة</p>
          <strong className="mt-2 block text-2xl font-black text-slate-950">{report.summary.periodReports}</strong>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-black text-slate-500">متوسط KPI</p>
          <strong className="mt-2 block text-2xl font-black text-amber-700">{scoreText(report.summary.avgFinalKpi)}</strong>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-black text-slate-500">مهام مفتوحة / ضعفاء</p>
          <strong className="mt-2 block text-2xl font-black text-red-700">{report.summary.openTasks} / {report.summary.weakSupervisors}</strong>
        </div>
      </div>

      <form className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          <label className="grid gap-1 text-xs font-black text-slate-600">
            الشهر
            <input name="month" type="month" defaultValue={report.filters.month} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold" />
          </label>
          <label className="grid gap-1 text-xs font-black text-slate-600">
            من
            <input name="from" type="date" defaultValue={report.filters.from} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold" />
          </label>
          <label className="grid gap-1 text-xs font-black text-slate-600">
            إلى
            <input name="to" type="date" defaultValue={report.filters.to} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold" />
          </label>
          <label className="grid gap-1 text-xs font-black text-slate-600">
            المدينة
            <select name="cityId" defaultValue={report.filters.cityId} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">
              <option value="">كل المدن</option>
              {report.options.cities.map((city) => (
                <option key={city.id} value={city.id}>{city.name}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-black text-slate-600">
            التطبيق
            <select name="appName" defaultValue={report.filters.appName} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">
              <option value="">كل التطبيقات</option>
              {report.options.appNames.map((appName) => (
                <option key={appName} value={appName}>{appName}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-black text-slate-600">
            المشرف
            <select name="supervisorId" defaultValue={report.filters.supervisorId} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">
              <option value="">كل المشرفين</option>
              {report.options.supervisors.map((supervisor) => (
                <option key={supervisor.id} value={supervisor.id}>{supervisor.name}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-black text-slate-600">
            بحث
            <input name="q" defaultValue={report.filters.q} placeholder="مندوب / رقم حساب / جوال" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold" />
          </label>
        </div>
        <div className="mt-3 flex justify-between gap-2">
          <button type="submit" className="rounded-xl bg-slate-950 px-6 py-2 text-sm font-black text-white shadow-sm">
            تطبيق
          </button>
          <a href="/supervisors" className="rounded-xl border border-slate-300 bg-white px-6 py-2 text-sm font-black text-slate-700">
            عرض الكل
          </a>
        </div>
      </form>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto" dir="ltr">
          <table className="w-full min-w-full table-fixed text-right text-sm" dir="rtl">
            <colgroup>
              <col className="w-[220px]" />
              <col className="w-[95px]" />
              <col className="w-[58px]" />
              <col className="w-[58px]" />
              <col className="w-[58px]" />
              <col className="w-[58px]" />
              <col className="w-[86px]" />
              <col className="w-[86px]" />
              <col className="w-[86px]" />
              <col className="w-[100px]" />
              <col className="w-[175px]" />
            </colgroup>
            <thead className="bg-slate-50 text-xs font-black text-slate-500">
              <tr>
                <th className="px-3 py-2.5">المشرف</th>
                <th className="px-3 py-2.5">المدينة</th>
                <th className="px-3 py-2.5">مناديب</th>
                <th className="px-3 py-2.5">تقارير</th>
                <th className="px-3 py-2.5">مهام</th>
                <th className="px-3 py-2.5">تطبيقات</th>
                <th className="px-3 py-2.5">الشخصي 50%</th>
                <th className="px-3 py-2.5">العملي 50%</th>
                <th className="px-3 py-2.5">KPI النهائي</th>
                <th className="px-3 py-2.5">تنبيهات</th>
                <th className="sticky left-0 z-20 bg-slate-50 px-3 py-2.5 shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.45)]">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id} className="group hover:bg-slate-50">
                  <td className="px-3 py-2.5">
                    <strong className="block text-sm font-black text-slate-950">{row.name}</strong>
                    <span className="text-xs font-bold text-slate-500">{row.email || row.phone || "لا توجد بيانات تواصل"}</span>
                  </td>
                  <td className="truncate px-3 py-2.5 font-semibold">{row.cityName}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-black">{row.linkedDrivers}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-black">{row.reportsCount}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-black">{row.tasksCount}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-black">{row.applicationsCount}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-black ${scoreClass(row.personalScore)}`}>{row.personalScore}%</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-black ${scoreClass(row.operationalScore)}`}>{scoreText(row.operationalScore)}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-black ${scoreClass(row.finalKpi)}`}>{scoreText(row.finalKpi)}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${statusClass(row.statusLabel)}`}>{row.statusLabel}</span>
                  </td>
                  <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-2.5 shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.45)] group-hover:bg-slate-50">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <button type="button" onClick={() => setEvaluationRow(row)} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-black text-slate-800 hover:bg-slate-50">
                        KPI
                      </button>
                      <button type="button" onClick={() => setProfileRow(row)} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-black text-slate-800 hover:bg-slate-50">
                        خصائص
                      </button>
                      <button type="button" onClick={() => setProfileRow(row)} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-black text-slate-800 hover:bg-slate-50">
                        ربط مناديب
                      </button>
                      <button type="button" onClick={() => setTaskRow(row)} className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-black text-amber-800 hover:bg-amber-100">
                        مهمة
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center font-bold text-slate-500">
                    لا توجد بيانات مشرفين مطابقة للفلاتر الحالية.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-lg font-black text-slate-950">مشرفون يحتاجون متابعة</h3>
          <div className="mt-3 grid gap-2">
            {weakRows.slice(0, 6).map((row) => (
              <button key={row.id} type="button" onClick={() => setEvaluationRow(row)} className="rounded-xl border border-red-100 bg-red-50 p-3 text-right">
                <div className="flex items-center justify-between gap-3">
                  <strong className="text-sm font-black text-red-950">{row.name}</strong>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-red-700">{scoreText(row.finalKpi)}</span>
                </div>
                <p className="mt-1 text-xs font-bold text-red-700">{row.warnings.join("، ") || "KPI منخفض"}</p>
              </button>
            ))}
            {!weakRows.length ? <p className="rounded-xl bg-slate-50 p-4 text-sm font-bold text-slate-500">لا توجد مؤشرات ضعف واضحة حسب البيانات الحالية.</p> : null}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-black text-slate-950">مهام المشرفين</h3>
            <button type="button" onClick={() => rows[0] && setTaskRow(rows[0])} className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-black text-white" disabled={!rows.length}>
              مهمة جديدة
            </button>
          </div>
          <div className="mt-3 grid gap-2">
            {report.tasks.slice(0, 8).map((task) => (
              <div key={task.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <strong className="text-sm font-black text-slate-950">{task.title}</strong>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-slate-700">{task.status}</span>
                </div>
                <p className="mt-1 text-xs font-bold text-slate-500">{task.description || "بدون وصف"}</p>
              </div>
            ))}
            {!report.tasks.length ? <p className="rounded-xl bg-slate-50 p-4 text-sm font-bold text-slate-500">لا توجد مهام مشرفين محفوظة حالياً.</p> : null}
          </div>
        </div>
      </section>

      {evaluationRow ? (
        <EvaluationModal row={evaluationRow} onClose={() => setEvaluationRow(null)} onCreateTask={() => setTaskRow(evaluationRow)} />
      ) : null}
      {profileRow ? <ProfileModal row={profileRow} onClose={() => setProfileRow(null)} /> : null}
      {taskRow ? <TaskModal row={taskRow} onClose={() => setTaskRow(null)} /> : null}
    </div>
  );
}
