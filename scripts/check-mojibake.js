const fs = require("node:fs");
const path = require("node:path");

const extensions = new Set([".ts", ".tsx", ".css", ".json"]);
const marker = /(?:ط§|ط£|ط¥|ط¨|طھ|ط±|ط©|ظ„|ظ…|ظ†|ظٹ|ظ‡|ط¹|ط³|طµ|ط­|ط¯|ط®|ظƒ|ط¬|ط¶|ط¸|ط·|ظ‚|ظپ|ظˆ|طŒ|طں|Ø|Ù|ï¿½|Ã)/;
const compatibilityAllowlist = new Set([
  "src/lib/cities/cityNormalization.ts",
  "src/lib/application-accounts/accountLinking.ts",
]);

function walk(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file, files);
    else if (extensions.has(path.extname(entry.name))) files.push(file);
  }
  return files;
}

const hits = walk("src").flatMap((file) => {
  const relative = file.replaceAll("\\", "/");
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  const matchedLines = lines.flatMap((line, index) => marker.test(line) ? [index + 1] : []);
  return matchedLines.length ? [{ file: relative, lines: matchedLines.length, firstLines: matchedLines.slice(0, 10), allowedCompatibility: compatibilityAllowlist.has(relative) }] : [];
});
const unexpected = hits.filter((hit) => !hit.allowedCompatibility);
const report = {
  ok: unexpected.length === 0,
  scannedFiles: walk("src").length,
  filesWithMarkers: hits.length,
  unexpectedFiles: unexpected.length,
  unexpectedLines: unexpected.reduce((sum, hit) => sum + hit.lines, 0),
  compatibilityFiles: hits.filter((hit) => hit.allowedCompatibility),
  hits: unexpected,
};
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;
