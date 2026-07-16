const fs = require("fs");
const path = require("path");
const root = process.cwd();
let failed = 0;
function ok(message) { console.log("✅ " + message); }
function bad(message) { failed++; console.log("❌ " + message); }
function exists(file) { fs.existsSync(path.join(root, file)) ? ok("exists " + file) : bad("missing " + file); }

console.log("\nERP bilingual/i18n foundation check\n");
[
  "src/lib/i18n/dictionary.ts",
  "src/components/i18n/useI18n.ts",
  "src/components/i18n/LanguageToggle.tsx",
  "src/components/i18n/I18nRuntime.tsx",
  "scripts/scan-i18n-arabic.cjs",
  "docs/I18N_BILINGUAL_FOUNDATION.md",
].forEach(exists);

const headerPaths = ["src/components/layout/Header.tsx", "src/app/components/layout/Header.tsx", "Header.tsx"];
const header = headerPaths.map((p) => ({ p, abs: path.join(root, p) })).find((x) => fs.existsSync(x.abs));
if (header) {
  const txt = fs.readFileSync(header.abs, "utf8");
  txt.includes("LanguageToggle") ? ok("Header has LanguageToggle") : bad("Header missing LanguageToggle");
  txt.includes("I18nRuntime") ? ok("Header has I18nRuntime") : bad("Header missing I18nRuntime");
} else bad("Header not found");

console.log("\nI18N foundation result: " + (failed ? "FAILED" : "OK") + " | failed=" + failed);
process.exit(failed ? 1 : 0);
