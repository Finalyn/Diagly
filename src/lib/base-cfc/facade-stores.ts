/**
 * Les stores et volets d'une façade qu'on refait.
 *
 * Piquer un crépi ou poser une isolation périphérique ne se fait pas avec les
 * stores en place : il faut les déposer et les reposer, ou les remplacer. Le
 * relevé des stores, lui, ne voit que leur état — bon, ils ne demandaient
 * qu'un nettoyage — et le devis oubliait la dépose. Ce module dit quels
 * stores sont concernés, pour que l'éditeur, la façade et le contrôle avant
 * envoi posent la question.
 *
 * Une façade est refaite quand elle est relevée en état mauvais, remplacée
 * quand même, ou qu'une amélioration y est retenue (règle de Chloé, 10 nov.
 * 2026). L'état moyen, une réfection partielle, n'oblige pas à déposer.
 */
import type { ApiArticle, ApiDiagnosticItem } from '../api-types'

/** Le groupe d'alternatives des revêtements de façade, dans la base. */
const GROUPE_FACADE = 'Revêtement de façade'

/**
 * Volets (228.0), volets roulants (228.1), stores à lamelles (228.2), stores
 * en toile (228.3). Les films contre l'éblouissement (228.4) sont collés sur
 * le vitrage : ils ne se déposent pas.
 */
const CODES_STORES = /^228\.[0-3]$/

/**
 * Prix de la dépose et repose d'un store ou d'un volet, au m² de fenêtre,
 * avant indexation : 50.-/m², fixé par Chloé le 10 nov. 2026. La base n'en a
 * pas. Un prix réglé dans l'onglet Coûts du dossier l'emporte (`prixPostes`,
 * sous la clé DEPOSE_REPOSE). null ferait sortir la ligne « à chiffrer ».
 */
export const PRIX_DEPOSE_REPOSE: number | null = 50

/** La clé du prix de dépose/repose réglé au dossier, dans `prixPostes`. */
export const DEPOSE_REPOSE = 'depose_repose'

export const TRAVAUX_DEPOSE_REPOSE = 'Dépose des stores et volets avant les travaux de façade, stockage et repose.'

/** La façade relevée est-elle refaite ? */
export function facadeRefaite(it: ApiDiagnosticItem, articles: ApiArticle[]): boolean {
  const article = it.articleId ? articles.find((a) => a.id === it.articleId) : undefined
  if (article?.groupeAlternatives !== GROUPE_FACADE) return false
  return it.state === 'MAUVAIS' || Boolean(it.remplacement) || it.improvement != null
}

export function estUnStore(it: ApiDiagnosticItem): boolean {
  return CODES_STORES.test(it.cfcCode)
}

/** Le store est-il déjà traité : déposé, remplacé, ou remplacé parce que mauvais ? */
export function storeTraite(it: ApiDiagnosticItem): boolean {
  return Boolean(it.deposeRepose) || Boolean(it.remplacement) || it.state === 'MAUVAIS'
}

export interface AlerteFacade {
  /** Les façades refaites. */
  facades: ApiDiagnosticItem[]
  /** Les stores et volets relevés qui attendent une décision. */
  aTraiter: ApiDiagnosticItem[]
}

/** Les stores à traiter, quand une façade est refaite ; null sinon. */
export function alerteFacade(items: ApiDiagnosticItem[], articles: ApiArticle[]): AlerteFacade | null {
  const facades = items.filter((it) => facadeRefaite(it, articles))
  if (facades.length === 0) return null
  return { facades, aTraiter: items.filter((it) => estUnStore(it) && !storeTraite(it)) }
}
