import { notFound } from "next/navigation";
import { ModuleMigrationPage } from "@/components/ui/ModuleMigrationPage";
import { findModuleByPath } from "@/lib/modules";

export const dynamic = "force-dynamic";

export default async function CatchAllModulePage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const module = findModuleByPath(slug.join("/"));
  if (!module) notFound();

  return <ModuleMigrationPage module={module} />;
}
