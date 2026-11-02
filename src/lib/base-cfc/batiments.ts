/**
 * Un dossier, plusieurs bâtiments.
 *
 * Champrilly 16-18-20 est un seul dossier et trois adresses. La fiche ne savait
 * décrire qu'un bâtiment : on y entrait les dimensions de l'un des trois, et le
 * devis chiffrait un tiers de l'immeuble sans le dire.
 *
 * Chaque bâtiment porte donc ce qui lui est propre — son adresse, sa surface de
 * plancher, son emprise, ses étages, ses logements, sa cage — et le dossier
 * garde ce qui se mesure sur l'ensemble.
 *
 * **Ce qui s'additionne et ce qui ne s'additionne pas.** Une surface de
 * plancher est extensive : trois bâtiments en ont trois fois plus. Un périmètre
 * ne l'est pas dès que les bâtiments se touchent — additionner les périmètres
 * de trois entrées d'une même barre compterait les murs mitoyens, qui ne voient
 * pas le jour et ne reçoivent ni crépi ni échafaudage. Le périmètre et la
 * façade se mesurent donc une fois, sur le bloc, et restent au dossier.
 *
 * La hauteur du bloc est celle de sa partie la plus haute : c'est elle qui fixe
 * l'échafaudage. Pour un bloc en gradins, la façade calculée est donc un
 * majorant — le relevé de façade, s'il est saisi, passe avant.
 */

import type { ApiBatiment } from '../api-types'

/** Un bâtiment utilisable : au moins une adresse ou une dimension. */
export function batimentRenseigne(b: ApiBatiment): boolean {
  return Boolean(
    (b.adresse ?? '').trim()
    || b.floorArea || b.builtArea || b.nbFloors || b.nbApartments || b.nbStaircases,
  )
}

/** Les bâtiments du dossier, les vides écartés. null si la fiche n'en porte pas. */
export function batimentsDuDossier(brut: unknown): ApiBatiment[] | null {
  if (!Array.isArray(brut)) return null
  const liste = (brut as ApiBatiment[]).filter((b) => b && typeof b === 'object' && batimentRenseigne(b))
  return liste.length > 0 ? liste : null
}

/** Somme d'un champ sur les bâtiments ; null si aucun ne le renseigne. */
export function somme(batiments: ApiBatiment[], champ: keyof ApiBatiment): number | null {
  let total = 0
  let trouve = false
  for (const b of batiments) {
    const v = b[champ]
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) { total += v; trouve = true }
  }
  return trouve ? total : null
}

/** Le plus grand d'un champ sur les bâtiments ; null si aucun ne le renseigne. */
export function maximum(batiments: ApiBatiment[], champ: keyof ApiBatiment): number | null {
  let max: number | null = null
  for (const b of batiments) {
    const v = b[champ]
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) max = max === null ? v : Math.max(max, v)
  }
  return max
}

/**
 * La répartition des logements par typologie, cumulée sur les bâtiments.
 * Les clés sont celles de la fiche (« 3.5 », « 4.5 ») : on les additionne telles
 * quelles, la normalisation par tranche se fait plus loin.
 */
export function typologiesCumulees(batiments: ApiBatiment[]): Record<string, number> | null {
  const total: Record<string, number> = {}
  let trouve = false
  for (const b of batiments) {
    for (const [cle, n] of Object.entries(b.apartmentTypes ?? {})) {
      if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) continue
      total[cle] = (total[cle] ?? 0) + n
      trouve = true
    }
  }
  return trouve ? total : null
}

/** Ce que les bâtiments donnent au dossier, une fois cumulés. */
export interface CumulDesBatiments {
  nombre: number
  /** Extensives : elles s'additionnent. */
  floorArea: number | null
  builtArea: number | null
  nbApartments: number | null
  nbStaircases: number | null
  apartmentTypes: Record<string, number> | null
  /** Intensive : la hauteur du bloc est celle de son bâtiment le plus haut. */
  nbFloors: number | null
}

/** Cumule les bâtiments d'un dossier. */
export function cumulerLesBatiments(batiments: ApiBatiment[]): CumulDesBatiments {
  return {
    nombre: batiments.length,
    floorArea: somme(batiments, 'floorArea'),
    builtArea: somme(batiments, 'builtArea'),
    nbApartments: somme(batiments, 'nbApartments'),
    nbStaircases: somme(batiments, 'nbStaircases'),
    apartmentTypes: typologiesCumulees(batiments),
    nbFloors: maximum(batiments, 'nbFloors'),
  }
}

/** Intitulé d'un bâtiment dans la fiche et le rapport. */
export function nomDuBatiment(b: ApiBatiment, rang: number): string {
  const adresse = (b.adresse ?? '').trim()
  return adresse || `Bâtiment ${rang + 1}`
}

/**
 * La fiche d'un dossier, ses dimensions cumulées.
 *
 * Le devis passe par `donneesDuBatiment`, qui cumule déjà. Mais le rapport,
 * l'écran du dossier et les métrés lisent les champs de la fiche directement :
 * sans ce recalage, le rapport annoncerait la surface d'un seul bâtiment pendant
 * que le devis en chiffre trois, et les deux se contrediraient dans le même
 * document.
 *
 * Seules les grandeurs cumulables sont remplacées. Le périmètre, la façade et le
 * terrain ne bougent pas : ils se mesurent sur l'ensemble.
 */
export function ficheCumulee<T extends {
  batiments?: ApiBatiment[] | null
  floorArea?: number | null
  builtArea?: number | null
  nbFloors?: number | null
  nbApartments?: number | null
  nbStaircases?: number | null
  apartmentTypes?: Record<string, number> | null
}>(fiche: T): T {
  const batiments = batimentsDuDossier(fiche.batiments)
  if (!batiments) return fiche
  const c = cumulerLesBatiments(batiments)
  return {
    ...fiche,
    floorArea: c.floorArea ?? fiche.floorArea ?? null,
    builtArea: c.builtArea ?? fiche.builtArea ?? null,
    nbFloors: c.nbFloors ?? fiche.nbFloors ?? null,
    nbApartments: c.nbApartments ?? fiche.nbApartments ?? null,
    nbStaircases: c.nbStaircases ?? fiche.nbStaircases ?? null,
    apartmentTypes: c.apartmentTypes ?? fiche.apartmentTypes ?? null,
  }
}
