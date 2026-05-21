"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApplicationCard } from "./ApplicationCard";
import { ApplicationDetailsTabs, type ApplicationDetailsTab } from "./ApplicationDetailsTabs";
import { applicationHeaderActions, featureInProgressMessage } from "@/lib/applications/applicationActions";
import type { ApplicationCenterApp } from "@/lib/applications/getApplicationDetails";
import type { ApplicationCenterData } from "@/lib/applications/getApplicationCenterData";

type Props = {
  data: ApplicationCenterData;
};

type SelectedDetails = {
  app: ApplicationCenterApp;
  tab: ApplicationDetailsTab;
};

type OperationLink = {
  title: string;
  description: string;
  route: string;
  tone: "amber" | "blue" | "emerald" | "slate";
};

const actionToTab: Record<string, ApplicationDetailsTab> = {
  "عرض التفاصيل": "overview",
  "عرض": "overview",
  "المشاريع": "projects",
  "الحسابات": "accounts",
  "إعدادات الفاتورة": "invoice",
  "إعدادات الرانك": "rank",
  "إعدادات المسير": "payroll-settings",
  "قوالب الاستيراد": "templates",
  "عرض المسيرات": "payroll-runs",
  "المسيرات": "payroll-runs",
  "الإعدادات": "invoice",
};

const operationLinks: OperationLink[] = [
  {
    title: "استيراد تقارير التطبيقات",
    description: "رفع Keeta / HungerStation / Talabat مع Preview قبل الحفظ.",
    route: "/imports/preview",
    tone: "amber",
  },
  {
    title: "تقارير مرفوعة",
    description: "متابعة الملفات والدفعات وحالات المعالجة.",
    route: "/imports/history",
    tone: "blue",
  },
  {
    title: "حركة الحسابات",
    description: "مراجعة الحسابات المرتبطة والفارغة وحالات الربط.",
    route: "/applications",
    tone: "slate",
  },
  {
    title: "Rank Keeta",
    description: "استيراد وتحليل وربط رانك كيتا بالمناديب.",
    route: "/applications/keeta/rank",
    tone: "emerald",
  },
  {
    title: "قالب Keeta",
    description: "القالب الأساسي الحالي لتقارير كيتا اليومية.",
    route: "/imports/templates?fileType=keeta_invoice",
    tone: "amber",
  },
  {
    title: "قالب HungerStation",
    description: "قالب هنقرستيشن منفصل عن باقي التطبيقات.",
    route: "/imports/templates?fileType=hungerstation_invoice",
    tone: "amber",
  },
  {
    title: "قالب Talabat",
    description: "قالب طلبات وإعدادات المطابقة.",
    route: "/imports/templates?fileType=talabat_invoice",
    tone: "amber",
  },
  {
    title: "مسير الرواتب",
    description: "فتح مسير المشاريع وربطه بالفاتورة والرانك.",
    route: "/payroll",
    tone: "emerald",
  },
];

const operationToneClass: Record<OperationLink["tone"], string> = {
  amber: "border-amber-200 bg-amber-50 text-amber-900",
  blue: "border-blue-200 bg-blue-50 text-blue-900",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
  slate: "border-slate-200 bg-white text-slate-900",
};

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-5 left-5 z-[60] flex max-w-sm items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-800 shadow-2xl">
      <span>{message}</span>
      <button type="button" onClick={onClose} className="rounded-md bg-slate-100 px-2 py-1 text-xs font-black text-slate-700">
        إغلاق
      </button>
    </div>
  );
}

function SectionTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <h2 className="text-lg font-black text-slate-950">{title}</h2>
      {description ? <p className="mt-1 text-sm font-bold text-slate-500">{description}</p> : null}
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-center">
      <h2 className="text-lg font-black text-slate-950">لا توجد بيانات تشغيلية محفوظة للتطبيقات حتى الآن.</h2>
      <p className="mt-2 text-sm font-bold text-slate-500">
        ستظل كروت التطبيقات ظاهرة كهيكل تشغيل، لكن الأرقام ستبقى صفرًا إلى أن يتم تسجيل حسابات أو استيراد تقارير حقيقية.
      </p>
      <button type="button" onClick={onAdd} className="mt-4 rounded-xl bg-slate-950 px-5 py-2 text-sm font-black text-white">
        إضافة تطبيق
      </button>
    </div>
  );
}

function OperationsStrip({ onOpen }: { onOpen: (route: string) => void }) {
  return (
    <section className="space-y-3">
      <SectionTitle title="مسارات التشغيل المرتبطة" description="مداخل النسخة القديمة الخاصة بالتطبيقات والاستيراد والقوالب والمسير." />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {operationLinks.map((item) => (
          <button
            key={item.title}
            type="button"
            onClick={() => onOpen(item.route)}
            className={`rounded-2xl border p-4 text-right shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${operationToneClass[item.tone]}`}
          >
            <span className="block text-sm font-black">{item.title}</span>
            <span className="mt-1 block text-xs font-bold leading-6 opacity-75">{item.description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

export function ApplicationsCenterClient({ data }: Props) {
  const router = useRouter();
  const [toast, setToast] = useState("");
  const [selected, setSelected] = useState<SelectedDetails | null>(null);

  function showToast(message = featureInProgressMessage) {
    setToast(message);
  }

  function handleHeaderAction(action: string) {
    if (action === "استيراد تقرير") {
      router.push("/imports/preview");
      return;
    }
    if (action === "قوالب الاستيراد") {
      router.push("/imports/templates");
      return;
    }
    if (action === "إعدادات الفاتورة") {
      router.push("/applications/invoice-settings");
      return;
    }
    if (action === "إعدادات الرانك") {
      router.push("/applications/rank-settings");
      return;
    }
    showToast();
  }

  function handleApplicationAction(action: string, app: ApplicationCenterApp) {
    if (action === "التقارير") {
      router.push("/reports");
      return;
    }
    if (action === "قواعد KPI") {
      router.push("/settings");
      return;
    }
    if (action === "Rank Keeta") {
      router.push(app.key === "keeta" ? "/applications/keeta/rank" : `/applications/${app.id}/rank-settings`);
      return;
    }
    if (action === "استيراد تقرير" || action === "الاستيراد") {
      router.push("/imports/preview");
      return;
    }
    if (action === "قوالب الاستيراد") {
      router.push("/imports/templates");
      return;
    }
    if (action === "إعدادات الفاتورة" && app.id) {
      router.push(`/applications/${app.id}/invoice-settings`);
      return;
    }
    if (action === "إعدادات الرانك" && app.id) {
      router.push(`/applications/${app.id}/rank-settings`);
      return;
    }

    const tab = actionToTab[action];
    if (tab && app.id) {
      setSelected({ app, tab });
      return;
    }

    showToast();
  }

  if (data.databaseStatus === "offline") {
    return (
      <section className="w-full max-w-none space-y-4 bg-slate-50" dir="rtl">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-2xl font-black text-red-950">قاعدة البيانات غير متصلة</h1>
          <p className="mt-2 text-sm font-bold text-red-800">{data.databaseMessage ?? "يرجى تشغيل PostgreSQL ثم تحديث الصفحة."}</p>
          <button type="button" onClick={() => router.refresh()} className="mt-4 rounded-xl bg-red-700 px-5 py-2 text-sm font-black text-white">
            تحديث الصفحة
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full max-w-none space-y-5 bg-slate-50" dir="rtl" data-applications-center>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <nav className="mb-2 flex flex-wrap items-center gap-2 text-xs font-black text-slate-500">
              <Link href="/" className="hover:text-slate-950">الرئيسية</Link>
              <span>/</span>
              <span className="text-slate-800">مركز التطبيقات</span>
            </nav>
            <h1 className="text-3xl font-black text-slate-950">مركز التطبيقات</h1>
            <p className="mt-2 max-w-5xl text-sm font-bold leading-7 text-slate-600">
              إدارة التطبيقات والمشاريع وحسابات المناديب وقوالب الاستيراد وإعدادات الفواتير والرانك ومسيرات الرواتب.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {applicationHeaderActions.map((action) => (
              <button key={action} type="button" onClick={() => handleHeaderAction(action)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 shadow-sm transition hover:bg-slate-50">
                {action}
              </button>
            ))}
            <button type="button" onClick={() => router.refresh()} className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-slate-800">
              تحديث البيانات
            </button>
          </div>
        </div>
      </div>

      {data.schemaWarnings.length ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
          بعض جداول أو أعمدة مركز التطبيقات غير مطبقة في PostgreSQL بعد، لذلك يتم عرض البيانات المتاحة فقط بدون أرقام وهمية.
        </div>
      ) : null}

      {data.isEmpty ? <EmptyState onAdd={() => showToast()} /> : null}

      <section className="space-y-3">
        <SectionTitle title="كروت التطبيقات" description="نفس ترتيب النسخة القديمة: الحالة، مدن التغطية، المناديب، الحسابات الفارغة، الحسابات المرتبطة، وآخر تحديث." />
        <div className="grid gap-4 xl:grid-cols-2">
          {data.applications.map((app) => (
            <ApplicationCard key={app.id} app={app} onAction={handleApplicationAction} />
          ))}
        </div>
      </section>

      <OperationsStrip onOpen={(route) => router.push(route)} />

      {selected ? <ApplicationDetailsTabs app={selected.app} initialTab={selected.tab} onClose={() => setSelected(null)} onAction={() => showToast()} /> : null}
      {toast ? <Toast message={toast} onClose={() => setToast("")} /> : null}
    </section>
  );
}
