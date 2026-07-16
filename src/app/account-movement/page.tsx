import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { PageShell } from "@/components/ui/PageShell";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type MovementAlert = {
  key: string;
  applicationProjectId: string;
  applicationProjectName: string;
  cityName: string;
  appName: string;
  appUserId: string;
  appUsername: string;
  month: string;
  drivers: string[];
  sources: string[];
  severity: "warning" | "danger";
  reason: string;
};

function one(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function whereAccounts(params: Record<string, string | string[] | undefined>): Prisma.ApplicationAccountWhereInput {
  const applicationProjectId = one(params, "applicationProjectId");
  const applicationId = one(params, "applicationId");
  const cityId = one(params, "cityId");
  const q = one(params, "q").trim();

  const where: Prisma.ApplicationAccountWhereInput = {};
  if (applicationProjectId) where.applicationProjectId = applicationProjectId;
  if (applicationId) where.applicationId = applicationId;
  if (cityId) where.cityId = cityId;
  if (q) {
    where.OR = [
      { appName: { contains: q, mode: "insensitive" as const } },
      { appUserId: { contains: q, mode: "insensitive" as const } },
      { appUsername: { contains: q, mode: "insensitive" as const } },
      { username: { contains: q, mode: "insensitive" as const } },
      { driver: { actualName: { contains: q, mode: "insensitive" as const } } },
      { driver: { name: { contains: q, mode: "insensitive" as const } } },
      { driver: { internalCode: { contains: q, mode: "insensitive" as const } } },
    ];
  }
  return where;
}

function sourceWhere(params: Record<string, string | string[] | undefined>) {
  const applicationProjectId = one(params, "applicationProjectId");
  const cityId = one(params, "cityId");
  const month = one(params, "month");
  return {
    ...(applicationProjectId ? { applicationProjectId } : {}),
    ...(cityId ? { cityId } : {}),
    ...(month ? { month } : {}),
  };
}

function statusBadge(severity: MovementAlert["severity"]) {
  if (severity === "danger") return "bg-rose-50 text-rose-700";
  return "bg-amber-50 text-amber-800";
}

function makeFilterLink(params: Record<string, string | string[] | undefined>, extra: Record<string, string>) {
  const query = new URLSearchParams();
  for (const key of ["applicationProjectId", "applicationId", "cityId", "month", "q"]) {
    const value = one(params, key);
    if (value) query.set(key, value);
  }
  for (const [key, value] of Object.entries(extra)) {
    if (value) query.set(key, value);
  }
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

function driverLabel(driver: { name?: string | null; actualName?: string | null; internalCode?: string | null } | null | undefined) {
  return driver ? `${driver.actualName || driver.name || "مندوب"} (${driver.internalCode || "بدون كود"})` : "بدون مندوب فعلي";
}

async function getData(params: Record<string, string | string[] | undefined>) {
  const [accounts, rankRecords, performanceRecords, invoiceRecords, hsDailyRecords, hsInvoiceRecords, hsUsages, movements, projects, cities] = await Promise.all([
    prisma.applicationAccount.findMany({
      where: whereAccounts(params),
      include: {
        application: { select: { id: true, name: true, code: true } },
        applicationProject: { select: { id: true, name: true, code: true } },
        city: { select: { id: true, nameAr: true, nameEn: true } },
        driver: { select: { id: true, name: true, actualName: true, internalCode: true } },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 500,
    }),
    prisma.keetaRankRecord.findMany({
      where: sourceWhere(params),
      select: {
        applicationProjectId: true,
        courierId: true,
        courierName: true,
        driverId: true,
        month: true,
        applicationProject: { select: { name: true } },
        city: { select: { nameAr: true, nameEn: true } },
        driver: { select: { name: true, actualName: true, internalCode: true } },
      },
      take: 1000,
    }),
    prisma.keetaPerformanceRecord.findMany({
      where: sourceWhere(params),
      select: {
        applicationProjectId: true,
        courierId: true,
        courierFirstName: true,
        courierLastName: true,
        driverId: true,
        month: true,
        applicationProject: { select: { name: true } },
        city: { select: { nameAr: true, nameEn: true } },
        driver: { select: { name: true, actualName: true, internalCode: true } },
      },
      take: 1000,
    }),
    prisma.keetaInvoiceRecord.findMany({
      where: sourceWhere(params),
      select: {
        applicationProjectId: true,
        courierId: true,
        courierName: true,
        driverId: true,
        month: true,
        applicationProject: { select: { name: true } },
        city: { select: { nameAr: true, nameEn: true } },
        driver: { select: { name: true, actualName: true, internalCode: true } },
      },
      take: 1000,
    }),
    prisma.hungerStationDailyPerformanceRecord.findMany({
      where: sourceWhere(params),
      select: {
        applicationProjectId: true,
        riderIdFromFile: true,
        driverId: true,
        month: true,
        applicationProject: { select: { name: true } },
        city: { select: { nameAr: true, nameEn: true } },
        driver: { select: { name: true, actualName: true, internalCode: true } },
        applicationAccount: { select: { appUsername: true, username: true } },
      },
      take: 1500,
    }),
    prisma.hungerStationInvoiceRecord.findMany({
      where: sourceWhere(params),
      select: {
        applicationProjectId: true,
        riderIdFromFile: true,
        driverId: true,
        month: true,
        applicationProject: { select: { name: true } },
        city: { select: { nameAr: true, nameEn: true } },
        driver: { select: { name: true, actualName: true, internalCode: true } },
        applicationAccount: { select: { appUsername: true, username: true } },
      },
      take: 1500,
    }),
    prisma.hungerStationAccountUsage.findMany({
      where: sourceWhere(params),
      select: {
        applicationProjectId: true,
        riderIdFromFile: true,
        driverId: true,
        month: true,
        status: true,
        riskLevel: true,
        reviewReason: true,
        usageSource: true,
        applicationProject: { select: { name: true } },
        city: { select: { nameAr: true, nameEn: true } },
        driver: { select: { name: true, actualName: true, internalCode: true } },
        applicationAccount: { select: { appUsername: true, username: true } },
      },
      take: 1500,
    }),
    prisma.appAccountMovement.findMany({
      orderBy: [{ movementDate: "desc" }],
      take: 200,
    }),
    prisma.applicationProject.findMany({
      where: { cityId: { not: null }, application: { code: { in: ["KEETA", "HUNGERSTATION"] } } },
      include: { application: { select: { name: true } }, city: { select: { nameAr: true, nameEn: true } } },
      orderBy: [{ name: "asc" }],
    }),
    prisma.city.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ nameAr: "asc" }],
    }),
  ]);

  const alerts = new Map<string, MovementAlert>();
  const accountGroups = new Map<string, typeof accounts>();

  for (const account of accounts) {
    if (!account.appUserId || !account.applicationProjectId) continue;
    const key = `${account.applicationProjectId}:${account.cityId || "no-city"}:${account.appUserId}`;
    const current = accountGroups.get(key) ?? [];
    current.push(account);
    accountGroups.set(key, current);
  }

  for (const [key, rows] of accountGroups) {
    const drivers = new Set(rows.map((row) => row.driver?.id || "missing-driver"));
    if (rows.length > 1 || drivers.size > 1) {
      const first = rows[0];
      alerts.set(`account:${key}`, {
        key: `account:${key}`,
        applicationProjectId: first.applicationProjectId || "",
        applicationProjectName: first.applicationProject?.name || "-",
        cityName: first.city?.nameAr || first.city?.nameEn || "-",
        appName: first.application?.name || first.appName,
        appUserId: first.appUserId || "-",
        appUsername: first.appUsername || first.username || "-",
        month: "-",
        drivers: rows.map((row) => driverLabel(row.driver)),
        sources: ["ApplicationAccount"],
        severity: drivers.size > 1 ? "danger" : "warning",
        reason: drivers.size > 1 ? "نفس حساب التطبيق مرتبط بأكثر من مندوب" : "حساب تطبيق مكرر داخل نفس مشروع المدينة",
      });
    }
  }

  function pushSource(input: {
    source: string;
    appName: string;
    applicationProjectId: string | null;
    applicationProjectName?: string | null;
    cityName?: string | null;
    accountId: string;
    accountName?: string | null;
    driverName: string;
    month?: string | null;
    reason?: string | null;
    danger?: boolean;
  }) {
    if (!input.applicationProjectId || !input.accountId) return;
    const key = `source:${input.appName}:${input.applicationProjectId}:${input.month || "no-month"}:${input.accountId}`;
    const current = alerts.get(key) ?? {
      key,
      applicationProjectId: input.applicationProjectId,
      applicationProjectName: input.applicationProjectName || "-",
      cityName: input.cityName || "-",
      appName: input.appName,
      appUserId: input.accountId,
      appUsername: input.accountName || "-",
      month: input.month || "-",
      drivers: [] as string[],
      sources: [] as string[],
      severity: (input.danger ? "danger" : "warning") as MovementAlert["severity"],
      reason: input.reason || "حساب ظاهر في ملفات مختلفة ويحتاج مراجعة ربط",
    };
    current.drivers.push(input.driverName);
    current.sources.push(input.source);
    if (input.danger) current.severity = "danger";
    if (input.reason) current.reason = input.reason;
    alerts.set(key, current);
  }

  for (const row of rankRecords) {
    pushSource({
      source: "Keeta Rank",
      appName: "Keeta",
      applicationProjectId: row.applicationProjectId,
      applicationProjectName: row.applicationProject?.name,
      cityName: row.city?.nameAr || row.city?.nameEn,
      accountId: row.courierId,
      accountName: row.courierName,
      driverName: driverLabel(row.driver),
      month: row.month,
    });
  }
  for (const row of performanceRecords) {
    pushSource({
      source: "Keeta Period Report",
      appName: "Keeta",
      applicationProjectId: row.applicationProjectId,
      applicationProjectName: row.applicationProject?.name,
      cityName: row.city?.nameAr || row.city?.nameEn,
      accountId: row.courierId,
      accountName: `${row.courierFirstName || ""} ${row.courierLastName || ""}`.trim(),
      driverName: driverLabel(row.driver),
      month: row.month,
    });
  }
  for (const row of invoiceRecords) {
    pushSource({
      source: "Keeta Invoice",
      appName: "Keeta",
      applicationProjectId: row.applicationProjectId,
      applicationProjectName: row.applicationProject?.name,
      cityName: row.city?.nameAr || row.city?.nameEn,
      accountId: row.courierId,
      accountName: row.courierName,
      driverName: driverLabel(row.driver),
      month: row.month,
    });
  }
  for (const row of hsDailyRecords) {
    pushSource({
      source: "HungerStation Daily",
      appName: "HungerStation",
      applicationProjectId: row.applicationProjectId,
      applicationProjectName: row.applicationProject?.name,
      cityName: row.city?.nameAr || row.city?.nameEn,
      accountId: row.riderIdFromFile,
      accountName: row.applicationAccount?.appUsername || row.applicationAccount?.username,
      driverName: driverLabel(row.driver),
      month: row.month,
      reason: row.driver ? undefined : "حساب هنجر ظهر في تقرير يومي بدون مندوب فعلي مربوط",
      danger: !row.driver,
    });
  }
  for (const row of hsInvoiceRecords) {
    pushSource({
      source: "HungerStation Invoice",
      appName: "HungerStation",
      applicationProjectId: row.applicationProjectId,
      applicationProjectName: row.applicationProject?.name,
      cityName: row.city?.nameAr || row.city?.nameEn,
      accountId: row.riderIdFromFile,
      accountName: row.applicationAccount?.appUsername || row.applicationAccount?.username,
      driverName: driverLabel(row.driver),
      month: row.month,
      reason: row.driver ? undefined : "حساب هنجر ظهر في الفاتورة بدون مندوب فعلي مربوط",
      danger: !row.driver,
    });
  }
  for (const row of hsUsages) {
    pushSource({
      source: `HS Usage: ${row.usageSource}`,
      appName: "HungerStation",
      applicationProjectId: row.applicationProjectId,
      applicationProjectName: row.applicationProject?.name,
      cityName: row.city?.nameAr || row.city?.nameEn,
      accountId: row.riderIdFromFile,
      accountName: row.applicationAccount?.appUsername || row.applicationAccount?.username,
      driverName: driverLabel(row.driver),
      month: row.month,
      reason: row.reviewReason || undefined,
      danger: row.riskLevel === "HIGH" || row.riskLevel === "CRITICAL" || !row.driver,
    });
  }

  const filteredAlerts = [...alerts.values()]
    .map((alert) => {
      const drivers = [...new Set(alert.drivers)];
      const sources = [...new Set(alert.sources)];
      const hasMissingDriver = drivers.includes("بدون مندوب فعلي");
      return {
        ...alert,
        drivers,
        sources,
        severity: alert.severity === "danger" || drivers.length > 1 || hasMissingDriver ? "danger" as const : "warning" as const,
        reason: drivers.length > 1 ? "نفس حساب التطبيق ظهر مع أكثر من مندوب فعلي" : alert.reason,
      };
    })
    .filter((alert) => alert.drivers.length > 1 || alert.drivers.includes("بدون مندوب فعلي") || alert.sources.length > 1)
    .sort((a, b) => b.drivers.length - a.drivers.length || b.sources.length - a.sources.length);

  return { accounts, alerts: filteredAlerts, movements, projects, cities };
}

export default async function AccountMovementPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const result = await getData(params)
    .then((data) => ({ ...data, offline: "" }))
    .catch((error: unknown) => ({
      accounts: [],
      alerts: [] as MovementAlert[],
      movements: [],
      projects: [],
      cities: [],
      offline: error instanceof Error ? error.message : "database-offline",
    }));

  return (
    <PageShell
      title="حركة حسابات التطبيقات"
      description="مراجعة الحسابات التي انتقلت بين مناديب أو ظهرت في ملفات متعددة داخل نفس مشروع المدينة، مع فصل Keeta عن HungerStation."
      actions={
        <Link href="/projects" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm">
          رجوع للمشاريع
        </Link>
      }
    >
      {result.offline ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-black text-red-800">
          قاعدة البيانات غير متصلة. يرجى تشغيل PostgreSQL ثم تحديث الصفحة.
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <form className="grid gap-3 lg:grid-cols-6">
          <label className="grid gap-1 text-xs font-black text-slate-600 lg:col-span-2">
            بحث
            <input name="q" defaultValue={one(params, "q")} placeholder="App User ID / اسم المندوب / الكود" className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="grid gap-1 text-xs font-black text-slate-600">
            مشروع المدينة
            <select name="applicationProjectId" defaultValue={one(params, "applicationProjectId")} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
              <option value="">كل المشاريع</option>
              {result.projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-black text-slate-600">
            المدينة
            <select name="cityId" defaultValue={one(params, "cityId")} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
              <option value="">كل المدن</option>
              {result.cities.map((city) => (
                <option key={city.id} value={city.id}>{city.nameAr || city.nameEn}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-black text-slate-600">
            الشهر
            <input name="month" defaultValue={one(params, "month")} placeholder="2026-04" className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <div className="flex items-end gap-2">
            <button type="submit" className="h-10 flex-1 rounded-xl bg-slate-950 px-4 text-sm font-black text-white">تطبيق</button>
            <Link href="/account-movement" className="grid h-10 place-items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700">عرض الكل</Link>
          </div>
        </form>
      </section>

      <div className="grid gap-3 md:grid-cols-4">
        <Summary label="حسابات ضمن الفلتر" value={result.accounts.length} />
        <Summary label="تنبيهات حركة" value={result.alerts.length} tone="text-amber-700" />
        <Summary label="سجل حركات محفوظ" value={result.movements.length} tone="text-blue-700" />
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-bold text-slate-500">المنطق المعتمد</p>
          <strong className="mt-2 block text-lg font-black text-emerald-700">ApplicationProject + Month + Actual Usage</strong>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
          <h2 className="text-lg font-black text-slate-950">تنبيهات حركة الحسابات والمطابقة</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-right text-sm">
            <thead className="bg-white text-xs font-black text-slate-500">
              <tr>{["الحساب", "التطبيق", "المندوبون", "المصادر", "المشروع", "المدينة", "الشهر", "سبب التنبيه", "الحالة", "الإجراءات"].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {result.alerts.map((alert) => (
                <tr key={alert.key} className="hover:bg-slate-50">
                  <td className="px-4 py-4"><strong className="block text-slate-950">{alert.appUserId}</strong><span className="text-xs font-bold text-slate-500">{alert.appUsername}</span></td>
                  <td className="whitespace-nowrap px-4 py-4 font-bold">{alert.appName}</td>
                  <td className="px-4 py-4"><div className="flex flex-wrap gap-1">{alert.drivers.map((driver) => <span key={driver} className="rounded-full bg-slate-100 px-2 py-1 text-xs font-black text-slate-700">{driver}</span>)}</div></td>
                  <td className="px-4 py-4"><div className="flex flex-wrap gap-1">{alert.sources.map((source) => <span key={source} className="rounded-full bg-blue-50 px-2 py-1 text-xs font-black text-blue-700">{source}</span>)}</div></td>
                  <td className="whitespace-nowrap px-4 py-4 font-bold">{alert.applicationProjectName}</td>
                  <td className="whitespace-nowrap px-4 py-4 font-bold">{alert.cityName}</td>
                  <td className="whitespace-nowrap px-4 py-4 font-bold">{alert.month}</td>
                  <td className="px-4 py-4 font-bold text-amber-800">{alert.reason}</td>
                  <td className="whitespace-nowrap px-4 py-4"><span className={`rounded-full px-2 py-1 text-xs font-black ${statusBadge(alert.severity)}`}>{alert.severity === "danger" ? "خطر" : "تحذير"}</span></td>
                  <td className="px-4 py-4"><div className="flex flex-wrap gap-2"><Link href={`/settings/application-account-review${makeFilterLink(params, { applicationProjectId: alert.applicationProjectId, q: alert.appUserId })}`} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-800">مراجعة الحساب</Link><Link href={`/drivers?q=${encodeURIComponent(alert.appUserId)}`} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700">بحث في المناديب</Link></div></td>
                </tr>
              ))}
              {!result.alerts.length ? <tr><td colSpan={10} className="px-4 py-10 text-center font-bold text-slate-500">لا توجد تنبيهات حركة حسابات ضمن الفلاتر الحالية.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-3"><h2 className="text-lg font-black text-slate-950">سجل الحركات المحفوظة</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-right text-sm">
            <thead className="bg-white text-xs font-black text-slate-500"><tr>{["الحساب", "التطبيق", "من مندوب", "إلى مندوب", "نوع الحركة", "التاريخ", "الحالة", "ملاحظات"].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {result.movements.map((movement) => (
                <tr key={movement.id}><td className="whitespace-nowrap px-4 py-4 font-mono text-xs">{movement.accountId || "-"}</td><td className="whitespace-nowrap px-4 py-4 font-bold">{movement.appName || "-"}</td><td className="whitespace-nowrap px-4 py-4">{movement.fromDriverId || "-"}</td><td className="whitespace-nowrap px-4 py-4">{movement.toDriverId || "-"}</td><td className="whitespace-nowrap px-4 py-4">{movement.movementType}</td><td className="whitespace-nowrap px-4 py-4">{movement.movementDate.toISOString().slice(0, 10)}</td><td className="whitespace-nowrap px-4 py-4">{String(movement.status)}</td><td className="px-4 py-4">{movement.notes || "-"}</td></tr>
              ))}
              {!result.movements.length ? <tr><td colSpan={8} className="px-4 py-10 text-center font-bold text-slate-500">لا توجد حركات محفوظة حتى الآن.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </PageShell>
  );
}

function Summary({ label, value, tone = "text-slate-950" }: { label: string; value: number; tone?: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-sm font-bold text-slate-500">{label}</p><strong className={`mt-2 block text-3xl font-black ${tone}`}>{value}</strong></div>;
}
