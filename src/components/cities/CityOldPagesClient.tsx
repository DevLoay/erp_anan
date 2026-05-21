"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";
import type { CityOldPageData } from "@/lib/cities/getCityOldPagesData";

type Props = {
  data: CityOldPageData;
  mode: "cities" | "targets" | "ranking";
};

type CityDetail = CityOldPageData["cityDetails"][number];
type CityDetailTab = "overview" | "drivers" | "targets" | "ranking" | "alerts";

function fmt(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function pct(value: number) {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value)}%`;
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-5 left-5 z-[90] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 shadow-2xl">
      {message}
      <button type="button" onClick={onClose} className="mr-3 rounded-lg bg-slate-100 px-2 py-1 text-xs font-black">
        إغلاق
      </button>
    </div>
  );
}

function SummaryCard({ label, value, tone = "slate" }: { label: string; value: string | number; tone?: "slate" | "amber" | "red" | "blue" }) {
  const color = {
    slate: "text-slate-950",
    amber: "text-amber-700",
    red: "text-red-700",
    blue: "text-blue-700",
  }[tone];
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-black text-slate-500">{label}</p>
      <strong className={`mt-1 block text-2xl font-black ${color}`}>{value}</strong>
    </div>
  );
}

function StatusBadge({ value }: { value: string }) {
  const red = value.includes("Not") || value.includes("Critical") || value.includes("Weak");
  const amber = value.includes("Risk") || value.includes("Pending");
  const green = value.includes("Achieved") || value.includes("Good") || value.includes("Excellent") || value.includes("Active");
  const klass = red
    ? "bg-red-100 text-red-800"
    : amber
      ? "bg-amber-100 text-amber-800"
      : green
        ? "bg-emerald-100 text-emerald-800"
        : "bg-slate-100 text-slate-700";
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${klass}`}>{value}</span>;
}

function ReasonBadges({ reasons }: { reasons: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {reasons.map((reason) => {
        const normal = reason === "طبيعي";
        const low = reason.toLowerCase().includes("low") || reason.includes("أقل") || reason.includes("hours");
        const klass = normal ? "bg-emerald-100 text-emerald-800" : low ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800";
        return (
          <span key={reason} className={`rounded-full px-2 py-1 text-xs font-black ${klass}`}>
            {reason}
          </span>
        );
      })}
    </div>
  );
}

function Tabs({ mode }: { mode: Props["mode"] }) {
  const tabs = [
    { href: "/cities", label: "المدن", key: "cities" },
    { href: "/city-targets", label: "تارجت المدن", key: "targets" },
    { href: "/city-ranking", label: "ترتيب المدن", key: "ranking" },
  ] as const;
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={`rounded-xl border px-4 py-2 text-sm font-black shadow-sm ${
            mode === tab.key ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}

function Filters({ data }: { data: CityOldPageData }) {
  return (
    <form method="get" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-8">
        <label htmlFor="city-month" className="grid gap-1 text-xs font-black text-slate-800">
          الشهر
          <select id="city-month" name="month" defaultValue={data.filters.month} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold">
            {data.options.months.map((month) => (
              <option key={month} value={month}>
                {month === data.filters.month ? data.filters.monthLabel : month}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="city-from" className="grid gap-1 text-xs font-black text-slate-800">
          من
          <input id="city-from" name="fromDate" defaultValue={data.filters.fromDate} type="date" className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold" />
        </label>
        <label htmlFor="city-to" className="grid gap-1 text-xs font-black text-slate-800">
          إلى
          <input id="city-to" name="toDate" defaultValue={data.filters.toDate} type="date" className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold" />
        </label>
        <label htmlFor="city-filter" className="grid gap-1 text-xs font-black text-slate-800">
          المدينة
          <select id="city-filter" name="cityId" defaultValue={data.filters.cityId} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold">
            <option value="">كل المدن</option>
            {data.options.cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="app-filter" className="grid gap-1 text-xs font-black text-slate-800">
          التطبيق
          <select id="app-filter" name="appName" defaultValue={data.filters.appName} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold">
            <option value="">كل التطبيقات</option>
            {data.options.appNames.map((appName) => (
              <option key={appName} value={appName}>
                {appName}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="supervisor-filter" className="grid gap-1 text-xs font-black text-slate-800">
          المشرف
          <select id="supervisor-filter" name="supervisorId" defaultValue={data.filters.supervisorId} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold">
            <option value="">كل المشرفين</option>
            {data.options.supervisors.map((supervisor) => (
              <option key={supervisor.id} value={supervisor.id}>
                {supervisor.name}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="city-search" className="grid gap-1 text-xs font-black text-slate-800">
          بحث مندوب / ID / حساب / جوال
          <input id="city-search" name="q" defaultValue={data.filters.q} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold" />
        </label>
        <div className="grid grid-cols-2 gap-2 self-end">
          <button type="submit" className="h-11 rounded-xl bg-slate-900 px-4 text-sm font-black text-white">
            تطبيق
          </button>
          <Link href="?" className="grid h-11 place-items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-800">
            عرض الكل
          </Link>
        </div>
      </div>
    </form>
  );
}

function Header({ mode }: { mode: Props["mode"] }) {
  const copy = {
    cities: {
      title: "المدن",
      subtitle: "أداء المدن بدون أي إحصاءات جنسيات داخل المدينة أو المشروع.",
      body: "بيانات المدن من المناديب والتقارير والتنبيهات المحفوظة، بدون جنسيات وبدون أرقام عشوائية.",
    },
    targets: {
      title: "تارجت المدن",
      subtitle: "هدف كل مدينة وتطبيق وتفسير أسباب المناديب غير المؤهلين.",
      body: "الأهداف محسوبة لكل مدينة/تطبيق/شهر من قواعد KPI والإعدادات المحفوظة، بدون إعادة حساب حساب ثقيلة داخل كل خلية.",
    },
    ranking: {
      title: "ترتيب المدن",
      subtitle: "ترتيب المدن حسب التطبيق والشهر والإنجاز والتنبيهات.",
      body: "تم تجميع الحسابات، التقارير، التنبيهات، والأهداف مرة واحدة ثم فرز ترتيب المدن مباشرة.",
    },
  }[mode];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-3xl font-black text-slate-950">{copy.title}</h1>
          <p className="mt-1 text-sm font-bold text-slate-500">{copy.subtitle}</p>
        </div>
        <button type="button" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800">
          ☰
        </button>
      </div>
      <Tabs mode={mode} />
      <div>
        <h2 className="text-xl font-black text-slate-950">{copy.title}</h2>
        <p className="text-sm font-bold text-slate-500">{copy.body}</p>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-bold text-slate-500">
      {text}
    </div>
  );
}

function SmallAction({ children, onClick, tone = "white" }: { children: ReactNode; onClick: () => void; tone?: "white" | "blue" | "green" }) {
  const klass =
    tone === "blue"
      ? "border-blue-600 bg-blue-600 text-white"
      : tone === "green"
        ? "border-emerald-600 bg-emerald-600 text-white"
        : "border-slate-200 bg-white text-slate-900";
  return (
    <button type="button" onClick={onClick} className={`rounded-lg border px-3 py-1.5 text-xs font-black shadow-sm ${klass}`}>
      {children}
    </button>
  );
}

function MetricMini({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-xs font-black text-slate-500">{label}</p>
      <strong className="mt-1 block text-xl font-black text-slate-950">{value}</strong>
    </div>
  );
}

function CityDetailsModal({
  detail,
  tab,
  onTabChange,
  onClose,
  onAction,
}: {
  detail: CityDetail;
  tab: CityDetailTab;
  onTabChange: (tab: CityDetailTab) => void;
  onClose: () => void;
  onAction: (message: string) => void;
}) {
  const tabs: { key: CityDetailTab; label: string }[] = [
    { key: "overview", label: "نظرة عامة" },
    { key: "drivers", label: "غير المؤهلين" },
    { key: "targets", label: "التارجت" },
    { key: "ranking", label: "الترتيب" },
    { key: "alerts", label: "التنبيهات" },
  ];

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[88vh] w-full max-w-6xl overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white p-5">
          <div>
            <h3 className="text-2xl font-black text-slate-950">{detail.cityName}</h3>
            <p className="mt-1 text-sm font-bold text-slate-500">تفاصيل المدينة بنفس ترتيب النسخة القديمة: أداء، مناديب، تارجت، ترتيب، وتنبيهات.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black">
            إغلاق
          </button>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-slate-200 bg-white px-5 py-3">
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onTabChange(item.key)}
              className={`rounded-xl border px-4 py-2 text-sm font-black ${
                tab === item.key ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-800"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="max-h-[66vh] overflow-auto p-5">
          {tab === "overview" ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                <MetricMini label="إجمالي المناديب" value={fmt(detail.overview.totalDrivers)} />
                <MetricMini label="نشط" value={fmt(detail.overview.activeDrivers)} />
                <MetricMini label="غير نشط" value={fmt(detail.overview.inactiveDrivers)} />
                <MetricMini label="الطلبات" value={fmt(detail.overview.orders)} />
                <MetricMini label="الأداء" value={pct(detail.overview.performance)} />
                <MetricMini label="التنبيهات" value={fmt(detail.overview.alerts)} />
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <h4 className="mb-3 text-lg font-black">مشاريع / تطبيقات المدينة</h4>
                  {detail.projects.length ? (
                    <table className="w-full text-right text-sm">
                      <thead className="bg-slate-100 text-xs font-black text-slate-600">
                        <tr><th className="px-3 py-2">المشروع</th><th className="px-3 py-2">التطبيق</th><th className="px-3 py-2">مناديب</th><th className="px-3 py-2">طلبات</th><th className="px-3 py-2">غير مؤهل</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {detail.projects.map((project) => (
                          <tr key={`${project.name}:${project.appName}`}><td className="px-3 py-2 font-bold">{project.name}</td><td className="px-3 py-2">{project.appName}</td><td className="px-3 py-2">{fmt(project.drivers)}</td><td className="px-3 py-2">{fmt(project.orders)}</td><td className="px-3 py-2">{fmt(project.invalidDrivers)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  ) : <EmptyState text="لا توجد مشاريع مرتبطة ببيانات هذه المدينة حالياً." />}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <h4 className="mb-3 text-lg font-black">مشرفين المدينة</h4>
                  {detail.supervisors.length ? (
                    <table className="w-full text-right text-sm">
                      <thead className="bg-slate-100 text-xs font-black text-slate-600">
                        <tr><th className="px-3 py-2">المشرف</th><th className="px-3 py-2">مناديب</th><th className="px-3 py-2">طلبات</th><th className="px-3 py-2">مشاكل</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {detail.supervisors.map((supervisor) => (
                          <tr key={supervisor.name}><td className="px-3 py-2 font-bold">{supervisor.name}</td><td className="px-3 py-2">{fmt(supervisor.drivers)}</td><td className="px-3 py-2">{fmt(supervisor.orders)}</td><td className="px-3 py-2">{fmt(supervisor.invalidDrivers)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  ) : <EmptyState text="لا توجد بيانات مشرفين كافية لهذه المدينة." />}
                </div>
              </div>
            </div>
          ) : null}

          {tab === "drivers" ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              {detail.invalidDrivers.length ? (
                <div className="overflow-x-auto">
                  <table className="min-w-[1100px] w-full text-right text-sm">
                    <thead className="bg-slate-100 text-xs font-black text-slate-600">
                      <tr><th className="px-3 py-2">المندوب</th><th className="px-3 py-2">الكود</th><th className="px-3 py-2">التطبيق</th><th className="px-3 py-2">المشرف</th><th className="px-3 py-2">طلبات</th><th className="px-3 py-2">ساعات</th><th className="px-3 py-2">On-Time</th><th className="px-3 py-2">إلغاء</th><th className="px-3 py-2">رفض</th><th className="px-3 py-2">الأسباب</th><th className="px-3 py-2">إجراء</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {detail.invalidDrivers.map((driver) => (
                        <tr key={`${driver.driverId}:${driver.appName}`}>
                          <td className="px-3 py-2 font-black">{driver.driverName}<div className="text-xs text-slate-500">{driver.phone}</div></td>
                          <td className="px-3 py-2">{driver.driverCode}</td>
                          <td className="px-3 py-2">{driver.appName}</td>
                          <td className="px-3 py-2">{driver.supervisorName}</td>
                          <td className="px-3 py-2">{fmt(driver.orders)}</td>
                          <td className="px-3 py-2">{fmt(driver.workingHours)}</td>
                          <td className="px-3 py-2">{pct(driver.onTimeRate)}</td>
                          <td className="px-3 py-2">{pct(driver.cancellationRate)}</td>
                          <td className="px-3 py-2">{pct(driver.rejectionRate)}</td>
                          <td className="px-3 py-2"><ReasonBadges reasons={driver.reasons} /></td>
                          <td className="px-3 py-2"><SmallAction onClick={() => onAction("فتح تقرير المندوب قيد التطوير")}>تقرير</SmallAction></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <EmptyState text="لا توجد مناديب غير مؤهلين داخل هذه المدينة حسب الفلاتر الحالية." />}
            </div>
          ) : null}

          {tab === "targets" ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              {detail.targets.length ? (
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-100 text-xs font-black text-slate-600">
                    <tr><th className="px-3 py-2">التطبيق</th><th className="px-3 py-2">الشهر</th><th className="px-3 py-2">الهدف</th><th className="px-3 py-2">الفعلية</th><th className="px-3 py-2">الإنجاز</th><th className="px-3 py-2">الحالة</th><th className="px-3 py-2">الأسباب</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detail.targets.map((target) => (
                      <tr key={`${target.appName}:${target.month}`}><td className="px-3 py-2">{target.appName}</td><td className="px-3 py-2">{target.month}</td><td className="px-3 py-2">{fmt(target.monthlyTarget)}</td><td className="px-3 py-2">{fmt(target.actualOrders)}</td><td className="px-3 py-2">{pct(target.achievement)}</td><td className="px-3 py-2"><StatusBadge value={target.status} /></td><td className="px-3 py-2"><ReasonBadges reasons={target.reasons} /></td></tr>
                    ))}
                  </tbody>
                </table>
              ) : <EmptyState text="لا توجد تارجتات محفوظة لهذه المدينة في الشهر الحالي." />}
            </div>
          ) : null}

          {tab === "ranking" ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              {detail.ranking.length ? (
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-100 text-xs font-black text-slate-600">
                    <tr><th className="px-3 py-2">الترتيب</th><th className="px-3 py-2">التطبيق</th><th className="px-3 py-2">طلبات</th><th className="px-3 py-2">هدف</th><th className="px-3 py-2">إنجاز</th><th className="px-3 py-2">On-Time</th><th className="px-3 py-2">تنبيهات</th><th className="px-3 py-2">تقييم</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detail.ranking.map((row) => (
                      <tr key={`${row.rank}:${row.appName}`}><td className="px-3 py-2 font-black">#{row.rank}</td><td className="px-3 py-2">{row.appName}</td><td className="px-3 py-2">{fmt(row.orders)}</td><td className="px-3 py-2">{fmt(row.monthlyTarget)}</td><td className="px-3 py-2">{pct(row.achievement)}</td><td className="px-3 py-2">{pct(row.onTimeRate)}</td><td className="px-3 py-2">{fmt(row.alerts)}</td><td className="px-3 py-2"><StatusBadge value={row.evaluation} /></td></tr>
                    ))}
                  </tbody>
                </table>
              ) : <EmptyState text="لا توجد بيانات ترتيب لهذه المدينة حسب الفلاتر الحالية." />}
            </div>
          ) : null}

          {tab === "alerts" ? (
            <div className="space-y-2">
              {detail.alerts.length ? detail.alerts.map((alert, index) => (
                <div key={`${alert.title}:${index}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <div>
                    <p className="font-black text-slate-950">{alert.title}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">{alert.action}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${alert.severity === "critical" ? "bg-red-100 text-red-800" : alert.severity === "warning" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"}`}>{alert.value}</span>
                    <SmallAction onClick={() => onAction("إنشاء مهمة للمشرف قيد التطوير")} tone="blue">مهمة</SmallAction>
                  </div>
                </div>
              )) : <EmptyState text="لا توجد تنبيهات لهذه المدينة حسب البيانات الحالية." />}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function CityOldPagesClient({ data, mode }: Props) {
  const [toast, setToast] = useState("");
  const [activeDetail, setActiveDetail] = useState<CityDetail | null>(null);
  const [detailTab, setDetailTab] = useState<CityDetailTab>("overview");
  const message = (text: string) => setToast(text);

  const fallbackDetail = (cityId: string): CityDetail | null => {
    const overview = data.citiesRows.find((row) => row.cityId === cityId);
    if (!overview) return null;
    const targets = data.targetRows.filter((row) => row.cityId === cityId);
    const ranking = data.rankingRows.filter((row) => row.cityId === cityId);
    return {
      cityId,
      cityName: overview.cityName,
      status: overview.status,
      applications: overview.applications,
      overview,
      drivers: [],
      invalidDrivers: [],
      targets,
      ranking,
      supervisors: [],
      projects: overview.applications.map((appName) => ({ name: appName, appName, drivers: 0, orders: 0, invalidDrivers: 0 })),
      alerts: [
        ...targets.filter((target) => target.statusCode !== "ACHIEVED").map((target) => ({
          title: `${target.cityName} - ${target.appName} أقل من التارجت`,
          severity: target.achievement < 80 ? "critical" as const : "warning" as const,
          value: pct(target.achievement),
          action: "مراجعة تارجت المدينة",
        })),
        ...ranking.filter((row) => row.alerts > 0).map((row) => ({
          title: `${row.cityName} - ${row.appName} لديها تنبيهات أداء`,
          severity: row.evaluation === "Critical" || row.evaluation === "Weak" ? "critical" as const : "warning" as const,
          value: fmt(row.alerts),
          action: "مراجعة ترتيب المدينة",
        })),
      ],
    };
  };

  const openCityDetail = (cityId: string, tab: CityDetailTab = "overview") => {
    const detail = data.cityDetails.find((item) => item.cityId === cityId) ?? fallbackDetail(cityId);
    if (!detail) {
      message("لا توجد تفاصيل محفوظة لهذه المدينة حالياً.");
      return;
    }
    setActiveDetail(detail);
    setDetailTab(tab);
  };

  if (data.databaseStatus === "offline") {
    return (
      <section className="w-full max-w-none space-y-4" dir="rtl">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900">
          <h1 className="text-2xl font-black">قاعدة البيانات غير متصلة</h1>
          <p className="mt-2 text-sm font-bold">{data.databaseMessage}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full max-w-none space-y-4" dir="rtl">
      {toast ? <Toast message={toast} onClose={() => setToast("")} /> : null}
      {activeDetail ? (
        <CityDetailsModal
          detail={activeDetail}
          tab={detailTab}
          onTabChange={setDetailTab}
          onClose={() => setActiveDetail(null)}
          onAction={message}
        />
      ) : null}
      <Header mode={mode} />

      {mode === "cities" ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="المدن" value={fmt(data.summary.cities.totalCities)} />
          <SummaryCard label="إجمالي المناديب" value={fmt(data.summary.cities.totalDrivers)} />
          <SummaryCard label="الطلبات" value={fmt(data.summary.cities.totalOrders)} />
          <SummaryCard label="تنبيهات" value={fmt(data.summary.cities.alerts)} tone="amber" />
        </div>
      ) : null}

      {mode === "targets" ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="صفوف التارجت" value={fmt(data.summary.targets.targetRows)} />
          <SummaryCard label="إجمالي المستهدف" value={fmt(data.summary.targets.totalTarget)} />
          <SummaryCard label="الطلبات الفعلية" value={fmt(data.summary.targets.actualOrders)} />
          <SummaryCard label="مدن معرضة للخطر" value={fmt(data.summary.targets.riskCities)} tone="amber" />
        </div>
      ) : null}

      {mode === "ranking" ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="صفوف الترتيب" value={fmt(data.summary.ranking.rankingRows)} />
          <SummaryCard label="إجمالي الطلبات" value={fmt(data.summary.ranking.totalOrders)} />
          <SummaryCard label="متوسط الإنجاز" value={pct(data.summary.ranking.avgAchievement)} />
          <SummaryCard label="تنبيهات" value={fmt(data.summary.ranking.alerts)} tone="amber" />
        </div>
      ) : null}

      <Filters data={data} />

      {mode === "cities" ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {data.citiesRows.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-[1280px] w-full text-right text-sm">
                <thead className="bg-slate-100 text-xs font-black text-slate-600">
                  <tr>
                    {["المدينة", "إجمالي المناديب", "نشط", "غير نشط", "مؤهل", "غير مؤهل", "المشرفين", "التطبيقات", "الطلبات", "الأداء", "تنبيهات", "آخر تحديث", "تفاصيل"].map((head) => (
                      <th key={head} className="px-4 py-3">{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.citiesRows.map((row) => (
                    <tr key={row.cityId} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-black text-slate-950">{row.cityName}<div className="text-xs font-bold text-slate-500">{row.status}</div></td>
                      <td className="px-4 py-3">{fmt(row.totalDrivers)}</td>
                      <td className="px-4 py-3">{fmt(row.activeDrivers)}</td>
                      <td className="px-4 py-3">{fmt(row.inactiveDrivers)}</td>
                      <td className="px-4 py-3">{fmt(row.validDrivers)}</td>
                      <td className="px-4 py-3">{fmt(row.invalidDrivers)}</td>
                      <td className="px-4 py-3">{fmt(row.supervisors)}</td>
                      <td className="px-4 py-3">{row.applications.length ? row.applications.join("; ") : "-"}</td>
                      <td className="px-4 py-3">{fmt(row.orders)}</td>
                      <td className="px-4 py-3"><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">{pct(row.performance)}</span></td>
                      <td className="px-4 py-3">{fmt(row.alerts)}</td>
                      <td className="px-4 py-3">{row.updatedAt}</td>
                      <td className="px-4 py-3"><button type="button" onClick={() => openCityDetail(row.cityId, "overview")} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-black">فتح</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState text="لا توجد مدن مطابقة للفلاتر الحالية." />
          )}
        </div>
      ) : null}

      {mode === "targets" ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="overflow-x-auto">
              <table className="min-w-[1320px] w-full text-right text-sm">
                <thead className="bg-slate-100 text-xs font-black text-slate-600">
                  <tr>
                    {["المدينة", "التطبيق", "الشهر", "الهدف الشهري", "الطلبات الفعلية", "الإنجاز", "مناديب مسجلين", "مناديب مؤهلين", "غير مؤهلين", "مشرفين", "أسباب عدم التأهيل", "الحالة", "إجراءات"].map((head) => (
                      <th key={head} className="px-4 py-3">{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.targetRows.length ? data.targetRows.map((row) => (
                    <tr key={`${row.cityId}:${row.appName}:${row.month}`} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-black">{row.cityName}</td>
                      <td className="px-4 py-3">{row.appName}</td>
                      <td className="px-4 py-3">{row.month}</td>
                      <td className="px-4 py-3">{fmt(row.monthlyTarget)}</td>
                      <td className="px-4 py-3">{fmt(row.actualOrders)}</td>
                      <td className="px-4 py-3"><span className="rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-800">{pct(row.achievement)}</span></td>
                      <td className="px-4 py-3">{fmt(row.registeredDrivers)}</td>
                      <td className="px-4 py-3">{fmt(row.validDrivers)}</td>
                      <td className="px-4 py-3">{fmt(row.invalidDrivers)}</td>
                      <td className="px-4 py-3">{fmt(row.supervisors)}</td>
                      <td className="px-4 py-3"><ReasonBadges reasons={row.reasons} /></td>
                      <td className="px-4 py-3"><StatusBadge value={row.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button type="button" onClick={() => openCityDetail(row.cityId, "targets")} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-black">تقرير المدينة</button>
                          <button type="button" onClick={() => openCityDetail(row.cityId, "drivers")} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-black">غير المؤهلين</button>
                          <button type="button" onClick={() => openCityDetail(row.cityId, "alerts")} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-black">مهمة</button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={13} className="px-4 py-10 text-center text-sm font-bold text-slate-500">
                        لا توجد تارجتات محفوظة لهذا الشهر أو الفلاتر الحالية.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
        </div>
      ) : null}

      {mode === "ranking" ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {data.rankingRows.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-[1280px] w-full text-right text-sm">
                <thead className="bg-slate-100 text-xs font-black text-slate-600">
                  <tr>
                    {["الترتيب", "المدينة", "التطبيق", "الطلبات", "الهدف", "الإنجاز", "ON-TIME", "إلغاء", "رفض", "ساعات", "تنبيهات", "التقييم", "إجراءات"].map((head) => (
                      <th key={head} className="px-4 py-3">{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.rankingRows.map((row) => (
                    <tr key={`${row.cityId}:${row.appName}`} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-black">#{row.rank}</td>
                      <td className="px-4 py-3 font-bold">{row.cityName}</td>
                      <td className="px-4 py-3">{row.appName}</td>
                      <td className="px-4 py-3">{fmt(row.orders)}</td>
                      <td className="px-4 py-3">{fmt(row.monthlyTarget)}</td>
                      <td className="px-4 py-3"><span className="rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-800">{pct(row.achievement)}</span></td>
                      <td className="px-4 py-3">{pct(row.onTimeRate)}</td>
                      <td className="px-4 py-3">{pct(row.cancellationRate)}</td>
                      <td className="px-4 py-3">{pct(row.rejectionRate)}</td>
                      <td className="px-4 py-3">{fmt(row.workingHours)}</td>
                      <td className="px-4 py-3">{fmt(row.alerts)}</td>
                      <td className="px-4 py-3"><StatusBadge value={row.evaluation} /></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button type="button" onClick={() => openCityDetail(row.cityId, "ranking")} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-black">تفاصيل</button>
                          <button type="button" onClick={() => openCityDetail(row.cityId, "alerts")} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-black">تنبيهات</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState text="لا توجد بيانات ترتيب للمدن حسب الفلاتر الحالية." />
          )}
        </div>
      ) : null}
    </section>
  );
}
