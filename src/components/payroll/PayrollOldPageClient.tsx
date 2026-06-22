"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type {
  PayrollOldData,
  PayrollOldRow,
} from "@/lib/payroll/getPayrollOldPageData";

type Props = {
  data: PayrollOldData;
};

type DetailTab =
  | "salary"
  | "vehicle"
  | "appDeductions"
  | "internalDeductions"
  | "revenue"
  | "performance"
  | "profit"
  | "audit";

const COMPANY_CAR_FULL_MONTH_RENT = 2000;
const VEHICLE_RENT_DAYS_BASE = 30;
const COMPANY_CAR_DAILY_RENT = COMPANY_CAR_FULL_MONTH_RENT / VEHICLE_RENT_DAYS_BASE;
const PERSONAL_CAR_USER_DEDUCTION = 300;

function companyCarRentByDays(days: number) {
  const rentDays = Math.max(0, Math.min(Math.round(Number(days || 0)), VEHICLE_RENT_DAYS_BASE));
  if (rentDays <= 0) return 0;
  return Math.round(Math.min(COMPANY_CAR_FULL_MONTH_RENT, rentDays * COMPANY_CAR_DAILY_RENT) * 100) / 100;
}

function money(value: number) {
  return new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 0,
  }).format(value);
}

function number(value: number) {
  return new Intl.NumberFormat("ar-SA").format(value);
}

function pct(value: number) {
  return `${Math.round(value * 10) / 10}%`;
}

function moneyOrDash(value: number) {
  return value ? money(value) : "-";
}

function carAllowanceText(row: PayrollOldRow) {
  if (row.vehicleOwnershipType !== "personal_car") return "-";
  return row.carRent ? money(row.carRent) : "-";
}

function companyCarRentText(row: PayrollOldRow) {
  if (row.vehicleOwnershipType !== "company_car") return "-";
  return moneyOrDash(row.vehicleRentDisplayAmount);
}

function appDeductionTotal(row: PayrollOldRow) {
  return row.totalAppDeductions || row.appDeductionsTotal;
}

function kpiTone(
  score: number,
): "slate" | "emerald" | "amber" | "red" | "blue" {
  if (score >= 90) return "emerald";
  if (score >= 75) return "blue";
  if (score >= 60) return "amber";
  if (score > 0) return "red";
  return "slate";
}

function invoiceValidity(row: PayrollOldRow) {
  if (row.invoiceIsValid === true)
    return { text: "صالح", tone: "emerald" as const };
  if (row.invoiceIsValid === false)
    return { text: "غير صالح", tone: "red" as const };
  return { text: "-", tone: "slate" as const };
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-5 left-5 z-[90] flex max-w-sm items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-800 shadow-2xl">
      <span>{message}</span>
      <button
        type="button"
        onClick={onClose}
        className="rounded-xl bg-slate-100 px-3 py-1 text-xs font-black text-slate-700"
      >
        إغلاق
      </button>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  tone = "slate",
}: {
  title: string;
  value: string | number;
  tone?: "slate" | "emerald" | "amber" | "red" | "blue";
}) {
  const classes = {
    slate: "border-slate-200 bg-white text-slate-950",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    red: "border-red-200 bg-red-50 text-red-800",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
  };
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${classes[tone]}`}>
      <p className="text-xs font-black opacity-70">{title}</p>
      <strong className="mt-1 block text-2xl font-black">{value}</strong>
    </div>
  );
}

function Badge({
  text,
  tone,
}: {
  text: string;
  tone: PayrollOldRow["statusTone"] | PayrollOldRow["levelTone"];
}) {
  const classes = {
    slate: "bg-slate-100 text-slate-700",
    emerald: "bg-emerald-100 text-emerald-800",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-red-100 text-red-800",
    blue: "bg-blue-100 text-blue-800",
  };
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${classes[tone]}`}
    >
      {text}
    </span>
  );
}

function orderLevelTone(
  level: string,
): "slate" | "emerald" | "blue" | "red" | "amber" {
  if (level.includes("510")) return "emerald";
  if (level.includes("460") || level.includes("410")) return "blue";
  if (level.includes("350")) return "amber";
  if (level.includes("أقل")) return "red";
  if (level === "A") return "emerald";
  if (level === "B") return "blue";
  return "slate";
}

function noteNumber(row: PayrollOldRow, key: string) {
  const match = String(row.notes || "").match(new RegExp(`${key}=([^|,]+)`));
  if (!match) return 0;
  const value = Number(String(match[1]).trim());
  return Number.isFinite(value) ? value : 0;
}

function noteText(row: PayrollOldRow, key: string) {
  const match = String(row.notes || "").match(new RegExp(`${key}=([^|,]+)`));
  return match ? String(match[1]).trim() : "";
}

function keetaSlabLabel(orders: number, row?: PayrollOldRow) {
  const noteSlab = row ? noteText(row, "slab") : "";
  if (noteSlab) {
    if (noteSlab.includes("510")) return "510 فأكثر";
    if (noteSlab.includes("460")) return "460 - 509";
    if (noteSlab.includes("410")) return "410 - 459";
    if (noteSlab.includes("350")) return "350 - 409";
    if (noteSlab.includes("0")) return "أقل من 350";
  }
  if (orders >= 510) return "510 فأكثر";
  if (orders >= 460) return "460 - 509";
  if (orders >= 410) return "410 - 459";
  if (orders >= 350) return "350 - 409";
  return "أقل من 350";
}

function payrollView(row: PayrollOldRow) {
  const deliveredOrders = row.deliveredOrders || row.orders;
  const extraRate = row.extraOrderRate || 8;
  const extraOrders =
    row.extraOrders ||
    (deliveredOrders >= 510 ? Math.max(0, deliveredOrders - 510) : 0);
  const extraOrdersBonus = row.extraOrdersBonus || extraOrders * extraRate;
  const targetLabel = keetaSlabLabel(deliveredOrders, row);
  const orderLevel = targetLabel;
  const packageTotal =
    row.grossSalary ||
    row.totalEarnings ||
    row.basicSalary +
      row.extraOrdersBonus +
      row.performanceBonus +
      row.manualBonus;
  const requestBonus = row.levelBonus || row.performanceBonus;
  const finalSalary = row.finalSalary || row.netSalary;
  const dailyAverage =
    row.workDays > 0 ? deliveredOrders / row.workDays : deliveredOrders;
  const paidSalaryDays =
    noteNumber(row, "paidSalaryDays") ||
    row.workedDaysForSalary ||
    row.performanceValidDays ||
    row.workDays;
  const paidLeaveDays = noteNumber(row, "paidLeave");
  const invoiceExperience = noteNumber(row, "invoiceExperience");
  const expectedExperience = noteNumber(row, "expectedExperience") || 2000;
  const experienceDeduction = noteNumber(row, "experienceDeduction");

  return {
    deliveredOrders,
    extraRate,
    extraOrders460: extraOrders,
    extraOrders560: 0,
    bonus460: extraOrdersBonus,
    bonus560: experienceDeduction,
    missingOrders: paidSalaryDays,
    missingOrderDeduction: paidLeaveDays,
    orderLevel,
    orderLevelTone: orderLevelTone(orderLevel),
    targetLabel,
    packageTotal,
    requestBonus,
    totalOrderBonus: extraOrdersBonus,
    shortageDeduction: experienceDeduction,
    finalSalary,
    dailyAverage,
    housingAllowance: 0,
    communicationAllowance: 0,
    sourceLabel: row.source === "payrollItem" ? "PayrollRun" : "Driver Data",
    paidSalaryDays,
    paidLeaveDays,
    invoiceExperience,
    expectedExperience,
    experienceDeduction,
  };
}
function detailRows(
  row: PayrollOldRow,
  view: ReturnType<typeof payrollView>,
  tab: DetailTab,
): Array<[string, string | number]> {
  if (tab === "vehicle") {
    return [
      ["نوع السيارة", row.vehicleOwnershipLabel || "-"],
      ["لوحة السيارة", row.vehiclePlate || "-"],
      ["أيام السيارة", number(row.vehicleRentDays)],
      ["الإيجار الشهري الكامل", money(row.vehicleMonthlyRent || COMPANY_CAR_FULL_MONTH_RENT)],
      ["الإيجار اليومي", money(row.vehicleDailyRent || COMPANY_CAR_DAILY_RENT)],
      [
        "قيمة إيجار سيارة الشركة للعرض فقط",
        row.vehicleOwnershipType === "company_car"
          ? money(row.vehicleRentDisplayAmount)
          : "-",
      ],
      [
        "بدل السيارة",
        row.vehicleOwnershipType === "personal_car" ? money(row.carRent) : "-",
      ],
      [
        "قاعدة الحساب",
        row.vehicleOwnershipType === "company_car"
          ? "إيجار يومي × أيام التسليم الفعلية للعرض فقط ولا يخصم من الراتب"
          : "لا يوجد خصم إيجار سيارة",
      ],
    ];
  }

  if (tab === "appDeductions") {
    return [
      ["Deduction / مخالفة تطبيق", money(row.keetaDeduction)],
      ["food compensation / تلف طعام", money(row.keetaFoodCompensation)],
      ["TGA Deduction / خصم TGA", money(row.keetaTgaDeduction)],
      [
        "إجمالي خصومات التطبيق",
        money(row.totalAppDeductions || row.appDeductionsTotal),
      ],
      ["مصدر الخصم", "riderDetail كملخص نهائي"],
      ["riderOrderDetail", "تفاصيل للعرض فقط ولا تخصم مرة ثانية"],
    ];
  }

  if (tab === "internalDeductions") {
    return [
      ["مرحل إداري", money(row.adminCarryoverDeduction)],
      ["سكن", money(row.housingDeduction)],
      ["مخالفات مرورية", money(row.trafficViolationDeduction)],
      ["بنزين", money(row.fuelDeduction || row.fuelTotal)],
      [
        "سلفة",
        money(
          row.advanceDeduction || row.internalAdvances || row.advancesTotal,
        ),
      ],
      ["مرحل السيارات", money(row.vehicleCarryoverDeduction)],
      ["تلفيات سيارة", money(row.vehicleDamageDeduction)],
      ["نسبة تحمل حادث", money(row.accidentLiabilityDeduction)],
      ["إيجار دباب", money(row.bikeRentDeduction)],
      ["إيجار سيارة", "-"],
      ["خصومات K / خصم كفالة", money(row.kafalaDeduction)],
      ["ملاحظات خصم الكفالة", row.kafalaDeductionNotes || "-"],
      ["يوزر", row.userDeductionApplied ? money(row.userDeduction) : "-"],
      ["سبب اليوزر", row.userDeductionReason || "-"],
      ["خصم يدوي", money(row.manualDeduction)],
      ["إجمالي الخصومات", money(row.totalDeductions)],
    ];
  }

  if (tab === "revenue") {
    return [
      [
        "مستحق الشركة من كيتا",
        money(row.keetaTotalPayableAmount || row.companyRevenueFromKeeta),
      ],
      ["Order-Based pricing", money(row.companyGrossRevenue)],
      ["حوافز Keeta", money(row.keetaIncentives)],
      ["خصومات Keeta للعرض المالي", money(row.keetaDeductions)],
      ["الدور المحاسبي", "Company Revenue فقط"],
      ["يدخل في راتب المندوب؟", "لا"],
      ["يؤثر على finalSalary؟", "لا"],
      [
        "ملاحظات",
        row.companyRevenueFromKeeta
          ? "يظهر للتحليل المالي والربحية."
          : "لا يوجد إيراد Keeta معتمد لهذا المندوب.",
      ],
    ];
  }

  if (tab === "performance") {
    return [
      ["Level", row.level || "-"],
      ["نوع العلاقة", row.relationshipType || "-"],
      ["تارجت الطلبات", number(row.monthlyTargetOrders)],
      ["الطلبات", number(row.deliveredOrders || row.orders)],
      ["الطلبات الزائدة", number(row.extraOrders)],
      ["Online Hours", number(row.workingHours)],
      ["On-Time", pct(row.onTimeRate)],
      ["Cancellation", pct(row.cancellationRate)],
      ["Rejection", pct(row.rejectionRate)],
      [
        "KPI",
        row.kpiScore ? `${pct(row.kpiScore)} - ${row.kpiStatus || "-"}` : "-",
      ],
      [
        "Valid Days",
        `${number(row.performanceValidDays)} (${pct(row.performanceValidRate)})`,
      ],
      ["Invoice Validity", invoiceValidity(row).text],
      ["Invoice Reason", row.invoiceValidityReason || "-"],
      ["الحساب", row.account || "-"],
      ["المشرف", row.supervisor || "-"],
      ["ملاحظات", row.notes || "-"],
    ];
  }

  if (tab === "profit") {
    return [
      ["مستحق الشركة من كيتا", money(row.companyRevenueFromKeeta)],
      ["راتب المندوب قبل الخصومات", money(row.grossSalary)],
      [
        "إيجار السيارة/البنزين",
        "لا يدخل في ربح الشركة",
      ],
      ["الربح التقديري", money(row.estimatedCompanyProfit)],
      ["Cost Per Order", money(row.costPerOrder)],
      ["المعادلة", "Keeta Revenue - Gross Salary + Experience/Keeta/Food/User deductions"],
    ];
  }

  if (tab === "audit") {
    return [
      ["الحالة", row.statusLabel || row.status],
      ["آخر تعديل بواسطة", row.lastEditedBy || "-"],
      ["Payroll Run", row.payrollRunId || "-"],
      ["Payroll Item", row.payrollItemId || "-"],
      ["مصدر البيانات", view.sourceLabel],
      ["ملاحظات", row.notes || "-"],
    ];
  }

  return [
    ["الشريحة المختارة", view.targetLabel],
    ["الطلبات المنفذة", number(row.deliveredOrders || row.orders)],
    ["الراتب الأساسي المستحق", money(row.basicSalary)],
    ["الأساسي قبل التقسيم", money(row.baseSalaryBeforeProration)],
    ["أيام الدوام الفعلية", number(row.workedDaysForSalary)],
    ["أيام الإجازة المدفوعة", number(view.paidLeaveDays)],
    ["إجمالي الأيام المدفوعة", number(view.paidSalaryDays)],
    ["البونص", money(row.levelBonus || row.performanceBonus)],
    ["الطلبات الزائدة", number(row.extraOrders)],
    ["قيمة الطلبات الزائدة", money(row.extraOrdersBonus)],
    ["Experience Incentive من الفاتورة", money(view.invoiceExperience)],
    ["خصم فرق Experience", money(view.experienceDeduction)],
    ["إجمالي راتب المندوب", money(row.grossSalary || row.totalEarnings)],
    ["إجمالي الخصومات", money(row.totalDeductions)],
    ["صافي راتب المندوب", money(view.finalSalary)],
  ];
}

function methodLines() {
  return [
    "أقل من 350 طلب: الراتب = عدد الطلبات × 8 ريال، بدون بونص وبدون تأثير للإجازة المدفوعة.",
    "من 350 إلى 409 طلب: راتب أساسي 4500 ريال محسوب حسب الأيام المدفوعة، بدون بونص.",
    "من 410 إلى 459 طلب: راتب أساسي 5200 ريال حسب الأيام المدفوعة + بونص 800 ريال كامل عند تحقيق الشريحة.",
    "من 460 إلى 509 طلب: راتب أساسي 5200 ريال حسب الأيام المدفوعة + بونص 1100 ريال كامل.",
    "من 510 طلب فأكثر: راتب أساسي 5200 ريال حسب الأيام المدفوعة + بونص 1800 ريال + 8 ريال لكل طلب فوق 510.",
    "خصم Experience Incentive = القيمة المتوقعة 2000 ريال - قيمة Experience الموجودة في فاتورة كيتا، والخصم لا يقل عن صفر.",
    "مستحق الشركة من كيتا يظهر للتحليل المالي فقط ولا يدخل في راتب المندوب.",
  ];
}
function extraMethodLines() {
  return [
    "الإجازة المدفوعة: يومان شهريًا كحد أقصى، وتدخل في أيام الراتب الأساسي فقط ولا تزود عدد الطلبات.",
    "البونص لا يتقسم على الأيام؛ إذا حقق المندوب الشريحة يحصل على البونص كامل.",
    "ربح الشركة = مستحق كيتا من الفاتورة - راتب المندوب قبل الخصومات + خصم Experience + مخالفة التطبيق + تلف الطعام + يوزر السيارة الشخصية.",
  ];
}
function buildCsv(rows: PayrollOldRow[]) {
  const headers = [
    "Month",
    "Driver Code",
    "Driver Name",
    "City",
    "Application",
    "Data Source",
    "Work Days",
    "Orders",
    "Salary Slab",
    "Payroll Level / Rank",
    "KPI",
    "Invoice Validity",
    "Performance Valid Days",
    "Basic Salary",
    "Salary Incentive",
    "Vehicle Type",
    "Vehicle Plate",
    "Vehicle Rent Days",
    "Vehicle Daily Rent",
    "Personal Car Allowance",
    "Company Car Rent Display Only",
    "Base Salary Before Proration",
    "Worked Days For Salary",
    "Salary Base Days",
    "Fuel",
    "Housing",
    "Communication",
    "Target Bonus",
    "Extra Orders",
    "Extra Order Amount",
    "Invoice Experience Incentive",
    "Experience Difference Deduction",
    "Gross Salary",
    "Advances",
    "Admin Deduction",
    "Keeta Deduction",
    "Food Compensation",
    "TGA Deduction",
    "Total App Deductions",
    "Kafala Deduction",
    "Freelancer User Deduction",
    "Total Deductions",
    "Paid Salary Days",
    "Paid Leave Days",
    "Net Salary",
    "Keeta Payable To Company",
    "Estimated Company Profit",
    "Status",
  ];
  const body = rows
    .map((row) => {
      const view = payrollView(row);
      return [
        row.month,
        row.driverCode,
        row.driverName,
        row.city,
        row.appName,
        view.sourceLabel,
        row.workDays,
        view.deliveredOrders,
        view.targetLabel,
        row.level,
        row.kpiScore,
        invoiceValidity(row).text,
        row.performanceValidDays,
        row.basicSalary,
        row.performanceBonus,
        row.vehicleOwnershipLabel,
        row.vehiclePlate,
        row.vehicleRentDays,
        row.vehicleDailyRent,
        row.carRent,
        row.vehicleRentDisplayAmount,
        row.baseSalaryBeforeProration,
        row.workedDaysForSalary,
        row.salaryBaseWorkingDays,
        row.fuelTotal,
        view.housingAllowance,
        view.communicationAllowance,
        view.requestBonus,
        view.extraOrders460,
        view.bonus460,
        view.invoiceExperience,
        view.experienceDeduction,
        view.packageTotal,
        row.advancesTotal,
        row.otherDeductions,
        row.keetaDeduction,
        row.keetaFoodCompensation,
        row.keetaTgaDeduction,
        appDeductionTotal(row),
        row.kafalaDeduction,
        row.userDeductionApplied || row.userDeduction ? row.userDeduction : 0,
        row.totalDeductions,
        view.paidSalaryDays,
        view.paidLeaveDays,
        view.finalSalary,
        row.companyRevenueFromKeeta,
        row.estimatedCompanyProfit,
        row.statusLabel,
      ]
        .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
        .join(",");
    })
    .join("\n");
  return `\uFEFF${headers.join(",")}\n${body}`;
}

function monthRangeQuery(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) return { fromDate: "", toDate: "" };
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  end.setUTCDate(end.getUTCDate() - 1);
  return {
    fromDate: start.toISOString().slice(0, 10),
    toDate: end.toISOString().slice(0, 10),
  };
}

function riderReportHref(row: PayrollOldRow) {
  const params = new URLSearchParams();
  const { fromDate, toDate } = monthRangeQuery(row.month);
  if (row.driverId) params.set("driverId", row.driverId);
  if (fromDate) params.set("dateFrom", fromDate);
  if (toDate) params.set("dateTo", toDate);
  if (row.appName && row.appName !== "-") params.set("appName", row.appName);
  return `/rider-reports?${params.toString()}`;
}

export function PayrollOldPageClient({ data }: Props) {
  const router = useRouter();
  const [toast, setToast] = useState("");
  const [selected, setSelected] = useState<PayrollOldRow | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("salary");
  const [editing, setEditing] = useState<PayrollOldRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const rows = useMemo(() => data.rows.slice(0, 200), [data.rows]);
  const oldSummary = useMemo(() => {
    return rows.reduce(
      (summary, row) => {
        const view = payrollView(row);
        summary.riders += 1;
        if (view.deliveredOrders >= 510) summary.target560 += 1;
        else if (view.deliveredOrders >= 410) summary.target460 += 1;
        else if (view.deliveredOrders >= 350) summary.between350409 += 1;
        else summary.under460 += 1;
        summary.totalPackages += view.packageTotal;
        summary.performanceBonuses += view.requestBonus;
        summary.missingOrderDeductions += view.shortageDeduction;
        summary.netPayroll += view.finalSalary;
        if (row.vehicleOwnershipType === "company_car")
          summary.companyCars += 1;
        if (row.vehicleOwnershipType === "personal_car")
          summary.personalCars += 1;
        summary.companyCarRentDeduction += row.vehicleRentDisplayAmount;
        return summary;
      },
      {
        riders: 0,
        target560: 0,
        target460: 0,
        under460: 0,
        between350409: 0,
        totalPackages: 0,
        performanceBonuses: 0,
        missingOrderDeductions: 0,
        netPayroll: 0,
        companyCars: 0,
        personalCars: 0,
        companyCarRentDeduction: 0,
      },
    );
  }, [rows]);

  function filterHref(extra: Record<string, string>) {
    const params = new URLSearchParams();
    if (data.filters.month) params.set("month", data.filters.month);
    if (data.filters.cityId) params.set("cityId", data.filters.cityId);
    if (data.filters.projectId) params.set("projectId", data.filters.projectId);
    if (data.filters.deductionFilter)
      params.set("deductionFilter", data.filters.deductionFilter);
    if (data.filters.status) params.set("status", data.filters.status);
    if (data.filters.q) params.set("q", data.filters.q);
    for (const [key, value] of Object.entries(extra)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    return `/payroll?${params.toString()}`;
  }

  function openDetails(row: PayrollOldRow) {
    setDetailTab("salary");
    setEditing(row);
    setSelected(row);
  }

  function closeDetails() {
    setSelected(null);
    setEditing(null);
  }

  function exportCsv() {
    const blob = new Blob([buildCsv(data.rows)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `payroll-${data.filters.month}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setToast("تم تجهيز ملف CSV قابل للفتح على Excel.");
  }

  async function generatePayroll() {
    if (
      !window.confirm(
        "سيتم توليد أو تحديث مسودات المسير فقط. السجلات المعتمدة أو المقفلة لن تتغير.",
      )
    )
      return;
    setGenerating(true);
    try {
      const res = await fetch("/api/payroll/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: data.filters.month,
          cityId: data.filters.cityId,
          projectId: data.filters.projectId,
          applicationProjectId: data.filters.projectId,
          q: data.filters.q,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        data?: { created?: number; updated?: number; skippedLocked?: number };
        error?: string;
      };
      if (!res.ok) throw new Error(payload.error || "تعذر توليد المسير.");
      setToast(
        `تم توليد المسير. جديد: ${payload.data?.created ?? 0}، تحديث: ${payload.data?.updated ?? 0}، متخطى: ${payload.data?.skippedLocked ?? 0}.`,
      );
      router.refresh();
    } catch (error) {
      setToast(error instanceof Error ? error.message : "تعذر توليد المسير.");
    } finally {
      setGenerating(false);
    }
  }

  async function approve(row: PayrollOldRow) {
    if (row.payrollRunId) {
      if (!window.confirm(`اعتماد مسير ${row.month}؟`)) return;
      const res = await fetch(`/api/payroll-runs/${row.payrollRunId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "APPROVED" }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        details?: { problems?: string[] };
      };
      if (!res.ok) {
        const problems = payload.details?.problems?.slice(0, 3).join(" | ");
        setToast(
          problems
            ? `${payload.error} ${problems}`
            : payload.error || "تعذر اعتماد المسير.",
        );
        return;
      }
      setToast("تم اعتماد PayrollRun بعد التحقق من شروط المسير.");
      router.refresh();
      return;
    }
    if (!row.payrollId) {
      setToast(
        "اعتماد PayrollRun الكامل سيتم في مرحلة لاحقة. هذا الصف محفوظ كـ PayrollItem.",
      );
      return;
    }
    if (!window.confirm(`اعتماد مسير ${row.driverName}؟`)) return;
    const res = await fetch(`/api/payroll/${row.payrollId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "APPROVED" }),
    });
    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      setToast(payload.error || "تعذر اعتماد السجل.");
      return;
    }
    setToast("تم اعتماد سجل المسير.");
    router.refresh();
  }

  async function saveManualEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) {
      setToast("التعديل اليدوي متاح حاليًا لسجلات Payroll القديمة فقط.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const basicSalary = Number(form.get("basicSalary") || 0);
    const performanceBonus = Number(form.get("performanceBonus") || 0);
    const extraOrderRate = Number(form.get("extraOrderRate") || 0);
    const orders = Number(form.get("orders") || 0);
    const monthlyTargetOrders = Number(form.get("monthlyTargetOrders") || 0);
    const manualBonus = Number(form.get("manualBonus") || 0);
    const internalAdvances = Number(form.get("internalAdvances") || 0);
    const internalPenalties = Number(form.get("internalPenalties") || 0);
    const rawCarRent = Number(form.get("carRent") || editing.carRent || 0);
    const fuelTotal = Number(form.get("fuelTotal") || editing.fuelTotal || 0);
    const vehicleOwnershipType = String(
      form.get("vehicleOwnershipType") ||
        editing.vehicleOwnershipType ||
        "no_vehicle",
    );
    const vehicleRentDays = Number(
      form.get("vehicleRentDays") || editing.vehicleRentDays || 0,
    );
    const vehicleDailyRent = vehicleOwnershipType === "company_car" ? COMPANY_CAR_DAILY_RENT : 0;
    const vehicleMonthlyRent = vehicleOwnershipType === "company_car" ? COMPANY_CAR_FULL_MONTH_RENT : 0;
    const vehicleRentDisplayAmount = vehicleOwnershipType === "company_car" ? companyCarRentByDays(vehicleRentDays) : 0;
    const carRent = 0;
    const carRentDeduction = 0;
    const fuelDeduction = Number(
      form.get("fuelDeduction") || editing.fuelDeduction || 0,
    );
    const keetaDeduction = Number(
      form.get("keetaDeduction") || editing.keetaDeduction || 0,
    );
    const keetaFoodCompensation = Number(
      form.get("keetaFoodCompensation") || editing.keetaFoodCompensation || 0,
    );
    const keetaTgaDeduction = Number(
      form.get("keetaTgaDeduction") || editing.keetaTgaDeduction || 0,
    );
    const totalAppDeductions = Number(
      form.get("totalAppDeductions") ||
        keetaDeduction + keetaFoodCompensation + keetaTgaDeduction ||
        editing.totalAppDeductions ||
        editing.appDeductionsTotal ||
        0,
    );
    const kafalaDeduction = Number(
      form.get("kafalaDeduction") || editing.kafalaDeduction || 0,
    );
    const userDeduction = vehicleOwnershipType === "personal_car" ? PERSONAL_CAR_USER_DEDUCTION : Number(form.get("userDeduction") || editing.userDeduction || 0);
    const otherDeductions = Number(form.get("otherDeductions") || 0);
    const shortageOrders = Number(
      form.get("shortageOrders") || editing.shortageOrders || 0,
    );
    const shortageDeduction = Number(
      form.get("shortageDeduction") || editing.shortageDeduction || 0,
    );
    const salaryBaseWorkingDays = Number(
      form.get("salaryBaseWorkingDays") || editing.salaryBaseWorkingDays || 28,
    );
    const workedDaysForSalary = Number(
      form.get("workedDaysForSalary") ||
        editing.workedDaysForSalary ||
        editing.workDays ||
        0,
    );
    const baseSalaryBeforeProration = Number(
      form.get("baseSalaryBeforeProration") ||
        editing.baseSalaryBeforeProration ||
        basicSalary ||
        0,
    );
    const manualDeduction = Number(
      form.get("manualDeduction") || shortageDeduction || 0,
    );
    const extraOrders = Math.max(0, orders - monthlyTargetOrders);
    const extraOrdersBonus = Number(
      form.get("extraOrdersBonus") || extraOrders * extraOrderRate,
    );
    const totalDeductions =
      internalAdvances +
      internalPenalties +
      carRentDeduction +
      fuelDeduction +
      totalAppDeductions +
      kafalaDeduction +
      userDeduction +
      otherDeductions +
      manualDeduction;
    const netSalary =
      basicSalary +
      extraOrdersBonus +
      performanceBonus +
      manualBonus +
      carRent +
      fuelTotal -
      totalDeductions;
    setSaving(true);
    try {
      const endpoint = editing.payrollItemId
        ? `/api/payroll-items/${editing.payrollItemId}`
        : `/api/payroll/${editing.payrollId}`;
      const requestBody = editing.payrollItemId
        ? {
            level: String(form.get("level") || editing.level || ""),
            relationshipType: String(
              form.get("relationshipType") || editing.relationshipType || "",
            ),
            vehicleOwnershipType,
            vehicleRentDays,
            vehicleDailyRent,
            vehicleMonthlyRent,
            vehicleRentDisplayAmount,
            orders,
            deliveredOrders: orders,
            monthlyTargetOrders,
            extraOrderRate,
            shortageOrders,
            shortageDeduction,
            salaryBaseWorkingDays,
            workedDaysForSalary,
            baseSalaryBeforeProration,
            basicSalary,
            extraOrdersBonus,
            performanceBonus,
            levelBonus: performanceBonus,
            manualBonus,
            carRent,
            fuelTotal,
            internalAdvances,
            internalPenalties,
            carRentDeduction,
            fuelDeduction,
            keetaDeduction,
            keetaFoodCompensation,
            keetaTgaDeduction,
            totalAppDeductions,
            appDeductionsTotal: totalAppDeductions,
            kafalaDeduction,
            userDeduction,
            otherDeductions,
            manualDeduction,
            notes: String(form.get("notes") || editing.notes || ""),
          }
        : {
            basicSalary,
            bonus: performanceBonus + extraOrdersBonus + manualBonus,
            deductions: totalDeductions,
            netSalary,
          };
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) throw new Error(payload.error || "تعذر حفظ التعديل اليدوي.");
      setEditing(null);
      setSelected(null);
      setToast("تم حفظ التعديل اليدوي.");
      router.refresh();
    } catch (error) {
      setToast(
        error instanceof Error ? error.message : "تعذر حفظ التعديل اليدوي.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (data.databaseStatus === "offline") {
    return (
      <section
        className="w-full max-w-none space-y-4 bg-slate-50 p-4"
        dir="rtl"
      >
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900 shadow-sm">
          <h1 className="text-2xl font-black">مسير الرواتب</h1>
          <p className="mt-2 text-sm font-bold">{data.databaseMessage}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full max-w-none space-y-4 bg-slate-50 p-4" dir="rtl">
      {toast ? <Toast message={toast} onClose={() => setToast("")} /> : null}

      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <nav className="mb-1 text-xs font-black text-slate-500">
            الرئيسية &gt; الماليات &gt; مسير الرواتب
          </nav>
          <h1 className="text-3xl font-black text-slate-950">مسير الرواتب</h1>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            جدول المسير التشغيلي المرتبط بالطلبات، السلف، المخالفات، البنزين،
            إيجار السيارة وصافي الراتب.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800 shadow-sm hover:bg-slate-50"
        >
          رجوع
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void generatePayroll()}
              disabled={generating}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
            >
              {generating ? "جاري التوليد..." : "توليد مسير الشهر"}
            </button>
            <Link
              href="/payroll/settings"
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-blue-700"
            >
              إعدادات المسير
            </Link>
            <button
              type="button"
              onClick={exportCsv}
              className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-amber-600"
            >
              تصدير إكسل
            </button>
            <Link
              href={filterHref({ vehicleOwnershipType: "company_car" })}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-slate-800"
            >
              مناديب سيارة شركة
            </Link>
            <Link
              href={filterHref({ deductionFilter: "app_deductions" })}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-red-700"
            >
              عليهم خصومات تطبيق
            </Link>
            <Link
              href={filterHref({ vehicleOwnershipType: "" })}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800 shadow-sm hover:bg-slate-50"
            >
              عرض كل السيارات
            </Link>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800 shadow-sm hover:bg-slate-50"
            >
              طباعة / PDF
            </button>
          </div>
        </div>
      </div>

      <form
        method="get"
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-8">
          <label
            className="grid gap-1 text-xs font-black text-slate-800"
            htmlFor="payroll-month"
          >
            الشهر
            <input
              id="payroll-month"
              name="month"
              defaultValue={data.filters.month}
              type="month"
              className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold"
            />
          </label>
          <label
            className="grid gap-1 text-xs font-black text-slate-800"
            htmlFor="payroll-city"
          >
            المدينة
            <select
              id="payroll-city"
              name="cityId"
              defaultValue={data.filters.cityId}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold"
            >
              <option value="">كل المدن</option>
              {data.options.cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
          </label>
          <label
            className="grid gap-1 text-xs font-black text-slate-800"
            htmlFor="payroll-project"
          >
            المشروع
            <select
              id="payroll-project"
              name="projectId"
              defaultValue={data.filters.projectId}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold"
            >
              <option value="">كل المشاريع</option>
              {data.options.projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label
            className="grid gap-1 text-xs font-black text-slate-800"
            htmlFor="payroll-status"
          >
            الحالة
            <select
              id="payroll-status"
              name="status"
              defaultValue={data.filters.status}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold"
            >
              <option value="">كل الحالات</option>
              <option value="DRAFT">مسودة</option>
              <option value="UNDER_REVIEW">قيد المراجعة</option>
              <option value="APPROVED">معتمد</option>
              <option value="PAID">مدفوع</option>
              <option value="LOCKED">مقفل</option>
            </select>
          </label>
          <label
            className="grid gap-1 text-xs font-black text-slate-800"
            htmlFor="payroll-search"
          >
            بحث مندوب / كود / حساب
            <input
              id="payroll-search"
              name="q"
              defaultValue={data.filters.q}
              className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold"
            />
          </label>
          <label
            className="grid gap-1 text-xs font-black text-slate-800"
            htmlFor="payroll-vehicle-ownership"
          >
            نوع السيارة
            <select
              id="payroll-vehicle-ownership"
              name="vehicleOwnershipType"
              defaultValue={data.filters.vehicleOwnershipType}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold"
            >
              <option value="">كل أنواع السيارات</option>
              <option value="company_car">سيارة شركة</option>
              <option value="personal_car">سيارة شخصية</option>
              <option value="no_vehicle">بدون سيارة</option>
            </select>
          </label>
          <label
            className="grid gap-1 text-xs font-black text-slate-800"
            htmlFor="payroll-deduction-filter"
          >
            فلتر الخصومات
            <select
              id="payroll-deduction-filter"
              name="deductionFilter"
              defaultValue={data.filters.deductionFilter}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold"
            >
              <option value="">كل الخصومات</option>
              <option value="app_deductions">خصومات التطبيق</option>
              <option value="car_rent">إيجار سيارة شركة</option>
              <option value="kafala">خصم كفالة K</option>
              <option value="user">يوزر فريلانسر</option>
              <option value="advances">سلف</option>
              <option value="violations">مخالفات</option>
            </select>
          </label>
          <button
            type="submit"
            className="self-end rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-slate-800"
          >
            تطبيق
          </button>
        </div>
      </form>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="عدد المناديب"
          value={number(oldSummary.riders)}
          tone="blue"
        />
        <SummaryCard
          title="شريحة 510 فأكثر"
          value={number(oldSummary.target560)}
          tone="emerald"
        />
        <SummaryCard
          title="شرائح 410 - 509"
          value={number(oldSummary.target460)}
          tone="blue"
        />
        <SummaryCard
          title="شريحة 350 - 409"
          value={number(oldSummary.between350409)}
          tone="amber"
        />
        <SummaryCard
          title="أقل من 350"
          value={number(oldSummary.under460)}
          tone="red"
        />
        <SummaryCard
          title="إجمالي المستحقات"
          value={money(oldSummary.totalPackages)}
        />
        <SummaryCard
          title="إجمالي البونص"
          value={money(oldSummary.performanceBonuses)}
          tone="emerald"
        />
        <SummaryCard
          title="خصم فرق Experience"
          value={money(oldSummary.missingOrderDeductions)}
          tone="red"
        />
        <SummaryCard
          title="صافي المسير"
          value={money(oldSummary.netPayroll)}
          tone={oldSummary.netPayroll < 0 ? "red" : "emerald"}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="مناديب سيارة شركة"
          value={number(oldSummary.companyCars)}
          tone="blue"
        />
        <SummaryCard
          title="مناديب سيارة شخصية"
          value={number(oldSummary.personalCars)}
          tone="emerald"
        />
        <SummaryCard
          title="قيمة إيجار سيارات الشركة للعرض"
          value={money(oldSummary.companyCarRentDeduction)}
          tone="blue"
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <h2 className="text-lg font-black text-slate-950">
            طريقة الحساب المعتمدة
          </h2>
          <div className="mt-3 space-y-2 text-sm font-bold leading-7 text-slate-800">
            {[...methodLines(), ...extraMethodLines()].map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>
        {rows.length ? (
          <div className="max-h-[68vh] overflow-auto rounded-xl border border-slate-100">
            <table className="w-full min-w-[3920px] border-separate border-spacing-0 text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700">
                  {[
                    "الشهر",
                    "المندوب",
                    "المدينة",
                    "التطبيق",
                    "مصدر البيانات",
                    "الأيام",
                    "الطلبات",
                    "الشريحة",
                    "LEVEL",
                    "KPI",
                    "صلاحية الفاتورة",
                    "Valid Days",
                    "الراتب الأساسي المستحق",
                    "البونص",
                    "بدل السيارة",
                    "نوع السيارة",
                    "أيام إيجار",
                    "إيجار يومي",
                    "قيمة إيجار سيارة الشركة",
                    "البنزين/بدل",
                    "الأيام المدفوعة",
                    "الإجازة المدفوعة",
                    "بونص التارجت",
                    "طلبات زائدة",
                    "قيمة الطلبات الزائدة",
                    "Experience من الفاتورة",
                    "خصم فرق Experience",
                    "إجمالي المستحقات",
                    "السلف",
                    "خصم إداري",
                    "مخالفة تطبيق",
                    "تلف طعام",
                    "خصم TGA",
                    "خصومات التطبيق",
                    "خصم كفالة K",
                    "يوزر",
                    "إجمالي الخصومات",
                    "أيام مدفوعة",
                    "إجازة مدفوعة",
                    "صافي الراتب",
                    "مستحق الشركة من كيتا",
                    "إجراء",
                    "ربح الشركة",
                  ].map((head, index) => (
                    <th
                      key={`${head}-${index}`}
                      className={`whitespace-nowrap border-b border-slate-200 bg-slate-100 px-3 py-3 text-right font-black ${
                        index === 0
                          ? "sticky right-0 top-0 z-40 w-[78px]"
                          : index === 1
                            ? "sticky right-[78px] top-0 z-40 min-w-[220px] shadow-[-10px_0_16px_-16px_rgba(15,23,42,0.9)]"
                            : "sticky top-0 z-20"
                      }`}
                    >
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const view = payrollView(row);
                  return (
                    <tr
                      key={`old-${row.id}`}
                      className="group hover:bg-slate-50"
                    >
                      <td className="sticky right-0 z-30 border-b border-slate-100 bg-white px-3 py-3 font-bold group-hover:bg-slate-50">
                        {row.month}
                      </td>
                      <td className="sticky right-[78px] z-30 min-w-[220px] border-b border-slate-100 bg-white px-3 py-3 shadow-[-10px_0_16px_-16px_rgba(15,23,42,0.9)] group-hover:bg-slate-50">
                        <button
                          type="button"
                          onClick={() => openDetails(row)}
                          className="text-right font-black text-slate-950 hover:text-blue-700"
                        >
                          {row.driverName}
                        </button>
                        <div className="text-[11px] font-bold text-slate-500">
                          {row.driverCode}
                        </div>
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 font-bold">
                        {row.city}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 font-bold">
                        {row.appName}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 font-bold">
                        {view.sourceLabel}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 font-bold">
                        {number(row.workDays)}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 font-black">
                        {number(view.deliveredOrders)}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3">
                        <Badge
                          text={view.targetLabel}
                          tone={view.orderLevelTone}
                        />
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3">
                        <Badge
                          text={
                            row.level === "-" ? "Level C" : `Level ${row.level}`
                          }
                          tone={row.levelTone}
                        />
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3">
                        <Badge
                          text={row.kpiScore ? pct(row.kpiScore) : "-"}
                          tone={kpiTone(row.kpiScore)}
                        />
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3">
                        <Badge
                          text={invoiceValidity(row).text}
                          tone={invoiceValidity(row).tone}
                        />
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 font-bold">
                        {row.performanceValidDays
                          ? `${number(row.performanceValidDays)} / ${pct(row.performanceValidRate)}`
                          : "-"}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 font-bold">
                        {money(row.basicSalary)}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 font-bold">
                        {money(row.performanceBonus)}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 font-bold">
                        {carAllowanceText(row)}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 font-bold">
                        {row.vehicleOwnershipLabel}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 font-bold">
                        {number(row.vehicleRentDays)}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 font-bold">
                        {money(row.vehicleDailyRent)}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 font-black text-blue-700">
                        {companyCarRentText(row)}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 font-bold">
                        {money(row.fuelTotal)}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 font-bold">
                        {number(view.paidSalaryDays)}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 font-bold">
                        {number(view.paidLeaveDays)}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 font-bold">
                        {money(view.requestBonus)}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 font-bold">
                        {number(view.extraOrders460)}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 font-bold">
                        {money(view.bonus460)}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 font-bold">
                        {money(view.invoiceExperience)}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 font-bold">
                        {money(view.experienceDeduction)}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 font-black">
                        {money(view.packageTotal)}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 font-bold">
                        {money(row.internalAdvances || row.advancesTotal)}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 font-bold">
                        {money(
                          row.adminCarryoverDeduction +
                            row.otherDeductions +
                            row.manualDeduction,
                        )}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 font-bold text-red-700">
                        {moneyOrDash(row.keetaDeduction)}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 font-bold text-red-700">
                        {moneyOrDash(row.keetaFoodCompensation)}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 font-bold text-red-700">
                        {moneyOrDash(row.keetaTgaDeduction)}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 font-black text-red-700">
                        {moneyOrDash(appDeductionTotal(row))}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 font-bold text-red-700">
                        {moneyOrDash(row.kafalaDeduction)}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 font-bold text-red-700">
                        {row.userDeductionApplied || row.userDeduction
                          ? money(row.userDeduction)
                          : "-"}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 font-black text-red-700">
                        {money(row.totalDeductions)}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 font-bold">
                        {number(view.paidSalaryDays)}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 font-black text-red-700">
                        {number(view.paidLeaveDays)}
                      </td>
                      <td
                        className={`border-b border-slate-100 px-3 py-3 font-black ${view.finalSalary < 0 ? "text-red-700" : "text-emerald-700"}`}
                      >
                        {money(view.finalSalary)}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3 font-black text-blue-700">
                        {row.companyRevenueFromKeeta
                          ? money(row.companyRevenueFromKeeta)
                          : "-"}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-3">
                        <div className="flex min-w-[135px] gap-1">
                          <button
                            type="button"
                            onClick={() => openDetails(row)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-800 hover:bg-slate-50"
                          >
                            تفاصيل
                          </button>
                          <button
                            type="button"
                            onClick={() => openDetails(row)}
                            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-black text-white hover:bg-blue-700"
                          >
                            تعديل
                          </button>
                          <button
                            type="button"
                            onClick={() => void approve(row)}
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-black text-white hover:bg-emerald-700"
                          >
                            اعتماد
                          </button>
                          <button
                            type="button"
                            onClick={() => void generatePayroll()}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-800 hover:bg-slate-50"
                          >
                            إعادة حساب
                          </button>
                        </div>
                      </td>
                      <td
                        className={`border-b border-slate-100 px-3 py-3 font-black ${row.estimatedCompanyProfit < 0 ? "text-red-700" : "text-emerald-700"}`}
                      >
                        {row.companyRevenueFromKeeta
                          ? money(row.estimatedCompanyProfit)
                          : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <h2 className="text-xl font-black text-slate-900">
              لا توجد سجلات مسير لهذا الشهر
            </h2>
            <p className="mt-2 text-sm font-bold text-slate-500">
              أنشئ مسير الشهر بعد اعتماد تقارير المشروع والفواتير، أو غيّر
              الفلاتر الحالية.
            </p>
            <button
              type="button"
              onClick={() => void generatePayroll()}
              className="mt-4 rounded-xl bg-emerald-600 px-5 py-2 text-sm font-black text-white"
            >
              توليد مسير الشهر
            </button>
          </div>
        )}
      </div>

      <div className="hidden">
        <h2 className="text-lg font-black text-slate-950">
          طريقة الحساب المعتمدة
        </h2>
        <div className="mt-3 space-y-2 text-sm font-bold leading-7 text-slate-800">
          {[...methodLines(), ...extraMethodLines()].map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </div>

      <div className="hidden">
        <SummaryCard
          title="سجلات المسير"
          value={number(data.summary.totalRows)}
          tone="blue"
        />
        <SummaryCard
          title="صافي راتب المناديب"
          value={money(data.summary.netSalary)}
          tone={data.summary.netSalary < 0 ? "red" : "emerald"}
        />
        <SummaryCard
          title="إيراد Keeta للشركة"
          value={money(data.summary.companyRevenueFromKeeta)}
          tone="emerald"
        />
        <SummaryCard
          title="الربح التقديري"
          value={money(data.summary.estimatedCompanyProfit)}
          tone={data.summary.estimatedCompanyProfit < 0 ? "red" : "emerald"}
        />
        <SummaryCard
          title="إجمالي الأساسي"
          value={money(data.summary.basicSalary)}
        />
        <SummaryCard
          title="إجمالي البونص"
          value={money(data.summary.bonuses)}
          tone="emerald"
        />
        <SummaryCard
          title="إجمالي الخصومات"
          value={money(data.summary.deductions)}
          tone="red"
        />
        <SummaryCard
          title="مسودات"
          value={number(data.summary.draft)}
          tone="amber"
        />
        <SummaryCard
          title="Level A"
          value={number(data.summary.levelA)}
          tone="emerald"
        />
        <SummaryCard
          title="Level B"
          value={number(data.summary.levelB)}
          tone="blue"
        />
        <SummaryCard
          title="Level C"
          value={number(data.summary.levelC)}
          tone="red"
        />
        <SummaryCard
          title="السلف"
          value={money(data.summary.advances)}
          tone="amber"
        />
        <SummaryCard
          title="المخالفات"
          value={money(data.summary.violations)}
          tone="red"
        />
        <SummaryCard
          title="البنزين/بدل"
          value={money(data.summary.fuel)}
          tone="amber"
        />
      </div>

      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-950 shadow-sm">
        {data.insight}
      </div>

      <div className="hidden">
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-[2150px] w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="bg-slate-100 text-xs font-black text-slate-700">
                  {[
                    "المندوب",
                    "المدينة",
                    "المشروع",
                    "التطبيق",
                    "الحساب",
                    "لوحة السيارة",
                    "Level",
                    "الطلبات",
                    "الطلبات الزائدة",
                    "الساعات",
                    "On-Time",
                    "إلغاء",
                    "رفض",
                    "الأساسي",
                    "قيمة الطلبات الزائدة",
                    "البونص",
                    "السلف",
                    "المخالفات",
                    "بنزين",
                    "قيمة إيجار سيارة الشركة",
                    "خصومات التطبيق",
                    "إجمالي الخصومات",
                    "صافي راتب المندوب",
                    "مستحق الشركة من كيتا",
                    "الربح التقديري",
                    "الحالة",
                  ].map((head, index) => (
                    <th
                      key={`${head}-${index}`}
                      className="whitespace-nowrap px-3 py-3 text-right"
                    >
                      {head}
                    </th>
                  ))}
                  <th className="sticky left-0 z-10 rounded-l-xl bg-slate-100 px-3 py-3 text-right">
                    إجراءات
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="border-b border-slate-100 px-3 py-4">
                      <button
                        type="button"
                        onClick={() => openDetails(row)}
                        className="text-right font-black text-slate-950 hover:text-blue-700"
                      >
                        {row.driverName}
                      </button>
                      <div className="text-xs font-medium text-slate-500">
                        {row.driverCode} · {row.nationalId}
                      </div>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">
                      {row.city}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">
                      {row.project}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">
                      {row.appName}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">
                      {row.account}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">
                      {row.vehiclePlate}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-4">
                      <Badge
                        text={
                          row.level === "-" ? "غير محدد" : `Level ${row.level}`
                        }
                        tone={row.levelTone}
                      />
                    </td>
                    <td className="border-b border-slate-100 px-3 py-4 font-black">
                      {number(row.orders)}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">
                      {number(row.extraOrders)}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">
                      {number(row.workingHours)}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">
                      {pct(row.onTimeRate)}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">
                      {pct(row.cancellationRate)}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">
                      {pct(row.rejectionRate)}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">
                      {money(row.basicSalary)}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">
                      {money(row.extraOrdersBonus)}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">
                      {money(row.performanceBonus)}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">
                      {money(row.advancesTotal)}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">
                      {money(row.violationsTotal)}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">
                      {money(row.fuelTotal)}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">
                      {companyCarRentText(row)}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-4 font-bold">
                      {moneyOrDash(appDeductionTotal(row))}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-4 font-black text-red-700">
                      {money(row.totalDeductions)}
                    </td>
                    <td
                      className={`border-b border-slate-100 px-3 py-4 font-black ${row.finalSalary < 0 ? "text-red-700" : "text-emerald-700"}`}
                    >
                      {money(row.finalSalary)}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-4 font-black text-blue-700">
                      {row.companyRevenueFromKeeta
                        ? money(row.companyRevenueFromKeeta)
                        : "-"}
                    </td>
                    <td
                      className={`border-b border-slate-100 px-3 py-4 font-black ${row.estimatedCompanyProfit < 0 ? "text-red-700" : "text-emerald-700"}`}
                    >
                      {row.companyRevenueFromKeeta
                        ? money(row.estimatedCompanyProfit)
                        : "-"}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-4">
                      <Badge text={row.statusLabel} tone={row.statusTone} />
                    </td>
                    <td className="sticky left-0 z-10 border-b border-slate-100 bg-white px-3 py-4">
                      <div className="flex min-w-[220px] flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => openDetails(row)}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-black text-slate-800 hover:bg-slate-50"
                        >
                          تفاصيل
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditing(row)}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-black text-slate-800 hover:bg-slate-50"
                        >
                          تعديل يدوي
                        </button>
                        <button
                          type="button"
                          onClick={() => void approve(row)}
                          className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-black text-white hover:bg-emerald-700"
                        >
                          اعتماد
                        </button>
                        <button
                          type="button"
                          onClick={() => void generatePayroll()}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-black text-slate-800 hover:bg-slate-50"
                        >
                          إعادة حساب
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <h2 className="text-xl font-black text-slate-900">
              لا توجد سجلات مسير لهذا الشهر
            </h2>
            <p className="mt-2 text-sm font-bold text-slate-500">
              يمكن توليد مسير من KPI بعد استيراد التقارير اليومية أو استيراد ملف
              مسير من صفحة الاستيراد.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => void generatePayroll()}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-black text-white"
              >
                توليد مسير الشهر
              </button>
              <Link
                href="/imports/preview?importType=payroll"
                className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-black text-white"
              >
                استيراد ملف مسير
              </Link>
            </div>
          </div>
        )}
      </div>

      {selected ? (
        <div
          className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/45 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[88vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black text-slate-950">
                  تفاصيل مسير {selected.driverName}
                </h2>
                <p className="text-sm font-bold text-slate-500">
                  {selected.driverCode} · {selected.month}
                </p>
              </div>
              <button
                type="button"
                onClick={closeDetails}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700"
              >
                إغلاق
              </button>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <SummaryCard
                title="إجمالي راتب المندوب"
                value={money(selected.grossSalary || selected.totalEarnings)}
                tone="emerald"
              />
              <SummaryCard
                title="صافي راتب المندوب"
                value={money(selected.finalSalary)}
                tone={selected.finalSalary < 0 ? "red" : "blue"}
              />
              <SummaryCard
                title="مستحق الشركة من كيتا"
                value={money(selected.companyRevenueFromKeeta)}
                tone="blue"
              />
              <SummaryCard
                title="هامش الربح التقديري"
                value={money(selected.estimatedCompanyProfit)}
                tone={selected.estimatedCompanyProfit < 0 ? "red" : "emerald"}
              />
            </div>

            {(() => {
              const view = payrollView(selected);
              return (
                <div className="mt-5 space-y-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <SummaryCard
                      title="مستوى الطلبات"
                      value={view.orderLevel}
                      tone={view.orderLevelTone}
                    />
                    <SummaryCard
                      title="ليفل المسير"
                      value={selected.level === "-" ? "C" : selected.level}
                      tone={selected.levelTone}
                    />
                    <SummaryCard
                      title="صافي المستحق"
                      value={money(view.finalSalary)}
                      tone={view.finalSalary < 0 ? "red" : "emerald"}
                    />
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold leading-8 text-slate-900">
                    <h3 className="mb-2 text-lg font-black">
                      طريقة حساب Keeta الجديدة
                    </h3>
                    <p>
                      الطلبات: {number(view.deliveredOrders)} | متوسط الطلبات
                      اليومية: {Math.round(view.dailyAverage * 10) / 10}
                    </p>
                    <p>
                      الشريحة المختارة: {view.targetLabel} | إجمالي المستحقات:{" "}
                      {money(view.packageTotal)}
                    </p>
                    <p>
                      الطلبات الزائدة: {number(view.extraOrders460)} ×{" "}
                      {money(view.extraRate)} = {money(view.bonus460)}
                    </p>
                    <p>
                      Experience Incentive من الفاتورة:{" "}
                      {money(view.invoiceExperience)} | خصم فرق Experience:{" "}
                      {money(view.experienceDeduction)}
                    </p>
                    <p>
                      الأيام المدفوعة: {number(view.paidSalaryDays)} يوم، منها
                      إجازة مدفوعة: {number(view.paidLeaveDays)} يوم.
                    </p>
                    <p>
                      احتساب الأساسي: الراتب الأساسي ÷ 30 × الأيام المدفوعة.
                      الناتج: {money(selected.basicSalary)}
                    </p>
                    <p>
                      قيمة إيجار سيارة الشركة للعرض فقط:{" "}
                      {selected.vehicleOwnershipLabel} |{" "}
                      {number(selected.vehicleRentDays)} يوم ×{" "}
                      {money(selected.vehicleDailyRent)} ={" "}
                      {money(selected.vehicleRentDisplayAmount)}
                    </p>
                    <p>
                      الصافي النهائي = إجمالي راتب المندوب - إجمالي الخصومات
                      الرسمية = {money(view.finalSalary)}
                    </p>
                    <p className="text-blue-800">
                      مستحق الشركة من كيتا:{" "}
                      {money(selected.companyRevenueFromKeeta)} للعرض المالي
                      فقط، ولا يدخل في راتب المندوب.
                    </p>
                  </div>

                  <div className="grid gap-2 md:grid-cols-2">
                    {[
                      ["المشرف", selected.supervisor],
                      ["المندوب", selected.driverName],
                      ["مصدر البيانات", view.sourceLabel],
                      ["المدينة", selected.city],
                      ["إجمالي حوافز الطلبات", money(view.totalOrderBonus)],
                      ["أيام العمل", number(selected.workDays)],
                      ["خصم فرق Experience", money(view.experienceDeduction)],
                      [
                        "سلف معلقة",
                        money(
                          selected.internalAdvances || selected.advancesTotal,
                        ),
                      ],
                      ["التطبيق", selected.appName],
                      ["حساب التطبيق", selected.account],
                      ["السيارة", selected.vehiclePlate],
                      ["نوع السيارة", selected.vehicleOwnershipLabel],
                      ["أيام إيجار السيارة", number(selected.vehicleRentDays)],
                      ["إيجار يومي", money(selected.vehicleDailyRent)],
                      [
                        "قيمة إيجار سيارة الشركة للعرض فقط",
                        money(selected.vehicleRentDisplayAmount),
                      ],
                      [
                        "هامش الربح التقديري",
                        money(selected.estimatedCompanyProfit),
                      ],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-xl border border-slate-200 bg-white p-3"
                      >
                        <p className="text-xs font-black text-slate-500">
                          {label}
                        </p>
                        <p className="mt-1 text-sm font-black text-slate-950">
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>

                  <form
                    onSubmit={saveManualEdit}
                    className="rounded-2xl border border-slate-200 bg-white p-4"
                  >
                    <h3 className="text-lg font-black text-slate-950">
                      تعديل ليفل المسير والتفاصيل
                    </h3>
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <label className="grid gap-1 text-xs font-black text-slate-800">
                        ليفل المسير
                        <select
                          name="level"
                          defaultValue={
                            selected.level === "-" ? "C" : selected.level
                          }
                          className="h-10 rounded-xl border border-slate-200 bg-white px-3"
                        >
                          <option value="A">Level A</option>
                          <option value="B">Level B</option>
                          <option value="C">Level C</option>
                        </select>
                      </label>
                      <label className="grid gap-1 text-xs font-black text-slate-800">
                        مستوى الطلبات
                        <select
                          name="monthlyTargetOrders"
                          defaultValue={
                            selected.monthlyTargetOrders ||
                            (view.orderLevel === "A" ? 560 : 460)
                          }
                          className="h-10 rounded-xl border border-slate-200 bg-white px-3"
                        >
                          <option value="560">A / 560</option>
                          <option value="460">B / 460</option>
                        </select>
                      </label>
                      <label className="grid gap-1 text-xs font-black text-slate-800">
                        الطلبات
                        <input
                          name="orders"
                          type="number"
                          defaultValue={view.deliveredOrders}
                          className="h-10 rounded-xl border border-slate-200 px-3"
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-black text-slate-800">
                        الراتب الأساسي
                        <input
                          name="basicSalary"
                          type="number"
                          step="0.01"
                          defaultValue={selected.basicSalary}
                          className="h-10 rounded-xl border border-slate-200 px-3"
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-black text-slate-800">
                        سعر الطلب الزائد
                        <input
                          name="extraOrderRate"
                          type="number"
                          step="0.01"
                          defaultValue={selected.extraOrderRate || 8}
                          className="h-10 rounded-xl border border-slate-200 px-3"
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-black text-slate-800">
                        حافز الطلبات
                        <input
                          name="extraOrdersBonus"
                          type="number"
                          step="0.01"
                          defaultValue={
                            selected.extraOrdersBonus || view.totalOrderBonus
                          }
                          className="h-10 rounded-xl border border-slate-200 px-3"
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-black text-slate-800">
                        حافز الأداء
                        <input
                          name="performanceBonus"
                          type="number"
                          step="0.01"
                          defaultValue={view.requestBonus}
                          className="h-10 rounded-xl border border-slate-200 px-3"
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-black text-slate-800">
                        بونص يدوي
                        <input
                          name="manualBonus"
                          type="number"
                          step="0.01"
                          defaultValue={selected.manualBonus}
                          className="h-10 rounded-xl border border-slate-200 px-3"
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-black text-slate-800">
                        السلف
                        <input
                          name="internalAdvances"
                          type="number"
                          step="0.01"
                          defaultValue={
                            selected.internalAdvances || selected.advancesTotal
                          }
                          className="h-10 rounded-xl border border-slate-200 px-3"
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-black text-slate-800">
                        المخالفات
                        <input
                          name="internalPenalties"
                          type="number"
                          step="0.01"
                          defaultValue={
                            selected.internalPenalties ||
                            selected.violationsTotal
                          }
                          className="h-10 rounded-xl border border-slate-200 px-3"
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-black text-slate-800">
                        نوع السيارة
                        <select
                          name="vehicleOwnershipType"
                          defaultValue={selected.vehicleOwnershipType}
                          className="h-10 rounded-xl border border-slate-200 bg-white px-3"
                        >
                          <option value="company_car">سيارة شركة</option>
                          <option value="personal_car">سيارة شخصية</option>
                          <option value="no_vehicle">بدون سيارة</option>
                        </select>
                      </label>
                      <label className="grid gap-1 text-xs font-black text-slate-800">
                        أيام إيجار السيارة
                        <input
                          name="vehicleRentDays"
                          type="number"
                          defaultValue={selected.vehicleRentDays}
                          className="h-10 rounded-xl border border-slate-200 px-3"
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-black text-slate-800">
                        إيجار يومي
                        <input
                          name="vehicleDailyRent"
                          type="number"
                          step="0.01"
                          defaultValue={selected.vehicleDailyRent}
                          className="h-10 rounded-xl border border-slate-200 px-3"
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-black text-slate-800">
                        إيجار شهري
                        <input
                          name="vehicleMonthlyRent"
                          type="number"
                          step="0.01"
                          defaultValue={selected.vehicleMonthlyRent}
                          className="h-10 rounded-xl border border-slate-200 px-3"
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-black text-slate-800">
                        بدل السيارة الشخصية
                        <input
                          name="carRent"
                          type="number"
                          step="0.01"
                          defaultValue={selected.carRent}
                          className="h-10 rounded-xl border border-slate-200 px-3"
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-black text-slate-800">
                        البنزين
                        <input
                          name="fuelTotal"
                          type="number"
                          step="0.01"
                          defaultValue={selected.fuelTotal}
                          className="h-10 rounded-xl border border-slate-200 px-3"
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-black text-slate-800">
                        الأساسي قبل التقسيم
                        <input
                          name="baseSalaryBeforeProration"
                          type="number"
                          step="0.01"
                          defaultValue={selected.baseSalaryBeforeProration}
                          className="h-10 rounded-xl border border-slate-200 px-3"
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-black text-slate-800">
                        أيام الدوام للراتب
                        <input
                          name="workedDaysForSalary"
                          type="number"
                          defaultValue={selected.workedDaysForSalary}
                          className="h-10 rounded-xl border border-slate-200 px-3"
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-black text-slate-800">
                        حد الشهر الكامل
                        <input
                          name="salaryBaseWorkingDays"
                          type="number"
                          defaultValue={selected.salaryBaseWorkingDays || 28}
                          className="h-10 rounded-xl border border-slate-200 px-3"
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-black text-slate-800">
                        طلبات ناقصة
                        <input
                          name="shortageOrders"
                          type="number"
                          defaultValue={
                            selected.shortageOrders || view.missingOrders
                          }
                          className="h-10 rounded-xl border border-slate-200 px-3"
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-black text-slate-800">
                        خصم فرق Experience
                        <input
                          name="shortageDeduction"
                          type="number"
                          step="0.01"
                          defaultValue={
                            selected.shortageDeduction || view.shortageDeduction
                          }
                          className="h-10 rounded-xl border border-slate-200 px-3"
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-black text-slate-800">
                        خصم إداري
                        <input
                          name="otherDeductions"
                          type="number"
                          step="0.01"
                          defaultValue={selected.otherDeductions}
                          className="h-10 rounded-xl border border-slate-200 px-3"
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-black text-slate-800">
                        خصم يدوي
                        <input
                          name="manualDeduction"
                          type="number"
                          step="0.01"
                          defaultValue={
                            selected.manualDeduction || view.shortageDeduction
                          }
                          className="h-10 rounded-xl border border-slate-200 px-3"
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-black text-slate-800">
                        مخالفة تطبيق Keeta
                        <input
                          name="keetaDeduction"
                          type="number"
                          step="0.01"
                          defaultValue={selected.keetaDeduction}
                          className="h-10 rounded-xl border border-slate-200 px-3"
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-black text-slate-800">
                        تلف طعام
                        <input
                          name="keetaFoodCompensation"
                          type="number"
                          step="0.01"
                          defaultValue={selected.keetaFoodCompensation}
                          className="h-10 rounded-xl border border-slate-200 px-3"
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-black text-slate-800">
                        خصم TGA
                        <input
                          name="keetaTgaDeduction"
                          type="number"
                          step="0.01"
                          defaultValue={selected.keetaTgaDeduction}
                          className="h-10 rounded-xl border border-slate-200 px-3"
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-black text-slate-800">
                        إجمالي خصومات التطبيق
                        <input
                          name="totalAppDeductions"
                          type="number"
                          step="0.01"
                          defaultValue={
                            selected.totalAppDeductions ||
                            selected.appDeductionsTotal
                          }
                          className="h-10 rounded-xl border border-slate-200 px-3"
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-black text-slate-800">
                        خصومات K / كفالة
                        <input
                          name="kafalaDeduction"
                          type="number"
                          step="0.01"
                          defaultValue={selected.kafalaDeduction}
                          className="h-10 rounded-xl border border-slate-200 px-3"
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-black text-slate-800">
                        يوزر فريلانسر
                        <input
                          name="userDeduction"
                          type="number"
                          step="0.01"
                          defaultValue={selected.userDeduction}
                          className="h-10 rounded-xl border border-slate-200 px-3"
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-black text-slate-800 md:col-span-3">
                        ملاحظات
                        <input
                          name="notes"
                          defaultValue={selected.notes}
                          className="h-10 rounded-xl border border-slate-200 px-3"
                        />
                      </label>
                    </div>
                    <div className="mt-4 flex flex-wrap justify-between gap-2">
                      <Link
                        href={riderReportHref(selected)}
                        className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white"
                      >
                        فتح تقرير المندوب
                      </Link>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={closeDetails}
                          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800"
                        >
                          إغلاق
                        </button>
                        <button
                          type="submit"
                          disabled={saving}
                          className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-black text-white disabled:opacity-60"
                        >
                          {saving ? "جاري الحفظ..." : "تحديث التفاصيل"}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              );
            })()}

            <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-200 pt-4">
              {[
                ["salary", "ملخص الراتب"],
                ["vehicle", "السيارة"],
                ["appDeductions", "خصومات التطبيق"],
                ["internalDeductions", "الخصومات الداخلية"],
                ["revenue", "إيراد الشركة"],
                ["performance", "الأداء والتقييم"],
                ["profit", "هامش الربح"],
                ["audit", "Audit Log"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setDetailTab(key as typeof detailTab)}
                  className={`rounded-xl px-4 py-2 text-sm font-black ${detailTab === key ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-700"}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {detailRows(selected, payrollView(selected), detailTab).map(
                ([label, value]) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <p className="text-xs font-black text-slate-500">{label}</p>
                    <p className="mt-1 text-sm font-black text-slate-950">
                      {value}
                    </p>
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      ) : null}

      {editing && !selected ? (
        <div
          className="fixed inset-0 z-[85] grid place-items-center bg-slate-950/45 p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={saveManualEdit}
            className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black text-slate-950">
                  تعديل يدوي للمسير
                </h2>
                <p className="text-sm font-bold text-slate-500">
                  {editing.driverName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700"
              >
                إغلاق
              </button>
            </div>
            {!editing.payrollId ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
                هذا الصف من PayrollItem. التعديل اليدوي التفصيلي له سيتم في
                مرحلة ربط PayrollRun.
              </div>
            ) : null}
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <label className="grid gap-1 text-xs font-black text-slate-800">
                الراتب الأساسي
                <input
                  name="basicSalary"
                  type="number"
                  step="0.01"
                  defaultValue={editing.basicSalary}
                  className="h-11 rounded-xl border border-slate-200 px-3"
                />
              </label>
              <label className="grid gap-1 text-xs font-black text-slate-800">
                البونص
                <input
                  name="bonus"
                  type="number"
                  step="0.01"
                  defaultValue={
                    editing.performanceBonus + editing.extraOrdersBonus
                  }
                  className="h-11 rounded-xl border border-slate-200 px-3"
                />
              </label>
              <label className="grid gap-1 text-xs font-black text-slate-800">
                الخصومات
                <input
                  name="deductions"
                  type="number"
                  step="0.01"
                  defaultValue={editing.totalDeductions}
                  className="h-11 rounded-xl border border-slate-200 px-3"
                />
              </label>
              <label className="grid gap-1 text-xs font-black text-slate-800">
                صافي راتب المندوب
                <input
                  name="netSalary"
                  type="number"
                  step="0.01"
                  defaultValue={editing.finalSalary || editing.netSalary}
                  className="h-11 rounded-xl border border-slate-200 px-3"
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-800"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={saving || !editing.payrollId}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white disabled:opacity-60"
              >
                {saving ? "جاري الحفظ..." : "حفظ التعديل"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
