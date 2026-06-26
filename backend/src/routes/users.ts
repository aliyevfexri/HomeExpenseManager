import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { hashPassword, requireAdmin, requireAuth } from "../auth";

export const usersRouter = Router();

usersRouter.use(requireAuth, requireAdmin);

usersRouter.get("/", async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, username: true, isAdmin: true, createdAt: true },
  });
  res.json({ users });
});

const createSchema = z.object({
  name: z.string().min(1),
  username: z.string().min(1),
  password: z.string().min(4),
  isAdmin: z.boolean().optional().default(false),
});

usersRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const exists = await prisma.user.findUnique({ where: { username: parsed.data.username } });
  if (exists) return res.status(409).json({ error: "Username already taken" });

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      username: parsed.data.username,
      passwordHash: hashPassword(parsed.data.password),
      isAdmin: parsed.data.isAdmin,
    },
    select: { id: true, name: true, username: true, isAdmin: true, createdAt: true },
  });
  res.status(201).json({ user });
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  username: z.string().min(1).optional(),
  isAdmin: z.boolean().optional(),
});

usersRouter.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return res.status(404).json({ error: "User not found" });

  // Don't allow removing admin from the last remaining admin.
  if (parsed.data.isAdmin === false && target.isAdmin) {
    const admins = await prisma.user.count({ where: { isAdmin: true } });
    if (admins <= 1) return res.status(400).json({ error: "There must be at least one admin" });
  }

  if (parsed.data.username && parsed.data.username !== target.username) {
    const clash = await prisma.user.findUnique({ where: { username: parsed.data.username } });
    if (clash) return res.status(409).json({ error: "Username already taken" });
  }

  const user = await prisma.user.update({
    where: { id },
    data: parsed.data,
    select: { id: true, name: true, username: true, isAdmin: true, createdAt: true },
  });
  res.json({ user });
});

const resetSchema = z.object({ newPassword: z.string().min(4) });

usersRouter.post("/:id/reset-password", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return res.status(404).json({ error: "User not found" });

  await prisma.user.update({
    where: { id },
    data: { passwordHash: hashPassword(parsed.data.newPassword) },
  });
  res.json({ ok: true });
});

usersRouter.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user!.id) return res.status(400).json({ error: "You cannot delete yourself" });

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return res.status(404).json({ error: "User not found" });

  if (target.isAdmin) {
    const admins = await prisma.user.count({ where: { isAdmin: true } });
    if (admins <= 1) return res.status(400).json({ error: "There must be at least one admin" });
  }

  await prisma.user.delete({ where: { id } });
  res.json({ ok: true });
});
