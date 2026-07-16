import { randomBytes, scryptSync } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const email = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const password = String(process.env.ADMIN_PASSWORD || "");
const name = process.env.ADMIN_NAME || "System Admin";
const apply = process.argv.includes("--apply");
const confirmed = process.argv.includes("--confirm=ENSURE_ADMIN_USER");
const resetPassword = process.argv.includes("--reset-password");

function hashPassword(value) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(value, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

async function main() {
  if (!apply || !confirmed) {
    console.log(JSON.stringify({
      ok: true,
      mode: "dry-run",
      action: "No database changes",
      command: "node scripts\\ensure-admin-user.mjs --apply --confirm=ENSURE_ADMIN_USER",
    }, null, 2));
    return;
  }
  if (!email || !email.includes("@")) throw new Error("ADMIN_EMAIL is required.");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing && !password) throw new Error("ADMIN_PASSWORD is required when creating a new Admin.");
  if (resetPassword && !password) throw new Error("ADMIN_PASSWORD is required with --reset-password.");

  const user = existing
    ? await prisma.user.update({
      where: { email },
      data: {
        name,
        role: "ADMIN",
        status: "active",
        isActive: true,
        ...(resetPassword ? { passwordHash: hashPassword(password) } : {}),
      },
      select: { id: true, name: true, email: true, role: true, status: true, isActive: true },
    })
    : await prisma.user.create({
      data: {
      name,
      email,
      role: "ADMIN",
      status: "active",
      isActive: true,
      passwordHash: hashPassword(password),
      },
      select: { id: true, name: true, email: true, role: true, status: true, isActive: true },
    });

  console.log("Admin user is ready:");
  console.log(JSON.stringify({ ...user, passwordChanged: Boolean(!existing || resetPassword) }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
