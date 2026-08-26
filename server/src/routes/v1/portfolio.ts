import { Router } from "express";
import { z } from "zod";
import { validateQuery } from "../../middlewares/validate.js";
import { portfolioSummary, queryElements, aggregateCosts, portfolioWorkPlan } from "../../lib/portfolio.js";

// Agrégations à l'échelle du parc (owner-scoped via requireApiKey monté en amont).
const router = Router();

const filters = z.object({
  cfc: z.string().max(10).optional(),
  state: z.enum(["TRES_BON", "BON", "MOYEN", "MAUVAIS"]).optional(),
  priority: z.enum(["I", "II", "III"]).optional(),
  canton: z.string().max(2).optional(),
  buildingType: z.string().max(30).optional(),
  interventionYear: z.coerce.number().int().optional(),
  egid: z.string().max(20).optional(),
});

router.get("/summary", async (req, res) => {
  res.json(await portfolioSummary(req.auth!.sub));
});

router.get("/elements", validateQuery(filters.extend({ limit: z.coerce.number().int().min(1).max(200).default(50) })), async (req, res) => {
  const q = req.query as unknown as z.infer<typeof filters> & { limit: number };
  res.json(await queryElements(req.auth!.sub, q, q.limit));
});

router.get("/costs", validateQuery(filters.extend({ groupBy: z.enum(["canton", "year", "priority", "buildingType"]).default("canton") })), async (req, res) => {
  const q = req.query as unknown as z.infer<typeof filters> & { groupBy: "canton" | "year" | "priority" | "buildingType" };
  res.json(await aggregateCosts(req.auth!.sub, q.groupBy, q));
});

router.get("/work-plan", validateQuery(filters), async (req, res) => {
  const q = req.query as unknown as z.infer<typeof filters>;
  res.json(await portfolioWorkPlan(req.auth!.sub, q));
});

export default router;
