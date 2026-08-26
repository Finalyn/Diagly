import { Router } from "express";
import { z } from "zod";
import { EventCategory } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middlewares/auth.js";
import { validateQuery, validateBody } from "../middlewares/validate.js";
import { notFound, badRequest } from "../lib/http-error.js";
import { ownerScopeFor } from "../lib/org-context.js";

const router = Router();
router.use(requireAuth);

/** Verifie qu'un projectId (si fourni) est accessible (parc de l'organisation ou compte solo). */
async function assertProjectOwnership(projectId: string | null | undefined, ownerId: string) {
  if (!projectId) return;
  const p = await prisma.project.findFirst({ where: { id: projectId, ...(await ownerScopeFor(ownerId)) }, select: { id: true } });
  if (!p) throw badRequest("Project not found");
}

const listQuery = z.object({ from: z.string().optional(), to: z.string().optional() });
router.get("/", validateQuery(listQuery), async (req, res) => {
  const { from, to } = req.query as z.infer<typeof listQuery>;
  const where: { userId: string; startAt?: { gte?: Date; lte?: Date } } = { userId: req.auth!.sub };
  if (from || to) where.startAt = { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) };
  const events = await prisma.event.findMany({ where, orderBy: { startAt: "asc" } });
  res.json({ events, count: events.length });
});

const baseSchema = z.object({
  title: z.string().min(1).max(255),
  category: z.nativeEnum(EventCategory).optional(),
  color: z.string().max(20).nullable().optional(),
  location: z.string().max(255).nullable().optional(),
  notes: z.string().max(10_000).nullable().optional(),
  allDay: z.boolean().optional(),
  startAt: z.string().min(1),
  endAt: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
});

router.post("/", validateBody(baseSchema), async (req, res) => {
  const d = req.body as z.infer<typeof baseSchema>;
  await assertProjectOwnership(d.projectId, req.auth!.sub);
  const event = await prisma.event.create({
    data: {
      userId: req.auth!.sub,
      title: d.title,
      category: d.category ?? "AUTRE",
      color: d.color ?? null,
      location: d.location ?? null,
      notes: d.notes ?? null,
      allDay: d.allDay ?? false,
      startAt: new Date(d.startAt),
      endAt: d.endAt ? new Date(d.endAt) : null,
      projectId: d.projectId ?? null,
    },
  });
  res.status(201).json({ event });
});

const updateSchema = baseSchema.partial();
router.put("/:id", validateBody(updateSchema), async (req, res) => {
  const existing = await prisma.event.findFirst({ where: { id: req.params.id, userId: req.auth!.sub } });
  if (!existing) throw notFound("Event not found");
  const d = req.body as z.infer<typeof updateSchema>;
  if (d.projectId !== undefined) await assertProjectOwnership(d.projectId, req.auth!.sub);
  const event = await prisma.event.update({
    where: { id: existing.id },
    data: {
      title: d.title,
      category: d.category,
      color: d.color,
      location: d.location,
      notes: d.notes,
      allDay: d.allDay,
      startAt: d.startAt ? new Date(d.startAt) : undefined,
      endAt: d.endAt === undefined ? undefined : d.endAt ? new Date(d.endAt) : null,
      projectId: d.projectId === undefined ? undefined : d.projectId,
    },
  });
  res.json({ event });
});

router.delete("/:id", async (req, res) => {
  const existing = await prisma.event.findFirst({ where: { id: req.params.id, userId: req.auth!.sub } });
  if (!existing) throw notFound("Event not found");
  await prisma.event.delete({ where: { id: existing.id } });
  res.status(204).end();
});

export default router;
