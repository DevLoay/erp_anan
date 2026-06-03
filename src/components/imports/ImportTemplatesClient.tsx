"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ImportTemplateForm } from "./ImportTemplateForm";
import type { ImportTemplatesData, ImportTemplateRow } from "@/lib/imports/templates";

type Props = {
  data: ImportTemplatesData;
  basePath?: string;
};

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

export function ImportTemplatesClient({ data, basePath = "/imports/templates" }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [toast, setToast] = useState("");
  const [editing, setEditing] = useState<ImportTemplateRow | null>(null);
  const [showForm, setShowForm] = useState(false);

  const fileTypes = useMemo(() => [...new Set(data.rows.map((row) => row.fileType))].sort(), [data.rows]);

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${basePath}?${params.toString()}`);
  }

  function downloadTemplate(row: ImportTemplateRow) {
    const id = encodeURIComponent(row.id);
    window.location.href = `/api/import-templates/${id}/download?fileType=${encodeURIComponent(row.fileType)}`;
  }

  function testTemplate(row: ImportTemplateRow) {
    router.push(`/imports/preview?templateId=${encodeURIComponent(row.id)}&importType=${encodeURIComponent(row.fileType)}`);
  }

  async function copyTemplate(row: ImportTemplateRow) {
    const res = await fetch("/api/import-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${row.name} - نسخة`,
        fileType: row.fileType,
        applicationId: row.applicationId,
        applicationProjectId: row.applicationProjectId,
        requiredColumns: row.requiredColumns,
        optionalColumns: row.optionalColumns,
        columnMapping: row.columnMapping,
        status: "ACTIVE",
      }),
    });
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setToast(payload.error || "تعذر نسخ القالب.");
      return;
    }
    setToast("تم نسخ القالب بنجاح.");
    router.refresh();
  }

  async function toggleTemplateStatus(row: ImportTemplateRow) {
    if (row.source !== "database") {
      await copyTemplate({ ...row, name: `${row.name} - مخصص` });
      return;
    }
    const nextStatus = row.status === "نشط" ? "INACTIVE" : "ACTIVE";
    const res = await fetch(`/api/import-templates/${encodeURIComponent(row.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setToast(payload.error || "تعذر تغيير حالة القالب.");
      return;
    }
    setToast("تم تحديث حالة القالب.");
    router.refresh();
  }

  async function submitTemplate(payload: Record<string, unknown>) {
    const target = editing?.source === "database" ? `/api/import-templates/${editing.id}` : "/api/import-templates";
    const method = editing?.source === "database" ? "PATCH" : "POST";
    const res = await fetch(target, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (!res.ok) {
      setToast(result.error ?? "تعذر حفظ القالب");
      return;
    }
    setToast("تم حفظ القالب بنجاح");
    setShowForm(false);
    setEditing(null);
    router.refresh();
  }

  if (data.databaseStatus === "offline") {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm font-bold text-red-800" dir="rtl">
        {data.databaseMessage}
      </div>
    );
  }

  return (
    <section className="w-full max-w-none space-y-5 bg-slate-50" dir="rtl">
      {toast ? <Toast message={toast} onClose={() => setToast("")} /> : null}

      <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
        <MetricCard title="إجمالي القوالب" value={data.summary.total} tone="blue" />
        <MetricCard title="القوالب النشطة" value={data.summary.active} tone="emerald" />
        <MetricCard title="قوالب التطبيقات" value={data.summary.applicationTemplates} />
        <MetricCard title="قوالب المناديب" value={data.summary.driverTemplates} />
        <MetricCard title="قوالب السيارات" value={data.summary.vehicleTemplates} />
        <MetricCard title="قوالب الماليات" value={data.summary.financeTemplates} />
        <MetricCard title="تحتاج Mapping" value={data.summary.needsMapping} tone={data.summary.needsMapping ? "amber" : "emerald"} />
        <MetricCard title="آخر قالب مستخدم" value={data.summary.lastUsed} />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-black text-white hover:bg-amber-700"
        >
          إضافة قالب
        </button>
        <button type="button" onClick={() => setToast("اختر قالبًا من الجدول لتحميله بصيغة Excel")} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700">
          تحميل قالب
        </button>
        <button type="button" onClick={() => (data.rows[0] ? testTemplate(data.rows[0]) : setToast("لا توجد قوالب متاحة للاختبار."))} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700">
          اختبار قالب
        </button>
        <Link href="/imports" className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-black text-blue-800">
          فتح الاستيراد
        </Link>
        <button type="button" onClick={() => router.refresh()} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700">
          تحديث
        </button>
      </div>

      {showForm ? (
        <ImportTemplateForm
          template={editing}
          applications={data.applications}
          projects={data.projects}
          onSubmit={submitTemplate}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      ) : null}

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-5">
        <label className="grid gap-2 text-xs font-black text-slate-600">
          نوع القالب
          <select value={data.filters.fileType} onChange={(event) => updateFilter("fileType", event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2">
            <option value="">كل الأنواع</option>
            {fileTypes.map((fileType) => (
              <option key={fileType} value={fileType}>
                {fileType}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-xs font-black text-slate-600">
          التطبيق
          <select value={data.filters.applicationId} onChange={(event) => updateFilter("applicationId", event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2">
            <option value="">كل التطبيقات</option>
            {data.applications.map((app) => (
              <option key={app.id} value={app.id}>
                {app.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-xs font-black text-slate-600">
          المشروع
          <select value={data.filters.applicationProjectId} onChange={(event) => updateFilter("applicationProjectId", event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2">
            <option value="">كل المشاريع</option>
            {data.projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-xs font-black text-slate-600">
          الحالة
          <select value={data.filters.status} onChange={(event) => updateFilter("status", event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2">
            <option value="">كل الحالات</option>
            <option value="ACTIVE">نشط</option>
            <option value="INACTIVE">غير نشط</option>
            <option value="PENDING">قيد المراجعة</option>
          </select>
        </label>
        <label className="grid gap-2 text-xs font-black text-slate-600">
          بحث بالاسم
          <input defaultValue={data.filters.q} onBlur={(event) => updateFilter("q", event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2" placeholder="اسم القالب..." />
        </label>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[1200px] text-right text-sm">
          <thead className="bg-slate-50 text-xs font-black text-slate-500">
            <tr>
              {["Template Name", "File Type", "Application", "Project", "Required", "Optional", "Mapping Status", "Last Used", "Status", "Actions"].map((head) => (
                <th key={head} className="whitespace-nowrap px-4 py-3">
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-3 font-black">{row.name}</td>
                <td className="whitespace-nowrap px-4 py-3">{row.fileType}</td>
                <td className="whitespace-nowrap px-4 py-3">{row.applicationName}</td>
                <td className="whitespace-nowrap px-4 py-3">{row.projectName}</td>
                <td className="whitespace-nowrap px-4 py-3">{row.requiredColumnsCount}</td>
                <td className="whitespace-nowrap px-4 py-3">{row.optionalColumnsCount}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-black text-amber-800">{row.mappingStatus}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-3">{row.lastUsedAt}</td>
                <td className="whitespace-nowrap px-4 py-3">{row.status}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" onClick={() => setToast(JSON.stringify(row.requiredColumns, null, 2))} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-black text-slate-700">
                      عرض التفاصيل
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(row);
                        setShowForm(true);
                      }}
                      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-black text-slate-700"
                    >
                      تعديل
                    </button>
                    <button type="button" onClick={() => downloadTemplate(row)} className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-black text-blue-800">
                      تحميل Excel
                    </button>
                    <button type="button" onClick={() => testTemplate(row)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-black text-slate-700">
                      اختبار
                    </button>
                    <button type="button" onClick={() => void copyTemplate(row)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-black text-slate-700">
                      نسخ
                    </button>
                    <button type="button" onClick={() => void toggleTemplateStatus(row)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-black text-slate-700">
                      تعطيل / تفعيل
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
