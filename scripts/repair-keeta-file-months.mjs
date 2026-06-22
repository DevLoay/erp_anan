import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function monthFromKeetaInvoiceFileName(fileName = "") {
  const hashMatch = fileName.match(/#(20\d{2})-(0[1-9]|1[0-2])#/);
  if (hashMatch) return `${hashMatch[1]}-${hashMatch[2]}`;
  const slabMatch = fileName.match(/\b(20\d{2})-(0[1-9]|1[0-2])\b.*\bBill/i);
  return slabMatch ? `${slabMatch[1]}-${slabMatch[2]}` : "";
}

function monthParts(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  return {
    year,
    monthNumber,
    periodStart: new Date(Date.UTC(year, monthNumber - 1, 1)),
    periodEnd: new Date(Date.UTC(year, monthNumber, 0, 23, 59, 59, 999)),
  };
}

async function main() {
  const batches = await prisma.applicationImportBatch.findMany({
    where: {
      OR: [
        { fileType: "keeta_driver_invoice_template" },
        { importType: "keeta_driver_invoice_template" },
      ],
      fileName: { contains: "#" },
    },
    select: {
      id: true,
      fileName: true,
      sourceFileName: true,
      month: true,
      applicationProjectId: true,
      cityId: true,
      status: true,
    },
  });

  const changed = [];
  for (const batch of batches) {
    const detectedMonth = monthFromKeetaInvoiceFileName(batch.fileName || batch.sourceFileName || "");
    if (!detectedMonth || detectedMonth === batch.month) continue;
    const { periodStart, periodEnd } = monthParts(detectedMonth);

    await prisma.$transaction(async (tx) => {
      await tx.applicationImportBatch.update({
        where: { id: batch.id },
        data: { month: detectedMonth, periodStart, periodEnd },
      });
      await tx.keetaInvoiceRecord.updateMany({
        where: { invoiceBatchId: batch.id },
        data: { month: detectedMonth, periodStart, periodEnd },
      });
      await tx.keetaInvoiceDetailRecord.updateMany({
        where: { invoiceBatchId: batch.id },
        data: {},
      }).catch(() => null);
      await tx.invoice.updateMany({
        where: { importBatchId: batch.id },
        data: { month: detectedMonth },
      });
      await tx.uploadedReport.updateMany({
        where: { fileName: batch.fileName || batch.sourceFileName || "" },
        data: { month: detectedMonth },
      }).catch(() => null);
      await tx.importBatch.updateMany({
        where: { fileName: batch.fileName || batch.sourceFileName || "" },
        data: { month: detectedMonth },
      }).catch(() => null);
    });

    changed.push({
      batchId: batch.id,
      fileName: batch.fileName,
      from: batch.month,
      to: detectedMonth,
      applicationProjectId: batch.applicationProjectId,
      cityId: batch.cityId,
    });
  }

  console.log(JSON.stringify({ changedCount: changed.length, changed }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
