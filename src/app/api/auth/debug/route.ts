import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function authDebugEnabled() {
  return process.env.AUTH_DEBUG === "1" || process.env.AUTH_DEBUG === "true";
}

export async function GET(request: NextRequest) {
  if (!authDebugEnabled()) {
    return NextResponse.json(
      { ok: false, error: "Auth debug is disabled." },
      { status: 404, headers: { "cache-control": "no-store" } },
    );
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(sessionCookie).catch(() => null);
  const cookieNames = request.cookies.getAll().map((cookie) => cookie.name).sort();

  return NextResponse.json(
    {
      ok: Boolean(session),
      hasSessionCookie: Boolean(sessionCookie),
      sessionValid: Boolean(session),
      hasNavCookie: Boolean(request.cookies.get("erp-nav-resources")?.value),
      hasRoleCookie: Boolean(request.cookies.get("erp-user-role")?.value),
      cookieNames,
      authSecretExists: Boolean(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET),
      forwardedProto: request.headers.get("x-forwarded-proto"),
      host: request.headers.get("host"),
      session: session
        ? {
            userId: session.userId,
            email: session.email,
            role: session.role,
            cityId: session.cityId ?? null,
            supervisorId: session.supervisorId ?? null,
            expiresInSeconds: Math.max(0, session.exp - Math.floor(Date.now() / 1000)),
          }
        : null,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
