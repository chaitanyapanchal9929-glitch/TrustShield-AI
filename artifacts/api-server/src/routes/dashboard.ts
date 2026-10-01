import { Router, type IRouter } from "express";
import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { GetDashboardStatsResponse } from "@workspace/api-zod";
import { db, redactionsTable, scansTable } from "@workspace/db";
import authRequired from "../middlewares/authenticate";

const router: IRouter = Router();

router.get("/dashboard/stats", authRequired, async (req, res): Promise<void> => {
  const userId = req.authUser!.id;
  const [totals] = await db
    .select({
      totalScans: count(),
      highRiskScans: sql<number>`count(*) filter (where ${scansTable.riskLevel} in ('high', 'critical'))::int`,
      privacyFindings: sql<number>`coalesce(sum(${scansTable.privacyFindingCount}), 0)::int`,
    })
    .from(scansTable)
    .where(eq(scansTable.userId, userId));

  const [redactionTotals] = await db
    .select({ protectedItems: count() })
    .from(redactionsTable)
    .where(eq(redactionsTable.userId, userId));

  const recentRows = await db
    .select()
    .from(scansTable)
    .where(eq(scansTable.userId, userId))
    .orderBy(desc(scansTable.createdAt))
    .limit(5);

  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - 6);
  const dateExpression = sql<string>`to_char(date_trunc('day', ${scansTable.createdAt} at time zone 'UTC'), 'YYYY-MM-DD')`;
  const trendRows = await db
    .select({ date: dateExpression, scans: count() })
    .from(scansTable)
    .where(and(eq(scansTable.userId, userId), gte(scansTable.createdAt, since)))
    .groupBy(dateExpression);
  const dailyCounts = new Map(trendRows.map((row) => [row.date, row.scans]));
  const scanTrend = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(since);
    date.setUTCDate(date.getUTCDate() + offset);
    const key = date.toISOString().slice(0, 10);
    return { date: key, scans: dailyCounts.get(key) ?? 0 };
  });

  res.json(
    GetDashboardStatsResponse.parse({
      totalScans: totals?.totalScans ?? 0,
      highRiskScans: totals?.highRiskScans ?? 0,
      privacyFindings: totals?.privacyFindings ?? 0,
      protectedItems: redactionTotals?.protectedItems ?? 0,
      recentActivity: recentRows.map((row) => ({
        id: row.id,
        inputType: row.inputType,
        riskLevel: row.riskLevel,
        riskScore: row.riskScore,
        privacyFindingCount: row.privacyFindingCount,
        threatIndicatorCount: row.threatIndicatorCount,
        createdAt: row.createdAt.toISOString(),
      })),
      scanTrend,
    }),
  );
});

export default router;