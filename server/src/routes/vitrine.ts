import { Router } from "express";
import rateLimit from "express-rate-limit";
import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";
import { sendMail } from "../lib/mail.js";
import { occupationsDeLAgenda } from "../lib/agenda-ics.js";
import { REGLES, bornesDeLaDemo, creneauxLibres } from "../lib/demos.js";
import { dateSuisse, heureSuisse } from "../lib/heure-suisse.js";
import { deplacerAuHub, inscrireAuHub, retirerDuHub } from "../lib/hub-calendrier.js";
import {
  annuleeClient, annuleeHote, confirmationClient, deplaceeClient, deplaceeHote, nouvelleDemoHote, resumeDemo,
  type MailDemo,
} from "../lib/mails-demo.js";

/**
 * Le peu que la page publique a le droit de montrer d'un bâtiment.
 *
 * La démonstration d'adresse doit afficher une vraie valeur, sinon elle ne prouve
 * rien. Mais interroger le registre fédéral depuis le navigateur livrerait la
 * réponse entière dans l'onglet réseau : étages, logements, emprise au sol,
 * surface énergétique. Tout ce qu'il faut pour se passer de nous.
 *
 * L'appel est donc fait ici, et seule l'année de construction ressort. Le reste
 * n'atteint jamais le visiteur.
 */

const IDENTIFIE = "https://api3.geo.admin.ch/rest/services/api/MapServer/identify";

// Le registre ne porte pas toujours l'année exacte ; il donne alors une période, codée.
const PERIODES: Record<number, string> = {
  8011: "avant 1919", 8012: "1919 à 1945", 8013: "1946 à 1960", 8014: "1961 à 1970",
  8015: "1971 à 1980", 8016: "1981 à 1985", 8017: "1986 à 1990", 8018: "1991 à 1995",
  8019: "1996 à 2000", 8020: "2001 à 2005", 8021: "2006 à 2010", 8022: "2011 à 2015",
  8023: "2016 à 2020", 8024: "dès 2021",
};

// Page publique, sans compte : on borne ce qu'une même adresse IP peut demander.
const limiteur = rateLimit({
  windowMs: 60_000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de recherches, réessayez dans un instant." },
});

const router = Router();

const coord = (v: unknown, min: number, max: number): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

/**
 * GET /api/vitrine/annee?lat=&lon=
 * Rend { annee } ou { annee: null } si le point n'est rattaché à aucun bâtiment.
 * Les bornes couvrent la Suisse : inutile de relayer une requête pour Tokyo.
 */
router.get("/annee", limiteur, async (req, res) => {
  const lat = coord(req.query.lat, 45.5, 48);
  const lon = coord(req.query.lon, 5.7, 10.6);
  if (lat === null || lon === null) return res.status(400).json({ error: "Coordonnées hors de Suisse." });

  try {
    const u = new URL(IDENTIFIE);
    u.searchParams.set("geometry", `${lon},${lat}`);
    u.searchParams.set("geometryType", "esriGeometryPoint");
    u.searchParams.set("layers", "all:ch.bfs.gebaeude_wohnungs_register");
    u.searchParams.set("tolerance", "8");
    u.searchParams.set("sr", "4326");
    u.searchParams.set("mapExtent", `${lon - 0.001},${lat - 0.001},${lon + 0.001},${lat + 0.001}`);
    u.searchParams.set("imageDisplay", "600,400,96");

    const controle = new AbortController();
    const minuteur = setTimeout(() => controle.abort(), 6000);
    const reponse = await fetch(u, { signal: controle.signal });
    clearTimeout(minuteur);
    if (!reponse.ok) return res.json({ annee: null });

    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const a = (await reponse.json() as any)?.results?.[0]?.attributes;
    const exacte = typeof a?.gbauj === "number" ? String(a.gbauj) : null;
    const periode = typeof a?.gbaup === "number" ? PERIODES[a.gbaup] ?? null : null;
    // Rien d'autre ne sort d'ici : ni l'emprise, ni les logements, ni les étages.
    return res.json({ annee: exacte ?? periode });
  } catch (e) {
    logger.warn({ err: e }, "vitrine: registre des bâtiments injoignable");
    return res.json({ annee: null });
  }
});

// ===================================================================== démos

/**
 * La prise de démo de diagly.ch.
 *
 * Les créneaux libres se calculent à chaque demande : les règles (lib/demos.ts),
 * moins l'agenda de l'hôte (son flux .ics, lib/agenda-ics.ts), moins les démos
 * déjà réservées. Réserver relit l'agenda à frais, inscrit la démo dans le Hub
 * (lib/hub-calendrier.ts) et envoie les e-mails (lib/mails-demo.ts).
 *
 * Le visiteur gère sa démo par le lien reçu (jetonClient), l'hôte par le sien
 * (jetonHote) : le lien est la seule clé, comme un lien de partage.
 */

const limiteurReservation = rateLimit({
  windowMs: 60 * 60_000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de réservations depuis cette adresse, réessayez plus tard." },
});

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const heure = z.string().regex(/^\d{2}:\d{2}$/);
const jeton = () => randomBytes(24).toString("base64url");
const cleDuCreneau = (d: string, h: string) => `${d}T${h}`;

/** Les démos confirmées à venir, sauf une (celle qu'on déplace). */
async function demosAVenir(sauf?: string) {
  return prisma.demoReservation.findMany({
    where: { statut: "CONFIRMEE", fin: { gt: new Date() }, ...(sauf ? { id: { not: sauf } } : {}) },
    select: { debut: true, fin: true },
  });
}

async function joursLibres(o: { frais?: boolean; sauf?: string } = {}) {
  const [occupations, reservations] = await Promise.all([occupationsDeLAgenda({ frais: o.frais }), demosAVenir(o.sauf)]);
  return creneauxLibres({ occupations: occupations ?? [], reservations }, new Date());
}

function envoyer(m: MailDemo) {
  void sendMail(m).then((ok) => { if (!ok) logger.warn({ to: m.to, subject: m.subject }, "démos : e-mail non envoyé"); });
}

const evenement = (d: { nom: string; bureau: string | null; debut: Date; fin: Date }) => ({
  titre: `Démo Diagly · ${d.nom}${d.bureau ? ` (${d.bureau})` : ""}`,
  date: dateSuisse(d.debut),
  debut: heureSuisse(d.debut),
  fin: heureSuisse(d.fin),
});

/** GET /api/vitrine/demo/creneaux : les jours qui ont un créneau libre, et leurs heures. */
router.get("/demo/creneaux", limiteur, async (_req, res) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    res.json({ duree: REGLES.duree, jours: await joursLibres() });
  } catch {
    res.status(503).json({ error: "Les disponibilités sont momentanément indisponibles." });
  }
});

const reservationSchema = z.object({
  date, heure,
  nom: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  bureau: z.string().trim().max(150).optional(),
  telephone: z.string().trim().max(40).optional(),
  message: z.string().trim().max(2000).optional(),
  /** Le piège à robots : un champ caché que personne ne remplit. */
  site: z.string().max(200).optional(),
});

/** POST /api/vitrine/demo : réserver un créneau. */
router.post("/demo", limiteurReservation, async (req, res) => {
  const lu = reservationSchema.safeParse(req.body);
  if (!lu.success) return res.status(400).json({ error: "Informations incomplètes ou invalides." });
  const b = lu.data;
  // Un robot remplit le champ caché : on fait comme si tout allait bien.
  if (b.site) return res.status(201).json({ ok: true });

  let jours;
  try { jours = await joursLibres({ frais: true }); } catch { return res.status(503).json({ error: "Les disponibilités sont momentanément indisponibles." }); }
  if (!jours.some((j) => j.date === b.date && j.heures.includes(b.heure))) {
    return res.status(409).json({ error: "Ce créneau vient d’être pris. Choisissez-en un autre." });
  }

  const { debut, fin } = bornesDeLaDemo(b.date, b.heure);
  let demo;
  try {
    demo = await prisma.demoReservation.create({
      data: {
        jetonClient: jeton(), jetonHote: jeton(),
        nom: b.nom, email: b.email.toLowerCase(), bureau: b.bureau || null, telephone: b.telephone || null, message: b.message || null,
        debut, fin, creneau: cleDuCreneau(b.date, b.heure),
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return res.status(409).json({ error: "Ce créneau vient d’être pris. Choisissez-en un autre." });
    }
    throw e;
  }

  const hubEventId = await inscrireAuHub(evenement(demo));
  if (hubEventId) await prisma.demoReservation.update({ where: { id: demo.id }, data: { hubEventId } });
  envoyer(confirmationClient(demo));
  envoyer(nouvelleDemoHote(demo, Boolean(hubEventId)));
  logger.info({ demo: demo.id, quand: resumeDemo(demo), hub: Boolean(hubEventId) }, "démos : démo réservée");

  res.status(201).json({ ok: true, jeton: demo.jetonClient, debut: demo.debut, fin: demo.fin, quand: resumeDemo(demo) });
});

/** La démo d'un lien, et qui le tient. */
async function demoDuLien(j: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(j)) return null;
  const demo = await prisma.demoReservation.findFirst({ where: { OR: [{ jetonClient: j }, { jetonHote: j }] } });
  if (!demo) return null;
  return { demo, hote: demo.jetonHote === j };
}

/** GET /api/vitrine/demo/reservation/:jeton : la démo, pour la page qui la gère. */
router.get("/demo/reservation/:jeton", limiteur, async (req, res) => {
  const lien = await demoDuLien(req.params.jeton);
  if (!lien) return res.status(404).json({ error: "Cette réservation est introuvable." });
  const { demo, hote } = lien;
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("Cache-Control", "private, no-store");
  res.json({
    role: hote ? "hote" : "client",
    statut: demo.statut,
    passee: demo.fin.getTime() < Date.now(),
    nom: demo.nom,
    bureau: demo.bureau,
    // L'hôte voit qui il reçoit ; le visiteur, son propre rendez-vous.
    ...(hote ? { email: demo.email, telephone: demo.telephone, message: demo.message } : {}),
    debut: demo.debut,
    fin: demo.fin,
    quand: resumeDemo(demo),
    duree: REGLES.duree,
  });
});

/** GET /api/vitrine/demo/reservation/:jeton/creneaux : les créneaux où la déplacer. */
router.get("/demo/reservation/:jeton/creneaux", limiteur, async (req, res) => {
  const lien = await demoDuLien(req.params.jeton);
  if (!lien || lien.demo.statut !== "CONFIRMEE") return res.status(404).json({ error: "Cette réservation est introuvable." });
  try {
    res.setHeader("Cache-Control", "no-store");
    res.json({ duree: REGLES.duree, jours: await joursLibres({ sauf: lien.demo.id }) });
  } catch {
    res.status(503).json({ error: "Les disponibilités sont momentanément indisponibles." });
  }
});

/** POST /api/vitrine/demo/reservation/:jeton/deplacer : un autre créneau. */
router.post("/demo/reservation/:jeton/deplacer", limiteurReservation, async (req, res) => {
  const lu = z.object({ date, heure }).safeParse(req.body);
  if (!lu.success) return res.status(400).json({ error: "Créneau invalide." });
  const lien = await demoDuLien(req.params.jeton);
  if (!lien || lien.demo.statut !== "CONFIRMEE") return res.status(404).json({ error: "Cette réservation est introuvable." });
  const { demo, hote } = lien;
  if (demo.fin.getTime() < Date.now()) return res.status(409).json({ error: "Cette démo a déjà eu lieu." });

  let jours;
  try { jours = await joursLibres({ frais: true, sauf: demo.id }); } catch { return res.status(503).json({ error: "Les disponibilités sont momentanément indisponibles." }); }
  if (!jours.some((j) => j.date === lu.data.date && j.heures.includes(lu.data.heure))) {
    return res.status(409).json({ error: "Ce créneau n’est plus libre. Choisissez-en un autre." });
  }
  const { debut, fin } = bornesDeLaDemo(lu.data.date, lu.data.heure);
  let maj;
  try {
    maj = await prisma.demoReservation.update({
      where: { id: demo.id },
      data: { debut, fin, creneau: cleDuCreneau(lu.data.date, lu.data.heure), sequence: { increment: 1 }, rappelEnvoyeLe: null },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return res.status(409).json({ error: "Ce créneau vient d’être pris. Choisissez-en un autre." });
    }
    throw e;
  }
  const auHub = maj.hubEventId ? await deplacerAuHub(maj.hubEventId, evenement(maj)) : false;
  envoyer(deplaceeClient(maj, hote));
  envoyer(deplaceeHote(maj, hote, auHub));
  res.json({ ok: true, debut: maj.debut, fin: maj.fin, quand: resumeDemo(maj) });
});

/** POST /api/vitrine/demo/reservation/:jeton/annuler : annuler, avec un motif facultatif. */
router.post("/demo/reservation/:jeton/annuler", limiteurReservation, async (req, res) => {
  const lu = z.object({ motif: z.string().trim().max(500).optional() }).safeParse(req.body ?? {});
  if (!lu.success) return res.status(400).json({ error: "Motif trop long." });
  const lien = await demoDuLien(req.params.jeton);
  if (!lien) return res.status(404).json({ error: "Cette réservation est introuvable." });
  const { demo, hote } = lien;
  if (demo.statut === "ANNULEE") return res.json({ ok: true });
  const maj = await prisma.demoReservation.update({
    where: { id: demo.id },
    data: { statut: "ANNULEE", creneau: null, annuleeLe: new Date(), annuleePar: hote ? "hote" : "client", motif: lu.data.motif || null, sequence: { increment: 1 } },
  });
  const auHub = maj.hubEventId ? await retirerDuHub(maj.hubEventId) : false;
  envoyer(annuleeClient(maj, hote));
  envoyer(annuleeHote(maj, hote, auHub));
  res.json({ ok: true });
});

export default router;
