import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { canReadResource, canWriteResource, resourceFromPath } from "@/lib/permissions";
import {
  accessLevelFromRequest,
  effectiveRoleForProfile,
  loadUserPermissionProfile,
  profileAllows,
} from "@/lib/auth/userPermissionProfile";
import { prisma } from "@/lib/prisma";

const publicPrefixes = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/rider/login",
  "/api/health",
];

function isPublicPath(pathname: string) {
  return publicPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isAssetPath(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/uploads") ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml|json)$/.test(pathname)
  );
}

function isApiPath(pathname: string) {
  return pathname.startsWith("/api/");
}

function isWriteMethod(method: string) {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

function unauthorizedResponse(request: NextRequest) {
  if (isApiPath(request.nextUrl.pathname)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

function forbiddenResponse(request: NextRequest) {
  if (isApiPath(request.nextUrl.pathname)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const deniedUrl = request.nextUrl.clone();
  deniedUrl.pathname = "/access-denied";
  deniedUrl.search = "";
  deniedUrl.searchParams.set("from", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(deniedUrl);
}

async function projectPathAllowed(pathname: string, profile: Awaited<ReturnType<typeof loadUserPermissionProfile>>) {
  if (!profile) return true;
  const match = pathname.match(/^\/projects\/([^/]+)(?:\/|$)/);
  if (!match?.[1]) return true;
  const projectRef = decodeURIComponent(match[1]);
  const project = await prisma.applicationProject.findFirst({
    where: { OR: [{ id: projectRef }, { code: { equals: projectRef, mode: "insensitive" } }] },
    select: { id: true, cityId: true },
  });
  if (!project) return false;
  if (profile.applicationProjectIds.length && !profile.applicationProjectIds.includes(project.id)) return false;
  if (profile.cityIds.length && (!project.cityId || !profile.cityIds.includes(project.cityId))) return false;
  return true;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (isAssetPath(pathname) || isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value).catch(() => null);
  if (!session) return unauthorizedResponse(request);

  if (pathname.startsWith("/api/rider/")) {
    const riderHeaders = new Headers(request.headers);
    riderHeaders.set("x-user-id", session.userId);
    riderHeaders.set("x-user-email", session.email);
    riderHeaders.set("x-user-role", session.role);
    riderHeaders.set("x-auth-role", session.role);
    return NextResponse.next({ request: { headers: riderHeaders } });
  }

  const resource = resourceFromPath(pathname);
  const profile = await loadUserPermissionProfile(session.userId).catch(() => null);
  const accessLevel = accessLevelFromRequest(request.method, pathname);
  let effectiveRole = session.role;
  if (isApiPath(pathname) && !resource) return forbiddenResponse(request);
  if (resource) {
    const allowed = profile
      ? profileAllows(profile, resource, accessLevel)
      : isWriteMethod(request.method)
        ? canWriteResource(session.role, resource)
        : canReadResource(session.role, resource);
    if (!allowed) return forbiddenResponse(request);
    if (resource === "projects" && !(await projectPathAllowed(pathname, profile))) return forbiddenResponse(request);
    if (profile) effectiveRole = effectiveRoleForProfile(session.role, profile, resource, accessLevel);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user-id", session.userId);
  requestHeaders.set("x-user-email", session.email);
  requestHeaders.set("x-user-role", effectiveRole);
  requestHeaders.set("x-auth-role", session.role);
  if (profile) requestHeaders.set("x-user-permission-profile", profile.profileKey);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
