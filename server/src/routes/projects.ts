import { Router } from "express";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { BuildingType, ProjectStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middlewares/auth.js";
import { validateBody } from "../middlewares/validate.js";
import { notFound, badRequest } from "../lib/http-error.js";
import { fireEvent } from "../lib/webhook.js";
import { ownerScopeFor } from "../lib/org-context.js";
import { blockViewerWrites } from "../middlewares/org.js";

const router = Router();
router.use(requireAuth);
router.use(blockViewerWrites);

/** Vérifie que l'opération (si fournie) est accessible (parc de l'organisation ou compte solo). */
async function assertOperationOwnership(operationId: string | null | undefined, ownerId: string) {
  if (!operationId) return;
  const op = await prisma.operation.findFirst({ where: { id: operationId, ...(await ownerScopeFor(ownerId)) } });
  if (!op) throw badRequest("Operation not found");
}

const projectBaseSchema = z.object({
  name: z.string().min(1).max(255),
  address: z.string().min(1).max(255),
  postalCode: z.string().max(10).optional(),
  city: z.string().min(1).max(150),
  canton: z.string().min(1).max(50),
  parcelNumber: z.string().max(50).optional(),
  operationId: z.string().optional().nullable(),
  buildingType: z.nativeEnum(BuildingType),
  roofType: z.enum(['PLATE', 'PENTE', 'MIXTE']).nullable().optional(),
  yearBuilt: z.number().int().min(1500).max(2100).optional(),
  renovationYear: z.number().int().min(1500).max(2100).optional(),
  nbApartments: z.number().int().min(0).optional(),
  nbFloors: z.number().int().min(0).optional(),
  floorHeight: z.number().positive().optional(),
  nbStaircases: z.number().int().min(0).optional(),
  floorArea: z.number().positive().optional(),
  builtArea: z.number().positive().optional(),
  facadeArea: z.number().positive().optional(),
  terrainArea: z.number().positive().optional(),
  perimeter: z.number().positive().optional(),
  windowPct: z.number().min(0).max(100).optional(),
  honoraryPct: z.number().min(0).max(100).optional(),
  reservePct: z.number().min(0).max(100).optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  // Données énergétiques (import certificat)
  sre: z.number().nonnegative().nullable().optional(),
  energyConsumptionHeat: z.number().nonnegative().nullable().optional(),
  energyConsumptionElec: z.number().nonnegative().nullable().optional(),
  energyAgent: z.string().max(120).nullable().optional(),
  energyClassEnvelope: z.string().max(1).nullable().optional(),
  energyClassGlobal: z.string().max(1).nullable().optional(),
  energyRefYear: z.number().int().min(1500).max(2100).nullable().optional(),
  energySource: z.string().max(60).nullable().optional(),
  energyCertDate: z.coerce.date().nullable().optional(),
  energyData: z.any().optional(),
  // Enrichissement géographique (geo.admin)
  east: z.number().nullable().optional(),
  north: z.number().nullable().optional(),
  egid: z.string().max(20).nullable().optional(),
  egrid: z.string().max(30).nullable().optional(),
  geoSource: z.string().max(60).nullable().optional(),
  geoFetchedAt: z.coerce.date().nullable().optional(),
  geoData: z.any().optional(),
});

const createSchema = projectBaseSchema;
const updateSchema = projectBaseSchema.partial();

router.get("/", async (req, res) => {
  const rows = await prisma.project.findMany({
    where: await ownerScopeFor(req.auth!.sub),
    orderBy: { updatedAt: "desc" },
  });
  // `geoData` est le dump brut des registres (plusieurs Ko par batiment) : inutile en liste,
  // il n'est lu que sur la fiche du diagnostic, qui passe par GET /projects/:id.
  const projects = rows.map(({ geoData: _geoData, ...rest }) => rest);
  res.json({ projects, count: projects.length });
});

router.post("/", validateBody(createSchema), async (req, res) => {
  const data = req.body as z.infer<typeof createSchema>;
  await assertOperationOwnership(data.operationId, req.auth!.sub);
  const project = await prisma.project.create({
    data: { ...data, ownerId: req.auth!.sub },
  });
  res.status(201).json({ project });
});

async function loadOwnedProject(id: string, ownerId: string) {
  const project = await prisma.project.findFirst({ where: { id, ...(await ownerScopeFor(ownerId)) } });
  if (!project) throw notFound("Project not found");
  return project;
}

router.get("/:id", async (req, res) => {
  const project = await loadOwnedProject(req.params.id, req.auth!.sub);
  const diagnostics = await prisma.diagnostic.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { items: true } } },
  });
  res.json({ project, diagnostics });
});

router.put("/:id", validateBody(updateSchema), async (req, res) => {
  const before = await loadOwnedProject(req.params.id, req.auth!.sub);
  const data = req.body as z.infer<typeof updateSchema>;
  await assertOperationOwnership(data.operationId, req.auth!.sub);
  const project = await prisma.project.update({ where: { id: req.params.id }, data });
  // Finalisation (transition vers TERMINE uniquement).
  if (data.status === "TERMINE" && before.status !== "TERMINE") {
    fireEvent(req.auth!.sub, "diagnostic.finalise", { projectId: project.id, egid: project.egid ?? null });
  }
  res.json({ project });
});

router.delete("/:id", async (req, res) => {
  await loadOwnedProject(req.params.id, req.auth!.sub);
  await prisma.project.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

// ---------- Partage client en lecture seule ----------

// Active (ou renvoie) le lien de partage. Le front compose l'URL avec son origine.
router.post("/:id/share", async (req, res) => {
  const project = await loadOwnedProject(req.params.id, req.auth!.sub);
  let token = project.shareToken;
  if (!token) {
    token = randomBytes(24).toString("base64url");
    await prisma.project.update({ where: { id: project.id }, data: { shareToken: token, sharedAt: new Date() } });
    // Un rapport partageable vient d'être publié.
    fireEvent(req.auth!.sub, "rapport.genere", { projectId: project.id, egid: project.egid ?? null, kind: "share" });
  }
  res.json({ token });
});

// Revoque le lien.
router.delete("/:id/share", async (req, res) => {
  const project = await loadOwnedProject(req.params.id, req.auth!.sub);
  if (project.shareToken) {
    await prisma.project.update({ where: { id: project.id }, data: { shareToken: null, sharedAt: null } });
  }
  res.status(204).end();
});

// ---------- diagnostics nichés sous un project ----------

const createDiagnosticSchema = z.object({
  visitDate: z.coerce.date().optional(),
  notes: z.string().max(10_000).optional(),
});

router.get("/:id/diagnostics", async (req, res) => {
  const project = await loadOwnedProject(req.params.id, req.auth!.sub);
  const diagnostics = await prisma.diagnostic.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { items: true } } },
  });
  res.json({ diagnostics, count: diagnostics.length });
});

router.post("/:id/diagnostics", validateBody(createDiagnosticSchema), async (req, res) => {
  const project = await loadOwnedProject(req.params.id, req.auth!.sub);
  const data = req.body as z.infer<typeof createDiagnosticSchema>;
  const diagnostic = await prisma.diagnostic.create({
    data: {
      projectId: project.id,
      visitDate: data.visitDate,
      notes: data.notes,
    },
  });
  res.status(201).json({ diagnostic });
});

export default router;
