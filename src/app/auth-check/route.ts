import { NextRequest, NextResponse } from "next/server";
import { canReadResource, permissionModules } from "@/lib/permissions";
import {
  loadUserPermissionProfile,
  readableResources,
} from "@/lib/auth/userPermissionProfile";
import {
  inspectSessionToken,
  SESSION_COOKIE,
  signSession,
  type SessionInspection,
  type SessionPayload,
} from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function internalPath(value: unknown) {
  const path = String(value ?? "/dashboard").trim();
  return path.startsWith("/") && !path.startsWith("//") ? path : "/dashboard";
}

function isHttpsRequest(request: Request) {
  return request.headers.get("x-forwarded-proto") === "https" || new URL(request.url).protocol === "https:";
}

function redirectPath(path: string, status = 303) {
  return new NextResponse(null, {
    status,
    headers: { Location: path },
  });
}

async function navResourcesFor(session: SessionPayload) {
  const permissionProfile = await loadUserPermissionProfile(session.userId).catch(() => null);
  return permissionProfile
    ? readableResources(permissionProfile)
    : permissionModules.filter((item) => canReadResource(session.role, item.resource)).map((item) => item.resource);
}

function attachAuthCookies(response: NextResponse, request: Request, token: string, session: SessionPayload, navResources: string[]) {
  const isHttps = isHttpsRequest(request);
  const sameSite = isHttps ? "none" : "lax";
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite,
    secure: isHttps,
    path: "/",
    maxAge: 60 * 60 * 10,
  });
  response.cookies.set("erp-user-role", session.role, {
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
}

function htmlResponse(body: string, status = 200) {
  return new NextResponse(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function successHtml(next: string) {
  const safeNext = next.replace(/"/g, "&quot;");
  return `<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="refresh" content="1;url=${safeNext}" />
    <title>MOHAMED SHAWKI ERP</title>
    <style>
      body{margin:0;font-family:system-ui,sans-serif;background:#f8fafc;color:#0f172a}
      main{min-height:100vh;display:grid;place-items:center;padding:24px}
      section{max-width:520px;background:white;border:1px solid #cbd5e1;border-radius:18px;padding:28px;box-shadow:0 10px 25px rgba(15,23,42,.08)}
      p{color:#64748b;font-weight:700;line-height:1.8}
      a{display:inline-block;margin-top:14px;background:#020617;color:white;padding:10px 16px;border-radius:12px;text-decoration:none;font-weight:900}
    </style>
  </head>
  <body>
    <main>
      <section>
        <strong style="color:#1d4ed8">MOHAMED SHAWKI ERP</strong>
        <h1>تم تثبيت الجلسة</h1>
        <p>سيتم فتح لوحة التحكم الآن. إذا لم يتم التحويل تلقائيًا اضغط متابعة.</p>
        <a href="${safeNext}">متابعة</a>
      </section>
    </main>
  </body>
</html>`;
}

function failureHtml(reason: string, hasCookie: boolean, next: string) {
  return `<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>MOHAMED SHAWKI ERP</title>
    <style>
      body{margin:0;font-family:system-ui,sans-serif;background:#f8fafc;color:#0f172a}
      main{min-height:100vh;display:grid;place-items:center;padding:24px}
      section{max-width:620px;background:white;border:1px solid #fecaca;border-radius:18px;padding:28px;box-shadow:0 10px 25px rgba(15,23,42,.08)}
      dl{display:grid;gap:10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:16px}
      div{display:flex;justify-content:space-between;gap:16px;font-weight:800}
      dt{color:#64748b} dd{margin:0;color:#991b1b}
      a{display:inline-block;margin-top:14px;background:#020617;color:white;padding:10px 16px;border-radius:12px;text-decoration:none;font-weight:900}
    </style>
  </head>
  <body>
    <main>
      <section>
        <strong style="color:#1d4ed8">MOHAMED SHAWKI ERP</strong>
        <h1>تعذر تثبيت جلسة الدخول</h1>
        <p>تم إرسال بيانات الدخول، لكن الطلب التالي لم يحمل جلسة صالحة.</p>
        <dl>
          <div><dt>كوكي الجلسة موجودة</dt><dd>${hasCookie ? "نعم" : "لا"}</dd></div>
          <div><dt>سبب الرفض</dt><dd>${reason}</dd></div>
          <div><dt>المسار المطلوب</dt><dd dir="ltr">${next}</dd></div>
        </dl>
        <a href="/login">العودة لتسجيل الدخول</a>
      </section>
    </main>
  </body>
</html>`;
}

export async function GET(request: NextRequest) {
  const next = internalPath(request.nextUrl.searchParams.get("next"));
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const cookieInspection: SessionInspection = await inspectSessionToken(token).catch(() => ({
    ok: false,
    reason: "payload_parse_error",
  }));

  if (cookieInspection.ok) {
    return redirectPath(next);
  }

  const handoff = request.nextUrl.searchParams.get("handoff");
  const handoffInspection: SessionInspection = await inspectSessionToken(handoff).catch(() => ({
    ok: false,
    reason: "payload_parse_error",
  }));

  if (handoffInspection.ok && handoffInspection.session) {
    const session = handoffInspection.session;
    const sessionToken = await signSession({
      userId: session.userId,
      email: session.email,
      name: session.name,
      role: session.role,
      driverId: session.driverId,
      phone: session.phone,
      cityId: session.cityId,
      cityScope: session.cityScope,
      projectScope: session.projectScope,
      supervisorId: session.supervisorId,
    });
    const navResources = await navResourcesFor(session);
    const response = htmlResponse(successHtml(next));
    attachAuthCookies(response, request, sessionToken, session, navResources);
    return response;
  }

  return htmlResponse(
    failureHtml(
      handoffInspection.reason ?? cookieInspection.reason ?? "unknown",
      Boolean(token),
      next,
    ),
  );
}
