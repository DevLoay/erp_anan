import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, signSession } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/users/userManagementMutations";

function jsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { email?: string; password?: string };
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  if (!email || !password) {
    return NextResponse.json({ error: "البريد الإلكتروني وكلمة المرور مطلوبان." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive || user.status === "inactive" || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: "بيانات الدخول غير صحيحة أو الحساب غير نشط." }, { status: 401 });
  }

  const token = await signSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });

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

  const response = NextResponse.json({ ok: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 10,
  });
  response.cookies.set("erp-user-role", user.role, { sameSite: "lax", path: "/", maxAge: 60 * 60 * 10 });
  return response;
}

