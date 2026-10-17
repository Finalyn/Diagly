import { Router } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { mkdirSync, existsSync, unlink } from "node:fs";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { feuillesSchema, nombreAValider, remplacerPropositions } from "../lib/feuilles-plans.js";
import { requireAuth } from "../middlewares/auth.js";
import { aiLimiter, uploadLimiter } from "../middlewares/rate-limit.js";
import { validateQuery, validateBody } from "../middlewares/validate.js";
import { notFound, badRequest } from "../lib/http-error.js";
import { ownerScopeFor } from "../lib/org-context.js";
import { blockViewerWrites } from "../middlewares/org.js";
import { signUploadPath } from "../lib/file-token.js";
import { logger } from "../lib/logger.js";
import { env } from "../lib/env.js";
import { TachesDeFond } from "../lib/taches-de-fond.js";
import { demanderAuModeleDesPlans } from "../lib/modele-plans.js";
import { MAX_IMAGE_ENCODEE, MAX_REQUETE_ENCODEE } from "../lib/lecture-plans.js";
import {
  consigneAnalyse, dimensionsImage, presentationDePage, tientDansLeModele, validerAnalyse,
  type AnalysePlan, type PageEnvoyee,
} from "../lib/analyse-plans.js";

const router = Router();
router.use(requireAuth);
router.use(blockViewerWrites);

export const UPLOAD_DIR = join(process.cwd(), "uploads");
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

// L'extension du fichier stocke est DERIVEE du type MIME valide (jamais du nom fourni par
// le client) : empeche d'ecrire un fichier <uuid>.html servi ensuite en text/html (XSS stocke).
const EXT_BY_MIME: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};
const ALLOWED = Object.keys(EXT_BY_MIME);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => cb(null, `${randomUUID()}${EXT_BY_MIME[file.mimetype] ?? ""}`),
  }),
  limits: { fileSize: 30 * 1024 * 1024 }, // 30 Mo
  fileFilter: (_req, file, cb) => cb(null, ALLOWED.includes(file.mimetype)),
});

async function assertProjectOwned(projectId: string, ownerId: string) {
  const p = await prisma.project.findFirst({ where: { id: projectId, ...(await ownerScopeFor(ownerId)) } });
  if (!p) throw notFound("Project not found");
}

/** Ajoute l'URL signee du fichier : c'est le seul moyen d'y acceder depuis le navigateur. */
const withFileUrl = <T extends { fileName: string }>(plan: T) => ({ ...plan, fileUrl: signUploadPath(plan.fileName) });

const listQuery = z.object({ projectId: z.string().min(1) });

router.get("/", validateQuery(listQuery), async (req, res) => {
  const { projectId } = req.query as unknown as z.infer<typeof listQuery>;
  await assertProjectOwned(projectId, req.auth!.sub);
  const plans = await prisma.plan.findMany({ where: { projectId }, orderBy: { createdAt: "desc" } });
  res.json({ plans: plans.map(withFileUrl), count: plans.length });
});

/**
 * Les métrés du compte : un par dossier qui a des plans.
 *
 * La page Métrés de l'accueil les liste avec leur nombre de feuilles, l'état
 * de leur analyse et ce qui attend d'être validé. Demander les plans dossier
 * par dossier ferait une requête par bâtiment ; ici, une seule, et sans les
 * annotations elles-mêmes, qui pèsent lourd et ne servent qu'à l'éditeur.
 */
router.get("/metres", async (req, res) => {
  const plans = await prisma.plan.findMany({
    where: { project: await ownerScopeFor(req.auth!.sub) },
    orderBy: { createdAt: "asc" },
    include: { project: { select: { id: true, name: true, address: true, city: true, updatedAt: true } } },
  });
  type Metre = {
    projectId: string; nom: string; adresse: string; ville: string; misAJour: string;
    plans: (Omit<typeof plans[number], "annotations" | "project"> & { fileUrl: string; annotations: []; aValider: number })[];
  };
  const parDossier = new Map<string, Metre>();
  for (const { annotations, project, ...p } of plans) {
    let m = parDossier.get(project.id);
    if (!m) {
      m = { projectId: project.id, nom: project.name, adresse: project.address, ville: project.city, misAJour: project.updatedAt.toISOString(), plans: [] };
      parDossier.set(project.id, m);
    }
    m.plans.push({ ...withFileUrl(p), annotations: [], aValider: nombreAValider(annotations) });
    const touche = p.updatedAt.toISOString();
    if (touche > m.misAJour) m.misAJour = touche;
  }
  const metres = [...parDossier.values()].sort((a, b) => b.misAJour.localeCompare(a.misAJour));
  res.json({ metres, count: metres.length });
});

router.post("/", uploadLimiter, upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) throw badRequest("Aucun fichier valide (PDF, PNG, JPG ou WEBP, 30 Mo max)");
  const projectId = String(req.body.projectId ?? "");
  if (!projectId) throw badRequest("projectId requis");
  await assertProjectOwned(projectId, req.auth!.sub);
  const name = String(req.body.name ?? "").trim() || file.originalname;
  const plan = await prisma.plan.create({
    data: { projectId, name, fileName: file.filename, mimeType: file.mimetype, size: file.size },
  });
  res.status(201).json({ plan: withFileUrl(plan) });
});

const updatePlanSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  scalePxPerM: z.number().positive().nullable().optional(),
  annotations: z.array(z.unknown()).optional(),
  /** Les feuilles du document, vues par l'outil Métrés (lib/feuilles-plans.ts). null les oublie. */
  feuilles: feuillesSchema.nullable().optional(),
  /**
   * Les propositions de l'IA pour quelques pages : elles remplacent celles qui
   * attendaient encore sur ces pages, sans toucher au reste. L'outil Métrés
   * analyse le jeu par lots en tâche de fond et range chaque lot dès qu'il
   * est prêt, pendant qu'on travaille peut-être sur une autre feuille : il ne
   * doit pas avoir à réécrire toutes les annotations du plan pour autant.
   */
  propositions: z.object({
    pages: z.array(z.number().int().min(1).max(5000)).min(1).max(500),
    annotations: z.array(z.unknown()).max(5000),
  }).optional(),
});

router.put("/:id", validateBody(updatePlanSchema), async (req, res) => {
  const plan = await prisma.plan.findFirst({
    where: { id: req.params.id, project: await ownerScopeFor(req.auth!.sub) },
  });
  if (!plan) throw notFound("Plan not found");
  const data = req.body as z.infer<typeof updatePlanSchema>;
  // Les propositions se posent sur les annotations envoyées dans la même
  // requête, ou à défaut sur celles qui sont en base.
  let annotations = data.annotations as unknown[] | undefined;
  if (data.propositions) {
    annotations = remplacerPropositions(annotations ?? plan.annotations, data.propositions.pages, data.propositions.annotations);
  }
  const updated = await prisma.plan.update({
    where: { id: plan.id },
    data: {
      name: data.name,
      scalePxPerM: data.scalePxPerM,
      annotations: annotations as object[] | undefined,
      ...(data.feuilles === undefined ? {} : { feuilles: data.feuilles === null ? Prisma.JsonNull : (data.feuilles as Prisma.InputJsonValue) }),
    },
  });
  res.json({ plan: withFileUrl(updated) });
});

router.delete("/:id", async (req, res) => {
  const plan = await prisma.plan.findFirst({
    where: { id: req.params.id, project: await ownerScopeFor(req.auth!.sub) },
  });
  if (!plan) throw notFound("Plan not found");
  await prisma.plan.delete({ where: { id: plan.id } });
  unlink(join(UPLOAD_DIR, plan.fileName), () => undefined); // best-effort
  res.status(204).end();
});

// ---------------------------------------------------------------- analyse par l'IA

/**
 * L'analyse d'un plan pour le métré : échelle, cote de contrôle, zones à valider.
 *
 * Le navigateur envoie les pages déjà rendues en image (il a le PDF sous la
 * main et sait à quelle résolution le modèle lit une image sans la réduire),
 * la taille de chaque feuille en points, et la liste des ouvrages du relevé
 * auxquels rattacher les zones. Le serveur vérifie les images, demande
 * l'analyse au modèle des plans (lib/modele-plans.ts) en tâche de fond et
 * valide la réponse (lib/analyse-plans.ts). Rien n'est enregistré ici : les
 * zones proposées partent vers l'éditeur, qui les pose « à valider ».
 *
 * Même déroulé que la lecture des plans au démarrage d'un dossier : un numéro
 * tout de suite, puis GET jusqu'à ce que l'analyse soit prête, DELETE pour
 * l'arrêter. Le quota IA ne compte que les demandes, pas le suivi.
 */
const MAX_PAGES_ANALYSE = 8;
const ANALYSES = new TachesDeFond<{ configured: true; tronque: boolean; refus: boolean; analyse: AnalysePlan | null }>({
  introuvable: "Analyse introuvable : elle a peut-être expiré. Relancez-la.",
  dejaEnCours: "Une analyse est déjà en cours. Attendez qu'elle se termine.",
  echec: "L'analyse du plan a échoué. Réessayez.",
  journal: "analyse de plan",
});
const MESSAGES_ANALYSE = {
  reseau: "Analyse momentanément indisponible (réseau).",
  indisponible: "Analyse momentanément indisponible.",
  tropLourd: "Ces pages sont trop lourdes pour être analysées en une fois. Analysez-les une à une.",
  interrompue: "L'analyse a été interrompue. Réessayez.",
  journal: "analyse de plan",
};

const uploadPages = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_ENCODEE, files: MAX_PAGES_ANALYSE, fieldSize: 2 * 1024 * 1024 },
});
const recevoirPages: import("express").RequestHandler = (req, res, next) =>
  uploadPages.array("pages", MAX_PAGES_ANALYSE)(req, res, (err: unknown) => {
    const code = err ? (err as { code?: string }).code : undefined;
    if (code === "LIMIT_FILE_SIZE") return next(badRequest("Une page rendue est trop lourde pour être analysée."));
    if (code === "LIMIT_FILE_COUNT" || code === "LIMIT_UNEXPECTED_FILE") return next(badRequest(`${MAX_PAGES_ANALYSE} pages au plus par analyse.`));
    return next(err as Error | undefined);
  });

const donneesAnalyse = z.object({
  pages: z.array(z.object({
    numero: z.number().int().min(1).max(10_000),
    largeurPt: z.number().positive().max(100_000).nullable(),
    hauteurPt: z.number().positive().max(100_000).nullable(),
  })).min(1).max(MAX_PAGES_ANALYSE),
  ouvrages: z.array(z.object({
    id: z.string().min(1).max(64),
    cfcCode: z.string().max(40).nullable(),
    libelle: z.string().max(300),
    unite: z.string().max(40).nullable(),
  })).max(600).default([]),
});

router.post("/:id/analyse", aiLimiter, recevoirPages, async (req, res) => {
  if (!env.ANTHROPIC_API_KEY) { res.json({ configured: false }); return; }
  const plan = await prisma.plan.findFirst({
    where: { id: req.params.id, project: await ownerScopeFor(req.auth!.sub) },
  });
  if (!plan) throw notFound("Plan not found");

  let donnees: z.infer<typeof donneesAnalyse>;
  try {
    donnees = donneesAnalyse.parse(JSON.parse(String(req.body.donnees ?? "")));
  } catch {
    throw badRequest("Description des pages illisible.");
  }
  const fichiers = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (fichiers.length !== donnees.pages.length) throw badRequest("Chaque page décrite doit avoir son image.");

  // Les dimensions viennent du fichier lui-même : ce sont elles que le modèle
  // verra, et contre elles que ses points seront validés.
  const pages: PageEnvoyee[] = [];
  const contenu: unknown[] = [];
  let total = 0;
  for (const [i, f] of fichiers.entries()) {
    const dims = dimensionsImage(f.buffer);
    if (!dims) throw badRequest("Les pages doivent arriver en PNG ou en JPEG.");
    if (!tientDansLeModele(dims.largeur, dims.hauteur)) {
      throw badRequest("Page rendue trop grande : le modèle la réduirait, et ses points ne tomberaient plus juste.");
    }
    const data = f.buffer.toString("base64");
    if (data.length > MAX_IMAGE_ENCODEE) throw badRequest("Une page rendue est trop lourde pour être analysée.");
    total += data.length;
    const d = donnees.pages[i];
    const page: PageEnvoyee = { numero: d.numero, largeurImage: dims.largeur, hauteurImage: dims.hauteur, largeurPt: d.largeurPt, hauteurPt: d.hauteurPt };
    pages.push(page);
    contenu.push({ type: "text", text: presentationDePage(page) });
    contenu.push({ type: "image", source: { type: "base64", media_type: dims.type, data } });
  }
  if (total > MAX_REQUETE_ENCODEE) throw badRequest(MESSAGES_ANALYSE.tropLourd);
  if (new Set(pages.map((p) => p.numero)).size !== pages.length) throw badRequest("Une même page est envoyée deux fois.");
  contenu.push({ type: "text", text: consigneAnalyse(pages, donnees.ouvrages) });

  const releveIds = donnees.ouvrages.map((o) => o.id);
  const id = ANALYSES.lancer(req.auth!.sub, async (signal) => {
    // Les repères des éléments comptés (jusqu'à quatre cents points) allongent
    // la réponse : la marge suit, le modèle des plans en admet bien davantage.
    const r = await demanderAuModeleDesPlans(contenu, { maxTokens: 64_000, signal, messages: MESSAGES_ANALYSE });
    const analyse = r.json ? validerAnalyse(r.json, pages, releveIds) : null;
    logger.info({
      plan: plan.id, pages: pages.length, zones: analyse?.zones.length ?? null, ecartees: analyse?.ecartees.length ?? null,
      reperes: analyse?.elements.length ?? null, comptages: analyse?.comptages.length ?? null,
      tronque: r.tronque, refus: r.refus,
    }, "analyse de plan validée");
    return { configured: true as const, tronque: r.tronque, refus: r.refus, analyse };
  }, plan.id);
  res.status(202).json({ configured: true, enCours: id });
});

// La tâche de ce plan que le compte a lancée et pas encore réclamée : l'outil
// Métrés la retrouve ainsi quand l'onglet s'est fermé avant d'en garder le numéro.
router.get("/:id/analyse", (req, res) => {
  res.json({ enCours: ANALYSES.derniere(req.auth!.sub, req.params.id) });
});

router.get("/:id/analyse/:tache", (req, res) => {
  const suivi = ANALYSES.suivre(req.params.tache, req.auth!.sub, req.params.id);
  if (suivi.etat === "en_cours") { res.json({ etat: "en_cours" }); return; }
  res.json({ etat: "prete", ...suivi.resultat });
});

// Fermer l'éditeur ou arrêter l'analyse l'arrête aussi côté serveur : personne n'en lira le résultat.
router.delete("/:id/analyse/:tache", (req, res) => {
  ANALYSES.arreter(req.params.tache, req.auth!.sub);
  res.status(204).end();
});

export default router;
