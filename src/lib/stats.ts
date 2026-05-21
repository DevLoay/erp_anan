import { prisma } from "./prisma";
import { money } from "./format";

export type DashboardStats = {
  databaseReady: boolean;
  drivers: number;
  activeDrivers: number;
  supervisors: number;
  cities: number;
  vehicles: number;
  orders: number;
  workingHours: number;
  payrollNet: string;
  alerts: number;
  error?: string;
};

export async function getDashboardStats(): Promise<DashboardStats> {
  try {
    await prisma.$queryRaw`SELECT 1`;

    const [
      drivers,
      activeDrivers,
      supervisors,
      cities,
      vehicles,
      reports,
      payroll,
      alerts,
    ] = await Promise.all([
      prisma.driver.count(),
      prisma.driver.count({ where: { status: "ACTIVE" } }),
      prisma.supervisor.count(),
      prisma.city.count(),
      prisma.vehicle.count(),
      prisma.dailyReport.aggregate({ _sum: { orders: true, workingHours: true } }),
      prisma.payroll.aggregate({ _sum: { netSalary: true } }),
      prisma.notification.count({ where: { status: { not: "APPROVED" } } }),
    ]);

    return {
      databaseReady: true,
      drivers,
      activeDrivers,
      supervisors,
      cities,
      vehicles,
      orders: reports._sum.orders ?? 0,
      workingHours: Number(reports._sum.workingHours ?? 0),
      payrollNet: money(payroll._sum.netSalary ?? 0),
      alerts,
    };
  } catch (err) {
    return {
      databaseReady: false,
      drivers: 0,
      activeDrivers: 0,
      supervisors: 0,
      cities: 0,
      vehicles: 0,
      orders: 0,
      workingHours: 0,
      payrollNet: money(0),
      alerts: 0,
      error: err instanceof Error ? err.message : "Database connection error",
    };
  }
}
