const fs = require("fs");
const path = require("path");

const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");
if (!fs.existsSync(schemaPath)) {
  throw new Error(`schema.prisma not found: ${schemaPath}`);
}

let schema = fs.readFileSync(schemaPath, "utf8");

function getModelBlock(modelName) {
  const start = schema.indexOf(`model ${modelName} {`);
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < schema.length; i++) {
    const ch = schema[i];
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) return { start, end: i + 1, text: schema.slice(start, i + 1) };
    }
  }
  return null;
}

function replaceBlock(block, nextText) {
  schema = schema.slice(0, block.start) + nextText + schema.slice(block.end);
}

let changed = false;

let vehicle = getModelBlock("Vehicle");
if (!vehicle) throw new Error("model Vehicle not found in schema.prisma");
let vehicleText = vehicle.text;

if (!/\n\s*rentalCompanyId\s+String\?/m.test(vehicleText)) {
  if (/\n\s*rentalCompany\s+String\?/m.test(vehicleText)) {
    vehicleText = vehicleText.replace(/(\n\s*rentalCompany\s+String\?[^\n]*\n)/, `$1  rentalCompanyId String?\n`);
  } else {
    vehicleText = vehicleText.replace(/(\n\s*ownershipType\s+String[^\n]*\n)/, `$1  rentalCompany   String?\n  rentalCompanyId String?\n`);
  }
  changed = true;
  console.log("Added Vehicle.rentalCompanyId");
} else {
  console.log("Vehicle.rentalCompanyId already exists");
}

if (!/\n\s*rentalCompanyRef\s+RentalCompany\?/m.test(vehicleText)) {
  const relationLine = `  rentalCompanyRef RentalCompany? @relation("VehicleRentalCompany", fields: [rentalCompanyId], references: [id], onDelete: SetNull)\n`;
  if (/\n\s*currentDriver\s+Driver\?/m.test(vehicleText)) {
    vehicleText = vehicleText.replace(/(\n\s*currentDriver\s+Driver\?[^\n]*\n)/, `$1${relationLine}`);
  } else if (/\n\s*city\s+City\?/m.test(vehicleText)) {
    vehicleText = vehicleText.replace(/(\n\s*city\s+City\?[^\n]*\n)/, `$1${relationLine}`);
  } else {
    vehicleText = vehicleText.replace(/(\n\s*updatedAt\s+DateTime[^\n]*\n)/, `$1\n${relationLine}`);
  }
  changed = true;
  console.log("Added Vehicle.rentalCompanyRef relation");
} else {
  console.log("Vehicle.rentalCompanyRef already exists");
}

if (!/@@index\(\[rentalCompanyId\]\)/m.test(vehicleText)) {
  const lastIndex = vehicleText.lastIndexOf("@@index");
  if (lastIndex !== -1) {
    const lineEnd = vehicleText.indexOf("\n", lastIndex);
    vehicleText = vehicleText.slice(0, lineEnd + 1) + `  @@index([rentalCompanyId])\n` + vehicleText.slice(lineEnd + 1);
  } else {
    vehicleText = vehicleText.replace(/\n\}/, `\n  @@index([rentalCompanyId])\n}`);
  }
  changed = true;
  console.log("Added Vehicle rentalCompanyId index");
} else {
  console.log("Vehicle rentalCompanyId index already exists");
}

replaceBlock(vehicle, vehicleText);

let rentalCompany = getModelBlock("RentalCompany");
if (!rentalCompany) throw new Error("model RentalCompany not found in schema.prisma");
let rentalCompanyText = rentalCompany.text;

if (!/\n\s*vehicles\s+Vehicle\[\]/m.test(rentalCompanyText)) {
  rentalCompanyText = rentalCompanyText.replace(/(\n\s*updatedAt\s+DateTime[^\n]*\n)/, `$1\n  vehicles Vehicle[] @relation("VehicleRentalCompany")\n`);
  changed = true;
  console.log("Added RentalCompany.vehicles relation");
} else if (/\n\s*vehicles\s+Vehicle\[\]\s*$/m.test(rentalCompanyText) && !/vehicles\s+Vehicle\[\]\s+@relation\("VehicleRentalCompany"\)/m.test(rentalCompanyText)) {
  rentalCompanyText = rentalCompanyText.replace(/\n\s*vehicles\s+Vehicle\[\]/m, `\n  vehicles Vehicle[] @relation("VehicleRentalCompany")`);
  changed = true;
  console.log("Normalized RentalCompany.vehicles relation name");
} else {
  console.log("RentalCompany.vehicles already exists");
}

replaceBlock(rentalCompany, rentalCompanyText);

fs.writeFileSync(schemaPath, schema, "utf8");
console.log(changed ? "schema.prisma repaired." : "schema.prisma already OK.");
console.log("Next: npx prisma db push && npx prisma generate");
