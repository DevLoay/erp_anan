import Link from "next/link";
import { notFound } from "next/navigation";
import { DriverStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getProjectWorkspace } from "@/lib/projects/projectWorkspace";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ projectId: string }>;
};

function statusLabel(status: DriverStatus | string) {
  const labels: Record<string, string> = {
    ACTIVE: "نشط",
    INACTIVE: "غير نشط",
    SUSPENDED: "موقوف",
    TERMINATED: "خارج الخدمة",
  };
  return labels[String(status)] ?? String(status);
}

export default async function ProjectDriversPage({ params }: PageProps) {
  const { projectId } = await params;
  const workspace = await getProjectWorkspace(projectId);
  if (workspace.status !== "online" || !workspace.project) notFound();

  const drivers = await prisma.driver.findMany({
    where: {
      OR: [
        { applicationAccounts: { some: { applicationProjectId: workspace.project.id } } },
        ...(!workspace.project.cityId ? [{ applicationAccounts: { some: { applicationId: workspace.project.applicationId } } }] : []),
      ],
      ...(workspace.project.cityId ? { cityId: workspace.project.cityId } : {}),
    },
    include: {
      city: true,
      project: true,
      supervisor: true,
      vehicle: true,
      applicationAccounts: { where: { applicationProjectId: workspace.project.id }, take: 3 },
    },
    orderBy: [{ status: "asc" }, { actualName: "asc" }, { name: "asc" }],
    take: 800,
  });

  const active = drivers.filter((driver) => driver.status === DriverStatus.ACTIVE).length;
  const withoutAccount = drivers.filter((driver) => !driver.applicationAccounts.length).length;
  const withoutVehicle = drivers.filter((driver) => !driver.vehicleId && !driver.vehicle).length;

  return (
    <section className="space-y-5" dir="rtl">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <nav className="mb-2 text-xs font-black text-slate-500">
          <Link href="/projects">المشاريع</Link> / <Link href={`/projects/${workspace.project.routeId}/dashboard`}>{workspace.project.name}</Link> / المناديب
        </nav>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black text-slate-950">مناديب {workspace.project.name}</h1>
            <p className="mt-2 text-sm font-bold text-slate-500">مناديب المشروع فقط حسب projectId و cityId، بدون خلط مع أي مشروع آخر.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/projects/${workspace.project.routeId}/imports`} className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-black text-white">استيراد مناديب</Link>
            <Link href={`/projects/${workspace.project.routeId}/accounts`} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white">حسابات التطبيق</Link>
            <Link href={`/projects/${workspace.project.routeId}/dashboard`} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700">رجوع للمشروع</Link>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Stat title="إجمالي المناديب" value={drivers.length} />
        <Stat title="نشط" value={active} tone="emerald" />
        <Stat title="بدون حساب تطبيق" value={withoutAccount} tone={withoutAccount ? "amber" : "emerald"} />
        <Stat title="بدون سيارة" value={withoutVehicle} tone={withoutVehicle ? "amber" : "emerald"} />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <table className="min-w-full text-right text-sm">
          <thead className="bg-slate-50 text-xs font-black text-slate-500">
            <tr>
              {["كود المندوب", "الاسم", "الهوية", "الجوال", "المدينة", "المشرف", "الحسابات", "نوع السيارة", "اللوحة", "الحالة", "إجراءات"].map((header, index) => (
                <th key={`${header}-${index}`} className="whitespace-nowrap px-3 py-2">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {drivers.map((driver) => (
              <tr key={driver.id} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-3 py-3 font-black">{driver.internalCode || driver.driverCode || "-"}</td>
                <td className="whitespace-nowrap px-3 py-3 font-black">{driver.actualName || driver.name}</td>
                <td className="whitespace-nowrap px-3 py-3 font-bold">{driver.nationalId || "-"}</td>
                <td className="whitespace-nowrap px-3 py-3 font-bold">{driver.mobile || driver.phone || "-"}</td>
                <td className="whitespace-nowrap px-3 py-3 font-bold">{driver.city?.nameAr || driver.city?.nameEn || "-"}</td>
                <td className="whitespace-nowrap px-3 py-3 font-bold">{driver.supervisor?.name || "-"}</td>
                <td className="whitespace-nowrap px-3 py-3 font-bold">{driver.applicationAccounts.map((account) => account.appUserId || account.appUsername || account.username).filter(Boolean).join("، ") || "-"}</td>
                <td className="whitespace-nowrap px-3 py-3 font-bold">{driver.vehicleOwnershipType || "-"}</td>
                <td className="whitespace-nowrap px-3 py-3 font-bold">{driver.vehicle?.plateArabic || driver.vehicle?.plateEnglish || "-"}</td>
                <td className="whitespace-nowrap px-3 py-3 font-bold">{statusLabel(driver.status)}</td>
                <td className="whitespace-nowrap px-3 py-3">
                  <Link href={`/drivers/${driver.id}`} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-800">فتح</Link>
                </td>
              </tr>
            ))}
            {!drivers.length ? (
              <tr>
                <td colSpan={11} className="px-3 py-10 text-center font-bold text-slate-500">لا توجد بيانات مناديب معتمدة لهذا المشروع حتى الآن.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Stat({ title, value, tone = "slate" }: { title: string; value: number; tone?: "slate" | "amber" | "emerald" }) {
  const classes = {
    slate: "border-slate-200 bg-white text-slate-950",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
  };
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${classes[tone]}`}>
      <p className="text-xs font-black opacity-70">{title}</p>
      <strong className="mt-1 block text-2xl font-black">{value}</strong>
    </div>
  );
}
