import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { validateQuery } from "../../middlewares/validate.js";
import { buildDiagnosticExport } from "../../lib/diagnostic-export.js";
import { diagnosticsQuery } from "./schemas.js";
import { toBuilding, toDiagnosticListItem, parseSort } from "./serialize.js";
import { ownerScopeFor } from "../../lib/org-context.js";

const router = Router();

/* eslint-disable @typescript-eslint/no-explicit-any */

// GET /v1/diagnostics — liste paginée + filtres + tri (owner-scoped via req.auth.sub).
router.get("/", validateQuery(diagnosticsQuery), async (req, res) => {
  const q = req.query as unknown as z.infer<typeof diagnosticsQuery>;
  const where: any = { ...(await ownerScopeFor(req.auth!.sub)), operationId: null };
  if (q.status) where.status = q.status;
  if (q.buildingType) where.buildingType = q.buildingType;
  if (q.canton) where.canton = q.canton;
  if (q.egid) where.egid = q.egid;
  if (q.from || q.to) where.createdAt = { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) };

  const [total, projects] = await Promise.all([
    prisma.project.count({ where }),
    prisma.project.findMany({ where, orderBy: parseSort(q.sort), skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
  ]);
  res.json({
    data: projects.map(toDiagnosticListItem),
    pagination: { page: q.page, pageSize: q.pageSize, total, totalPages: Math.ceil(total / q.pageSize) },
  });
});

// Représentation complète d'un diagnostic (couche de sérialisation partagée avec l'export).
async function fullDiagnostic(projectId: string, ownerId: string) {
  const p = await buildDiagnosticExport(projectId, ownerId); // vérifie l'accès (404 sinon)
  const project = await prisma.project.findFirst({ where: { id: projectId, ...(await ownerScopeFor(ownerId)) } });
  return {
    id: projectId,
    egid: p.building.egid,
    status: p.meta.status,
    visitDate: p.meta.diagnosticDate,
    building: { ...toBuilding(project!) },
    elements: p.items.map((i) => ({
      cfcCode: i.cfcCode, cfcLabel: i.cfcLabel, state: i.state, priority: i.priority,
      observation: i.observation, works: i.works, area: i.area, unit: i.unit,
      estimatedCost: i.estimatedCost, improvementCost: i.improvementCost, normsCost: i.normsCost,
      interventionYear: i.interventionYear,
    })),
    costs: p.costs,
    workPlan: p.workPlan,
    variants: p.variants,
  };
}

// GET /v1/diagnostics/:id — détail complet.
router.get("/:id", async (req, res) => {
  res.json(await fullDiagnostic(req.params.id, req.auth!.sub));
});

// Sous-ressources : tranches du même payload.
router.get("/:id/elements", async (req, res) => {
  const d = await fullDiagnostic(req.params.id, req.auth!.sub);
  res.json({ diagnosticId: d.id, egid: d.egid, data: d.elements });
});
router.get("/:id/costs", async (req, res) => {
  const d = await fullDiagnostic(req.params.id, req.auth!.sub);
  res.json({ diagnosticId: d.id, egid: d.egid, costs: d.costs, variants: d.variants });
});
router.get("/:id/work-plan", async (req, res) => {
  const d = await fullDiagnostic(req.params.id, req.auth!.sub);
  res.json({ diagnosticId: d.id, egid: d.egid, data: d.workPlan });
});

export default router;
