import { Router } from "express";
import { prisma } from "../db";
import { requireAuth } from "../auth";

export const statsRouter = Router();

statsRouter.use(requireAuth);

// We allocate each payment evenly across the months it covers, so a single
// check that spans Jan+Feb+Mar contributes 1/3 of its amount to each month.
// This keeps monthly and yearly totals consistent with the total paid.

statsRouter.get("/years", async (_req, res) => {
  const rows = await prisma.paymentPeriod.findMany({
    distinct: ["year"],
    select: { year: true },
    orderBy: { year: "desc" },
  });
  res.json({ years: rows.map((r) => r.year) });
});

statsRouter.get("/summary", async (req, res) => {
  const year = req.query.year ? Number(req.query.year) : undefined;
  const houseId = req.query.houseId ? Number(req.query.houseId) : undefined;

  const payments = await prisma.payment.findMany({
    where: { houseId },
    include: { periods: true, house: true },
  });

  const byMonth = new Array(12).fill(0); // index 0 = January
  const byHouse = new Map<number, { id: number; name: string; total: number }>();
  const byYear = new Map<number, number>();
  let yearTotal = 0;
  let grandTotal = 0;

  for (const p of payments) {
    const amount = Number(p.amount);
    const count = p.periods.length || 1;
    const per = amount / count;

    for (const period of p.periods) {
      byYear.set(period.year, (byYear.get(period.year) || 0) + per);
      grandTotal += per;

      if (year && period.year === year) {
        byMonth[period.month - 1] += per;
        yearTotal += per;
        const h = byHouse.get(p.houseId) || { id: p.houseId, name: p.house.name, total: 0 };
        h.total += per;
        byHouse.set(p.houseId, h);
      } else if (!year) {
        const h = byHouse.get(p.houseId) || { id: p.houseId, name: p.house.name, total: 0 };
        h.total += per;
        byHouse.set(p.houseId, h);
      }
    }
  }

  res.json({
    year: year ?? null,
    yearTotal: year ? round(yearTotal) : round(grandTotal),
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

function round(n: number) {
  return Math.round(n * 100) / 100;
}
