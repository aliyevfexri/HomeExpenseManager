import { Router } from "express";
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import archiver from "archiver";
import unzipper from "unzipper";
import multer from "multer";
import { prisma } from "../db";
import { requireAdmin, requireAuth } from "../auth";
import { config } from "../config";

export const backupRouter = Router();

backupRouter.use(requireAuth, requireAdmin);

const EXPORT_VERSION = 1;

// ---- Export: stream a .zip containing data.json + every attachment file ----
backupRouter.get("/export", async (_req, res) => {
  const [users, houses, payments, periods, attachments, settings] = await Promise.all([
    prisma.user.findMany(),
    prisma.house.findMany(),
    prisma.payment.findMany(),
    prisma.paymentPeriod.findMany(),
    prisma.attachment.findMany(),
    prisma.setting.findMany(),
  ]);

  const data = {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    users: users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() })),
    houses: houses.map((h) => ({ ...h, createdAt: h.createdAt.toISOString() })),
    payments: payments.map((p) => ({
      ...p,
      amount: Number(p.amount),
      paidOn: p.paidOn.toISOString(),
      createdAt: p.createdAt.toISOString(),
    })),
    periods,
    attachments: attachments.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
    settings,
  };

  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="hem-backup-${stamp}.zip"`);

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("error", (err) => {
    console.error("[backup] export error", err);
    res.status(500).end();
  });
  archive.pipe(res);

  archive.append(JSON.stringify(data, null, 2), { name: "data.json" });

  for (const a of attachments) {
    const fp = path.join(config.attachmentsDir, a.storedName);
    if (fs.existsSync(fp)) archive.file(fp, { name: `files/${a.storedName}` });
  }

  await archive.finalize();
});

// ---- Import: replace everything from a previously exported .zip ----
const tmpDir = path.join(os.tmpdir(), "hem-import");
fs.mkdirSync(tmpDir, { recursive: true });
const uploadZip = multer({ dest: tmpDir, limits: { fileSize: 500 * 1024 * 1024 } });

backupRouter.post("/import", uploadZip.single("backup"), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: "No backup file uploaded" });

  const workDir = path.join(tmpDir, crypto.randomBytes(8).toString("hex"));
  try {
    fs.mkdirSync(workDir, { recursive: true });
    await fs
      .createReadStream(file.path)
      .pipe(unzipper.Extract({ path: workDir }))
      .promise();

    const dataPath = path.join(workDir, "data.json");
    if (!fs.existsSync(dataPath)) {
      return res.status(400).json({ error: "Invalid backup: data.json missing" });
    }
    const data = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
    if (typeof data.version !== "number") {
      return res.status(400).json({ error: "Invalid backup format" });
    }

    await prisma.$transaction(async (tx) => {
      // Wipe (order matters for FKs, though cascades cover most).
      await tx.attachment.deleteMany();
      await tx.paymentPeriod.deleteMany();
      await tx.payment.deleteMany();
      await tx.house.deleteMany();
      await tx.user.deleteMany();
      await tx.setting.deleteMany();

      for (const u of data.users ?? [])
        await tx.user.create({
          data: {
            id: u.id,
            name: u.name,
            username: u.username,
            passwordHash: u.passwordHash,
            isAdmin: u.isAdmin,
            createdAt: new Date(u.createdAt),
          },
        });

      for (const h of data.houses ?? [])
        await tx.house.create({
          data: {
            id: h.id,
            name: h.name,
            location: h.location,
            createdAt: new Date(h.createdAt),
          },
        });

      for (const p of data.payments ?? [])
        await tx.payment.create({
          data: {
            id: p.id,
            houseId: p.houseId,
            amount: p.amount,
            paidOn: new Date(p.paidOn),
            note: p.note,
            category: p.category,
            status: p.status,
            createdById: p.createdById,
            createdAt: new Date(p.createdAt),
          },
        });

      for (const pp of data.periods ?? [])
        await tx.paymentPeriod.create({
          data: { id: pp.id, paymentId: pp.paymentId, year: pp.year, month: pp.month },
        });

      for (const a of data.attachments ?? [])
        await tx.attachment.create({
          data: {
            id: a.id,
            paymentId: a.paymentId,
            filename: a.filename,
            storedName: a.storedName,
            mime: a.mime,
            size: a.size,
            createdAt: new Date(a.createdAt),
          },
        });

      for (const s of data.settings ?? [])
        await tx.setting.create({ data: { key: s.key, value: s.value } });

      // Reset autoincrement sequences so future inserts don't collide.
      for (const table of ["User", "House", "Payment", "PaymentPeriod", "Attachment"]) {
        await tx.$executeRawUnsafe(
          `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 1))`
        );
      }
    });

    // Restore attachment files.
    const filesDir = path.join(workDir, "files");
    if (fs.existsSync(filesDir)) {
      for (const f of fs.readdirSync(filesDir)) {
        fs.copyFileSync(path.join(filesDir, f), path.join(config.attachmentsDir, f));
      }
    }

    res.json({ ok: true, message: "Backup restored. You may need to log in again." });
  } catch (err) {
    console.error("[backup] import error", err);
    res.status(500).json({ error: "Import failed. The backup file may be corrupt." });
  } finally {
    fs.rm(file.path, { force: true }, () => {});
    fs.rm(workDir, { recursive: true, force: true }, () => {});
  }
});
