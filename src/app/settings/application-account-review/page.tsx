import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ApplicationAccountReviewClient } from "@/components/application-accounts/ApplicationAccountReviewClient";
import { getAccountUsageReviewData } from "@/lib/application-accounts/accountUsage";
import { canReadResource, roleFromHeaders } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function one(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function ApplicationAccountReviewPage({ searchParams }: PageProps) {
  const requestHeaders = await headers();
  if (!canReadResource(roleFromHeaders(requestHeaders), "application-accounts")) redirect("/access-denied");

  const params = await searchParams;
  const filters = {
    month: one(params, "month"),
    applicationId: one(params, "applicationId"),
    applicationProjectId: one(params, "applicationProjectId"),
    cityId: one(params, "cityId"),
    q: one(params, "q"),
  };

  const result = await getAccountUsageReviewData(filters)
    .then((data) => ({ data, offline: "" }))
    .catch((error: unknown) => ({
      data: {
        filters,
        options: { applications: [], projects: [], cities: [] },
        accountIssueRows: [],
        reviewRows: [],
        readiness: {
          invoiceRecords: 0,
          dailyRecords: 0,
          matchedAccounts: 0,
          matchedDrivers: 0,
          missingActualWorkers: 0,
          sharedAccountWarnings: 0,
          criticalConflicts: 0,
          invoiceWithoutDaily: 0,
          dailyWithoutInvoice: 0,
        },
      },
      offline: error instanceof Error ? error.message : "تعذر الاتصال بقاعدة البيانات.",
    }));

  return (
    <main className="min-h-screen bg-slate-50 p-6" dir="rtl">
      {result.offline ? (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-black text-red-800">
          قاعدة البيانات غير متصلة. يرجى تشغيل PostgreSQL ثم تحديث الصفحة.
        </div>
      ) : null}
      <ApplicationAccountReviewClient {...result.data} />
    </main>
  );
}
