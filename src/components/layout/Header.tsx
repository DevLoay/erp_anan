"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { findModuleByPath } from "@/lib/modules";

type HeaderTitle = {
  title: string;
  subtitle: string;
  section: string;
  parent?: string;
};

const fallbackTitle: HeaderTitle = {
  title: "لوحة عمليات MOHAMED SHAWKI ERP",
  subtitle: "نظام إنتاجي منظم لإدارة التشغيل والماليات والمناديب.",
  section: "الرئيسية",
};

const prefixTitles: Array<HeaderTitle & { prefix: string }> = [
  { prefix: "/projects/", title: "المشاريع", subtitle: "مسارات مستقلة للاستيراد والفواتير والمسير والتقارير.", section: "المدن والمشاريع", parent: "المشاريع" },
  { prefix: "/drivers/", title: "إدارة المناديب", subtitle: "ملف المندوب وربطه بالمدينة والمشرف والمشروع.", section: "المناديب والموارد البشرية", parent: "إدارة المناديب" },
  { prefix: "/vehicles/", title: "السيارات", subtitle: "السيارات والحركة والتكلفة والخصومات.", section: "السيارات والحركة", parent: "السيارات" },
  { prefix: "/imports/", title: "الاستيراد", subtitle: "معاينة الملفات ومطابقة الأعمدة قبل الحفظ.", section: "التشغيل", parent: "استيراد البيانات العامة" },
  { prefix: "/applications/", title: "مركز التطبيقات", subtitle: "التطبيقات والمشاريع والحسابات والقوالب.", section: "المدن والمشاريع", parent: "مركز التطبيقات" },
  { prefix: "/payroll/", title: "مسير الرواتب", subtitle: "المسير والإعدادات والاعتمادات.", section: "الماليات", parent: "مسير الرواتب" },
  { prefix: "/settings/", title: "إعدادات البرنامج", subtitle: "إعدادات النظام والقوالب وقواعد الرواتب.", section: "الإدارة العامة", parent: "إعدادات البرنامج" },
];

function routeTitle(pathname: string): HeaderTitle {
  const module = findModuleByPath(pathname);
  if (module) {
    return {
      title: module.label,
      subtitle: module.description,
      section: module.section,
      parent: module.parent,
    };
  }

  const prefixed = prefixTitles.find((item) => pathname.startsWith(item.prefix));
  return prefixed ?? fallbackTitle;
}

export function Header() {
  const pathname = usePathname();
  const [toast, setToast] = useState("");
  const current = routeTitle(pathname);
  const breadcrumb = ["الرئيسية", current.section, current.parent, current.title].filter(Boolean);

  function keepArabic() {
    document.documentElement.lang = "ar";
    document.documentElement.dir = "rtl";
    localStorage.setItem("erp-language", "ar");
    setToast("تم تثبيت العربية كلغة النظام.");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur" dir="rtl">
      {toast ? (
        <div className="fixed left-5 top-20 z-[100] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 shadow-2xl">
          {toast}
          <button type="button" onClick={() => setToast("")} className="mr-3 rounded-lg bg-slate-100 px-2 py-1 text-xs font-black">
            إغلاق
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-right">
          <p className="text-xs font-black text-blue-700">MOHAMED SHAWKI ERP</p>
          <h2 className="text-2xl font-black text-slate-950">{current.title}</h2>
          <p className="text-xs font-bold text-slate-500">{current.subtitle}</p>
          <p className="mt-1 text-[11px] font-black text-slate-400">{breadcrumb.join("  /  ")}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/supervisors" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800 shadow-sm hover:bg-slate-50">
            المشرفين
          </Link>
          <button type="button" onClick={keepArabic} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800 shadow-sm hover:bg-slate-50">
            العربية
          </button>
          <button
            type="button"
            onClick={() => setToast("تم تثبيت نمط الواجهة الهادئ. تخصيص الألوان الكامل من إعدادات البرنامج.")}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-amber-700 shadow-sm hover:bg-slate-50"
          >
            هادئ
          </button>
          <Link href="/notifications" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800 shadow-sm hover:bg-slate-50">
            التنبيهات
          </Link>
          <div className="flex items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-blue-700 text-sm font-black text-white">S</span>
            <div className="text-left">
              <p className="text-sm font-black text-slate-950">System Admin</p>
              <p className="text-xs font-bold text-slate-500">Admin</p>
            </div>
          </div>
          <Link href="/logout" className="rounded-xl bg-red-600 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-red-700">
            خروج
          </Link>
        </div>
      </div>
    </header>
  );
}
