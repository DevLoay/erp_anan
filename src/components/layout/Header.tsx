"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": { title: "لوحة الإدارة", subtitle: "مؤشرات تشغيلية حقيقية من قاعدة البيانات" },
  "/drivers": { title: "إدارة المناديب", subtitle: "صفحة مرتبطة ببيانات النظام والصلاحيات الحالية" },
  "/supervisors": { title: "المشرفين", subtitle: "إدارة المشرفين والأداء والمهام" },
  "/applications": { title: "مركز التطبيقات", subtitle: "التطبيقات والمشاريع والحسابات والقوالب" },
  "/notifications": { title: "الإشعارات والتنبيهات", subtitle: "تنبيهات مولدة من مشاكل تشغيلية حقيقية" },
  "/imports": { title: "الاستيراد", subtitle: "معاينة الملفات قبل الحفظ" },
  "/payroll": { title: "مسير الرواتب", subtitle: "المسير والتعديلات والاعتمادات" },
};

function routeTitle(pathname: string) {
  if (pathname.startsWith("/imports")) return pageTitles["/imports"];
  if (pathname.startsWith("/applications")) return pageTitles["/applications"];
  return pageTitles[pathname] ?? { title: "لوحة عمليات Anan Capital ERP", subtitle: "نظام إنتاجي منظم لإدارة التشغيل والماليات" };
}

export function Header() {
  const pathname = usePathname();
  const [toast, setToast] = useState("");
  const current = routeTitle(pathname);

  function keepArabic() {
    document.documentElement.lang = "ar";
    document.documentElement.dir = "rtl";
    localStorage.setItem("erp-language", "ar");
    setToast("تم تثبيت العربية كلغة النظام. زر English جاهز للترجمة التدريجية بدون كسر الواجهة.");
  }

 return (
  <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
    {toast ? (
      <div className="fixed left-5 top-20 z-[100] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 shadow-2xl">
        {toast}
        <button
          type="button"
          onClick={() => setToast("")}
          className="mr-3 rounded-lg bg-slate-100 px-2 py-1 text-xs font-black"
        >
          إغلاق
        </button>
      </div>
    ) : null}

    <div className="flex flex-wrap items-center justify-between gap-3">
      {/* العنوان يمين */}
      <div className="text-right">
        <p className="text-xs font-black text-blue-700">Anan Capital ERP</p>
        <h2 className="text-2xl font-black text-slate-950">{current.title}</h2>
        <p className="text-xs font-bold text-slate-500">{current.subtitle}</p>
      </div>

      {/* الأزرار واليوزر شمال */}
      <div className="flex flex-wrap items-center gap-2">
    

        <button
          type="button"
          onClick={keepArabic}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800 shadow-sm hover:bg-slate-50"
        >
          English
        </button>

        <button
          type="button"
          onClick={() => setToast("وضع الواجهة الهادئ جاهز، وتخصيص الألوان الكامل داخل إعدادات البرنامج.")}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-amber-700 shadow-sm hover:bg-slate-50"
        >
          هادئ
        </button>

        <Link
          href="/notifications"
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800 shadow-sm hover:bg-slate-50"
        >
          التنبيهات
        </Link>

        <div className="flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-blue-700 text-sm font-black text-white">
            S
          </span>
          <div className="text-left">
            <p className="text-sm font-black text-slate-950">System Admin</p>
            <p className="text-xs font-bold text-slate-500">Admin</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setToast("تسجيل الخروج يحتاج ربط جلسات المستخدمين في مرحلة الصلاحيات.")}
          className="rounded-xl bg-red-600 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-red-700"
        >
          خروج
        </button>
      </div>
    </div>
  </header>
);
}
