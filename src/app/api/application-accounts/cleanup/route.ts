import { NextResponse } from "next/server";
import { cleanupApplicationAccounts } from "@/lib/application-accounts/accountLinking";
import { canWriteResource, roleFromHeaders } from "@/lib/permissions";

export async function POST(request: Request) {
  const role = roleFromHeaders(request.headers);
  if (!canWriteResource(role, "application-accounts")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const dryRun = Boolean(body?.dryRun);

  try {
    const result = await cleanupApplicationAccounts(dryRun);
    return NextResponse.json({ data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر إصلاح ربط حسابات التطبيقات.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
