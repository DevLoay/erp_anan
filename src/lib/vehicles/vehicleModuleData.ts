import { prisma } from "@/lib/prisma";

export type VehicleModuleKey =
  | "vehicles"
  | "vehicle-movements"
  | "vehicle-cleaning"
  | "vehicle-maintenance"
  | "vehicle-authorizations"
  | "rental-companies"
  | "vehicle-costs"
  | "vehicle-accidents"
  | "vehicle-damages"
  | "vehicle-deductions"
  | "vehicle-violations"
  | "vehicle-finance";

export type VehicleColumn = {
  key: string;
  label: string;
};

export type VehicleField = {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "textarea" | "file";
  required?: boolean;
  options?: string;
  accept?: string;
  multiple?: boolean;
};

export type VehicleModuleConfig = {
  key: VehicleModuleKey;
  title: string;
  description: string;
  route: string;
  apiResource: string;
  addLabel: string;
  columns: VehicleColumn[];
  fields: VehicleField[];
};

export type VehicleRow = {
  id: string;
  values: Record<string, string>;
  raw: Record<string, string | number | null>;
  status: string;
};

export type VehicleReference = {
  id: string;
  label: string;
  sub?: string;
  driverId?: string;
  driverLabel?: string;
  cityId?: string;
  cityLabel?: string;
};

export type VehicleModuleData =
  | {
      status: "offline";
      module: VehicleModuleConfig;
      message: string;
    }
  | {
      status: "online";
      module: VehicleModuleConfig;
      modules: VehicleModuleConfig[];
      rows: VehicleRow[];
      summary: Array<{ label: string; value: string; tone?: "slate" | "emerald" | "amber" | "red" | "blue" }>;
      refs: {
        vehicles: VehicleReference[];
        drivers: VehicleReference[];
        cities: VehicleReference[];
        rentalCompanies: VehicleReference[];
      };
    };

const vehicleStatusOptions = "vehicleStatus";
const recordStatusOptions = "recordStatus";
const movementTypeOptions = "movementType";

export const vehicleModules: VehicleModuleConfig[] = [
  {
    key: "vehicles",
    title: "السيارات",
    description: "إدارة السيارات واللوحات وشركات التأجير والحالة والمندوب الحالي.",
    route: "/vehicles",
    apiResource: "vehicles",
    addLabel: "إضافة سيارة",
    columns: [
      { key: "plate", label: "اللوحة" },
      { key: "model", label: "الموديل" },
      { key: "rentalCompany", label: "شركة التأجير" },
      { key: "statusLabel", label: "الحالة" },
      { key: "driverName", label: "المندوب" },
      { key: "handoverDate", label: "تاريخ التسليم" },
      { key: "returnDate", label: "تاريخ الاستلام" },
      { key: "authorizationPeriod", label: "تاريخ التفويض" },
      { key: "authorizationStatus", label: "حالة التفويض" },
      { key: "cityName", label: "المدينة" },
      { key: "dailyRent", label: "الإيجار اليومي" },
      { key: "monthlyRent", label: "الإيجار الشهري" },
      { key: "updatedAt", label: "آخر تحديث" },
    ],
    fields: [
      { key: "vehicleCode", label: "كود السيارة", type: "text" },
      { key: "plateAr", label: "اللوحة عربي", type: "text" },
      { key: "plateEn", label: "اللوحة إنجليزي", type: "text", required: true },
      { key: "brand", label: "العلامة", type: "text" },
      { key: "model", label: "الموديل", type: "text" },
      { key: "year", label: "سنة الصنع", type: "number" },
      { key: "rentalCompanyId", label: "شركة التأجير", type: "select", options: "rentalCompanies" },
      { key: "ownershipType", label: "نوع ملكية السيارة", type: "select", options: "vehicleOwnership" },
      { key: "dailyRent", label: "الإيجار اليومي", type: "number" },
      { key: "monthlyRent", label: "الإيجار الشهري", type: "number" },
      { key: "cityId", label: "المدينة", type: "select", options: "cities" },
      { key: "currentDriverId", label: "المندوب الحالي", type: "select", options: "drivers" },
      { key: "status", label: "الحالة", type: "select", options: vehicleStatusOptions },
    ],
  },
  {
    key: "vehicle-movements",
    title: "حركة السيارات",
    description: "تسليم واستلام ونقل السيارات بين المناديب مع تحديث حالة السيارة.",
    route: "/vehicle-movements",
    apiResource: "vehicle-movements",
    addLabel: "تسجيل حركة",
    columns: [
      { key: "vehicle", label: "السيارة" },
      { key: "movementType", label: "نوع الحركة" },
      { key: "fromDriver", label: "من مندوب" },
      { key: "toDriver", label: "إلى مندوب" },
      { key: "cityName", label: "المدينة" },
      { key: "handoverDate", label: "تاريخ التسليم" },
      { key: "returnDate", label: "تاريخ الاستلام" },
      { key: "statusLabel", label: "الحالة" },
    ],
    fields: [
      { key: "vehicleId", label: "السيارة", type: "select", options: "vehicles", required: true },
      { key: "movementType", label: "نوع الحركة", type: "select", options: movementTypeOptions, required: true },
      { key: "fromDriverId", label: "من مندوب", type: "select", options: "drivers" },
      { key: "toDriverId", label: "إلى مندوب", type: "select", options: "drivers" },
      { key: "cityId", label: "المدينة", type: "select", options: "cities" },
      { key: "handoverDate", label: "تاريخ التسليم", type: "date" },
      { key: "returnDate", label: "تاريخ الاستلام", type: "date" },
      { key: "status", label: "الحالة", type: "select", options: recordStatusOptions },
      { key: "notes", label: "ملاحظات", type: "textarea" },
    ],
  },
  {
    key: "vehicle-cleaning",
    title: "نظافة السيارات",
    description: "متابعة عمليات نظافة السيارات وتكلفتها وربطها بالمندوب.",
    route: "/vehicle-cleaning",
    apiResource: "vehicle-cleaning",
    addLabel: "إضافة نظافة",
    columns: [
      { key: "vehicle", label: "السيارة" },
      { key: "driver", label: "المندوب" },
      { key: "cleanDate", label: "تاريخ النظافة" },
      { key: "cost", label: "التكلفة" },
      { key: "attachmentsCount", label: "صور السيارة" },
      { key: "statusLabel", label: "الحالة" },
      { key: "notes", label: "ملاحظات" },
    ],
    fields: [
      { key: "vehicleId", label: "السيارة", type: "select", options: "vehicles", required: true },
      { key: "driverId", label: "المندوب", type: "select", options: "drivers" },
      { key: "cleanDate", label: "تاريخ النظافة", type: "date" },
      { key: "cost", label: "التكلفة", type: "number" },
      { key: "attachments", label: "صور السيارة بعد النظافة", type: "file", required: true, accept: "image/*", multiple: true },
      { key: "status", label: "الحالة", type: "select", options: recordStatusOptions },
      { key: "notes", label: "ملاحظات", type: "textarea" },
    ],
  },
  {
    key: "vehicle-maintenance",
    title: "الصيانة",
    description: "صيانة السيارات والتكلفة والورشة وحالة التنفيذ.",
    route: "/vehicle-maintenance",
    apiResource: "vehicle-maintenance",
    addLabel: "إضافة صيانة",
    columns: [
      { key: "vehicle", label: "السيارة" },
      { key: "type", label: "نوع الصيانة" },
      { key: "vendor", label: "الورشة" },
      { key: "driver", label: "المندوب" },
      { key: "date", label: "التاريخ" },
      { key: "cost", label: "التكلفة" },
      { key: "statusLabel", label: "الحالة" },
    ],
    fields: [
      { key: "vehicleId", label: "السيارة", type: "select", options: "vehicles", required: true },
      { key: "driverId", label: "المندوب", type: "select", options: "drivers" },
      { key: "type", label: "نوع الصيانة", type: "text", required: true },
      { key: "vendor", label: "الورشة", type: "text" },
      { key: "date", label: "تاريخ الصيانة", type: "date" },
      { key: "cost", label: "التكلفة", type: "number" },
      { key: "status", label: "الحالة", type: "select", options: recordStatusOptions },
      { key: "notes", label: "ملاحظات", type: "textarea" },
    ],
  },
  {
    key: "vehicle-authorizations",
    title: "التفويضات",
    description: "تفويضات السيارات للمناديب وتواريخ الانتهاء.",
    route: "/authorizations",
    apiResource: "vehicle-authorizations",
    addLabel: "إضافة تفويض",
    columns: [
      { key: "vehicle", label: "السيارة" },
      { key: "driver", label: "المندوب" },
      { key: "authNumber", label: "رقم التفويض" },
      { key: "startDate", label: "من تاريخ" },
      { key: "endDate", label: "إلى تاريخ" },
      { key: "statusLabel", label: "الحالة" },
    ],
    fields: [
      { key: "vehicleId", label: "السيارة", type: "select", options: "vehicles", required: true },
      { key: "driverId", label: "المندوب", type: "select", options: "drivers" },
      { key: "authNumber", label: "رقم التفويض", type: "text" },
      { key: "startDate", label: "من تاريخ", type: "date" },
      { key: "endDate", label: "إلى تاريخ", type: "date" },
      { key: "status", label: "الحالة", type: "select", options: recordStatusOptions },
      { key: "notes", label: "ملاحظات", type: "textarea" },
    ],
  },
  {
    key: "rental-companies",
    title: "شركات التأجير",
    description: "إدارة شركات تأجير السيارات وبيانات التواصل.",
    route: "/rental-companies",
    apiResource: "rental-companies",
    addLabel: "إضافة شركة",
    columns: [
      { key: "name", label: "الشركة" },
      { key: "contact", label: "مسؤول التواصل" },
      { key: "phone", label: "الجوال" },
      { key: "vehiclesCount", label: "عدد السيارات" },
      { key: "monthlyCost", label: "إجمالي الإيجار" },
      { key: "statusLabel", label: "الحالة" },
    ],
    fields: [
      { key: "name", label: "اسم الشركة", type: "text", required: true },
      { key: "contact", label: "مسؤول التواصل", type: "text" },
      { key: "phone", label: "الجوال", type: "text" },
      { key: "status", label: "الحالة", type: "select", options: recordStatusOptions },
      { key: "notes", label: "ملاحظات", type: "textarea" },
    ],
  },
  {
    key: "vehicle-costs",
    title: "تكلفة السيارات",
    description: "تكلفة السيارات الشهرية مجمعة تلقائيًا من الإيجار والصيانة والنظافة والحوادث والتلفيات.",
    route: "/vehicle-cost",
    apiResource: "vehicle-costs",
    addLabel: "إضافة تكلفة",
    columns: [
      { key: "vehicle", label: "السيارة" },
      { key: "month", label: "الشهر" },
      { key: "rentCost", label: "الإيجار" },
      { key: "maintenanceCost", label: "الصيانة" },
      { key: "cleaningCost", label: "النظافة" },
      { key: "accidentCost", label: "الحوادث" },
      { key: "damageCost", label: "التلفيات" },
      { key: "otherCost", label: "أخرى/مخالفات" },
      { key: "totalCost", label: "الإجمالي" },
      { key: "statusLabel", label: "الحالة" },
    ],
    fields: [
      { key: "vehicleId", label: "السيارة", type: "select", options: "vehicles", required: true },
      { key: "month", label: "الشهر", type: "text", required: true },
      { key: "rentCost", label: "الإيجار", type: "number" },
      { key: "maintenanceCost", label: "الصيانة", type: "number" },
      { key: "cleaningCost", label: "النظافة", type: "number" },
      { key: "accidentCost", label: "الحوادث", type: "number" },
      { key: "damageCost", label: "التلفيات", type: "number" },
      { key: "otherCost", label: "أخرى", type: "number" },
      { key: "totalCost", label: "الإجمالي", type: "number" },
      { key: "status", label: "الحالة", type: "select", options: recordStatusOptions },
    ],
  },
  {
    key: "vehicle-accidents",
    title: "حوادث السيارات",
    description: "حوادث السيارات وتكلفتها ونسبة المسؤولية.",
    route: "/vehicle-accidents",
    apiResource: "vehicle-accidents",
    addLabel: "إضافة حادث",
    columns: [
      { key: "vehicle", label: "السيارة" },
      { key: "driver", label: "المندوب" },
      { key: "cityName", label: "المدينة" },
      { key: "type", label: "نوع الحادث" },
      { key: "date", label: "التاريخ" },
      { key: "cost", label: "التكلفة" },
      { key: "liabilityPercent", label: "المسؤولية" },
      { key: "attachmentsCount", label: "المرفقات" },
      { key: "statusLabel", label: "الحالة" },
    ],
    fields: [
      { key: "vehicleId", label: "السيارة", type: "select", options: "vehicles", required: true },
      { key: "driverId", label: "المندوب", type: "select", options: "drivers" },
      { key: "cityId", label: "المدينة", type: "select", options: "cities" },
      { key: "type", label: "نوع الحادث", type: "text" },
      { key: "date", label: "تاريخ الحادث", type: "date" },
      { key: "cost", label: "التكلفة", type: "number" },
      { key: "liabilityPercent", label: "نسبة المسؤولية", type: "number" },
      { key: "attachments", label: "مرفقات إثبات الحادث", type: "file", required: true, accept: "image/*,.pdf", multiple: true },
      { key: "status", label: "الحالة", type: "select", options: recordStatusOptions },
      { key: "notes", label: "ملاحظات", type: "textarea" },
    ],
  },
  {
    key: "vehicle-damages",
    title: "تلفيات السيارات",
    description: "تلفيات السيارات والتكلفة التقديرية والنهائية.",
    route: "/vehicle-damages",
    apiResource: "vehicle-damages",
    addLabel: "إضافة تلف",
    columns: [
      { key: "vehicle", label: "السيارة" },
      { key: "driver", label: "المندوب" },
      { key: "type", label: "نوع التلف" },
      { key: "date", label: "التاريخ" },
      { key: "estimatedCost", label: "التكلفة التقديرية" },
      { key: "finalCost", label: "التكلفة النهائية" },
      { key: "attachmentsCount", label: "المرفقات" },
      { key: "statusLabel", label: "الحالة" },
    ],
    fields: [
      { key: "vehicleId", label: "السيارة", type: "select", options: "vehicles", required: true },
      { key: "driverId", label: "المندوب", type: "select", options: "drivers" },
      { key: "type", label: "نوع التلف", type: "text", required: true },
      { key: "date", label: "التاريخ", type: "date" },
      { key: "estimatedCost", label: "التكلفة التقديرية", type: "number" },
      { key: "finalCost", label: "التكلفة النهائية", type: "number" },
      { key: "attachments", label: "مرفقات إثبات التلفيات", type: "file", required: true, accept: "image/*,.pdf", multiple: true },
      { key: "status", label: "الحالة", type: "select", options: recordStatusOptions },
      { key: "notes", label: "ملاحظات", type: "textarea" },
    ],
  },
  {
    key: "vehicle-deductions",
    title: "خصومات السيارات",
    description: "خصومات مرتبطة بالسيارات أو المندوبين وتظهر في المسير حسب الاعتماد.",
    route: "/vehicle-deductions",
    apiResource: "deductions",
    addLabel: "إضافة خصم",
    columns: [
      { key: "vehicle", label: "السيارة" },
      { key: "driver", label: "المندوب" },
      { key: "type", label: "نوع الخصم" },
      { key: "month", label: "الشهر" },
      { key: "amount", label: "المبلغ" },
      { key: "statusLabel", label: "الحالة" },
      { key: "notes", label: "ملاحظات" },
    ],
    fields: [
      { key: "vehicleId", label: "السيارة", type: "select", options: "vehicles" },
      { key: "driverId", label: "المندوب", type: "select", options: "drivers", required: true },
      { key: "type", label: "نوع الخصم", type: "text", required: true },
      { key: "month", label: "الشهر", type: "text" },
      { key: "amount", label: "المبلغ", type: "number" },
      { key: "status", label: "الحالة", type: "select", options: recordStatusOptions },
      { key: "notes", label: "ملاحظات", type: "textarea" },
    ],
  },
  {
    key: "vehicle-violations",
    title: "مخالفات السيارات",
    description: "مخالفات مرورية وتشغيلية مرتبطة بالسيارة والمندوب.",
    route: "/vehicle-violations",
    apiResource: "violations",
    addLabel: "إضافة مخالفة",
    columns: [
      { key: "vehicle", label: "السيارة" },
      { key: "driver", label: "المندوب" },
      { key: "type", label: "نوع المخالفة" },
      { key: "occurredAt", label: "التاريخ" },
      { key: "amount", label: "المبلغ" },
      { key: "statusLabel", label: "الحالة" },
      { key: "notes", label: "ملاحظات" },
    ],
    fields: [
      { key: "vehicleId", label: "السيارة", type: "select", options: "vehicles", required: true },
      { key: "driverId", label: "المندوب", type: "select", options: "drivers", required: true },
      { key: "type", label: "نوع المخالفة", type: "text", required: true },
      { key: "occurredAt", label: "تاريخ المخالفة", type: "date" },
      { key: "amount", label: "المبلغ", type: "number" },
      { key: "status", label: "الحالة", type: "select", options: recordStatusOptions },
      { key: "notes", label: "ملاحظات", type: "textarea" },
    ],
  },
  {
    key: "vehicle-finance",
    title: "مالية السيارات",
    description: "ملخص مالي شهري مجمع تلقائيًا لكل سيارة: إيجار، صيانة، نظافة، حوادث، تلفيات، وأخرى.",
    route: "/vehicle-finance",
    apiResource: "vehicle-costs",
    addLabel: "إضافة تكلفة",
    columns: [
      { key: "vehicle", label: "السيارة" },
      { key: "month", label: "الشهر" },
      { key: "rentCost", label: "الإيجار" },
      { key: "maintenanceCost", label: "الصيانة" },
      { key: "cleaningCost", label: "النظافة" },
      { key: "accidentCost", label: "الحوادث" },
      { key: "damageCost", label: "التلفيات" },
      { key: "otherCost", label: "أخرى/مخالفات" },
      { key: "totalCost", label: "الإجمالي" },
      { key: "statusLabel", label: "الحالة" },
    ],
    fields: [
      { key: "vehicleId", label: "السيارة", type: "select", options: "vehicles", required: true },
      { key: "month", label: "الشهر", type: "text", required: true },
      { key: "rentCost", label: "الإيجار", type: "number" },
      { key: "maintenanceCost", label: "الصيانة", type: "number" },
      { key: "cleaningCost", label: "النظافة", type: "number" },
      { key: "accidentCost", label: "الحوادث", type: "number" },
      { key: "damageCost", label: "التلفيات", type: "number" },
      { key: "otherCost", label: "أخرى", type: "number" },
      { key: "totalCost", label: "الإجمالي", type: "number" },
      { key: "status", label: "الحالة", type: "select", options: recordStatusOptions },
    ],
  },
];

export function getVehicleModuleConfig(key: VehicleModuleKey) {
  return vehicleModules.find((module) => module.key === key) ?? vehicleModules[0];
}

function money(input: unknown) {
  const number = Number(input ?? 0);
  if (!Number.isFinite(number) || number === 0) return "-";
  return new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(number);
}

function numericText(input: unknown) {
  const number = Number(input ?? 0);
  return Number.isFinite(number) ? String(number) : "0";
}

function dateText(input: unknown) {
  if (!input) return "-";
  const date = input instanceof Date ? input : new Date(String(input));
  if (Number.isNaN(date.getTime())) return "-";
  return date.toISOString().slice(0, 10);
}

function dateInput(input: unknown) {
  const value = dateText(input);
  return value === "-" ? "" : value;
}

function statusLabel(input: unknown) {
  const value = String(input ?? "").toUpperCase();
  const labels: Record<string, string> = {
    AVAILABLE: "متاحة",
    ASSIGNED: "مع مندوب",
    MAINTENANCE: "صيانة",
    ACCIDENT: "حادث",
    INACTIVE: "موقوفة",
    ACTIVE: "نشط",
    PENDING: "قيد المراجعة",
    APPROVED: "معتمد",
    REJECTED: "مرفوض",
    LOCKED: "مقفل",
  };
  return labels[value] ?? (value || "-");
}

function text(input: unknown) {
  const value = String(input ?? "").trim();
  return value || "-";
}

function idText(input: unknown) {
  const value = String(input ?? "").trim();
  return value || "";
}

function attachmentCount(input: unknown) {
  if (Array.isArray(input)) return String(input.length);
  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input);
      return Array.isArray(parsed) ? String(parsed.length) : "0";
    } catch {
      return input.trim() ? "1" : "0";
    }
  }
  return "0";
}

function vehiclePlate(vehicle?: { plateArabic?: string | null; plateAr?: string | null; plateEnglish?: string | null; plateEn?: string | null; vehicleCode?: string | null } | null) {
  return vehicle?.plateArabic || vehicle?.plateAr || vehicle?.plateEnglish || vehicle?.plateEn || vehicle?.vehicleCode || "-";
}

function rawDate(input: unknown) {
  const value = dateInput(input);
  return value || null;
}

function dbOffline(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("Can't reach database server") || message.includes("ECONNREFUSED") || message.includes("P1001");
}

type DataContext = Awaited<ReturnType<typeof loadVehicleContext>>;

async function loadVehicleContext() {
  const [
    vehicles,
    drivers,
    cities,
    movements,
    cleanings,
    maintenance,
    authorizations,
    assignments,
    rentalCompanies,
    costs,
    accidents,
    damages,
    deductions,
    violations,
  ] = await Promise.all([
    prisma.vehicle.findMany({ include: { city: true, currentDriver: true, rentalCompanyRef: true }, orderBy: { updatedAt: "desc" }, take: 500 }),
    prisma.driver.findMany({ include: { city: true }, orderBy: { name: "asc" }, take: 1000 }),
    prisma.city.findMany({ orderBy: { nameAr: "asc" }, take: 200 }),
    prisma.vehicleMovement.findMany({ orderBy: { updatedAt: "desc" }, take: 500 }),
    prisma.vehicleCleaning.findMany({ orderBy: { updatedAt: "desc" }, take: 500 }),
    prisma.vehicleMaintenance.findMany({ orderBy: { updatedAt: "desc" }, take: 500 }),
    prisma.vehicleAuthorization.findMany({ orderBy: { updatedAt: "desc" }, take: 500 }),
    prisma.vehicleAssignment.findMany({ orderBy: [{ startDate: "desc" }, { updatedAt: "desc" }], take: 1000 }),
    prisma.rentalCompany.findMany({ orderBy: { updatedAt: "desc" }, take: 500 }),
    prisma.vehicleCost.findMany({ orderBy: { updatedAt: "desc" }, take: 500 }),
    prisma.vehicleAccident.findMany({ orderBy: { updatedAt: "desc" }, take: 500 }),
    prisma.vehicleDamage.findMany({ orderBy: { updatedAt: "desc" }, take: 500 }),
    prisma.deduction.findMany({ orderBy: { updatedAt: "desc" }, take: 500 }),
    prisma.violation.findMany({ orderBy: { updatedAt: "desc" }, take: 500 }),
  ]);

  const vehicleMap = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const driverMap = new Map(drivers.map((driver) => [driver.id, driver]));
  const cityMap = new Map(cities.map((city) => [city.id, city]));

  return {
    vehicles,
    drivers,
    cities,
    movements,
    cleanings,
    maintenance,
    authorizations,
    assignments,
    rentalCompanies,
    costs,
    accidents,
    damages,
    deductions,
    violations,
    vehicleMap,
    driverMap,
    cityMap,
  };
}

function driverName(ctx: DataContext, id?: string | null) {
  const driver = id ? ctx.driverMap.get(id) : null;
  return driver?.name || driver?.actualName || "-";
}

function cityName(ctx: DataContext, id?: string | null) {
  const city = id ? ctx.cityMap.get(id) : null;
  return city?.nameAr || city?.nameEn || "-";
}

function vehicleName(ctx: DataContext, id?: string | null) {
  return vehiclePlate(id ? ctx.vehicleMap.get(id) : null);
}

function baseRaw(row: { id: string; status?: unknown; createdAt?: Date; updatedAt?: Date }) {
  return {
    id: row.id,
    status: row.status ? String(row.status) : null,
    createdAt: row.createdAt ? dateInput(row.createdAt) : null,
    updatedAt: row.updatedAt ? dateInput(row.updatedAt) : null,
  };
}

type VehicleLike = DataContext["vehicles"][number];

function activeAssignmentFor(ctx: DataContext, vehicleId: string) {
  return ctx.assignments.find((assignment) => assignment.vehicleId === vehicleId && String(assignment.status) === "ACTIVE" && !assignment.endDate);
}

function latestMovementFor(ctx: DataContext, vehicleId: string) {
  return ctx.movements.find((movement) => movement.vehicleId === vehicleId);
}

function latestAuthorizationFor(ctx: DataContext, vehicleId: string) {
  return ctx.authorizations.find((authorization) => authorization.vehicleId === vehicleId);
}

function effectiveVehicleDriverId(ctx: DataContext, row: VehicleLike) {
  const assignment = activeAssignmentFor(ctx, row.id);
  const movement = latestMovementFor(ctx, row.id);
  return idText(row.currentDriverId || assignment?.driverId || movement?.toDriverId);
}

function effectiveVehicleDriverName(ctx: DataContext, row: VehicleLike) {
  return row.currentDriver?.name || driverName(ctx, effectiveVehicleDriverId(ctx, row));
}

function effectiveVehicleHandoverDate(ctx: DataContext, row: VehicleLike) {
  const assignment = activeAssignmentFor(ctx, row.id);
  const movement = latestMovementFor(ctx, row.id);
  return dateText(assignment?.startDate || movement?.handoverDate);
}

function effectiveVehicleReturnDate(ctx: DataContext, row: VehicleLike) {
  const assignment = activeAssignmentFor(ctx, row.id);
  const movement = latestMovementFor(ctx, row.id);
  return dateText(assignment?.endDate || movement?.returnDate);
}

function effectiveVehicleAuthorizationPeriod(ctx: DataContext, row: VehicleLike) {
  const authorization = latestAuthorizationFor(ctx, row.id);
  if (!authorization) return "-";
  const start = dateText(authorization.startDate);
  const end = dateText(authorization.endDate);
  return `${start} - ${end}`;
}

function effectiveVehicleAuthorizationStatus(ctx: DataContext, row: VehicleLike) {
  const authorization = latestAuthorizationFor(ctx, row.id);
  return authorization ? statusLabel(authorization.status) : "-";
}

function vehicleRows(ctx: DataContext): VehicleRow[] {
  return ctx.vehicles.map((row) => ({
    id: row.id,
    status: String(row.status),
    values: {
      plate: vehiclePlate(row),
      model: [row.brand, row.model, row.year].filter(Boolean).join(" ") || "-",
      rentalCompany: text((row as any).rentalCompanyRef?.name || row.rentalCompany),
      statusLabel: statusLabel(row.status),
      driverName: effectiveVehicleDriverName(ctx, row),
      handoverDate: effectiveVehicleHandoverDate(ctx, row),
      returnDate: effectiveVehicleReturnDate(ctx, row),
      authorizationPeriod: effectiveVehicleAuthorizationPeriod(ctx, row),
      authorizationStatus: effectiveVehicleAuthorizationStatus(ctx, row),
      cityName: row.city?.nameAr || row.city?.nameEn || "-",
      dailyRent: money(row.dailyRent),
      monthlyRent: money(row.monthlyRent),
      updatedAt: dateText(row.updatedAt),
    },
    raw: {
      ...baseRaw(row),
      vehicleCode: idText(row.vehicleCode),
      plateAr: idText(row.plateAr || row.plateArabic),
      plateEn: idText(row.plateEn || row.plateEnglish),
      brand: idText(row.brand),
      model: idText(row.model),
      year: row.year ?? null,
      rentalCompany: idText(row.rentalCompany),
      rentalCompanyId: idText((row as any).rentalCompanyId),
      ownershipType: idText(row.ownershipType),
      dailyRent: Number(row.dailyRent ?? 0),
      monthlyRent: Number(row.monthlyRent ?? 0),
      cityId: idText(row.cityId),
      currentDriverId: effectiveVehicleDriverId(ctx, row),
    },
  }));
}

function movementRows(ctx: DataContext): VehicleRow[] {
  return ctx.movements.map((row) => ({
    id: row.id,
    status: String(row.status),
    values: {
      vehicle: vehicleName(ctx, row.vehicleId),
      movementType: text(row.movementType),
      fromDriver: driverName(ctx, row.fromDriverId),
      toDriver: driverName(ctx, row.toDriverId),
      cityName: cityName(ctx, row.cityId),
      handoverDate: dateText(row.handoverDate),
      returnDate: dateText(row.returnDate),
      statusLabel: statusLabel(row.status),
    },
    raw: {
      ...baseRaw(row),
      vehicleId: row.vehicleId,
      fromDriverId: idText(row.fromDriverId),
      toDriverId: idText(row.toDriverId),
      cityId: idText(row.cityId),
      movementType: row.movementType,
      handoverDate: rawDate(row.handoverDate),
      returnDate: rawDate(row.returnDate),
      notes: idText(row.notes),
    },
  }));
}

function simpleVehicleRows(
  ctx: DataContext,
  rows: Array<Record<string, unknown> & { id: string; status?: unknown; createdAt?: Date; updatedAt?: Date }>,
  mapper: (row: Record<string, unknown>, ctx: DataContext) => { values: Record<string, string>; raw: Record<string, string | number | null> },
): VehicleRow[] {
  return rows.map((row) => {
    const mapped = mapper(row, ctx);
    return {
      id: row.id,
      status: String(row.status ?? ""),
      values: { ...mapped.values, statusLabel: mapped.values.statusLabel ?? statusLabel(row.status) },
      raw: { ...baseRaw(row), ...mapped.raw },
    };
  });
}

function rowsForModule(module: VehicleModuleKey, ctx: DataContext): VehicleRow[] {
  if (module === "vehicles") return vehicleRows(ctx);
  if (module === "vehicle-movements") return movementRows(ctx);
  if (module === "vehicle-cleaning") {
    return simpleVehicleRows(ctx, ctx.cleanings, (row) => ({
      values: {
        vehicle: vehicleName(ctx, idText(row.vehicleId)),
        driver: driverName(ctx, idText(row.driverId)),
        cleanDate: dateText(row.cleanDate),
        cost: money(row.cost),
        attachmentsCount: attachmentCount(row.attachments),
        statusLabel: statusLabel(row.status),
        notes: text(row.notes),
      },
      raw: { vehicleId: idText(row.vehicleId), driverId: idText(row.driverId), cleanDate: rawDate(row.cleanDate), cost: Number(row.cost ?? 0), attachments: "", notes: idText(row.notes) },
    }));
  }
  if (module === "vehicle-maintenance") {
    return simpleVehicleRows(ctx, ctx.maintenance, (row) => ({
      values: {
        vehicle: vehicleName(ctx, idText(row.vehicleId)),
        type: text(row.type),
        vendor: text(row.vendor),
        driver: driverName(ctx, idText(row.driverId)),
        date: dateText(row.date),
        cost: money(row.cost),
        statusLabel: statusLabel(row.status),
      },
      raw: { vehicleId: idText(row.vehicleId), driverId: idText(row.driverId), type: idText(row.type), vendor: idText(row.vendor), date: rawDate(row.date), cost: Number(row.cost ?? 0), notes: idText(row.notes) },
    }));
  }
  if (module === "vehicle-authorizations") {
    return simpleVehicleRows(ctx, ctx.authorizations, (row) => ({
      values: {
        vehicle: vehicleName(ctx, idText(row.vehicleId)),
        driver: driverName(ctx, idText(row.driverId)),
        authNumber: text(row.authNumber),
        startDate: dateText(row.startDate),
        endDate: dateText(row.endDate),
        statusLabel: statusLabel(row.status),
      },
      raw: { vehicleId: idText(row.vehicleId), driverId: idText(row.driverId), authNumber: idText(row.authNumber), startDate: rawDate(row.startDate), endDate: rawDate(row.endDate), notes: idText(row.notes) },
    }));
  }
  if (module === "rental-companies") {
    return simpleVehicleRows(ctx, ctx.rentalCompanies, (row) => {
      const companyVehicles = ctx.vehicles.filter((vehicle) => {
        const linkedId = idText((vehicle as any).rentalCompanyId);
        if (linkedId && linkedId === row.id) return true;
        return (vehicle.rentalCompany || "").trim() === String(row.name ?? "").trim();
      });
      return {
        values: {
          name: text(row.name),
          contact: text(row.contact),
          phone: text(row.phone),
          vehiclesCount: String(companyVehicles.length),
          monthlyCost: money(companyVehicles.reduce((sum, vehicle) => sum + Number(vehicle.monthlyRent ?? 0), 0)),
          statusLabel: statusLabel(row.status),
        },
        raw: { name: idText(row.name), contact: idText(row.contact), phone: idText(row.phone), notes: idText(row.notes) },
      };
    });
  }
  if (module === "vehicle-costs" || module === "vehicle-finance") {
    return simpleVehicleRows(ctx, ctx.costs, (row) => ({
      values: {
        vehicle: vehicleName(ctx, idText(row.vehicleId)),
        month: text(row.month),
        rentCost: money(row.rentCost),
        maintenanceCost: money(row.maintenanceCost),
        cleaningCost: money(row.cleaningCost),
        accidentCost: money(row.accidentCost),
        damageCost: money(row.damageCost),
        otherCost: money(row.otherCost),
        totalCost: money(row.totalCost),
        statusLabel: statusLabel(row.status),
      },
      raw: {
        vehicleId: idText(row.vehicleId),
        month: idText(row.month),
        rentCost: Number(row.rentCost ?? 0),
        maintenanceCost: Number(row.maintenanceCost ?? 0),
        cleaningCost: Number(row.cleaningCost ?? 0),
        accidentCost: Number(row.accidentCost ?? 0),
        damageCost: Number(row.damageCost ?? 0),
        otherCost: Number(row.otherCost ?? 0),
        totalCost: Number(row.totalCost ?? 0),
      },
    }));
  }
  if (module === "vehicle-accidents") {
    return simpleVehicleRows(ctx, ctx.accidents, (row) => ({
      values: {
        vehicle: vehicleName(ctx, idText(row.vehicleId)),
        driver: driverName(ctx, idText(row.driverId)),
        cityName: cityName(ctx, idText(row.cityId)),
        type: text(row.type),
        date: dateText(row.date),
        cost: money(row.cost),
        liabilityPercent: `${numericText(row.liabilityPercent)}%`,
        attachmentsCount: attachmentCount(row.attachments),
        statusLabel: statusLabel(row.status),
      },
      raw: { vehicleId: idText(row.vehicleId), driverId: idText(row.driverId), cityId: idText(row.cityId), type: idText(row.type), date: rawDate(row.date), cost: Number(row.cost ?? 0), liabilityPercent: Number(row.liabilityPercent ?? 0), attachments: "", notes: idText(row.notes) },
    }));
  }
  if (module === "vehicle-damages") {
    return simpleVehicleRows(ctx, ctx.damages, (row) => ({
      values: {
        vehicle: vehicleName(ctx, idText(row.vehicleId)),
        driver: driverName(ctx, idText(row.driverId)),
        type: text(row.type),
        date: dateText(row.date),
        estimatedCost: money(row.estimatedCost),
        finalCost: money(row.finalCost),
        attachmentsCount: attachmentCount(row.attachments),
        statusLabel: statusLabel(row.status),
      },
      raw: { vehicleId: idText(row.vehicleId), driverId: idText(row.driverId), type: idText(row.type), date: rawDate(row.date), estimatedCost: Number(row.estimatedCost ?? 0), finalCost: Number(row.finalCost ?? 0), attachments: "", notes: idText(row.notes) },
    }));
  }
  if (module === "vehicle-deductions") {
    return simpleVehicleRows(ctx, ctx.deductions.filter((row) => {
      const vehicleId = idText((row as any).vehicleId);
      return Boolean(vehicleId) || /car|vehicle|سيارة|ايجار|إيجار|user deduction|personal/i.test(row.type || row.notes || "");
    }), (row) => ({
      values: {
        vehicle: vehicleName(ctx, idText((row as any).vehicleId)),
        driver: driverName(ctx, idText(row.driverId)),
        type: text(row.type),
        month: text(row.month),
        amount: money(row.amount),
        statusLabel: statusLabel(row.status),
        notes: text(row.notes),
      },
      raw: { vehicleId: idText((row as any).vehicleId), driverId: idText(row.driverId), type: idText(row.type), month: idText(row.month), amount: Number(row.amount ?? 0), notes: idText(row.notes) },
    }));
  }
  return simpleVehicleRows(ctx, ctx.violations.filter((row) => row.vehicleId), (row) => ({
    values: {
      vehicle: vehicleName(ctx, idText(row.vehicleId)),
      driver: driverName(ctx, idText(row.driverId)),
      type: text(row.type),
      occurredAt: dateText(row.occurredAt),
      amount: money(row.amount),
      statusLabel: statusLabel(row.status),
      notes: text(row.notes),
    },
    raw: { vehicleId: idText(row.vehicleId), driverId: idText(row.driverId), type: idText(row.type), occurredAt: rawDate(row.occurredAt), amount: Number(row.amount ?? 0), notes: idText(row.notes) },
  }));
}

function summaryFor(ctx: DataContext) {
  const totalRent = ctx.costs.reduce((sum, row) => sum + Number(row.rentCost ?? 0), 0);
  const totalMaintenance = ctx.costs.reduce((sum, row) => sum + Number(row.maintenanceCost ?? 0), 0);
  const openAccidents = ctx.accidents.filter((row) => String(row.status) !== "APPROVED" && String(row.status) !== "LOCKED").length;
  const totalCosts = ctx.costs.reduce((sum, row) => sum + Number(row.totalCost ?? 0), 0);

  return [
    { label: "إجمالي السيارات", value: String(ctx.vehicles.length), tone: "blue" as const },
    { label: "متاحة", value: String(ctx.vehicles.filter((row) => String(row.status) === "AVAILABLE").length), tone: "emerald" as const },
    { label: "مع مندوب", value: String(ctx.vehicles.filter((row) => row.currentDriverId || String(row.status) === "ASSIGNED").length), tone: "blue" as const },
    { label: "في الصيانة", value: String(ctx.vehicles.filter((row) => String(row.status) === "MAINTENANCE").length), tone: "amber" as const },
    { label: "إيجارات محسوبة", value: money(totalRent), tone: "slate" as const },
    { label: "صيانة", value: money(totalMaintenance), tone: "amber" as const },
    { label: "تكلفة السيارات", value: money(totalCosts), tone: "slate" as const },
    { label: "حوادث مفتوحة", value: String(openAccidents), tone: openAccidents ? "red" as const : "emerald" as const },
  ];
}

export async function getVehicleModuleData(moduleKey: VehicleModuleKey): Promise<VehicleModuleData> {
  const module = getVehicleModuleConfig(moduleKey);

  try {
    const ctx = await loadVehicleContext();
    return {
      status: "online",
      module,
      modules: vehicleModules,
      rows: rowsForModule(moduleKey, ctx),
      summary: summaryFor(ctx),
      refs: {
        vehicles: ctx.vehicles.map((vehicle) => {
          const driverId = effectiveVehicleDriverId(ctx, vehicle);
          const cityId = idText(vehicle.cityId);
          return {
            id: vehicle.id,
            label: vehiclePlate(vehicle),
            sub: [vehicle.model, statusLabel(vehicle.status), effectiveVehicleDriverName(ctx, vehicle), vehicle.city?.nameAr || vehicle.city?.nameEn].filter(Boolean).join(" - "),
            driverId,
            driverLabel: driverId ? effectiveVehicleDriverName(ctx, vehicle) : "",
            cityId,
            cityLabel: vehicle.city?.nameAr || vehicle.city?.nameEn || "",
          };
        }),
        drivers: ctx.drivers.map((driver) => ({ id: driver.id, label: driver.name || driver.actualName || driver.internalCode || driver.id, sub: [driver.internalCode, driver.city?.nameAr].filter(Boolean).join(" - ") })),
        cities: ctx.cities.map((city) => ({ id: city.id, label: city.nameAr || city.nameEn || city.id })),
        rentalCompanies: ctx.rentalCompanies.map((company) => ({
          id: company.id,
          label: company.name || company.id,
          sub: [company.contact, company.phone, statusLabel(company.status)].filter(Boolean).join(" - "),
        })),
      },
    };
  } catch (error) {
    if (dbOffline(error)) {
      return {
        status: "offline",
        module,
        message: "قاعدة البيانات غير متصلة. يرجى تشغيل PostgreSQL ثم تحديث الصفحة.",
      };
    }
    throw error;
  }
}
