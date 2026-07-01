import { Router } from "express";
import fs from "fs";
import path from "path";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../auth";
import { upload } from "../upload";
import { config } from "../config";
import { serializeEntry } from "./paymentTypes";

export const entriesRouter = Router();

entriesRouter.use(requireAuth);

const includeAtt = { attachments: true };

const upsertSchema = z.object({
  paymentTypeId: z.coerce.number().int(),
  periodKey: z.string().min(1),
  periodDate: z.string().min(1), // ISO date of the period start
  status: z.enum(["PAID", "PARTIAL"]).optional().default("PAID"),
  // amount may be omitted -> falls back to the type's default on create
  amount: z.coerce.number().nonnegative().nullable().optional(),
  note: z.string().nullable().optional(),
  paidOn: z.string().nullable().optional(),
});

function parseBody(raw: any) {
  // When sent as multipart, everything arrives as strings.
  return upsertSchema.safeParse(raw);
}

// Create or update the entry for a (type, period). This is the "tick paid".
entriesRouter.post("/", upload.array("attachments"), async (req, res) => {
  const parsed = parseBody(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
  const d = parsed.data;

  const type = await prisma.paymentType.findUnique({ where: { id: d.paymentTypeId } });
  if (!type) return res.status(400).json({ error: "Payment type not found" });

  const files = (req.files as Express.Multer.File[]) || [];
  const existing = await prisma.paymentEntry.findUnique({
    where: { paymentTypeId_periodKey: { paymentTypeId: d.paymentTypeId, periodKey: d.periodKey } },
  });

  // On create, if no amount given, use the type's default amount.
  const amount =
    d.amount !== undefined && d.amount !== null
      ? d.amount
      : existing
      ? undefined // keep existing amount
      : type.defaultAmount != null
      ? Number(type.defaultAmount)
      : null;

  let entry;
  if (existing) {
    entry = await prisma.paymentEntry.update({
      where: { id: existing.id },
      data: {
        status: d.status,
        amount: amount === undefined ? undefined : amount,
        note: d.note ?? undefined,
        paidOn: d.paidOn ? new Date(d.paidOn) : undefined,
        attachments: {
          create: files.map((f) => ({
            filename: f.originalname,
            storedName: f.filename,
            mime: f.mimetype,
            size: f.size,
          })),
        },
      },
      include: includeAtt,
    });
  } else {
    entry = await prisma.paymentEntry.create({
      data: {
        paymentTypeId: d.paymentTypeId,
        periodKey: d.periodKey,
        periodDate: new Date(d.periodDate),
        status: d.status,
        amount: amount ?? null,
        note: d.note ?? null,
        paidOn: d.paidOn ? new Date(d.paidOn) : new Date(),
        createdById: req.user!.id,
        attachments: {
          create: files.map((f) => ({
            filename: f.originalname,
            storedName: f.filename,
            mime: f.mimetype,
            size: f.size,
          })),
        },
      },
      include: includeAtt,
    });
  }
  res.status(201).json({ entry: serializeEntry(entry) });
});

const patchSchema = z.object({
  status: z.enum(["PAID", "PARTIAL"]).optional(),
  amount: z.coerce.number().nonnegative().nullable().optional(),
  note: z.string().nullable().optional(),
  paidOn: z.string().nullable().optional(),
});

entriesRouter.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
  const exists = await prisma.paymentEntry.findUnique({ where: { id } });
  if (!exists) return res.status(404).json({ error: "Entry not found" });

  const entry = await prisma.paymentEntry.update({
    where: { id },
    data: {
      status: parsed.data.status,
      amount: parsed.data.amount === undefined ? undefined : parsed.data.amount,
      note: parsed.data.note === undefined ? undefined : parsed.data.note,
      paidOn:
        parsed.data.paidOn === undefined
          ? undefined
          : parsed.data.paidOn
          ? new Date(parsed.data.paidOn)
          : null,
    },
    include: includeAtt,
  });
  res.json({ entry: serializeEntry(entry) });
});

// Untick / remove the entry for a period.
entriesRouter.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const entry = await prisma.paymentEntry.findUnique({
    where: { id },
    include: { attachments: true },
  });
  if (!entry) return res.status(404).json({ error: "Entry not found" });
  for (const a of entry.attachments) {
    fs.promises.unlink(path.join(config.attachmentsDir, a.storedName)).catch(() => {});
  }
  await prisma.paymentEntry.delete({ where: { id } });
  res.json({ ok: true });
});

// ---- Attachments ----
entriesRouter.post("/:id/attachments", upload.array("attachments"), async (req, res) => {
  const id = Number(req.params.id);
  const entry = await prisma.paymentEntry.findUnique({ where: { id } });
  if (!entry) return res.status(404).json({ error: "Entry not found" });
  const files = (req.files as Express.Multer.File[]) || [];
  await prisma.attachment.createMany({
    data: files.map((f) => ({
      entryId: id,
      filename: f.originalname,
      storedName: f.filename,
      mime: f.mimetype,
      size: f.size,
    })),
  });
  const updated = await prisma.paymentEntry.findUnique({ where: { id }, include: includeAtt });
  res.json({ entry: serializeEntry(updated) });
});

entriesRouter.get("/attachments/:attId/download", async (req, res) => {
  const att = await prisma.attachment.findUnique({ where: { id: Number(req.params.attId) } });
  if (!att) return res.status(404).json({ error: "Not found" });
  const fp = path.join(config.attachmentsDir, att.storedName);
  if (!fs.existsSync(fp)) return res.status(404).json({ error: "File missing" });
  res.setHeader("Content-Type", att.mime);
  res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(att.filename)}"`);
  fs.createReadStream(fp).pipe(res);
});

entriesRouter.delete("/attachments/:attId", async (req, res) => {
  const att = await prisma.attachment.findUnique({ where: { id: Number(req.params.attId) } });
  if (!att) return res.status(404).json({ error: "Not found" });
  fs.promises.unlink(path.join(config.attachmentsDir, att.storedName)).catch(() => {});
  await prisma.attachment.delete({ where: { id: att.id } });
  res.json({ ok: true });
});
