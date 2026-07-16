const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const apply = process.argv.includes("--apply");
const confirm = process.argv.includes("--confirm=DELETE_UPLOADED_REPORTS");

async function main() {
  const count = await prisma.uploadedReport.count();

  console.log("UploadedReport rows:", count);

  if (!apply) {
    console.log("Dry-run only. Nothing deleted.");
    console.log("To delete:");
    console.log("node scripts\\cleanup-uploaded-reports.js --apply --confirm=DELETE_UPLOADED_REPORTS");
    return;
  }

  if (!confirm) {
    console.error("Missing confirmation.");
    process.exit(1);
  }

  const result = await prisma.uploadedReport.deleteMany();

  console.log("Deleted UploadedReport rows:", result.count);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
