import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { redirectLegacyProjectSlug } from "@/lib/projects/legacyProjectRedirect";
import { getProjectWorkspace } from "@/lib/projects/projectWorkspace";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProjectAccountsPage({ params, searchParams }: PageProps) {
  const [{ projectId }, query] = await Promise.all([params, searchParams]);
  redirectLegacyProjectSlug(projectId, query);
  const workspace = await getProjectWorkspace(projectId);
  if (workspace.status !== "online" || !workspace.project) notFound();
  const project = workspace.project;

  const accounts = await prisma.applicationAccount.findMany({
    where: {
      OR: [
        { applicationProjectId: project.id },
        ...(!project.cityId ? [{ applicationId: project.applicationId }] : []),
      ],
      ...(project.cityId ? { cityId: project.cityId } : {}),
    },
    include: { driver: { include: { supervisor: true, city: true, project: true } }, city: true },
    orderBy: [{ isEmpty: "asc" }, { updatedAt: "desc" }],
    take: 500,
  });

  const linked = accounts.filter((account) => account.driverId).length;
  const empty = accounts.length - linked;

  return (
    <section className="space-y-5" dir="rtl">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <nav className="mb-2 text-xs font-black text-slate-500">
          <Link href="/projects">المشاريع</Link> / <Link href={`/projects/${projectId}/dashboard`}>{project.name}</Link> / الحسابات
        </nav>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black text-slate-950">حسابات {project.name}</h1>
            <p className="mt-2 text-sm font-bold text-slate-500">حسابات التطبيق المرتبطة بالمشروع فقط، بدون خلط مع مشاريع أخرى.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/projects/${projectId}/imports`} className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-black text-white">استيراد حسابات</Link>
            <Link href={`/projects/${projectId}/dashboard`} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700">رجوع للمشروع</Link>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Stat title="إجمالي الحسابات" value={accounts.length} />
        <Stat title="حسابات مربوطة بمناديب" value={linked} />
        <Stat title="حسابات غير مربوطة" value={empty} tone={empty ? "amber" : "emerald"} />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <table className="min-w-full text-right text-sm">
          <thead className="bg-slate-50 text-xs font-black text-slate-500">
            <tr>
              {["App User ID", "اسم الحساب", "المندوب", "كود المندوب", "المدينة", "المشرف", "الحالة", "تاريخ الربط"].map((header) => (
                <th key={header} className="whitespace-nowrap px-3 py-2">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {accounts.map((account) => (
              <tr key={account.id} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-3 py-3 font-bold">{account.appUserId || account.username}</td>
                <td className="whitespace-nowrap px-3 py-3 font-bold">{account.appUsername || account.username}</td>
                <td className="whitespace-nowrap px-3 py-3 font-bold">{account.driver ? <Link href={`/drivers/${account.driver.id}`}>{account.driver.name}</Link> : "-"}</td>
                <td className="whitespace-nowrap px-3 py-3 font-bold">{account.driver?.internalCode || account.driver?.driverCode || "-"}</td>
                <td className="whitespace-nowrap px-3 py-3 font-bold">{account.city?.nameAr || account.driver?.city?.nameAr || "-"}</td>
                <td className="whitespace-nowrap px-3 py-3 font-bold">{account.driver?.supervisor?.name || "-"}</td>
                <td className="whitespace-nowrap px-3 py-3 font-bold">{account.status}</td>
                <td className="whitespace-nowrap px-3 py-3 font-bold">{account.linkedAt?.toISOString().slice(0, 10) || "-"}</td>
              </tr>
            ))}
            {!accounts.length ? (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center font-bold text-slate-500">لا توجد حسابات مرتبطة بهذا المشروع.</td>
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
