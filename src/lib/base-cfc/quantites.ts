/**
 * D'où vient la quantité d'un ouvrage.
 *
 * Le classeur donne une base et un coefficient, et la quantité en découle sans
 * que personne n'ait à la saisir. Quatre ouvrages échappent à cette règle et
 * portent la leur, écrite en toutes lettres dans le classeur : les stores
 * comptés par taille de logement, les eaux pluviales par palier de surface
 * bâtie, les sprinklers qui prennent le parking quand on le connaît, et
 * l'isolation intérieure qui déduit les fenêtres de la façade.
 *
 * Une quantité calculée reste une proposition : le diagnostiqueur la corrige
 * sur place, et sa correction ne doit plus jamais être écrasée.
 */

import type { BaseQuantite } from './normaliser'

/**
 * Deux décimales, pas quinze.
 *
 * Un périmètre de 90 m sur 4 étages de 2,7 m donne 972,0000000000001 en
 * virgule flottante. Une surface de bâtiment n'a pas besoin de plus de deux
 * décimales, et ce chiffre finit imprimé dans un devis.
 */
const arrondi = (v: number) => Math.round(v * 100) / 100

/** Ce qu'il faut connaître du bâtiment pour calculer les quantités. */
export interface DonneesBatiment {
  surfacePlancher: number | null
  surfaceBatie: number | null
  surfaceTerrain: number | null
  surfaceFacade: number | null
  surfaceFenetres: number | null
  nombreLogements: number | null
  /** Répartition par typologie : c'est elle qui compte les stores. */
  logementsParTypologie?: RepartitionLogements | null
  nombrePiecesEau: number | null
  nombreEtages: number | null
  nombreCages: number | null
  nombrePortesEntree: number | null
  hauteur: number | null
  /** Facultative : les sprinklers la prennent si elle est renseignée. */
  surfaceParking?: number | null
}

/** Nombre de logements par typologie, en pièces. */
export interface RepartitionLogements {
  p1_5?: number
  p2_5?: number
  p3_5?: number
  p4_5?: number
  p5_5plus?: number
}

/**
 * Surface de façade : périmètre par étages par hauteur d'étage.
 *
 * Proposée ici pour que le formulaire du bâtiment et le calcul des quantités
 * emploient la même formule, plutôt que deux variantes qui divergeront.
 */
export function surfaceFacade(perimetre: number | null, etages: number | null, hauteurEtage: number | null): number | null {
  if (perimetre === null || etages === null || hauteurEtage === null) return null
  return arrondi(perimetre * etages * hauteurEtage)
}

/** Surface de fenêtres : la façade multipliée par le taux de vitrage. */
export function surfaceFenetres(facade: number | null, partVitrage: number | null): number | null {
  if (facade === null || partVitrage === null) return null
  return arrondi(facade * partVitrage)
}

/**
 * Longueur de conduites d'eaux pluviales.
 *
 * Quatre descentes sur un petit bâtiment, huit sur un moyen, dix sur un grand :
 * le classeur fixe les paliers à 400 et 900 m² de surface bâtie.
 */
export function conduitesEauxPluviales(surfaceBatie: number | null, hauteur: number | null): number | null {
  if (surfaceBatie === null || hauteur === null) return null
  const descentes = surfaceBatie < 400 ? 4 : surfaceBatie <= 900 ? 8 : 10
  return descentes * hauteur
}

/**
 * Nombre de stores en toile.
 *
 * Un par logement de deux et demi à trois et demi pièces, deux au-delà. Les
 * studios n'en ont pas : le classeur ne les compte pas.
 */
export function storesEnToile(repartition: RepartitionLogements | null | undefined): number | null {
  if (!repartition) return null
  const petit = (repartition.p2_5 ?? 0) + (repartition.p3_5 ?? 0)
  const grand = (repartition.p4_5 ?? 0) + (repartition.p5_5plus ?? 0)
  return petit + 2 * grand
}

export interface Article {
  baseQuantite: BaseQuantite
  coefficient: number
}

/**
 * La quantité d'un ouvrage, avant partage entre alternatives.
 *
 * null signifie « pas calculable » : la donnée du bâtiment manque, ou la base
 * attend une saisie. Ce n'est jamais zéro, parce que zéro voudrait dire que
 * l'ouvrage existe en quantité nulle, ce qui est une tout autre affirmation.
 */
export function quantiteDeBase(article: Article, b: DonneesBatiment): number | null {
  const brute = valeurDeBase(article.baseQuantite, b)
  if (brute === null) return null
  return arrondi(brute * article.coefficient)
}

function valeurDeBase(base: BaseQuantite, b: DonneesBatiment): number | null {
  switch (base) {
    case 'surface_plancher': return b.surfacePlancher
    case 'surface_batie': return b.surfaceBatie
    case 'surface_terrain': return b.surfaceTerrain
    case 'surface_facade': return b.surfaceFacade
    case 'surface_fenetres': return b.surfaceFenetres
    case 'nombre_logements': return b.nombreLogements
    case 'nombre_pieces_eau': return b.nombrePiecesEau
    case 'nombre_etages': return b.nombreEtages
    case 'nombre_cages': return b.nombreCages
    case 'nombre_portes_entree': return b.nombrePortesEntree
    case 'forfait': return 1

    // Une saisie manuelle n'a pas de valeur calculée, par définition.
    case 'saisie_manuelle': return null

    case 'facade_moins_fenetres':
      if (b.surfaceFacade === null || b.surfaceFenetres === null) return null
      // Une façade entièrement vitrée ne laisse rien à isoler, mais jamais
      // une surface négative.
      return Math.max(0, b.surfaceFacade - b.surfaceFenetres)

    case 'regle_sprinklers':
      return b.surfaceParking ?? b.surfaceBatie

    case 'regle_eaux_pluviales':
      return conduitesEauxPluviales(b.surfaceBatie, b.hauteur)

    case 'regle_stores':
      return storesEnToile(b.logementsParTypologie)
  }
}

/** Vrai quand la quantité doit être saisie à la main. */
export function demandeUneSaisie(article: Article): boolean {
  return article.baseQuantite === 'saisie_manuelle'
}

/**
 * La quantité retenue pour un relevé.
 *
 * Une quantité corrigée sur place l'emporte toujours sur le calcul : le
 * diagnostiqueur a vu le bâtiment, pas la formule.
 */
export function quantiteRetenue(
  article: Article,
  batiment: DonneesBatiment,
  saisie: { quantite: number | null; manuelle: boolean },
): number | null {
  if (saisie.manuelle) return saisie.quantite
  return quantiteDeBase(article, batiment)
}
