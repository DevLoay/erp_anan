const fs = require('fs');
const path = require('path');

const root = process.cwd();
const modulesPath = path.join(root, 'src/lib/modules.ts');
const permissionsPath = path.join(root, 'src/lib/permissions.ts');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function write(file, content) {
  fs.writeFileSync(file, content, 'utf8');
  console.log(`✅ updated ${path.relative(root, file)}`);
}

function ensureModuleItem(text, href, itemLine, afterHref) {
  if (text.includes(`href: "${href}"`)) return text;
  const anchor = new RegExp(`(\\s*\\{ href: "${afterHref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^\\n]*\\},)`);
  if (anchor.test(text)) {
    return text.replace(anchor, `$1\n      ${itemLine}`);
  }
  const sectionMarker = 'title: "التشغيل والموارد",\n    items: [';
  if (text.includes(sectionMarker)) {
    return text.replace(sectionMarker, `${sectionMarker}\n      ${itemLine}`);
  }
  console.log(`⚠️ Could not insert module item ${href}`);
  return text;
}

function ensurePermissionModule(text, route, line, afterRoute) {
  if (text.includes(`route: "${route}"`)) return text;
  const anchor = new RegExp(`(\\s*\\{ section: [^\\n]*route: "${afterRoute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}" \\},)`);
  if (anchor.test(text)) return text.replace(anchor, `$1\n  ${line}`);
  const marker = 'export const permissionModules = [\n';
  if (text.includes(marker)) return text.replace(marker, `${marker}  ${line}\n`);
  console.log(`⚠️ Could not insert permission module ${route}`);
  return text;
}

function ensureSetValues(text, setName, values) {
  const re = new RegExp(`const ${setName} = new Set\\(\\[([\\s\\S]*?)\\]\\);`);
  const match = text.match(re);
  if (!match) {
    console.log(`⚠️ Set ${setName} not found`);
    return text;
  }
  let body = match[1];
  for (const value of values) {
    if (!body.includes(`"${value}"`)) body += `\n  "${value}",`;
  }
  return text.replace(re, `const ${setName} = new Set([${body}\n]);`);
}

function ensureRouteMap(text, route, resource, beforeRoute = '/violations') {
  if (text.includes(`["${route}", "${resource}"]`)) return text;
  const line = `  ["${route}", "${resource}"],`;
  const before = new RegExp(`(\\s*\\["${beforeRoute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}", [^\\n]*\\],)`);
  if (before.test(text)) return text.replace(before, `${line}\n$1`);
  const close = 'const apiResourceAliases';
  if (text.includes(close)) return text.replace(close, `${line}\n];\n\n${close}`).replace(/\];\n\s*\];\n\nconst apiResourceAliases/, '];\n\nconst apiResourceAliases');
  console.log(`⚠️ Could not insert route map ${route}`);
  return text;
}

function ensureApiAlias(text, alias, resource) {
  if (text.includes(`"${alias}": "${resource}"`)) return text;
  const line = `  "${alias}": "${resource}",`;
  const marker = '  "supervisor-tasks": "tasks",';
  if (text.includes(marker)) return text.replace(marker, `${marker}\n${line}`);
  const re = /const apiResourceAliases: Record<string, string> = \{([\s\S]*?)\n\};/;
  const match = text.match(re);
  if (match) return text.replace(re, `const apiResourceAliases: Record<string, string> = {${match[1]}\n${line}\n};`);
  console.log(`⚠️ Could not insert API alias ${alias}`);
  return text;
}

function ensureReportResources(text) {
  if (text.includes('const reportResources = new Set')) return text;
  const block = `
const reportResources = new Set([
  "dashboard",
  "reports",
  "management-reports",
  "daily-reports",
  "notifications",
  "operations-alerts",
  "uploaded-reports",
  "report-templates",
]);
`;
  if (text.includes('const viewerResources = new Set')) {
    return text.replace('const viewerResources = new Set', `${block}\nconst viewerResources = new Set`);
  }
  if (text.includes('const hrResources = new Set')) {
    return text.replace('const hrResources = new Set', `${block}\nconst hrResources = new Set`);
  }
  return text + block;
}

console.log('\nHR / OPERATIONS NAV + PERMISSIONS FIX');
console.log(`Project root: ${root}`);

if (!fs.existsSync(modulesPath)) throw new Error('Missing src/lib/modules.ts');
if (!fs.existsSync(permissionsPath)) throw new Error('Missing src/lib/permissions.ts');

let modulesText = read(modulesPath);
modulesText = ensureModuleItem(
  modulesText,
  '/shifts',
  '{ href: "/shifts", label: "الشفتات", oldKey: "shifts", status: connected, resource: "shifts", description: "إدارة الشفتات ومواعيد العمل وربطها بالتشغيل." },',
  '/attendance'
);
modulesText = ensureModuleItem(
  modulesText,
  '/interviews',
  '{ href: "/interviews", label: "المقابلات", oldKey: "interviews", status: connected, resource: "interviews", description: "مقابلات المرشحين وحالة التوظيف والمتابعة." },',
  '/supervisors'
);
modulesText = ensureModuleItem(
  modulesText,
  '/rider-documents',
  '{ href: "/rider-documents", label: "مستندات المناديب", oldKey: "driverDocuments", status: connected, resource: "driver-documents", description: "مستندات المناديب والإقامات والرخص وتواريخ الانتهاء." },',
  '/rider-housing'
);
write(modulesPath, modulesText);

let permissionsText = read(permissionsPath);
permissionsText = ensurePermissionModule(permissionsText, '/shifts', '{ section: "التشغيل", resource: "shifts", label: "الشفتات", route: "/shifts" },', '/attendance');
permissionsText = ensurePermissionModule(permissionsText, '/interviews', '{ section: "المناديب والموارد البشرية", resource: "interviews", label: "المقابلات", route: "/interviews" },', '/supervisors');
permissionsText = ensurePermissionModule(permissionsText, '/rider-housing', '{ section: "المناديب والموارد البشرية", resource: "driver-housing", label: "سكن المناديب", route: "/rider-housing" },', '/rider-documents');
permissionsText = ensureReportResources(permissionsText);
permissionsText = ensureSetValues(permissionsText, 'hrResources', ['shifts', 'interviews', 'driver-housing', 'driver-documents']);
permissionsText = ensureSetValues(permissionsText, 'supervisorResources', ['shifts', 'attendance', 'tasks']);
permissionsText = ensureRouteMap(permissionsText, '/shifts', 'shifts', '/violations');
permissionsText = ensureRouteMap(permissionsText, '/interviews', 'interviews', '/violations');
permissionsText = ensureRouteMap(permissionsText, '/rider-housing', 'driver-housing', '/violations');
permissionsText = ensureRouteMap(permissionsText, '/rider-documents', 'driver-documents', '/violations');
permissionsText = ensureApiAlias(permissionsText, 'shifts', 'shifts');
permissionsText = ensureApiAlias(permissionsText, 'interviews', 'interviews');
permissionsText = ensureApiAlias(permissionsText, 'rider-housing', 'driver-housing');
permissionsText = ensureApiAlias(permissionsText, 'rider-documents', 'driver-documents');
write(permissionsPath, permissionsText);

console.log('\n✅ Done. Re-run:');
console.log('node scripts/check-hr-operations-system.cjs');
console.log('node scripts/smoke-hr-auth-routes.cjs');
