import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApplicationAccountReviewClient } from "@/components/application-accounts/ApplicationAccountReviewClient";
import { canReadResource, roleFromHeaders } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function one(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function buildWhere(params: Record<string, string | string[] | undefined>): Prisma.ApplicationAccountWhereInput {
  const applicationProjectId = one(params, "applicationProjectId");
  const cityId = one(params, "cityId");
  const applicationId = one(params, "applicationId");
  const q = one(params, "q").trim();

  const and: Prisma.ApplicationAccountWhereInput[] = [
    {
      OR: [
        { needsReview: true },
        { applicationProjectId: null },
        { cityId: null },
        { driverId: null },
        { unmatchedReason: { not: null } },
      ],
    },
  ];

  if (applicationProjectId) and.push({ applicationProjectId });
  if (cityId) and.push({ cityId });
  if (applicationId) and.push({ applicationId });
  if (q) {
    and.push({
      OR: [
        { appName: { contains: q, mode: "insensitive" } },
        { appUserId: { contains: q, mode: "insensitive" } },
        { appUsername: { contains: q, mode: "insensitive" } },
        { username: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  return { AND: and };
}

export default async function ApplicationAccountReviewPage({ searchParams }: PageProps) {
  const requestHeaders = await headers();
  if (!canReadResource(roleFromHeaders(requestHeaders), "application-accounts")) redirect("/access-denied");
  const params = await searchParams;

  const result = await prisma.applicationAccount.findMany({
    where: buildWhere(params),
    include: {
      application: { select: { name: true } },
      applicationProject: { select: { name: true } },
      city: { select: { nameAr: true, nameEn: true } },
      driver: { select: { name: true, actualName: true, internalCode: true } },
    },
    orderBy: [{ needsReview: "desc" }, { updatedAt: "desc" }],
    take: 300,
  })
    .then((rows) => ({ rows, offline: "" }))
    .catch((error: unknown) => ({
      rows: [],
      offline: error instanceof Error ? error.message : "تعذر الاتصال بقاعدة البيانات.",
    }));

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      {result.offline ? (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-black text-red-800" dir="rtl">
          قاعدة البيانات غير متصلة. يرجى تشغيل PostgreSQL ثم تحديث الصفحة.
        </div>
      ) : null}
      <ApplicationAccountReviewClient
        rows={result.rows.map((row) => ({
          id: row.id,
          appName: row.appName,
          appUserId: row.appUserId,
          appUsername: row.appUsername,
          username: row.username,
          applicationName: row.application?.name ?? "",
          applicationProjectName: row.applicationProject?.name ?? "",
          cityName: row.city?.nameAr || row.city?.nameEn || "",
          driverName: row.driver ? `${row.driver.actualName || row.driver.name} (${row.driver.internalCode})` : "",
          needsReview: row.needsReview,
          unmatchedReason: row.unmatchedReason,
          status: row.status,
        }))}
      />
    </main>
  );
}
