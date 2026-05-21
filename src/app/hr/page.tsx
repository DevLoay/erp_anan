import { ResourcePage } from "@/components/ui/ResourcePage";
import { resources } from "@/lib/resources";
import type { ResourceConfig } from "@/lib/resources";

export const dynamic = "force-dynamic";

const humanResourcesResource: ResourceConfig = {
  ...resources.drivers,
  title: "الموارد البشرية",
  description: "ملف الموارد البشرية للمناديب: بيانات التعاقد، الحالة، المدينة، المشروع، المشرف، السكن، وتاريخ الالتحاق.",
  route: "/hr",
  searchFields: ["internalCode", "name", "actualName", "phone", "mobile", "nationalId", "contractType", "sponsorshipType", "status"],
  columns: [
    { key: "internalCode", label: "كود المندوب" },
    { key: "name", label: "اسم المندوب" },
    { key: "phone", label: "الجوال" },
    { key: "contractType", label: "نوع العقد" },
    { key: "sponsorshipType", label: "نوع الكفالة" },
    { key: "housingStatus", label: "السكن" },
    { key: "status", label: "الحالة" },
  ],
};

export default function HumanResourcesPage() {
  return <ResourcePage resource={humanResourcesResource} />;
}
