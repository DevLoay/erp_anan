import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAccessScope } from "@/lib/auth/accessScope";

export type InterviewStatus = "ACTIVE" | "INACTIVE" | "PENDING" | "APPROVED" | "REJECTED" | "LOCKED" | "CANCELLED";

export type InterviewFilters = {
  q: string;
  status: string;
  cityId: string;
  projectId: string;
  fromDate: string;
  toDate: string;
};

export type InterviewRow = {
  id: string;
  candidateName: string;
  phone: string;
  cityId: string;
  cityName: string;
  projectId: string;
  projectName: string;
  status: InterviewStatus;
  scheduledAt: string;
  convertedDriverId: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type InterviewOption = {
  id: string;
  label: string;
};

export type InterviewsPageData = {
  filters: InterviewFilters;
  rows: InterviewRow[];
  summary: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    cancelled: number;
    converted: number;
  };
  refs: {
    cities: InterviewOption[];
    projects: InterviewOption[];
  };
  access: {
    isGlobal: boolean;
    cityIds: string[];
    supervisorId: string;
    driverId: string;
  };
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function iso(value: Date | null | undefined) {
  return value ? value.toISOString() : "";
}

function parseDate(value: string, endOfDay = false) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay) date.setHours(23, 59, 59, 999);
  return date;
}

export function resolveInterviewFilters(params: Record<string, string | string[] | undefined>): InterviewFilters {
  return {
    q: first(params.q).trim(),
    status: first(params.status).trim(),
    cityId: first(params.cityId).trim(),
    projectId: first(params.projectId).trim(),
    fromDate: first(params.fromDate).trim(),
    toDate: first(params.toDate).trim(),
  };
}

export async function getInterviewsPageData(filters: InterviewFilters, requestHeaders?: Headers): Promise<InterviewsPageData> {
  const scope = await getAccessScope(requestHeaders || (await headers()));
  const where: Prisma.InterviewWhereInput = {};

  if (filters.q) {
    where.OR = [
      { candidateName: { contains: filters.q, mode: "insensitive" } },
      { phone: { contains: filters.q, mode: "insensitive" } },
      { notes: { contains: filters.q, mode: "insensitive" } },
    ];
  }
  if (filters.status) where.status = filters.status as any;
  if (filters.cityId) where.cityId = filters.cityId;
  if (filters.projectId) where.projectId = filters.projectId;
  if (!scope.isGlobal && scope.cityIds.length && !filters.cityId) where.cityId = { in: scope.cityIds };

  const from = parseDate(filters.fromDate);
  const to = parseDate(filters.toDate, true);
  if (from || to) {
    where.scheduledAt = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }

  const [interviews, cities, projects] = await Promise.all([
    prisma.interview.findMany({
      where,
      orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
      take: 300,
    }),
    prisma.city.findMany({
      where: !scope.isGlobal && scope.cityIds.length ? { id: { in: scope.cityIds } } : undefined,
      orderBy: { nameAr: "asc" },
      select: { id: true, nameAr: true, nameEn: true },
    }),
    prisma.project.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, appName: true, cityId: true },
    }),
  ]);

  const cityMap = new Map(cities.map((city) => [city.id, city.nameAr || city.nameEn || city.id]));
  const projectMap = new Map(projects.map((project) => [project.id, project.appName ? `${project.name} - ${project.appName}` : project.name]));

  const rows: InterviewRow[] = interviews.map((item) => ({
    id: item.id,
    candidateName: item.candidateName,
    phone: item.phone || "",
    cityId: item.cityId || "",
    cityName: item.cityId ? cityMap.get(item.cityId) || "غير محدد" : "غير محدد",
    projectId: item.projectId || "",
    projectName: item.projectId ? projectMap.get(item.projectId) || "غير محدد" : "غير محدد",
    status: item.status as InterviewStatus,
    scheduledAt: iso(item.scheduledAt),
    convertedDriverId: item.convertedDriverId || "",
    notes: item.notes || "",
    createdAt: iso(item.createdAt),
    updatedAt: iso(item.updatedAt),
  }));

  return {
    filters,
    rows,
    summary: {
      total: rows.length,
      pending: rows.filter((row) => row.status === "PENDING").length,
      approved: rows.filter((row) => row.status === "APPROVED").length,
      rejected: rows.filter((row) => row.status === "REJECTED").length,
      cancelled: rows.filter((row) => row.status === "CANCELLED").length,
      converted: rows.filter((row) => row.convertedDriverId).length,
    },
    refs: {
      cities: cities.map((city) => ({ id: city.id, label: city.nameAr || city.nameEn || city.id })),
      projects: projects.map((project) => ({ id: project.id, label: project.appName ? `${project.name} - ${project.appName}` : project.name })),
    },
    access: {
      isGlobal: scope.isGlobal,
      cityIds: scope.cityIds,
      supervisorId: scope.supervisorId || "",
      driverId: scope.driverId || "",
    },
  };
}
