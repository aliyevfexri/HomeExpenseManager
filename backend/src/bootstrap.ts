import fs from "fs";
import { prisma } from "./db";
import { config } from "./config";
import { hashPassword } from "./auth";

// Run once on startup: ensure the attachments dir exists, seed the admin
// user and default settings if the database is empty.
export async function bootstrap() {
  fs.mkdirSync(config.attachmentsDir, { recursive: true });

  const userCount = await prisma.user.count();
  if (userCount === 0) {
    await prisma.user.create({
      data: {
        name: "Administrator",
        username: config.adminUsername,
        passwordHash: hashPassword(config.adminPassword),
        isAdmin: true,
      },
    });
    console.log(`[bootstrap] Created admin user "${config.adminUsername}"`);
  }

  const currency = await prisma.setting.findUnique({ where: { key: "currency" } });
  if (!currency) {
    await prisma.setting.create({
      data: { key: "currency", value: config.defaultCurrency },
    });
  }

  const appName = await prisma.setting.findUnique({ where: { key: "appName" } });
  if (!appName) {
    await prisma.setting.create({
      data: { key: "appName", value: "Home Expense Manager" },
    });
  }
}
