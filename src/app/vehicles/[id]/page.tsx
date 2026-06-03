import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

function money(input: unknown) {
  const number = Number(input ?? 0);
  return Number.isFinite(number) && number ? new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(number) : "-";
}

function dateText(input: unknown) {
  if (!input) return "-";
  const date = input instanceof Date ? input : new Date(String(input));
  return Number.isNaN(date.getTime()) ? "-" : date.toISOString().slice(0, 10);
}

function statusLabel(input: unknown) {
  const value = String(input ?? "").toUpperCase();
  const labels: Record<string, string> = {
    AVAILABLE: "متاحة",
    ASSIGNED: "مع مندوب",
    MAINTENANCE: "صيانة",
    ACCIDENT: "حادث",
    INACTIVE: "موقوفة",
    ACTIVE: "نشط",
    PENDING: "قيد المراجعة",
    APPROVED: "معتمد",
    REJECTED: "مرفوض",
    LOCKED: "مقفل",
  };
  return labels[value] ?? (value || "-");
}

function plate(vehicle: { plateAr?: string | null; plateArabic?: string | null; plateEn?: string | null; plateEnglish?: string | null; vehicleCode?: string | null; id: string }) {
  return vehicle.plateArabic || vehicle.plateAr || vehicle.plateEnglish || vehicle.plateEn || vehicle.vehicleCode || vehicle.id;
}

export default async function VehicleDetailsPage({ params }: PageProps) {
  const { id } = await params;
  const [vehicle, movements, cleanings, maintenance, authorizations, costs, accidents, damages] = await Promise.all([
    prisma.vehicle.findUnique({
      where: { id },
      include: {
        city: true,
        currentDriver: true,
        assignments: { include: { driver: true }, orderBy: { startDate: "desc" }, take: 20 },
        fuelRecords: { include: { driver: true }, orderBy: { fuelDate: "desc" }, take: 20 },
        violations: { include: { driver: true }, orderBy: { occurredAt: "desc" }, take: 20 },
      },
    }),
    prisma.vehicleMovement.findMany({ where: { vehicleId: id }, orderBy: { updatedAt: "desc" }, take: 20 }),
    prisma.vehicleCleaning.findMany({ where: { vehicleId: id }, orderBy: { cleanDate: "desc" }, take: 20 }),
    prisma.vehicleMaintenance.findMany({ where: { vehicleId: id }, orderBy: { date: "desc" }, take: 20 }),
    prisma.vehicleAuthorization.findMany({ where: { vehicleId: id }, orderBy: { updatedAt: "desc" }, take: 20 }),
    prisma.vehicleCost.findMany({ where: { vehicleId: id }, orderBy: { month: "desc" }, take: 20 }),
    prisma.vehicleAccident.findMany({ where: { vehicleId: id }, orderBy: { date: "desc" }, take: 20 }),
    prisma.vehicleDamage.findMany({ where: { vehicleId: id }, orderBy: { date: "desc" }, take: 20 }),
  ]);

  if (!vehicle) notFound();
  const vehiclePlate = plate(vehicle);

  return (
    <section className="space-y-4 text-right" dir="rtl">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black text-slate-500">
              <Link href="/vehicles">السيارات</Link> / تفاصيل السيارة
            </p>
            <h1 className="mt-1 text-3xl font-black text-slate-950">{vehiclePlate}</h1>
            <p className="mt-1 text-sm font-bold text-slate-500">{[vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(" ") || "لا توجد بيانات موديل"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/vehicle-movements" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white">حركة السيارات</Link>
            <Link href="/vehicle-cost" className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-black text-white">تكلفة السيارات</Link>
            <Link href="/vehicles" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700">رجوع</Link>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Info title="الحالة" value={statusLabel(vehicle.status)} />
        <Info title="المندوب الحالي" value={vehicle.currentDriver?.name} />
        <Info title="المدينة" value={vehicle.city?.nameAr || vehicle.city?.nameEn} />
        <Info title="الإيجار الشهري" value={money(vehicle.monthlyRent)} />
        <Info title="اللوحة عربي" value={vehicle.plateAr || vehicle.plateArabic} />
        <Info title="اللوحة إنجليزي" value={vehicle.plateEn || vehicle.plateEnglish} />
        <Info title="شركة التأجير" value={vehicle.rentalCompany} />
        <Info title="آخر تحديث" value={dateText(vehicle.updatedAt)} />
      </div>

      <Table title="سجل تسليم واستلام السيارة" headers={["المندوب", "من", "إلى", "أيام", "الإيجار", "الحالة"]}>
        {vehicle.assignments.map((row) => (
          <tr key={row.id}>
            <Cell>{row.driver.name}</Cell>
            <Cell>{dateText(row.startDate)}</Cell>
            <Cell>{dateText(row.endDate)}</Cell>
            <Cell>{row.rentalDays ?? "-"}</Cell>
            <Cell>{money(row.calculatedRent)}</Cell>
            <Cell>{statusLabel(row.status)}</Cell>
          </tr>
        ))}
      </Table>

      <Table title="حركة السيارة التشغيلية" headers={["نوع الحركة", "من مندوب", "إلى مندوب", "التسليم", "الاستلام", "الحالة", "ملاحظات"]}>
        {movements.map((row) => (
          <tr key={row.id}>
            <Cell>{row.movementType}</Cell>
            <Cell>{row.fromDriverId}</Cell>
            <Cell>{row.toDriverId}</Cell>
            <Cell>{dateText(row.handoverDate)}</Cell>
            <Cell>{dateText(row.returnDate)}</Cell>
            <Cell>{statusLabel(row.status)}</Cell>
            <Cell>{row.notes}</Cell>
          </tr>
        ))}
      </Table>

      <div className="grid gap-4 xl:grid-cols-2">
        <Table title="الصيانة والنظافة" headers={["النوع", "التاريخ", "التكلفة", "الحالة", "ملاحظات"]}>
          {maintenance.map((row) => (
            <tr key={`m-${row.id}`}>
              <Cell>{row.type || "صيانة"}</Cell>
              <Cell>{dateText(row.date)}</Cell>
              <Cell>{money(row.cost)}</Cell>
              <Cell>{statusLabel(row.status)}</Cell>
              <Cell>{row.vendor || row.notes}</Cell>
            </tr>
          ))}
          {cleanings.map((row) => (
            <tr key={`c-${row.id}`}>
              <Cell>نظافة</Cell>
              <Cell>{dateText(row.cleanDate)}</Cell>
              <Cell>{money(row.cost)}</Cell>
              <Cell>{statusLabel(row.status)}</Cell>
              <Cell>{row.notes}</Cell>
            </tr>
          ))}
        </Table>

        <Table title="التفويضات" headers={["رقم التفويض", "من تاريخ", "إلى تاريخ", "الحالة", "ملاحظات"]}>
          {authorizations.map((row) => (
            <tr key={row.id}>
              <Cell>{row.authNumber}</Cell>
              <Cell>{dateText(row.startDate)}</Cell>
              <Cell>{dateText(row.endDate)}</Cell>
              <Cell>{statusLabel(row.status)}</Cell>
              <Cell>{row.notes}</Cell>
            </tr>
          ))}
        </Table>
      </div>

      <Table title="التكلفة الشهرية" headers={["الشهر", "الإيجار", "الصيانة", "النظافة", "الحوادث", "التلفيات", "الإجمالي", "الحالة"]}>
        {costs.map((row) => (
          <tr key={row.id}>
            <Cell>{row.month}</Cell>
            <Cell>{money(row.rentCost)}</Cell>
            <Cell>{money(row.maintenanceCost)}</Cell>
            <Cell>{money(row.cleaningCost)}</Cell>
            <Cell>{money(row.accidentCost)}</Cell>
            <Cell>{money(row.damageCost)}</Cell>
            <Cell>{money(row.totalCost)}</Cell>
            <Cell>{statusLabel(row.status)}</Cell>
          </tr>
        ))}
      </Table>

      <div className="grid gap-4 xl:grid-cols-2">
        <Table title="الحوادث والتلفيات" headers={["النوع", "التاريخ", "التكلفة", "الحالة", "ملاحظات"]}>
          {accidents.map((row) => (
            <tr key={`a-${row.id}`}>
              <Cell>{row.type || "حادث"}</Cell>
              <Cell>{dateText(row.date)}</Cell>
              <Cell>{money(row.cost)}</Cell>
              <Cell>{statusLabel(row.status)}</Cell>
              <Cell>{row.notes}</Cell>
            </tr>
          ))}
          {damages.map((row) => (
            <tr key={`d-${row.id}`}>
              <Cell>{row.type}</Cell>
              <Cell>{dateText(row.date)}</Cell>
              <Cell>{money(row.finalCost || row.estimatedCost)}</Cell>
              <Cell>{statusLabel(row.status)}</Cell>
              <Cell>{row.notes}</Cell>
            </tr>
          ))}
        </Table>

        <Table title="المخالفات والبنزين" headers={["النوع", "المندوب", "التاريخ", "القيمة", "الحالة"]}>
          {vehicle.violations.map((row) => (
            <tr key={`v-${row.id}`}>
              <Cell>{row.type}</Cell>
              <Cell>{row.driver.name}</Cell>
              <Cell>{dateText(row.occurredAt)}</Cell>
              <Cell>{money(row.amount)}</Cell>
              <Cell>{statusLabel(row.status)}</Cell>
            </tr>
          ))}
          {vehicle.fuelRecords.map((row) => (
            <tr key={`f-${row.id}`}>
              <Cell>بنزين</Cell>
              <Cell>{row.driver.name}</Cell>
              <Cell>{dateText(row.fuelDate)}</Cell>
              <Cell>{money(row.amount)}</Cell>
              <Cell>{statusLabel(row.status)}</Cell>
            </tr>
          ))}
        </Table>
      </div>
    </section>
  );
}

function Info({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-black text-slate-500">{title}</p>
      <strong className="mt-1 block text-lg font-black text-slate-950">{value ? String(value) : "-"}</strong>
    </div>
  );
}

function Table({ title, headers, children }: { title: string; headers: string[]; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-black text-slate-950">{title}</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-right text-sm">
          <thead className="bg-slate-100 text-xs font-black text-slate-600">
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
