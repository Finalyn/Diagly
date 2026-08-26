import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { notFound } from "../lib/http-error.js";

const router = Router();

// PUBLIC : rapport de diagnostic en lecture seule via jeton. Aucune authentification.
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
  const c = (prefs.company as Record<string, unknown> | undefined) ?? undefined;
  const company = c
    ? {
        name: c.name ?? null,
        address: c.address ?? null,
        postalCode: c.postalCode ?? null,
        city: c.city ?? null,
        canton: c.canton ?? null,
        vatNumber: c.vatNumber ?? null,
        logo: c.logo ?? null,
        accentColor: c.accentColor ?? null,
      }
    : null;

  // Liste blanche stricte des champs projet exposes au public (pas d'ownerId, de jeton,
  // ni de donnees internes comme les % de marge honoraires/reserve, le budget ou les surfaces).
  const publicProject = {
    name: project.name,
    address: project.address,
    postalCode: project.postalCode,
    city: project.city,
    canton: project.canton,
    parcelNumber: project.parcelNumber,
    buildingType: project.buildingType,
    yearBuilt: project.yearBuilt,
    renovationYear: project.renovationYear,
    nbApartments: project.nbApartments,
    nbFloors: project.nbFloors,
  };

  // Couts calcules cote serveur -> on ne renvoie que des MONTANTS, jamais les % de marge.
  const TVA = 0.081;
  const num = (v: unknown) => (v ? Number(v) : 0);
  const ht = items.reduce((s, i) => s + num(i.estimatedCost), 0);
  const honoraires = (ht * (project.honoraryPct ?? 0)) / 100;
  const afterH = ht + honoraires;
  const reserve = (afterH * (project.reservePct ?? 0)) / 100;
  const sousTotal = afterH + reserve;
  const tva = sousTotal * TVA;
  const total = sousTotal + tva;
  const byPriority = (["I", "II", "III"] as const).map((p) => ({
    p,
    total: items.filter((i) => i.priority === p).reduce((s, i) => s + num(i.estimatedCost), 0),
    count: items.filter((i) => i.priority === p).length,
  }));

  // Items : on n'expose PAS les notes internes du diagnostiqueur.
  const publicItems = items.map((it) => ({
    id: it.id,
    cfcCode: it.cfcCode,
    cfcLabel: it.cfcLabel,
    state: it.state,
    priority: it.priority,
    works: it.works,
    estimatedCost: it.estimatedCost,
    photos: it.photos,
  }));

  res.json({
    project: publicProject,
    diagnostic: diagnostic
      ? { visitDate: diagnostic.visitDate, status: diagnostic.status }
      : null,
    items: publicItems,
    costs: { ht, honoraires, reserve, sousTotal, tva, total, byPriority },
    company,
  });
});

export default router;
