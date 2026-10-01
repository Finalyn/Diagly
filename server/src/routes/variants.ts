/**
 * Variantes de projet.
 *
 * Le diagnostic de base dit ce qu'il faut faire. La variante repond a une autre
 * question : « et si on isolait par l'interieur plutot que par l'exterieur ? »,
 * « et si on passait au pellet, ou au chauffage a distance ? ». Elle ne duplique
 * pas le diagnostic : elle ne porte que les arbitrages qui changent, et tout le
 * reste du dossier vaut par defaut. C'est ce qui permet de corriger un ouvrage
 * une seule fois et de voir toutes les variantes bouger ensemble.
 *
 * N'importe quel ouvrage du dossier peut etre arbitre, quel que soit son CFC, et
 * une ligne sans ouvrage remplace est un travail nouveau. Le nombre de variantes
 * n'est pas limite.
 */
import { Router } from "express";
import { z } from "zod";
import { ElementState } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middlewares/auth.js";
import { validateBody } from "../middlewares/validate.js";
import { notFound, badRequest } from "../lib/http-error.js";
import { ownerScopeFor } from "../lib/org-context.js";
import { blockViewerWrites } from "../middlewares/org.js";

const router = Router();
router.use(requireAuth);
router.use(blockViewerWrites);

const varianteSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(4000).nullable().optional(),
  displayOrder: z.number().int().min(0).max(10).optional(),
});

const ligneSchema = z.object({
  /// Ouvrage du diagnostic auquel la ligne se substitue. Absent = travail nouveau.
  replacesItemId: z.string().min(1).nullable().optional(),
  /// Article du catalogue retenu : porte les prix par etat, donc le calcul automatique.
  catalogItemId: z.number().int().positive().nullable().optional(),
  /// Etat retenu dans la variante (moyen -> mauvais, par exemple).
  state: z.nativeEnum(ElementState).nullable().optional(),
  cfcCode: z.string().min(1).max(10),
  label: z.string().min(1).max(255),
  unit: z.string().max(50).nullable().optional(),
  area: z.number().nonnegative().nullable().optional(),
  amount: z.number().min(0).max(1e9),
  /// true = montant repris a la main, il ne suit plus le catalogue.
  costManual: z.boolean().optional(),
  note: z.string().max(2000).nullable().optional(),
});

/** Charge une variante en verifiant qu'elle appartient bien a l'utilisateur. */
async function chargerVariante(id: string, ownerId: string) {
  const variante = await prisma.projectVariant.findFirst({
    where: { id, project: await ownerScopeFor(ownerId) },
    include: { lines: { orderBy: { createdAt: "asc" } } },
  });
  if (!variante) throw notFound("Variante introuvable");
  return variante;
}

/** Variantes d'un projet, dans l'ordre d'affichage. */
router.get("/projects/:projectId", async (req, res) => {
  const projet = await prisma.project.findFirst({
    where: { id: req.params.projectId, ...(await ownerScopeFor(req.auth!.sub)) },
  });
  if (!projet) throw notFound("Projet introuvable");

  const variants = await prisma.projectVariant.findMany({
    where: { projectId: projet.id },
    include: { lines: { orderBy: { createdAt: "asc" } } },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
  });
  res.json({ variants, count: variants.length });
});

router.post("/projects/:projectId", validateBody(varianteSchema), async (req, res) => {
  const projet = await prisma.project.findFirst({
    where: { id: req.params.projectId, ...(await ownerScopeFor(req.auth!.sub)) },
  });
  if (!projet) throw notFound("Projet introuvable");

  // Sert seulement a poser la variante en fin de liste : le nombre n'est pas limite.
  const deja = await prisma.projectVariant.count({ where: { projectId: projet.id } });

  const data = req.body as z.infer<typeof varianteSchema>;
  const variant = await prisma.projectVariant.create({
    data: {
      projectId: projet.id,
      name: data.name,
      description: data.description ?? null,
      displayOrder: data.displayOrder ?? deja,
    },
    include: { lines: true },
  });
  res.status(201).json({ variant });
});

router.put("/:id", validateBody(varianteSchema.partial()), async (req, res) => {
  const existante = await chargerVariante(req.params.id, req.auth!.sub);
  const variant = await prisma.projectVariant.update({
    where: { id: existante.id },
    data: req.body as z.infer<typeof varianteSchema>,
    include: { lines: { orderBy: { createdAt: "asc" } } },
  });
  res.json({ variant });
});

router.delete("/:id", async (req, res) => {
  const existante = await chargerVariante(req.params.id, req.auth!.sub);
  await prisma.projectVariant.delete({ where: { id: existante.id } });
  res.status(204).end();
});

router.post("/:id/lines", validateBody(ligneSchema), async (req, res) => {
  const variante = await chargerVariante(req.params.id, req.auth!.sub);
  const data = req.body as z.infer<typeof ligneSchema>;

  // Un ouvrage ne peut etre arbitre qu'une fois par variante : deux lignes le
  // remplacant donneraient deux totaux differents selon l'ordre de lecture.
  if (data.replacesItemId && variante.lines.some((l) => l.replacesItemId === data.replacesItemId)) {
    throw badRequest("Cet ouvrage est déjà remplacé dans cette variante.");
  }

  const line = await prisma.variantLine.create({
    data: {
      variantId: variante.id,
      replacesItemId: data.replacesItemId ?? null,
      catalogItemId: data.catalogItemId ?? null,
      state: data.state ?? null,
      cfcCode: data.cfcCode,
      label: data.label,
      unit: data.unit ?? null,
      area: data.area ?? null,
      amount: data.amount,
      costManual: data.costManual ?? false,
      note: data.note ?? null,
    },
  });
  res.status(201).json({ line });
});

router.put("/lines/:lineId", validateBody(ligneSchema.partial()), async (req, res) => {
  const ligne = await prisma.variantLine.findFirst({
    where: { id: req.params.lineId, variant: { project: await ownerScopeFor(req.auth!.sub) } },
  });
  if (!ligne) throw notFound("Ligne de variante introuvable");

  const line = await prisma.variantLine.update({
    where: { id: ligne.id },
    data: req.body as z.infer<typeof ligneSchema>,
  });
  res.json({ line });
});

router.delete("/lines/:lineId", async (req, res) => {
  const ligne = await prisma.variantLine.findFirst({
    where: { id: req.params.lineId, variant: { project: await ownerScopeFor(req.auth!.sub) } },
  });
  if (!ligne) throw notFound("Ligne de variante introuvable");
  await prisma.variantLine.delete({ where: { id: ligne.id } });
  res.status(204).end();
});

export default router;
