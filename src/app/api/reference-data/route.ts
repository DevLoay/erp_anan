import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canReadResource, roleFromHeaders } from "@/lib/permissions";

function option(value: string, label: string) {
  return { value, label };
}

export async function GET(request: Request) {
  const role = roleFromHeaders(request.headers);
  if (!canReadResource(role, "drivers")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [cities, projects, supervisors, drivers, vehicles, accounts] = await Promise.all([
    prisma.city.findMany({ select: { id: true, nameAr: true, nameEn: true }, orderBy: { nameAr: "asc" } }),
    prisma.project.findMany({ select: { id: true, name: true, appName: true }, orderBy: { name: "asc" } }),
    prisma.supervisor.findMany({ select: { id: true, name: true, phone: true }, orderBy: { name: "asc" } }),
    prisma.driver.findMany({ select: { id: true, internalCode: true, name: true, phone: true }, orderBy: { name: "asc" }, take: 500 }),
    prisma.vehicle.findMany({ select: { id: true, plateAr: true, plateEn: true, model: true }, orderBy: { plateEn: "asc" }, take: 500 }),
    prisma.applicationAccount.findMany({ select: { id: true, appName: true, username: true, isEmpty: true }, orderBy: { username: "asc" }, take: 500 }),
  ]);

  return NextResponse.json({
    data: {
      cities: cities.map((city) => option(city.id, city.nameAr || city.nameEn || city.id)),
      projects: projects.map((project) => option(project.id, `${project.name}${project.appName ? ` - ${project.appName}` : ""}`)),
      supervisors: supervisors.map((supervisor) => option(supervisor.id, `${supervisor.name}${supervisor.phone ? ` - ${supervisor.phone}` : ""}`)),
      drivers: drivers.map((driver) => option(driver.id, `${driver.internalCode} - ${driver.name}${driver.phone ? ` - ${driver.phone}` : ""}`)),
      vehicles: vehicles.map((vehicle) => option(vehicle.id, `${vehicle.plateEn}${vehicle.plateAr ? ` / ${vehicle.plateAr}` : ""}${vehicle.model ? ` - ${vehicle.model}` : ""}`)),
      accounts: accounts.map((account) => option(account.id, `${account.appName} - ${account.username}${account.isEmpty ? " - فارغ" : ""}`)),
    },
  });
}
