import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middlewares/auth.js";
import { validateQuery, validateBody } from "../middlewares/validate.js";
import { notFound } from "../lib/http-error.js";
import { ownerScopeFor } from "../lib/org-context.js";
import { blockViewerWrites } from "../middlewares/org.js";

const router = Router();
router.use(requireAuth);
router.use(blockViewerWrites);

async function assertProjectOwned(projectId: string, ownerId: string) {
  const p = await prisma.project.findFirst({ where: { id: projectId, ...(await ownerScopeFor(ownerId)) } });
  if (!p) throw notFound("Project not found");
}

const listQuery = z.object({ projectId: z.string().min(1) });
router.get("/", validateQuery(listQuery), async (req, res) => {
  const { projectId } = req.query as unknown as z.infer<typeof listQuery>;
  await assertProjectOwned(projectId, req.auth!.sub);
  const boards = await prisma.planBoard.findMany({ where: { projectId }, orderBy: { updatedAt: "desc" } });
  res.json({ boards, count: boards.length });
});

const createSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().max(150).optional(),
  data: z.unknown().optional(),
});
router.post("/", validateBody(createSchema), async (req, res) => {
  const { projectId, name, data } = req.body as z.infer<typeof createSchema>;
  await assertProjectOwned(projectId, req.auth!.sub);
  const board = await prisma.planBoard.create({
    data: { projectId, name: name?.trim() || "Atelier", data: (data ?? {}) as object },
  });
  res.status(201).json({ board });
});

router.get("/:id", async (req, res) => {
  const board = await prisma.planBoard.findFirst({
    where: { id: req.params.id, project: await ownerScopeFor(req.auth!.sub) },
  });
  if (!board) throw notFound("Board not found");
  res.json({ board });
});

const updateSchema = z.object({ name: z.string().max(150).optional(), data: z.unknown().optional() });
router.put("/:id", validateBody(updateSchema), async (req, res) => {
  const existing = await prisma.planBoard.findFirst({
    where: { id: req.params.id, project: await ownerScopeFor(req.auth!.sub) },
  });
  if (!existing) throw notFound("Board not found");
  const { name, data } = req.body as z.infer<typeof updateSchema>;
  const board = await prisma.planBoard.update({
    where: { id: existing.id },
    data: { name, data: data as object | undefined },
  });
  res.json({ board });
});

router.delete("/:id", async (req, res) => {
  const existing = await prisma.planBoard.findFirst({
    where: { id: req.params.id, project: await ownerScopeFor(req.auth!.sub) },
  });
  if (!existing) throw notFound("Board not found");
  await prisma.planBoard.delete({ where: { id: existing.id } });
  res.status(204).end();
});

export default router;
