import { describe, it, expect } from 'vitest'
import { groupItemsByVisitStep, localisationDeLetape, visitStepLabel } from './visit-steps'
import { cleReleve, CATEGORIES_INTERIEUR } from './localisation'
import type { ApiCatalogItem } from './api-types'

const article = (o: Partial<ApiCatalogItem>): ApiCatalogItem => ({
  id: 1, displayOrder: 1, category: null, categoryCfc: null, description: '', cfcCode: null,
  workTbe: null, workBon: null, workMoyen: null, workMauvais: null, workImprovement: null, workNorms: null,
  descTbe: null, descBon: null, descMoyen: null, descMauvais: null, unit: null, quantityFormula: null,
  priceTbe: null, priceBon: null, priceMoyen: null, priceMauvais: null,
  priceImprovement: null, priceNorms: null, scaffoldingNote: null, ...o,
})

/** displayOrder = étape × 1000 + rang, comme au catalogue. */
const dans = (etape: number, rang: number) => etape * 1000 + rang

const FACADE = article({ id: 1, category: 'FACADE', description: 'Crépi', displayOrder: dans(1, 1) })
const LUSTRERIE = article({ id: 2, category: '23 Installations électriques', description: 'Lustrerie', displayOrder: dans(2, 1) })
const MENUISERIE = article({ id: 3, category: '273 Menuiserie', description: 'Portes palières', displayOrder: dans(2, 5) })
const MURS = article({ id: 4, category: 'Revêtement de murs', description: 'Peinture', displayOrder: dans(5, 1) })
const SOLS = article({ id: 5, category: 'Revêtement de sols', description: 'Parquet', displayOrder: dans(5, 3) })
const CUISINE = article({ id: 6, category: '25 Installations sanitaires', description: 'Cuisine', displayOrder: dans(5, 9) })

const CATALOGUE = [FACADE, LUSTRERIE, MENUISERIE, MURS, SOLS, CUISINE]

const etape = (n: number) => groupItemsByVisitStep(CATALOGUE).find((g) => g.step === n)!
const articlesDe = (n: number) => etape(n).categories.flatMap((c) => c.items).map((c) => c.id)

describe('note générale du classeur : communs et logements', () => {
  it("sert la grille intérieure des deux côtés du bâtiment", () => {
    // La note : « Tous ces articles sont les mêmes pour les communs et l'intérieur
    // des appartements ». Un article intérieur doit donc se relever dans la cage
    // d'escalier comme dans les logements.
    expect(articlesDe(2)).toContain(MURS.id)
    expect(articlesDe(5)).toContain(MURS.id)
    expect(articlesDe(2)).toContain(MENUISERIE.id)
    expect(articlesDe(5)).toContain(MENUISERIE.id)
  })

  it('laisse les autres ouvrages à leur seule étape', () => {
    // Une façade ne se relève pas dans la cage d'escalier, une cuisine pas non plus.
    expect(articlesDe(1)).toEqual([FACADE.id])
    expect(articlesDe(2)).not.toContain(CUISINE.id)
    expect(articlesDe(5)).not.toContain(LUSTRERIE.id)
  })

  it('donne sa localisation à chaque étape intérieure', () => {
    expect(etape(2).localisation).toBe('COMMUNS')
    expect(etape(5).localisation).toBe('LOGEMENTS')
    expect(etape(1).localisation).toBeNull()
  })

  it("ne prête de localisation ni à la toiture ni aux abords", () => {
    // Un ouvrage relevé dehors n'est ni communs ni logements : lui en donner une
    // le ferait apparaître deux fois.
    expect(localisationDeLetape(4)).toBeNull()
    expect(localisationDeLetape(6)).toBeNull()
    expect(localisationDeLetape(null)).toBeNull()
  })

  it("distingue deux relevés du même article par leur localisation", () => {
    // C'est la clé qui autorise le double relevé : sans elle, peindre la cage
    // interdisait de relever les murs des appartements.
    expect(cleReleve(MURS.id, 'COMMUNS')).not.toBe(cleReleve(MURS.id, 'LOGEMENTS'))
    expect(cleReleve(FACADE.id, null)).toBe(cleReleve(FACADE.id, null))
  })

  it('présente la grille intérieure dans le même ordre des deux côtés', () => {
    // Deux étapes qui montrent la même grille doivent la montrer pareil, quel que
    // soit le rang que le catalogue avait donné à chaque article.
    const interieuresDe = (n: number) =>
      etape(n).categories.map((c) => c.category).filter((c) => (CATEGORIES_INTERIEUR as readonly string[]).includes(c))
    expect(interieuresDe(2)).toEqual(interieuresDe(5))
    expect(interieuresDe(2)).toEqual(['Revêtement de murs', 'Revêtement de sols', '273 Menuiserie'])
  })

  it("compte l'article intérieur dans les deux étapes", () => {
    // 3 articles intérieurs (murs, sols, menuiserie) + la lustrerie dans la cage,
    // + la cuisine dans les logements.
    expect(etape(2).count).toBe(4)
    expect(etape(5).count).toBe(4)
  })
})

describe("intitulé des étapes selon l'affectation", () => {
  it("nomme les surfaces principales d'après le bâtiment", () => {
    expect(visitStepLabel(5, 'SCOLAIRE')).toBe('Salles de classe')
    expect(visitStepLabel(5, 'LOGEMENT')).toBe('Appartements')
  })

  it("ne renomme pas la cage d'escalier : elle se dit pareil partout", () => {
    expect(visitStepLabel(2, 'SCOLAIRE')).toBe("Cage d'escalier")
  })
})
