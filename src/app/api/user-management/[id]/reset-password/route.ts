import { NextResponse } from "next/server";
import { canWriteResource, roleFromHeaders } from "@/lib/permissions";
import { resetManagedUserPassword } from "@/lib/users/userManagementMutations";

type Context = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: Context) {
  const role = roleFromHeaders(request.headers);
  if (!canWriteResource(role, "users")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { id } = await context.params;
    const result = await resetManagedUserPassword(id);
    return NextResponse.json({ data: result.user, temporaryPassword: result.temporaryPassword });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر إعادة كلمة المرور." }, { status: 400 });
  }
}
