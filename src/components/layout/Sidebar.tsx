"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navSections } from "@/lib/navigation";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden sticky top-0 h-screen w-80 shrink-0 overflow-y-auto border-l border-slate-200 bg-[#07111f] text-white lg:block">
      <div className="sticky top-0 z-10 border-b border-white/10 bg-[#07111f] px-5 py-5">
        <p className="text-xs font-semibold text-sky-200">Production ERP</p>
        <h1 className="mt-1 text-lg font-black tracking-normal">MOHAMED SHAWKI</h1>
      </div>

      <nav className="space-y-5 px-4 py-5">
        {navSections.map((section) => (
          <section key={section.title}>
            <h2 className="px-2 text-xs font-black text-sky-200">{section.title}</h2>
            <div className="mt-2 grid gap-1">
              {section.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm font-semibold transition ${
                      active ? "bg-white text-slate-950 shadow-sm" : "text-slate-100 hover:bg-white/10"
                    }`}
                  >
                    <span className="truncate">{item.label}</span>
                    {item.status === "migration" ? (
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-black ${
                          active ? "bg-amber-100 text-amber-800" : "bg-amber-300/15 text-amber-200"
                        }`}
                      >
                        مرتبط
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </nav>
    </aside>
  );
}
