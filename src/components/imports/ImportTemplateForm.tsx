"use client";

import type { FormEvent } from "react";
import type { ImportTemplateRow } from "@/lib/imports/templates";

type Props = {
  template?: ImportTemplateRow | null;
  applications: { id: string; code: string; name: string }[];
  projects: { id: string; code: string; name: string; applicationId: string }[];
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
};

export function ImportTemplateForm({ template, applications, projects, onSubmit, onCancel }: Props) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await onSubmit({
      name: form.get("name"),
      fileType: form.get("fileType"),
      applicationId: form.get("applicationId"),
      applicationProjectId: form.get("applicationProjectId"),
      status: form.get("status"),
      requiredColumns: template?.requiredColumns ?? [],
      optionalColumns: template?.optionalColumns ?? [],
      columnMapping: template?.columnMapping ?? [],
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2" dir="rtl">
      <label className="grid gap-2 text-sm font-black text-slate-700">
        اسم القالب
        <input name="name" defaultValue={template?.name ?? ""} required className="rounded-xl border border-slate-300 px-3 py-2" />
      </label>
      <label className="grid gap-2 text-sm font-black text-slate-700">
        نوع الملف
        <input name="fileType" defaultValue={template?.fileType ?? ""} required className="rounded-xl border border-slate-300 px-3 py-2" />
      </label>
      <label className="grid gap-2 text-sm font-black text-slate-700">
        التطبيق
        <select name="applicationId" defaultValue={template?.applicationId ?? ""} className="rounded-xl border border-slate-300 px-3 py-2">
          <option value="">بدون تطبيق محدد</option>
          {applications.map((app) => (
            <option key={app.id} value={app.id}>
              {app.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-2 text-sm font-black text-slate-700">
        مشروع التطبيق
        <select name="applicationProjectId" defaultValue={template?.applicationProjectId ?? ""} className="rounded-xl border border-slate-300 px-3 py-2">
          <option value="">كل المشاريع</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-2 text-sm font-black text-slate-700">
        الحالة
        <select name="status" defaultValue={template?.status === "غير نشط" ? "INACTIVE" : "ACTIVE"} className="rounded-xl border border-slate-300 px-3 py-2">
          <option value="ACTIVE">نشط</option>
          <option value="INACTIVE">غير نشط</option>
          <option value="PENDING">قيد المراجعة</option>
        </select>
      </label>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold text-amber-900 md:col-span-2">
        الأعمدة المطلوبة: {template?.requiredColumns.map((column) => column.displayName).join("، ") || "سيتم ضبطها من القالب القياسي لاحقًا"}
      </div>

      <div className="flex flex-wrap gap-2 md:col-span-2">
        <button type="submit" className="rounded-xl bg-amber-600 px-5 py-2 text-sm font-black text-white hover:bg-amber-700">
          حفظ القالب
        </button>
        <button type="button" onClick={onCancel} className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-black text-slate-700 hover:bg-slate-50">
          إلغاء
        </button>
      </div>
    </form>
  );
}

