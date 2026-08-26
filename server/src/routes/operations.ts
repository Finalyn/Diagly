import { Router } from "express";
import { z } from "zod";
import { AggregationMode, ProjectStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middlewares/auth.js";
import { validateBody } from "../middlewares/validate.js";
import { notFound } from "../lib/http-error.js";
import { ownerScopeFor } from "../lib/org-context.js";
import { blockViewerWrites } from "../middlewares/org.js";

const router = Router();
router.use(requireAuth);
router.use(blockViewerWrites);

const baseSchema = z.object({
  name: z.string().min(1).max(255),
  clientName: z.string().max(150).optional(),
  aggregationMode: z.nativeEnum(AggregationMode).optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
});
const createSchema = baseSchema;
const updateSchema = baseSchema.partial();

async function loadOwnedOperation(id: string, ownerId: string) {
  const operation = await prisma.operation.findFirst({ where: { id, ...(await ownerScopeFor(ownerId)) } });
  if (!operation) throw notFound("Operation not found");
  return operation;
}

router.get("/", async (req, res) => {
  const operations = await prisma.operation.findMany({
    where: await ownerScopeFor(req.auth!.sub),
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { projects: true } } },
  });
  res.json({ operations, count: operations.length });
});

router.post("/", validateBody(createSchema), async (req, res) => {
  const data = req.body as z.infer<typeof createSchema>;
  const operation = await prisma.operation.create({
    data: { ...data, ownerId: req.auth!.sub },
  });
  res.status(201).json({ operation });
});

router.get("/:id", async (req, res) => {
  const operation = await loadOwnedOperation(req.params.id, req.auth!.sub);
  const projects = await prisma.project.findMany({
    where: { operationId: operation.id, ...(await ownerScopeFor(req.auth!.sub)) },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { diagnostics: true } } },
  });
  res.json({ operation, projects });
});

router.put("/:id", validateBody(updateSchema), async (req, res) => {
  await loadOwnedOperation(req.params.id, req.auth!.sub);
  const data = req.body as z.infer<typeof updateSchema>;
  const operation = await prisma.operation.update({ where: { id: req.params.id }, data });
  res.json({ operation });
});

router.delete("/:id", async (req, res) => {
  await loadOwnedOperation(req.params.id, req.auth!.sub);
  // Les bâtiments rattachés sont détachés (operationId -> null) via onDelete: SetNull.
  await prisma.operation.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

export default router;
