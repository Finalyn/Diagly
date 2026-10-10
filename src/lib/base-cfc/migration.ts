/**
 * Reprendre les relevés existants : où va chaque relevé, et où il reste.
 *
 * Deux décisions, et elles sont délicates parce qu'elles portent sur des
 * diagnostics déjà rendus à des clients. Le principe est qu'un relevé ne se
 * perd jamais : au pire il reste où il est, visible, avec la mention que son
 * article a quitté le catalogue.
 */

/** Ce qu'une ligne de la table de correspondance dit d'un ancien article. */
export interface Correspondance {
  ancienOrdre: number
  nouveauId: string | null
  confiance: 'sure' | 'decidee' | 'probable' | 'a_relire' | 'a_decider' | 'aucune'
}

export type Localisation = 'COMMUNS' | 'LOGEMENTS' | null

export interface ChoixEtape {
  etape: number | null
  /** true = aucune information ne tranchait, l'étape est un pis-aller à vérifier. */
  parDefaut: boolean
}

/**
 * Dans quelle étape ranger un relevé repris.
 *
 * Un article d'une seule étape ne pose pas de question. Pour les vingt-trois
 * qui se relèvent dans deux, l'ancienne localisation tranche quand elle est
 * renseignée.
 *
 * Quand rien ne tranche, on prend la première étape du tour plutôt que de
 * laisser l'étape vide : un relevé sans étape ne s'afficherait dans aucune
 * étape du diagnostic, donc disparaîtrait de l'écran. Mieux vaut un relevé
 * rangé au mauvais étage, visible et déplaçable, qu'un relevé introuvable.
 */
export function choisirEtape(
  etapesDeLArticle: number[],
  localisation: Localisation,
  zoneParEtape: Map<number, string>,
): ChoixEtape {
  if (etapesDeLArticle.length === 0) return { etape: null, parDefaut: false }
  if (etapesDeLArticle.length === 1) return { etape: etapesDeLArticle[0], parDefaut: false }

  if (localisation) {
    const voulue = localisation === 'LOGEMENTS' ? 'Logements' : 'Communs'
    const candidates = etapesDeLArticle.filter((n) => zoneParEtape.get(n) === voulue)
    if (candidates.length === 1) return { etape: candidates[0], parDefaut: false }
  }
  return { etape: Math.min(...etapesDeLArticle), parDefaut: true }
}

export interface Redirection {
  /** Article v3 vers lequel pointer, ou null pour rester sur l'ancien. */
  articleId: string | null
  /** true = la correspondance existe mais personne ne l'a tranchée. */
  aTrancher: boolean
}

/**
 * Vers quel article v3 rediriger un relevé.
 *
 * Une correspondance « à décider » est traitée comme une absence de
 * correspondance : tant que personne n'a choisi entre deux articles voisins,
 * déplacer le relevé serait décider à sa place. Il reste donc où il est, et le
 * rapport le nomme.
 */
export function redirection(correspondance: Correspondance | undefined): Redirection {
  if (!correspondance) return { articleId: null, aTrancher: false }
  if (correspondance.confiance === 'a_decider') return { articleId: null, aTrancher: true }
  return { articleId: correspondance.nouveauId, aTrancher: false }
}
