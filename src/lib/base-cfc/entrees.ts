/**
 * Une entrée qui ne ressemble pas aux autres.
 *
 * Champrilly 16-18-20 est un seul bâtiment et trois entrées : on le relève une
 * fois, et chaque ouvrage y reçoit un seul état. Mais l'ascenseur du 18 a été
 * refait l'an dernier, et la cage du 20 repeinte : un état unique mentirait sur
 * ces deux-là.
 *
 * Une exception est donc un second relevé du même ouvrage, rattaché à une
 * entrée. Il porte son état, ses photos et ses travaux, et reprend la part de
 * quantité de son entrée ; le relevé général garde celle des autres. Le devis
 * additionne les deux sans rien compter deux fois.
 *
 * **Ce qui peut avoir une exception.** Seuls les ouvrages dont la quantité se
 * partage entre les entrées : ceux comptés par cage, par étage de cage, par
 * porte d'entrée, par logement ou à la surface de plancher. La façade, la
 * toiture, la structure et les locaux techniques se mesurent sur l'ensemble du
 * bâtiment, et une chaufferie commune n'appartient à aucune entrée.
 */

import type { ApiBatiment } from '../api-types'
import { batimentsDuDossier, etagesDeLEntree, nomDuBatiment } from './batiments'
import type { BaseQuantite } from './normaliser'

const champ = (c: keyof ApiBatiment) => (e: ApiBatiment): number | null => {
  const v = e[c]
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null
}

/** Ce qui, dans une entrée, mesure sa part d'une base de quantité. */
const MESURE_DE_LA_BASE: Partial<Record<BaseQuantite, (e: ApiBatiment) => number | null>> = {
  surface_plancher: champ('floorArea'),
  nombre_logements: champ('nbApartments'),
  // Deux pièces d'eau par logement : la part est celle des logements.
  nombre_pieces_eau: champ('nbApartments'),
  nombre_cages: champ('nbStaircases'),
  // Une porte d'entrée par cage.
  nombre_portes_entree: champ('nbStaircases'),
  // La main courante : un palier par étage, dans chaque cage.
  nombre_etages: etagesDeLEntree,
}

/** Vrai quand un ouvrage de cette base se partage entre les entrées. */
export function sePartageParEntree(base: BaseQuantite | null | undefined): boolean {
  return base != null && base in MESURE_DE_LA_BASE
}

/** Les entrées du dossier, quand il en compte au moins deux. */
export function entreesDuDossier(brut: unknown): ApiBatiment[] | null {
  const liste = batimentsDuDossier(brut)
  return liste && liste.length >= 2 ? liste : null
}

/** Intitulé d'une entrée, par son identifiant. Une entrée retirée du dossier le dit. */
export function nomDeLEntree(entrees: ApiBatiment[] | null | undefined, entreeId: string): string {
  const rang = entrees?.findIndex((e) => e.id === entreeId) ?? -1
  return rang < 0 ? 'entrée retirée du dossier' : nomDuBatiment(entrees![rang], rang)
}

/**
 * La part de quantité d'une entrée, entre 0 et 1.
 *
 * Elle se mesure par ce que la base compte : les logements pour un ouvrage
 * compté par logement, les cages pour un ouvrage compté par cage. Quand une
 * entrée n'a pas cette mesure, les entrées comptent à parts égales : un
 * chiffre approché vaut mieux qu'une exception qui ne retire rien au général.
 *
 * Une entrée inconnue (retirée de la fiche depuis) ne prend rien.
 */
export function partDeLEntree(
  base: BaseQuantite,
  entrees: ApiBatiment[],
  entreeId: string,
): number {
  const mesure = MESURE_DE_LA_BASE[base]
  const entree = entrees.find((e) => e.id === entreeId)
  if (!mesure || !entree) return 0
  const mesures = entrees.map(mesure)
  if (mesures.some((m) => m === null)) return 1 / entrees.length
  const total = (mesures as number[]).reduce((s, m) => s + m, 0)
  return mesure(entree)! / total
}

/**
 * Ce qui revient à un relevé, entre 0 et 1, quand l'ouvrage a des exceptions.
 *
 * Une exception prend la part de son entrée ; le relevé général prend ce que
 * les exceptions laissent. Sans exception, ou pour un ouvrage qui ne se
 * partage pas, le relevé prend tout.
 */
export function partDuReleve(
  releve: { entreeId?: string | null },
  base: BaseQuantite,
  entrees: ApiBatiment[] | null,
  exceptions: { entreeId?: string | null }[],
): number {
  if (!entrees || !sePartageParEntree(base)) return 1
  if (releve.entreeId) return partDeLEntree(base, entrees, releve.entreeId)
  const prises = new Set(exceptions.map((e) => e.entreeId).filter((v): v is string => !!v))
  let reste = 1
  for (const id of prises) reste -= partDeLEntree(base, entrees, id)
  // Toutes les entrées en exception : le général ne couvre plus rien.
  return Math.max(0, reste)
}
