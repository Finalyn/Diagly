import { prisma } from "./prisma.js";
import { notifier } from "./notifications.js";
import {
  bilanDigneDEtreEnvoye, cestLHeureDuResume, cleDuResume, destinatairesDuResume, phraseDuBilan,
  cestLHeureDesRelances, palierDeRelance, phraseDeRelance,
  type BilanDeLaSemaine,
} from "./notifications-regles.js";
import { heureSuisse } from "./heure-suisse.js";
import { logger } from "./logger.js";

/**
 * Ce que l'application signale d'elle-même, sans qu'on ait rien fait.
 *
 * Deux passes. Toutes les minutes, les rappels de visite : une demi-heure
 * avant l'heure dite, parce qu'au-delà on oublie et qu'en deçà on est déjà en
 * retard. Toutes les heures, le résumé du lundi, pour qui l'a demandé.
 *
 * Les deux passent par `notifier`, qui écrit dans la cloche, pousse et envoie
 * le courriel selon les réglages : le planificateur n'a pas à les connaître.
 */

/** Combien de temps avant un rendez-vous on prévient. */
const AVANCE_MINUTES = 30;

const MINUTE = 60_000;

export function startReminderScheduler(): void {
  setInterval(() => { rappelerLesVisites().catch(bruit("rappels")) }, MINUTE);
  setInterval(() => { envoyerLesResumes().catch(bruit("résumé hebdomadaire")) }, 60 * MINUTE);
  setInterval(() => { relancerLesAbsents().catch(bruit("rappels d'absence")) }, 60 * MINUTE);
  // Au démarrage : un serveur relancé un lundi matin ne doit pas sauter le résumé.
  setTimeout(() => { envoyerLesResumes().catch(bruit("résumé hebdomadaire")) }, MINUTE);
  logger.info("Planificateur de notifications démarré");
}

const bruit = (quoi: string) => (e: unknown) =>
  logger.warn({ err: (e as Error).message }, `planificateur : ${quoi}`);

/** Les rendez-vous qui approchent, une fois chacun. */
async function rappelerLesVisites(): Promise<void> {
  const maintenant = new Date();
  const bientot = new Date(maintenant.getTime() + AVANCE_MINUTES * MINUTE);

  const evenements = await prisma.event.findMany({
    where: { reminderSentAt: null, allDay: false, startAt: { gte: maintenant, lte: bientot } },
  });

  for (const ev of evenements) {
    // L'heure de Zurich, pas celle du serveur (souvent en UTC).
    const heure = heureSuisse(ev.startAt);
    await notifier(ev.userId, "rappel_visite", {
      titre: `Dans une demi-heure : ${ev.title}`,
      texte: ev.location ? `${heure}, ${ev.location}` : `À ${heure}`,
      url: "/app/planning",
      cle: `rappel-${ev.id}`,
    });
    // Marqué même si l'envoi a échoué : mieux vaut un rappel manqué qu'une
    // boucle qui le rejoue toutes les minutes.
    await prisma.event.update({ where: { id: ev.id }, data: { reminderSentAt: maintenant } });
  }
}

/**
 * Le résumé du lundi.
 *
 * Envoyé une seule fois par semaine et par personne. La clé de regroupement,
 * qui porte le numéro de la semaine, garde une seule notification dans la
 * cloche ; mais `notifier` renvoie le push et le courriel à chaque appel. La
 * passe tourne toutes les heures de la fenêtre (et au démarrage) : sans
 * vérifier d'abord que la notification de cette clé existe, le même résumé
 * partait cinq ou six fois.
 */
async function envoyerLesResumes(): Promise<void> {
  const maintenant = new Date();
  if (!cestLHeureDuResume(maintenant)) return;

  const depuis = new Date(maintenant.getTime() - 7 * 24 * 60 * MINUTE);
  const cle = cleDuResume(maintenant);

  // Seulement ceux qui l'ont demandé (le réglage par défaut est « non ») et
  // qui ne l'ont pas encore reçu cette semaine : même clé que l'enregistrement.
  const [utilisateurs, dejaEnvoyes] = await Promise.all([
    prisma.user.findMany({ select: { id: true, preferences: true } }),
    prisma.notification.findMany({ where: { cle }, select: { userId: true } }),
  ]);
  const destinataires = destinatairesDuResume(utilisateurs, new Set(dejaEnvoyes.map((n) => n.userId)));

  for (const userId of destinataires) {
    const bilan = await bilanDeLaSemaine(userId, depuis);
    if (!bilanDigneDEtreEnvoye(bilan)) continue;

    await notifier(userId, "resume_hebdo", {
      titre: "Votre semaine sur Diagly",
      texte: phraseDuBilan(bilan),
      url: "/app/dashboard",
      cle,
    });
  }
}

async function bilanDeLaSemaine(userId: string, depuis: Date): Promise<BilanDeLaSemaine> {
  const dossiers = { project: { ownerId: userId } };
  const [diagnostics, releves, visites] = await Promise.all([
    prisma.diagnostic.count({ where: { ...dossiers, createdAt: { gte: depuis } } }),
    prisma.diagnosticItem.count({ where: { diagnostic: dossiers, updatedAt: { gte: depuis } } }),
    prisma.event.count({ where: { userId, startAt: { gte: new Date(), lte: new Date(Date.now() + 7 * 24 * 60 * MINUTE) } } }),
  ]);
  return { diagnostics, releves, visites };
}

/**
 * Les rappels d'absence : une semaine sans venir sur Diagly, puis trois.
 *
 * L'absence se compte depuis la dernière visite (`vuLe`, posée par
 * requireAuth). Un compte qui n'en a pas encore (antérieur à ce suivi) n'est
 * pas relancé : son absence est inconnue, et la compter depuis la création du
 * compte relancerait des gens venus la veille.
 *
 * Un rappel par palier et par absence : la clé de regroupement porte le palier
 * et le jour de la dernière visite. Revenir ouvre une nouvelle absence, avec
 * ses propres rappels.
 */
async function relancerLesAbsents(): Promise<void> {
  const maintenant = new Date();
  if (!cestLHeureDesRelances(maintenant)) return;

  const comptes = await prisma.user.findMany({
    where: { vuLe: { not: null } },
    select: { id: true, vuLe: true, preferences: true },
  });

  for (const u of comptes) {
    const reglages = ((u.preferences as { notifications?: { relances?: boolean } } | null) ?? {}).notifications;
    // Coupé : rien, même pas dans la cloche, où un rappel d'absence n'a pas de sens.
    if (reglages?.relances === false || !u.vuLe) continue;

    const palier = palierDeRelance(Math.floor((maintenant.getTime() - u.vuLe.getTime()) / (24 * 60 * MINUTE)));
    if (!palier) continue;
    const cle = `relance-${palier}-${u.vuLe.toISOString().slice(0, 10)}`;
    const deja = await prisma.notification.findUnique({ where: { userId_cle: { userId: u.id, cle } } });
    if (deja) continue;

    const diag = await prisma.diagnostic.findFirst({
      where: { project: { ownerId: u.id }, status: { not: "COMPLETED" } },
      orderBy: { updatedAt: "desc" },
      select: { id: true, project: { select: { name: true } } },
    });
    const releves = diag ? await prisma.diagnosticItem.count({ where: { diagnosticId: diag.id, state: { not: null } } }) : 0;
    const { titre, texte } = phraseDeRelance(diag ? { nom: diag.project.name, releves } : null);

    await notifier(u.id, "relance_absence", {
      titre,
      texte,
      url: diag ? `/app/diagnostic/${diag.id}` : "/app/projects/new",
      cle,
    });
  }
}
