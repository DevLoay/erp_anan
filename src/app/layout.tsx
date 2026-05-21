import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { SmartAssistant } from "@/components/layout/SmartAssistant";

export const metadata: Metadata = {
  title: "MOHAMED SHAWKI ERP",
  description: "Production ERP for logistics operations",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <Header />
            <main className="flex-1 p-5 lg:p-7">{children}</main>
          </div>
          <SmartAssistant />
        </div>
      </body>
    </html>
  );
}
