import { Router } from "express";
import { prisma } from "../db";
import { requireAuth } from "../auth";

export const statsRouter = Router();

statsRouter.use(requireAuth);

// Each PaymentEntry belongs to one period (its periodDate). We aggregate the
// recorded amount by the period's year/month. Entries with no amount count as 0.

function amountOf(e: { amount: any }) {
  return e.amount != null ? Number(e.amount) : 0;
}

statsRouter.get("/years", async (_req, res) => {
  const entries = await prisma.paymentEntry.findMany({ select: { periodDate: true } });
  const years = [...new Set(entries.map((e) => e.periodDate.getUTCFullYear()))].sort(
    (a, b) => b - a
  );
  res.json({ years });
});

statsRouter.get("/summary", async (req, res) => {
  const year = req.query.year ? Number(req.query.year) : undefined;
  const houseId = req.query.houseId ? Number(req.query.houseId) : undefined;

  const entries = await prisma.paymentEntry.findMany({
    where: { paymentType: houseId ? { houseId } : undefined },
    include: { paymentType: { include: { house: true } } },
  });

  const byMonth = new Array(12).fill(0);
  const byHouse = new Map<number, { id: number; name: string; total: number }>();
  const byYear = new Map<number, number>();
  let yearTotal = 0;
  let grandTotal = 0;

  for (const e of entries) {
    const amt = amountOf(e);
    const y = e.periodDate.getUTCFullYear();
    const m = e.periodDate.getUTCMonth(); // 0-11
    const house = e.paymentType.house;

    byYear.set(y, (byYear.get(y) || 0) + amt);
    grandTotal += amt;

    const inScope = !year || y === year;
    if (inScope) {
      if (year) {
        byMonth[m] += amt;
        yearTotal += amt;
      }
      const h = byHouse.get(house.id) || { id: house.id, name: house.name, total: 0 };
      h.total += amt;
      byHouse.set(house.id, h);
    }
  }

  res.json({
    year: year ?? null,
    yearTotal: round(year ? yearTotal : grandTotal),
    grandTotal: round(grandTotal),
    byMonth: byMonth.map((v, i) => ({ month: i + 1, total: round(v) })),
    byHouse: [...byHouse.values()]
      .map((h) => ({ ...h, total: round(h.total) }))
      .sort((a, b) => b.total - a.total),
    byYear: [...byYear.entries()]
      .map(([y, total]) => ({ year: y, total: round(total) }))
      .sort((a, b) => a.year - b.year),
  });
});

// Most recent entries for the dashboard.
statsRouter.get("/recent", async (_req, res) => {
  const entries = await prisma.paymentEntry.findMany({
    include: { paymentType: { include: { house: true } } },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
  res.json({
    recent: entries.map((e) => ({
      id: e.id,
      typeName: e.paymentType.name,
      houseId: e.paymentType.houseId,
      houseName: e.paymentType.house.name,
      periodDate: e.periodDate,
      status: e.status,
      amount: e.amount != null ? Number(e.amount) : null,
    })),
  });
});

function round(n: number) {
  return Math.round(n * 100) / 100;
}
