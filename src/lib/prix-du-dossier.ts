/**
 * Ajuster un prix depuis l'onglet Coûts.
 *
 * L'utilisateur saisit son propre prix unitaire sur une ligne du devis : la
 * ligne et les totaux se recalculent aussitôt. La base de prix, elle, ne
 * change jamais sans qu'on l'ait demandé : la question est posée (« ce dossier
 * uniquement, ou aussi ma base de prix ? »), et sans réponse explicite, seul
 * le dossier change.
 *
 * Les prix saisis sont des prix appliqués, indice de la construction compris.
 * La base garde des prix avant indexation : on divise par l'indice pour l'y
 * écrire.
 */
import { getMarketCoeff } from './diagnostic-auto'
import type { DevisLigne } from './devis'
import type { ApiArticle, ApiArticleEtat, ApiDiagnosticItem } from './api-types'
import type { EtatArticle } from './base-cfc/normaliser'

const ETAT_DE_LA_BASE: Record<string, EtatArticle> = {
  TRES_BON: 'tres_bon', BON: 'bon', MOYEN: 'moyen', MAUVAIS: 'mauvais',
}

/** L'état de la base qui porte le prix d'une ligne, ou null pour un poste de chantier. */
export function etatDeLaLigne(ligne: DevisLigne, it: ApiDiagnosticItem | undefined): EtatArticle | null {
  if (ligne.enveloppe === 'Amélioration') return 'amelioration'
  if (ligne.enveloppe === 'Mise aux normes') return 'normes'
  if (ligne.enveloppe === 'Réparation' && it?.state) return ETAT_DE_LA_BASE[it.state]
  return null
}

const montant = (pu: number, quantite: number | null) => Math.round(pu * (quantite != null && quantite > 0 ? quantite : 1))

/**
 * Ce qu'il faut écrire sur le relevé pour qu'il applique ce prix unitaire.
 *
 * Une réparation passe en coût repris à la main : elle ne suivra plus la base
 * tant qu'on ne l'y ramène pas. Une amélioration ou une mise aux normes
 * prend le montant qui en découle.
 */
export function patchDuPrix(ligne: DevisLigne, pu: number): Partial<ApiDiagnosticItem> {
  const m = montant(pu, ligne.quantite) as unknown as string
  if (ligne.enveloppe === 'Amélioration') return { improvementCost: m }
  if (ligne.enveloppe === 'Mise aux normes') return { normsCost: m }
  return { estimatedCost: m, costManual: true, costIndex: null }
}

/** Le retour au prix de la base, quand la base en a un. */
export function patchDuRetour(ligne: DevisLigne): Partial<ApiDiagnosticItem> | null {
  if (ligne.prixBase == null) return null
  const m = montant(ligne.prixBase, ligne.quantite) as unknown as string
  if (ligne.enveloppe === 'Amélioration') return { improvementCost: m }
  if (ligne.enveloppe === 'Mise aux normes') return { normsCost: m }
  return { estimatedCost: m, costManual: false, costIndex: getMarketCoeff() }
}

/**
 * Le nouvel état de l'article, prêt pour la base : le prix avant indexation,
 * et le texte des travaux tel qu'il était (la base réécrit l'état d'un bloc).
 *
 * L'état moyen se chiffre en part fixe plus une part du prix mauvais : on
 * garde la part et on ajuste la part fixe, sauf si elle deviendrait négative.
 */
export function etatPourLaBase(
  article: ApiArticle,
  etat: EtatArticle,
  prixApplique: number,
  coeff = getMarketCoeff(),
): ApiArticleEtat {
  const prix = Math.round((prixApplique / (coeff || 1)) * 100) / 100
  const actuel = article.etats.find((e) => e.etat === etat)
  const unite = actuel?.unite ?? (etat === 'amelioration' || etat === 'normes' ? article.uniteRemplacement : article.uniteEntretien)
  if (etat === 'moyen' && actuel?.partPrixMauvais) {
    const mauvais = article.etats.find((e) => e.etat === 'mauvais')?.prix ?? 0
    const fixe = Math.round((prix - actuel.partPrixMauvais * mauvais) * 100) / 100
    if (fixe >= 0) return { etat, travaux: actuel.travaux, prix: fixe, partPrixMauvais: actuel.partPrixMauvais, unite }
  }
  return { etat, travaux: actuel?.travaux ?? null, prix, partPrixMauvais: null, unite }
}

/** Le prix d'un poste de chantier, avant indexation, pour la base. */
export function prixDePostePourLaBase(prixApplique: number, coeff = getMarketCoeff()): number {
  return Math.round((prixApplique / (coeff || 1)) * 100) / 100
}
