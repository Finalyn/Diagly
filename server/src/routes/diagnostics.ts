import { Router } from "express";
import { z } from "zod";
import { DiagnosticStatus, ElementState, Priority } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middlewares/auth.js";
import { validateBody } from "../middlewares/validate.js";
import { notFound } from "../lib/http-error.js";
import { fireEvent } from "../lib/webhook.js";
import { ownerScopeFor } from "../lib/org-context.js";
import { blockViewerWrites } from "../middlewares/org.js";

const router = Router();
router.use(requireAuth);
router.use(blockViewerWrites);

// element.modifie + plan_travaux.mis_a_jour (dérivé) — coalescés par diagnostic (anti-rafale).
function fireItemEvents(ownerId: string, diagnosticId: string, egid: string | null) {
  fireEvent(ownerId, "element.modifie", { diagnosticId, egid }, { coalesceDiagnosticId: diagnosticId });
  fireEvent(ownerId, "plan_travaux.mis_a_jour", { diagnosticId, egid }, { coalesceDiagnosticId: diagnosticId });
}

async function loadOwnedDiagnostic(diagId: string, ownerId: string) {
  const diag = await prisma.diagnostic.findFirst({
    where: { id: diagId, project: await ownerScopeFor(ownerId) },
    include: { project: true },
  });
  if (!diag) throw notFound("Diagnostic not found");
  return diag;
}

// Derniers elements diagnostiques, tous projets de l'utilisateur (tableau de bord).
// NB : defini AVANT "/:id" pour ne pas etre capte comme un id.
router.get("/recent-items", async (req, res) => {
  const rows = await prisma.diagnosticItem.findMany({
    where: { diagnostic: { project: await ownerScopeFor(req.auth!.sub) } },
    orderBy: { updatedAt: "desc" },
    take: 8,
    select: {
      id: true, cfcCode: true, cfcLabel: true, state: true, priority: true,
      estimatedCost: true, updatedAt: true,
      diagnostic: { select: { projectId: true, project: { select: { name: true } } } },
    },
  });
  const items = rows.map((it) => ({
    id: it.id, cfcCode: it.cfcCode, cfcLabel: it.cfcLabel, state: it.state, priority: it.priority,
    estimatedCost: it.estimatedCost, updatedAt: it.updatedAt,
    projectId: it.diagnostic.projectId, projectName: it.diagnostic.project.name,
  }));
  res.json({ items });
});

router.get("/:id", async (req, res) => {
  const diag = await loadOwnedDiagnostic(req.params.id, req.auth!.sub);
  const items = await prisma.diagnosticItem.findMany({
    where: { diagnosticId: diag.id },
    orderBy: { createdAt: "asc" },
  });
  res.json({ diagnostic: diag, items });
});

const updateDiagnosticSchema = z.object({
  visitDate: z.coerce.date().optional(),
  status: z.nativeEnum(DiagnosticStatus).optional(),
  notes: z.string().max(10_000).optional(),
});

router.put("/:id", validateBody(updateDiagnosticSchema), async (req, res) => {
  const diag = await loadOwnedDiagnostic(req.params.id, req.auth!.sub);
  const data = req.body as z.infer<typeof updateDiagnosticSchema>;
  const diagnostic = await prisma.diagnostic.update({
    where: { id: req.params.id },
    data,
  });
  // Événement de finalisation (transition vers COMPLETED uniquement).
  if (data.status === "COMPLETED" && diag.status !== "COMPLETED") {
    fireEvent(req.auth!.sub, "diagnostic.finalise", { diagnosticId: diag.id, projectId: diag.projectId, egid: diag.project.egid ?? null });
  }
  res.json({ diagnostic });
});

router.delete("/:id", async (req, res) => {
  await loadOwnedDiagnostic(req.params.id, req.auth!.sub);
  await prisma.diagnostic.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

// ---------- DiagnosticItems (observations) ----------

const itemBaseSchema = z.object({
  cfcCode: z.string().min(1).max(10),
  cfcLabel: z.string().min(1).max(255),
  catalogItemId: z.number().int().positive().optional(),
  state: z.nativeEnum(ElementState).nullable().optional(),
  priority: z.nativeEnum(Priority).nullable().optional(),
  notes: z.string().max(10_000).optional(),
  works: z.array(z.string().min(1)).default([]),
  photos: z.array(z.string().min(1)).default([]),
  area: z.number().positive().optional(),
  unit: z.string().max(50).optional(),
  yearInstalled: z.number().int().min(1500).max(2100).optional(),
  interventionYear: z.number().int().min(1900).max(2200).nullable().optional(),
  estimatedCost: z.number().min(0).nullable().optional(),
  improvement: z.string().max(2000).nullable().optional(),
  improvementCost: z.number().min(0).nullable().optional(),
  norms: z.string().max(2000).nullable().optional(),
  normsCost: z.number().min(0).nullable().optional(),
});

const createItemSchema = itemBaseSchema;
const updateItemSchema = itemBaseSchema.partial();

router.get("/:id/items", async (req, res) => {
  await loadOwnedDiagnostic(req.params.id, req.auth!.sub);
  const items = await prisma.diagnosticItem.findMany({
    where: { diagnosticId: req.params.id },
    orderBy: { createdAt: "asc" },
  });
  res.json({ items, count: items.length });
});

router.post("/:id/items", validateBody(createItemSchema), async (req, res) => {
  const diag = await loadOwnedDiagnostic(req.params.id, req.auth!.sub);
  const data = req.body as z.infer<typeof createItemSchema>;
  const item = await prisma.diagnosticItem.create({
    data: {
      diagnosticId: req.params.id,
      cfcCode: data.cfcCode,
      cfcLabel: data.cfcLabel,
      catalogItemId: data.catalogItemId,
      state: data.state,
      priority: data.priority,
      notes: data.notes,
      works: data.works,
      photos: data.photos,
      area: data.area,
      unit: data.unit,
      yearInstalled: data.yearInstalled,
      interventionYear: data.interventionYear,
      estimatedCost: data.estimatedCost,
      improvement: data.improvement,
      improvementCost: data.improvementCost,
      norms: data.norms,
      normsCost: data.normsCost,
    },
  });
  fireItemEvents(req.auth!.sub, diag.id, diag.project.egid ?? null);
  res.status(201).json({ item });
});

async function loadOwnedItem(itemId: string, ownerId: string) {
  const item = await prisma.diagnosticItem.findFirst({
    where: { id: itemId, diagnostic: { project: await ownerScopeFor(ownerId) } },
    include: { diagnostic: { include: { project: { select: { egid: true } } } } },
  });
  if (!item) throw notFound("Diagnostic item not found");
  return item;
}

router.get("/items/:itemId", async (req, res) => {
  const item = await loadOwnedItem(req.params.itemId, req.auth!.sub);
  res.json({ item });
});

router.put("/items/:itemId", validateBody(updateItemSchema), async (req, res) => {
  const existing = await loadOwnedItem(req.params.itemId, req.auth!.sub);
  const data = req.body as z.infer<typeof updateItemSchema>;
  const item = await prisma.diagnosticItem.update({
    where: { id: req.params.itemId },
    data,
  });
  fireItemEvents(req.auth!.sub, existing.diagnosticId, existing.diagnostic.project.egid ?? null);
  res.json({ item });
});

router.delete("/items/:itemId", async (req, res) => {
  const existing = await loadOwnedItem(req.params.itemId, req.auth!.sub);
  await prisma.diagnosticItem.delete({ where: { id: req.params.itemId } });
  fireItemEvents(req.auth!.sub, existing.diagnosticId, existing.diagnostic.project.egid ?? null);
  res.status(204).end();
});

export default router;
