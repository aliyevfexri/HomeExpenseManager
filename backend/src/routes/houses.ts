import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../auth";

export const housesRouter = Router();

housesRouter.use(requireAuth);

housesRouter.get("/", async (_req, res) => {
  const houses = await prisma.house.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { payments: true } } },
  });
  res.json({
    houses: houses.map((h) => ({
      id: h.id,
      name: h.name,
      location: h.location,
      createdAt: h.createdAt,
      paymentCount: h._count.payments,
    })),
  });
});

const houseSchema = z.object({
  name: z.string().min(1),
  location: z.string().optional().nullable(),
});

housesRouter.post("/", async (req, res) => {
  const parsed = houseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
  const house = await prisma.house.create({
    data: { name: parsed.data.name, location: parsed.data.location || null },
  });
  res.status(201).json({ house });
});

housesRouter.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const house = await prisma.house.findUnique({ where: { id } });
  if (!house) return res.status(404).json({ error: "House not found" });
  res.json({ house });
});

housesRouter.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = houseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
  const exists = await prisma.house.findUnique({ where: { id } });
  if (!exists) return res.status(404).json({ error: "House not found" });
  const house = await prisma.house.update({
    where: { id },
    data: { name: parsed.data.name, location: parsed.data.location || null },
  });
  res.json({ house });
});

housesRouter.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const exists = await prisma.house.findUnique({ where: { id } });
  if (!exists) return res.status(404).json({ error: "House not found" });
  // Payments (and their periods/attachments) cascade-delete via the schema.
  await prisma.house.delete({ where: { id } });
  res.json({ ok: true });
});
