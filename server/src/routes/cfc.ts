import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middlewares/auth.js";
import { validateQuery, validateBody } from "../middlewares/validate.js";
import { forbidden, notFound } from "../lib/http-error.js";
import { getOrgContext } from "../lib/org-context.js";

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
  surfaceGroup: z.string().max(100).nullable().optional(),
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

// ---------- Base CFC v3 (catalogue commun, lu par le diagnostic et /app/cfc) ----------
//
// Le catalogue d'origine se personnalisait par utilisateur. Celui-ci est commun :
// c'est la base du bureau, tenue par Chloe, et deux diagnostiqueurs doivent
// chiffrer le meme ouvrage au meme prix. Les prix partent donc en nombres et non
// en chaines, parce que les modules de calcul du front travaillent sur des
// nombres et qu'une conversion oubliee donne une concatenation silencieuse.

const nombre = (v: Prisma.Decimal | null) => (v === null ? null : Number(v));

/** Un article avec ses six etats et ses etapes de visite. */
function serialiserArticle(a: {
  etats: { etat: string; travaux: string | null; prix: Prisma.Decimal | null; partPrixMauvais: number | null; unite: string }[];
  etapes: { etapeNumero: number; ordreDansEtape: number }[];
} & Record<string, unknown>) {
  const { etats, etapes, creeLe, modifieLe, ...reste } = a;
  void creeLe;
  void modifieLe;
  return {
    ...reste,
    etats: etats.map((e) => ({ ...e, prix: nombre(e.prix) })),
    etapes: [...etapes].sort((x, y) => x.etapeNumero - y.etapeNumero),
  };
}

/**
 * Tout ce dont un diagnostic a besoin, en un appel.
 *
 * Les articles desactives sont servis aussi : un releve existant peut pointer
 * sur l'un d'eux et doit continuer de s'afficher. C'est le front qui ne les
 * propose plus a la visite, pas le serveur qui les cache.
 */
router.get("/base", async (_req, res) => {
  const [articles, etapes, postes] = await Promise.all([
    prisma.article.findMany({
      include: { etats: true, etapes: true },
      orderBy: { cfcCode: "asc" },
    }),
    prisma.etapeVisite.findMany({ orderBy: { numero: "asc" } }),
    prisma.posteAutomatique.findMany({ orderBy: { cfcCode: "asc" } }),
  ]);
  res.json({
    articles: articles.map(serialiserArticle),
    etapes,
    postes: postes.map((p) => ({ ...p, prix: Number(p.prix) })),
    count: articles.length,
  });
});

/**
 * La nomenclature CFC complete, servie a part.
 *
 * Six cent quarante-sept lignes dont le diagnostic n'a pas besoin : seule
 * l'arborescence de /app/cfc et les libelles du devis les demandent.
 */
router.get("/base/nomenclature", async (_req, res) => {
  const noeuds = await prisma.cfcNomenclature.findMany({ orderBy: { code: "asc" } });
  res.json({ noeuds, count: noeuds.length });
});

// ---------- Ecriture de la base CFC v3 ----------
//
// La base est commune a tous les diagnostiqueurs : une correction de prix
// change le devis de tout le monde, y compris des dossiers deja commences.
// L'ecriture est donc reservee aux responsables de l'organisation, et chaque
// modification laisse une trace nominative dans article_historique.
//
// Il n'y a aujourd'hui qu'un bureau. Le jour ou un second arrive, cette base
// devra lui appartenir en propre, et ce verrou ne suffira plus.

async function exigerResponsable(req: { auth?: { sub: string; role: string } }) {
  if (req.auth?.role === "ADMIN") return;
  const ctx = await getOrgContext(req.auth!.sub);
  if (ctx.orgRole === "OWNER" || ctx.orgRole === "ADMIN") return;
  throw forbidden("La base du bureau se modifie depuis un compte responsable.");
}

const uniteSchema = z.enum(["m2", "ml", "pce", "forfait"]);
const etatSchema = z.enum(["tres_bon", "bon", "moyen", "mauvais", "amelioration", "normes"]);
const baseQuantiteSchema = z.enum([
  "surface_plancher", "surface_batie", "surface_terrain", "surface_facade", "surface_fenetres",
  "facade_moins_fenetres", "nombre_logements", "nombre_pieces_eau", "nombre_etages",
  "nombre_cages", "nombre_portes_entree", "forfait", "saisie_manuelle",
  "regle_stores", "regle_eaux_pluviales", "regle_sprinklers",
]);

const articleSchema = z.object({
  cfcCode: z.string().min(1).max(12),
  nom: z.string().min(1).max(255),
  domaineRapport: z.string().min(1).max(80),
  groupeAlternatives: z.string().max(80).nullable().optional(),
  echafaudage: z.boolean().optional(),
  uniteEntretien: uniteSchema,
  uniteRemplacement: uniteSchema,
  baseQuantite: baseQuantiteSchema,
  indicationQuantite: z.string().max(160).nullable().optional(),
  coefficient: z.number().min(0).max(1000).optional(),
  noteDiagnostiqueur: z.string().max(5000).nullable().optional(),
  articleLieId: z.string().max(8).nullable().optional(),
  actif: z.boolean().optional(),
  /// Les six etats, tels que la fiche les montre.
  etats: z.array(z.object({
    etat: etatSchema,
    travaux: z.string().max(5000).nullable(),
    prix: z.number().min(0).max(10_000_000).nullable(),
    partPrixMauvais: z.number().min(0).max(10).nullable(),
    unite: uniteSchema,
  })).max(6).optional(),
  /// Etapes de visite, en cases a cocher.
  etapes: z.array(z.number().int().min(1).max(20)).max(20).optional(),
});

/** Les champs simples d'un article, pour comparer avant et apres. */
const CHAMPS_SUIVIS = [
  "cfcCode", "nom", "domaineRapport", "groupeAlternatives", "echafaudage", "uniteEntretien",
  "uniteRemplacement", "baseQuantite", "indicationQuantite", "coefficient", "noteDiagnostiqueur",
  "articleLieId", "actif",
] as const;

const enTexte = (v: unknown) => (v === null || v === undefined ? null : String(v));

/**
 * Ce qui a change, champ par champ.
 *
 * On ecrit une ligne d'historique par champ modifie plutot qu'un instantane de
 * l'article : ce qu'on vient relire six mois plus tard, c'est « qui a change ce
 * prix, et quand », pas l'etat complet de la fiche ce jour-la.
 */
function differences(avant: Record<string, unknown>, apres: Record<string, unknown>) {
  const sorties: { champ: string; ancienneValeur: string | null; nouvelleValeur: string | null }[] = [];
  for (const champ of CHAMPS_SUIVIS) {
    if (!(champ in apres)) continue;
    const a = enTexte(avant[champ]);
    const b = enTexte(apres[champ]);
    if (a !== b) sorties.push({ champ, ancienneValeur: a, nouvelleValeur: b });
  }
  return sorties;
}

router.get("/base/articles/:id/historique", async (req, res) => {
  const lignes = await prisma.articleHistorique.findMany({
    where: { articleId: req.params.id },
    orderBy: { date: "desc" },
    take: 200,
  });
  const auteurs = await prisma.user.findMany({
    where: { id: { in: [...new Set(lignes.map((l) => l.auteurId).filter((v): v is string => !!v))] } },
    select: { id: true, firstName: true, lastName: true, email: true },
  });
  const nom = new Map(auteurs.map((u) => [u.id, [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email]));
  res.json({
    lignes: lignes.map((l) => ({ ...l, auteur: l.auteurId ? nom.get(l.auteurId) ?? null : null })),
    count: lignes.length,
  });
});

router.put("/base/articles/:id", validateBody(articleSchema.partial()), async (req, res) => {
  await exigerResponsable(req);
  const id = req.params.id;
  const avant = await prisma.article.findUnique({ where: { id }, include: { etats: true, etapes: true } });
  if (!avant) throw notFound(`Article ${id} introuvable`);
  const data = req.body as z.infer<typeof articleSchema>;

  const { etats, etapes, ...champs } = data;
  const traces = differences(avant as unknown as Record<string, unknown>, champs as Record<string, unknown>);

  if (etats) {
    for (const e of etats) {
      const ancien = avant.etats.find((x) => x.etat === e.etat);
      const avantTexte = ancien ? `${ancien.travaux ?? ""} | ${ancien.prix ?? ""} | ${ancien.unite}` : null;
      const apresTexte = `${e.travaux ?? ""} | ${e.prix ?? ""} | ${e.unite}`;
      if (avantTexte !== apresTexte) {
        traces.push({ champ: `etat.${e.etat}`, ancienneValeur: avantTexte, nouvelleValeur: apresTexte });
      }
    }
  }
  if (etapes) {
    const avantEtapes = avant.etapes.map((e) => e.etapeNumero).sort((a, b) => a - b).join(", ");
    const apresEtapes = [...new Set(etapes)].sort((a, b) => a - b).join(", ");
    if (avantEtapes !== apresEtapes) {
      traces.push({ champ: "etapes", ancienneValeur: avantEtapes || null, nouvelleValeur: apresEtapes || null });
    }
  }

  const article = await prisma.$transaction(async (tx) => {
    await tx.article.update({ where: { id }, data: champs });

    if (etats) {
      for (const e of etats) {
        await tx.articleEtat.upsert({
          where: { articleId_etat: { articleId: id, etat: e.etat } },
          create: { articleId: id, ...e },
          update: { travaux: e.travaux, prix: e.prix, partPrixMauvais: e.partPrixMauvais, unite: e.unite },
        });
      }
    }

    if (etapes) {
      const voulues = [...new Set(etapes)];
      await tx.articleEtape.deleteMany({ where: { articleId: id, etapeNumero: { notIn: voulues } } });
      for (const numero of voulues) {
        const existant = avant.etapes.find((x) => x.etapeNumero === numero);
        if (existant) continue;
        // Range en fin d'etape : l'ordre du classeur suit le code CFC, et le
        // reordonner entierement a chaque ajout deplacerait des lignes que
        // personne n'a touchees.
        const dernier = await tx.articleEtape.aggregate({
          where: { etapeNumero: numero },
          _max: { ordreDansEtape: true },
        });
        await tx.articleEtape.create({
          data: { articleId: id, etapeNumero: numero, ordreDansEtape: (dernier._max.ordreDansEtape ?? 0) + 1 },
        });
      }
    }

    if (traces.length > 0) {
      await tx.articleHistorique.createMany({
        data: traces.map((t) => ({ ...t, articleId: id, auteurId: req.auth!.sub })),
      });
    }

    return tx.article.findUnique({ where: { id }, include: { etats: true, etapes: true } });
  });

  res.json({ article: serialiserArticle(article as never), modifications: traces.length });
});

router.post("/base/articles", validateBody(articleSchema.extend({ id: z.string().min(1).max(8) })), async (req, res) => {
  await exigerResponsable(req);
  const data = req.body as z.infer<typeof articleSchema> & { id: string };
  const { etats, etapes, id, ...champs } = data;

  const article = await prisma.$transaction(async (tx) => {
    await tx.article.create({ data: { id, ...champs } });
    if (etats?.length) await tx.articleEtat.createMany({ data: etats.map((e) => ({ ...e, articleId: id })) });
    if (etapes?.length) {
      for (const numero of [...new Set(etapes)]) {
        const dernier = await tx.articleEtape.aggregate({
          where: { etapeNumero: numero },
          _max: { ordreDansEtape: true },
        });
        await tx.articleEtape.create({
          data: { articleId: id, etapeNumero: numero, ordreDansEtape: (dernier._max.ordreDansEtape ?? 0) + 1 },
        });
      }
    }
    await tx.articleHistorique.create({
      data: { articleId: id, champ: "creation", ancienneValeur: null, nouvelleValeur: champs.nom, auteurId: req.auth!.sub },
    });
    return tx.article.findUnique({ where: { id }, include: { etats: true, etapes: true } });
  });

  res.status(201).json({ article: serialiserArticle(article as never) });
});

const posteSchema = z.object({
  libelle: z.string().min(1).max(255).optional(),
  prix: z.number().min(0).max(10_000_000).optional(),
  unite: uniteSchema.optional(),
  remarque: z.string().max(5000).nullable().optional(),
});

router.put("/base/postes/:code", validateBody(posteSchema), async (req, res) => {
  await exigerResponsable(req);
  const code = req.params.code;
  const existant = await prisma.posteAutomatique.findUnique({ where: { cfcCode: code } });
  if (!existant) throw notFound(`Poste ${code} introuvable`);
  const poste = await prisma.posteAutomatique.update({
    where: { cfcCode: code },
    data: req.body as z.infer<typeof posteSchema>,
  });
  res.json({ poste: { ...poste, prix: Number(poste.prix) } });
});

export default router;

