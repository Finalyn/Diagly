import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import swaggerUi from "swagger-ui-express";
import { requireApiKey } from "../../middlewares/api-key-auth.js";
import { apiAccessLog } from "../../middlewares/api-access-log.js";
import { apiKeyLimiter } from "../../middlewares/rate-limit.js";
import { buildOpenApiDocument } from "../../lib/openapi.js";
import diagnosticsRouter from "./diagnostics.js";
import buildingsRouter from "./buildings.js";
import portfolioRouter from "./portfolio.js";

const router = Router();
const openApiDoc = buildOpenApiDocument();

// ---- Public : spécification + documentation interactive (pas de clé requise) ----
router.get("/openapi.json", (_req, res) => res.json(openApiDoc));

// La CSP globale (script-src 'self') bloque l'init inline de Swagger UI → on la relâche pour /docs seul.
function docsCsp(_req: Request, res: Response, next: NextFunction) {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:",
  );
  next();
}
router.use("/docs", docsCsp, swaggerUi.serve, swaggerUi.setup(openApiDoc, { customSiteTitle: "Diagly API" }));

// ---- Protégé : journal d'accès → clé d'API → quota par clé → ressources (lecture seule) ----
router.use(apiAccessLog);
router.use(requireApiKey);
router.use(apiKeyLimiter);
router.use("/diagnostics", diagnosticsRouter);
router.use("/buildings", buildingsRouter);
router.use("/portfolio", portfolioRouter);

export default router;
