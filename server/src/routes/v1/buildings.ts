import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { validateQuery } from "../../middlewares/validate.js";
import { notFound } from "../../lib/http-error.js";
import { buildingsQuery } from "./schemas.js";
import { toBuilding, parseSort } from "./serialize.js";
import { ownerScopeFor } from "../../lib/org-context.js";

const router = Router();

/* eslint-disable @typescript-eslint/no-explicit-any */

// GET /v1/buildings — identification des bâtiments (EGID = clé de jointure).
router.get("/", validateQuery(buildingsQuery), async (req, res) => {
  const q = req.query as unknown as z.infer<typeof buildingsQuery>;
  const where: any = { ...(await ownerScopeFor(req.auth!.sub)), operationId: null };
  if (q.buildingType) where.buildingType = q.buildingType;
  if (q.canton) where.canton = q.canton;
  if (q.egid) where.egid = q.egid;

  const [total, projects] = await Promise.all([
    prisma.project.count({ where }),
    prisma.project.findMany({ where, orderBy: parseSort(q.sort), skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
  ]);
  res.json({
    data: projects.map(toBuilding),
    pagination: { page: q.page, pageSize: q.pageSize, total, totalPages: Math.ceil(total / q.pageSize) },
  });
});

// GET /v1/buildings/:id — identification complète d'un bâtiment.
router.get("/:id", async (req, res) => {
  const project = await prisma.project.findFirst({ where: { id: req.params.id, ...(await ownerScopeFor(req.auth!.sub)) } });
  if (!project) throw notFound("Bâtiment introuvable");
  res.json(toBuilding(project));
});

export default router;
