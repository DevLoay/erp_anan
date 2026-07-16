const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

function parseEnv(file) {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(
    fs.readFileSync(file, "utf8").split(/\r?\n/).map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "")];
      }),
  );
}

function tracked(file) {
  try {
    execFileSync("git", ["ls-files", "--error-unmatch", file], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const fileEnv = parseEnv(".env");
const env = { ...fileEnv, ...process.env };
const authSecret = env.AUTH_SECRET || env.NEXTAUTH_SECRET || "";
const checks = {
  DATABASE_URL: Boolean(env.DATABASE_URL),
  AUTH_SECRET: authSecret.length >= 32,
  NEXT_PUBLIC_APP_NAME: Boolean(env.NEXT_PUBLIC_APP_NAME),
  productionExampleExists: fs.existsSync(".env.production.example"),
  envIgnoredByGit: !tracked(".env"),
};
const warnings = [];
if (env.DATABASE_URL && /mshawki:mshawki|password|changeme/i.test(env.DATABASE_URL)) {
  warnings.push("DATABASE_URL appears to use a development/default credential.");
}
if (authSecret && authSecret.length < 32) warnings.push("AUTH_SECRET must be at least 32 characters.");
if (!env.NEXT_PUBLIC_APP_NAME) warnings.push("NEXT_PUBLIC_APP_NAME is optional but recommended.");
const report = {
  ok: checks.DATABASE_URL && checks.AUTH_SECRET && checks.productionExampleExists && checks.envIgnoredByGit,
  checks,
  warnings,
  requiredVariables: ["DATABASE_URL", "AUTH_SECRET"],
  optionalVariables: ["NEXT_PUBLIC_APP_NAME", "APP_URL", "UPLOAD_DIR"],
};
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;
