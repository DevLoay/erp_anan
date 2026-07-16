const fs = require("fs");
const path = require("path");

const root = process.cwd();
const required = [
  "src/lib/i18n/dictionary.ts",
  "src/components/i18n/useI18n.ts",
  "src/components/i18n/LanguageToggle.tsx",
  "src/components/i18n/I18nRuntime.tsx",
];
const keys = [
  "إدارة المناديب",
  "مستندات المناديب",
  "المدينة / المشروع",
  "تصدير إكسل",
  "المقابلات",
  "السيارات والحركة",
  "الماليات والمسير",
  "الإعدادات والصلاحيات",
  "بحث بالاسم / الكود / الجوال / الهوية / حساب التطبيق",
];
let failed = 0;
console.log("i18n phase 2 check");
for (const rel of required) {
  const exists = fs.existsSync(path.join(root, rel));
  console.log(`${exists ? "✅" : "❌"} ${rel}`);
  if (!exists) failed++;
}
const dictionaryPath = path.join(root, "src/lib/i18n/dictionary.ts");
const runtimePath = path.join(root, "src/components/i18n/I18nRuntime.tsx");
const dict = fs.existsSync(dictionaryPath) ? fs.readFileSync(dictionaryPath, "utf8") : "";
const runtime = fs.existsSync(runtimePath) ? fs.readFileSync(runtimePath, "utf8") : "";
for (const key of keys) {
  const ok = dict.includes(`"${key}"`);
  console.log(`${ok ? "✅" : "❌"} dictionary key: ${key}`);
  if (!ok) failed++;
}
for (const token of ["patchNativeMessages", "MutationObserver", "placeholder", "aria-label", "translateText"]) {
  const ok = runtime.includes(token);
  console.log(`${ok ? "✅" : "❌"} runtime: ${token}`);
  if (!ok) failed++;
}
console.log(`i18n phase 2 result: ${failed ? "FAILED" : "OK"} | failed=${failed}`);
process.exitCode = failed ? 1 : 0;
