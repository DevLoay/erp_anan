import { NextResponse } from "next/server";
import { canWriteResource, roleFromHeaders } from "@/lib/permissions";
import { createManagedUser } from "@/lib/users/userManagementMutations";

export async function POST(request: Request) {
  const role = roleFromHeaders(request.headers);
  if (!canWriteResource(role, "users")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const result = await createManagedUser(await request.json());
    return NextResponse.json({ data: result.user, temporaryPassword: result.temporaryPassword }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر إنشاء المستخدم." }, { status: 400 });
  }
}
