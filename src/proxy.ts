import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import type { AppRole } from "@/lib/permissions";

const publicPrefixes = ["/login", "/logout", "/forgot-password", "/reset-password", "/access-denied", "/api/auth", "/_next", "/favicon.ico", "/robots.txt", "/sitemap.xml"];
const adminOnlyPrefixes = ["/users", "/user-management", "/permissions", "/audit-log", "/settings/templates", "/settings/payroll", "/payroll/settings"];
const financePrefixes = ["/finance", "/payroll", "/invoices", "/receivables", "/payments", "/expenses", "/revenues", "/deductions", "/financial"];
const operationsPrefixes = ["/dashboard", "/projects", "/applications", "/imports", "/daily-reports", "/rider", "/cities", "/city", "/supervisors", "/notifications", "/attendance", "/vehicles", "/vehicle", "/violations", "/advances", "/management-reports", "/reports", "/performance-analysis"];

function isPublic(pathname: string) {
  return publicPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function canAccessPath(role: AppRole, pathname: string) {
  if (role === "ADMIN") return true;
  if (adminOnlyPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return false;
  if (role === "OPERATION_MANAGER") return operationsPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (role === "ACCOUNTANT") return financePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) || pathname === "/dashboard";
  if (role === "HR") return ["/dashboard", "/drivers", "/hr", "/human-resources", "/cities", "/projects", "/attendance"].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (role === "SUPERVISOR") return ["/dashboard", "/drivers", "/supervisors", "/daily-reports", "/rider-reports", "/rider-kpi", "/attendance", "/notifications", "/violations"].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return ["/dashboard", "/reports", "/management-reports"].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (!canAccessPath(session.role, pathname)) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const denied = request.nextUrl.clone();
    denied.pathname = "/access-denied";
    denied.search = "";
    return NextResponse.rewrite(denied);
  }

  const headers = new Headers(request.headers);
  headers.set("x-user-id", session.userId);
  headers.set("x-user-email", session.email);
  headers.set("x-user-role", session.role);
  headers.set("x-user-name", session.name);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!.*\\.).*)"],
};
