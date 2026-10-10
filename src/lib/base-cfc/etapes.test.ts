import { describe, it, expect } from 'vitest'
import {
  articlesSansEtape, cleDuReleve, compteurDEtape, etapesDeLArticle, nomDeLEtape, parcoursDeVisite,
  type EtapeDeVisite, type LienArticleEtape,
} from './etapes'

/** Les sept étapes du classeur, dans l'ordre du tour du bâtiment. */
const ETAPES: EtapeDeVisite[] = [
  { numero: 1, nom: 'Façade', zone: 'Extérieur' },
  { numero: 2, nom: "Cage d'escalier", zone: 'Communs' },
  { numero: 3, nom: 'Structure', zone: 'Communs' },
  { numero: 4, nom: 'Locaux techniques', zone: 'Communs' },
  { numero: 5, nom: 'Appartements', zone: 'Logements' },
  { numero: 6, nom: 'Aménagements extérieurs', zone: 'Extérieur' },
  { numero: 7, nom: 'Autres', zone: 'Bâtiment entier' },
]

const articles = [
  { id: 'A015', nom: 'Façade crépie non isolée' },
  { id: 'A100', nom: 'Peinture intérieure – murs' },
  { id: 'A145', nom: 'Assèchement' },
  { id: 'A999', nom: 'Ouvrage retiré du catalogue', actif: false },
]

// A100 est relevée deux fois : dans la cage et dans les appartements.
const liens: LienArticleEtape[] = [
  { articleId: 'A015', etapeNumero: 1, ordreDansEtape: 8 },
  { articleId: 'A100', etapeNumero: 2, ordreDansEtape: 31 },
  { articleId: 'A100', etapeNumero: 5, ordreDansEtape: 12 },
  { articleId: 'A145', etapeNumero: 7, ordreDansEtape: 1 },
  { articleId: 'A999', etapeNumero: 1, ordreDansEtape: 1 },
]

describe('règle 4, l’ordre de visite', () => {
  it('range les étapes dans l’ordre du tour du bâtiment', () => {
    const melangees = [...ETAPES].reverse()
    expect(parcoursDeVisite(melangees, liens, articles).map((g) => g.etape.nom))
      .toEqual(['Façade', "Cage d'escalier", 'Structure', 'Locaux techniques', 'Appartements', 'Aménagements extérieurs', 'Autres'])
  })

  it('range les articles d’une étape par leur rang, qui suit le code CFC', () => {
    const desordre: LienArticleEtape[] = [
      { articleId: 'A100', etapeNumero: 5, ordreDansEtape: 12 },
      { articleId: 'A015', etapeNumero: 5, ordreDansEtape: 3 },
    ]
    const appartements = parcoursDeVisite(ETAPES, desordre, articles)[4]
    expect(appartements.lignes.map((l) => l.article.id)).toEqual(['A015', 'A100'])
  })

  it('fait du couple article et étape un relevé distinct', () => {
    const p = parcoursDeVisite(ETAPES, liens, articles)
    const cage = p[1].lignes.find((l) => l.article.id === 'A100')
    const appartements = p[4].lignes.find((l) => l.article.id === 'A100')
    expect(cage?.cle).toBe('A100@2')
    expect(appartements?.cle).toBe('A100@5')
    expect(cage?.cle).not.toBe(appartements?.cle)
  })

  it('ne propose plus un article désactivé', () => {
    const facade = parcoursDeVisite(ETAPES, liens, articles)[0]
    expect(facade.lignes.map((l) => l.article.id)).toEqual(['A015'])
  })

  it('compte les relevés faits sur les attendus, étape par étape', () => {
    // La peinture est relevée dans la cage, pas encore dans les appartements.
    const faits = new Set([cleDuReleve('A100', 2)])
    const p = parcoursDeVisite(ETAPES, liens, articles, faits)
    expect(compteurDEtape(p[1])).toBe('1 relevé sur 1')
    expect(compteurDEtape(p[4])).toBe('0 relevés sur 1')
  })

  it('ne compte pas un relevé fait dans une autre étape', () => {
    const faits = new Set([cleDuReleve('A100', 2)])
    expect(parcoursDeVisite(ETAPES, liens, articles, faits)[4].faits).toBe(0)
  })

  it('ignore un lien vers un article inconnu', () => {
    const avecFantome = [...liens, { articleId: 'A404', etapeNumero: 3, ordreDansEtape: 1 }]
    expect(parcoursDeVisite(ETAPES, avecFantome, articles)[2].lignes).toHaveLength(0)
  })

  it('donne les étapes d’un article dans l’ordre de la visite', () => {
    expect(etapesDeLArticle('A100', liens)).toEqual([2, 5])
    expect(etapesDeLArticle('A145', liens)).toEqual([7])
    expect(etapesDeLArticle('A404', liens)).toEqual([])
  })

  it('signale un article actif sans aucune étape, qui serait invisible à la visite', () => {
    const orphelin = [...articles, { id: 'A200', nom: 'Ouvrage oublié' }]
    expect(articlesSansEtape(orphelin, liens)).toEqual(['A200'])
  })

  it('ne signale pas un article désactivé sans étape', () => {
    const sansLe999 = liens.filter((l) => l.articleId !== 'A999')
    expect(articlesSansEtape(articles, sansLe999)).toEqual([])
  })

  it('nomme l’étape d’un relevé, et se tait quand elle est inconnue', () => {
    expect(nomDeLEtape(2, ETAPES)).toBe("Cage d'escalier")
    expect(nomDeLEtape(9, ETAPES)).toBeNull()
    expect(nomDeLEtape(null, ETAPES)).toBeNull()
  })
})
