import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { notFound } from "../lib/http-error.js";
import { serialiserArticle } from "./cfc.js";

const router = Router();

/**
 * PUBLIC : le rapport complet du dossier, en lecture seule, via son jeton.
 * Aucune authentification.
 *
 * Le lien montrait un rapport à part, chiffré ici même : les réparations
 * seules, sans postes de chantier ni améliorations. Le client qui recevait le
 * PDF et le lien lisait deux totaux pour le même bâtiment. Le lien montre
 * désormais le rapport complet, calculé par le même code que le PDF : le
 * serveur n'envoie que les données, jamais un total.
 *
 * Ce que le rapport complet imprime, le lien le montre aussi (les
 * observations, les taux d'honoraires et de réserve). Ce qui ne s'imprime
 * pas reste ici : propriétaire, jeton, organisation de la visite et
 * coordonnées des locataires, budget interne.
 */
router.get("/:token", async (req, res) => {
  // Un lien de partage circule par email : il ne doit ni etre indexe, ni rester dans un
  // cache partage (proxy). Le robots.txt couvre la page, cet en-tete couvre la reponse.
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  res.setHeader("Cache-Control", "private, no-store");

  const token = req.params.token;
  const project = await prisma.project.findFirst({ where: { shareToken: token } });
  if (!project) throw notFound("Lien de partage invalide ou revoque.");

  const diagnostic = await prisma.diagnostic.findFirst({
    where: { projectId: project.id },
    orderBy: { createdAt: "desc" },
  });
  const items = diagnostic
    ? await prisma.diagnosticItem.findMany({
        where: { diagnosticId: diagnostic.id },
        orderBy: { cfcCode: "asc" },
      })
    : [];

  // Branding : identite de l'entreprise depuis les preferences du proprietaire.
  const owner = await prisma.user.findUnique({ where: { id: project.ownerId } });
  const prefs = (owner?.preferences as Record<string, unknown>) ?? {};
  // L'apparence du dossier passe devant celle du bureau : un rapport peut
  // porter une autre couleur ou un autre logo sans que les autres changent.
  const propre = (project.reportBranding as Record<string, unknown> | null) ?? {};
  const base = (prefs.company as Record<string, unknown> | undefined) ?? undefined;
  const c: Record<string, unknown> | undefined = base || Object.keys(propre).length > 0
    ? {
        ...(base ?? {}),
        ...(propre.name ? { name: propre.name } : {}),
        ...(propre.accentColor ? { accentColor: propre.accentColor } : {}),
        ...(propre.sansLogo ? { logo: null } : propre.logo ? { logo: propre.logo } : {}),
      }
    : undefined;
  const company = c
    ? {
        name: c.name ?? null,
        address: c.address ?? null,
        postalCode: c.postalCode ?? null,
        city: c.city ?? null,
        canton: c.canton ?? null,
        vatNumber: c.vatNumber ?? null,
        // Coordonnees : le lecteur du rapport doit pouvoir joindre le bureau.
        phone: c.phone ?? null,
        email: c.email ?? null,
        web: c.web ?? null,
        logo: c.logo ?? null,
        accentColor: c.accentColor ?? null,
      }
    : null;
  const auteur = (typeof propre.auteur === "string" && propre.auteur.trim())
    || [owner?.firstName, owner?.lastName].filter(Boolean).join(" ")
    || (typeof c?.name === "string" ? c.name : "");

  // Le dossier, sans ce qui ne s'imprime pas dans le rapport.
  const {
    ownerId, shareToken, sharedAt, visitPlan, operationId, totalBudget, ...publicProject
  } = project;
  void ownerId; void shareToken; void sharedAt; void visitPlan; void operationId; void totalBudget;

  // La base du devis : les articles relevés, les postes et les étapes. Pas
  // toute la base de prix du bureau, seulement ce que ce rapport chiffre.
  const idsArticles = [...new Set(items.map((i) => i.articleId).filter((v): v is string => !!v))];
  const [articles, etapes, postes, variants] = await Promise.all([
    prisma.article.findMany({ where: { id: { in: idsArticles } }, include: { etats: true, etapes: true } }),
    prisma.etapeVisite.findMany({ orderBy: { numero: "asc" } }),
    prisma.posteAutomatique.findMany({ orderBy: { cfcCode: "asc" } }),
    prisma.projectVariant.findMany({
      where: { projectId: project.id },
      include: { lines: { orderBy: { createdAt: "asc" } } },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  // Les libellés CFC des positions et des groupes que le devis affiche.
  const codes = new Set<string>();
  for (const code of [...items.map((i) => i.cfcCode), ...postes.map((p) => p.cfcCode)]) {
    const chiffres = code.split(".")[0] ?? "";
    if (chiffres.length >= 3) codes.add(chiffres.slice(0, 3));
    if (chiffres.length >= 2) codes.add(chiffres.slice(0, 2));
  }
  const cfcEntries = await prisma.cfcCatalogEntry.findMany({ where: { code: { in: [...codes] } } });

  // L'ancien catalogue, pour les relevés d'avant la bascule et les variantes.
  const idsCatalogue = [...new Set([
    ...items.map((i) => i.catalogItemId),
    ...variants.flatMap((v) => v.lines.map((l) => l.catalogItemId)),
  ].filter((v): v is number => v != null))];
  const catalogItems = idsCatalogue.length
    ? await prisma.catalogItem.findMany({ where: { id: { in: idsCatalogue } } })
    : [];

  res.json({
    project: publicProject,
    diagnostic: diagnostic
      ? { id: diagnostic.id, visitDate: diagnostic.visitDate, status: diagnostic.status }
      : null,
    items,
    base: {
      articles: articles.map(serialiserArticle),
      etapes,
      postes: postes.map((p) => ({ ...p, prix: Number(p.prix) })),
    },
    cfcEntries,
    catalogItems,
    variants,
    company,
    auteur,
  });
});

export default router;
