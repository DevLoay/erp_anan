import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ImportColumn = {
  key: string;
  displayName: string;
  required?: boolean;
  dataType: "string" | "number" | "date" | "boolean";
  aliases?: string[];
};

export type ImportColumnMapping = {
  incomingColumn: string;
  systemField: string;
  required?: boolean;
  transformRule?: string;
};

export type ImportTemplateDefinition = {
  fileType: string;
  name: string;
  category: "drivers" | "vehicles" | "applications" | "operations" | "finance" | "hr" | "payroll";
  applicationCode?: "KEETA" | "HUNGERSTATION" | "TALABAT";
  requiredColumns: ImportColumn[];
  optionalColumns: ImportColumn[];
  columnMapping: ImportColumnMapping[];
  matchingFields: string[];
  uniqueKeys: string[];
};

export type ImportTemplateRow = {
  id: string;
  source: "database" | "builtin";
  name: string;
  fileType: string;
  category: string;
  applicationId: string;
  applicationName: string;
  applicationProjectId: string;
  projectName: string;
  requiredColumnsCount: number;
  optionalColumnsCount: number;
  mappingStatus: string;
  lastUsedAt: string;
  status: string;
  requiredColumns: ImportColumn[];
  optionalColumns: ImportColumn[];
  columnMapping: ImportColumnMapping[];
};

export type ImportTemplatesData = {
  databaseStatus: "online" | "offline";
  databaseMessage?: string;
  summary: {
    total: number;
    active: number;
    applicationTemplates: number;
    driverTemplates: number;
    vehicleTemplates: number;
    financeTemplates: number;
    needsMapping: number;
    lastUsed: string;
  };
  filters: {
    fileType: string;
    applicationId: string;
    applicationProjectId: string;
    status: string;
    q: string;
  };
  applications: { id: string; code: string; name: string }[];
  projects: { id: string; code: string; name: string; applicationId: string }[];
  rows: ImportTemplateRow[];
};

type SearchParams = Record<string, string | string[] | undefined>;

function one(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export function resolveImportTemplateFilters(params: SearchParams): ImportTemplatesData["filters"] {
  return {
    fileType: one(params, "fileType"),
    applicationId: one(params, "applicationId"),
    applicationProjectId: one(params, "applicationProjectId"),
    status: one(params, "status"),
    q: one(params, "q").trim().toLowerCase(),
  };
}

const baseDriverColumns: ImportColumn[] = [
  {
    key: "driverCode",
    displayName: "كود المندوب",
    required: true,
    dataType: "string",
    aliases: ["driver_code", "internalCode", "كود", "كود المندوب", "Driver Code"],
  },
  {
    key: "nationalId",
    displayName: "رقم الإقامة",
    required: false,
    dataType: "string",
    aliases: ["national_id", "id", "iqama", "رقم الهوية", "رقم الإقامة", "Iqama ID"],
  },
  {
    key: "actualName",
    displayName: "اسم المندوب",
    required: true,
    dataType: "string",
    aliases: ["name", "driverName", "اسم", "اسم المندوب", "Arabic Driver Name (HR Approved)"],
  },
];

const driverMasterTemplateOptionalColumns: ImportColumn[] = [
  { key: "city", displayName: "المدينة", dataType: "string", aliases: ["city", "المدينة", "City"] },
  { key: "project", displayName: "المشروع الحالي", dataType: "string", aliases: ["project", "المشروع", "Current Project"] },
  { key: "applicationName", displayName: "اسم التطبيق", dataType: "string", aliases: ["application", "appName", "التطبيق", "Primary App Name"] },
  { key: "contractType", displayName: "نوع العلاقة", dataType: "string", aliases: ["contract", "نوع العقد", "Relationship Type"] },
  { key: "nationality", displayName: "الجنسية", dataType: "string", aliases: ["الجنسية", "Nationality"] },
  { key: "profession", displayName: "المهنة", dataType: "string", aliases: ["المهنة", "Profession"] },
  { key: "passportNumber", displayName: "رقم الجواز", dataType: "string", aliases: ["رقم الجواز", "Passport Number"] },
  { key: "passportExpiry", displayName: "انتهاء الجواز", dataType: "date", aliases: ["انتهاء الجواز", "Passport Expiry"] },
  { key: "iqamaExpiry", displayName: "انتهاء الإقامة", dataType: "date", aliases: ["انتهاء الإقامة", "Iqama Expiry"] },
  { key: "birthDate", displayName: "تاريخ الميلاد", dataType: "date", aliases: ["تاريخ الميلاد", "Birth Date"] },
  { key: "employerId", displayName: "رقم صاحب العمل", dataType: "string", aliases: ["رقم صاحب العمل", "Employer ID"] },
  { key: "accommodationType", displayName: "نوع السكن", dataType: "string", aliases: ["السكن", "نوع السكن", "Housing Type"] },
  { key: "vehicleOwnership", displayName: "ملكية السيارة", dataType: "string", aliases: ["ملكية السيارة", "Vehicle Ownership"] },
  {
    key: "appUserId",
    displayName: "App Courier ID",
    dataType: "string",
    aliases: [
      "App Courier ID",
      "Keeta Courier ID",
      "Courier ID",
      "Keeta Driver ID",
      "App Driver ID",
      "appUserId",
      "courierId",
    ],
  },
  {
    key: "appUsername",
    displayName: "App Account Name English",
    dataType: "string",
    aliases: [
      "App Account Name English",
      "Keeta Account Name English",
      "Keeta Account Name",
      "Account Name English",
      "appUsername",
      "username",
    ],
  },
  { key: "appStatus", displayName: "Driver App Status", dataType: "string", aliases: ["Driver App Status", "Keeta Status", "appStatus", "status"] },
  { key: "mobile", displayName: "رقم الجوال", dataType: "string", aliases: ["phone", "mobile", "الجوال", "Login Phone"] },
  { key: "notes", displayName: "ملاحظات", dataType: "string", aliases: ["ملاحظات", "Notes"] },
  { key: "inHrResources", displayName: "In HR Resources", dataType: "boolean", aliases: ["In HR Resources", "inHrResources"] },
];

const commonPerformanceColumns: ImportColumn[] = [
  { key: "orders", displayName: "الطلبات", required: true, dataType: "number", aliases: ["orders", "completed_orders", "طلبات"] },
  { key: "workingHours", displayName: "ساعات العمل", required: false, dataType: "number", aliases: ["working_hours", "hours", "ساعات العمل"] },
  { key: "onTimeRate", displayName: "On Time %", required: false, dataType: "number", aliases: ["on_time", "ontime", "onTime"] },
  { key: "cancellationRate", displayName: "Cancellation %", required: false, dataType: "number", aliases: ["cancellation", "cancel"] },
  { key: "rejectionRate", displayName: "Rejection %", required: false, dataType: "number", aliases: ["rejection", "reject"] },
];

const moneyColumns: ImportColumn[] = [
  { key: "amount", displayName: "المبلغ", required: true, dataType: "number", aliases: ["amount", "value", "مبلغ"] },
  { key: "date", displayName: "التاريخ", required: true, dataType: "date", aliases: ["date", "createdAt", "تاريخ"] },
];

const keetaDailyReportRequiredColumns: ImportColumn[] = [
  { key: "reportDate", displayName: "Date", required: true, dataType: "date", aliases: [" Date", "Date", "date"] },
  { key: "appUserId", displayName: "Courier ID", required: true, dataType: "string", aliases: ["Courier ID", "courier_id", "courierId", "userId"] },
  { key: "orders", displayName: "Task Volumes_Delivered Tasks", required: true, dataType: "number", aliases: ["Task Volumes_Delivered Tasks", "Delivered Tasks", "orders"] },
];

const keetaDailyReportOptionalColumns: ImportColumn[] = [
  { key: "courierFirstName", displayName: "Courier First Name", dataType: "string", aliases: ["Courier First Name", "firstName"] },
  { key: "courierLastName", displayName: "Courier Last Name", dataType: "string", aliases: ["Courier Last Name", "lastName"] },
  { key: "supervisorName", displayName: "Supervisor", dataType: "string", aliases: ["Supervisor", "supervisor"] },
  { key: "vehicleType", displayName: "Vehicle Type", dataType: "string", aliases: ["Vehicle Type", "vehicleType"] },
  { key: "attendanceSummary", displayName: "Shift_Attendance Summary", dataType: "string", aliases: ["Shift_Attendance Summary"] },
  { key: "onShift", displayName: "Shift_On-Shift?", dataType: "string", aliases: ["Shift_On-Shift?", "onShift"] },
  { key: "validDay", displayName: "Shift_Valid Day?", dataType: "string", aliases: ["Shift_Valid Day?", "validDay"] },
  { key: "courierAppOnlineTime", displayName: "Shift_Courier App Online Time", dataType: "string", aliases: ["Shift_Courier App Online Time"] },
  { key: "workingHours", displayName: "Shift_Valid Online Time", dataType: "string", aliases: ["Shift_Valid Online Time", "workingHours"] },
  { key: "peakOnlineHours", displayName: "Shift_Peak Online Hours", dataType: "string", aliases: ["Shift_Peak Online Hours"] },
  { key: "acceptedTasks", displayName: "Task Volumes_Accepted Tasks", dataType: "number", aliases: ["Task Volumes_Accepted Tasks"] },
  { key: "restaurantArrivalTasks", displayName: "Task Volumes_Tasks with restaurant arrivals", dataType: "number", aliases: ["Task Volumes_Tasks with restaurant arrivals"] },
  { key: "largeOrderTasksCompleted", displayName: "Task Volumes_Large Order Tasks Completed", dataType: "number", aliases: ["Task Volumes_Large Order Tasks Completed"] },
  { key: "rejectionRate", displayName: "Task Volumes_Rejected Tasks", dataType: "number", aliases: ["Task Volumes_Rejected Tasks", "rejection"] },
  { key: "rejectedTasksCourier", displayName: "Task Volumes_Rejected Tasks (Courier)", dataType: "number", aliases: ["Task Volumes_Rejected Tasks (Courier)"] },
  { key: "rejectedTasksAuto", displayName: "Task Volumes_Rejected Tasks (Auto)", dataType: "number", aliases: ["Task Volumes_Rejected Tasks (Auto)"] },
  { key: "cancellationRate", displayName: "Task Volumes_Cancellation Rate from Delivery Issues", dataType: "number", aliases: ["Task Volumes_Cancellation Rate from Delivery Issues", "cancellation"] },
  { key: "completionRate", displayName: "Task Volumes_Order completion rate (non-delivery related)", dataType: "number", aliases: ["Task Volumes_Order completion rate (non-delivery related)"] },
  { key: "onTimeRate", displayName: "Delivery Experience_On-time Rate (D)", dataType: "number", aliases: ["Delivery Experience_On-time Rate (D)", "onTimeRate", "on_time"] },
  { key: "largeOrderOnTimeRate", displayName: "Delivery Experience_Large order on-time rate", dataType: "number", aliases: ["Delivery Experience_Large order on-time rate"] },
  { key: "averageDeliveryTime", displayName: "Delivery Experience_Avg Delivery Time of Delivered Orders", dataType: "string", aliases: ["Delivery Experience_Avg Delivery Time of Delivered Orders"] },
  { key: "deliveredOver55minRate", displayName: "Delivery Experience_Delivered Orders Prop. (Over 55min)", dataType: "number", aliases: ["Delivery Experience_Delivered Orders Prop. (Over 55min)"] },
  { key: "overdueOrderTasks", displayName: "Delivery Experience_Overdue Order Tasks", dataType: "number", aliases: ["Delivery Experience_Overdue Order Tasks"] },
  { key: "severelyOverdueOrderTasks", displayName: "Delivery Experience_Severely Overdue Order Tasks", dataType: "number", aliases: ["Delivery Experience_Severely Overdue Order Tasks"] },
];

export const KEETA_RANK_TEMPLATE = "keeta_rank_template";
export const KEETA_PERIOD_REPORT_TEMPLATE = "keeta_period_report_template";
export const KEETA_DRIVER_INVOICE_TEMPLATE = "keeta_driver_invoice_template";

const keetaRankRequiredColumns: ImportColumn[] = [
  { key: "courierId", displayName: "Courier ID", required: true, dataType: "string", aliases: ["Courier ID", "courierId", "appUserId", "App Driver ID"] },
  { key: "courierName", displayName: "Name", required: true, dataType: "string", aliases: ["Name", "Courier name", "courierName"] },
  { key: "currentEstimatedLevel", displayName: "Current estimated level", required: true, dataType: "string", aliases: ["Current estimated level", "rank", "level"] },
];

const keetaRankOptionalColumns: ImportColumn[] = [
  { key: "currentEstimatedRanking", displayName: "Current estimated ranking", dataType: "number", aliases: ["Current estimated ranking"] },
  { key: "courierRankingPercentile", displayName: "Courier ranking percentile", dataType: "number", aliases: ["Courier ranking percentile"] },
  { key: "currentScoreForForcedAssignment", displayName: "Current score for forced assignment", dataType: "number", aliases: ["Current score for forced assignment"] },
  { key: "currentEstimatedRewardAmount", displayName: "Current estimated reward amount", dataType: "number", aliases: ["Current estimated reward amount", "rewardAmount"] },
  { key: "onTimeRate", displayName: "On-time rate", dataType: "number", aliases: ["On-time rate", "On Time", "onTimeRate"] },
  { key: "orderCompletionRate", displayName: "Order completion % (non-delivery related)", dataType: "number", aliases: ["Order completion % (non-delivery related)", "orderCompletionRate"] },
  { key: "dropOffNotEarlyRate", displayName: "Didn't tap drop-off too early (%)", dataType: "number", aliases: ["Didn't tap drop-off too early (%)", "Didn't tap \"drop-off\" too early (%)", "dropOffNotEarlyRate"] },
  { key: "orderVolume", displayName: "Order volume", dataType: "number", aliases: ["Order volume", "orders"] },
  { key: "driverCode", displayName: "Driver Code", dataType: "string", aliases: ["Driver Code", "internalCode"] },
  { key: "nationalId", displayName: "National ID", dataType: "string", aliases: ["National ID", "nationalId"] },
];

const keetaPeriodReportRequiredColumns: ImportColumn[] = [
  { key: "reportDate", displayName: "Date", required: true, dataType: "date", aliases: ["Date", "date"] },
  { key: "courierId", displayName: "Courier ID", required: true, dataType: "string", aliases: ["Courier ID", "courierId", "appUserId", "App Driver ID"] },
  { key: "deliveredTasks", displayName: "Task Volumes_Delivered Tasks", required: true, dataType: "number", aliases: ["Task Volumes_Delivered Tasks", "Delivered Tasks", "orders"] },
];

const keetaPeriodReportOptionalColumns: ImportColumn[] = [
  { key: "courierFirstName", displayName: "Courier First Name", dataType: "string", aliases: ["Courier First Name", "firstName"] },
  { key: "courierLastName", displayName: "Courier Last Name", dataType: "string", aliases: ["Courier Last Name", "lastName"] },
  { key: "supervisorName", displayName: "Supervisor", dataType: "string", aliases: ["Supervisor", "supervisor"] },
  { key: "vehicleType", displayName: "Vehicle Type", dataType: "string", aliases: ["Vehicle Type", "vehicleType"] },
  { key: "shiftAttendanceSummary", displayName: "Shift_Attendance Summary", dataType: "string", aliases: ["Shift_Attendance Summary"] },
  { key: "onShift", displayName: "Shift_On-Shift?", dataType: "boolean", aliases: ["Shift_On-Shift?", "onShift"] },
  { key: "validDay", displayName: "Shift_Valid Day?", dataType: "boolean", aliases: ["Shift_Valid Day?", "validDay"] },
  { key: "courierAppOnlineTime", displayName: "Shift_Courier App Online Time", dataType: "number", aliases: ["Shift_Courier App Online Time"] },
  { key: "validOnlineTime", displayName: "Shift_Valid Online Time", dataType: "number", aliases: ["Shift_Valid Online Time", "workingHours"] },
  { key: "peakOnlineHours", displayName: "Shift_Peak Online Hours", dataType: "number", aliases: ["Shift_Peak Online Hours"] },
  { key: "acceptedTasks", displayName: "Task Volumes_Accepted Tasks", dataType: "number", aliases: ["Task Volumes_Accepted Tasks"] },
  { key: "tasksWithRestaurantArrivals", displayName: "Task Volumes_Tasks with restaurant arrivals", dataType: "number", aliases: ["Task Volumes_Tasks with restaurant arrivals"] },
  { key: "largeOrderTasksCompleted", displayName: "Task Volumes_Large Order Tasks Completed", dataType: "number", aliases: ["Task Volumes_Large Order Tasks Completed"] },
  { key: "rejectedTasks", displayName: "Task Volumes_Rejected Tasks", dataType: "number", aliases: ["Task Volumes_Rejected Tasks", "rejection"] },
  { key: "rejectedTasksCourier", displayName: "Task Volumes_Rejected Tasks (Courier)", dataType: "number", aliases: ["Task Volumes_Rejected Tasks (Courier)"] },
  { key: "rejectedTasksAuto", displayName: "Task Volumes_Rejected Tasks (Auto)", dataType: "number", aliases: ["Task Volumes_Rejected Tasks (Auto)"] },
  { key: "cancellationRateFromDeliveryIssues", displayName: "Task Volumes_Cancellation Rate from Delivery Issues", dataType: "number", aliases: ["Task Volumes_Cancellation Rate from Delivery Issues", "cancellation"] },
  { key: "orderCompletionRateNonDelivery", displayName: "Task Volumes_Order completion rate (non-delivery related)", dataType: "number", aliases: ["Task Volumes_Order completion rate (non-delivery related)"] },
  { key: "onTimeRate", displayName: "Delivery Experience_On-time Rate (D)", dataType: "number", aliases: ["Delivery Experience_On-time Rate (D)", "On-time Rate", "onTimeRate"] },
  { key: "largeOrderOnTimeRate", displayName: "Delivery Experience_Large order on-time rate", dataType: "number", aliases: ["Delivery Experience_Large order on-time rate"] },
  { key: "avgDeliveryTime", displayName: "Delivery Experience_Avg Delivery Time of Delivered Orders", dataType: "number", aliases: ["Delivery Experience_Avg Delivery Time of Delivered Orders"] },
  { key: "deliveredOrdersOver55MinPercent", displayName: "Delivery Experience_Delivered Orders Prop. (Over 55min)", dataType: "number", aliases: ["Delivery Experience_Delivered Orders Prop. (Over 55min)"] },
  { key: "overdueOrderTasks", displayName: "Delivery Experience_Overdue Order Tasks", dataType: "number", aliases: ["Delivery Experience_Overdue Order Tasks"] },
  { key: "severelyOverdueOrderTasks", displayName: "Delivery Experience_Severely Overdue Order Tasks", dataType: "number", aliases: ["Delivery Experience_Severely Overdue Order Tasks"] },
];

const keetaDriverInvoiceRequiredColumns: ImportColumn[] = [
  { key: "courierId", displayName: "Courier ID", required: true, dataType: "string", aliases: ["Courier ID", "courierId", "appUserId"] },
  { key: "totalPayableAmount", displayName: "مستحق الشركة من كيتا", required: true, dataType: "number", aliases: ["Total payable amount", "Keeta Payable to Company", "Company Revenue from Keeta", "totalPayableAmount"] },
];

const keetaDriverInvoiceOptionalColumns: ImportColumn[] = [
  { key: "partnerId", displayName: "Partner ID", dataType: "string", aliases: ["Partner ID"] },
  { key: "partnerName", displayName: "Partner Name", dataType: "string", aliases: ["Partner Name"] },
  { key: "billingCycle", displayName: "Billing Cycle", dataType: "string", aliases: ["Billing Cycle"] },
  { key: "courierName", displayName: "Courier name", dataType: "string", aliases: ["Courier name", "Name"] },
  { key: "isValid", displayName: "Is Valid", dataType: "boolean", aliases: ["Is Valid"] },
  { key: "reason", displayName: "Reason", dataType: "string", aliases: ["Reason"] },
  { key: "onlineDaysValid", displayName: "Online Days-Valid", dataType: "number", aliases: ["Online Days-Valid"] },
  { key: "dailyOnlineHoursValid", displayName: "Daily Onlines Hours-Valid", dataType: "number", aliases: ["Daily Onlines Hours-Valid"] },
  { key: "dailyOnlineHoursPeakValid", displayName: "Daily Onlines Hours During Peak Time -Valid", dataType: "number", aliases: ["Daily Onlines Hours During Peak Time -Valid"] },
  { key: "deliveredOrders", displayName: "Delivered Orders", dataType: "number", aliases: ["Delivered Orders", "orders"] },
  { key: "orderBasedPricing", displayName: "Order-Based pricing", dataType: "number", aliases: ["Order-Based pricing"] },
  { key: "distanceFromPriceIncrease", displayName: "Distance from price increase", dataType: "number", aliases: ["Distance from price increase"] },
  { key: "validDaCapacityIncentives", displayName: "Valid DA Capacity Incentives", dataType: "number", aliases: ["Valid DA Capacity Incentives"] },
  { key: "experienceIncentive", displayName: "Experience incentive", dataType: "number", aliases: ["Experience incentive"] },
  { key: "dxgy", displayName: "DXGY", dataType: "number", aliases: ["DXGY"] },
  { key: "subsidy", displayName: "Subsidy", dataType: "number", aliases: ["Subsidy"] },
  { key: "activitiesAndOtherRewards", displayName: "Activities and other rewards", dataType: "number", aliases: ["Activities and other rewards"] },
  { key: "deduction", displayName: "Deduction", dataType: "number", aliases: ["Deduction"] },
  { key: "foodCompensation", displayName: "food compensation", dataType: "number", aliases: ["food compensation"] },
  { key: "registrationServiceFee", displayName: "Registration service fee", dataType: "number", aliases: ["Registration service fee"] },
  { key: "otherAdjustment", displayName: "Other Adjustment", dataType: "number", aliases: ["Other Adjustment"] },
  { key: "tipsExcludingTax", displayName: "Tips (excluding tax)", dataType: "number", aliases: ["Tips (excluding tax)"] },
  { key: "tgaDeductionVatExcluded", displayName: "TGA Deduction(VAT Excluded)", dataType: "number", aliases: ["TGA Deduction(VAT Excluded)"] },
];

const hungerStationInvoiceRequiredColumns: ImportColumn[] = [
  { key: "appUserId", displayName: "rider_id", required: true, dataType: "string", aliases: ["rider_id", "Rider ID", "App Courier ID", "appUserId"] },
  { key: "orders", displayName: "completed_orders", required: true, dataType: "number", aliases: ["completed_orders", "orders"] },
];

const hungerStationInvoiceOptionalColumns: ImportColumn[] = [
  { key: "contractName", displayName: "contract_name", dataType: "string", aliases: ["contract_name"] },
  { key: "city", displayName: "city_name", dataType: "string", aliases: ["city_name", "City"] },
  { key: "reportDate", displayName: "report_month", dataType: "date", aliases: ["report_month", "month", "date"] },
  { key: "workingHours", displayName: "total_monthly_working_hours", dataType: "number", aliases: ["total_monthly_working_hours", "working_hours", "hours"] },
  { key: "workDays", displayName: "working_days", dataType: "number", aliases: ["working_days", "workDays"] },
  { key: "cityPayment", displayName: "city_payment", dataType: "number", aliases: ["city_payment"] },
  { key: "basicPayment", displayName: "basic_payment", dataType: "number", aliases: ["basic_payment"] },
  { key: "acceptanceRatePenalties", displayName: "acceptance_rate_penalties", dataType: "number", aliases: ["acceptance_rate_penalties"] },
  { key: "contactRatePenalties", displayName: "contact_rate_penalties", dataType: "number", aliases: ["contact_rate_penalties"] },
  { key: "stackingDeduction", displayName: "stacking_deduction", dataType: "number", aliases: ["stacking_deduction"] },
  { key: "declinedPenaltiesDayLogic", displayName: "declined_penalties_day_logic", dataType: "number", aliases: ["declined_penalties_day_logic"] },
  { key: "latePenalty", displayName: "late_penalty", dataType: "number", aliases: ["late_penalty"] },
  { key: "noShowPenalty", displayName: "no_show_penalty", dataType: "number", aliases: ["no_show_penalty"] },
  { key: "noShowPenaltySpecialCities", displayName: "no_show_penalty_special_cities", dataType: "number", aliases: ["no_show_penalty_special_cities"] },
  { key: "dailyAcceptanceRatePenalty", displayName: "daily_acceptance_rate_penalty", dataType: "number", aliases: ["daily_acceptance_rate_penalty"] },
  { key: "distancePayment", displayName: "distance_payment", dataType: "number", aliases: ["distance_payment"] },
  { key: "missedDaysPenalty", displayName: "missed_days_penalty", dataType: "number", aliases: ["missed_days_penalty"] },
  { key: "courierBasicPayment", displayName: "COURIER_BASIC_PAYMENT", dataType: "number", aliases: ["COURIER_BASIC_PAYMENT"] },
  { key: "courierScoringPayment", displayName: "COURIER_SCORING_PAYMENT", dataType: "number", aliases: ["COURIER_SCORING_PAYMENT"] },
  { key: "collectionAmount", displayName: "Rider Balance", dataType: "number", aliases: ["Rider Balance", "rider_balance", "collection", "revenue"] },
];

function mappingFor(columns: ImportColumn[]): ImportColumnMapping[] {
  return columns.map((column) => ({
    incomingColumn: column.displayName,
    systemField: column.key,
    required: Boolean(column.required),
    transformRule: column.dataType,
  }));
}

function definition(
  fileType: string,
  name: string,
  category: ImportTemplateDefinition["category"],
  requiredColumns: ImportColumn[],
  optionalColumns: ImportColumn[],
  extra?: Partial<ImportTemplateDefinition>,
): ImportTemplateDefinition {
  return {
    fileType,
    name,
    category,
    requiredColumns,
    optionalColumns,
    columnMapping: mappingFor([...requiredColumns, ...optionalColumns]),
    matchingFields: ["driverCode", "nationalId", "appUserId", "appUsername", "mobile"],
    uniqueKeys: requiredColumns.slice(0, 1).map((column) => column.key),
    ...extra,
  };
}

export const importTemplateDefinitions: ImportTemplateDefinition[] = [
  definition("drivers", "Drivers Master Template", "drivers", baseDriverColumns, driverMasterTemplateOptionalColumns, {
    matchingFields: ["driverCode", "nationalId", "appUserId", "appUsername", "mobile"],
    uniqueKeys: ["driverCode", "nationalId"],
  }),
  definition("vehicles", "Vehicles Template", "vehicles", [
    { key: "plateEnglish", displayName: "اللوحة إنجليزي", required: true, dataType: "string", aliases: ["Plate English", "Plate En", "Plate EN", "plateEn", "plate_english", "اللوحة إنجليزي", "اللوحة الانجليزية"] },
  ], [
    { key: "vehicleCode", displayName: "كود السيارة", dataType: "string", aliases: ["Vehicle Code", "VehicleCode", "vehicleCode", "vehicle_code", "كود السيارة"] },
    { key: "plateArabic", displayName: "اللوحة عربي", dataType: "string", aliases: ["Plate Arabic", "Plate Ar", "Plate AR", "plateAr", "plate_arabic", "اللوحة عربي", "اللوحة العربية"] },
    { key: "vehicleType", displayName: "نوع السيارة", dataType: "string", aliases: ["Vehicle Type", "Type", "نوع السيارة"] },
    { key: "brand", displayName: "الماركة", dataType: "string", aliases: ["brand", "Brand", "Vehicle Type", "نوع السيارة"] },
    { key: "model", displayName: "الموديل", dataType: "string", aliases: ["Model", "model", "الموديل"] },
    { key: "rentalCompany", displayName: "شركة التأجير", dataType: "string", aliases: ["Rental Company", "شركة التأجير"] },
    { key: "ownerCompany", displayName: "الشركة المالكة", dataType: "string", aliases: ["Owner Company", "الشركة المالكة"] },
    { key: "city", displayName: "المدينة", dataType: "string", aliases: ["City", "المدينة"] },
    { key: "project", displayName: "المشروع / التطبيق", dataType: "string", aliases: ["Project", "Application", "المشروع", "التطبيق"] },
    { key: "status", displayName: "الحالة", dataType: "string", aliases: ["Status", "الحالة"] },
    { key: "assignedDriverCode", displayName: "كود المندوب الحالي", dataType: "string", aliases: ["Current Driver Code", "Assigned Driver Code", "Driver Code", "كود المندوب الحالي", "كود المندوب"] },
    { key: "assignedDriverIqama", displayName: "إقامة المندوب الحالي", dataType: "string", aliases: ["Current Driver Iqama", "Current Driver Iqaama", "Driver Iqama", "Iqama", "National ID", "إقامة المندوب الحالي", "رقم الإقامة", "الهوية"] },
    { key: "assignedDriverName", displayName: "اسم المندوب الحالي", dataType: "string", aliases: ["Current Driver Name", "Assigned Driver Name", "Driver Name", "اسم المندوب الحالي", "اسم المندوب"] },
    { key: "monthlyRent", displayName: "الإيجار الشهري", dataType: "number", aliases: ["Monthly Rent", "MonthlyRent", "monthlyRent", "rent", "الإيجار الشهري", "ايجار شهري"] },
    { key: "dailyRent", displayName: "الإيجار اليومي", dataType: "number", aliases: ["Daily Rent", "DailyRent", "dailyRent", "الإيجار اليومي", "ايجار يومي"] },
    { key: "receivedDate", displayName: "تاريخ التسليم", dataType: "date", aliases: ["Received Date", "Handover Date", "Start Date", "تاريخ التسليم", "تاريخ الاستلام"] },
    { key: "authorizationEnd", displayName: "تاريخ انتهاء التفويض", dataType: "date", aliases: ["Authorization End", "Authorization End Date", "Auth End Date", "تاريخ انتهاء التفويض", "نهاية التفويض"] },
    { key: "notes", displayName: "ملاحظات", dataType: "string", aliases: ["Notes", "ملاحظات"] },
  ], { matchingFields: ["vehicleCode", "plateArabic", "plateEnglish", "assignedDriverCode", "assignedDriverIqama", "assignedDriverName"], uniqueKeys: ["plateEnglish"] }),
  definition("application_accounts", "Application Accounts Template", "applications", [
    { key: "appUserId", displayName: "معرف الحساب", required: true, dataType: "string", aliases: ["appUserId", "accountId", "user_id"] },
  ], [
    { key: "appUsername", displayName: "اسم مستخدم التطبيق", dataType: "string", aliases: ["username", "appUsername"] },
    { key: "applicationName", displayName: "التطبيق", dataType: "string", aliases: ["application", "appName"] },
    { key: "driverCode", displayName: "كود المندوب", dataType: "string", aliases: ["driverCode"] },
    { key: "nationalId", displayName: "رقم الهوية", dataType: "string", aliases: ["nationalId"] },
  ], { uniqueKeys: ["appUserId"], matchingFields: ["appUserId", "appUsername", "driverCode", "nationalId"] }),
  definition(KEETA_RANK_TEMPLATE, "Keeta Rank Template", "applications", keetaRankRequiredColumns, keetaRankOptionalColumns, {
    applicationCode: "KEETA",
    uniqueKeys: ["courierId"],
    matchingFields: ["courierId", "appUserId", "applicationAccountId", "driverCode", "nationalId", "courierName"],
  }),
  definition(KEETA_PERIOD_REPORT_TEMPLATE, "Keeta Period Report Template", "applications", keetaPeriodReportRequiredColumns, keetaPeriodReportOptionalColumns, {
    applicationCode: "KEETA",
    uniqueKeys: ["reportDate", "courierId"],
    matchingFields: ["courierId", "appUserId", "applicationAccountId", "driverCode", "nationalId"],
  }),
  definition(KEETA_DRIVER_INVOICE_TEMPLATE, "Keeta Driver Invoice Template", "applications", keetaDriverInvoiceRequiredColumns, keetaDriverInvoiceOptionalColumns, {
    applicationCode: "KEETA",
    uniqueKeys: ["billingCycle", "courierId"],
    matchingFields: ["courierId", "appUserId", "applicationAccountId", "driverCode", "nationalId"],
  }),
  definition("hungerstation_invoice", "HungerStation Invoice Template", "applications", hungerStationInvoiceRequiredColumns, hungerStationInvoiceOptionalColumns, {
    applicationCode: "HUNGERSTATION",
    uniqueKeys: ["appUserId"],
    matchingFields: ["appUserId", "appUsername", "driverCode", "nationalId"],
  }),
  definition("hungerstation_performance", "HungerStation Performance Template", "applications", [...baseDriverColumns.slice(0, 1), ...commonPerformanceColumns], [
    { key: "acceptanceRate", displayName: "Acceptance %", dataType: "number", aliases: ["acceptance"] },
    { key: "reportDate", displayName: "تاريخ التقرير", dataType: "date", aliases: ["date"] },
  ], { applicationCode: "HUNGERSTATION" }),
  definition("talabat_invoice", "Talabat Invoice Template", "applications", [...baseDriverColumns.slice(0, 1), ...commonPerformanceColumns.slice(0, 1)], [
    ...commonPerformanceColumns.slice(1),
    { key: "collectionAmount", displayName: "التحصيل", dataType: "number", aliases: ["collection"] },
    { key: "appUserId", displayName: "معرف حساب Talabat", dataType: "string", aliases: ["appUserId"] },
  ], { applicationCode: "TALABAT" }),
  definition("advances", "Advances Template", "finance", [...baseDriverColumns.slice(0, 2), ...moneyColumns], [
    { key: "reason", displayName: "السبب", dataType: "string", aliases: ["reason"] },
    { key: "deductionMonth", displayName: "شهر الخصم", dataType: "string", aliases: ["deductionMonth"] },
  ]),
  definition("deductions", "Deductions Template", "finance", [...baseDriverColumns.slice(0, 2), ...moneyColumns], [
    { key: "type", displayName: "نوع الخصم", dataType: "string", aliases: ["type"] },
    { key: "notes", displayName: "ملاحظات", dataType: "string", aliases: ["notes"] },
  ]),
  definition("violations", "Violations Template", "operations", [...baseDriverColumns.slice(0, 2), ...moneyColumns], [
    { key: "type", displayName: "نوع المخالفة", dataType: "string", aliases: ["type"] },
    { key: "vehiclePlate", displayName: "لوحة السيارة", dataType: "string", aliases: ["plate", "vehiclePlate"] },
  ]),
  definition("fuel", "Fuel Template", "finance", [...baseDriverColumns.slice(0, 2), ...moneyColumns], [
    { key: "liters", displayName: "اللترات", dataType: "number", aliases: ["liters"] },
    { key: "vehiclePlate", displayName: "لوحة السيارة", dataType: "string", aliases: ["plate"] },
  ]),
  definition("hr_documents", "HR Documents Template", "hr", [...baseDriverColumns.slice(0, 2), {
    key: "documentType",
    displayName: "نوع المستند",
    required: true,
    dataType: "string",
    aliases: ["documentType"],
  }], [
    { key: "documentNumber", displayName: "رقم المستند", dataType: "string", aliases: ["documentNumber"] },
    { key: "expiryDate", displayName: "تاريخ الانتهاء", dataType: "date", aliases: ["expiryDate"] },
  ]),
  definition("payroll", "Payroll Template", "payroll", [...baseDriverColumns.slice(0, 2), {
    key: "month",
    displayName: "الشهر",
    required: true,
    dataType: "string",
    aliases: ["month"],
  }, {
    key: "year",
    displayName: "السنة",
    required: true,
    dataType: "number",
    aliases: ["year"],
  }], [
    { key: "basicSalary", displayName: "الراتب الأساسي", dataType: "number", aliases: ["basicSalary"] },
    { key: "bonus", displayName: "البونص", dataType: "number", aliases: ["bonus"] },
    { key: "deductions", displayName: "الخصومات", dataType: "number", aliases: ["deductions"] },
    { key: "netSalary", displayName: "صافي الراتب", dataType: "number", aliases: ["netSalary"] },
  ]),
];

export function getBuiltinTemplate(fileType: string) {
  return importTemplateDefinitions.find((item) => item.fileType === fileType);
}

export function jsonInput(value: unknown) {
  if (value === undefined || value === "") return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

export function parseJsonArray<T>(value: unknown, fallback: T[] = []): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : fallback;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export function countJson(value: unknown) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") return Object.keys(value).length;
  return 0;
}

export function statusText(status: unknown) {
  const value = String(status ?? "").toUpperCase();
  if (value === "ACTIVE") return "نشط";
  if (value === "INACTIVE") return "غير نشط";
  if (value === "PENDING") return "قيد المراجعة";
  if (value === "APPROVED") return "معتمد";
  if (value === "REJECTED") return "مرفوض";
  if (value === "LOCKED") return "مغلق";
  if (value === "PREVIEW") return "معاينة";
  if (value === "COMMITTED") return "محفوظ";
  if (value === "COMMITTED_PENDING_PROCESSING") return "محفوظ بانتظار المعالجة";
  if (value === "CANCELLED" || value === "CANCELED") return "ملغي";
  return String(status ?? "-");
}

export function statusValue(value: unknown): "ACTIVE" | "INACTIVE" | "PENDING" | "APPROVED" | "REJECTED" | "LOCKED" {
  const raw = String(value ?? "ACTIVE").toUpperCase();
  if (raw === "INACTIVE" || raw === "PENDING" || raw === "APPROVED" || raw === "REJECTED" || raw === "LOCKED") return raw;
  return "ACTIVE";
}

export function formatDate(value: unknown) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "-";
  return date.toISOString().slice(0, 10);
}

function normalizeTemplateColumns(fileType: string, requiredColumns: ImportColumn[], optionalColumns: ImportColumn[], columnMapping: ImportColumnMapping[]) {
  const definitionItem = getBuiltinTemplate(fileType);
  if (fileType === "hungerstation_invoice" && definitionItem) {
    return {
      requiredColumns: definitionItem.requiredColumns,
      optionalColumns: definitionItem.optionalColumns,
      columnMapping: definitionItem.columnMapping,
    };
  }

  const required = requiredColumns
    .filter((column) => !(fileType === KEETA_DRIVER_INVOICE_TEMPLATE && ["partnerId", "billingCycle"].includes(column.key)))
    .map((column) => (column.key === "nationalId" ? { ...column, required: false } : column));
  const optional = [...optionalColumns];

  if (fileType === KEETA_DRIVER_INVOICE_TEMPLATE) {
    for (const key of ["partnerId", "billingCycle"]) {
      const builtinColumn = definitionItem?.optionalColumns.find((column) => column.key === key);
      if (builtinColumn && !optional.some((column) => column.key === key)) optional.unshift(builtinColumn);
    }
  }

  return { requiredColumns: required, optionalColumns: optional, columnMapping };
}

export function databaseOfflineMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: string }).code) : "";
  if (code === "P1001" || code === "P1002" || message.includes("Can't reach database server") || message.includes("ECONNREFUSED")) {
    return "قاعدة البيانات غير متصلة. يرجى تشغيل PostgreSQL ثم تحديث الصفحة.";
  }
  return "";
}

export function templateFromDefinition(definitionItem: ImportTemplateDefinition): ImportTemplateRow {
  return {
    id: `builtin:${definitionItem.fileType}`,
    source: "builtin",
    name: definitionItem.name,
    fileType: definitionItem.fileType,
    category: definitionItem.category,
    applicationId: "",
    applicationName: definitionItem.applicationCode ?? "-",
    applicationProjectId: "",
    projectName: "كل المشاريع",
    requiredColumnsCount: definitionItem.requiredColumns.length,
    optionalColumnsCount: definitionItem.optionalColumns.length,
    mappingStatus: "جاهز",
    lastUsedAt: "-",
    status: "نشط",
    requiredColumns: definitionItem.requiredColumns,
    optionalColumns: definitionItem.optionalColumns,
    columnMapping: definitionItem.columnMapping,
  };
}

function rowFromDatabaseTemplate(template: {
  id: string;
  name: string;
  fileType: string;
  requiredColumns: unknown;
  optionalColumns: unknown;
  columnMapping: unknown;
  lastUsedAt: Date | null;
  status: unknown;
  applicationId: string | null;
  applicationProjectId: string | null;
  application?: { id: string; code: string; name: string } | null;
  applicationProject?: { id: string; code: string; name: string } | null;
}): ImportTemplateRow {
  const definitionItem = getBuiltinTemplate(template.fileType);
  const requiredColumns = parseJsonArray<ImportColumn>(template.requiredColumns, definitionItem?.requiredColumns ?? []);
  const optionalColumns = parseJsonArray<ImportColumn>(template.optionalColumns, definitionItem?.optionalColumns ?? []);
  const columnMapping = parseJsonArray<ImportColumnMapping>(template.columnMapping, definitionItem?.columnMapping ?? []);

  return {
    id: template.id,
    source: "database",
    name: template.name,
    fileType: template.fileType,
    category: definitionItem?.category ?? "operations",
    applicationId: template.applicationId ?? "",
    applicationName: template.application?.name ?? definitionItem?.applicationCode ?? "-",
    applicationProjectId: template.applicationProjectId ?? "",
    projectName: template.applicationProject?.name ?? "كل المشاريع",
    requiredColumnsCount: requiredColumns.length,
    optionalColumnsCount: optionalColumns.length,
    mappingStatus: columnMapping.length ? "مكتمل" : "يحتاج Mapping",
    lastUsedAt: formatDate(template.lastUsedAt),
    status: statusText(template.status),
    requiredColumns,
    optionalColumns,
    columnMapping,
  };
}

function emptyData(filters: ImportTemplatesData["filters"], message?: string): ImportTemplatesData {
  return {
    databaseStatus: message ? "offline" : "online",
    databaseMessage: message,
    filters,
    summary: {
      total: 0,
      active: 0,
      applicationTemplates: 0,
      driverTemplates: 0,
      vehicleTemplates: 0,
      financeTemplates: 0,
      needsMapping: 0,
      lastUsed: "-",
    },
    applications: [],
    projects: [],
    rows: importTemplateDefinitions.map(templateFromDefinition),
  };
}

export async function getImportTemplatesData(filters: ImportTemplatesData["filters"]): Promise<ImportTemplatesData> {
  try {
    const [templates, applications, projects] = await Promise.all([
      prisma.applicationImportTemplate.findMany({
        include: {
          application: { select: { id: true, code: true, name: true } },
          applicationProject: { select: { id: true, code: true, name: true } },
        },
        orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
      }),
      prisma.application.findMany({ select: { id: true, code: true, name: true }, orderBy: { name: "asc" } }),
      prisma.applicationProject.findMany({ select: { id: true, code: true, name: true, applicationId: true }, orderBy: { name: "asc" } }),
    ]);

    const databaseRows = templates.map(rowFromDatabaseTemplate);
    const databaseFileTypes = new Set(databaseRows.map((row) => row.fileType));
    const builtinRows = importTemplateDefinitions.filter((item) => !databaseFileTypes.has(item.fileType)).map(templateFromDefinition);
    let rows = [...databaseRows, ...builtinRows];

    if (filters.fileType) rows = rows.filter((row) => row.fileType === filters.fileType);
    if (filters.applicationId) rows = rows.filter((row) => row.applicationId === filters.applicationId);
    if (filters.applicationProjectId) rows = rows.filter((row) => row.applicationProjectId === filters.applicationProjectId);
    if (filters.status) rows = rows.filter((row) => row.status === statusText(filters.status) || row.status.toLowerCase() === filters.status.toLowerCase());
    if (filters.q) rows = rows.filter((row) => `${row.name} ${row.fileType} ${row.applicationName} ${row.projectName}`.toLowerCase().includes(filters.q));

    const lastUsedDates = databaseRows
      .map((row) => (row.lastUsedAt === "-" ? 0 : new Date(row.lastUsedAt).getTime()))
      .filter(Boolean);

    return {
      databaseStatus: "online",
      filters,
      applications,
      projects,
      rows,
      summary: {
        total: rows.length,
        active: rows.filter((row) => row.status === "نشط").length,
        applicationTemplates: rows.filter((row) => row.category === "applications").length,
        driverTemplates: rows.filter((row) => row.category === "drivers").length,
        vehicleTemplates: rows.filter((row) => row.category === "vehicles").length,
        financeTemplates: rows.filter((row) => row.category === "finance" || row.category === "payroll").length,
        needsMapping: rows.filter((row) => row.mappingStatus !== "مكتمل" && row.mappingStatus !== "جاهز").length,
        lastUsed: lastUsedDates.length ? formatDate(new Date(Math.max(...lastUsedDates))) : "-",
      },
    };
  } catch (error) {
    const message = databaseOfflineMessage(error);
    if (message) return emptyData(filters, message);
    throw error;
  }
}

export async function resolveTemplateForUse(templateId: string | null, fileType: string) {
  if (templateId?.startsWith("builtin:")) {
    const type = templateId.replace("builtin:", "");
    const definitionItem = getBuiltinTemplate(type);
    if (!definitionItem) throw new Error("القالب غير موجود.");
    return {
      id: templateId,
      source: "builtin" as const,
      name: definitionItem.name,
      fileType: definitionItem.fileType,
      requiredColumns: definitionItem.requiredColumns,
      optionalColumns: definitionItem.optionalColumns,
      columnMapping: definitionItem.columnMapping,
    };
  }

  if (templateId) {
    const template = await prisma.applicationImportTemplate.findUnique({ where: { id: templateId } });
    if (template) {
      const definitionItem = getBuiltinTemplate(template.fileType);
      const normalized = normalizeTemplateColumns(
        template.fileType,
        parseJsonArray<ImportColumn>(template.requiredColumns, definitionItem?.requiredColumns ?? []),
        parseJsonArray<ImportColumn>(template.optionalColumns, definitionItem?.optionalColumns ?? []),
        parseJsonArray<ImportColumnMapping>(template.columnMapping, definitionItem?.columnMapping ?? []),
      );
      return {
        id: template.id,
        source: "database" as const,
        name: template.name,
        fileType: template.fileType,
        requiredColumns: normalized.requiredColumns,
        optionalColumns: normalized.optionalColumns,
        columnMapping: normalized.columnMapping,
      };
    }
  }

  const definitionItem = getBuiltinTemplate(fileType);
  if (!definitionItem) throw new Error("نوع الاستيراد غير مدعوم.");
  return {
    id: `builtin:${definitionItem.fileType}`,
    source: "builtin" as const,
    name: definitionItem.name,
    fileType: definitionItem.fileType,
    requiredColumns: definitionItem.requiredColumns,
    optionalColumns: definitionItem.optionalColumns,
    columnMapping: definitionItem.columnMapping,
  };
}
