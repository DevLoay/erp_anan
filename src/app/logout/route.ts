import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";

export async function GET(request: Request) {
  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: "/login" },
  });
  response.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  response.cookies.set("erp-user-role", "", { path: "/", maxAge: 0 });
  response.cookies.set("erp-nav-resources", "", { path: "/", maxAge: 0 });
  return response;
}

