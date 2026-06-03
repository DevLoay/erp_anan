"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { SmartAssistant } from "@/components/layout/SmartAssistant";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const authPage = pathname === "/login" || pathname === "/forgot-password" || pathname.startsWith("/reset-password");

  if (authPage) {
    return <main className="min-h-screen bg-slate-50">{children}</main>;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1 p-5 lg:p-7">{children}</main>
      </div>
      <SmartAssistant />
    </div>
  );
}

