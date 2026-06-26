import path from "path";

export const config = {
  port: parseInt(process.env.PORT || "8080", 10),
  jwtSecret: process.env.JWT_SECRET || "dev-insecure-secret-change-me",
  isProd: process.env.NODE_ENV === "production",
  adminUsername: process.env.ADMIN_USERNAME || "admin",
  adminPassword: process.env.ADMIN_PASSWORD || "admin",
  defaultCurrency: process.env.DEFAULT_CURRENCY || "USD",
  attachmentsDir: process.env.ATTACHMENTS_DIR || "/data/attachments",
  publicDir: path.join(__dirname, "..", "public"),
  // Max upload size per file (25 MB)
  maxUploadBytes: 25 * 1024 * 1024,
};
