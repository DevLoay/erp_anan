const fs = require("fs");
const path = require("path");

const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");
if (!fs.existsSync(schemaPath)) {
  throw new Error(`schema.prisma not found: ${schemaPath}`);
}

let schema = fs.readFileSync(schemaPath, "utf8");

function replaceOnce(label, pattern, replacement) {
  if (!pattern.test(schema)) {
    console.log(`Skipped ${label}: pattern not found or already patched.`);
    return;
  }
  schema = schema.replace(pattern, replacement);
  console.log(`Patched ${label}.`);
}

if (!/model Vehicle[\s\S]*?rentalCompanyId\s+String\?/m.test(schema)) {
  replaceOnce(
    "Vehicle.rentalCompanyId",
    /(\n\s*rentalCompany\s+String\?)/,
    `$1\n  rentalCompanyId String?`
  );
} else {
  console.log("Vehicle.rentalCompanyId already exists.");
}

if (!/model Vehicle[\s\S]*?rentalCompanyRef\s+RentalCompany\?/m.test(schema)) {
  replaceOnce(
    "Vehicle.rentalCompanyRef relation",
    /(\n\s*currentDriver\s+Driver\?[^\n]*\n)/,
    `$1  rentalCompanyRef RentalCompany? @relation(fields: [rentalCompanyId], references: [id], onDelete: SetNull)\n`
  );
} else {
  console.log("Vehicle.rentalCompanyRef already exists.");
}

if (!/@@index\(\[rentalCompanyId\]\)/.test(schema)) {
  replaceOnce(
    "Vehicle rentalCompanyId index",
    /(\n\s*@@index\(\[plateAr\]\))/,
    `\n  @@index([rentalCompanyId])$1`
  );
} else {
  console.log("Vehicle rentalCompanyId index already exists.");
}

if (!/model RentalCompany[\s\S]*?\n\s*vehicles\s+Vehicle\[\]/m.test(schema)) {
  replaceOnce(
    "RentalCompany.vehicles relation",
    /(model RentalCompany \{[\s\S]*?\n\s*notes\s+String\?\n)/,
    `$1  vehicles  Vehicle[]\n`
  );
} else {
  console.log("RentalCompany.vehicles already exists.");
}

fs.writeFileSync(schemaPath, schema, "utf8");
console.log("Done. Now run: npx prisma db push && npx prisma generate");
