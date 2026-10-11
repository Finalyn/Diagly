import { prisma } from "./prisma.js";
import { notifier } from "./notifications.js";
import {
  bilanDigneDEtreEnvoye, cestLHeureDuResume, numeroDeSemaine, phraseDuBilan,
  type BilanDeLaSemaine,
} from "./notifications-regles.js";
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
    const heure = ev.startAt.toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit" });
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
 * Envoyé une seule fois par semaine et par personne, grâce à la clé de
 * regroupement qui porte le numéro de la semaine : même si la passe tourne
 * vingt fois dans la matinée, la notification reste unique.
 */
async function envoyerLesResumes(): Promise<void> {
  const maintenant = new Date();
  if (!cestLHeureDuResume(maintenant)) return;

  const depuis = new Date(maintenant.getTime() - 7 * 24 * 60 * MINUTE);
  const semaine = numeroDeSemaine(maintenant);

  // Seulement ceux qui l'ont demandé : le réglage par défaut est « non », et
  // interroger toute la base chaque lundi pour n'envoyer à personne serait
  // autant de courriels inutiles à préparer.
  const utilisateurs = await prisma.user.findMany({ select: { id: true, preferences: true } });

  for (const u of utilisateurs) {
    const reglages = ((u.preferences as { notifications?: { weeklyDigest?: boolean } } | null) ?? {}).notifications;
    if (reglages?.weeklyDigest !== true) continue;

    const bilan = await bilanDeLaSemaine(u.id, depuis);
    if (!bilanDigneDEtreEnvoye(bilan)) continue;

    await notifier(u.id, "resume_hebdo", {
      titre: "Votre semaine sur Diagly",
      texte: phraseDuBilan(bilan),
      url: "/app/dashboard",
      cle: `resume-${semaine}`,
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
