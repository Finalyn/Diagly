/**
 * Les règles des notifications, sans base ni réseau.
 *
 * Ce qui décide d'envoyer ou de se taire, et ce qui met les faits en phrases.
 * Séparé de l'envoi pour être vérifiable : c'est ici que se respecte ou se
 * trahit le choix de la personne, et un réglage ignoré ne se voit pas à
 * l'écran, il se voit dans une boîte aux lettres.
 *
 * Les heures se lisent à Zurich (heure-suisse.ts), jamais sur l'horloge du
 * serveur, qui peut tourner en UTC.
 */

import { enSuisse } from "./heure-suisse.js";

export const TYPES_NOTIFICATION = [
  "diagnostic_cree",
  "priorite_urgente",
  "rappel_visite",
  "resume_hebdo",
  "relance_absence",
  "analyse_terminee",
] as const;

export type TypeNotification = (typeof TYPES_NOTIFICATION)[number];

/** Les réglages de notification d'une personne, tels qu'ils sont stockés. */
export interface ReglagesNotification {
  emailDiagnostic?: boolean;
  calendarReminders?: boolean;
  priorityAlerts?: boolean;
  weeklyDigest?: boolean;
  relances?: boolean;
  analysesIA?: boolean;
}

/** Le réglage qui commande chaque type, et sa valeur quand rien n'est choisi. */
export const REGLAGE: Record<TypeNotification, { champ: keyof ReglagesNotification; parDefaut: boolean; sansEmail?: boolean }> = {
  diagnostic_cree: { champ: "emailDiagnostic", parDefaut: true },
  priorite_urgente: { champ: "priorityAlerts", parDefaut: true },
  rappel_visite: { champ: "calendarReminders", parDefaut: true },
  // Le seul qui ne part pas sans qu'on l'ait demandé : un résumé hebdomadaire
  // non souhaité est le premier courriel qu'on apprend à ignorer.
  resume_hebdo: { champ: "weeklyDigest", parDefaut: false },
  // Activé par défaut : il ne parle que du travail en cours de la personne, et
  // se tait après deux rappels.
  relance_absence: { champ: "relances", parDefaut: true },
  // La fin d'une analyse par l'IA prévient sur l'appareil, jamais par
  // courriel : on vient de la lancer, on veut le savoir maintenant.
  analyse_terminee: { champ: "analysesIA", parDefaut: true, sansEmail: true },
};

export interface Canaux {
  /** Toujours vrai : la cloche garde la trace de tout. */
  centre: boolean;
  push: boolean;
  email: boolean;
}

/**
 * Les canaux à employer pour un type donné.
 *
 * `disponible` dit ce que le serveur sait faire : sans clés VAPID il n'y a pas
 * de push, sans SMTP il n'y a pas de courriel. Le réglage d'une personne ne
 * peut pas activer un canal que le serveur n'a pas, et le centre reçoit tout
 * quoi qu'il arrive : une notification qu'on a choisi de ne pas recevoir par
 * courriel doit rester consultable, sinon elle n'existe nulle part.
 */
export function canauxVoulus(
  reglages: ReglagesNotification | null | undefined,
  type: TypeNotification,
  disponible: { push: boolean; email: boolean },
): Canaux {
  const { champ, parDefaut, sansEmail } = REGLAGE[type];
  const voulu = reglages?.[champ] ?? parDefaut;
  return {
    centre: true,
    push: voulu && disponible.push,
    email: voulu && disponible.email && !sansEmail,
  };
}

export interface BilanDeLaSemaine {
  diagnostics: number;
  releves: number;
  visites: number;
}

/** Le bilan en une phrase, qui tient dans une notification. */
export function phraseDuBilan(b: BilanDeLaSemaine): string {
  const faits: string[] = [];
  if (b.diagnostics > 0) {
    faits.push(`${b.diagnostics} diagnostic${b.diagnostics > 1 ? "s" : ""} ouvert${b.diagnostics > 1 ? "s" : ""}`);
  }
  if (b.releves > 0) {
    faits.push(`${b.releves} ouvrage${b.releves > 1 ? "s" : ""} relevé${b.releves > 1 ? "s" : ""}`);
  }
  const passe = faits.length > 0 ? faits.join(", ") : "Rien de nouveau la semaine passée";
  const avenir = b.visites > 0
    ? ` ${b.visites} visite${b.visites > 1 ? "s" : ""} cette semaine.`
    : " Aucune visite prévue cette semaine.";
  return `${passe}.${avenir}`;
}

/** Vrai quand un bilan vaut la peine d'être envoyé. */
export function bilanDigneDEtreEnvoye(b: BilanDeLaSemaine): boolean {
  return b.diagnostics > 0 || b.releves > 0 || b.visites > 0;
}

/**
 * Numéro de semaine ISO, pour n'envoyer qu'un résumé par semaine.
 *
 * Il sert de clé de regroupement : la passe du lundi peut tourner vingt fois
 * dans la matinée, la notification reste unique. La semaine est celle du
 * calendrier suisse : entre minuit et deux heures du matin à Zurich, un
 * serveur en UTC est encore la veille, parfois la semaine d'avant.
 */
export function numeroDeSemaine(d: Date): string {
  const ici = enSuisse(d);
  const jour = new Date(Date.UTC(ici.annee, ici.mois - 1, ici.jour));
  jour.setUTCDate(jour.getUTCDate() + 4 - ici.jourDeSemaine);
  const premier = new Date(Date.UTC(jour.getUTCFullYear(), 0, 1));
  const numero = Math.ceil(((jour.getTime() - premier.getTime()) / 86_400_000 + 1) / 7);
  return `${jour.getUTCFullYear()}-S${String(numero).padStart(2, "0")}`;
}

/** L'heure du résumé : le lundi matin, entre sept heures et midi, heure suisse. */
export function cestLHeureDuResume(d: Date): boolean {
  const ici = enSuisse(d);
  return ici.jourDeSemaine === 1 && ici.heure >= 7 && ici.heure < 12;
}

/**
 * La clé du résumé d'une semaine : la même à chaque passe du lundi, pour
 * l'enregistrement dans la cloche comme pour savoir s'il est déjà parti.
 */
export function cleDuResume(d: Date): string {
  return `resume-${numeroDeSemaine(d)}`;
}

/**
 * Ceux à qui le résumé doit partir à cette passe.
 *
 * Seulement ceux qui l'ont demandé, et pas ceux qui l'ont déjà reçu cette
 * semaine : la passe horaire tourne cinq fois dans la matinée, et `notifier`
 * renvoie le push et le courriel à chaque appel, même quand la cloche, elle,
 * ne garde qu'une notification.
 */
export function destinatairesDuResume(
  comptes: readonly { id: string; preferences: unknown }[],
  dejaServis: ReadonlySet<string>,
): string[] {
  return comptes
    .filter((u) => ((u.preferences as { notifications?: ReglagesNotification } | null) ?? {}).notifications?.weeklyDigest === true)
    .filter((u) => !dejaServis.has(u.id))
    .map((u) => u.id);
}

// ------------------------------------------------------- rappels d'absence

/**
 * Les paliers des rappels d'absence, en jours sans venir sur Diagly.
 *
 * Deux, puis plus rien jusqu'au retour : qui ne revient pas après deux rappels
 * n'en veut pas un troisième, et une app qui insiste se fait couper ses
 * notifications, celles qui comptent comprises.
 */
export const PALIERS_RELANCE = [7, 21] as const;

/** Le dernier palier atteint par une absence de tant de jours, ou null. */
export function palierDeRelance(joursAbsent: number): number | null {
  let atteint: number | null = null;
  for (const p of PALIERS_RELANCE) if (joursAbsent >= p) atteint = p;
  return atteint;
}

/**
 * L'heure des rappels : en semaine, entre neuf et onze heures, heure suisse.
 * Le serveur peut tourner en UTC : l'heure se lit à Zurich, pas sur sa montre.
 */
export function cestLHeureDesRelances(d: Date): boolean {
  const ici = enSuisse(d);
  return ici.jourDeSemaine <= 5 && ici.heure >= 9 && ici.heure < 11;
}

/** Le dossier qui attend : le diagnostic pas terminé le plus récemment touché. */
export interface DossierEnAttente {
  nom: string;
  releves: number;
}

/**
 * Le rappel en deux lignes. Il nomme le travail en cours, qui est la seule
 * bonne raison de revenir ; sans dossier ouvert, il propose d'en commencer un.
 */
export function phraseDeRelance(dossier: DossierEnAttente | null): { titre: string; texte: string } {
  if (!dossier) {
    return {
      titre: "Un bâtiment à diagnostiquer ?",
      texte: "Le relevé se fait sur place, pièce par pièce, même sans réseau.",
    };
  }
  return {
    titre: `Le relevé de « ${dossier.nom} » vous attend`,
    texte: dossier.releves > 0
      ? `${dossier.releves} ouvrage${dossier.releves > 1 ? "s" : ""} déjà relevé${dossier.releves > 1 ? "s" : ""}. Reprenez où vous en étiez.`
      : "Rien n'est encore relevé : la visite peut commencer.",
  };
}
