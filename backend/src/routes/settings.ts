import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAdmin, requireAuth } from "../auth";

export const settingsRouter = Router();

settingsRouter.use(requireAuth);

// Any logged-in user can read settings (e.g. to know the currency).
settingsRouter.get("/", async (_req, res) => {
  const rows = await prisma.setting.findMany();
  const settings: Record<string, string> = {};
  for (const r of rows) settings[r.key] = r.value;
  res.json({ settings });
});

const updateSchema = z.object({
  currency: z.string().min(1).max(8).optional(),
  appName: z.string().min(1).max(64).optional(),
});

// Only admins can change settings.
settingsRouter.put("/", requireAdmin, async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  for (const [key, value] of Object.entries(parsed.data)) {
    if (value === undefined) continue;
    await prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
  const rows = await prisma.setting.findMany();
  const settings: Record<string, string> = {};
  for (const r of rows) settings[r.key] = r.value;
  res.json({ settings });
});
