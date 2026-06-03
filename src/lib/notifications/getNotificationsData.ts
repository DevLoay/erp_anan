import { prisma } from "@/lib/prisma";
import { databaseOfflineMessage } from "@/lib/imports/templates";

type SearchParams = Record<string, string | string[] | undefined>;

export type NotificationSeverity = "CRITICAL" | "WARNING" | "INFO";
export type NotificationStatus = "PENDING" | "ACTIVE" | "APPROVED" | "REJECTED" | "LOCKED" | "INACTIVE";
export type NotificationSource = "saved" | "daily-report" | "missing-report" | "account";

export type NotificationRow = {
  id: string;
  source: NotificationSource;
  sourceLabel: string;
  title: string;
  detail: string;
  severity: NotificationSeverity;
  severityLabel: string;
  status: NotificationStatus;
  statusLabel: string;
  driverId: string;
  driverName: string;
  cityName: string;
  projectName: string;
  appName: string;
  currentValue: string;
  requiredValue: string;
  recommendation: string;
  createdAt: string;
};

export type NotificationsData = {
  databaseStatus: "online" | "offline";
  databaseMessage?: string;
  filters: {
    from: string;
    to: string;
  };
  summary: {
    critical: number;
    warning: number;
    info: number;
    resolved: number;
    total: number;
  };
  rows: NotificationRow[];
  keetaTemplate: {
    fileType: string;
    requiredColumns: string[];
    optionalColumns: string[];
  };
};

function one(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function defaultFrom() {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return isoDate(date);
}

function parseDate(value: string, fallback: string) {
  const parsed = new Date(value || fallback);
  if (Number.isNaN(parsed.getTime())) return new Date(fallback);
  return parsed;
}

function endOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function numberValue(value: unknown) {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") return value.toNumber();
  const parsed = Number(String(value ?? "").replace("%", ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function displayDate(value: Date) {
  return value.toISOString().slice(0, 19).replace("T", " ");
}

function statusLabel(status: string): string {
  const value = status.toUpperCase();
  if (value === "APPROVED" || value === "LOCKED") return "تم الحل";
  if (value === "REJECTED") return "تم التجاهل";
  if (value === "INACTIVE") return "مغلق";
  if (value === "ACTIVE") return "قيد التنفيذ";
  return "قيد المتابعة";
}

function severityLabel(severity: string): string {
  const value = severity.toUpperCase();
  if (value === "CRITICAL") return "حرج";
  if (value === "WARNING") return "تحذير";
  return "معلومة";
}

function sourceLabel(source: NotificationSource) {
  const labels: Record<NotificationSource, string> = {
    saved: "محفوظ",
    "daily-report": "تقرير يومي",
    "missing-report": "تقرير مفقود",
    account: "حساب تطبيق",
  };
  return labels[source];
}

function driverLabel(driver?: { actualName: string | null; name: string; internalCode: string } | null) {
  if (!driver) return "-";
  return driver.actualName || driver.name || driver.internalCode;
}

export function resolveNotificationFilters(params: SearchParams): NotificationsData["filters"] {
  const today = isoDate(new Date());
  return {
    from: one(params, "from") || defaultFrom(),
    to: one(params, "to") || today,
  };
}

function keetaTemplate() {
  return {
    fileType: "keeta_period_report_template",
    requiredColumns: ["Date", "Courier ID", "Task Volumes_Delivered Tasks"],
    optionalColumns: [
      "Courier First Name",
      "Courier Last Name",
      "Supervisor",
      "Vehicle Type",
      "Shift_Valid Online Time",
      "Delivery Experience_On-time Rate (D)",
      "Task Volumes_Cancellation Rate from Delivery Issues",
    ],
  };
}

function emptyData(filters: NotificationsData["filters"], message?: string): NotificationsData {
  return {
    databaseStatus: message ? "offline" : "online",
    databaseMessage: message,
    filters,
    summary: { critical: 0, warning: 0, info: 0, resolved: 0, total: 0 },
    rows: [],
    keetaTemplate: keetaTemplate(),
  };
}

function buildSummary(rows: NotificationRow[]): NotificationsData["summary"] {
  return {
    critical: rows.filter((row) => row.severity === "CRITICAL" && row.statusLabel !== "تم الحل").length,
    warning: rows.filter((row) => row.severity === "WARNING" && row.statusLabel !== "تم الحل").length,
    info: rows.filter((row) => row.severity === "INFO" && row.statusLabel !== "تم الحل").length,
    resolved: rows.filter((row) => row.statusLabel === "تم الحل").length,
    total: rows.length,
  };
}

export async function getNotificationsData(filters: NotificationsData["filters"]): Promise<NotificationsData> {
  const from = parseDate(filters.from, defaultFrom());
  const to = endOfDay(parseDate(filters.to, isoDate(new Date())));

  try {
    const [savedNotifications, reports, activeDrivers, emptyAccounts, appProjects] = await Promise.all([
      prisma.notification.findMany({
        where: { createdAt: { gte: from, lte: to } },
        include: {
          driver: {
            select: {
              id: true,
              internalCode: true,
              name: true,
              actualName: true,
              city: { select: { nameAr: true, nameEn: true } },
              project: { select: { name: true, appName: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 300,
      }),
      prisma.dailyReport.findMany({
        where: { reportDate: { gte: from, lte: to } },
        include: {
          city: { select: { nameAr: true, nameEn: true } },
          project: { select: { id: true, name: true, appName: true } },
          driver: {
            select: {
              id: true,
              internalCode: true,
              name: true,
              actualName: true,
              city: { select: { nameAr: true, nameEn: true } },
              project: { select: { name: true, appName: true } },
            },
          },
        },
        orderBy: { reportDate: "desc" },
        take: 1200,
      }),
      prisma.driver.findMany({
        where: { status: "ACTIVE" },
        include: {
          city: { select: { nameAr: true, nameEn: true } },
          project: { select: { id: true, name: true, appName: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 500,
      }),
      prisma.applicationAccount.findMany({
        where: {
          OR: [{ isEmpty: true }, { driverId: null }],
          status: "ACTIVE",
        },
        include: {
          city: { select: { nameAr: true, nameEn: true } },
          project: { select: { name: true, appName: true } },
          application: { select: { name: true } },
          applicationProject: { select: { name: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 120,
      }),
      prisma.applicationProject.findMany({
        select: { projectId: true, dailyTarget: true, monthlyTarget: true, name: true },
      }),
    ]);

    const targetByProject = new Map(appProjects.filter((project) => project.projectId).map((project) => [project.projectId!, project.dailyTarget ?? 0]));
    const reportDriverIds = new Set(reports.map((report) => report.driverId).filter(Boolean) as string[]);
    const rows: NotificationRow[] = [];

    for (const notification of savedNotifications) {
      const driver = notification.driver;
      const source: NotificationSource = "saved";
      rows.push({
        id: notification.id,
        source,
        sourceLabel: sourceLabel(source),
        title: notification.title,
        detail: notification.body ?? "تنبيه محفوظ في قاعدة البيانات.",
        severity: notification.severity,
        severityLabel: severityLabel(notification.severity),
        status: notification.status,
        statusLabel: statusLabel(notification.status),
        driverId: driver?.id ?? "",
        driverName: driverLabel(driver),
        cityName: driver?.city?.nameAr || driver?.city?.nameEn || "-",
        projectName: driver?.project?.name || "-",
        appName: driver?.project?.appName || "-",
        currentValue: "-",
        requiredValue: "-",
        recommendation: "مراجعة التنبيه المحفوظ وتحديث حالته من شاشة التفاصيل.",
        createdAt: displayDate(notification.createdAt),
      });
    }

    for (const report of reports) {
      const driver = report.driver;
      const cityName = report.city?.nameAr || report.city?.nameEn || driver?.city?.nameAr || driver?.city?.nameEn || "-";
      const projectName = report.project?.name || driver?.project?.name || "-";
      const appName = report.appName || report.project?.appName || driver?.project?.appName || "-";
      const dailyTarget = report.projectId ? targetByProject.get(report.projectId) ?? 0 : 0;
      const base = {
        driverId: driver?.id ?? "",
        driverName: driverLabel(driver),
        cityName,
        projectName,
        appName,
        createdAt: displayDate(report.reportDate),
        status: "PENDING" as NotificationStatus,
        statusLabel: "قيد المتابعة",
      };

      if (dailyTarget > 0 && report.orders < dailyTarget) {
        const source: NotificationSource = "daily-report";
        const severe = report.orders < dailyTarget * 0.7;
        rows.push({
          ...base,
          id: `orders-${report.id}`,
          source,
          sourceLabel: sourceLabel(source),
          title: `طلبات أقل من التارجت: ${base.driverName}`,
          detail: `Orders - ${displayDate(report.reportDate)}`,
          severity: severe ? "CRITICAL" : "WARNING",
          severityLabel: severe ? "حرج" : "تحذير",
          currentValue: String(report.orders),
          requiredValue: String(dailyTarget),
          recommendation: "فتح تقرير المندوب ومراجعة سبب انخفاض الطلبات اليومية.",
        });
      }

      const onTime = numberValue(report.onTimeRate);
      if (onTime > 0 && onTime < 99) {
        const source: NotificationSource = "daily-report";
        const severe = onTime < 95;
        rows.push({
          ...base,
          id: `ontime-${report.id}`,
          source,
          sourceLabel: sourceLabel(source),
          title: `On-Time منخفض: ${base.driverName}`,
          detail: `On Time - ${displayDate(report.reportDate)}`,
          severity: severe ? "CRITICAL" : "WARNING",
          severityLabel: severe ? "حرج" : "تحذير",
          currentValue: `${onTime}%`,
          requiredValue: ">= 99%",
          recommendation: "مراجعة الالتزام والتواصل مع المشرف المسؤول.",
        });
      }

      const cancellation = numberValue(report.cancellationRate);
      if (cancellation > 0) {
        const source: NotificationSource = "daily-report";
        rows.push({
          ...base,
          id: `cancel-${report.id}`,
          source,
          sourceLabel: sourceLabel(source),
          title: `إلغاء مرتفع: ${base.driverName}`,
          detail: `Cancellation - ${displayDate(report.reportDate)}`,
          severity: "CRITICAL",
          severityLabel: "حرج",
          currentValue: `${cancellation}%`,
          requiredValue: "0%",
          recommendation: "فتح تقرير المندوب ومراجعة أسباب الإلغاء مع المشرف.",
        });
      }

      const rejection = numberValue(report.rejectionRate);
      if (rejection > 0) {
        const source: NotificationSource = "daily-report";
        rows.push({
          ...base,
          id: `reject-${report.id}`,
          source,
          sourceLabel: sourceLabel(source),
          title: `رفض مرتفع: ${base.driverName}`,
          detail: `Rejection - ${displayDate(report.reportDate)}`,
          severity: "CRITICAL",
          severityLabel: "حرج",
          currentValue: `${rejection}%`,
          requiredValue: "0%",
          recommendation: "مراجعة سبب الرفض وربطه بمهمة للمشرف عند الحاجة.",
        });
      }

      const hours = numberValue(report.workingHours);
      if (hours > 0 && hours < 10) {
        const source: NotificationSource = "daily-report";
        const severe = hours < 8;
        rows.push({
          ...base,
          id: `hours-${report.id}`,
          source,
          sourceLabel: sourceLabel(source),
          title: `ساعات عمل منخفضة: ${base.driverName}`,
          detail: `Working Hours - ${displayDate(report.reportDate)}`,
          severity: severe ? "CRITICAL" : "WARNING",
          severityLabel: severe ? "حرج" : "تحذير",
          currentValue: `${hours}`,
          requiredValue: ">= 10 ساعات",
          recommendation: "مراجعة الحضور والشفتات وساعات العمل المسجلة.",
        });
      }
    }

    for (const driver of activeDrivers) {
      if (reportDriverIds.has(driver.id)) continue;
      const source: NotificationSource = "missing-report";
      rows.push({
        id: `missing-${driver.id}`,
        source,
        sourceLabel: sourceLabel(source),
        title: `لا يوجد تقارير للفترة: ${driver.actualName || driver.name}`,
        detail: `Missing Report - ${filters.from} to ${filters.to}`,
        severity: "CRITICAL",
        severityLabel: "حرج",
        status: "PENDING",
        statusLabel: "قيد المتابعة",
        driverId: driver.id,
        driverName: driver.actualName || driver.name || driver.internalCode,
        cityName: driver.city?.nameAr || driver.city?.nameEn || "-",
        projectName: driver.project?.name || "-",
        appName: driver.project?.appName || "-",
        currentValue: "0",
        requiredValue: "تقرير يومي",
        recommendation: "مراجعة سبب غياب التقرير أو استيراد ملف التطبيق للفترة المحددة.",
        createdAt: displayDate(to),
      });
    }

    for (const account of emptyAccounts) {
      const source: NotificationSource = "account";
      rows.push({
        id: `account-${account.id}`,
        source,
        sourceLabel: sourceLabel(source),
        title: `حساب تطبيق غير مربوط: ${account.appUsername || account.appUserId || account.username}`,
        detail: "Application Account",
        severity: "WARNING",
        severityLabel: "تحذير",
        status: "PENDING",
        statusLabel: "قيد المتابعة",
        driverId: "",
        driverName: "-",
        cityName: account.city?.nameAr || account.city?.nameEn || "-",
        projectName: account.applicationProject?.name || account.project?.name || "-",
        appName: account.application?.name || account.project?.appName || account.appName || "-",
        currentValue: "غير مربوط",
        requiredValue: "ربط بمندوب",
        recommendation: "فتح حسابات التطبيق وربط الحساب بمندوب أو تعطيله إذا لم يعد مستخدماً.",
        createdAt: displayDate(account.updatedAt),
      });
    }

    const sortedRows = rows
      .sort((a, b) => {
        const severityOrder = { CRITICAL: 0, WARNING: 1, INFO: 2 };
        return severityOrder[a.severity] - severityOrder[b.severity] || b.createdAt.localeCompare(a.createdAt);
      })
      .slice(0, 600);

    return {
      databaseStatus: "online",
      filters,
      rows: sortedRows,
      summary: buildSummary(sortedRows),
      keetaTemplate: keetaTemplate(),
    };
  } catch (error) {
    const message = databaseOfflineMessage(error);
    if (message) return emptyData(filters, message);
    throw error;
  }
}
