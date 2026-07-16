const fs = require("fs");
const path = require("path");

const root = process.cwd();

function read(file) {
  const abs = path.join(root, file);
  return fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : "";
}

function save(file, content) {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), content, "utf8");
  console.log("✅ updated " + file);
}

function ensureCopied(file) {
  const source = path.join(__dirname, "..", file);
  const dest = path.join(root, file);
  if (!fs.existsSync(source)) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(source, dest);
  console.log("✅ installed " + file);
}

function findFirst(files) {
  return files.find((file) => fs.existsSync(path.join(root, file)));
}

function patchHeader() {
  const file = findFirst([
    "src/components/layout/Header.tsx",
    "src/app/components/layout/Header.tsx",
    "Header.tsx",
  ]);

  if (!file) {
    console.log("⚠️ Header.tsx not found. Language files installed but header toggle was not injected.");
    return;
  }

  let text = read(file);

  if (!text.includes("@/components/i18n/LanguageToggle")) {
    const importLine = 'import { LanguageToggle } from "@/components/i18n/LanguageToggle";\nimport { I18nRuntime } from "@/components/i18n/I18nRuntime";\n';
    const firstImport = text.match(/^import .*?;\r?\n/m);
    if (firstImport) text = text.replace(firstImport[0], firstImport[0] + importLine);
    else text = importLine + text;
  }

  // Remove the old no-op Arabic button helper if it exists.
  text = text.replace(/\n\s*function keepArabic\(\)\s*\{[\s\S]*?\n\s*\}\s*\n/g, "\n");
  text = text.replace(/\n\s*const keepArabic\s*=\s*\([^)]*\)\s*=>\s*\{[\s\S]*?\n\s*\};\s*\n/g, "\n");

  // Replace the old Arabic button with the real toggle.
  const before = text;
  text = text.replace(/<button\s+type="button"\s+onClick=\{keepArabic\}[\s\S]*?<\/button>/m, "<LanguageToggle />");

  if (text === before && !text.includes("<LanguageToggle />")) {
    // Fallback: insert the toggle before a theme/calm button if present, otherwise after the first flex actions div.
    text = text.replace(/(<button\s+type="button"[\s\S]*?>\s*هادئ\s*<\/button>)/m, "<LanguageToggle />\n            $1");
    if (!text.includes("<LanguageToggle />")) {
      text = text.replace(/(<div[^>]*className="[^"]*flex[^"]*"[^>]*>)/m, "$1\n            <LanguageToggle />");
    }
  }

  if (!text.includes("<I18nRuntime />")) {
    text = text.replace(/(<header[^>]*>)/m, "$1\n      <I18nRuntime />");
  }

  save(file, text);
}

[
  "src/lib/i18n/dictionary.ts",
  "src/components/i18n/useI18n.ts",
  "src/components/i18n/LanguageToggle.tsx",
  "src/components/i18n/I18nRuntime.tsx",
  "scripts/check-i18n-foundation.cjs",
  "scripts/scan-i18n-arabic.cjs",
  "docs/I18N_BILINGUAL_FOUNDATION.md",
].forEach(ensureCopied);

patchHeader();

console.log("\n✅ Bilingual foundation installed. Run:");
console.log("node scripts/check-i18n-foundation.cjs");
console.log("node scripts/scan-i18n-arabic.cjs");
