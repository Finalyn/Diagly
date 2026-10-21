/** Les créneaux de démo, tels que le serveur les donne (routes/vitrine.ts). */

export interface JourLibre {
  /** « 2026-10-28 ». */
  date: string
  /** Les débuts libres, « 08:00 »… */
  heures: string[]
}

export interface Creneau {
  date: string
  heure: string
}

/** « 9 h 30 » : l'heure comme on l'écrit en Suisse romande. */
export const heureLisible = (h: string) => `${Number(h.slice(0, 2))} h ${h.slice(3)}`

const LONGUE = new Intl.DateTimeFormat('fr-CH', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Zurich' })

/** « Mardi 28 octobre à 10 h 00 ». */
export function creneauLisible(c: Creneau): string {
  const jour = LONGUE.format(new Date(`${c.date}T12:00:00Z`)).replace(/^(\p{L}+),/u, '$1')
  return `${jour.charAt(0).toUpperCase()}${jour.slice(1)} à ${heureLisible(c.heure)}`
}
