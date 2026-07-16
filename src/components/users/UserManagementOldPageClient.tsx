"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { UserManagementData, UserManagementRow } from "@/lib/users/getUserManagementOldPageData";

type Props = {
  data: UserManagementData;
};

type FormState = {
  name: string;
  email: string;
  role: string;
  status: string;
  cityId: string;
  supervisorId: string;
  driverId: string;
  cityScope: string[];
  projectScope: string[];
  password: string;
};

const emptyForm: FormState = {
  name: "",
  email: "",
  role: "VIEWER",
  status: "active",
  cityId: "",
  supervisorId: "",
  driverId: "",
  cityScope: [],
  projectScope: [],
  password: "",
};


const roleGuides: Record<string, { title: string; tone: string; summary: string; rules: string[] }> = {
  ADMIN: {
    title: "مدير نظام كامل",
    tone: "border-red-200 bg-red-50 text-red-900",
    summary: "صلاحية كاملة على كل النظام وكل المدن والمشاريع. لا يحتاج نطاق مدينة أو مشروع.",
    rules: ["قراءة وتعديل وحذف", "إدارة المستخدمين والصلاحيات", "الإعدادات وسجل العمليات"],
  },
  OPERATION_MANAGER: {
    title: "مدير تشغيل",
    tone: "border-blue-200 bg-blue-50 text-blue-900",
    summary: "صلاحيات تشغيل واسعة بدون حذف أو إعدادات حساسة. يفضل ترك النطاق عام أو اختيار المدن المطلوبة.",
    rules: ["إدارة التشغيل والسيارات والمناديب", "تقارير ومتابعة", "لا يدير مستخدمين إلا لو Admin"],
  },
  SUPERVISOR: {
    title: "مشرف مدينة أو مشروع",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
    summary: "مشرف المدينة يرى كل المشاريع والمناديب والسيارات والمسيرات داخل مدينته. عند اختيار مشروع يصبح مشرف مشروع ويرى بيانات هذا المشروع فقط.",
    rules: ["بدون مشروع: كل بيانات المدينة", "مع مشروع: بيانات المشروع فقط", "لا يملك إدارة المستخدمين أو الاعتماد والحذف"],
  },
  ACCOUNTANT: {
    title: "محاسب / مالية",
    tone: "border-amber-200 bg-amber-50 text-amber-900",
    summary: "إدارة الماليات والمسير والفواتير والسلف والخصومات. يفضل تحديد المدن أو المشاريع المالية.",
    rules: ["فواتير ومدفوعات ومصروفات", "مسير الرواتب", "بدون إدارة مستخدمين"],
  },
  HR: {
    title: "موارد بشرية",
    tone: "border-purple-200 bg-purple-50 text-purple-900",
    summary: "إدارة المناديب والملفات والعقود والسكن. يفضل تحديد نطاق مدينة.",
    rules: ["ملفات المناديب", "العقود والسكن", "نطاق مدينة أو مشروع"],
  },
  VIEWER: {
    title: "مشاهدة فقط",
    tone: "border-slate-200 bg-slate-50 text-slate-800",
    summary: "قراءة فقط بدون تعديل. مناسب للمتابعة أو المراجعة.",
    rules: ["عرض فقط", "بدون إنشاء أو تعديل", "لا يملك صلاحيات حساسة"],
  },
};

function uniqueValues(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function fmt(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function splitScope(value: string) {
  return value
    .split(/[;,|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function supervisorScopeLabel(row: Pick<UserManagementRow, "role" | "projectScope" | "projectScopeRaw">) {
  if (row.role !== "SUPERVISOR") return row.projectScope;
  return splitScope(row.projectScopeRaw).length ? `مشرف مشروع: ${row.projectScope}` : "مشرف مدينة: كل مشاريع المدينة";
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-5 left-5 z-[100] flex max-w-sm items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 shadow-2xl">
      <span>{message}</span>
      <button type="button" onClick={onClose} className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-black text-slate-700">
        إغلاق
      </button>
    </div>
  );
}

function ActionButton({ children, tone = "white", onClick }: { children: ReactNode; tone?: "white" | "blue" | "green" | "amber" | "red"; onClick: () => void }) {
  const klass = {
    white: "border-slate-200 bg-white text-slate-950 hover:bg-slate-50",
    blue: "border-blue-600 bg-blue-600 text-white hover:bg-blue-700",
    green: "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700",
    amber: "border-amber-500 bg-amber-500 text-white hover:bg-amber-600",
    red: "border-red-600 bg-red-600 text-white hover:bg-red-700",
  }[tone];
  return (
    <button type="button" onClick={onClick} className={`h-10 rounded-xl border px-4 text-sm font-black shadow-sm ${klass}`}>
      {children}
    </button>
  );
}

function SummaryCard({ title, value, icon }: { title: string; value: string | number; icon: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 text-right shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-3xl">{icon}</span>
        <div>
          <p className="text-sm font-bold text-slate-500">{title}</p>
          <strong className="mt-1 block text-3xl font-black text-slate-950">{value}</strong>
        </div>
      </div>
    </div>
  );
}

function Badge({ label, tone }: { label: string; tone: "emerald" | "red" | "amber" | "slate" | "blue" }) {
  const klass = {
    emerald: "bg-emerald-100 text-emerald-800",
    red: "bg-red-100 text-red-800",
    amber: "bg-amber-100 text-amber-800",
    slate: "bg-slate-100 text-slate-700",
    blue: "bg-blue-100 text-blue-800",
  }[tone];
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${klass}`}>{label}</span>;
}

function buildCsv(rows: UserManagementRow[]) {
  const headers = ["Name", "Email", "Role", "Supervisor Scope", "City Scope", "Supervisor", "Drivers Scope", "Status", "Last Login", "Device"];
  const body = rows.map((row) =>
    [row.name, row.email, row.roleLabel, supervisorScopeLabel(row), row.cityScope, row.supervisorName, row.linkedDriversCount, row.statusLabel, row.lastLogin, row.device]
      .map((item) => `"${String(item).replaceAll('"', '""')}"`)
      .join(","),
  );
  return [headers.join(","), ...body].join("\n");
}

function formFromRow(row: UserManagementRow): FormState {
  return {
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.isActive ? "active" : "inactive",
    cityId: row.cityId,
    supervisorId: row.supervisorId,
    driverId: row.driverId,
    cityScope: splitScope(row.cityScopeRaw),
    projectScope: splitScope(row.projectScopeRaw),
    password: "",
  };
}

function MultiSelect({
  label,
  values,
  onChange,
  options,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  options: { id: string; name: string }[];
}) {
  return (
    <label className="text-xs font-black text-slate-800">
      {label}
      <select
        multiple
        value={values}
        onChange={(event) => onChange(Array.from(event.currentTarget.selectedOptions).map((option) => option.value))}
        className="mt-1 min-h-28 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
      <span className="mt-1 block text-[11px] font-bold text-slate-500">استخدم Ctrl لاختيار أكثر من عنصر.</span>
    </label>
  );
}


function PermissionAssignmentPreview({
  form,
  data,
}: {
  form: FormState;
  data: UserManagementData;
}) {
  const guide = roleGuides[form.role] ?? roleGuides.VIEWER;
  const selectedSupervisor = data.supervisors.find((item) => item.id === form.supervisorId);
  const selectedDriver = data.drivers.find((item) => item.id === form.driverId);
  const selectedCities = data.cities.filter((item) => form.cityScope.includes(item.id));
  const selectedProjects = data.projects.filter((item) => form.projectScope.includes(item.id));
  const isGlobalRole = form.role === "ADMIN" || form.role === "OPERATION_MANAGER";
  const supervisorType = form.role === "SUPERVISOR" ? (form.projectScope.length ? "مشرف مشروع" : "مشرف مدينة") : "";
  const warnings: string[] = [];

  if (form.role === "SUPERVISOR" && !form.supervisorId && !form.cityId && !form.cityScope.length) {
    warnings.push("صلاحية المشرف تحتاج ربط مشرف أو مدينة حتى لا يظهر له نطاق غير واضح.");
  }
  if ((form.role === "ACCOUNTANT" || form.role === "HR") && !form.cityId && !form.cityScope.length && !form.projectScope.length) {
    warnings.push("يفضل تحديد نطاق مدينة أو مشروع لهذا الدور لتجنب الوصول العام غير المقصود.");
  }
  if (form.role === "VIEWER" && (form.cityScope.length || form.projectScope.length)) {
    warnings.push("هذا المستخدم مشاهدة فقط؛ النطاق يحدد ما يراه فقط ولا يسمح بالتعديل.");
  }

  return (
    <section className={`rounded-2xl border p-4 ${guide.tone}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black opacity-70">معاينة الصلاحيات قبل الحفظ</p>
          <h3 className="mt-1 text-xl font-black">{guide.title}</h3>
          <p className="mt-1 text-sm font-bold leading-6">{guide.summary}</p>
        </div>
        <div className="rounded-xl bg-white/70 px-3 py-2 text-xs font-black">
          {isGlobalRole ? "نطاق عام" : supervisorType || "نطاق مخصص"}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div className="rounded-xl bg-white/70 p-3">
          <p className="text-[11px] font-black opacity-70">المدينة الأساسية</p>
          <strong className="mt-1 block text-sm font-black">{data.cities.find((item) => item.id === form.cityId)?.name || "غير محدد"}</strong>
        </div>
        <div className="rounded-xl bg-white/70 p-3">
          <p className="text-[11px] font-black opacity-70">المشرف</p>
          <strong className="mt-1 block text-sm font-black">{selectedSupervisor ? `${selectedSupervisor.name} - ${selectedSupervisor.cityName}` : "غير محدد"}</strong>
        </div>
        <div className="rounded-xl bg-white/70 p-3">
          <p className="text-[11px] font-black opacity-70">حساب مندوب</p>
          <strong className="mt-1 block text-sm font-black">{selectedDriver ? `${selectedDriver.code} - ${selectedDriver.name}` : "غير محدد"}</strong>
        </div>
        <div className="rounded-xl bg-white/70 p-3">
          <p className="text-[11px] font-black opacity-70">نطاق المدن / المشاريع</p>
          <strong className="mt-1 block text-sm font-black">{isGlobalRole ? "كل البيانات" : `${selectedCities.length || 0} مدينة / ${selectedProjects.length || 0} مشروع`}</strong>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl bg-white/70 p-3">
          <p className="text-xs font-black opacity-70">ما يسمح به الدور</p>
          <ul className="mt-2 space-y-1 text-xs font-bold leading-5">
            {guide.rules.map((rule) => <li key={rule}>✓ {rule}</li>)}
          </ul>
        </div>
        <div className="rounded-xl bg-white/70 p-3">
          <p className="text-xs font-black opacity-70">تنبيهات الربط</p>
          {warnings.length ? (
            <ul className="mt-2 space-y-1 text-xs font-bold leading-5 text-red-700">
              {warnings.map((warning) => <li key={warning}>⚠ {warning}</li>)}
            </ul>
          ) : (
            <p className="mt-2 text-xs font-black text-emerald-700">✓ إعداد الصلاحية واضح ويمكن حفظه.</p>
          )}
        </div>
      </div>
    </section>
  );
}

export function UserManagementOldPageClient({ data }: Props) {
  const router = useRouter();
  const [toast, setToast] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<"create" | "edit" | "details" | null>(null);
  const [activeUser, setActiveUser] = useState<UserManagementRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const csv = useMemo(() => buildCsv(data.rows), [data.rows]);

  const printPage = () => window.print();
  const downloadCsv = () => {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "users-permissions.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const openCreate = () => {
    setActiveUser(null);
    setForm(emptyForm);
    setTemporaryPassword(null);
    setFormError(null);
    setModalMode("create");
  };

  const openEdit = (row: UserManagementRow) => {
    setActiveUser(row);
    setForm(formFromRow(row));
    setTemporaryPassword(null);
    setFormError(null);
    setModalMode("edit");
  };

  const openDetails = (row: UserManagementRow) => {
    setActiveUser(row);
    setTemporaryPassword(null);
    setFormError(null);
    setModalMode("details");
  };


  const applyRolePreset = (role: string) => {
    setForm((old) => ({
      ...old,
      role,
      cityScope: role === "ADMIN" || role === "OPERATION_MANAGER" ? [] : old.cityScope,
      projectScope: role === "ADMIN" || role === "OPERATION_MANAGER" ? [] : old.projectScope,
      supervisorId: role === "ADMIN" || role === "OPERATION_MANAGER" ? "" : old.supervisorId,
      driverId: role === "ADMIN" || role === "OPERATION_MANAGER" ? "" : old.driverId,
    }));
  };

  const updateCity = (cityId: string) => {
    setForm((old) => ({
      ...old,
      cityId,
      cityScope: cityId ? uniqueValues([cityId, ...old.cityScope]) : old.cityScope,
    }));
  };

  const updateSupervisor = (supervisorId: string) => {
    const supervisor = data.supervisors.find((item) => item.id === supervisorId);
    setForm((old) => ({
      ...old,
      supervisorId,
      cityId: supervisor?.cityId || old.cityId,
      cityScope: supervisor?.cityId ? uniqueValues([supervisor.cityId, ...old.cityScope]) : old.cityScope,
    }));
  };

  const updateDriver = (driverId: string) => {
    const driver = data.drivers.find((item) => item.id === driverId);
    setForm((old) => ({
      ...old,
      driverId,
      cityId: driver?.cityId || old.cityId,
      supervisorId: driver?.supervisorId || old.supervisorId,
      cityScope: driver?.cityId ? uniqueValues([driver.cityId, ...old.cityScope]) : old.cityScope,
    }));
  };

  const closeModal = () => {
    setModalMode(null);
    setActiveUser(null);
    setTemporaryPassword(null);
    setFormError(null);
    setSaving(false);
  };

  const submitUser = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    setTemporaryPassword(null);

    const isEdit = modalMode === "edit" && activeUser;
    const response = await fetch(isEdit ? `/api/user-management/${activeUser.id}` : "/api/user-management", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, isActive: form.status === "active" }),
    });
    const payload = (await response.json()) as { error?: string; temporaryPassword?: string; passwordUpdated?: boolean };
    setSaving(false);

    if (!response.ok) {
      setFormError(payload.error || "تعذر حفظ المستخدم.");
      return;
    }

    if (payload.temporaryPassword) setTemporaryPassword(payload.temporaryPassword);
    setToast(
      isEdit
        ? payload.passwordUpdated
          ? "تم تعديل المستخدم وتحديث كلمة المرور بنجاح."
          : "تم تعديل المستخدم وربط الصلاحيات."
        : "تم إنشاء المستخدم وحفظ كلمة مرور مؤقتة.",
    );
    router.refresh();
  };

  const resetPassword = async (row: UserManagementRow) => {
    setSaving(true);
    const response = await fetch(`/api/user-management/${row.id}/reset-password`, { method: "POST" });
    const payload = (await response.json()) as { error?: string; temporaryPassword?: string };
    setSaving(false);
    if (!response.ok) {
      setToast(payload.error || "تعذر إعادة كلمة المرور.");
      return;
    }
    setActiveUser(row);
    setTemporaryPassword(payload.temporaryPassword || null);
    setModalMode("details");
    setToast("تم إنشاء كلمة مرور مؤقتة.");
    router.refresh();
  };

  const deactivateUser = async (row: UserManagementRow) => {
    const confirmed = window.confirm(`تعطيل المستخدم ${row.name}؟`);
    if (!confirmed) return;
    setSaving(true);
    const response = await fetch(`/api/user-management/${row.id}`, { method: "DELETE" });
    const payload = (await response.json()) as { error?: string };
    setSaving(false);
    if (!response.ok) {
      setToast(payload.error || "تعذر تعطيل المستخدم.");
      return;
    }
    setToast("تم تعطيل المستخدم وتسجيل العملية في سجل التدقيق.");
    router.refresh();
  };

  if (data.databaseStatus === "offline") {
    return (
      <main className="min-h-screen bg-slate-50 p-4 text-right" dir="rtl">
        <div className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-black text-red-700">قاعدة البيانات غير متصلة</h1>
          <p className="mt-2 text-sm font-bold text-slate-600">يرجى تشغيل PostgreSQL ثم تحديث الصفحة.</p>
          <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">{data.databaseMessage}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-right" dir="rtl" suppressHydrationWarning>
      {toast ? <Toast message={toast} onClose={() => setToast(null)} /> : null}

      {modalMode ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 p-4">
          <section className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 text-right shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <button type="button" onClick={closeModal} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-800">
                إغلاق
              </button>
              <div>
                <h2 className="text-2xl font-black text-slate-950">
                  {modalMode === "create" ? "إضافة مستخدم" : modalMode === "edit" ? `تعديل المستخدم - ${activeUser?.name}` : `صلاحيات المستخدم - ${activeUser?.name}`}
                </h2>
                <p className="mt-1 text-sm font-bold text-slate-500">ربط المستخدم بالمدينة والمشرف ونطاق المناديب والصلاحيات.</p>
              </div>
            </div>

            {temporaryPassword ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-black text-amber-900">كلمة المرور المؤقتة</p>
                <code className="mt-2 block rounded-xl bg-white p-3 text-left text-lg font-black text-slate-950" dir="ltr">
                  {temporaryPassword}
                </code>
                <p className="mt-2 text-xs font-bold text-amber-800">اعرضها للمستخدم الآن. لا يتم عرضها مرة أخرى بعد إغلاق النافذة.</p>
              </div>
            ) : null}

            {modalMode === "details" && activeUser ? (
              <>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-black text-slate-500">الإيميل</p>
                    <strong className="mt-1 block text-sm font-black text-slate-950">{activeUser.email}</strong>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-black text-slate-500">الصلاحية</p>
                    <Badge label={activeUser.roleLabel} tone="blue" />
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-black text-slate-500">نوع ونطاق المشرف</p>
                    <strong className="mt-1 block text-sm font-black text-slate-950">{supervisorScopeLabel(activeUser)}</strong>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-black text-slate-500">نطاق المدينة</p>
                    <strong className="mt-1 block text-sm font-black text-slate-950">{activeUser.cityScope}</strong>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-black text-slate-500">المشرف المرتبط</p>
                    <strong className="mt-1 block text-sm font-black text-slate-950">{activeUser.supervisorName}</strong>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-black text-slate-500">مناديب داخل النطاق</p>
                    <strong className="mt-1 block text-sm font-black text-slate-950">{fmt(activeUser.linkedDriversCount)}</strong>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-black text-slate-500">ملخص الصلاحيات</p>
                    <strong className="mt-1 block text-sm font-black text-slate-950">{activeUser.permissionsSummary}</strong>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <ActionButton tone="blue" onClick={() => openEdit(activeUser)}>تعديل الربط</ActionButton>
                  <ActionButton tone="amber" onClick={() => resetPassword(activeUser)}>إعادة كلمة المرور</ActionButton>
                  <ActionButton tone="red" onClick={() => deactivateUser(activeUser)}>تعطيل المستخدم</ActionButton>
                </div>
              </>
            ) : (
              <form onSubmit={submitUser} className="mt-5 space-y-4">
                {formError ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-black text-red-700">{formError}</div> : null}

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-black text-slate-900">اختيار سريع لنوع الصلاحية</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {data.roles.map((role) => (
                      <button
                        key={`preset-${role.value}`}
                        type="button"
                        onClick={() => applyRolePreset(role.value)}
                        className={`rounded-xl border px-3 py-2 text-xs font-black shadow-sm ${form.role === role.value ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"}`}
                      >
                        {role.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs font-bold text-slate-500">اختار الدور أولًا، ثم اربطه بمدينة/مشرف/مندوب حسب نوع الصلاحية.</p>
                </div>

                <PermissionAssignmentPreview form={form} data={data} />

                <div className="grid gap-3 md:grid-cols-3">
                  <label className="text-xs font-black text-slate-800">
                    الاسم
                    <input value={form.name} onChange={(event) => setForm((old) => ({ ...old, name: event.target.value }))} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold" required />
                  </label>
                  <label className="text-xs font-black text-slate-800">
                    الإيميل
                    <input type="email" value={form.email} onChange={(event) => setForm((old) => ({ ...old, email: event.target.value }))} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold" required />
                  </label>
                  <label className="text-xs font-black text-slate-800">
                    كلمة المرور {modalMode === "edit" ? "(اختياري)" : "(اتركها فارغة لإنشاء مؤقتة)"}
                    <input type="password" autoComplete="new-password" value={form.password} onChange={(event) => setForm((old) => ({ ...old, password: event.target.value }))} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold" dir="ltr" />
                  </label>
                  <label className="text-xs font-black text-slate-800">
                    الصلاحية
                    <select value={form.role} onChange={(event) => applyRolePreset(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
                      {data.roles.map((role, index) => (
                        <option key={`${role.value}:${index}`} value={role.value}>{role.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-black text-slate-800">
                    الحالة
                    <select value={form.status} onChange={(event) => setForm((old) => ({ ...old, status: event.target.value }))} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
                      {data.statuses.map((status, index) => (
                        <option key={`${status.value}:${index}`} value={status.value}>{status.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-black text-slate-800">
                    المدينة الأساسية
                    <select value={form.cityId} onChange={(event) => updateCity(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
                      <option value="">بدون مدينة</option>
                      {data.cities.map((city) => (
                        <option key={city.id} value={city.id}>{city.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-black text-slate-800">
                    المشرف المرتبط
                    <select value={form.supervisorId} onChange={(event) => updateSupervisor(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
                      <option value="">بدون مشرف</option>
                      {data.supervisors.map((supervisor) => (
                        <option key={supervisor.id} value={supervisor.id}>{supervisor.name} - {supervisor.cityName}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-black text-slate-800">
                    حساب مندوب مرتبط
                    <select value={form.driverId} onChange={(event) => updateDriver(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
                      <option value="">بدون مندوب</option>
                      {data.drivers.map((driver) => (
                        <option key={driver.id} value={driver.id}>{driver.code} - {driver.name}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <MultiSelect label="نطاق المدن" values={form.cityScope} onChange={(cityScope) => setForm((old) => ({ ...old, cityScope }))} options={data.cities} />
                  <MultiSelect label="نطاق المشاريع (اتركه فارغًا لمشرف المدينة)" values={form.projectScope} onChange={(projectScope) => setForm((old) => ({ ...old, projectScope }))} options={data.projects} />
                </div>
                {form.role === "SUPERVISOR" ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-900">
                    <strong>{form.projectScope.length ? "الحساب مضبوط كمشرف مشروع." : "الحساب مضبوط كمشرف مدينة ويرى كل مشاريع المدينة."}</strong>
                    {form.projectScope.length ? (
                      <button type="button" onClick={() => setForm((old) => ({ ...old, projectScope: [] }))} className="rounded-lg border border-emerald-300 bg-white px-3 py-1 font-black">
                        تحويل إلى مشرف مدينة
                      </button>
                    ) : null}
                  </div>
                ) : null}

                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-bold text-blue-900">
                  نطاق المدينة والمشرف هنا هو الأساس الذي ستستخدمه صفحات المناديب والتقارير لاحقًا لتصفية البيانات حسب الصلاحية.
                </div>

                <div className="flex flex-wrap gap-2">
                  <button disabled={saving} type="submit" className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-black text-white shadow-sm disabled:opacity-50">
                    {saving ? "جاري الحفظ..." : "حفظ"}
                  </button>
                  <button type="button" onClick={closeModal} className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-black text-slate-800">
                    إلغاء
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      ) : null}

      <header className="mb-4 flex items-start justify-between border-b border-slate-200 pb-4">
        <button type="button" onClick={() => router.back()} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800 shadow-sm">
          رجوع
        </button>
        <div>
          <h1 className="text-3xl font-black text-slate-950">إدارة المستخدمين</h1>
          <p className="mt-1 text-sm font-bold text-slate-500">صفحة مرتبطة ببيانات النظام والصلاحيات الحالية.</p>
        </div>
      </header>

      <section className="mb-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <ActionButton onClick={printPage}>طباعة / بي دي إف</ActionButton>
            <ActionButton tone="amber" onClick={downloadCsv}>تصدير إكسل</ActionButton>
            <ActionButton tone="red" onClick={() => activeUser ? deactivateUser(activeUser) : setToast("افتح مستخدمًا من زر عرض ثم نفذ التعطيل.")}>حذف</ActionButton>
            <ActionButton onClick={() => activeUser ? openEdit(activeUser) : setToast("اختر مستخدمًا من الجدول أولًا.")}>تعديل</ActionButton>
            <ActionButton tone="blue" onClick={() => router.push("/imports?type=users")}>استيراد Excel / PDF</ActionButton>
            <ActionButton tone="green" onClick={openCreate}>+ إضافة</ActionButton>
          </div>
          <form className="grid min-w-[520px] flex-1 grid-cols-1 gap-3 md:grid-cols-4" action="/user-management">
            <label className="text-xs font-black text-slate-800">
              من تاريخ
              <input name="fromDate" type="date" defaultValue={data.filters.fromDate} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold" />
            </label>
            <label className="text-xs font-black text-slate-800">
              إلى تاريخ
              <input name="toDate" type="date" defaultValue={data.filters.toDate} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold" />
            </label>
            <label className="text-xs font-black text-slate-800">
              بحث
              <input name="q" defaultValue={data.filters.q} placeholder="اسم / بريد / مدينة / مشرف" className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold" />
            </label>
            <div className="flex items-end gap-2">
              <button type="submit" className="h-10 flex-1 rounded-xl bg-slate-900 px-4 text-sm font-black text-white shadow-sm">تطبيق</button>
              <button type="button" onClick={() => router.push("/user-management")} className="h-10 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-800">عرض الكل</button>
            </div>
          </form>
        </div>
      </section>

      <div className="mb-4 flex flex-wrap gap-2">
        <ActionButton tone="green" onClick={openCreate}>إضافة مستخدم</ActionButton>
        <ActionButton onClick={downloadCsv}>تصدير إكسل</ActionButton>
      </div>

      <section className="mb-4">
        <h2 className="text-2xl font-black text-slate-950">إدارة المستخدمين</h2>
        <p className="mt-1 text-sm font-bold text-slate-500">إنشاء وتعديل وإيقاف المستخدمين وإعادة ضبط كلمات المرور وتتبع الصلاحيات والنشاط.</p>
      </section>

      <section className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="المستخدمون" value={fmt(data.summary.users)} icon="👥" />
        <SummaryCard title="نشط" value={fmt(data.summary.active)} icon="🟢" />
        <SummaryCard title="موقوف" value={fmt(data.summary.inactive)} icon="⛔" />
        <SummaryCard title="سجل النشاط" value={fmt(data.summary.auditLogs)} icon="🧾" />
      </section>

      <section className="mb-4 grid gap-3 md:grid-cols-3">
        {data.scopeIssues.map((issue) => (
          <div key={issue.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <Badge label={issue.value ? "يحتاج متابعة" : "طبيعي"} tone={issue.tone === "emerald" ? "emerald" : issue.tone === "red" ? "red" : issue.tone === "amber" ? "amber" : "blue"} />
              <div>
                <p className="text-xs font-black text-slate-500">{issue.title}</p>
                <strong className="mt-1 block text-2xl font-black text-slate-950">{fmt(issue.value)}</strong>
              </div>
            </div>
            <p className="mt-2 text-xs font-bold text-slate-500">{issue.description}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 grid gap-3 md:grid-cols-5">
          <form className="contents" action="/user-management">
            <input type="hidden" name="fromDate" value={data.filters.fromDate} />
            <input type="hidden" name="toDate" value={data.filters.toDate} />
            <input type="hidden" name="q" value={data.filters.q} />
            <label className="text-xs font-black text-slate-800">
              الصلاحية
              <select name="role" defaultValue={data.filters.role} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
                <option value="">كل الصلاحيات</option>
                {data.roles.map((role, index) => (
                  <option key={`${role.value}:${index}`} value={role.value}>{role.label}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-black text-slate-800">
              الحالة
              <select name="status" defaultValue={data.filters.status} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
                <option value="">كل الحالات</option>
                {data.statuses.map((status, index) => (
                  <option key={`${status.value}:${index}`} value={status.value}>{status.label}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-black text-slate-800">
              المدينة
              <select name="cityId" defaultValue={data.filters.cityId} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
                <option value="">كل المدن</option>
                {data.cities.map((city) => (
                  <option key={city.id} value={city.id}>{city.name}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-black text-slate-800">
              المشرف
              <select name="supervisorId" defaultValue={data.filters.supervisorId} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold">
                <option value="">كل المشرفين</option>
                {data.supervisors.map((supervisor) => (
                  <option key={supervisor.id} value={supervisor.id}>{supervisor.name} - {supervisor.cityName}</option>
                ))}
              </select>
            </label>
            <button type="submit" className="mt-5 h-10 rounded-xl bg-slate-900 px-4 text-sm font-black text-white shadow-sm">تطبيق</button>
          </form>
        </div>

        {data.rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1380px] border-separate border-spacing-0 text-right text-sm">
              <thead>
                <tr className="bg-slate-100 text-xs font-black text-slate-600">
                  <th className="rounded-r-xl px-3 py-2">الاسم</th>
                  <th className="px-3 py-2">الإيميل</th>
                  <th className="px-3 py-2">الصلاحية</th>
                  <th className="px-3 py-2">نوع ونطاق المشرف</th>
                  <th className="px-3 py-2">نطاق المدينة</th>
                  <th className="px-3 py-2">المشرف</th>
                  <th className="px-3 py-2">مناديب النطاق</th>
                  <th className="px-3 py-2">الحالة</th>
                  <th className="px-3 py-2">آخر دخول</th>
                  <th className="px-3 py-2">الجهاز</th>
                  <th className="rounded-l-xl px-3 py-2">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="border-b border-slate-100 px-3 py-3 font-black text-slate-950">{row.name}</td>
                    <td className="border-b border-slate-100 px-3 py-3 font-bold text-slate-800">{row.email}</td>
                    <td className="border-b border-slate-100 px-3 py-3"><Badge label={row.roleLabel} tone="blue" /></td>
                    <td className="border-b border-slate-100 px-3 py-3 font-bold text-slate-700">{supervisorScopeLabel(row)}</td>
                    <td className="border-b border-slate-100 px-3 py-3 font-bold text-slate-700">{row.cityScope}</td>
                    <td className="border-b border-slate-100 px-3 py-3 font-bold text-slate-700">{row.supervisorName}</td>
                    <td className="border-b border-slate-100 px-3 py-3 font-black text-slate-950">{fmt(row.linkedDriversCount)}</td>
                    <td className="border-b border-slate-100 px-3 py-3"><Badge label={row.statusLabel} tone={row.statusTone} /></td>
                    <td className="border-b border-slate-100 px-3 py-3 font-bold text-slate-700">{row.lastLogin}</td>
                    <td className="border-b border-slate-100 px-3 py-3 font-bold text-slate-700">{row.device}</td>
                    <td className="border-b border-slate-100 px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => openDetails(row)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-800">عرض</button>
                        <button type="button" onClick={() => openEdit(row)} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white">تعديل</button>
                        <button type="button" disabled={saving} onClick={() => resetPassword(row)} className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-black text-white disabled:opacity-50">إعادة كلمة المرور</button>
                        <button type="button" disabled={saving} onClick={() => deactivateUser(row)} className="rounded-xl bg-red-600 px-3 py-2 text-xs font-black text-white disabled:opacity-50">تعطيل</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm font-bold text-slate-500">
            لا توجد مستخدمين مطابقين للفلاتر الحالية.
          </div>
        )}
      </section>
    </main>
  );
}
