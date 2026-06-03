import { NextResponse } from "next/server";
import { canWriteResource, roleFromHeaders } from "@/lib/permissions";
import { deactivateManagedUser, updateManagedUser } from "@/lib/users/userManagementMutations";

type Context = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: Context) {
  const role = roleFromHeaders(request.headers);
  if (!canWriteResource(role, "users")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { id } = await context.params;
    const result = await updateManagedUser(id, await request.json());
    return NextResponse.json({ data: result.user });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر تعديل المستخدم." }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: Context) {
  const role = roleFromHeaders(request.headers);
  if (!canWriteResource(role, "users")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { id } = await context.params;
    const result = await deactivateManagedUser(id);
    return NextResponse.json({ data: result.user });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر تعطيل المستخدم." }, { status: 400 });
  }
}
