"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { MetricCard } from "@/components/analytics/MetricCard";
import { KeetaRankImport } from "./KeetaRankImport";
import type { KeetaRankData, KeetaRankTableRow } from "@/lib/applications/keetaRank";

type Props = {
  data: KeetaRankData;
};

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-5 left-5 z-[80] flex max-w-sm items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-800 shadow-2xl">
      <span>{message}</span>
      <button type="button" onClick={onClose} className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
        إغلاق
      </button>
    </div>
  );
}

function statusClass(status: string) {
  if (status === "Valid") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "Missing Driver") return "border-red-200 bg-red-50 text-red-700";
  if (status === "Unlinked Account") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "Duplicate Match") return "border-orange-200 bg-orange-50 text-orange-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function KeetaRankRowsTable({ rows, onAction }: { rows: KeetaRankTableRow[]; onAction: (action: string, row: KeetaRankTableRow) => void }) {
  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <h3 className="text-lg font-black text-slate-950">لا توجد صفوف Keeta Rank محفوظة حتى الآن.</h3>
        <p className="mt-2 text-sm font-bold text-slate-500">ابدأ برفع ملف Rank ثم اعتمد الحفظ بعد المعاينة.</p>
      </div>
    );
  }

  const actions = ["عرض الصف", "ربط بمندوب", "تجاهل الصف", "إعادة التحقق", "تصدير الأخطاء"];

  return (
    <div className="table-scroll rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-[1550px] text-right text-sm">
        <thead className="bg-slate-50 text-xs font-black text-slate-500">
          <tr>
            {[
              "Import Date",
              "Project",
              "Driver Code",
              "Driver Name",
              "National ID",
              "App User ID",
              "App Username",
              "Rank",
              "Orders",
              "On Time",
              "Cancellation",
              "Rejection",
              "Working Hours",
              "Match Status",
              "Error Message",
              "Actions",
            ].map((head) => <th key={head} className="whitespace-nowrap px-4 py-3">{head}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.id} className="align-top hover:bg-slate-50">
              <td className="whitespace-nowrap px-4 py-3">{row.importDate}</td>
              <td className="whitespace-nowrap px-4 py-3">{row.projectName}</td>
              <td className="whitespace-nowrap px-4 py-3">{row.driverCode}</td>
              <td className="whitespace-nowrap px-4 py-3 font-black">{row.driverName}</td>
              <td className="whitespace-nowrap px-4 py-3">{row.nationalId}</td>
              <td className="whitespace-nowrap px-4 py-3">{row.appUserId}</td>
              <td className="whitespace-nowrap px-4 py-3">{row.appUsername}</td>
              <td className="whitespace-nowrap px-4 py-3 font-black text-amber-700">{row.rank}</td>
              <td className="whitespace-nowrap px-4 py-3">{row.orders}</td>
              <td className="whitespace-nowrap px-4 py-3">{row.onTime}</td>
              <td className="whitespace-nowrap px-4 py-3">{row.cancellation}</td>
              <td className="whitespace-nowrap px-4 py-3">{row.rejection}</td>
              <td className="whitespace-nowrap px-4 py-3">{row.workingHours}</td>
              <td className="whitespace-nowrap px-4 py-3">
                <span className={`rounded-full border px-2 py-1 text-xs font-black ${statusClass(row.matchStatus)}`}>{row.matchStatus}</span>
              </td>
              <td className="min-w-64 px-4 py-3 text-xs font-bold text-slate-600">{row.errorMessage}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1.5">
                  {actions.map((action) => (
                    <button key={action} type="button" onClick={() => onAction(action, row)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-black text-slate-700 hover:bg-amber-50 hover:text-amber-800">
                      {action}
                    </button>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function KeetaRankClient({ data }: Props) {
  const router = useRouter();
  const [toast, setToast] = useState("");

  const cards = useMemo(
    () => [
      ["إجمالي ملفات Rank المستوردة", data.summary.importedFiles, "slate"],
      ["آخر ملف مستورد", data.summary.lastImport, "amber"],
      ["إجمالي الصفوف", data.summary.totalRows, "blue"],
      ["الصفوف الصحيحة", data.summary.validRows, "emerald"],
      ["الصفوف الخطأ", data.summary.invalidRows, data.summary.invalidRows ? "red" : "emerald"],
      ["Missing Drivers", data.summary.missingDrivers, data.summary.missingDrivers ? "red" : "slate"],
      ["Unlinked Accounts", data.summary.unlinkedAccounts, data.summary.unlinkedAccounts ? "amber" : "slate"],
      ["Duplicate Rows", data.summary.duplicateRows, data.summary.duplicateRows ? "orange" : "slate"],
      ["Linked Drivers", data.summary.linkedDrivers, "blue"],
    ] as const,
    [data.summary],
  );

  function pushFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    for (const key of ["applicationProjectId", "cityId", "importDate", "status", "rankLevel", "q"]) {
      const value = String(form.get(key) ?? "").trim();
      if (value) params.set(key, value);
    }
    router.push(params.toString() ? `/applications/keeta/rank?${params}` : "/applications/keeta/rank");
  }

  function downloadTemplate() {
    const headers = ["Driver Code", "Driver Name", "National ID", "App User ID", "App Username", "Rank", "Orders", "On Time", "Cancellation", "Rejection", "Working Hours"];
    const blob = new Blob([`${headers.join(",")}\n`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "keeta-rank-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (data.databaseStatus === "offline") {
    return (
      <section className="w-full max-w-none space-y-4 bg-slate-50" dir="rtl">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-2xl font-black text-red-950">قاعدة البيانات غير متصلة</h1>
          <p className="mt-2 text-sm font-bold text-red-800">{data.databaseMessage}</p>
          <button type="button" onClick={() => router.refresh()} className="mt-4 rounded-xl bg-red-700 px-5 py-2 text-sm font-black text-white">تحديث الصفحة</button>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full max-w-none space-y-5 bg-slate-50" dir="rtl">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <nav className="mb-2 flex flex-wrap items-center gap-2 text-xs font-black text-slate-500">
              <Link href="/" className="hover:text-slate-950">الرئيسية</Link>
              <span>/</span>
              <Link href="/applications" className="hover:text-slate-950">مركز التطبيقات</Link>
              <span>/</span>
              <span className="text-slate-800">Keeta Rank</span>
            </nav>
            <h1 className="text-3xl font-black text-slate-950">Keeta Rank</h1>
            <p className="mt-2 max-w-5xl text-sm font-bold leading-7 text-slate-600">
              استيراد وتحليل وربط ملفات رانك كيتا بالمناديب وحسابات التطبيقات.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => document.getElementById("keeta-rank-file")?.click()} className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-black text-white shadow-sm hover:bg-amber-700">استيراد Rank Keeta</button>
            <button type="button" onClick={downloadTemplate} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 shadow-sm hover:bg-slate-50">تحميل قالب Keeta Rank</button>
            <button type="button" onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 shadow-sm hover:bg-slate-50">عرض آخر الاستيرادات</button>
            <Link href="/applications/rank-settings" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 shadow-sm hover:bg-slate-50">إعدادات Keeta Rank</Link>
          </div>
        </div>
      </div>

      {!data.keetaApplication ? (
        <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-6 text-center">
          <h2 className="text-xl font-black text-amber-950">لا يوجد تطبيق Keeta مسجل في قاعدة البيانات.</h2>
          <p className="mt-2 text-sm font-bold text-amber-800">أضف تطبيق Keeta من مركز التطبيقات أولًا، ثم ارجع لاستيراد ملفات الرانك.</p>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        {cards.map(([title, value, tone]) => <MetricCard key={title} title={title} value={value} tone={tone} />)}
      </div>

      <KeetaRankImport data={data} onToast={setToast} />

      <form onSubmit={pushFilters} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label className="space-y-1 text-xs font-black text-slate-600">
            <span>المشروع</span>
            <select name="applicationProjectId" defaultValue={data.filters.applicationProjectId} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
              <option value="">كل المشاريع</option>
              {data.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs font-black text-slate-600">
            <span>المدينة</span>
            <select name="cityId" defaultValue={data.filters.cityId} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
              <option value="">كل المدن</option>
              {data.cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs font-black text-slate-600">
            <span>تاريخ الاستيراد</span>
            <input name="importDate" type="date" defaultValue={data.filters.importDate} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1 text-xs font-black text-slate-600">
            <span>الحالة</span>
            <select name="status" defaultValue={data.filters.status} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
              <option value="">كل الحالات</option>
              <option value="Valid">Valid</option>
              <option value="Missing Driver">Missing Driver</option>
              <option value="Unlinked Account">Unlinked Account</option>
              <option value="Duplicate Match">Duplicate</option>
              <option value="Invalid Data">Invalid Data</option>
            </select>
          </label>
          <label className="space-y-1 text-xs font-black text-slate-600">
            <span>Rank Level</span>
            <input name="rankLevel" defaultValue={data.filters.rankLevel} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="Level A / B / C" />
          </label>
          <label className="space-y-1 text-xs font-black text-slate-600">
            <span>بحث</span>
            <input name="q" defaultValue={data.filters.q} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="مندوب / كود / App User ID" />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="submit" className="rounded-xl bg-slate-950 px-5 py-2 text-sm font-black text-white">تطبيق الفلاتر</button>
          <Link href="/applications/keeta/rank" className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-black text-slate-700">إعادة ضبط</Link>
        </div>
      </form>

      <KeetaRankRowsTable rows={data.rows} onAction={() => setToast("هذه الميزة قيد التطوير")} />

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-black text-slate-950">آخر عمليات الاستيراد</h2>
        {!data.history.length ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm font-bold text-slate-500">لا توجد عمليات استيراد Keeta Rank حتى الآن.</div>
        ) : (
          <div className="table-scroll">
            <table className="min-w-[980px] text-right text-sm">
              <thead className="bg-slate-50 text-xs font-black text-slate-500">
                <tr>{["File Name", "Project", "Total Rows", "Valid", "Invalid", "Missing Drivers", "Unlinked Accounts", "Duplicates", "Status", "Created At"].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.history.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 font-black">{row.fileName}</td>
                    <td className="px-4 py-3">{row.projectName}</td>
                    <td className="px-4 py-3">{row.totalRows}</td>
                    <td className="px-4 py-3">{row.validRows}</td>
                    <td className="px-4 py-3">{row.invalidRows}</td>
                    <td className="px-4 py-3">{row.missingDrivers}</td>
                    <td className="px-4 py-3">{row.unlinkedAccounts}</td>
                    <td className="px-4 py-3">{row.duplicateRows}</td>
                    <td className="px-4 py-3">{row.status}</td>
                    <td className="px-4 py-3">{row.createdAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {toast ? <Toast message={toast} onClose={() => setToast("")} /> : null}
    </section>
  );
}
