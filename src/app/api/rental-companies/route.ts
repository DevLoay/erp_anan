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

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const name = cleanText(body.name);
    if (!name) return NextResponse.json({ error: "اسم شركة التأجير مطلوب." }, { status: 400 });

    const existing = await prisma.rentalCompany.findFirst({ where: { name } });
    if (existing) {
      const updated = await prisma.rentalCompany.update({
        where: { id: existing.id },
        data: {
          contact: cleanText(body.contact) ?? existing.contact,
          phone: cleanText(body.phone) ?? existing.phone,
          status: safeStatus(body.status) as any,
          notes: cleanText(body.notes) ?? existing.notes,
        },
      });
      return NextResponse.json({ data: updated, reused: true }, { status: 200 });
    }

    const record = await prisma.rentalCompany.create({
      data: {
        name,
        contact: cleanText(body.contact),
        phone: cleanText(body.phone),
        status: safeStatus(body.status) as any,
        notes: cleanText(body.notes),
      },
    });

    return NextResponse.json({ data: record }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر حفظ شركة التأجير.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
