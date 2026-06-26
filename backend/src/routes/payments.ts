import { Router } from "express";
import fs from "fs";
import path from "path";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../auth";
import { upload } from "../upload";
import { config } from "../config";

export const paymentsRouter = Router();

paymentsRouter.use(requireAuth);

const periodSchema = z.object({
  year: z.number().int().min(1970).max(3000),
  month: z.number().int().min(1).max(12),
});

const bodySchema = z.object({
  houseId: z.coerce.number().int(),
  amount: z.coerce.number().nonnegative(),
  paidOn: z.string().min(1), // ISO date
  note: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  status: z.enum(["PAID", "UNPAID"]).optional().default("PAID"),
  periods: z.array(periodSchema).min(1),
});

// periods arrives as a JSON string inside multipart form data.
function parsePayload(raw: any) {
  const periods =
    typeof raw.periods === "string" ? JSON.parse(raw.periods) : raw.periods;
  return bodySchema.safeParse({ ...raw, periods });
}

function serialize(p: any) {
  return {
    id: p.id,
    houseId: p.houseId,
    house: p.house ? { id: p.house.id, name: p.house.name } : undefined,
    amount: Number(p.amount),
    paidOn: p.paidOn,
    note: p.note,
    category: p.category,
    status: p.status,
    createdAt: p.createdAt,
    createdBy: p.createdBy ? { id: p.createdBy.id, name: p.createdBy.name } : null,
    periods: p.periods?.map((pp: any) => ({ year: pp.year, month: pp.month })) ?? [],
    attachments:
      p.attachments?.map((a: any) => ({
        id: a.id,
        filename: a.filename,
        mime: a.mime,
        size: a.size,
      })) ?? [],
  };
}

const includeAll = {
  house: true,
  createdBy: true,
  periods: { orderBy: [{ year: "asc" as const }, { month: "asc" as const }] },
  attachments: true,
};

// List with optional filters: houseId, year, month
paymentsRouter.get("/", async (req, res) => {
  const houseId = req.query.houseId ? Number(req.query.houseId) : undefined;
  const year = req.query.year ? Number(req.query.year) : undefined;
  const month = req.query.month ? Number(req.query.month) : undefined;

  const payments = await prisma.payment.findMany({
    where: {
      houseId,
      periods: year || month ? { some: { year, month } } : undefined,
    },
    include: includeAll,
    orderBy: { paidOn: "desc" },
  });
  res.json({ payments: payments.map(serialize) });
});

paymentsRouter.get("/:id", async (req, res) => {
  const payment = await prisma.payment.findUnique({
    where: { id: Number(req.params.id) },
    include: includeAll,
  });
  if (!payment) return res.status(404).json({ error: "Payment not found" });
  res.json({ payment: serialize(payment) });
});

// Create payment (multipart so files can come along)
paymentsRouter.post("/", upload.array("attachments"), async (req, res) => {
  const parsed = parsePayload(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
  const data = parsed.data;

  const house = await prisma.house.findUnique({ where: { id: data.houseId } });
  if (!house) return res.status(400).json({ error: "House not found" });

  const files = (req.files as Express.Multer.File[]) || [];

  const payment = await prisma.payment.create({
    data: {
      houseId: data.houseId,
      amount: data.amount,
      paidOn: new Date(data.paidOn),
      note: data.note || null,
      category: data.category || null,
      status: data.status,
      createdById: req.user!.id,
      periods: {
        create: data.periods.map((p) => ({ year: p.year, month: p.month })),
      },
      attachments: {
        create: files.map((f) => ({
          filename: f.originalname,
          storedName: f.filename,
          mime: f.mimetype,
          size: f.size,
        })),
      },
    },
    include: includeAll,
  });
  res.status(201).json({ payment: serialize(payment) });
});

// Update payment fields + periods (JSON; attachments handled separately)
paymentsRouter.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
  const data = parsed.data;

  const exists = await prisma.payment.findUnique({ where: { id } });
  if (!exists) return res.status(404).json({ error: "Payment not found" });

  const payment = await prisma.$transaction(async (tx) => {
    await tx.paymentPeriod.deleteMany({ where: { paymentId: id } });
    return tx.payment.update({
      where: { id },
      data: {
        houseId: data.houseId,
        amount: data.amount,
        paidOn: new Date(data.paidOn),
        note: data.note || null,
        category: data.category || null,
        status: data.status,
        periods: { create: data.periods.map((p) => ({ year: p.year, month: p.month })) },
      },
      include: includeAll,
    });
  });
  res.json({ payment: serialize(payment) });
});

paymentsRouter.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const payment = await prisma.payment.findUnique({
    where: { id },
    include: { attachments: true },
  });
  if (!payment) return res.status(404).json({ error: "Payment not found" });

  // Remove files from disk, then the row (periods/attachments cascade).
  for (const a of payment.attachments) {
    const fp = path.join(config.attachmentsDir, a.storedName);
    fs.promises.unlink(fp).catch(() => {});
  }
  await prisma.payment.delete({ where: { id } });
  res.json({ ok: true });
});

// ---- Attachments ----

paymentsRouter.post("/:id/attachments", upload.array("attachments"), async (req, res) => {
  const id = Number(req.params.id);
  const payment = await prisma.payment.findUnique({ where: { id } });
  if (!payment) return res.status(404).json({ error: "Payment not found" });

  const files = (req.files as Express.Multer.File[]) || [];
  await prisma.attachment.createMany({
    data: files.map((f) => ({
      paymentId: id,
      filename: f.originalname,
      storedName: f.filename,
      mime: f.mimetype,
      size: f.size,
    })),
  });
  const updated = await prisma.payment.findUnique({ where: { id }, include: includeAll });
  res.json({ payment: serialize(updated) });
});

paymentsRouter.get("/attachments/:attId/download", async (req, res) => {
  const att = await prisma.attachment.findUnique({ where: { id: Number(req.params.attId) } });
  if (!att) return res.status(404).json({ error: "Not found" });
  const fp = path.join(config.attachmentsDir, att.storedName);
  if (!fs.existsSync(fp)) return res.status(404).json({ error: "File missing" });
  res.setHeader("Content-Type", att.mime);
  res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(att.filename)}"`);
  fs.createReadStream(fp).pipe(res);
});

paymentsRouter.delete("/attachments/:attId", async (req, res) => {
  const att = await prisma.attachment.findUnique({ where: { id: Number(req.params.attId) } });
  if (!att) return res.status(404).json({ error: "Not found" });
  const fp = path.join(config.attachmentsDir, att.storedName);
  fs.promises.unlink(fp).catch(() => {});
  await prisma.attachment.delete({ where: { id: att.id } });
  res.json({ ok: true });
});
