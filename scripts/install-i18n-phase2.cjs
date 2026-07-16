const fs = require("fs");
const path = require("path");

const root = process.cwd();
const cssPath = path.join(root, "src", "app", "globals.css");
const snippet = `

/* i18n phase 2 direction helpers */
html[dir="ltr"] body {
  direction: ltr;
}
html[dir="ltr"] .text-right {
  text-align: left !important;
}
html[dir="ltr"] .text-left {
  text-align: right !important;
}
html[dir="ltr"] [class*="pr-"] {
  /* keep spacing stable; Tailwind logical migration can be done module-by-module later */
}
`;

if (fs.existsSync(cssPath)) {
  const css = fs.readFileSync(cssPath, "utf8");
  if (!css.includes("i18n phase 2 direction helpers")) {
    fs.appendFileSync(cssPath, snippet, "utf8");
    console.log("✅ appended i18n direction helpers to src/app/globals.css");
  } else {
    console.log("✅ i18n direction helpers already exist");
  }
} else {
  console.log("⚠️ src/app/globals.css not found; skipped CSS helpers");
}

console.log("✅ i18n phase 2 files are installed");
