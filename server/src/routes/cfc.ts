import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middlewares/auth.js";
import { validateQuery, validateBody } from "../middlewares/validate.js";
import { notFound } from "../lib/http-error.js";

const router = Router();
router.use(requireAuth);

// ---------- Catalogue CFC suisse (nomenclature officielle, commune) ----------

const catalogQuery = z.object({
  level: z.coerce.number().int().min(1).max(3).optional(),
  parent: z.string().min(1).optional(),
  search: z.string().min(1).max(100).optional(),
});

router.get("/catalog", validateQuery(catalogQuery), async (req, res) => {
  const q = req.query as unknown as z.infer<typeof catalogQuery>;
  const entries = await prisma.cfcCatalogEntry.findMany({
    where: {
      level: q.level,
      parentCode: q.parent,
      OR: q.search ? [{ code: { contains: q.search } }, { label: { contains: q.search } }] : undefined,
    },
    orderBy: { code: "asc" },
  });
  res.json({ entries, count: entries.length });
});

router.get("/catalog/:code", async (req, res) => {
  const entry = await prisma.cfcCatalogEntry.findUnique({ where: { code: req.params.code } });
  if (!entry) throw notFound(`CFC code ${req.params.code} not found`);
  res.json({ entry });
});

// ---------- Items opérationnels (prix par état), PERSONNALISABLES PAR UTILISATEUR ----------
//
// Modèle : les items par défaut ont ownerId = null (référence commune, lecture seule).
// Quand un utilisateur modifie un item par défaut, on crée une COPIE lui appartenant
// (ownerId = user, baseId = id du défaut) qui "masque" le défaut dans SA vue. Il peut
// aussi créer ses propres items (baseId = null). "Réinitialiser au défaut" = supprimer
// ses copies. Aucune modification d'un compte n'affecte les autres.

const itemsQuery = z.object({
  category: z.string().min(1).max(150).optional(),
  cfc: z.string().min(1).optional(),
  search: z.string().min(1).max(100).optional(),
});

router.get("/items", validateQuery(itemsQuery), async (req, res) => {
  const q = req.query as unknown as z.infer<typeof itemsQuery>;
  const userId = req.auth!.sub;
  const filter = {
    category: q.category,
    cfcCode: q.cfc,
    OR: q.search
      ? [{ description: { contains: q.search } }, { cfcCode: { contains: q.search } }]
      : undefined,
  };
  const [globalItems, userItems] = await Promise.all([
    prisma.catalogItem.findMany({ where: { ...filter, ownerId: null }, orderBy: { displayOrder: "asc" } }),
    prisma.catalogItem.findMany({ where: { ...filter, ownerId: userId }, orderBy: { displayOrder: "asc" } }),
  ]);
  // Les personnalisations remplacent l'item par défaut qu'elles masquent (baseId).
  const shadowed = new Set(userItems.map((i) => i.baseId).filter((v): v is number => v != null));
  const items = [...globalItems.filter((g) => !shadowed.has(g.id)), ...userItems].sort(
    (a, b) => a.displayOrder - b.displayOrder,
  );
  res.json({ items, count: items.length });
});

router.get("/items/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw notFound("Invalid id");
  const item = await prisma.catalogItem.findFirst({
    where: { id, OR: [{ ownerId: null }, { ownerId: req.auth!.sub }] },
  });
  if (!item) throw notFound(`Catalog item ${id} not found`);
  res.json({ item });
});

// ---------- Édition du catalogue (personnalisation par utilisateur) ----------

const itemBaseSchema = z.object({
  displayOrder: z.number().int().min(0).optional(),
  category: z.string().max(150).nullable().optional(),
  categoryCfc: z.string().max(10).nullable().optional(),
  description: z.string().min(1).max(255),
  cfcCode: z.string().max(10).nullable().optional(),
  workTbe: z.string().max(5000).nullable().optional(),
  workBon: z.string().max(5000).nullable().optional(),
  workMoyen: z.string().max(5000).nullable().optional(),
  workMauvais: z.string().max(5000).nullable().optional(),
  workImprovement: z.string().max(5000).nullable().optional(),
  workNorms: z.string().max(5000).nullable().optional(),
  unit: z.string().max(100).nullable().optional(),
  quantityFormula: z.string().max(255).nullable().optional(),
  priceTbe: z.string().max(100).nullable().optional(),
  priceBon: z.string().max(100).nullable().optional(),
  priceMoyen: z.string().max(100).nullable().optional(),
  priceMauvais: z.string().max(100).nullable().optional(),
  priceImprovement: z.string().max(100).nullable().optional(),
  priceNorms: z.string().max(100).nullable().optional(),
  scaffoldingNote: z.string().max(255).nullable().optional(),
});
const createItemSchema = itemBaseSchema;
const updateItemSchema = itemBaseSchema.partial();

// Réinitialise TOUT le catalogue de l'utilisateur au défaut (supprime ses personnalisations).
// Placé avant "/items/:id" pour être matché en priorité.
router.post("/items/reset", async (req, res) => {
  const result = await prisma.catalogItem.deleteMany({ where: { ownerId: req.auth!.sub } });
  res.json({ reset: result.count });
});

router.post("/items", validateBody(createItemSchema), async (req, res) => {
  const data = req.body as z.infer<typeof createItemSchema>;
  let displayOrder = data.displayOrder;
  if (displayOrder == null) {
    const max = await prisma.catalogItem.aggregate({ _max: { displayOrder: true } });
    displayOrder = (max._max.displayOrder ?? 0) + 1;
  }
  const item = await prisma.catalogItem.create({
    data: { ...data, displayOrder, ownerId: req.auth!.sub, baseId: null },
  });
  res.status(201).json({ item });
});

router.put("/items/:id", validateBody(updateItemSchema), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw notFound("Invalid id");
  const userId = req.auth!.sub;
  const data = req.body as z.infer<typeof updateItemSchema>;

  // Cible : un item par défaut (commun) OU une personnalisation de l'utilisateur.
  const target = await prisma.catalogItem.findFirst({
    where: { id, OR: [{ ownerId: null }, { ownerId: userId }] },
  });
  if (!target) throw notFound(`Catalog item ${id} not found`);

  // Déjà une personnalisation de l'utilisateur -> mise à jour directe.
  if (target.ownerId === userId) {
    const item = await prisma.catalogItem.update({ where: { id: target.id }, data });
    res.json({ item });
    return;
  }

  // Cible = item par défaut -> créer/mettre à jour la copie personnelle ("shadow").
  const existingShadow = await prisma.catalogItem.findFirst({ where: { ownerId: userId, baseId: target.id } });
  if (existingShadow) {
    const item = await prisma.catalogItem.update({ where: { id: existingShadow.id }, data });
    res.json({ item });
    return;
  }
  const { id: _id, ownerId: _own, baseId: _bas, ...rest } = target;
  void _id;
  void _own;
  void _bas;
  const item = await prisma.catalogItem.create({
    data: { ...rest, ...data, ownerId: userId, baseId: target.id },
  });
  res.status(201).json({ item });
});

router.delete("/items/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw notFound("Invalid id");
  // On ne supprime QUE ses propres items : une personnalisation supprimée => l'item
  // revient au défaut ; un item créé de zéro => définitivement retiré (de sa vue).
  const item = await prisma.catalogItem.findFirst({ where: { id, ownerId: req.auth!.sub } });
  if (!item) throw notFound("Catalog item not found");
  await prisma.catalogItem.delete({ where: { id: item.id } });
  res.status(204).end();
});

/** Catégories distinctes (défauts + personnalisations de l'utilisateur) — pour les filtres/nav. */
router.get("/categories", async (req, res) => {
  const rows = await prisma.catalogItem.findMany({
    where: { category: { not: null }, OR: [{ ownerId: null }, { ownerId: req.auth!.sub }] },
    select: { category: true },
    distinct: ["category"],
    orderBy: { displayOrder: "asc" },
  });
  res.json({ categories: rows.map((r) => r.category).filter(Boolean) });
});

export default router;
