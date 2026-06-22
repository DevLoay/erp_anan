const fs = require('fs');
const path = require('path');

const root = process.cwd();
const modulesPath = path.join(root, 'src', 'lib', 'modules.ts');
const permissionsPath = path.join(root, 'src', 'lib', 'permissions.ts');

function read(file) {
  if (!fs.existsSync(file)) throw new Error(`Missing file: ${file}`);
  return fs.readFileSync(file, 'utf8');
}

function writeIfChanged(file, before, after) {
  if (before !== after) {
    fs.writeFileSync(file, after, 'utf8');
    console.log(`✅ updated ${path.relative(root, file)}`);
  } else {
    console.log(`✅ no change ${path.relative(root, file)}`);
  }
}

function itemLine({ href, label, oldKey, resource, description }) {
  return `      { href: "${href}", label: "${label}", oldKey: "${oldKey}", status: connected, resource: "${resource}", description: "${description}" },`;
}

function ensureHomeItems(src) {
  const items = [
    { href: '/reports', label: 'التقارير العامة', oldKey: 'reports', resource: 'reports', description: 'مركز التقارير العامة والملخصات التنفيذية من البيانات المعتمدة.' },
    { href: '/daily-reports', label: 'التقارير اليومية', oldKey: 'dailyReports', resource: 'daily-reports', description: 'تقارير التشغيل اليومية ومتابعات المدن والمشرفين.' },
    { href: '/operations-alerts', label: 'تنبيهات العمليات', oldKey: 'operationsAlerts', resource: 'operations-alerts', description: 'تنبيهات تشغيلية مجمعة للحالات التي تحتاج متابعة.' },
    { href: '/uploaded-reports', label: 'التقارير المرفوعة', oldKey: 'uploadedReports', resource: 'uploaded-reports', description: 'ملفات وتقارير تم رفعها للنظام للرجوع والمراجعة.' },
    { href: '/report-templates', label: 'قوالب التقارير', oldKey: 'reportTemplates', resource: 'report-templates', description: 'قوالب تقارير جاهزة للاستخدام والتصدير.' },
  ];

  let out = src;
  const missing = items.filter((item) => !out.includes(`href: "${item.href}"`) && !out.includes(`href: '${item.href}'`));
  if (!missing.length) return out;

  const block = missing.map(itemLine).join('\n');

  const notificationsLineRegex = /(\n\s*\{ href: ["']\/notifications["'][^\n]*\},)/;
  if (notificationsLineRegex.test(out)) {
    return out.replace(notificationsLineRegex, `$1\n${block}`);
  }

  const homeSectionEndRegex = /(\n\s*\{\s*\n\s*title: ["']الرئيسية["'],\s*\n\s*items: \[)([\s\S]*?)(\n\s*\],\s*\n\s*\},)/;
  if (homeSectionEndRegex.test(out)) {
    return out.replace(homeSectionEndRegex, (match, start, middle, end) => `${start}${middle}\n${block}${end}`);
  }

  console.warn('⚠️ Could not locate الرئيسية section automatically. Please add routes manually.');
  return out;
}

function permLine({ section, resource, label, route }) {
  return `  { section: "${section}", resource: "${resource}", label: "${label}", route: "${route}" },`;
}

function ensurePermissionModules(src) {
  const permissions = [
    { section: 'الرئيسية والتقارير', resource: 'dashboard', label: 'لوحة الإدارة', route: '/dashboard' },
    { section: 'الرئيسية والتقارير', resource: 'reports', label: 'التقارير العامة', route: '/reports' },
    { section: 'الرئيسية والتقارير', resource: 'management-reports', label: 'التقارير الإدارية', route: '/management-reports' },
    { section: 'الرئيسية والتقارير', resource: 'daily-reports', label: 'التقارير اليومية', route: '/daily-reports' },
    { section: 'الرئيسية والتقارير', resource: 'operations-alerts', label: 'تنبيهات العمليات', route: '/operations-alerts' },
    { section: 'الرئيسية والتقارير', resource: 'uploaded-reports', label: 'التقارير المرفوعة', route: '/uploaded-reports' },
    { section: 'الرئيسية والتقارير', resource: 'notifications', label: 'الإشعارات والتنبيهات', route: '/notifications' },
    { section: 'الرئيسية والتقارير', resource: 'report-templates', label: 'قوالب التقارير', route: '/report-templates' },
  ];

  let out = src;
  const missing = permissions.filter((p) => !out.includes(`route: "${p.route}"`) && !out.includes(`route: '${p.route}'`));
  if (!missing.length) return out;

  const block = missing.map(permLine).join('\n');
  const arrayStartRegex = /(export const permissionModules = \[\s*\n)/;
  if (arrayStartRegex.test(out)) {
    return out.replace(arrayStartRegex, `$1${block}\n`);
  }

  console.warn('⚠️ Could not locate permissionModules automatically. Please add permissions manually.');
  return out;
}

function ensureReportResources(src) {
  if (src.includes('const reportResources = new Set')) return src;

  const insert = `\nconst reportResources = new Set([\n  "dashboard",\n  "reports",\n  "management-reports",\n  "daily-reports",\n  "operations-alerts",\n  "uploaded-reports",\n  "notifications",\n  "report-templates",\n]);\n`;

  let out = src.replace(/(const adminOnlyResources = new Set\([^\n]+\);\s*)/, `$1${insert}\n`);

  out = out.replace('if (role === "OPERATION_MANAGER") return true;', 'if (role === "OPERATION_MANAGER") return true;\n  if (reportResources.has(resource)) return true;');

  return out;
}

try {
  const modulesBefore = read(modulesPath);
  const modulesAfter = ensureHomeItems(modulesBefore);
  writeIfChanged(modulesPath, modulesBefore, modulesAfter);

  const permissionsBefore = read(permissionsPath);
  let permissionsAfter = ensurePermissionModules(permissionsBefore);
  permissionsAfter = ensureReportResources(permissionsAfter);
  writeIfChanged(permissionsPath, permissionsBefore, permissionsAfter);

  console.log('\nHome/dashboard closeout fix completed.');
  console.log('Run: node scripts/check-home-dashboard-system.cjs');
} catch (error) {
  console.error('❌ fix-home-dashboard-closeout failed');
  console.error(error);
  process.exit(1);
}
