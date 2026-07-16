"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { SmartAssistant } from "@/components/layout/SmartAssistant";

function StableBootShell() {
  return (
    <main className="min-h-screen bg-slate-50" suppressHydrationWarning>
      <div className="flex min-h-screen items-center justify-center px-6" suppressHydrationWarning>
        <div className="rounded-3xl border border-slate-200 bg-white px-8 py-6 text-center shadow-sm" suppressHydrationWarning>
          <p className="text-xs font-black text-blue-700">MOHAMED SHAWKI ERP</p>
          <p className="mt-2 text-sm font-bold text-slate-500">Loading workspace...</p>
        </div>
      </div>
    </main>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const authPage =
    pathname === "/login" ||
    pathname === "/forgot-password" ||
    pathname.startsWith("/reset-password") ||
    pathname === "/rider-app" ||
    pathname.startsWith("/rider-app");

  // Keep the server HTML and the very first client render identical.
  // This prevents hydration warnings caused by browser extensions such as
  // fdprocessedid, localStorage language state, Date/locale differences, and
  // Sidebar/Header state that only exists in the browser.
  if (!mounted) {
    return <StableBootShell />;
  }

  if (authPage) {
    return <main className="min-h-screen bg-slate-50" suppressHydrationWarning>{children}</main>;
  }

  return (
    <div className="erp-app-shell flex min-h-screen w-full max-w-full bg-slate-50" suppressHydrationWarning>
      <Sidebar />
      <div className="erp-main-column flex min-w-0 flex-1 flex-col" suppressHydrationWarning>
        <Header />
        <main className="erp-page-main min-w-0 flex-1 p-4 sm:p-5 lg:p-7" suppressHydrationWarning>{children}</main>
      </div>
      <SmartAssistant />
    </div>
  );
}
