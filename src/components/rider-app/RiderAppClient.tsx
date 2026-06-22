"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { RiderSection } from "@/lib/rider-app/riderData";

type RiderPayload = {
  dashboard: {
    driver: {
      name: string;
      driverCode?: string | null;
      internalCode?: string | null;
      phone?: string | null;
      city?: string | null;
      supervisor?: string | null;
      appAccountLabel?: string | null;
      applicationAccounts?: { id: string; appName: string; projectName?: string | null; appUserId?: string | null; appUsername?: string | null; status: string }[];
      [key: string]: unknown;
    };
    summary: Record<string, string | number | null>;
    recentNotifications?: RiderNotification[];
    latestViolation?: Record<string, unknown> | null;
    latestWarning?: Record<string, unknown> | null;
    payroll?: Record<string, unknown> | null;
    month: string;
  };
  section: RiderSection;
  notifications?: RiderNotification[];
  violations?: RiderViolation[];
  payrollPage?: { month: string; current: Record<string, unknown> | null; history: Record<string, unknown>[] };
  advances?: Record<string, unknown>[];
  attendance?: { month: string; summary: Record<string, unknown>; rows: Record<string, unknown>[] };
  vehicle?: Record<string, unknown> | null;
  documents?: Record<string, unknown>[];
  tasks?: Record<string, unknown>[];
  profile?: Record<string, unknown>;
};

type RiderNotification = {
  id: string;
  title: string;
  body?: string | null;
  severity: string;
  status: string;
  entityType?: string | null;
  entityId?: string | null;
  createdAt?: string | null;
};

type RiderViolation = {
  id: string;
  kind: "violation" | "warning";
  title: string;
  amount: number;
  status: string;
  date?: string | null;
  notes?: string | null;
  payrollImpact?: string | null;
};

const navItems: { href: string; section: RiderSection; label: string }[] = [
  { href: "/rider-app/dashboard", section: "dashboard", label: "الرئيسية" },
  { href: "/rider-app/notifications", section: "notifications", label: "الإشعارات" },
  { href: "/rider-app/payroll", section: "payroll", label: "الراتب" },
  { href: "/rider-app/violations", section: "violations", label: "المخالفات" },
  { href: "/rider-app/profile", section: "profile", label: "المزيد" },
];

const moreItems: { href: string; label: string; tone?: string }[] = [
  { href: "/rider-app/advances", label: "السلف" },
  { href: "/rider-app/attendance", label: "الحضور" },
  { href: "/rider-app/vehicle", label: "السيارة" },
  { href: "/rider-app/documents", label: "المستندات" },
  { href: "/rider-app/tasks", label: "المهام" },
  { href: "/rider-app/support", label: "الدعم" },
];

function money(value: unknown) {
  const number = Number(value || 0);
  return number ? `${number.toLocaleString("ar-SA", { maximumFractionDigits: 2 })} ر.س` : "-";
}

function valueText(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "number") return value.toLocaleString("ar-SA");
  if (typeof value === "boolean") return value ? "نعم" : "لا";
  return String(value);
}

function dateText(value: unknown) {
  if (!value) return "-";
  const date = new Date(String(value));
  if (!Number.isFinite(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function statusBadge(status?: string | null) {
  const value = String(status || "-");
  const tone = value === "PENDING" ? "bg-amber-50 text-amber-700 border-amber-200" : value === "APPROVED" || value === "ACTIVE" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-700 border-slate-200";
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${tone}`}>{value}</span>;
}

function Card({ title, value, hint, tone = "white" }: { title: string; value: React.ReactNode; hint?: string; tone?: "white" | "blue" | "green" | "red" | "amber" }) {
  const tones = {
    white: "bg-white border-slate-200",
    blue: "bg-blue-50 border-blue-200",
    green: "bg-emerald-50 border-emerald-200",
    red: "bg-red-50 border-red-200",
    amber: "bg-amber-50 border-amber-200",
  };
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${tones[tone]}`}>
      <p className="text-xs font-black text-slate-500">{title}</p>
      <div className="mt-2 text-2xl font-black text-slate-950">{value}</div>
      {hint ? <p className="mt-1 text-xs font-bold text-slate-500">{hint}</p> : null}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-black text-slate-500">{text}</div>;
}

function SectionShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3">
      <h2 className="text-lg font-black text-slate-950">{title}</h2>
      {children}
    </section>
  );
}

function beep() {
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;
  const audio = new AudioContextClass();
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = 880;
  gain.gain.value = 0.06;
  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.start();
  setTimeout(() => {
    oscillator.stop();
    audio.close().catch(() => null);
  }, 180);
}

export function RiderAppClient({ initialData, section }: { initialData: RiderPayload; section: RiderSection }) {
  const [data, setData] = useState<RiderPayload>(initialData);
  const [message, setMessage] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(false);
  const seenNotificationIds = useRef<Set<string>>(new Set((initialData.notifications || initialData.dashboard.recentNotifications || []).map((item) => item.id)));
  const unreadCount = Number(data.dashboard.summary.unreadNotifications || 0);

  useEffect(() => {
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch("/api/rider/notifications", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as { data?: RiderNotification[] };
        const rows = payload.data || [];
        const newUnread = rows.filter((item) => item.status === "PENDING" && !seenNotificationIds.current.has(item.id));
        rows.forEach((item) => seenNotificationIds.current.add(item.id));
        if (soundEnabled && newUnread.length) beep();
        setData((current) => ({
          ...current,
          dashboard: {
            ...current.dashboard,
            summary: { ...current.dashboard.summary, unreadNotifications: rows.filter((item) => item.status === "PENDING").length },
            recentNotifications: rows.slice(0, 5),
          },
          notifications: section === "notifications" ? rows : current.notifications,
        }));
      } catch {
        // polling should stay quiet on temporary network issues
      }
    }, 20000);
    return () => window.clearInterval(timer);
  }, [soundEnabled, section]);

  async function markRead(id: string) {
    const response = await fetch(`/api/rider/notifications/${id}/read`, { method: "PATCH" });
    if (response.ok) {
      setMessage("تم تعليم الإشعار كمقروء.");
      const notifications = (data.notifications || data.dashboard.recentNotifications || []).map((item) => (item.id === id ? { ...item, status: "APPROVED" } : item));
      setData((current) => ({
        ...current,
        notifications,
        dashboard: {
          ...current.dashboard,
          summary: { ...current.dashboard.summary, unreadNotifications: Math.max(0, Number(current.dashboard.summary.unreadNotifications || 0) - 1) },
          recentNotifications: (current.dashboard.recentNotifications || []).map((item) => (item.id === id ? { ...item, status: "APPROVED" } : item)),
        },
      }));
    }
  }

  async function markAllRead() {
    const response = await fetch("/api/rider/notifications/read-all", { method: "PATCH" });
    if (response.ok) {
      setMessage("تم تعليم كل الإشعارات كمقروءة.");
      setData((current) => ({
        ...current,
        notifications: (current.notifications || []).map((item) => ({ ...item, status: "APPROVED" })),
        dashboard: {
          ...current.dashboard,
          summary: { ...current.dashboard.summary, unreadNotifications: 0 },
          recentNotifications: (current.dashboard.recentNotifications || []).map((item) => ({ ...item, status: "APPROVED" })),
        },
      }));
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24" dir="rtl">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black text-blue-700">MOHAMED SHAWKI ERP</p>
            <h1 className="text-xl font-black text-slate-950">تطبيق المندوب</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSoundEnabled((value) => !value)}
              className={`rounded-xl border px-3 py-2 text-xs font-black ${soundEnabled ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600"}`}
            >
              {soundEnabled ? "الصوت مفعل" : "تفعيل الصوت"}
            </button>
            <a href="/logout" className="rounded-xl bg-red-600 px-3 py-2 text-xs font-black text-white">خروج</a>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-xl gap-4 px-4 py-4">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-bold text-slate-500">أهلا</p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">{data.dashboard.driver.name}</h2>
          <p className="mt-1 text-sm font-bold text-slate-500">
            {data.dashboard.driver.driverCode || data.dashboard.driver.internalCode || "-"} · {data.dashboard.driver.city || "-"} · {data.dashboard.driver.appAccountLabel || "-"}
          </p>
        </section>

        {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-black text-emerald-700">{message}</div> : null}

        <div className="grid grid-cols-2 gap-3">
          <Card title="إشعارات غير مقروءة" value={unreadCount} tone={unreadCount ? "amber" : "green"} />
          <Card title="مخالفات وتحذيرات" value={valueText(data.dashboard.summary.pendingViolations)} tone={Number(data.dashboard.summary.pendingViolations) ? "red" : "green"} />
          <Card title="حالة المسير" value={<span className="text-lg">{valueText(data.dashboard.summary.currentPayrollStatus)}</span>} />
          <Card title="السلف هذا الشهر" value={money(data.dashboard.summary.monthlyAdvances)} />
          <Card title="حضور اليوم" value={<span className="text-lg">{valueText(data.dashboard.summary.attendanceStatusToday)}</span>} />
          <Card title="السيارة" value={<span className="text-lg">{valueText(data.dashboard.summary.assignedVehicle)}</span>} />
        </div>

        <RenderSection data={data} section={section} markRead={markRead} markAllRead={markAllRead} setMessage={setMessage} />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white px-2 py-2 shadow-[0_-10px_30px_rgba(15,23,42,0.08)]">
        <div className="mx-auto grid max-w-xl grid-cols-5 gap-1">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className={`rounded-2xl px-2 py-2 text-center text-[11px] font-black ${section === item.section ? "bg-slate-950 text-white" : "text-slate-600"}`}>
              {item.label}
              {item.section === "notifications" && unreadCount ? <span className="mr-1 rounded-full bg-red-600 px-1.5 text-[10px] text-white">{unreadCount}</span> : null}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

function RenderSection({ data, section, markRead, markAllRead, setMessage }: { data: RiderPayload; section: RiderSection; markRead: (id: string) => void; markAllRead: () => void; setMessage: (value: string) => void }) {
  if (section === "dashboard") return <DashboardSection data={data} />;
  if (section === "notifications") return <NotificationsSection rows={data.notifications || []} markRead={markRead} markAllRead={markAllRead} />;
  if (section === "violations") return <ViolationsSection rows={data.violations || []} />;
  if (section === "payroll") return <PayrollSection data={data.payrollPage} />;
  if (section === "advances") return <AdvancesSection rows={data.advances || []} setMessage={setMessage} />;
  if (section === "attendance") return <AttendanceSection data={data.attendance} setMessage={setMessage} />;
  if (section === "vehicle") return <VehicleSection vehicle={data.vehicle} setMessage={setMessage} />;
  if (section === "documents") return <DocumentsSection rows={data.documents || []} setMessage={setMessage} />;
  if (section === "tasks") return <TasksSection rows={data.tasks || []} setMessage={setMessage} />;
  if (section === "support") return <SupportSection setMessage={setMessage} />;
  return <ProfileSection data={data.profile} dashboard={data.dashboard} />;
}

function DashboardSection({ data }: { data: RiderPayload }) {
  const recent = data.dashboard.recentNotifications || [];
  return (
    <div className="grid gap-4">
      <SectionShell title="إجراءات سريعة">
        <div className="grid grid-cols-2 gap-2">
          {moreItems.map((item) => <Link key={item.href} href={item.href} className="rounded-2xl border border-slate-200 bg-white p-4 text-center text-sm font-black text-slate-800 shadow-sm">{item.label}</Link>)}
        </div>
      </SectionShell>
      <SectionShell title="آخر الإشعارات">
        {recent.length ? <div className="grid gap-2">{recent.map((row) => <NotificationCard key={row.id} row={row} />)}</div> : <EmptyState text="لا توجد إشعارات حديثة." />}
      </SectionShell>
      <SectionShell title="ملخص الراتب الحالي">
        {data.dashboard.payroll ? <PayrollMini item={data.dashboard.payroll} /> : <EmptyState text="لم يتم توليد مسير هذا الشهر بعد." />}
      </SectionShell>
    </div>
  );
}

function NotificationCard({ row, onRead }: { row: RiderNotification; onRead?: (id: string) => void }) {
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${row.status === "PENDING" ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-slate-950">{row.title}</p>
          {row.body ? <p className="mt-1 text-xs font-bold text-slate-600">{row.body}</p> : null}
          <p className="mt-2 text-[11px] font-bold text-slate-400">{dateText(row.createdAt)}</p>
        </div>
        {statusBadge(row.status)}
      </div>
      {onRead && row.status === "PENDING" ? <button onClick={() => onRead(row.id)} className="mt-3 rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white">تمت القراءة</button> : null}
    </div>
  );
}

function NotificationsSection({ rows, markRead, markAllRead }: { rows: RiderNotification[]; markRead: (id: string) => void; markAllRead: () => void }) {
  return (
    <SectionShell title="الإشعارات والتنبيهات">
      <button onClick={markAllRead} className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white">تعليم الكل كمقروء</button>
      {rows.length ? <div className="grid gap-2">{rows.map((row) => <NotificationCard key={row.id} row={row} onRead={markRead} />)}</div> : <EmptyState text="لا توجد إشعارات حتى الآن." />}
    </SectionShell>
  );
}

function ViolationsSection({ rows }: { rows: RiderViolation[] }) {
  return (
    <SectionShell title="المخالفات والتحذيرات">
      {rows.length ? (
        <div className="grid gap-2">
          {rows.map((row) => (
            <div key={`${row.kind}-${row.id}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-950">{row.kind === "warning" ? "تحذير" : "مخالفة"} · {row.title}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">{dateText(row.date)}</p>
                  {row.notes ? <p className="mt-2 text-sm font-bold text-slate-700">{row.notes}</p> : null}
                  {row.payrollImpact ? <p className="mt-2 rounded-xl bg-red-50 p-2 text-xs font-black text-red-700">سيتم خصمها من مسير شهر {row.payrollImpact}</p> : null}
                </div>
                <div className="text-left">{row.amount ? <p className="text-lg font-black text-red-700">{money(row.amount)}</p> : statusBadge(row.status)}</div>
              </div>
            </div>
          ))}
        </div>
      ) : <EmptyState text="لا توجد مخالفات أو تحذيرات." />}
    </SectionShell>
  );
}

function PayrollMini({ item }: { item: Record<string, unknown> }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid grid-cols-2 gap-2">
        <Card title="الشهر" value={<span className="text-lg">{valueText(item.month)}</span>} />
        <Card title="الحالة" value={<span className="text-lg">{valueText(item.runStatus)}</span>} />
        <Card title="إجمالي الراتب" value={money(item.grossSalary)} tone="green" />
        <Card title="صافي الراتب" value={money(item.finalSalary)} tone="blue" />
      </div>
    </div>
  );
}

function PayrollSection({ data }: { data?: RiderPayload["payrollPage"] }) {
  const item = data?.current;
  return (
    <SectionShell title="مسير الراتب">
      {item ? (
        <div className="grid gap-3">
          <PayrollMini item={item} />
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-base font-black text-slate-950">تفاصيل الراتب</h3>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-bold">
              {[
                ["الراتب الأساسي", money(item.basicSalary)],
                ["الحوافز", money(Number(item.extraOrdersBonus || 0) + Number(item.performanceBonus || 0) + Number(item.levelBonus || 0))],
                ["بدل السكن", money(item.housingAllowance)],
                ["خصومات التطبيق", money(item.appDeductionsTotal)],
                ["السلف", money(item.advancesTotal)],
                ["المخالفات", money(item.violationsTotal)],
                ["خصم كفالة", money(item.kafalaDeduction)],
                ["خصم يوزر", money(item.userDeduction)],
                ["إجمالي الخصومات", money(item.totalDeductions)],
                ["مستحق الشركة من كيتا", money(item.companyRevenueFromKeeta)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="mt-1 text-sm font-black text-slate-950">{value}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-xs font-bold text-blue-800">
            مستحق الشركة من كيتا للعرض فقط وليس راتب مندوب. الراتب هنا مأخوذ من PayrollItem المعتمد في ERP.
          </div>
        </div>
      ) : <EmptyState text="لم يتم توليد مسير هذا الشهر بعد." />}
    </SectionShell>
  );
}

function AdvancesSection({ rows, setMessage }: { rows: Record<string, unknown>[]; setMessage: (value: string) => void }) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/rider/advances/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: form.get("amount"), reason: form.get("reason"), deductionMonth: form.get("deductionMonth") }),
    });
    setMessage(response.ok ? "تم إرسال طلب السلفة." : "تعذر إرسال طلب السلفة.");
    if (response.ok) event.currentTarget.reset();
  }
  return (
    <SectionShell title="السلف">
      <form onSubmit={submit} className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <input name="amount" type="number" min="1" placeholder="قيمة السلفة" className="h-12 rounded-xl border border-slate-200 px-3 text-sm font-bold" required />
        <input name="deductionMonth" type="month" className="h-12 rounded-xl border border-slate-200 px-3 text-sm font-bold" />
        <textarea name="reason" placeholder="سبب الطلب" className="min-h-24 rounded-xl border border-slate-200 p-3 text-sm font-bold" />
        <button className="h-12 rounded-xl bg-emerald-600 text-sm font-black text-white">طلب سلفة</button>
      </form>
      {rows.length ? <div className="grid gap-2">{rows.map((row) => <SimpleRecord key={String(row.id)} row={row} fields={["advanceDate", "amount", "deductionMonth", "remainingAmount", "status", "reason"]} />)}</div> : <EmptyState text="لا توجد سلف مسجلة." />}
    </SectionShell>
  );
}

function AttendanceSection({ data, setMessage }: { data?: RiderPayload["attendance"]; setMessage: (value: string) => void }) {
  async function capture(action: "check-in" | "check-out") {
    const response = await fetch(`/api/rider/attendance/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    setMessage(response.ok ? (action === "check-in" ? "تم تسجيل الحضور." : "تم تسجيل الانصراف.") : "تعذر تسجيل الحركة.");
  }
  return (
    <SectionShell title="الحضور والانصراف">
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => capture("check-in")} className="h-12 rounded-2xl bg-emerald-600 text-sm font-black text-white">تسجيل حضور</button>
        <button onClick={() => capture("check-out")} className="h-12 rounded-2xl bg-amber-500 text-sm font-black text-white">تسجيل انصراف</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Card title="أيام مسجلة" value={valueText(data?.summary.days)} />
        <Card title="ساعات العمل" value={valueText(data?.summary.hours)} />
      </div>
      {data?.rows?.length ? <div className="grid gap-2">{data.rows.map((row) => <SimpleRecord key={String(row.id)} row={row} fields={["workDate", "checkIn", "checkOut", "workingHours", "status"]} />)}</div> : <EmptyState text="لا توجد سجلات حضور لهذا الشهر." />}
    </SectionShell>
  );
}

function VehicleSection({ vehicle, setMessage }: { vehicle?: Record<string, unknown> | null; setMessage: (value: string) => void }) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/rider/vehicle/issues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: form.get("title"), description: form.get("description") }),
    });
    setMessage(response.ok ? "تم إرسال بلاغ السيارة." : "تعذر إرسال البلاغ.");
    if (response.ok) event.currentTarget.reset();
  }
  return (
    <SectionShell title="السيارة">
      {vehicle ? <SimpleRecord row={vehicle} fields={["plate", "vehicleCode", "brand", "model", "ownershipType", "rentalCompany", "dailyRent", "monthlyRent", "assignmentStartDate", "status"]} /> : <EmptyState text="لا توجد سيارة مرتبطة بك حاليا." />}
      <form onSubmit={submit} className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <input name="title" placeholder="عنوان البلاغ" className="h-12 rounded-xl border border-slate-200 px-3 text-sm font-bold" required />
        <textarea name="description" placeholder="تفاصيل البلاغ" className="min-h-24 rounded-xl border border-slate-200 p-3 text-sm font-bold" required />
        <button className="h-12 rounded-xl bg-slate-950 text-sm font-black text-white">إرسال بلاغ</button>
      </form>
    </SectionShell>
  );
}

function DocumentsSection({ rows, setMessage }: { rows: Record<string, unknown>[]; setMessage: (value: string) => void }) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/rider/documents/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentType: form.get("documentType"), documentNumber: form.get("documentNumber"), fileUrl: form.get("fileUrl"), notes: form.get("notes") }),
    });
    setMessage(response.ok ? "تم إرسال المستند للمراجعة." : "تعذر إرسال المستند.");
    if (response.ok) event.currentTarget.reset();
  }
  return (
    <SectionShell title="المستندات">
      <form onSubmit={submit} className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <input name="documentType" placeholder="نوع المستند" className="h-12 rounded-xl border border-slate-200 px-3 text-sm font-bold" required />
        <input name="documentNumber" placeholder="رقم المستند" className="h-12 rounded-xl border border-slate-200 px-3 text-sm font-bold" />
        <input name="fileUrl" placeholder="رابط الملف إن وجد" className="h-12 rounded-xl border border-slate-200 px-3 text-sm font-bold" />
        <textarea name="notes" placeholder="ملاحظات" className="min-h-20 rounded-xl border border-slate-200 p-3 text-sm font-bold" />
        <button className="h-12 rounded-xl bg-emerald-600 text-sm font-black text-white">رفع للمراجعة</button>
      </form>
      {rows.length ? <div className="grid gap-2">{rows.map((row) => <SimpleRecord key={String(row.id)} row={row} fields={["type", "documentNumber", "expiryDate", "status", "verificationStatus"]} />)}</div> : <EmptyState text="لا توجد مستندات مسجلة." />}
    </SectionShell>
  );
}

function TasksSection({ rows, setMessage }: { rows: Record<string, unknown>[]; setMessage: (value: string) => void }) {
  async function updateTask(id: string, status: string) {
    const response = await fetch(`/api/rider/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    setMessage(response.ok ? "تم تحديث المهمة." : "تعذر تحديث المهمة.");
  }
  return (
    <SectionShell title="المهام">
      {rows.length ? <div className="grid gap-2">{rows.map((row) => (
        <div key={String(row.id)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="font-black text-slate-950">{valueText(row.title)}</p>
          <p className="mt-1 text-sm font-bold text-slate-600">{valueText(row.description)}</p>
          <div className="mt-2 flex items-center justify-between">{statusBadge(String(row.status))}<span className="text-xs font-bold text-slate-400">{dateText(row.dueDate)}</span></div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={() => updateTask(String(row.id), "ACTIVE")} className="rounded-xl border border-blue-200 bg-blue-50 py-2 text-xs font-black text-blue-700">بدأت التنفيذ</button>
            <button onClick={() => updateTask(String(row.id), "APPROVED")} className="rounded-xl border border-emerald-200 bg-emerald-50 py-2 text-xs font-black text-emerald-700">تمت المهمة</button>
          </div>
        </div>
      ))}</div> : <EmptyState text="لا توجد مهام مخصصة لك." />}
    </SectionShell>
  );
}

function SupportSection({ setMessage }: { setMessage: (value: string) => void }) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/rider/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: form.get("type"), title: form.get("title"), description: form.get("description"), relatedMonth: form.get("relatedMonth") }),
    });
    setMessage(response.ok ? "تم تسجيل طلب الدعم." : "تعذر تسجيل الطلب.");
    if (response.ok) event.currentTarget.reset();
  }
  return (
    <SectionShell title="الدعم والشكاوى">
      <form onSubmit={submit} className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <select name="type" className="h-12 rounded-xl border border-slate-200 px-3 text-sm font-bold">
          <option value="salary">مشكلة راتب</option>
          <option value="violation">اعتراض مخالفة</option>
          <option value="vehicle">مشكلة سيارة</option>
          <option value="attendance">مشكلة حضور</option>
          <option value="document">مشكلة مستند</option>
          <option value="general">شكوى عامة</option>
        </select>
        <input name="relatedMonth" type="month" className="h-12 rounded-xl border border-slate-200 px-3 text-sm font-bold" />
        <input name="title" placeholder="عنوان الطلب" className="h-12 rounded-xl border border-slate-200 px-3 text-sm font-bold" required />
        <textarea name="description" placeholder="اكتب التفاصيل" className="min-h-28 rounded-xl border border-slate-200 p-3 text-sm font-bold" required />
        <button className="h-12 rounded-xl bg-slate-950 text-sm font-black text-white">إرسال الطلب</button>
      </form>
    </SectionShell>
  );
}

function ProfileSection({ data, dashboard }: { data?: Record<string, unknown>; dashboard: RiderPayload["dashboard"] }) {
  const profile = (data?.driver as Record<string, unknown> | undefined) || dashboard.driver;
  const accounts = (profile.applicationAccounts as Record<string, unknown>[] | undefined) || [];
  return (
    <SectionShell title="الملف الشخصي">
      <SimpleRecord row={profile} fields={["name", "driverCode", "internalCode", "phone", "nationalId", "city", "supervisor", "contractType", "sponsorshipType", "accommodationType", "housingStatus", "status", "joinDate"]} />
      <h3 className="text-base font-black text-slate-950">حسابات التطبيقات</h3>
      {accounts.length ? <div className="grid gap-2">{accounts.map((row) => <SimpleRecord key={String(row.id)} row={row} fields={["appName", "projectName", "city", "appUserId", "appUsername", "status"]} />)}</div> : <EmptyState text="لا توجد حسابات تطبيق مرتبطة." />}
    </SectionShell>
  );
}

function SimpleRecord({ row, fields }: { row: Record<string, unknown>; fields: string[] }) {
  const labels: Record<string, string> = {
    advanceDate: "تاريخ السلفة",
    amount: "القيمة",
    deductionMonth: "شهر الخصم",
    remainingAmount: "المتبقي",
    status: "الحالة",
    reason: "ملاحظات",
    workDate: "التاريخ",
    checkIn: "حضور",
    checkOut: "انصراف",
    workingHours: "الساعات",
    plate: "اللوحة",
    vehicleCode: "كود السيارة",
    brand: "الماركة",
    model: "الموديل",
    ownershipType: "نوع الملكية",
    rentalCompany: "شركة التأجير",
    dailyRent: "الإيجار اليومي",
    monthlyRent: "الإيجار الشهري",
    assignmentStartDate: "تاريخ التسليم",
    type: "النوع",
    documentNumber: "رقم المستند",
    expiryDate: "تاريخ الانتهاء",
    verificationStatus: "حالة التحقق",
    name: "الاسم",
    driverCode: "كود المندوب",
    internalCode: "الكود الداخلي",
    phone: "الجوال",
    nationalId: "الهوية",
    city: "المدينة",
    supervisor: "المشرف",
    contractType: "نوع العقد",
    sponsorshipType: "الكفالة",
    accommodationType: "السكن",
    housingStatus: "حالة السكن",
    joinDate: "تاريخ الدوام",
    appName: "التطبيق",
    projectName: "المشروع",
    appUserId: "App User ID",
    appUsername: "App Username",
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid grid-cols-2 gap-2">
        {fields.map((field) => (
          <div key={field} className="rounded-xl bg-slate-50 p-3">
            <p className="text-[11px] font-black text-slate-500">{labels[field] || field}</p>
            <p className="mt-1 break-words text-sm font-black text-slate-950">{field.toLowerCase().includes("date") || field.includes("check") ? dateText(row[field]) : field.toLowerCase().includes("amount") || field.toLowerCase().includes("rent") ? money(row[field]) : valueText(row[field])}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
