import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { prisma } from "@/lib/prisma";
import { AccountActionButtons, DriverActionButtons } from "@/components/drivers/DriverDetailActions";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function one(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function value(input: unknown) {
  return input === null || input === undefined || input === "" ? "-" : String(input);
}

function money(input: unknown) {
  const number = Number(input ?? 0);
  return Number.isFinite(number) && number ? new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR" }).format(number) : "-";
}

function date(input: Date | null | undefined) {
  return input ? input.toISOString().slice(0, 10) : "-";
}

function labelPerson(person?: { name?: string | null; actualName?: string | null; internalCode?: string | null } | null) {
  if (!person) return "-";
  return `${person.actualName || person.name || "-"}${person.internalCode ? ` (${person.internalCode})` : ""}`;
}

function badgeClass(value: string) {
  if (["ACTIVE", "APPROVED", "OWNER", "LOW"].includes(value)) return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (["PENDING", "NEEDS_REVIEW", "MEDIUM"].includes(value)) return "border-amber-200 bg-amber-50 text-amber-800";
  if (["SUSPENDED", "INACTIVE", "HIGH", "CRITICAL"].includes(value)) return "border-red-200 bg-red-50 text-red-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export default async function DriverDetailsPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const query = await searchParams;
  const selectedMonth = one(query, "month") || currentMonth();
  const applicationId = one(query, "applicationId");
  const applicationProjectId = one(query, "applicationProjectId");

  const [driver, applications, projects] = await Promise.all([
    prisma.driver.findUnique({
      where: { id },
      include: {
        city: true,
        project: true,
        supervisor: true,
        vehicle: true,
        applicationAccounts: {
          include: {
            application: true,
            applicationProject: true,
            city: true,
            driver: { select: { id: true, name: true, actualName: true, internalCode: true } },
            accountUsages: {
              where: { month: selectedMonth },
              include: {
                ownerDriver: { select: { id: true, name: true, actualName: true, internalCode: true } },
                actualDriver: { select: { id: true, name: true, actualName: true, internalCode: true } },
              },
              orderBy: { updatedAt: "desc" },
              take: 5,
            },
          },
          orderBy: { updatedAt: "desc" },
        },
        vehicleAssignments: { include: { vehicle: true }, orderBy: { startDate: "desc" }, take: 15 },
        advances: { orderBy: { createdAt: "desc" }, take: 15 },
        violations: { include: { vehicle: true }, orderBy: { occurredAt: "desc" }, take: 15 },
        fuelRecords: { orderBy: { fuelDate: "desc" }, take: 15 },
      },
    }),
    prisma.application.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, code: true } }),
    prisma.applicationProject.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, applicationId: true, cityId: true } }),
  ]);

  if (!driver) notFound();

  const [usageRows, payrollItems] = await Promise.all([
    prisma.accountUsage.findMany({
      where: {
        month: selectedMonth,
        OR: [{ ownerDriverId: driver.id }, { actualDriverId: driver.id }],
        ...(applicationId ? { applicationId } : {}),
        ...(applicationProjectId ? { applicationProjectId } : {}),
      },
      include: {
        application: { select: { name: true, code: true } },
        applicationProject: { select: { name: true, code: true } },
        city: { select: { nameAr: true, nameEn: true } },
        applicationAccount: { select: { appName: true, appUserId: true, appUsername: true, username: true, driverId: true } },
        ownerDriver: { select: { id: true, name: true, actualName: true, internalCode: true } },
        actualDriver: { select: { id: true, name: true, actualName: true, internalCode: true } },
      },
      orderBy: [{ month: "desc" }, { updatedAt: "desc" }],
      take: 100,
    }),
    prisma.payrollItem.findMany({
      where: {
        driverId: driver.id,
        payrollRun: {
          year: Number(selectedMonth.slice(0, 4)),
          month: Number(selectedMonth.slice(5, 7)),
          ...(applicationId ? { applicationId } : {}),
          ...(applicationProjectId ? { applicationProjectId } : {}),
        },
      },
      include: {
        payrollRun: { include: { application: true, applicationProject: true, city: true } },
        applicationAccount: true,
        vehicle: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const filteredAccounts = driver.applicationAccounts.filter((account) => {
    if (applicationId && account.applicationId !== applicationId) return false;
    if (applicationProjectId && account.applicationProjectId !== applicationProjectId) return false;
    return true;
  });

  const filteredProjects = applicationId ? projects.filter((project) => project.applicationId === applicationId) : projects;

  return (
    <section className="space-y-5" dir="rtl">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <nav className="mb-2 text-xs font-black text-slate-500">
          <Link href="/drivers">المناديب</Link> / {driver.actualName || driver.name}
        </nav>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black text-slate-950">{driver.actualName || driver.name}</h1>
            <p className="mt-1 text-sm font-bold text-slate-500">{driver.internalCode || driver.driverCode || driver.nationalId || "-"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/drivers" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700">رجوع</Link>
            <Link href={`/rider-reports?driverId=${driver.id}&month=${selectedMonth}`} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white">تقرير المندوب</Link>
          </div>
        </div>
        <div className="mt-4">
          <DriverActionButtons driverId={driver.id} />
        </div>
      </div>

      <form className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-5">
        <label className="grid gap-1 text-xs font-black text-slate-600">
          الشهر
          <input name="month" type="month" defaultValue={selectedMonth} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold" />
        </label>
        <label className="grid gap-1 text-xs font-black text-slate-600">
          التطبيق
          <select name="applicationId" defaultValue={applicationId} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold">
            <option value="">كل التطبيقات</option>
            {applications.map((app) => <option key={app.id} value={app.id}>{app.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-black text-slate-600 md:col-span-2">
          مشروع التشغيل
          <select name="applicationProjectId" defaultValue={applicationProjectId} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold">
            <option value="">كل المشاريع</option>
            {filteredProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button className="h-11 flex-1 rounded-xl bg-slate-950 px-4 text-sm font-black text-white">تطبيق</button>
          <Link href={`/drivers/${driver.id}`} className="grid h-11 place-items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-black">مسح</Link>
        </div>
      </form>

      <section>
        <h2 className="mb-3 text-lg font-black text-slate-950">البيانات الشخصية</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Info title="الحالة" value={driver.status} />
          <Info title="المدينة" value={driver.city?.nameAr || driver.city?.nameEn} />
          <Info title="المشرف" value={driver.supervisor?.name} />
          <Info title="نوع العلاقة" value={driver.contractType || driver.sponsorshipType} />
          <Info title="رقم الهوية / الإقامة" value={driver.nationalId} />
          <Info title="الجوال" value={driver.phone || driver.mobile} />
          <Info title="نوع السيارة" value={driver.vehicleOwnershipType} />
          <Info title="السكن" value={driver.housingStatus || driver.accommodationType} />
        </div>
      </section>

      <DataSection title="حسابات التطبيقات" empty={filteredAccounts.length === 0 ? "لا توجد حسابات تطبيقات لهذا المندوب حسب الفلاتر." : ""} headers={["التطبيق", "مشروع التشغيل", "المدينة", "App User ID", "اسم الحساب", "مالك الحساب", "العامل الفعلي للشهر", "الحالة", "Usage", "إجراءات"]}>
        {filteredAccounts.map((account) => {
          const latestUsage = account.accountUsages[0];
          return (
            <tr key={account.id}>
              <Cell>{account.application?.name || account.appName}</Cell>
              <Cell>{account.applicationProject?.name}</Cell>
              <Cell>{account.city?.nameAr || account.city?.nameEn}</Cell>
              <Cell>{account.appUserId || account.username}</Cell>
              <Cell>{account.appUsername || account.username}</Cell>
              <Cell>{labelPerson(account.driver)}</Cell>
              <Cell>{labelPerson(latestUsage?.actualDriver)}</Cell>
              <Cell><Badge value={account.status} /></Cell>
              <Cell><Badge value={latestUsage?.usageType || (account.needsReview ? "NEEDS_REVIEW" : "OWNER")} /></Cell>
              <Cell><AccountActionButtons accountId={account.id} month={selectedMonth} driverId={driver.id} /></Cell>
            </tr>
          );
        })}
      </DataSection>

      <DataSection title="الاستخدام الفعلي للحسابات" empty={usageRows.length === 0 ? "لا يوجد استخدام فعلي لهذا الشهر." : ""} headers={["الشهر", "التطبيق", "المشروع", "المدينة", "الحساب", "المالك", "العامل الفعلي", "المصدر", "النوع", "الحالة", "سبب المراجعة"]}>
        {usageRows.map((usage) => (
          <tr key={usage.id}>
            <Cell>{usage.month}</Cell>
            <Cell>{usage.application?.name || usage.applicationAccount.appName}</Cell>
            <Cell>{usage.applicationProject?.name}</Cell>
            <Cell>{usage.city?.nameAr || usage.city?.nameEn}</Cell>
            <Cell>{usage.applicationAccount.appUserId || usage.applicationAccount.username}</Cell>
            <Cell>{labelPerson(usage.ownerDriver)}</Cell>
            <Cell>{labelPerson(usage.actualDriver)}</Cell>
            <Cell>{usage.source}</Cell>
            <Cell><Badge value={usage.usageType} /></Cell>
            <Cell><Badge value={usage.status} /></Cell>
            <Cell>{usage.reviewReason}</Cell>
          </tr>
        ))}
      </DataSection>

      <DataSection title="الماليات والمسير حسب التطبيق والمشروع" empty={payrollItems.length === 0 ? "لا توجد بيانات مالية لهذا المشروع أو الشهر." : ""} headers={["الشهر", "التطبيق", "المشروع", "المدينة", "الحساب", "الطلبات", "إجمالي الراتب", "الخصومات", "الصافي", "إيراد الشركة", "الحالة"]}>
        {payrollItems.map((row) => (
          <tr key={row.id}>
            <Cell>{`${row.payrollRun.year}-${String(row.payrollRun.month).padStart(2, "0")}`}</Cell>
            <Cell>{row.payrollRun.application?.name}</Cell>
            <Cell>{row.payrollRun.applicationProject?.name}</Cell>
            <Cell>{row.payrollRun.city?.nameAr || row.payrollRun.city?.nameEn}</Cell>
            <Cell>{row.applicationAccount?.appUserId || row.applicationAccount?.username}</Cell>
            <Cell>{row.orders}</Cell>
            <Cell>{money(row.totalEarnings)}</Cell>
            <Cell>{money(row.totalDeductions)}</Cell>
            <Cell>{money(row.finalSalary || row.netSalary)}</Cell>
            <Cell>{money(row.companyRevenueFromKeeta || row.keetaTotalPayableAmount)}</Cell>
            <Cell><Badge value={row.status} /></Cell>
          </tr>
        ))}
      </DataSection>

      <DataSection title="السيارات والحركة" empty={driver.vehicleAssignments.length === 0 ? "لا توجد حركة سيارات لهذا المندوب." : ""} headers={["السيارة", "من", "إلى", "أيام الإيجار", "الإيجار المحسوب", "الحالة"]}>
        {driver.vehicleAssignments.map((row) => (
          <tr key={row.id}>
            <Cell>{row.vehicle.plateAr || row.vehicle.plateArabic || row.vehicle.plateEn || row.vehicle.plateEnglish}</Cell>
            <Cell>{date(row.startDate)}</Cell>
            <Cell>{date(row.endDate)}</Cell>
            <Cell>{row.rentalDays ?? "-"}</Cell>
            <Cell>{money(row.calculatedRent)}</Cell>
            <Cell><Badge value={row.status} /></Cell>
          </tr>
        ))}
      </DataSection>

      <DataSection title="السلف والمخالفات والخصومات" empty={driver.advances.length + driver.violations.length + driver.fuelRecords.length === 0 ? "لا توجد سلف أو مخالفات أو بنزين لهذا المندوب." : ""} headers={["المصدر", "التاريخ/الشهر", "القيمة", "الحالة", "ملاحظات"]}>
        {driver.advances.map((row) => (
          <tr key={`advance-${row.id}`}>
            <Cell>سلفة</Cell>
            <Cell>{row.deductionMonth || date(row.advanceDate || row.createdAt)}</Cell>
            <Cell>{money(row.amount)}</Cell>
            <Cell><Badge value={row.status} /></Cell>
            <Cell>{row.reason}</Cell>
          </tr>
        ))}
        {driver.violations.map((row) => (
          <tr key={`violation-${row.id}`}>
            <Cell>مخالفة</Cell>
            <Cell>{date(row.occurredAt)}</Cell>
            <Cell>{money(row.amount)}</Cell>
            <Cell><Badge value={row.status} /></Cell>
            <Cell>{row.type}</Cell>
          </tr>
        ))}
        {driver.fuelRecords.map((row) => (
          <tr key={`fuel-${row.id}`}>
            <Cell>بنزين</Cell>
            <Cell>{date(row.fuelDate)}</Cell>
            <Cell>{money(row.amount)}</Cell>
            <Cell><Badge value={row.status} /></Cell>
            <Cell>{row.notes}</Cell>
          </tr>
        ))}
      </DataSection>
    </section>
  );
}

function Info({ title, value: displayValue }: { title: string; value: unknown }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-black text-slate-500">{title}</p>
      <strong className="mt-1 block text-lg font-black text-slate-950">{value(displayValue)}</strong>
    </div>
  );
}

function Badge({ value }: { value: string | null | undefined }) {
  const display = value || "-";
  return <span className={`rounded-full border px-3 py-1 text-xs font-black ${badgeClass(display)}`}>{display}</span>;
}

function DataSection({ title, headers, children, empty }: { title: string; headers: string[]; children: ReactNode; empty?: string }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-black text-slate-950">{title}</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-right text-sm">
          <thead className="bg-slate-50 text-xs font-black text-slate-500">
            <tr>{headers.map((header) => <th key={header} className="whitespace-nowrap px-3 py-2">{header}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {empty ? (
              <tr>
                <td colSpan={headers.length} className="px-4 py-8 text-center font-bold text-slate-500">{empty}</td>
              </tr>
            ) : children}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Cell({ children }: { children: ReactNode }) {
  return <td className="whitespace-nowrap px-3 py-3 font-bold text-slate-800">{children || "-"}</td>;
}
