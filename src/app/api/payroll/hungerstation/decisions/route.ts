import { NextResponse } from "next/server";
import {
  saveHungerStationPayrollAdjustment,
  saveHungerStationPayrollDecision,
  type HungerStationPayrollDecisionType,
} from "@/lib/payroll/hungerstationCompanyPayroll";

type DecisionBody = {
  action?: "SAVE_DECISION" | "SAVE_ADJUSTMENT";
  month?: string;
  riderId?: string;
  rowKey?: string;
  decision?: HungerStationPayrollDecisionType;
  specialOrderRate?: number;
  specialKmRate?: number;
  notes?: string;
  grossSalaryOverride?: number;
  adminDeduction?: number;
  carryoverDeduction?: number;
  housingDeduction?: number;
  trafficViolationDeduction?: number;
  fuelDeduction?: number;
  advanceDeduction?: number;
  simDeduction?: number;
  vehicleDamageDeduction?: number;
  accidentLiabilityDeduction?: number;
  userDeduction?: number;
  vehicleCarryoverDeduction?: number;
  carRentDeduction?: number;
  vehicleRentDays?: number;
  kafalaDeduction?: number;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as DecisionBody;
    const month = body.month || "";
    const riderId = body.riderId || "";

    if (body.action === "SAVE_ADJUSTMENT") {
      const saved = await saveHungerStationPayrollAdjustment({
        month,
        riderId,
        rowKey: body.rowKey || "",
        grossSalaryOverride: body.grossSalaryOverride,
        adminDeduction: body.adminDeduction,
        carryoverDeduction: body.carryoverDeduction,
        housingDeduction: body.housingDeduction,
        trafficViolationDeduction: body.trafficViolationDeduction,
        fuelDeduction: body.fuelDeduction,
        advanceDeduction: body.advanceDeduction,
        simDeduction: body.simDeduction,
        vehicleDamageDeduction: body.vehicleDamageDeduction,
        accidentLiabilityDeduction: body.accidentLiabilityDeduction,
        userDeduction: body.userDeduction,
        vehicleCarryoverDeduction: body.vehicleCarryoverDeduction,
        carRentDeduction: body.carRentDeduction,
        vehicleRentDays: body.vehicleRentDays,
        kafalaDeduction: body.kafalaDeduction,
        notes: body.notes,
      });

      return NextResponse.json({ ok: true, adjustment: saved });
    }

    const decision = body.decision || "AUTO";
    const saved = await saveHungerStationPayrollDecision({
      month,
      riderId,
      decision,
      specialOrderRate: body.specialOrderRate,
      specialKmRate: body.specialKmRate,
      notes: body.notes,
    });

    return NextResponse.json({ ok: true, decision: saved });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "تعذر حفظ القرار" }, { status: 400 });
  }
}
