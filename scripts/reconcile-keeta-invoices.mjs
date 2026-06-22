import { PrismaClient, RecordStatus } from "@prisma/client";

const prisma = new PrismaClient();

const APPROVED_BATCH_STATUSES = new Set([
  "approved",
  "committed",
  "committed_processed",
  "committed_with_review",
  "locked",
]);

function isApprovedBatch(status) {
  return APPROVED_BATCH_STATUSES.has(String(status || "").toLowerCase());
}

async function main() {
  const invoices = await prisma.invoice.findMany({
    where: {
      client: { equals: "Keeta", mode: "insensitive" },
      applicationProjectId: { not: null },
      month: { not: null },
    },
    select: {
      id: true,
      applicationProjectId: true,
      importBatchId: true,
      month: true,
      amount: true,
      updatedAt: true,
      createdAt: true,
      status: true,
      invoiceStatus: true,
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });

  const batchIds = [...new Set(invoices.map((invoice) => invoice.importBatchId).filter(Boolean))];
  const batches = await prisma.applicationImportBatch.findMany({
    where: { id: { in: batchIds } },
    select: { id: true, status: true, approvedAt: true, updatedAt: true, createdAt: true },
  });
  const batchById = new Map(batches.map((batch) => [batch.id, batch]));

  const groups = new Map();
  for (const invoice of invoices) {
    const key = `${invoice.applicationProjectId}:${invoice.month}`;
    const current = groups.get(key) || [];
    current.push(invoice);
    groups.set(key, current);
  }

  const summary = [];
  for (const [key, group] of groups) {
    const sorted = [...group].sort((a, b) => {
      const batchA = a.importBatchId ? batchById.get(a.importBatchId) : null;
      const batchB = b.importBatchId ? batchById.get(b.importBatchId) : null;
      const scoreA = Number(isApprovedBatch(batchA?.status)) * 10 + new Date(batchA?.updatedAt || a.updatedAt || a.createdAt).getTime() / 1e15;
      const scoreB = Number(isApprovedBatch(batchB?.status)) * 10 + new Date(batchB?.updatedAt || b.updatedAt || b.createdAt).getTime() / 1e15;
      return scoreB - scoreA;
    });
    const keeper = sorted[0];
    const superseded = sorted.slice(1);
    const batch = keeper.importBatchId ? batchById.get(keeper.importBatchId) : null;

    await prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id: keeper.id },
        data: {
          status: RecordStatus.APPROVED,
          invoiceStatus: "Approved",
          approvedAt: batch?.approvedAt || new Date(),
        },
      });

      if (keeper.importBatchId) {
        await tx.applicationImportBatch.update({
          where: { id: keeper.importBatchId },
          data: { status: "committed_processed", approvedAt: batch?.approvedAt || new Date() },
        });
      }

      for (const oldInvoice of superseded) {
        await tx.invoice.update({
          where: { id: oldInvoice.id },
          data: { status: RecordStatus.INACTIVE, invoiceStatus: "Superseded" },
        });
        if (oldInvoice.importBatchId) {
          await tx.applicationImportBatch.update({
            where: { id: oldInvoice.importBatchId },
            data: { status: "superseded", validRows: 0, unmatchedRows: 0 },
          });
          await tx.keetaInvoiceRecord.updateMany({
            where: { invoiceBatchId: oldInvoice.importBatchId },
            data: { status: "Superseded" },
          });
        }
      }
    });

    summary.push({
      key,
      keptInvoiceId: keeper.id,
      keptBatchId: keeper.importBatchId,
      supersededInvoices: superseded.map((invoice) => invoice.id),
      supersededBatches: superseded.map((invoice) => invoice.importBatchId).filter(Boolean),
    });
  }

  await prisma.auditLog.create({
    data: {
      user: "Codex",
      action: "RECONCILE_KEETA_INVOICE_DUPLICATES",
      entityType: "Invoice",
      entityId: "keeta",
      newValue: { groups: summary },
    },
  });

  console.log(JSON.stringify({ groups: summary.length, summary }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
