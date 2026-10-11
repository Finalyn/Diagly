/**
 * Le temps, dit comme on le dit.
 *
 * Une notification datée « 11.10.2026 14:32 » oblige à faire la soustraction.
 * « il y a 20 min » se lit sans calculer, et au-delà d'une semaine la date
 * redevient plus parlante que le compte des jours.
 */

const MINUTE = 60_000
const HEURE = 60 * MINUTE
const JOUR = 24 * HEURE

export function ilYA(iso: string, maintenant: number = Date.now()): string {
  const ecart = maintenant - new Date(iso).getTime()
  // Une horloge en avance sur le serveur ne doit pas écrire « il y a -3 min ».
  if (ecart < 2 * MINUTE) return "à l'instant"
  if (ecart < HEURE) return `il y a ${Math.round(ecart / MINUTE)} min`
  if (ecart < JOUR) return `il y a ${Math.round(ecart / HEURE)} h`
  if (ecart < 2 * JOUR) return 'hier'
  if (ecart < 7 * JOUR) return `il y a ${Math.round(ecart / JOUR)} jours`
  return new Date(iso).toLocaleDateString('fr-CH', { day: 'numeric', month: 'short' })
}
