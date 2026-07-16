const fs = require("fs");
const path = require("path");

const root = process.cwd();
const ignore = new Set([".next", "node_modules", ".git", "dist", "build"]);
const exts = new Set([".ts", ".tsx", ".js", ".jsx", ".json"]);
const arabic = /[\u0600-\u06FF]/;
let rows = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignore.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (exts.has(path.extname(entry.name))) {
      const rel = path.relative(root, full).replace(/\\/g, "/");
      const lines = fs.readFileSync(full, "utf8").split(/\r?\n/);
      lines.forEach((line, index) => {
        if (arabic.test(line)) rows.push(`${rel}:${index + 1}  ${line.trim()}`);
      });
    }
  }
}
walk(path.join(root, "src"));
console.log(`Arabic hardcoded scan: ${rows.length} lines`);
for (const row of rows.slice(0, 2500)) console.log(row);
if (rows.length > 2500) console.log(`... truncated ${rows.length - 2500} more lines`);
