import Link from "next/link";
import type { ReportFilterOptions, ReportFilters } from "@/lib/reporting";

type ReportFilterBarProps = {
  filters: ReportFilters;
  options: ReportFilterOptions;
  showStatus?: boolean;
  resetHref: string;
};

export function ReportFilterBar({ filters, options, showStatus = true, resetHref }: ReportFilterBarProps) {
  return (
    <form className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" dir="rtl">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
        <label htmlFor="month-filter" className="grid gap-1 text-sm font-bold text-slate-700">
          الشهر
          <select id="month-filter" name="month" defaultValue={filters.month} className="rounded-md border border-slate-300 px-3 py-2">
            {options.months.map((month) => (
              <option key={month} value={month}>
                {month}
              </option>
            ))}
          </select>
        </label>

        <label htmlFor="app-filter" className="grid gap-1 text-sm font-bold text-slate-700">
          التطبيق
          <select id="app-filter" name="appName" defaultValue={filters.appName} className="rounded-md border border-slate-300 px-3 py-2">
            <option value="">كل التطبيقات</option>
            {options.appNames.map((appName) => (
              <option key={appName} value={appName}>
                {appName}
              </option>
            ))}
          </select>
        </label>

        <label htmlFor="city-filter" className="grid gap-1 text-sm font-bold text-slate-700">
          المدينة
          <select id="city-filter" name="cityId" defaultValue={filters.cityId} className="rounded-md border border-slate-300 px-3 py-2">
            <option value="">كل المدن</option>
            {options.cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>
        </label>

        <label htmlFor="project-filter" className="grid gap-1 text-sm font-bold text-slate-700">
          المشروع
          <select id="project-filter" name="projectId" defaultValue={filters.projectId} className="rounded-md border border-slate-300 px-3 py-2">
            <option value="">كل المشاريع</option>
            {options.projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>

        <label htmlFor="supervisor-filter" className="grid gap-1 text-sm font-bold text-slate-700">
          المشرف
          <select
            id="supervisor-filter"
            name="supervisorId"
            defaultValue={filters.supervisorId}
            className="rounded-md border border-slate-300 px-3 py-2"
          >
            <option value="">كل المشرفين</option>
            {options.supervisors.map((supervisor) => (
              <option key={supervisor.id} value={supervisor.id}>
                {supervisor.name}
              </option>
            ))}
          </select>
        </label>

        {showStatus ? (
          <label htmlFor="status-filter" className="grid gap-1 text-sm font-bold text-slate-700">
            الحالة
            <select id="status-filter" name="status" defaultValue={filters.status} className="rounded-md border border-slate-300 px-3 py-2">
              <option value="">كل الحالات</option>
              <option value="valid">مؤهل</option>
              <option value="invalid">غير مؤهل</option>
              <option value="GOOD">جيد</option>
              <option value="WARNING">تحذير</option>
              <option value="CRITICAL">حرج</option>
            </select>
          </label>
        ) : null}

        <label htmlFor="q-filter" className="grid gap-1 text-sm font-bold text-slate-700">
          بحث
          <input
            id="q-filter"
            name="q"
            defaultValue={filters.q}
            placeholder="اسم، كود، حساب..."
            className="rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button className="rounded-md bg-slate-950 px-4 py-2 text-sm font-black text-white">تطبيق الفلاتر</button>
        <Link href={resetHref} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700">
          مسح الفلاتر
        </Link>
      </div>
    </form>
  );
}
