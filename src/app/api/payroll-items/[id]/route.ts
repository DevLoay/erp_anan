import { NextResponse } from "next/server";
import { Prisma, PayrollStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canWriteResource, roleFromHeaders } from "@/lib/permissions";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type PatchBody = {
  level?: string;
  relationshipType?: string;
  vehicleOwnershipType?: string;
  vehicleRentDays?: number;
  vehicleDailyRent?: number;
  vehicleMonthlyRent?: number;
  vehicleRentDisplayAmount?: number;
  orders?: number;
  deliveredOrders?: number;
  monthlyTargetOrders?: number;
  extraOrderRate?: number;
  shortageOrders?: number;
  shortageDeduction?: number;
  salaryBaseWorkingDays?: number;
  workedDaysForSalary?: number;
  baseSalaryBeforeProration?: number;
  basicSalary?: number;
  extraOrdersBonus?: number;
  performanceBonus?: number;
  levelBonus?: number;
  manualBonus?: number;
  internalAdvances?: number;
  advancesTotal?: number;
  internalPenalties?: number;
  violationsTotal?: number;
  carRentDeduction?: number;
  carRent?: number;
  fuelDeduction?: number;
  fuelTotal?: number;
  appDeductionsTotal?: number;
  adminCarryoverDeduction?: number;
  housingDeduction?: number;
  trafficViolationDeduction?: number;
  advanceDeduction?: number;
  keetaDeduction?: number;
  keetaFoodCompensation?: number;
  keetaTgaDeduction?: number;
  totalAppDeductions?: number;
  vehicleCarryoverDeduction?: number;
  vehicleDamageDeduction?: number;
  accidentLiabilityDeduction?: number;
  bikeRentDeduction?: number;
  kafalaDeduction?: number;
  kafalaDeductionNotes?: string;
  kafalaDeductionSource?: string;
  userDeduction?: number;
  userDeductionApplied?: boolean;
  userDeductionReason?: string;
  damagesTotal?: number;
  accidentDeduction?: number;
  otherDeductions?: number;
  manualDeduction?: number;
  notes?: string;
};

function toNumber(value: unknown, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function decimal(value: number) {
  return new Prisma.Decimal(Math.round(value * 100) / 100);
}

function lockedStatus(status: string) {
  return status === PayrollStatus.PAID || status === PayrollStatus.LOCKED || status.toLowerCase() === "paid" || status.toLowerCase() === "locked";
}

export async function PATCH(request: Request, context: RouteContext) {
  const role = roleFromHeaders(request.headers);
  if (!canWriteResource(role, "payroll")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "تعديل سطر المسير اليدوي مسموح للمدير فقط." }, { status: 403 });
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as PatchBody;
  const existing = await prisma.payrollItem.findUnique({
    where: { id },
    include: { payrollRun: true },
  });

  if (!existing) return NextResponse.json({ error: "Payroll item not found" }, { status: 404 });
  if (lockedStatus(existing.status) || lockedStatus(existing.payrollRun.status)) {
    return NextResponse.json({ error: "لا يمكن تعديل سطر مسير مدفوع أو مقفل." }, { status: 409 });
  }

  const orders = Math.max(0, Math.round(toNumber(body.orders, existing.orders)));
  const deliveredOrders = Math.max(0, Math.round(toNumber(body.deliveredOrders, existing.deliveredOrders || existing.orders || orders)));
  const monthlyTargetOrders = Math.max(0, Math.round(toNumber(body.monthlyTargetOrders, existing.monthlyTargetOrders)));
  const extraOrders = Math.max(0, deliveredOrders - monthlyTargetOrders);
  const extraOrderRate = toNumber(body.extraOrderRate, toNumber(existing.extraOrderRate));

  const basicSalary = toNumber(body.basicSalary, toNumber(existing.basicSalary));
  const extraOrdersBonus =
    body.extraOrdersBonus === undefined ? extraOrders * extraOrderRate : toNumber(body.extraOrdersBonus, toNumber(existing.extraOrdersBonus));
  const levelBonus = toNumber(body.levelBonus, toNumber(existing.levelBonus || existing.performanceBonus));
  const performanceBonus = toNumber(body.performanceBonus, toNumber(existing.performanceBonus || levelBonus));
  const performanceComponent = performanceBonus || levelBonus;
  const manualBonus = toNumber(body.manualBonus, toNumber(existing.manualBonus));
  const vehicleOwnershipType = body.vehicleOwnershipType ?? existing.vehicleOwnershipType;
  const vehicleRentDays = Math.max(0, Math.round(toNumber(body.vehicleRentDays, existing.vehicleRentDays || existing.rentalDays)));
  const vehicleDailyRent = toNumber(body.vehicleDailyRent, toNumber(existing.vehicleDailyRent));
  const vehicleMonthlyRent = toNumber(body.vehicleMonthlyRent, toNumber(existing.vehicleMonthlyRent));
  const shortageOrders = Math.max(0, Math.round(toNumber(body.shortageOrders, existing.shortageOrders)));
  const shortageDeduction = toNumber(body.shortageDeduction, toNumber(existing.shortageDeduction));
  const salaryBaseWorkingDays = Math.max(1, Math.round(toNumber(body.salaryBaseWorkingDays, existing.salaryBaseWorkingDays || 28)));
  const workedDaysForSalary = Math.max(0, Math.round(toNumber(body.workedDaysForSalary, existing.workedDaysForSalary)));
  const baseSalaryBeforeProration = toNumber(body.baseSalaryBeforeProration, toNumber(existing.baseSalaryBeforeProration || existing.basicSalary));
  const internalAdvances = toNumber(body.internalAdvances ?? body.advancesTotal, toNumber(existing.internalAdvances || existing.advancesTotal));
  const internalPenalties = toNumber(body.internalPenalties ?? body.violationsTotal, toNumber(existing.internalPenalties || existing.violationsTotal));
  const carRentInput = toNumber(body.carRent, toNumber(existing.carRent));
  const carRent = vehicleOwnershipType === "personal_car" ? carRentInput : 0;
  const fuelTotal = toNumber(body.fuelTotal, toNumber(existing.fuelTotal));
  const vehicleRentDisplayAmount =
    vehicleOwnershipType === "company_car"
      ? toNumber(body.vehicleRentDisplayAmount, vehicleDailyRent > 0 ? vehicleDailyRent * vehicleRentDays : vehicleMonthlyRent > 0 ? (vehicleMonthlyRent / 30) * vehicleRentDays : 0)
      : 0;
  const carRentDeduction = 0;
  const fuelDeduction = toNumber(body.fuelDeduction, toNumber(existing.fuelDeduction));
  const keetaDeduction = toNumber(body.keetaDeduction, toNumber(existing.keetaDeduction));
  const keetaFoodCompensation = toNumber(body.keetaFoodCompensation, toNumber(existing.keetaFoodCompensation));
  const keetaTgaDeduction = toNumber(body.keetaTgaDeduction, toNumber(existing.keetaTgaDeduction));
  const calculatedAppDeductions = keetaDeduction + keetaFoodCompensation + keetaTgaDeduction;
  const appDeductionsTotal = toNumber(body.totalAppDeductions ?? body.appDeductionsTotal, calculatedAppDeductions || toNumber(existing.totalAppDeductions || existing.appDeductionsTotal));
  const adminCarryoverDeduction = toNumber(body.adminCarryoverDeduction, toNumber(existing.adminCarryoverDeduction));
  const housingDeduction = toNumber(body.housingDeduction, toNumber(existing.housingDeduction));
  const trafficViolationDeduction = toNumber(body.trafficViolationDeduction ?? body.internalPenalties ?? body.violationsTotal, toNumber(existing.trafficViolationDeduction || existing.internalPenalties || existing.violationsTotal));
  const advanceDeduction = toNumber(body.advanceDeduction ?? body.internalAdvances ?? body.advancesTotal, toNumber(existing.advanceDeduction || existing.internalAdvances || existing.advancesTotal));
  const vehicleCarryoverDeduction = toNumber(body.vehicleCarryoverDeduction, toNumber(existing.vehicleCarryoverDeduction));
  const vehicleDamageDeduction = toNumber(body.vehicleDamageDeduction, toNumber(existing.vehicleDamageDeduction));
  const accidentLiabilityDeduction = toNumber(body.accidentLiabilityDeduction, toNumber(existing.accidentLiabilityDeduction));
  const bikeRentDeduction = toNumber(body.bikeRentDeduction, toNumber(existing.bikeRentDeduction));
  const kafalaDeduction = toNumber(body.kafalaDeduction, toNumber(existing.kafalaDeduction));
  const userDeduction = toNumber(body.userDeduction, toNumber(existing.userDeduction));
  const damagesTotal = toNumber(body.damagesTotal, toNumber(existing.damagesTotal));
  const accidentDeduction = toNumber(body.accidentDeduction, toNumber(existing.accidentDeduction));
  const otherDeductions = toNumber(body.otherDeductions, toNumber(existing.otherDeductions));
  const manualDeduction = toNumber(body.manualDeduction, toNumber(existing.manualDeduction || shortageDeduction));
  const grossSalary = basicSalary + carRent + fuelTotal + extraOrdersBonus + performanceComponent + manualBonus;
  const totalDeductions =
    adminCarryoverDeduction +
    housingDeduction +
    trafficViolationDeduction +
    advanceDeduction +
    fuelDeduction +
    appDeductionsTotal +
    vehicleCarryoverDeduction +
    vehicleDamageDeduction +
    accidentLiabilityDeduction +
    bikeRentDeduction +
    kafalaDeduction +
    userDeduction +
    damagesTotal +
    accidentDeduction +
    otherDeductions +
    manualDeduction;
  const finalSalary = grossSalary - totalDeductions;
  const operationalCosts = vehicleRentDisplayAmount + fuelDeduction;
  const estimatedCompanyProfit = toNumber(existing.companyRevenueFromKeeta) - finalSalary - operationalCosts;
  const costPerOrder = deliveredOrders > 0 ? finalSalary / deliveredOrders : 0;

  const updated = await prisma.payrollItem.update({
    where: { id },
    data: {
      level: body.level ?? existing.level,
      relationshipType: body.relationshipType ?? existing.relationshipType,
      vehicleOwnershipType,
      vehicleRentDays,
      vehicleDailyRent: decimal(vehicleDailyRent),
      vehicleMonthlyRent: decimal(vehicleMonthlyRent),
      vehicleRentDisplayAmount: decimal(vehicleRentDisplayAmount),
      orders,
      deliveredOrders,
      monthlyTargetOrders,
      extraOrders,
      extraOrderRate: decimal(extraOrderRate),
      shortageOrders,
      shortageDeduction: decimal(shortageDeduction),
      salaryBaseWorkingDays,
      workedDaysForSalary,
      baseSalaryBeforeProration: decimal(baseSalaryBeforeProration),
      basicSalary: decimal(basicSalary),
      extraOrdersBonus: decimal(extraOrdersBonus),
      performanceBonus: decimal(performanceBonus),
      levelBonus: decimal(levelBonus),
      manualBonus: decimal(manualBonus),
      grossSalary: decimal(grossSalary),
      totalEarnings: decimal(grossSalary),
      advancesTotal: decimal(advanceDeduction),
      internalAdvances: decimal(advanceDeduction),
      violationsTotal: decimal(trafficViolationDeduction),
      internalPenalties: decimal(internalPenalties),
      carRent: decimal(carRent),
      carRentDeduction: decimal(carRentDeduction),
      fuelTotal: decimal(fuelTotal),
      fuelDeduction: decimal(fuelDeduction),
      appDeductionsTotal: decimal(appDeductionsTotal),
      adminCarryoverDeduction: decimal(adminCarryoverDeduction),
      housingDeduction: decimal(housingDeduction),
      trafficViolationDeduction: decimal(trafficViolationDeduction),
      advanceDeduction: decimal(advanceDeduction),
      keetaDeduction: decimal(keetaDeduction),
      keetaFoodCompensation: decimal(keetaFoodCompensation),
      keetaTgaDeduction: decimal(keetaTgaDeduction),
      totalAppDeductions: decimal(appDeductionsTotal),
      vehicleCarryoverDeduction: decimal(vehicleCarryoverDeduction),
      vehicleDamageDeduction: decimal(vehicleDamageDeduction),
      accidentLiabilityDeduction: decimal(accidentLiabilityDeduction),
      bikeRentDeduction: decimal(bikeRentDeduction),
      kafalaDeduction: decimal(kafalaDeduction),
      kafalaDeductionNotes: body.kafalaDeductionNotes ?? existing.kafalaDeductionNotes,
      kafalaDeductionSource: body.kafalaDeductionSource ?? existing.kafalaDeductionSource,
      userDeduction: decimal(userDeduction),
      userDeductionApplied: body.userDeductionApplied ?? userDeduction > 0,
      userDeductionReason: body.userDeductionReason ?? existing.userDeductionReason,
      damagesTotal: decimal(damagesTotal),
      accidentDeduction: decimal(accidentDeduction),
      otherDeductions: decimal(otherDeductions),
      manualDeduction: decimal(manualDeduction),
      totalDeductions: decimal(totalDeductions),
      netSalary: decimal(finalSalary),
      finalSalary: decimal(finalSalary),
      estimatedCompanyProfit: decimal(estimatedCompanyProfit),
      costPerOrder: decimal(costPerOrder),
      notes: body.notes ?? existing.notes,
    },
  });

  const totals = await prisma.payrollItem.aggregate({
    where: { payrollRunId: existing.payrollRunId },
    _count: { _all: true },
    _sum: {
      orders: true,
      grossSalary: true,
      totalEarnings: true,
      totalDeductions: true,
      finalSalary: true,
      companyRevenueFromKeeta: true,
      estimatedCompanyProfit: true,
    },
  });

  await prisma.payrollRun.update({
    where: { id: existing.payrollRunId },
    data: {
      totalDrivers: totals._count._all,
      totalOrders: totals._sum.orders ?? 0,
      totalEarnings: totals._sum.grossSalary ?? totals._sum.totalEarnings ?? decimal(0),
      totalDeductions: totals._sum.totalDeductions ?? decimal(0),
      netTotal: totals._sum.finalSalary ?? decimal(0),
      totalCompanyRevenue: totals._sum.companyRevenueFromKeeta ?? decimal(0),
      estimatedCompanyProfit: totals._sum.estimatedCompanyProfit ?? decimal(0),
    },
  });

  await prisma.auditLog.create({
    data: {
      user: "Admin",
      action: "UPDATE_PAYROLL_ITEM_MANUAL",
      entityType: "PayrollItem",
      entityId: existing.id,
      before: {
        level: existing.level,
        orders: existing.orders,
        deliveredOrders: existing.deliveredOrders,
        vehicleOwnershipType: existing.vehicleOwnershipType,
        vehicleRentDays: existing.vehicleRentDays,
        basicSalary: toNumber(existing.basicSalary),
        shortageDeduction: toNumber(existing.shortageDeduction),
        carRentDeduction: toNumber(existing.carRentDeduction),
        vehicleRentDisplayAmount: toNumber(existing.vehicleRentDisplayAmount),
        appDeductionsTotal: toNumber(existing.totalAppDeductions || existing.appDeductionsTotal),
        kafalaDeduction: toNumber(existing.kafalaDeduction),
        userDeduction: toNumber(existing.userDeduction),
        totalDeductions: toNumber(existing.totalDeductions),
        finalSalary: toNumber(existing.finalSalary || existing.netSalary),
      },
      after: {
        level: updated.level,
        orders: updated.orders,
        deliveredOrders: updated.deliveredOrders,
        vehicleOwnershipType: updated.vehicleOwnershipType,
        vehicleRentDays: updated.vehicleRentDays,
        basicSalary,
        shortageDeduction,
        carRentDeduction,
        vehicleRentDisplayAmount,
        appDeductionsTotal,
        kafalaDeduction,
        userDeduction,
        totalDeductions,
        finalSalary,
      },
    },
  });

  return NextResponse.json({ data: updated });
}
