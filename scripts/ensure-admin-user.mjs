import { randomBytes, scryptSync } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const email = process.env.ADMIN_EMAIL || "admin@logistics-erp.com";
const password = process.env.ADMIN_PASSWORD || "Admin@123456";
const name = process.env.ADMIN_NAME || "System Admin";

function hashPassword(value) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(value, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

async function main() {
  const user = await prisma.user.upsert({
    where: { email },
    create: {
      name,
      email,
      role: "ADMIN",
      status: "active",
      isActive: true,
      passwordHash: hashPassword(password),
    },
    update: {
      name,
      role: "ADMIN",
      status: "active",
      isActive: true,
      passwordHash: hashPassword(password),
    },
    select: { id: true, name: true, email: true, role: true, status: true, isActive: true },
  });

  console.log("Admin user is ready:");
  console.log(JSON.stringify({ ...user, password }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
