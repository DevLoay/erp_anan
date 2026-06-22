import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string; projectId: string }>;
};

export default async function LegacyApplicationProjectInvoiceSettingsPage({ params }: PageProps) {
  const { id, projectId } = await params;
  redirect(`/applications/invoice-settings?applicationId=${encodeURIComponent(id)}&applicationProjectId=${encodeURIComponent(projectId)}`);
}
