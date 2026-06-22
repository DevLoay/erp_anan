import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function cleanText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function safeStatus(value: unknown) {
  const status = String(value ?? "ACTIVE").trim().toUpperCase();
  const allowed = new Set(["ACTIVE", "INACTIVE", "PENDING", "APPROVED", "REJECTED", "LOCKED"]);
  return allowed.has(status) ? status : "ACTIVE";
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const name = cleanText(body.name);
    if (!name) return NextResponse.json({ error: "اسم شركة التأجير مطلوب." }, { status: 400 });

    const record = await prisma.rentalCompany.update({
      where: { id },
      data: {
        name,
        contact: cleanText(body.contact),
        phone: cleanText(body.phone),
        status: safeStatus(body.status) as any,
        notes: cleanText(body.notes),
      },
    });

    await prisma.vehicle.updateMany({ where: { rentalCompanyId: id } as any, data: { rentalCompany: record.name } as any }).catch(() => null);

    return NextResponse.json({ data: record });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر تعديل شركة التأجير.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const used = await prisma.vehicle.count({ where: { rentalCompanyId: id } as any }).catch(() => 0);
    if (used > 0) {
      return NextResponse.json({ error: `لا يمكن حذف الشركة لأنها مرتبطة بعدد ${used} سيارة. غيّر حالة الشركة إلى غير نشط بدل الحذف.` }, { status: 400 });
    }
    const record = await prisma.rentalCompany.update({ where: { id }, data: { status: "INACTIVE" as any } });
    return NextResponse.json({ data: record });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر تعطيل شركة التأجير.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
