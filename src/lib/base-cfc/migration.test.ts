import { describe, it, expect } from 'vitest'
import { choisirEtape, redirection, type Correspondance } from './migration'

/** Les sept étapes du tour, avec leur zone. */
const ZONES = new Map<number, string>([
  [1, 'Extérieur'], [2, 'Communs'], [3, 'Communs'], [4, 'Communs'],
  [5, 'Logements'], [6, 'Extérieur'], [7, 'Bâtiment entier'],
])

describe('choisirEtape', () => {
  it('range sans hésiter un article qui n’a qu’une étape', () => {
    expect(choisirEtape([4], null, ZONES)).toEqual({ etape: 4, parDefaut: false })
  })

  it('laisse sans étape un article qui n’en a aucune', () => {
    expect(choisirEtape([], 'COMMUNS', ZONES)).toEqual({ etape: null, parDefaut: false })
  })

  it('tranche par la localisation quand elle est renseignée', () => {
    // A100 Peinture intérieure – murs : cage d'escalier et appartements.
    expect(choisirEtape([2, 5], 'LOGEMENTS', ZONES)).toEqual({ etape: 5, parDefaut: false })
    expect(choisirEtape([2, 5], 'COMMUNS', ZONES)).toEqual({ etape: 2, parDefaut: false })
  })

  it('prend la première étape du tour quand rien ne tranche, et le signale', () => {
    expect(choisirEtape([2, 5], null, ZONES)).toEqual({ etape: 2, parDefaut: true })
  })

  it('ne choisit pas au hasard entre deux étapes de la même zone', () => {
    // Deux étapes « Communs » : la localisation ne départage pas, défaut assumé.
    expect(choisirEtape([2, 4], 'COMMUNS', ZONES)).toEqual({ etape: 2, parDefaut: true })
  })

  it('ne laisse jamais un relevé sans étape quand l’article en a', () => {
    for (const etapes of [[1], [2, 5], [1, 6], [2, 3, 4]]) {
      for (const loc of [null, 'COMMUNS', 'LOGEMENTS'] as const) {
        expect(choisirEtape(etapes, loc, ZONES).etape).not.toBeNull()
      }
    }
  })

  it('prend la plus petite, c’est-à-dire la plus tôt dans le tour', () => {
    expect(choisirEtape([5, 2], null, ZONES).etape).toBe(2)
  })
})

describe('redirection', () => {
  const ligne = (patch: Partial<Correspondance> = {}): Correspondance => ({
    ancienOrdre: 42, nouveauId: 'A100', confiance: 'sure', ...patch,
  })

  it('redirige quand la correspondance est sûre ou décidée', () => {
    expect(redirection(ligne())).toEqual({ articleId: 'A100', aTrancher: false })
    expect(redirection(ligne({ confiance: 'decidee' }))).toEqual({ articleId: 'A100', aTrancher: false })
  })

  it('redirige aussi sur une correspondance probable ou à relire', () => {
    expect(redirection(ligne({ confiance: 'probable' })).articleId).toBe('A100')
    expect(redirection(ligne({ confiance: 'a_relire' })).articleId).toBe('A100')
  })

  it('ne bouge pas un relevé dont la correspondance reste à trancher', () => {
    expect(redirection(ligne({ confiance: 'a_decider', nouveauId: 'A037' })))
      .toEqual({ articleId: null, aTrancher: true })
  })

  it('ne bouge pas un relevé sans repreneur', () => {
    expect(redirection(ligne({ confiance: 'aucune', nouveauId: null })))
      .toEqual({ articleId: null, aTrancher: false })
  })

  it('ne bouge pas un relevé dont l’ancien article est inconnu de la table', () => {
    expect(redirection(undefined)).toEqual({ articleId: null, aTrancher: false })
  })
})
