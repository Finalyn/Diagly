/**
 * L'heure suisse, quel que soit le fuseau du serveur.
 *
 * Le serveur tourne souvent en UTC : lire `getHours()` ou formater avec
 * `toLocaleTimeString` y donne l'heure de Londres, deux heures de moins en été
 * à Zurich. Un rappel annonçait alors « À 07:30 » pour un rendez-vous à 9 h 30,
 * et le résumé du lundi partait en dehors de sa fenêtre. Tout ce qui se lit ou
 * se décide à l'heure passe donc par ici, en Europe/Zurich explicitement.
 */

export const FUSEAU_SUISSE = "Europe/Zurich";

/** Un instant tel qu'on le lit sur une montre à Zurich. */
export interface MomentSuisse {
  annee: number;
  /** 1 à 12. */
  mois: number;
  /** 1 à 31. */
  jour: number;
  /** 0 à 23. */
  heure: number;
  minute: number;
  /** 1 = lundi, 7 = dimanche (norme ISO). */
  jourDeSemaine: number;
}

// Créé une fois : construire un Intl.DateTimeFormat coûte cher, et la passe
// des rappels tourne toutes les minutes.
const lecteur = new Intl.DateTimeFormat("en-GB", {
  timeZone: FUSEAU_SUISSE,
  year: "numeric", month: "numeric", day: "numeric",
  hour: "numeric", minute: "numeric", hourCycle: "h23",
  weekday: "short",
});

const JOURS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

/** Les composantes d'un instant à Zurich, heure d'été comprise. */
export function enSuisse(d: Date): MomentSuisse {
  const parts = lecteur.formatToParts(d);
  const val = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    annee: Number(val("year")),
    mois: Number(val("month")),
    jour: Number(val("day")),
    // Certains moteurs écrivent minuit « 24 » même en h23 : on le ramène à 0.
    heure: Number(val("hour")) % 24,
    minute: Number(val("minute")),
    jourDeSemaine: JOURS[val("weekday")] ?? 0,
  };
}

const deux = (n: number) => String(n).padStart(2, "0");

/** « 09:30 » : l'heure d'un instant à Zurich, telle qu'on l'annonce. */
export function heureSuisse(d: Date): string {
  const m = enSuisse(d);
  return `${deux(m.heure)}:${deux(m.minute)}`;
}
