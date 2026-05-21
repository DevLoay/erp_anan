"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

const tips: Record<string, string[]> = {
  "/drivers": [
    "ابدأ برفع ملف المناديب الرسمي، ثم راجع Preview قبل الاعتماد.",
    "أي مندوب بدون حساب تطبيق أو مشرف سيظهر كفجوة تشغيلية في الجدول.",
  ],
  "/notifications": [
    "راجع التنبيهات الحرجة أولاً، ثم افتح تقرير المندوب أو المدينة من نفس الصف.",
    "حل التنبيه لا يحذف البيانات، بل يحتاج اعتماد إجراء تشغيلي واضح.",
  ],
  "/applications": [
    "اربط التطبيق بالمشاريع والحسابات قبل رفع التقارير اليومية.",
    "قوالب Keeta وملفات المناديب أصبحت منفصلة لتقليل أخطاء الاستيراد.",
  ],
  "/imports": [
    "لا يتم حفظ أي بيانات قبل ظهور Preview واعتماد الحفظ.",
    "لو ظهرت Missing Drivers، راجع ملف المناديب أو حسابات التطبيقات.",
  ],
};

function pageTips(pathname: string) {
  if (pathname.startsWith("/imports")) return tips["/imports"];
  if (pathname.startsWith("/applications")) return tips["/applications"];
  return tips[pathname] ?? ["المساعد يقرأ الصفحة الحالية ويقترح الخطوة الأنسب بدون تغيير البيانات.", "كل إجراء حساس يجب أن يمر بمعاينة أو تأكيد قبل الحفظ."];
}

export function SmartAssistant() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const currentTips = useMemo(() => pageTips(pathname), [pathname]);

  return (
    <div className="fixed bottom-6 left-6 z-[70] print:hidden" dir="rtl">
      {open ? (
        <div className="mb-3 w-[min(360px,calc(100vw-2rem))] rounded-3xl border border-slate-200 bg-white p-4 text-right shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black text-blue-700">المساعد الذكي</p>
              <h3 className="text-lg font-black text-slate-950">ماذا أفعل الآن؟</h3>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-slate-200 px-3 py-1 text-xs font-black text-slate-700">
              إغلاق
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {currentTips.map((tip) => (
              <div key={tip} className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-sm font-bold text-slate-700">
                {tip}
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link href="/imports/preview?importType=drivers" className="rounded-xl bg-blue-600 px-3 py-2 text-center text-xs font-black text-white">
              رفع مناديب
            </Link>
            <Link href="/notifications" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-xs font-black text-slate-800">
              التنبيهات
            </Link>
            <Link href="/rider-kpi" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-xs font-black text-slate-800">
              KPI
            </Link>
            <Link href="/imports/templates?fileType=drivers" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-xs font-black text-slate-800">
              قالب المناديب
            </Link>
          </div>
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-sky-600 to-blue-700 text-sm font-black text-white shadow-2xl ring-4 ring-white"
        aria-label="فتح المساعد الذكي"
      >
        AI
      </button>
    </div>
  );
}
