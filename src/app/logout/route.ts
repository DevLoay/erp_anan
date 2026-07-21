import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";

export async function GET(request: Request) {
  const configuredOrigin = process.env.APP_URL || process.env.NEXTAUTH_URL;
  const url = new URL("/login", configuredOrigin || request.url);
  const response = NextResponse.redirect(url);
  response.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  response.cookies.set("erp-user-role", "", { path: "/", maxAge: 0 });
  response.cookies.set("erp-nav-resources", "", { path: "/", maxAge: 0 });
  return response;
}

