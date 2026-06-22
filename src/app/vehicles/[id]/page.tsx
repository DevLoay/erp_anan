import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { VehiclePrintButton } from "@/components/vehicles/VehiclePrintButton";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

function money(input: unknown) {
  const number = Number(input ?? 0);
  return Number.isFinite(number) && number
    ? new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(number)
    : "-";
}

function dateText(input: unknown) {
  if (!input) return "-";
  const date = input instanceof Date ? input : new Date(String(input));
  return Number.isNaN(date.getTime()) ? "-" : date.toISOString().slice(0, 10);
}


function daysUntil(input: unknown) {
  if (!input) return null;
  const target = input instanceof Date ? input : new Date(String(input));
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function text(input: unknown) {
  const value = String(input ?? "").trim();
  return value || "-";
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
    CANCELLED: "ملغي",
    DEDUCTED: "مخصوم",
    PARTIALLY_DEDUCTED: "مخصوم جزئيًا",
  };
  return labels[value] ?? (value || "-");
}

function statusClass(input: unknown) {
  const value = String(input ?? "").toUpperCase();
  if (["AVAILABLE", "ACTIVE", "APPROVED"].includes(value)) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (["ASSIGNED"].includes(value)) return "border-blue-200 bg-blue-50 text-blue-700";
  if (["MAINTENANCE", "PENDING", "PARTIALLY_DEDUCTED"].includes(value)) return "border-amber-200 bg-amber-50 text-amber-700";
  if (["ACCIDENT", "REJECTED", "INACTIVE", "CANCELLED"].includes(value)) return "border-red-200 bg-red-50 text-red-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function plate(vehicle: { plateAr?: string | null; plateArabic?: string | null; plateEn?: string | null; plateEnglish?: string | null; vehicleCode?: string | null; id: string }) {
  return vehicle.plateArabic || vehicle.plateAr || vehicle.plateEnglish || vehicle.plateEn || vehicle.vehicleCode || vehicle.id;
}

function attachmentCount(input: unknown) {
  if (Array.isArray(input)) return input.length;
  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input);
      return Array.isArray(parsed) ? parsed.length : input.trim() ? 1 : 0;
    } catch {
      return input.trim() ? 1 : 0;
    }
  }
  return 0;
}

export default async function VehicleDetailsPage({ params }: PageProps) {
  const { id } = await params;

  const [vehicle, movements, cleanings, maintenance, authorizations, costs, accidents, damages] = await Promise.all([
    prisma.vehicle.findUnique({
      where: { id },
      include: {
        city: true,
        currentDriver: true,
        assignments: { orderBy: { startDate: "desc" }, take: 30 },
        fuelRecords: { orderBy: { fuelDate: "desc" }, take: 30 },
        violations: { orderBy: { occurredAt: "desc" }, take: 30 },
      },
    }),
    prisma.vehicleMovement.findMany({ where: { vehicleId: id }, orderBy: { updatedAt: "desc" }, take: 30 }),
    prisma.vehicleCleaning.findMany({ where: { vehicleId: id }, orderBy: { cleanDate: "desc" }, take: 30 }),
    prisma.vehicleMaintenance.findMany({ where: { vehicleId: id }, orderBy: { date: "desc" }, take: 30 }),
    prisma.vehicleAuthorization.findMany({ where: { vehicleId: id }, orderBy: { updatedAt: "desc" }, take: 30 }),
    prisma.vehicleCost.findMany({ where: { vehicleId: id }, orderBy: { month: "desc" }, take: 30 }),
    prisma.vehicleAccident.findMany({ where: { vehicleId: id }, orderBy: { date: "desc" }, take: 30 }),
    prisma.vehicleDamage.findMany({ where: { vehicleId: id }, orderBy: { date: "desc" }, take: 30 }),
  ]);

  if (!vehicle) notFound();

  const relatedDriverIds = Array.from(
    new Set(
      [
        ...vehicle.assignments.map((row) => row.driverId),
        ...vehicle.fuelRecords.map((row) => row.driverId),
        ...vehicle.violations.map((row) => row.driverId),
        ...movements.map((row) => row.fromDriverId),
        ...movements.map((row) => row.toDriverId),
        ...cleanings.map((row) => row.driverId),
        ...maintenance.map((row) => row.driverId),
        ...authorizations.map((row) => row.driverId),
        ...accidents.map((row) => row.driverId),
        ...damages.map((row) => row.driverId),
      ]
        .filter(Boolean)
        .map(String),
    ),
  );

  const drivers = relatedDriverIds.length
    ? await prisma.driver.findMany({
        where: { id: { in: relatedDriverIds } },
        select: { id: true, name: true, actualName: true, driverCode: true, internalCode: true },
      })
    : [];

  const driverMap = new Map(drivers.map((driver) => [driver.id, driver.name || driver.actualName || driver.driverCode || driver.internalCode || driver.id]));
  const driverName = (driverId: unknown) => {
    const value = driverId ? String(driverId) : "";
    return value ? driverMap.get(value) || "مندوب محذوف / غير موجود" : "-";
  };

  const vehiclePlate = plate(vehicle);
  const vehicleModel = [vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(" ") || "لا توجد بيانات موديل";
  const totalCosts = costs.reduce((sum, row) => sum + Number(row.totalCost ?? 0), 0);
  const totalRent = costs.reduce((sum, row) => sum + Number(row.rentCost ?? 0), 0);
  const openAccidents = accidents.filter((row) => !["APPROVED", "LOCKED", "CANCELLED"].includes(String(row.status))).length;
  const latestAuth = authorizations[0];
  const latestMovement = movements[0];
  const authorizationDaysLeft = latestAuth ? daysUntil(latestAuth.endDate) : null;
  const operationalWarnings = [
    !vehicle.currentDriverId ? "السيارة غير مربوطة بمندوب حاليًا." : "",
    !vehicle.cityId ? "لا توجد مدينة مرتبطة بالسيارة." : "",
    ["MAINTENANCE", "ACCIDENT", "INACTIVE"].includes(String(vehicle.status).toUpperCase()) ? `حالة السيارة تحتاج متابعة: ${statusLabel(vehicle.status)}.` : "",
    openAccidents > 0 ? `يوجد ${openAccidents} حادث مفتوح يحتاج إغلاق أو اعتماد.` : "",
    authorizationDaysLeft !== null && authorizationDaysLeft < 0 ? "آخر تفويض مسجل منتهي الصلاحية." : "",
    authorizationDaysLeft !== null && authorizationDaysLeft >= 0 && authorizationDaysLeft <= 7 ? `التفويض الحالي ينتهي خلال ${authorizationDaysLeft} يوم.` : "",
  ].filter(Boolean);

  return (
    <section className="space-y-5 text-right print:space-y-3" dir="rtl">
      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black text-blue-600">ملف السيارة</p>
            <h1 className="mt-1 text-3xl font-black text-slate-950">{vehiclePlate}</h1>
            <p className="mt-1 text-sm font-bold text-slate-500">{vehicleModel}</p>
          </div>
          <div className="flex max-w-4xl flex-wrap gap-2 print:hidden">
            <Link href={`/vehicle-movements?vehicleId=${vehicle.id}&openCreate=1`} className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-blue-700">تسجيل حركة</Link>
            <Link href={`/vehicle-maintenance?vehicleId=${vehicle.id}&openCreate=1`} className="rounded-2xl bg-amber-500 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-amber-600">إضافة صيانة</Link>
            <Link href={`/authorizations?vehicleId=${vehicle.id}&openCreate=1`} className="rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-indigo-700">إضافة تفويض</Link>
            <Link href={`/vehicle-accidents?vehicleId=${vehicle.id}&openCreate=1`} className="rounded-2xl bg-red-600 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-red-700">إضافة حادث</Link>
            <Link href={`/vehicle-damages?vehicleId=${vehicle.id}&openCreate=1`} className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-black text-red-700 shadow-sm hover:bg-red-100">إضافة تلفيات</Link>
            <Link href={`/vehicle-cleaning?vehicleId=${vehicle.id}&openCreate=1`} className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700 shadow-sm hover:bg-emerald-100">تسجيل نظافة</Link>
            <Link href={`/vehicle-violations?vehicleId=${vehicle.id}&openCreate=1`} className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-black text-orange-700 shadow-sm hover:bg-orange-100">تسجيل مخالفة</Link>
            <Link href={`/vehicle-deductions?vehicleId=${vehicle.id}&openCreate=1`} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800 shadow-sm hover:bg-slate-50">تسجيل خصم</Link>
            <VehiclePrintButton />
            <Link href="/vehicles" className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800 shadow-sm hover:bg-slate-50">رجوع</Link>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Info title="الحالة" value={statusLabel(vehicle.status)} badgeClass={statusClass(vehicle.status)} />
        <Info title="المندوب الحالي" value={vehicle.currentDriver?.name || vehicle.currentDriver?.actualName} />
        <Info title="المدينة" value={vehicle.city?.nameAr || vehicle.city?.nameEn} />
        <Info title="شركة التأجير" value={vehicle.rentalCompany} />
        <Info title="الإيجار اليومي" value={money(vehicle.dailyRent)} />
        <Info title="الإيجار الشهري" value={money(vehicle.monthlyRent)} />
        <Info title="آخر حركة" value={latestMovement ? `${text(latestMovement.movementType)} - ${dateText(latestMovement.updatedAt)}` : "-"} />
        <Info title="آخر تفويض" value={latestAuth ? `${dateText(latestAuth.startDate)} - ${dateText(latestAuth.endDate)}` : "-"} />
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Metric title="إجمالي التكاليف" value={money(totalCosts)} />
        <Metric title="إيجارات محسوبة" value={money(totalRent)} />
        <Metric title="حوادث مفتوحة" value={String(openAccidents)} tone={openAccidents ? "red" : "emerald"} />
        <Metric title="عدد الحركات" value={String(movements.length)} tone="blue" />
      </div>

      <div className={`rounded-2xl border p-4 shadow-sm ${operationalWarnings.length ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className={`text-base font-black ${operationalWarnings.length ? "text-amber-900" : "text-emerald-900"}`}>لوحة متابعة السيارة</h2>
            <p className={`mt-1 text-xs font-bold ${operationalWarnings.length ? "text-amber-700" : "text-emerald-700"}`}>
              {operationalWarnings.length ? "راجع التنبيهات قبل أي تسليم أو تفويض جديد." : "لا توجد تنبيهات تشغيلية واضحة على هذه السيارة."}
            </p>
          </div>
          <div className="grid flex-1 gap-2 sm:grid-cols-2 lg:max-w-3xl">
            {operationalWarnings.length ? operationalWarnings.map((warning) => (
              <div key={warning} className="rounded-2xl bg-white/80 px-3 py-2 text-sm font-black text-amber-800">• {warning}</div>
            )) : (
              <div className="rounded-2xl bg-white/80 px-3 py-2 text-sm font-black text-emerald-800">السيارة جاهزة للمتابعة من خلال الإجراءات السريعة.</div>
            )}
          </div>
        </div>
      </div>

      <div className="sticky top-2 z-10 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-sm backdrop-blur print:hidden">
        <div className="flex flex-wrap gap-2 text-xs font-black">
          <Anchor href="#overview">الملخص</Anchor>
          <Anchor href="#assignments">التسليم والاستلام</Anchor>
          <Anchor href="#movements">الحركة</Anchor>
          <Anchor href="#maintenance">الصيانة والنظافة</Anchor>
          <Anchor href="#authorizations">التفويضات</Anchor>
          <Anchor href="#finance">المالية</Anchor>
          <Anchor href="#incidents">الحوادث والتلفيات</Anchor>
          <Anchor href="#violations">المخالفات والبنزين</Anchor>
        </div>
      </div>

      <div id="overview" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm scroll-mt-20">
        <h2 className="text-lg font-black text-slate-950">بيانات السيارة الأساسية</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Info title="كود السيارة" value={vehicle.vehicleCode} />
          <Info title="اللوحة عربي" value={vehicle.plateAr || vehicle.plateArabic} />
          <Info title="اللوحة إنجليزي" value={vehicle.plateEn || vehicle.plateEnglish} />
          <Info title="نوع الملكية" value={vehicle.ownershipType} />
          <Info title="الماركة" value={vehicle.brand} />
          <Info title="الموديل" value={vehicle.model} />
          <Info title="سنة الصنع" value={vehicle.year} />
          <Info title="آخر تحديث" value={dateText(vehicle.updatedAt)} />
        </div>
      </div>

      <Table id="assignments" title="سجل تسليم واستلام السيارة" headers={["المندوب", "من", "إلى", "أيام", "الإيجار", "الحالة"]} empty={vehicle.assignments.length === 0}>
        {vehicle.assignments.map((row) => (
          <tr key={row.id}>
            <Cell>{driverName(row.driverId)}</Cell>
            <Cell>{dateText(row.startDate)}</Cell>
            <Cell>{dateText(row.endDate)}</Cell>
            <Cell>{row.rentalDays ?? "-"}</Cell>
            <Cell>{money(row.calculatedRent)}</Cell>
            <Cell><Badge value={statusLabel(row.status)} className={statusClass(row.status)} /></Cell>
          </tr>
        ))}
      </Table>

      <Table id="movements" title="حركة السيارة التشغيلية" headers={["نوع الحركة", "من مندوب", "إلى مندوب", "التسليم", "الاستلام", "الحالة", "ملاحظات"]} empty={movements.length === 0}>
        {movements.map((row) => (
          <tr key={row.id}>
            <Cell>{row.movementType}</Cell>
            <Cell>{driverName(row.fromDriverId)}</Cell>
            <Cell>{driverName(row.toDriverId)}</Cell>
            <Cell>{dateText(row.handoverDate)}</Cell>
            <Cell>{dateText(row.returnDate)}</Cell>
            <Cell><Badge value={statusLabel(row.status)} className={statusClass(row.status)} /></Cell>
            <Cell>{row.notes}</Cell>
          </tr>
        ))}
      </Table>

      <div id="maintenance" className="grid gap-4 xl:grid-cols-2 scroll-mt-20">
        <Table title="الصيانة" headers={["النوع", "المندوب", "التاريخ", "الورشة", "التكلفة", "الحالة"]} empty={maintenance.length === 0}>
          {maintenance.map((row) => (
            <tr key={row.id}>
              <Cell>{row.type || "صيانة"}</Cell>
              <Cell>{driverName(row.driverId)}</Cell>
              <Cell>{dateText(row.date)}</Cell>
              <Cell>{row.vendor}</Cell>
              <Cell>{money(row.cost)}</Cell>
              <Cell><Badge value={statusLabel(row.status)} className={statusClass(row.status)} /></Cell>
            </tr>
          ))}
        </Table>
        <Table title="النظافة" headers={["المندوب", "التاريخ", "التكلفة", "صور", "الحالة", "ملاحظات"]} empty={cleanings.length === 0}>
          {cleanings.map((row) => (
            <tr key={row.id}>
              <Cell>{driverName(row.driverId)}</Cell>
              <Cell>{dateText(row.cleanDate)}</Cell>
              <Cell>{money(row.cost)}</Cell>
              <Cell>{attachmentCount(row.attachments)}</Cell>
              <Cell><Badge value={statusLabel(row.status)} className={statusClass(row.status)} /></Cell>
              <Cell>{row.notes}</Cell>
            </tr>
          ))}
        </Table>
      </div>

      <Table id="authorizations" title="التفويضات" headers={["المندوب", "رقم التفويض", "من تاريخ", "إلى تاريخ", "الحالة", "ملاحظات"]} empty={authorizations.length === 0}>
        {authorizations.map((row) => (
          <tr key={row.id}>
            <Cell>{driverName(row.driverId)}</Cell>
            <Cell>{row.authNumber}</Cell>
            <Cell>{dateText(row.startDate)}</Cell>
            <Cell>{dateText(row.endDate)}</Cell>
            <Cell><Badge value={statusLabel(row.status)} className={statusClass(row.status)} /></Cell>
            <Cell>{row.notes}</Cell>
          </tr>
        ))}
      </Table>

      <Table id="finance" title="التكلفة الشهرية" headers={["الشهر", "الإيجار", "الصيانة", "النظافة", "الحوادث", "التلفيات", "أخرى", "الإجمالي", "الحالة"]} empty={costs.length === 0}>
        {costs.map((row) => (
          <tr key={row.id}>
            <Cell>{row.month}</Cell>
            <Cell>{money(row.rentCost)}</Cell>
            <Cell>{money(row.maintenanceCost)}</Cell>
            <Cell>{money(row.cleaningCost)}</Cell>
            <Cell>{money(row.accidentCost)}</Cell>
            <Cell>{money(row.damageCost)}</Cell>
            <Cell>{money(row.otherCost)}</Cell>
            <Cell>{money(row.totalCost)}</Cell>
            <Cell><Badge value={statusLabel(row.status)} className={statusClass(row.status)} /></Cell>
          </tr>
        ))}
      </Table>

      <div id="incidents" className="grid gap-4 xl:grid-cols-2 scroll-mt-20">
        <Table title="الحوادث" headers={["النوع", "المندوب", "التاريخ", "التكلفة", "المسؤولية", "مرفقات", "الحالة"]} empty={accidents.length === 0}>
          {accidents.map((row) => (
            <tr key={row.id}>
              <Cell>{row.type || "حادث"}</Cell>
              <Cell>{driverName(row.driverId)}</Cell>
              <Cell>{dateText(row.date)}</Cell>
              <Cell>{money(row.cost)}</Cell>
              <Cell>{Number(row.liabilityPercent ?? 0)}%</Cell>
              <Cell>{attachmentCount(row.attachments)}</Cell>
              <Cell><Badge value={statusLabel(row.status)} className={statusClass(row.status)} /></Cell>
            </tr>
          ))}
        </Table>
        <Table title="التلفيات" headers={["النوع", "المندوب", "التاريخ", "تقديري", "نهائي", "مرفقات", "الحالة"]} empty={damages.length === 0}>
          {damages.map((row) => (
            <tr key={row.id}>
              <Cell>{row.type}</Cell>
              <Cell>{driverName(row.driverId)}</Cell>
              <Cell>{dateText(row.date)}</Cell>
              <Cell>{money(row.estimatedCost)}</Cell>
              <Cell>{money(row.finalCost)}</Cell>
              <Cell>{attachmentCount(row.attachments)}</Cell>
              <Cell><Badge value={statusLabel(row.status)} className={statusClass(row.status)} /></Cell>
            </tr>
          ))}
        </Table>
      </div>

      <Table id="violations" title="المخالفات والبنزين" headers={["النوع", "المندوب", "التاريخ", "القيمة", "الحالة"]} empty={vehicle.violations.length + vehicle.fuelRecords.length === 0}>
        {vehicle.violations.map((row) => (
          <tr key={`v-${row.id}`}>
            <Cell>{row.type}</Cell>
            <Cell>{driverName(row.driverId)}</Cell>
            <Cell>{dateText(row.occurredAt)}</Cell>
            <Cell>{money(row.amount)}</Cell>
            <Cell><Badge value={statusLabel(row.status)} className={statusClass(row.status)} /></Cell>
          </tr>
        ))}
        {vehicle.fuelRecords.map((row) => (
          <tr key={`f-${row.id}`}>
            <Cell>بنزين</Cell>
            <Cell>{driverName(row.driverId)}</Cell>
            <Cell>{dateText(row.fuelDate)}</Cell>
            <Cell>{money(row.amount)}</Cell>
            <Cell><Badge value={statusLabel(row.status)} className={statusClass(row.status)} /></Cell>
          </tr>
        ))}
      </Table>
    </section>
  );
}

function Anchor({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700 hover:bg-slate-100">{children}</a>;
}

function Badge({ value, className }: { value: unknown; className?: string }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${className ?? "border-slate-200 bg-slate-50 text-slate-700"}`}>{text(value)}</span>;
}

function Info({ title, value, badgeClass }: { title: string; value: unknown; badgeClass?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-black text-slate-500">{title}</p>
      {badgeClass ? <div className="mt-2"><Badge value={value} className={badgeClass} /></div> : <strong className="mt-1 block text-lg font-black text-slate-950">{text(value)}</strong>}
    </div>
  );
}

function Metric({ title, value, tone = "slate" }: { title: string; value: string; tone?: "slate" | "emerald" | "amber" | "red" | "blue" }) {
  const toneClass: Record<string, string> = {
    slate: "border-slate-200 bg-white text-slate-950",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    red: "border-red-200 bg-red-50 text-red-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
  };
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${toneClass[tone]}`}>
      <p className="text-xs font-black opacity-70">{title}</p>
      <strong className="mt-2 block text-2xl font-black">{value}</strong>
    </div>
  );
}

function Table({ id, title, headers, children, empty }: { id?: string; title: string; headers: string[]; children: ReactNode; empty?: boolean }) {
  return (
    <section id={id} className="scroll-mt-20 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:break-inside-avoid print:p-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-black text-slate-950">{title}</h2>
        {empty ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">لا توجد سجلات</span> : null}
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-right text-sm">
          <thead className="bg-slate-100 text-xs font-black text-slate-600">
            <tr>{headers.map((header) => <th key={header} className="whitespace-nowrap px-3 py-2">{header}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {empty ? (
              <tr>
                <td colSpan={headers.length} className="px-3 py-8 text-center text-sm font-bold text-slate-400">لا توجد بيانات في هذا القسم</td>
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
