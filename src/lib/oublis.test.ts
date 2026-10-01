import { describe, it, expect } from 'vitest'
import { oublisDUnReleve, aUnOubliImportant, bilanDesOublis, phraseDAlerte, relevesIncomplets } from './oublis'

describe('un ouvrage pas encore relevé', () => {
  it("n'a rien oublié", () => {
    // Pas d'état : c'est du travail restant, pas un oubli. L'avancement le dit deja.
    expect(oublisDUnReleve({ state: null, photos: [] })).toEqual([])
    expect(oublisDUnReleve({ photos: [], unit: 'm²', area: null })).toEqual([])
  })
})

describe('photo manquante', () => {
  it("est importante sur un ouvrage dégradé, parce que le constat engage", () => {
    for (const state of ['MOYEN', 'MAUVAIS']) {
      const o = oublisDUnReleve({ state, photos: [] })
      expect(o).toHaveLength(1)
      expect(o[0].raison).toBe('photo')
      expect(o[0].gravite).toBe('importante')
    }
  })

  it('reste légère sur un ouvrage en bon état', () => {
    for (const state of ['TRES_BON', 'BON']) {
      const o = oublisDUnReleve({ state, photos: [] })
      expect(o[0].gravite).toBe('legere')
    }
  })

  it('disparaît dès la première photo', () => {
    expect(oublisDUnReleve({ state: 'MAUVAIS', photos: ['data:image/jpeg;base64,xxx'] })).toEqual([])
  })

  it('traite une liste absente comme une liste vide', () => {
    expect(oublisDUnReleve({ state: 'MAUVAIS' })).toHaveLength(1)
    expect(oublisDUnReleve({ state: 'MAUVAIS', photos: null })).toHaveLength(1)
  })
})

describe('quantité manquante', () => {
  it("se signale quand l'ouvrage se compte", () => {
    const o = oublisDUnReleve({ state: 'BON', photos: ['x'], unit: 'm²', area: null })
    expect(o).toHaveLength(1)
    expect(o[0].raison).toBe('quantite')
    expect(o[0].gravite).toBe('importante')
    expect(o[0].message).toContain('m²')
  })

  it('traite zéro comme absent : un montant sur zéro quantité ne repose sur rien', () => {
    expect(oublisDUnReleve({ state: 'BON', photos: ['x'], unit: 'pce', area: 0 })).toHaveLength(1)
  })

  it("ne dit rien quand l'ouvrage n'a pas d'unité", () => {
    expect(oublisDUnReleve({ state: 'BON', photos: ['x'], unit: null, area: null })).toEqual([])
  })

  it('se cumule avec la photo manquante', () => {
    const o = oublisDUnReleve({ state: 'MAUVAIS', photos: [], unit: 'm²', area: null })
    expect(o.map((x) => x.raison)).toEqual(['photo', 'quantite'])
  })
})

describe('aUnOubliImportant', () => {
  it('ignore les oublis légers', () => {
    expect(aUnOubliImportant({ state: 'TRES_BON', photos: [] })).toBe(false)
    expect(aUnOubliImportant({ state: 'MAUVAIS', photos: [] })).toBe(true)
  })
})

describe('bilan', () => {
  const items = [
    { state: 'MAUVAIS', photos: [] },                               // photo importante
    { state: 'MOYEN', photos: [], unit: 'm²', area: null },          // photo + quantité
    { state: 'BON', photos: [] },                                    // photo légère
    { state: 'TRES_BON', photos: ['x'] },                            // rien
    { state: null, photos: [] },                                     // pas relevé
  ]
  const b = bilanDesOublis(items)

  it('compte les relevés concernés, pas les oublis', () => {
    expect(b.releves).toBe(3)
    expect(b.total).toBe(4)
  })

  it('sépare ce qui engage de ce qui ne fait que manquer', () => {
    expect(b.importants).toBe(3)
    expect(b.legers).toBe(1)
    expect(b.sansPhoto).toBe(3)
    expect(b.sansPhotoDegrade).toBe(2)
    expect(b.sansQuantite).toBe(1)
  })
})

describe('liste des relevés incomplets', () => {
  const items = [
    { id: 'a', state: 'BON', photos: [] },                            // léger
    { id: 'b', state: 'TRES_BON', photos: ['x'] },                    // complet
    { id: 'c', state: 'MAUVAIS', photos: [] },                        // important
    { id: 'd', state: null, photos: [] },                             // pas relevé
    { id: 'e', state: 'BON', photos: ['x'], unit: 'm²', area: null }, // important
  ]

  it('ne retient que ce qui manque', () => {
    expect(relevesIncomplets(items).map((r) => r.item.id)).toHaveLength(3)
  })

  it("met les constats qui engagent en premier", () => {
    expect(relevesIncomplets(items).map((r) => r.item.id)).toEqual(['c', 'e', 'a'])
  })

  it("garde l'ordre de la visite à gravité égale", () => {
    const deux = relevesIncomplets([
      { id: '1', state: 'MOYEN', photos: [] },
      { id: '2', state: 'MAUVAIS', photos: [] },
    ])
    expect(deux.map((r) => r.item.id)).toEqual(['1', '2'])
  })

  it('porte le détail de chaque oubli', () => {
    const c = relevesIncomplets(items).find((r) => r.item.id === 'c')!
    expect(c.oublis).toHaveLength(1)
    expect(c.oublis[0].raison).toBe('photo')
  })

  it('rend une liste vide quand tout est complet', () => {
    expect(relevesIncomplets([{ state: 'BON', photos: ['x'] }])).toEqual([])
    expect(relevesIncomplets([])).toEqual([])
  })
})

describe('phrase affichée', () => {
  it('se tait quand rien n\'engage', () => {
    // Prevenir pour une photo manquante sur un ouvrage en tres bon etat apprendrait
    // a ignorer l'alerte, et c'est alors la vraie qui passerait inapercue.
    expect(phraseDAlerte(bilanDesOublis([{ state: 'TRES_BON', photos: [] }]))).toBeNull()
    expect(phraseDAlerte(bilanDesOublis([]))).toBeNull()
  })

  it('ne compte que les ouvrages dégradés sans photo', () => {
    const p = phraseDAlerte(bilanDesOublis([
      { state: 'MAUVAIS', photos: [] },
      { state: 'BON', photos: [] },
    ]))
    expect(p).toBe('1 ouvrage dégradé sans photo')
  })

  it('accorde le pluriel et cumule les deux motifs', () => {
    const p = phraseDAlerte(bilanDesOublis([
      { state: 'MAUVAIS', photos: [] },
      { state: 'MOYEN', photos: [] },
      { state: 'BON', photos: ['x'], unit: 'm²', area: null },
    ]))
    expect(p).toBe('2 ouvrages dégradés sans photo, 1 sans quantité')
  })
})
