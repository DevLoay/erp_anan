import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canWriteResource, roleFromHeaders } from "@/lib/permissions";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const role = roleFromHeaders(request.headers);
  if (!canWriteResource(role, "applications")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await context.params;
  const [batch, rows] = await Promise.all([
    prisma.applicationImportBatch.findUnique({ where: { id }, select: { status: true } }),
    prisma.applicationImportRow.findMany({
      where: { batchId: id },
      select: { isValid: true, errorType: true, status: true, driverId: true, applicationAccountId: true },
    }),
  ]);
  if (!batch) return NextResponse.json({ error: "Import batch not found" }, { status: 404 });
  const totalRows = rows.length;
  const validRows = rows.filter((row) => row.isValid).length;
  const invalidRows = totalRows - validRows;
  const duplicateRows = rows.filter((row) => String(row.errorType ?? row.status).toLowerCase().includes("duplicate")).length;
  const missingDrivers = rows.filter((row) => !row.driverId && String(row.errorType ?? row.status).toLowerCase().includes("driver")).length;
  const unlinkedAccounts = rows.filter((row) => !row.applicationAccountId && String(row.errorType ?? row.status).toLowerCase().includes("account")).length;
  const data = await prisma.applicationImportBatch.update({
    where: { id },
    data: {
      totalRows,
      validRows,
      invalidRows,
      duplicateRows,
      missingDrivers,
      unlinkedAccounts,
      status: String(batch.status).startsWith("committed")
        ? invalidRows
          ? "committed_processed_with_errors"
          : "committed_processed"
        : invalidRows
          ? "preview_revalidated_with_errors"
          : "preview_revalidated",
    },
  });
  return NextResponse.json({
    data,
    message: "تمت إعادة احتساب حالة الدفعة وتحديث ملخص الصفوف والأخطاء.",
  });
}
