import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, signSession } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/users/userManagementMutations";
import { canReadResource, permissionModules, resourceFromPath, type AppRole } from "@/lib/permissions";
import {
  loadUserPermissionProfile,
  profileAllows,
  readableResources,
  type UserPermissionProfile,
} from "@/lib/auth/userPermissionProfile";

type LoginBody = {
  email?: string;
  password?: string;
  nextPath?: string;
};

function jsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function normalizedInternalPath(value: unknown) {
  const path = String(value ?? "").trim();
  return path.startsWith("/") && !path.startsWith("//") ? path : "";
}

function canOpenPath(path: string, role: AppRole, profile: UserPermissionProfile | null) {
  const pathname = path.split(/[?#]/, 1)[0] || "/";
  const resource = resourceFromPath(pathname);
  if (!resource) return false;
  return profile ? profileAllows(profile, resource, "view") : canReadResource(role, resource);
}

function authDebugEnabled() {
  return process.env.AUTH_DEBUG === "1" || process.env.AUTH_DEBUG === "true";
}

function debugAuth(event: string, details: Record<string, unknown>) {
  if (!authDebugEnabled()) return;
  console.warn(`[auth:${event}]`, details);
}

function resolveLandingPath(requestedPath: unknown, role: AppRole, profile: UserPermissionProfile | null) {
  const requested = normalizedInternalPath(requestedPath);
  if (requested && canOpenPath(requested, role, profile)) return requested;

  const preferredRoutes: Partial<Record<AppRole, string[]>> = {
    ADMIN: ["/dashboard"],
    OPERATION_MANAGER: ["/dashboard", "/projects", "/drivers"],
    SUPERVISOR: ["/dashboard", "/drivers", "/daily-reports", "/supervisor-tasks"],
    ACCOUNTANT: ["/finance", "/payroll", "/advances"],
    HR: ["/drivers", "/rider-documents", "/rider-housing"],
    VIEWER: ["/notifications"],
  };
  const candidates = [...(preferredRoutes[role] ?? []), ...permissionModules.map((item) => item.route)];
  return candidates.find((path) => canOpenPath(path, role, profile)) ?? "/access-denied";
}

function isHttpsRequest(request: Request) {
  return request.headers.get("x-forwarded-proto") === "https" || new URL(request.url).protocol === "https:";
}

function wantsFormRedirect(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  return contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data");
}

async function readLoginBody(request: Request): Promise<{ body: LoginBody; formRedirect: boolean }> {
  if (wantsFormRedirect(request)) {
    const form = await request.formData();
    return {
      formRedirect: true,
      body: {
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
        nextPath: String(form.get("nextPath") ?? ""),
      },
    };
  }

  return {
    formRedirect: false,
    body: (await request.json().catch(() => ({}))) as LoginBody,
  };
}

function safeLoginPath(nextPath: unknown, error: string) {
  const url = new URL("https://local.invalid/login");
  const next = normalizedInternalPath(nextPath);
  if (next) url.searchParams.set("next", next);
  url.searchParams.set("error", error);
  return `${url.pathname}${url.search}`;
}

function redirectPath(path: string, status = 303) {
  return new NextResponse(null, {
    status,
    headers: { Location: path },
  });
}

function loginError(request: Request, formRedirect: boolean, nextPath: unknown, message: string, status: number, errorCode = "invalid") {
  if (formRedirect) {
    return redirectPath(safeLoginPath(nextPath, errorCode));
  }
  return NextResponse.json({ error: message }, { status });
}

function attachAuthCookies(response: NextResponse, request: Request, token: string, role: AppRole, navResources: string[]) {
  const isHttps = isHttpsRequest(request);
  const sameSite = isHttps ? "none" : "lax";
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite,
    secure: isHttps,
    path: "/",
    maxAge: 60 * 60 * 10,
  });
  response.cookies.set("erp-user-role", role, {
    sameSite,
    secure: isHttps,
    path: "/",
    maxAge: 60 * 60 * 10,
  });
  response.cookies.set("erp-nav-resources", navResources.join(","), {
    sameSite,
    secure: isHttps,
    path: "/",
    maxAge: 60 * 60 * 10,
  });
  return isHttps;
}

export async function POST(request: Request) {
  const { body, formRedirect } = await readLoginBody(request);
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  if (!email || !password) {
    return loginError(request, formRedirect, body.nextPath, "البريد الإلكتروني وكلمة المرور مطلوبان.", 400, "missing");
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive || user.status === "inactive" || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    debugAuth("login_failed", {
      email,
      userFound: Boolean(user),
      isActive: user?.isActive,
      status: user?.status,
      hasPasswordHash: Boolean(user?.passwordHash),
    });
    return loginError(request, formRedirect, body.nextPath, "بيانات الدخول غير صحيحة أو الحساب غير نشط.", 401, "invalid");
  }

  // Keep the signed session compact; large scope strings belong in DB/profile lookups.
  const token = await signSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    driverId: user.driverId ?? undefined,
    cityId: user.cityId ?? undefined,
    supervisorId: user.supervisorId ?? undefined,
  });

  const permissionProfile = await loadUserPermissionProfile(user.id).catch(() => null);
  const navResources = permissionProfile
    ? readableResources(permissionProfile)
    : permissionModules.filter((item) => canReadResource(user.role, item.resource)).map((item) => item.resource);
  const redirectTo = resolveLandingPath(body.nextPath, user.role, permissionProfile);

  await prisma.auditLog
    .create({
      data: {
        userId: user.id,
        user: user.email,
        action: "LOGIN",
        entityType: "User",
        entityId: user.id,
        after: jsonValue({ email: user.email, role: user.role }),
        newValue: jsonValue({ email: user.email, role: user.role }),
      },
    })
    .catch(() => null);

  const response = formRedirect
    ? redirectPath(redirectTo)
    : NextResponse.json({
        ok: true,
        redirectTo,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          cityId: user.cityId,
          cityScope: user.cityScope,
          projectScope: user.projectScope,
          supervisorId: user.supervisorId,
        },
      });

  const secureCookie = attachAuthCookies(response, request, token, user.role, navResources);

  debugAuth("login_success", {
    userId: user.id,
    role: user.role,
    redirectTo,
    cookieName: SESSION_COOKIE,
    secureCookie,
    formRedirect,
    navResourceCount: navResources.length,
  });
  return response;
}
