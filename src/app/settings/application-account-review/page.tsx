import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ApplicationAccountReviewClient } from "@/components/application-accounts/ApplicationAccountReviewClient";
import { canReadResource, roleFromHeaders } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function ApplicationAccountReviewPage() {
  const requestHeaders = await headers();
  if (!canReadResource(roleFromHeaders(requestHeaders), "application-accounts")) redirect("/access-denied");

  const result = await prisma.applicationAccount.findMany({
    where: {
      OR: [
        { needsReview: true },
        { applicationProjectId: null },
        { cityId: null },
        { driverId: null },
      ],
    },
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
