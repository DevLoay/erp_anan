import { prisma } from "@/lib/prisma";
import { ApplicationAccountReviewClient } from "@/components/application-accounts/ApplicationAccountReviewClient";

export const dynamic = "force-dynamic";

export default async function ApplicationAccountReviewPage() {
  const rows = await prisma.applicationAccount.findMany({
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
  });

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <ApplicationAccountReviewClient
        rows={rows.map((row) => ({
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
