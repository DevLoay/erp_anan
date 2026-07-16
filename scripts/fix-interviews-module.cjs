const fs = require("fs");
const path = require("path");

const root = process.cwd();
const modulesPath = path.join(root, "src/lib/modules.ts");
const permissionsPath = path.join(root, "src/lib/permissions.ts");

function read(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}
function write(file, content) {
  fs.writeFileSync(file, content, "utf8");
  console.log(`✅ updated ${path.relative(root, file)}`);
}

console.log("\nINTERVIEWS MODULE FIX");
console.log(`Project root: ${root}`);

let modules = read(modulesPath);
if (modules) {
  if (!modules.includes('href: "/interviews"')) {
    const marker = '{ href: "/supervisors", label: "المشرفين"';
    const idx = modules.indexOf(marker);
    if (idx >= 0) {
      const lineEnd = modules.indexOf("\n", idx);
      const insert = '      { href: "/interviews", label: "المقابلات", oldKey: "interviews", status: connected, resource: "interviews", description: "مقابلات المرشحين وجدولتها وتحويل المقبولين إلى مناديب." },\n';
      modules = modules.slice(0, lineEnd + 1) + insert + modules.slice(lineEnd + 1);
      write(modulesPath, modules);
    } else {
      console.log("⚠️ Could not find supervisors insertion point in modules.ts");
    }
  } else {
    console.log("✅ /interviews already exists in modules.ts");
  }
}

let permissions = read(permissionsPath);
if (permissions) {
  if (!permissions.includes('resource: "interviews"')) {
    const marker = '{ section: "المناديب والموارد البشرية", resource: "supervisors"';
    const idx = permissions.indexOf(marker);
    if (idx >= 0) {
      const lineEnd = permissions.indexOf("\n", idx);
      const insert = '  { section: "المناديب والموارد البشرية", resource: "interviews", label: "المقابلات", route: "/interviews" },\n';
      permissions = permissions.slice(0, lineEnd + 1) + insert + permissions.slice(lineEnd + 1);
    }
  }

  if (!permissions.includes('["/interviews", "interviews"]')) {
    const marker = '["/drivers", "drivers"],';
    if (permissions.includes(marker)) {
      permissions = permissions.replace(marker, '["/interviews", "interviews"],\n  ' + marker);
    } else {
      console.log("⚠️ Could not find routeResourceMap insertion point for /interviews");
    }
  }

  if (!permissions.includes('"interviews"')) {
    const marker = '"supervisors",';
    if (permissions.includes(marker)) permissions = permissions.replace(marker, marker + '\n  "interviews",');
  }
  write(permissionsPath, permissions);
}

console.log("\n✅ Done. Re-run:");
console.log("node scripts/check-interviews-module.cjs");
