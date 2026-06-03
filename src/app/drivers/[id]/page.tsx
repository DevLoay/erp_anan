import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

function value(input: unknown) {
  return input === null || input === undefined || input === "" ? "-" : String(input);
}

function money(input: unknown) {
  const number = Number(input ?? 0);
  return Number.isFinite(number) && number ? new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR" }).format(number) : "-";
}

export default async function DriverDetailsPage({ params }: PageProps) {
  const { id } = await params;
  const driver = await prisma.driver.findUnique({
    where: { id },
    include: {
      city: true,
      project: true,
      supervisor: true,
      vehicle: true,
      applicationAccounts: { include: { application: true, applicationProject: true }, take: 10 },
      vehicleAssignments: { include: { vehicle: true }, orderBy: { startDate: "desc" }, take: 10 },
      advances: { orderBy: { createdAt: "desc" }, take: 10 },
      violations: { include: { vehicle: true }, orderBy: { occurredAt: "desc" }, take: 10 },
      fuelRecords: { orderBy: { fuelDate: "desc" }, take: 10 },
      payrollItems: { include: { payrollRun: true }, orderBy: { createdAt: "desc" }, take: 10 },
    },
  });

  if (!driver) notFound();

  return (
    <section className="space-y-5" dir="rtl">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <nav className="mb-2 text-xs font-black text-slate-500">
          <Link href="/drivers">المناديب</Link> / {driver.name}
        </nav>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black text-slate-950">{driver.name}</h1>
            <p className="mt-1 text-sm font-bold text-slate-500">{driver.internalCode || driver.driverCode || driver.nationalId || "-"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/drivers" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700">رجوع</Link>
            <Link href={`/rider-reports?driverId=${driver.id}`} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white">تقرير المندوب</Link>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Info title="المدينة" value={driver.city?.nameAr} />
        <Info title="المشروع" value={driver.project?.name} />
        <Info title="المشرف" value={driver.supervisor?.name} />
        <Info title="الحالة" value={driver.status} />
        <Info title="رقم الهوية / الإقامة" value={driver.nationalId} />
        <Info title="الجوال" value={driver.phone || driver.mobile} />
        <Info title="نوع العلاقة" value={driver.contractType || driver.sponsorshipType} />
        <Info title="السيارة الحالية" value={driver.vehicle?.plateAr || driver.vehicle?.plateEn || driver.vehicle?.plateArabic || driver.vehicle?.plateEnglish} />
      </div>

      <DataSection title="حسابات التطبيقات" headers={["التطبيق", "المشروع", "App User ID", "اسم الحساب", "الحالة"]}>
        {driver.applicationAccounts.map((account) => (
          <tr key={account.id}>
            <Cell>{account.application?.name || account.appName}</Cell>
            <Cell>{account.applicationProject?.name || account.projectId}</Cell>
            <Cell>{account.appUserId}</Cell>
            <Cell>{account.appUsername || account.username}</Cell>
            <Cell>{account.status}</Cell>
          </tr>
        ))}
      </DataSection>

      <DataSection title="السيارات والحركة" headers={["السيارة", "من", "إلى", "أيام الإيجار", "الإيجار المحسوب", "الحالة"]}>
        {driver.vehicleAssignments.map((row) => (
          <tr key={row.id}>
            <Cell>{row.vehicle.plateAr || row.vehicle.plateEn}</Cell>
            <Cell>{row.startDate.toISOString().slice(0, 10)}</Cell>
            <Cell>{row.endDate?.toISOString().slice(0, 10) || "-"}</Cell>
            <Cell>{row.rentalDays ?? "-"}</Cell>
            <Cell>{money(row.calculatedRent)}</Cell>
            <Cell>{row.status}</Cell>
          </tr>
        ))}
      </DataSection>

      <DataSection title="السلف والمخالفات والبنزين والمسير" headers={["المصدر", "التاريخ/الشهر", "القيمة", "الحالة", "ملاحظات"]}>
        {driver.advances.map((row) => (
          <tr key={`advance-${row.id}`}>
            <Cell>سلفة</Cell>
            <Cell>{row.deductionMonth || row.createdAt.toISOString().slice(0, 10)}</Cell>
            <Cell>{money(row.amount)}</Cell>
            <Cell>{row.status}</Cell>
            <Cell>{row.reason}</Cell>
          </tr>
        ))}
        {driver.violations.map((row) => (
          <tr key={`violation-${row.id}`}>
            <Cell>مخالفة</Cell>
            <Cell>{row.occurredAt.toISOString().slice(0, 10)}</Cell>
            <Cell>{money(row.amount)}</Cell>
            <Cell>{row.status}</Cell>
            <Cell>{row.type}</Cell>
          </tr>
        ))}
        {driver.fuelRecords.map((row) => (
          <tr key={`fuel-${row.id}`}>
            <Cell>بنزين</Cell>
            <Cell>{row.fuelDate.toISOString().slice(0, 10)}</Cell>
            <Cell>{money(row.amount)}</Cell>
            <Cell>{row.status}</Cell>
            <Cell>{row.notes}</Cell>
          </tr>
        ))}
        {driver.payrollItems.map((row) => (
          <tr key={`payroll-${row.id}`}>
            <Cell>مسير</Cell>
            <Cell>{`${row.payrollRun.year}-${String(row.payrollRun.month).padStart(2, "0")}`}</Cell>
            <Cell>{money(row.finalSalary || row.netSalary)}</Cell>
            <Cell>{row.status}</Cell>
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

function DataSection({ title, headers, children }: { title: string; headers: string[]; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-black text-slate-950">{title}</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-right text-sm">
          <thead className="bg-slate-50 text-xs font-black text-slate-500">
            <tr>{headers.map((header) => <th key={header} className="whitespace-nowrap px-3 py-2">{header}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">{children}</tbody>
        </table>
      </div>
    </section>
  );
}

function Cell({ children }: { children: React.ReactNode }) {
  return <td className="whitespace-nowrap px-3 py-3 font-bold text-slate-800">{children || "-"}</td>;
}

