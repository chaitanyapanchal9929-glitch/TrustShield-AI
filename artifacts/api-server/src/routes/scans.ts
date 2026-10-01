import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  AnalyzeContentBody,
  AnalyzeContentResponse,
  DeleteScanParams,
  GetScanHistoryResponse,
  RedactContentBody,
  RedactContentResponse,
} from "@workspace/api-zod";
import { db, redactionsTable, scansTable } from "@workspace/db";
import authRequired from "../middlewares/authenticate";
import { rateLimit } from "../middlewares/rate-limit";
import { analyzeWithGemini, GeminiAnalysisError } from "../lib/gemini-scanner";
import { analyzeContent, redactContent } from "../lib/scanner";

const router: IRouter = Router();
const scanLimit = rateLimit("scan", 20, 5 * 60 * 1000);
const redactLimit = rateLimit("redact", 30, 5 * 60 * 1000);

router.post("/scans/analyze", authRequired, scanLimit, async (req, res): Promise<void> => {
  const parsed = AnalyzeContentBody.safeParse(req.body);
  if (!parsed.success || parsed.data.content.trim().length === 0) {
    res.status(400).json({ error: "Add the message text you want to check." });
    return;
  }

  const { content, contextualUrl, inputType } = parsed.data;
  let analysis: ReturnType<typeof AnalyzeContentResponse.parse>;
  let analysisSource: "gemini" | "rules" = "gemini";
  try {
    const geminiAnalysis = await analyzeWithGemini({ content, inputType, contextualUrl });
    analysis = AnalyzeContentResponse.parse({
      ...geminiAnalysis,
      analysisSource,
    });
  } catch (error) {
    analysisSource = "rules";
    const fallbackReason =
      error instanceof GeminiAnalysisError ? error.reason : "request_failed";
    req.log.warn(
      { analysisSource, fallbackReason },
      "Gemini analysis unavailable; using rule-based fallback",
    );
    const analysisText = contextualUrl ? `${content}\n${contextualUrl}` : content;
    analysis = AnalyzeContentResponse.parse({
      ...analyzeContent(analysisText, contextualUrl),
      analysisSource,
    });
  }

  await db.insert(scansTable).values({
    userId: req.authUser!.id,
    inputType,
    riskLevel: analysis.riskLevel,
    riskScore: analysis.riskScore,
    privacyFindingCount: analysis.privacyFindings.length,
    threatIndicatorCount: analysis.threatIndicators.length,
  });

  res.json(analysis);
});

router.post("/scans/redact", authRequired, redactLimit, async (req, res): Promise<void> => {
  const parsed = RedactContentBody.safeParse(req.body);
  if (!parsed.success || parsed.data.content.trim().length === 0) {
    res.status(400).json({ error: "Add the text you want to protect." });
    return;
  }

  const result = RedactContentResponse.parse(redactContent(parsed.data.content));
  if (result.findingCount > 0) {
    await db.insert(redactionsTable).values({
      userId: req.authUser!.id,
      findingCount: result.findingCount,
    });
  }
  res.json(result);
});

router.get("/scans/history", authRequired, async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(scansTable)
    .where(eq(scansTable.userId, req.authUser!.id))
    .orderBy(desc(scansTable.createdAt))
    .limit(100);

  res.json(
    GetScanHistoryResponse.parse(
      rows.map((row) => ({
        id: row.id,
        inputType: row.inputType,
        riskLevel: row.riskLevel,
        riskScore: row.riskScore,
        privacyFindingCount: row.privacyFindingCount,
        threatIndicatorCount: row.threatIndicatorCount,
        createdAt: row.createdAt.toISOString(),
      })),
    ),
  );
});

router.delete("/scans/history", authRequired, async (req, res): Promise<void> => {
  await db.transaction(async (transaction) => {
    await transaction.delete(scansTable).where(eq(scansTable.userId, req.authUser!.id));
    await transaction
      .delete(redactionsTable)
      .where(eq(redactionsTable.userId, req.authUser!.id));
  });
  res.sendStatus(204);
});

router.delete("/scans/history/:id", authRequired, async (req, res): Promise<void> => {
  const params = DeleteScanParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid scan identifier." });
    return;
  }

  const [deleted] = await db
    .delete(scansTable)
    .where(
      and(eq(scansTable.id, params.data.id), eq(scansTable.userId, req.authUser!.id)),
    )
    .returning({ id: scansTable.id });
  if (!deleted) {
    res.status(404).json({ error: "Scan not found." });
    return;
  }
  res.sendStatus(204);
});

export default router;