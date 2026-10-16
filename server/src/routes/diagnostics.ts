import { Router } from "express";
import { z } from "zod";
import { DiagnosticStatus, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { notifierSansAttendre } from "../lib/notifications.js";
import { requireAuth } from "../middlewares/auth.js";
import { validateBody } from "../middlewares/validate.js";
import { notFound } from "../lib/http-error.js";
import { fireEvent } from "../lib/webhook.js";
import { ownerScopeFor } from "../lib/org-context.js";
import { blockViewerWrites } from "../middlewares/org.js";
import { marketCoeff, LEGACY_COST_INDEX, marketInfo } from "../lib/market.js";
import { createItemSchema, updateItemSchema, modificationDuRenvoi, type ModificationReleve } from "../lib/releves.js";

const router = Router();
router.use(requireAuth);
router.use(blockViewerWrites);

// element.modifie + plan_travaux.mis_a_jour (dérivé) — coalescés par diagnostic (anti-rafale).
function fireItemEvents(ownerId: string, diagnosticId: string, egid: string | null) {
  fireEvent(ownerId, "element.modifie", { diagnosticId, egid }, { coalesceDiagnosticId: diagnosticId });
  fireEvent(ownerId, "plan_travaux.mis_a_jour", { diagnosticId, egid }, { coalesceDiagnosticId: diagnosticId });
}

async function loadOwnedDiagnostic(diagId: string, ownerId: string) {
  const diag = await prisma.diagnostic.findFirst({
    where: { id: diagId, project: await ownerScopeFor(ownerId) },
    include: { project: true },
  });
  if (!diag) throw notFound("Diagnostic not found");
  return diag;
}

// Derniers elements diagnostiques, tous projets de l'utilisateur (tableau de bord).
// NB : defini AVANT "/:id" pour ne pas etre capte comme un id.
router.get("/recent-items", async (req, res) => {
  const rows = await prisma.diagnosticItem.findMany({
    where: { diagnostic: { project: await ownerScopeFor(req.auth!.sub) } },
    orderBy: { updatedAt: "desc" },
    take: 8,
    select: {
      id: true, cfcCode: true, cfcLabel: true, state: true, priority: true,
      estimatedCost: true, updatedAt: true,
      diagnostic: { select: { projectId: true, project: { select: { name: true } } } },
    },
  });
  const items = rows.map((it) => ({
    id: it.id, cfcCode: it.cfcCode, cfcLabel: it.cfcLabel, state: it.state, priority: it.priority,
    estimatedCost: it.estimatedCost, updatedAt: it.updatedAt,
    projectId: it.diagnostic.projectId, projectName: it.diagnostic.project.name,
  }));
  res.json({ items });
});

router.get("/:id", async (req, res) => {
  const diag = await loadOwnedDiagnostic(req.params.id, req.auth!.sub);
  const items = await prisma.diagnosticItem.findMany({
    where: { diagnosticId: diag.id },
    orderBy: { createdAt: "asc" },
  });
  res.json({ diagnostic: diag, items });
});

/**
 * Les urgences d'un relevé, signalées une fois, à la clôture.
 *
 * Les signaler au fil de la saisie reviendrait à envoyer trente messages
 * pendant une visite, et l'on apprendrait à les ignorer. À la clôture, le
 * compte est fait et la personne est redescendue de l'immeuble : c'est le
 * moment où elle peut en faire quelque chose.
 */
async function signalerLesUrgences(userId: string, diagnosticId: string) {
  const diag = await prisma.diagnostic.findUnique({
    where: { id: diagnosticId },
    include: { project: { select: { name: true } } },
  });
  if (!diag) return;
  const urgents = await prisma.diagnosticItem.count({
    where: { diagnosticId, priority: "I" },
  });
  if (urgents === 0) return;

  notifierSansAttendre(userId, "priorite_urgente", {
    titre: `${urgents} ouvrage${urgents > 1 ? "s" : ""} en priorité I sur ${diag.project.name}`,
    texte: urgents > 1
      ? "À engager dans les cinq ans. Ouvrez le devis pour voir ce qu'ils représentent."
      : "À engager dans les cinq ans. Ouvrez le devis pour voir ce qu'il représente.",
    url: `/app/diagnostic/${diagnosticId}`,
    cle: `urgences-${diagnosticId}`,
  });
}

const updateDiagnosticSchema = z.object({
  visitDate: z.coerce.date().optional(),
  status: z.nativeEnum(DiagnosticStatus).optional(),
  notes: z.string().max(10_000).optional(),
});

router.put("/:id", validateBody(updateDiagnosticSchema), async (req, res) => {
  const diag = await loadOwnedDiagnostic(req.params.id, req.auth!.sub);
  const data = req.body as z.infer<typeof updateDiagnosticSchema>;
  const diagnostic = await prisma.diagnostic.update({
    where: { id: req.params.id },
    data,
  });
  // Événement de finalisation (transition vers COMPLETED uniquement).
  if (data.status === "COMPLETED" && diag.status !== "COMPLETED") {
    fireEvent(req.auth!.sub, "diagnostic.finalise", { diagnosticId: diag.id, projectId: diag.projectId, egid: diag.project.egid ?? null });
    signalerLesUrgences(req.auth!.sub, diag.id).catch(() => undefined);
  }
  res.json({ diagnostic });
});

router.delete("/:id", async (req, res) => {
  await loadOwnedDiagnostic(req.params.id, req.auth!.sub);
  await prisma.diagnostic.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

// ---------- DiagnosticItems (observations) ----------

// Les schémas d'un relevé vivent dans lib/releves.ts, avec leurs tests.

/**
 * Enregistre la modification d'un relevé. La route de modification et le
 * renvoi d'une création déjà reçue passent tous deux par ici : mêmes champs
 * écrits, mêmes événements.
 */
async function modifierReleve(
  ownerId: string,
  releve: { id: string; diagnosticId: string },
  egid: string | null,
  data: ModificationReleve,
) {
  const item = await prisma.diagnosticItem.update({
    where: { id: releve.id },
    data,
  });
  fireItemEvents(ownerId, releve.diagnosticId, egid);
  return item;
}

router.get("/:id/items", async (req, res) => {
  await loadOwnedDiagnostic(req.params.id, req.auth!.sub);
  const items = await prisma.diagnosticItem.findMany({
    where: { diagnosticId: req.params.id },
    orderBy: { createdAt: "asc" },
  });
  res.json({ items, count: items.length });
});

router.post("/:id/items", validateBody(createItemSchema), async (req, res) => {
  const diag = await loadOwnedDiagnostic(req.params.id, req.auth!.sub);
  const data = req.body as z.infer<typeof createItemSchema>;

  // Renvoi d'une création déjà reçue (la réponse s'était perdue en route) : on
  // n'en crée pas un second, on applique le corps reçu comme une modification
  // (voir modificationDuRenvoi), et l'on rend le relevé à jour. Le même
  // identifiant dans un autre diagnostic n'est pas un renvoi, c'est un conflit.
  const dejaRecu = async () => {
    if (!data.id) return false;
    const existant = await prisma.diagnosticItem.findUnique({ where: { id: data.id } });
    if (!existant) return false;
    if (existant.diagnosticId !== req.params.id) {
      res.status(409).json({ error: "Cet identifiant de relevé est déjà utilisé." });
    } else {
      const item = await modifierReleve(req.auth!.sub, existant, diag.project.egid ?? null, modificationDuRenvoi(data));
      res.status(200).json({ item });
    }
    return true;
  };
  if (await dejaRecu()) return;

  let item;
  try {
    item = await prisma.diagnosticItem.create({
      data: {
        ...(data.id ? { id: data.id } : {}),
        diagnosticId: req.params.id,
        cfcCode: data.cfcCode,
        cfcLabel: data.cfcLabel,
        catalogItemId: data.catalogItemId,
        // L'article de la base v3 et l'etape : ensemble, ils identifient le releve.
        articleId: data.articleId,
        etapeNumero: data.etapeNumero,
        localisation: data.localisation,
        state: data.state,
        priority: data.priority,
        notes: data.notes,
        works: data.works ?? [],
        photos: data.photos ?? [],
        area: data.area,
        sharePct: data.sharePct,
        unites: data.unites,
        quantityManual: data.quantityManual ?? false,
        costManual: data.costManual ?? false,
        unit: data.unit,
        yearInstalled: data.yearInstalled,
        interventionYear: data.interventionYear,
        estimatedCost: data.estimatedCost,
        costIndex: data.costIndex,
        improvement: data.improvement,
        improvementCost: data.improvementCost,
        norms: data.norms,
        normsCost: data.normsCost,
      },
    });
  } catch (e) {
    // Deux envois simultanés du même relevé : le second bute sur la clé, il
    // rend ce que le premier a créé.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && (await dejaRecu())) return;
    throw e;
  }
  fireItemEvents(req.auth!.sub, diag.id, diag.project.egid ?? null);
  res.status(201).json({ item });
});

/**
 * Réindexation d'un dossier au coefficient marché du jour.
 *
 * Les coûts sont figés au moment où ils sont écrits : sans cette passe, un dossier
 * chiffré il y a un an garde les prix d'il y a un an. On n'y recalcule rien depuis
 * le catalogue (dont les prix ont pu bouger pour d'autres raisons) : on applique le
 * seul rapport des indices, ce qui est exactement ce qu'indexer veut dire.
 *
 * Un coût forcé à la main n'est jamais touché. `preview` renvoie l'effet sans écrire.
 */
router.post("/:id/reindex", async (req, res) => {
  const diag = await loadOwnedDiagnostic(req.params.id, req.auth!.sub);
  const preview = req.query.preview === "1" || (req.body as { preview?: boolean } | undefined)?.preview === true;
  const target = marketCoeff();

  const items = await prisma.diagnosticItem.findMany({
    where: { diagnosticId: diag.id },
    select: {
      id: true, costManual: true, costIndex: true,
      estimatedCost: true, improvementCost: true, normsCost: true,
    },
  });

  const n = (v: unknown) => (v == null ? null : Number(v));
  const sum = (i: { estimatedCost: unknown; improvementCost: unknown; normsCost: unknown }) =>
    (n(i.estimatedCost) ?? 0) + (n(i.improvementCost) ?? 0) + (n(i.normsCost) ?? 0);

  let before = 0;
  let after = 0;
  let manual = 0;
  const writes: { id: string; data: Record<string, number | null> }[] = [];

  for (const it of items) {
    const avant = sum(it);
    before += avant;
    if (it.costManual) {
      manual += 1;
      after += avant;
      continue;
    }
    const base = it.costIndex ?? LEGACY_COST_INDEX;
    const factor = target / base;
    if (!Number.isFinite(factor) || factor <= 0 || Math.abs(factor - 1) < 1e-9) {
      after += avant;
      continue;
    }
    const data: Record<string, number | null> = { costIndex: target };
    for (const k of ["estimatedCost", "improvementCost", "normsCost"] as const) {
      const v = n(it[k]);
      if (v != null) data[k] = Math.round(v * factor);
    }
    after += (n(data.estimatedCost) ?? n(it.estimatedCost) ?? 0)
      + (n(data.improvementCost) ?? n(it.improvementCost) ?? 0)
      + (n(data.normsCost) ?? n(it.normsCost) ?? 0);
    writes.push({ id: it.id, data });
  }

  if (!preview && writes.length > 0) {
    await prisma.$transaction(
      writes.map((w) => prisma.diagnosticItem.update({ where: { id: w.id }, data: w.data })),
    );
  }

  res.json({
    preview,
    market: marketInfo(),
    legacyIndex: LEGACY_COST_INDEX,
    items: { total: items.length, updated: writes.length, manual },
    before: Math.round(before),
    after: Math.round(after),
    delta: Math.round(after - before),
  });
});

async function loadOwnedItem(itemId: string, ownerId: string) {
  const item = await prisma.diagnosticItem.findFirst({
    where: { id: itemId, diagnostic: { project: await ownerScopeFor(ownerId) } },
    include: { diagnostic: { include: { project: { select: { egid: true } } } } },
  });
  if (!item) throw notFound("Diagnostic item not found");
  return item;
}

router.get("/items/:itemId", async (req, res) => {
  const item = await loadOwnedItem(req.params.itemId, req.auth!.sub);
  res.json({ item });
});

router.put("/items/:itemId", validateBody(updateItemSchema), async (req, res) => {
  const existing = await loadOwnedItem(req.params.itemId, req.auth!.sub);
  const data = req.body as ModificationReleve;
  const item = await modifierReleve(req.auth!.sub, existing, existing.diagnostic.project.egid ?? null, data);
  res.json({ item });
});

router.delete("/items/:itemId", async (req, res) => {
  const existing = await loadOwnedItem(req.params.itemId, req.auth!.sub);
  await prisma.diagnosticItem.delete({ where: { id: req.params.itemId } });
  fireItemEvents(req.auth!.sub, existing.diagnosticId, existing.diagnostic.project.egid ?? null);
  res.status(204).end();
});

export default router;
