/**
 * Les démos de Diagly : quand on peut en réserver une, et comment on l'écrit.
 *
 * Les règles : du lundi au vendredi, de 8 h à 18 h à Zurich, une démo de
 * DEMO_DUREE_MIN minutes (30 par défaut) toutes les demi-heures, pas moins de
 * quatre heures à l'avance, et jusqu'à quatre semaines. Un créneau n'est
 * proposé que si l'agenda de l'hôte est libre et qu'aucune autre démo ne le
 * tient.
 *
 * Le calcul est ici, sans base ni réseau, pour être vérifié par des tests.
 */
import { env } from "./env.js";
import { dateSuisse, enSuisse, instantSuisse } from "./heure-suisse.js";
import type { Occupation } from "./agenda-ics.js";

export interface ReglesDesDemos {
  /** Minutes. */
  duree: number;
  /** Minutes entre deux débuts de créneau. */
  pas: number;
  /** « 08:00 » : premier début possible. */
  ouverture: string;
  /** « 18:00 » : la démo doit être finie à cette heure. */
  fermeture: string;
  /** Jours ouverts, 1 = lundi (norme ISO). */
  jours: number[];
  /** Heures minimum entre la réservation et la démo. */
  preavisHeures: number;
  /** Jours proposés à partir d'aujourd'hui. */
  horizonJours: number;
}

export const REGLES: ReglesDesDemos = {
  duree: env.DEMO_DUREE_MIN,
  pas: 30,
  ouverture: "08:00",
  fermeture: "18:00",
  jours: [1, 2, 3, 4, 5],
  preavisHeures: 4,
  horizonJours: 28,
};

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** Le jour suivant d'une date « AAAA-MM-JJ ». */
function plusUnJour(date: string): string {
  return new Date(Date.parse(`${date}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}

export interface JourDeDemo {
  /** « 2026-10-28 ». */
  date: string;
  /** Les débuts libres, « 08:00 »… */
  heures: string[];
}

/** Ce qui occupe déjà un créneau : l'agenda de l'hôte, et les démos réservées. */
export interface Occupe {
  occupations: Occupation[];
  reservations: { debut: Date; fin: Date }[];
}

const chevauche = (a0: number, a1: number, b0: number, b1: number) => a0 < b1 && b0 < a1;

/** Les jours qui ont au moins un créneau libre, et leurs créneaux. */
export function creneauxLibres(occupe: Occupe, maintenant: Date, r: ReglesDesDemos = REGLES): JourDeDemo[] {
  const pris = [
    ...occupe.occupations,
    ...occupe.reservations.map((x) => ({ debut: x.debut.getTime(), fin: x.fin.getTime() })),
  ];
  const auPlusTot = maintenant.getTime() + r.preavisHeures * 3600_000;
  const sortie: JourDeDemo[] = [];
  let date = dateSuisse(maintenant);
  for (let i = 0; i <= r.horizonJours; i++, date = plusUnJour(date)) {
    if (!r.jours.includes(enSuisse(instantSuisse(date, "12:00")).jourDeSemaine)) continue;
    const heures: string[] = [];
    for (let m = minutes(r.ouverture); m + r.duree <= minutes(r.fermeture); m += r.pas) {
      const debut = instantSuisse(date, hhmm(m)).getTime();
      const fin = debut + r.duree * 60_000;
      if (debut < auPlusTot) continue;
      if (pris.some((p) => chevauche(debut, fin, p.debut, p.fin))) continue;
      heures.push(hhmm(m));
    }
    if (heures.length) sortie.push({ date, heures });
  }
  return sortie;
}

/** Le créneau « 2026-10-28 » à « 10:00 » est-il libre ? */
export function estLibre(date: string, heure: string, occupe: Occupe, maintenant: Date, r: ReglesDesDemos = REGLES): boolean {
  return creneauxLibres(occupe, maintenant, r).some((j) => j.date === date && j.heures.includes(heure));
}

/** Le début et la fin d'une démo réservée à « 2026-10-28 » « 10:00 ». */
export function bornesDeLaDemo(date: string, heure: string, r: ReglesDesDemos = REGLES): { debut: Date; fin: Date } {
  const debut = instantSuisse(date, heure);
  return { debut, fin: new Date(debut.getTime() + r.duree * 60_000) };
}

// ------------------------------------------------------------------ écriture

const LONGUE = new Intl.DateTimeFormat("fr-CH", { timeZone: "Europe/Zurich", weekday: "long", day: "numeric", month: "long", year: "numeric" });

/** « mardi 28 octobre 2026 », sans la virgule que le format suisse met après le jour. */
export function dateEnLettres(d: Date): string {
  return LONGUE.format(d).replace(/^(\p{L}+),/u, "$1");
}

/** « 10 h 00 », l'heure à Zurich, telle qu'on l'écrit en Suisse romande. */
export function heureEnLettres(d: Date): string {
  const m = enSuisse(d);
  return `${m.heure} h ${String(m.minute).padStart(2, "0")}`;
}

/** « mardi 28 octobre 2026, de 10 h 00 à 10 h 30 ». */
export function quandEnLettres(debut: Date, fin: Date): string {
  return `${dateEnLettres(debut)}, de ${heureEnLettres(debut)} à ${heureEnLettres(fin)}`;
}
