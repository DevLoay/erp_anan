const fs = require("fs");
const path = require("path");

const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");
if (!fs.existsSync(schemaPath)) throw new Error(`schema.prisma not found: ${schemaPath}`);

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

function replaceBlock(block, text) {
  schema = schema.slice(0, block.start) + text + schema.slice(block.end);
}

let changed = false;

const deductionBlock = getModelBlock("Deduction");
if (!deductionBlock) throw new Error("model Deduction not found");
let deduction = deductionBlock.text;

if (!/\n\s*vehicleId\s+String\?/m.test(deduction)) {
  deduction = deduction.replace(/(\n\s*driverId\s+String[^\n]*\n)/, `$1  vehicleId     String?\n`);
  changed = true;
  console.log("Added Deduction.vehicleId");
}

if (!/\n\s*vehicle\s+Vehicle\?/m.test(deduction)) {
  deduction = deduction.replace(/(\n\s*driver\s+Driver\s+@relation[^\n]*\n)/, `$1  vehicle     Vehicle?     @relation(fields: [vehicleId], references: [id])\n`);
  changed = true;
  console.log("Added Deduction.vehicle relation");
}

if (!/@@index\(\[vehicleId\]\)/m.test(deduction)) {
  deduction = deduction.replace(/(\n\s*@@index\(\[driverId\]\)[^\n]*\n)/, `$1  @@index([vehicleId])\n`);
  changed = true;
  console.log("Added Deduction.vehicleId index");
}
replaceBlock(deductionBlock, deduction);

const vehicleBlock = getModelBlock("Vehicle");
if (!vehicleBlock) throw new Error("model Vehicle not found");
let vehicle = vehicleBlock.text;
if (!/\n\s*deductions\s+Deduction\[\]/m.test(vehicle)) {
  if (/\n\s*violations\s+Violation\[\]/m.test(vehicle)) {
    vehicle = vehicle.replace(/(\n\s*violations\s+Violation\[\][^\n]*\n)/, `$1  deductions    Deduction[]\n`);
  } else {
    vehicle = vehicle.replace(/(\n\s*fuelRecords\s+FuelRecord\[\][^\n]*\n)/, `$1  violations    Violation[]\n  deductions    Deduction[]\n`);
  }
  changed = true;
  console.log("Added Vehicle.deductions relation list");
}
replaceBlock(vehicleBlock, vehicle);

fs.writeFileSync(schemaPath, schema, "utf8");
console.log(changed ? "Vehicle deduction schema patched." : "Vehicle deduction schema already OK.");
console.log("Next: npx prisma db push && npx prisma generate");
