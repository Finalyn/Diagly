/**
 * Les règles des notifications, sans base ni réseau.
 *
 * Ce qui décide d'envoyer ou de se taire, et ce qui met les faits en phrases.
 * Séparé de l'envoi pour être vérifiable : c'est ici que se respecte ou se
 * trahit le choix de la personne, et un réglage ignoré ne se voit pas à
 * l'écran, il se voit dans une boîte aux lettres.
 */

export const TYPES_NOTIFICATION = [
  "diagnostic_cree",
  "priorite_urgente",
  "rappel_visite",
  "resume_hebdo",
  "relance_absence",
] as const;

export type TypeNotification = (typeof TYPES_NOTIFICATION)[number];

/** Les réglages de notification d'une personne, tels qu'ils sont stockés. */
export interface ReglagesNotification {
  emailDiagnostic?: boolean;
  calendarReminders?: boolean;
  priorityAlerts?: boolean;
  weeklyDigest?: boolean;
  relances?: boolean;
}

/** Le réglage qui commande chaque type, et sa valeur quand rien n'est choisi. */
export const REGLAGE: Record<TypeNotification, { champ: keyof ReglagesNotification; parDefaut: boolean }> = {
  diagnostic_cree: { champ: "emailDiagnostic", parDefaut: true },
  priorite_urgente: { champ: "priorityAlerts", parDefaut: true },
  rappel_visite: { champ: "calendarReminders", parDefaut: true },
  // Le seul qui ne part pas sans qu'on l'ait demandé : un résumé hebdomadaire
  // non souhaité est le premier courriel qu'on apprend à ignorer.
  resume_hebdo: { champ: "weeklyDigest", parDefaut: false },
  // Activé par défaut : il ne parle que du travail en cours de la personne, et
  // se tait après deux rappels.
  relance_absence: { champ: "relances", parDefaut: true },
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
  const { champ, parDefaut } = REGLAGE[type];
  const voulu = reglages?.[champ] ?? parDefaut;
  return {
    centre: true,
    push: voulu && disponible.push,
    email: voulu && disponible.email,
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
 * dans la matinée, la notification reste unique.
 */
export function numeroDeSemaine(d: Date): string {
  const jour = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const jourDeSemaine = jour.getUTCDay() || 7;
  jour.setUTCDate(jour.getUTCDate() + 4 - jourDeSemaine);
  const premier = new Date(Date.UTC(jour.getUTCFullYear(), 0, 1));
  const numero = Math.ceil(((jour.getTime() - premier.getTime()) / 86_400_000 + 1) / 7);
  return `${jour.getUTCFullYear()}-S${String(numero).padStart(2, "0")}`;
}

/** L'heure du résumé : le lundi matin, entre sept heures et midi. */
export function cestLHeureDuResume(d: Date): boolean {
  return d.getDay() === 1 && d.getHours() >= 7 && d.getHours() < 12;
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
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Zurich", weekday: "short", hour: "numeric", hourCycle: "h23",
  }).formatToParts(d);
  const jour = parts.find((p) => p.type === "weekday")?.value;
  const heure = Number(parts.find((p) => p.type === "hour")?.value);
  return jour !== "Sat" && jour !== "Sun" && heure >= 9 && heure < 11;
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
