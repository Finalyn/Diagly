/**
 * Le prix d'un ouvrage selon son état.
 *
 * Cinq états sur six donnent simplement le prix de leur ligne. L'état moyen
 * est le seul à se calculer, et c'est la règle qui demande le plus de soin :
 * une réfection partielle coûte une part fixe plus une fraction du coût de
 * remplacement, parce qu'on remplace vraiment une partie de l'ouvrage. Trente
 * pour cent des pierres d'une façade, par exemple.
 *
 * La part a une valeur de catalogue et le diagnostiqueur peut l'ajuster sur
 * place : c'est lui qui voit combien de pierres sont à changer.
 */

import type { EtatArticle } from './normaliser'

export interface PrixDeLEtat {
  /** Prix de la ligne. Pour l'état moyen, c'est la part fixe. */
  prix: number | null
  /** État moyen seulement : fraction du prix Mauvais qui s'ajoute. */
  partPrixMauvais?: number | null
}

export interface ContexteMoyen {
  /** Prix de l'état Mauvais du même article, sur lequel la part se calcule. */
  prixMauvais: number | null
  /** Part retenue par le diagnostiqueur. Absente, celle du catalogue vaut. */
  partChoisie?: number | null
}

/**
 * Le prix unitaire d'un état, en CHF HT.
 *
 * null signifie « aucun travail chiffré », ce qui n'est pas zéro : un état
 * sans prix ne doit pas produire une ligne de devis à zéro franc, il ne doit
 * produire aucune ligne.
 */
export function prixUnitaire(
  etat: EtatArticle,
  ligne: PrixDeLEtat,
  contexte: ContexteMoyen = { prixMauvais: null },
): number | null {
  if (etat !== 'moyen') return ligne.prix

  const part = contexte.partChoisie ?? ligne.partPrixMauvais ?? null
  const fixe = ligne.prix
  if (part === null) return fixe

  const mauvais = contexte.prixMauvais
  // Une part sans prix Mauvais ne veut rien dire : on s'en tient au fixe
  // plutôt que de compter la part pour zéro sans le dire.
  if (mauvais === null) return fixe

  return (fixe ?? 0) + part * mauvais
}

/**
 * Le montant d'une ligne de devis.
 *
 * Toujours recalculé depuis la quantité et le prix unitaire, jamais recopié
 * d'ailleurs : c'est ce qui garantit qu'un devis réédité après une correction
 * de quantité donne le bon total.
 */
export function montant(quantite: number | null, unitaire: number | null): number | null {
  if (quantite === null || unitaire === null) return null
  return quantite * unitaire
}

/** Arrondi au franc, pour l'affichage d'un devis. */
export function auFranc(valeur: number): number {
  return Math.round(valeur)
}
