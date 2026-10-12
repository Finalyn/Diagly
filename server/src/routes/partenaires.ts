import { Router } from "express";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middlewares/auth.js";
import { validateBody } from "../middlewares/validate.js";
import { badRequest, forbidden, notFound } from "../lib/http-error.js";
import { ownerScopeFor } from "../lib/org-context.js";
import { env } from "../lib/env.js";
import { sendMail, mailConfigured, demandePartenaireEmail } from "../lib/mail.js";
import { fireEvent } from "../lib/webhook.js";

/**
 * L'annuaire des partenaires, et les mises en relation.
 *
 * L'annuaire est tenu par Finalyn : seuls ses administrateurs (rôle produit
 * ADMIN, ou adresse listée dans FINALYN_ADMINS) créent, modifient et
 * publient un partenaire. Tout utilisateur peut le consulter et contacter un
 * partenaire : la demande part par email, le dossier en résumé si on le
 * joint, et les réponses vont directement à l'utilisateur. La demande reste
 * dans Diagly pour en suivre l'issue.
 */
const router = Router();
router.use(requireAuth);

export const METIERS = [
  "ARCHITECTE", "EXPERT_CECB", "INGENIEUR_CIVIL", "INGENIEUR_CVSE", "PHYSICIEN_BATIMENT",
  "CONSEIL_ENERGIE", "DIAGNOSTIC_POLLUANTS", "GEOMETRE", "ENTREPRISE_GENERALE", "AUTRE",
] as const;
const LIBELLE_METIER: Record<string, string> = {
  ARCHITECTE: "Architecte", EXPERT_CECB: "Expert CECB®", INGENIEUR_CIVIL: "Ingénieur civil",
  INGENIEUR_CVSE: "Ingénieur CVSE", PHYSICIEN_BATIMENT: "Physicien du bâtiment", CONSEIL_ENERGIE: "Conseil en énergie",
  DIAGNOSTIC_POLLUANTS: "Diagnostic amiante et polluants", GEOMETRE: "Géomètre", ENTREPRISE_GENERALE: "Entreprise générale", AUTRE: "Autre",
};
const TYPE_BATIMENT: Record<string, string> = {
  LOGEMENT: "Immeuble de logements", VILLA: "Villa", CHALET: "Chalet", SCOLAIRE: "École", BUREAU: "Bureaux",
  ADMINISTRATIF: "Administratif", INDUSTRIEL: "Industriel", HOTEL: "Hôtel", COMMERCIAL: "Commercial", AUTRE: "Autre",
};

async function estAdminFinalyn(userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, role: true } });
  if (!u) return false;
  if (u.role === "ADMIN") return true;
  const liste = env.FINALYN_ADMINS.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return liste.includes(u.email.toLowerCase());
}
async function exigerAdmin(userId: string) {
  if (!(await estAdminFinalyn(userId))) throw forbidden("L'annuaire des prestataires est tenu par Finalyn.");
}

// ---- Lecture ----
router.get("/config", async (req, res) => {
  res.json({ admin: await estAdminFinalyn(req.auth!.sub), mailConfigured: mailConfigured() });
});

router.get("/", async (req, res) => {
  const tous = req.query.tous === "1" && (await estAdminFinalyn(req.auth!.sub));
  const partenaires = await prisma.partner.findMany({
    where: tous ? {} : { actif: true },
    orderBy: [{ verifie: "desc" }, { nom: "asc" }],
    include: tous ? { _count: { select: { demandes: true } } } : undefined,
  });
  res.json({ partenaires });
});

// ---- Gestion (Finalyn) ----
const liste = (max: number) => z.array(z.string().trim().min(1).max(40)).max(max);
const texte = (max: number) => z.string().trim().max(max).nullable().optional();
const lien = z.union([z.string().trim().max(500).regex(/^https?:\/\/\S+$/i, "Un lien commence par https://"), z.literal("")]).nullable().optional();
const partenaireSchema = z.object({
  type: z.enum(["PRO", "OUTIL"]).optional(),
  nom: z.string().trim().min(1).max(150),
  contact: texte(150),
  metiers: z.array(z.enum(METIERS)).max(10).optional(),
  cantons: liste(26).optional(),
  langues: liste(4).optional(),
  description: texte(3000),
  categorie: texte(100),
  offre: texte(255),
  lienOffre: lien,
  email: z.union([z.string().trim().email().max(255), z.literal("")]).nullable().optional(),
  telephone: texte(40),
  siteWeb: texte(255),
  localite: texte(150),
  verifie: z.boolean().optional(),
  certification: texte(255),
  actif: z.boolean().optional(),
});
type Saisie = z.infer<typeof partenaireSchema>;
const vide = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);
const FACULTATIFS = ["contact", "description", "categorie", "offre", "lienOffre", "email", "telephone", "siteWeb", "localite", "certification"] as const;
function normaliser(d: Partial<Saisie>) {
  const n: Record<string, unknown> = { ...d };
  for (const k of FACULTATIFS) if (k in d) n[k] = vide(d[k]);
  if (d.cantons) n.cantons = d.cantons.map((c) => c.toUpperCase());
  return n as Partial<Saisie>;
}

/**
 * Ce qu'une fiche doit tenir pour être publiée.
 *
 * Un professionnel reçoit des demandes : il lui faut un email et un métier.
 * Un outil se rejoint par un lien. Et « Expert CECB® » est un titre : il ne
 * s'affiche que pour un expert que Finalyn a trouvé sur la liste officielle,
 * et la vérification le dit.
 */
function controler(f: Partial<Saisie>) {
  if ((f.type ?? "PRO") === "PRO") {
    if (!f.email) throw badRequest("Un professionnel reçoit les demandes par email : indiquez son adresse.");
    if (!f.metiers?.length) throw badRequest("Indiquez au moins un métier.");
  } else if (!f.lienOffre && !f.siteWeb) {
    throw badRequest("Un outil se rejoint par un lien : indiquez celui de l’offre ou le site web.");
  }
  if (f.metiers?.includes("EXPERT_CECB") && (!f.verifie || !f.certification)) {
    throw badRequest("Un expert CECB® doit figurer sur la liste officielle : cochez la vérification et précisez ce qui a été vérifié.");
  }
}

router.post("/", validateBody(partenaireSchema), async (req, res) => {
  await exigerAdmin(req.auth!.sub);
  const d = normaliser(req.body as Saisie);
  controler(d);
  const partenaire = await prisma.partner.create({
    data: { ...(d as Saisie), metiers: d.metiers ?? [], cantons: d.cantons ?? [], langues: d.langues ?? [], verifie: d.verifie ?? false, actif: d.actif ?? true },
  });
  res.status(201).json({ partenaire });
});

router.put("/:id", validateBody(partenaireSchema.partial()), async (req, res) => {
  await exigerAdmin(req.auth!.sub);
  const existe = await prisma.partner.findUnique({ where: { id: req.params.id } });
  if (!existe) throw notFound("Prestataire introuvable");
  const d = normaliser(req.body as Partial<Saisie>);
  controler({ ...(existe as unknown as Partial<Saisie>), ...d });
  const partenaire = await prisma.partner.update({ where: { id: existe.id }, data: d });
  res.json({ partenaire });
});

// L'offre d'un outil : on compte les ouvertures, pour savoir ce que le
// partenariat apporte, puis l'application ouvre le lien.
router.post("/:id/offre", async (req, res) => {
  const p = await prisma.partner.findFirst({ where: { id: req.params.id, actif: true }, select: { id: true, lienOffre: true, siteWeb: true } });
  if (!p || !(p.lienOffre || p.siteWeb)) throw notFound("Offre introuvable");
  await prisma.partner.update({ where: { id: p.id }, data: { clics: { increment: 1 } } });
  res.json({ url: p.lienOffre ?? p.siteWeb });
});

// Un partenaire qui a déjà reçu des demandes est retiré de l'annuaire, pas
// effacé : l'historique de ceux qui l'ont contacté doit rester lisible.
router.delete("/:id", async (req, res) => {
  await exigerAdmin(req.auth!.sub);
  const p = await prisma.partner.findUnique({ where: { id: req.params.id }, include: { _count: { select: { demandes: true } } } });
  if (!p) throw notFound("Prestataire introuvable");
  if (p._count.demandes > 0) {
    await prisma.partner.update({ where: { id: p.id }, data: { actif: false } });
    return res.json({ retire: true, supprime: false });
  }
  await prisma.partner.delete({ where: { id: p.id } });
  res.json({ retire: true, supprime: true });
});

router.get("/admin/demandes", async (req, res) => {
  await exigerAdmin(req.auth!.sub);
  const demandes = await prisma.partnerRequest.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { partner: { select: { nom: true } } } });
  const users = await prisma.user.findMany({
    where: { id: { in: [...new Set(demandes.map((d) => d.userId))] } },
    select: { id: true, email: true, firstName: true, lastName: true, companyName: true },
  });
  const parId = new Map(users.map((u) => [u.id, u]));
  res.json({
    demandes: demandes.map((d) => {
      const u = parId.get(d.userId);
      return { id: d.id, partenaire: d.partner.nom, objet: d.objet, statut: d.statut, createdAt: d.createdAt,
        auteur: u ? ([u.firstName, u.lastName].filter(Boolean).join(" ") || u.email) : "Compte supprimé", societe: u?.companyName ?? null };
    }),
  });
});

// ---- Mises en relation ----
// Ce que l'utilisateur voit du partenaire dans le suivi de ses demandes.
const SUIVI_PARTENAIRE = { id: true, nom: true, metiers: true, email: true, telephone: true } as const;

const demandeSchema = z.object({
  projectId: z.string().nullable().optional(),
  partagerRapport: z.boolean().optional(),
  objet: z.string().trim().min(1).max(255),
  message: z.string().trim().min(1).max(10_000),
  mode: z.enum(["send", "messagerie"]),
});

router.post("/:id/demandes", validateBody(demandeSchema), async (req, res) => {
  const userId = req.auth!.sub;
  const d = req.body as z.infer<typeof demandeSchema>;
  const partenaire = await prisma.partner.findFirst({ where: { id: req.params.id, actif: true } });
  if (!partenaire) throw notFound("Prestataire introuvable");
  if (partenaire.type !== "PRO" || !partenaire.email) throw badRequest("Cet outil se rejoint par son lien, pas par une demande.");
  const destinataire = partenaire.email;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, firstName: true, lastName: true, companyName: true, phone: true, preferences: true } });
  if (!user) throw badRequest("Compte introuvable");
  const societe = ((user.preferences as { company?: { name?: string } } | null)?.company?.name) || user.companyName || null;
  const auteur = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;

  // Le dossier joint : un résumé, et au besoin le lien du rapport partagé.
  let dossier: string | null = null;
  let lienRapport: string | null = null;
  let projectId: string | null = null;
  let nomProjet: string | null = null;
  if (d.projectId) {
    const p = await prisma.project.findFirst({ where: { id: d.projectId, ...(await ownerScopeFor(userId)) } });
    if (!p) throw notFound("Dossier introuvable");
    projectId = p.id;
    nomProjet = p.name;
    const diag = await prisma.diagnostic.findFirst({ where: { projectId: p.id }, orderBy: { createdAt: "asc" }, select: { id: true } });
    const items = diag ? await prisma.diagnosticItem.findMany({ where: { diagnosticId: diag.id }, select: { priority: true, estimatedCost: true } }) : [];
    const cout = items.reduce((s, i) => s + (i.estimatedCost ? Number(i.estimatedCost) : 0), 0);
    const urgents = items.filter((i) => i.priority === "I").length;
    const adresse = [p.address, [p.postalCode, p.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    dossier = [
      `Bâtiment : ${p.name}`,
      `Adresse : ${adresse} (${p.canton})`,
      `Type : ${TYPE_BATIMENT[p.buildingType] ?? p.buildingType}${p.yearBuilt ? `, construit en ${p.yearBuilt}` : ""}${p.renovationYear ? `, rénové en ${p.renovationYear}` : ""}`,
      p.nbApartments ? `Logements : ${p.nbApartments}` : null,
      p.floorArea ? `Surface de plancher : ${p.floorArea} m²` : null,
      p.egid ? `EGID : ${p.egid}` : null,
      p.energyClassGlobal ? `Classe énergétique (certificat importé) : enveloppe ${p.energyClassEnvelope ?? "?"}, globale ${p.energyClassGlobal}` : null,
      items.length ? `Diagnostic : ${items.length} éléments relevés, dont ${urgents} en priorité I, travaux estimés à ${new Intl.NumberFormat("fr-CH").format(Math.round(cout)).replace(/\s/g, "\u00a0")}\u00a0CHF HT` : null,
    ].filter(Boolean).join("\n");
    if (d.partagerRapport) {
      let token = p.shareToken;
      if (!token) {
        token = randomBytes(24).toString("base64url");
        await prisma.project.update({ where: { id: p.id }, data: { shareToken: token, sharedAt: new Date() } });
        fireEvent(userId, "rapport.genere", { projectId: p.id, egid: p.egid ?? null, kind: "share" });
      }
      lienRapport = `${env.APP_URL.replace(/\/$/, "")}/share/${token}`;
    }
  }

  const mail = demandePartenaireEmail({ partenaire: partenaire.nom, auteur, societe, email: user.email, telephone: user.phone, objet: d.objet, message: d.message, dossier, lienRapport });
  let statut = "MESSAGERIE";
  if (d.mode === "send") {
    const parti = await sendMail({ to: destinataire, subject: mail.subject, text: mail.text, html: mail.html, replyTo: user.email, fromName: societe ? `${auteur} (${societe})` : auteur });
    statut = parti ? "ENVOYEE" : "ECHEC";
  }
  const demande = await prisma.partnerRequest.create({
    data: { partnerId: partenaire.id, userId, projectId, objet: d.objet, message: d.message, dossier, lienRapport, statut },
    include: { partner: { select: SUIVI_PARTENAIRE } },
  });
  // Même forme que la liste : l'application l'affiche aussitôt, et en mode
  // messagerie elle ouvre elle-même le message chez l'utilisateur.
  res.status(201).json({ demande: { ...demande, projet: nomProjet } });
});

router.get("/demandes", async (req, res) => {
  const demandes = await prisma.partnerRequest.findMany({
    where: { userId: req.auth!.sub }, orderBy: { createdAt: "desc" }, take: 100,
    include: { partner: { select: SUIVI_PARTENAIRE } },
  });
  const projets = await prisma.project.findMany({ where: { id: { in: demandes.map((x) => x.projectId).filter((x): x is string => !!x) } }, select: { id: true, name: true } });
  const nom = new Map(projets.map((p) => [p.id, p.name]));
  res.json({ demandes: demandes.map((x) => ({ ...x, projet: x.projectId ? nom.get(x.projectId) ?? null : null })) });
});

// MESSAGERIE : une demande dont l'envoi a échoué, rouverte dans la messagerie de l'utilisateur.
router.patch("/demandes/:id", validateBody(z.object({ statut: z.enum(["EN_COURS", "TERMINEE", "MESSAGERIE"]) })), async (req, res) => {
  const d = await prisma.partnerRequest.findFirst({ where: { id: req.params.id, userId: req.auth!.sub } });
  if (!d) throw notFound("Demande introuvable");
  const demande = await prisma.partnerRequest.update({ where: { id: d.id }, data: { statut: (req.body as { statut: string }).statut } });
  res.json({ demande });
});

export { LIBELLE_METIER };
export default router;
