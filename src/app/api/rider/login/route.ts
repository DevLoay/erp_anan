import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { authenticateRider, auditRiderAction } from "@/lib/rider-app/riderAuth";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { identifier?: string; password?: string };
  const result = await authenticateRider(String(body.identifier || ""), String(body.password || ""));
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 401 });
  const driver = result.driver;
  if (!driver) return NextResponse.json({ error: "حساب المندوب غير مكتمل الربط." }, { status: 401 });

  await auditRiderAction(driver.id, "RIDER_LOGIN", "Driver", driver.id, {
    identifier: body.identifier,
    loginSource: result.user ? "user_account" : "driver_fallback",
  });

  const response = NextResponse.json({
    ok: true,
    rider: {
      id: driver.id,
      name: driver.actualName || driver.name,
      driverCode: driver.driverCode || driver.internalCode,
    },
  });
  response.cookies.set(SESSION_COOKIE, result.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 10,
  });
  response.cookies.set("erp-user-role", "VIEWER", { sameSite: "lax", path: "/", maxAge: 60 * 60 * 10 });
  return response;
}
