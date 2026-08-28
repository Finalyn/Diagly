import { describe, it, expect, beforeEach } from 'vitest'
import { computeProjectMetrics, facadeSurface, roofSurface, perimeterWarning, floorsWarning } from './formulas'
import {
  buildQuantityContext, resolveQuantity, computeQuantity, computeCost,
  setMarketCoeff, appliedUnitPrice, priceToNumber, STATE_PRIORITY,
} from './diagnostic-auto'
import type { ApiCatalogItem } from './api-types'

// Dossier de référence : Avenue de la Gare 10, 1003 Lausanne (relevé du brief de correction).
const DOSSIER = {
  perimeter: 346,
  nbFloors: 2,
  floorHeight: 2.7,
  builtArea: 708,
  floorArea: 1416,
  terrainArea: 1505,
  windowPct: 30,
  nbApartments: 8,
  nbStaircases: 2,
  roofType: null,
}

const item = (o: Partial<ApiCatalogItem>) => o as ApiCatalogItem

describe('géométrie du bâtiment', () => {
  it('déduit la façade du périmètre, des étages et de la hauteur', () => {
    expect(Math.round(facadeSurface(DOSSIER))).toBe(1868) // 346 × 2 × 2.7
  })

  it('suit une correction du périmètre au lieu de rester figée', () => {
    expect(Math.round(facadeSurface({ ...DOSSIER, perimeter: 120 }))).toBe(648)
    expect(Math.round(facadeSurface({ ...DOSSIER, nbFloors: 6 }))).toBe(5605)
  })

  it("ignore une surface de façade enregistrée quand le périmètre permet de la calculer", () => {
    // Ancien comportement : la valeur écrite à la création gelait la façade à vie.
    expect(Math.round(facadeSurface({ ...DOSSIER, perimeter: 120, facadeArea: 1868 }))).toBe(648)
  })

  it('utilise la façade relevée en dernier recours, si le périmètre est inconnu', () => {
    expect(facadeSurface({ perimeter: 0, nbFloors: 2, facadeArea: 900 })).toBe(900)
  })

  it("ne présume aucune toiture tant que le type n'est pas précisé", () => {
    expect(roofSurface(null, 708)).toBeNull()
    expect(roofSurface('PLATE', 708)).toBe(708)
    expect(roofSurface('PENTE', 708)).toBe(956)
    expect(roofSurface('MIXTE', 708)).toBe(832)
  })

  it("ne compte pas les fenêtres deux fois dans l'échafaudage", () => {
    const a = computeProjectMetrics({ ...DOSSIER, windowPct: 30 })
    const b = computeProjectMetrics({ ...DOSSIER, windowPct: 50 })
    expect(a.scaffolding).toBe(b.scaffolding) // le vitrage ne change pas la surface à échafauder
    expect(Math.round(a.scaffolding)).toBe(2055) // 1868 × 1.1
  })

  it('sépare la façade vitrée de la façade opaque', () => {
    const m = computeProjectMetrics(DOSSIER)
    expect(Math.round(m.windows)).toBe(561) // 1868.4 × 30 %
    expect(Math.round(m.opaqueFacade)).toBe(1308)
    expect(m.windows + m.opaqueFacade).toBeCloseTo(m.facade, 6)
  })
})

describe('quantité par formule de catalogue', () => {
  const ctx = buildQuantityContext(DOSSIER)

  it('rend la façade hors vitrage, pas le périmètre ni la façade entière', () => {
    // Les fenêtres sont chiffrées par leur propre formule : les compter aussi dans le
    // crépi facturerait deux fois les mêmes mètres carrés.
    const q = resolveQuantity(item({ quantityFormula: "Périmètre x (étage x hauteur d'étage)", unit: 'CHF/m²' }), ctx)
    expect(q.quantity).toBe(1308) // 1868.4 − 30 % de vitrage
    expect(q.origin).toBe('formule')
  })

  it('ne laisse aucun mètre carré compté deux fois entre crépi et fenêtres', () => {
    const opaque = computeQuantity(item({ quantityFormula: "Périmètre x (étage x hauteur d'étage)" }), ctx)!
    const vitre = computeQuantity(item({ quantityFormula: 'm2 de façade x % de fenêtre' }), ctx)!
    expect(opaque + vitre).toBe(1869) // = la façade entière, aux arrondis près
  })

  it('rend la surface vitrée, pas la façade entière', () => {
    const q = resolveQuantity(item({ quantityFormula: 'm2 de façade x % de fenêtre', unit: 'CHF/m² fenêtres' }), ctx)
    expect(q.quantity).toBe(561)
  })

  it('suit la part vitrée du dossier', () => {
    const c50 = buildQuantityContext({ ...DOSSIER, windowPct: 50 })
    expect(computeQuantity(item({ quantityFormula: 'm2 de façade x % de fenêtre' }), c50)).toBe(934)
  })

  it('compte les arbres, pas les mètres carrés de terrain', () => {
    const q = resolveQuantity(item({ quantityFormula: '(Compter 2 arbres pour 100 m2 de terrain)', unit: 'CHF/U' }), ctx)
    expect(q.quantity).toBe(30) // 1505 / 100 × 2
  })

  it("s'en remet au type de toiture au lieu d'appliquer 1,35 aveuglément", () => {
    const f = item({ quantityFormula: 'Surface de bâtie x 1,35', unit: 'CHF/m²' })
    expect(resolveQuantity(f, ctx).quantity).toBeUndefined() // type non précisé
    expect(computeQuantity(f, buildQuantityContext({ ...DOSSIER, roofType: 'PLATE' }))).toBe(708)
    expect(computeQuantity(f, buildQuantityContext({ ...DOSSIER, roofType: 'PENTE' }))).toBe(956)
  })

  it('rend l’emprise au sol', () => {
    expect(computeQuantity(item({ quantityFormula: 'Surface de bâtie' }), ctx)).toBe(708)
  })

  it('câble les formules qui étaient laissées en saisie manuelle', () => {
    expect(computeQuantity(item({ quantityFormula: "Nombre d'appartement" }), ctx)).toBe(8)
    expect(computeQuantity(item({ quantityFormula: "Nombre de cage d'escalier" }), ctx)).toBe(2)
    expect(computeQuantity(item({ quantityFormula: "Nombre de portes d'entrées" }), ctx)).toBe(2)
    expect(computeQuantity(item({ quantityFormula: "2 pce par pièce d'eau" }), ctx)).toBe(32) // 8 × 2 × 2
  })

  it('tolère la casse, les accents et les espaces du libellé', () => {
    expect(computeQuantity(item({ quantityFormula: "PERIMETRE X (ETAGE X HAUTEUR D'ETAGE)" }), ctx)).toBe(1308)
    expect(computeQuantity(item({ quantityFormula: "  Périmètre  x (étage x hauteur d’étage) " }), ctx)).toBe(1308)
  })

  it('tombe en saisie manuelle sur une formule inconnue, sans rien deviner', () => {
    const q = resolveQuantity(item({ quantityFormula: 'Périmètre du terrain x 3', unit: 'CHF/m²' }), ctx)
    expect(q.quantity).toBeUndefined()
    expect(q.origin).toBe('manuelle')
  })

  it('tombe en saisie manuelle quand la donnée source manque', () => {
    const sansCage = buildQuantityContext({ ...DOSSIER, nbStaircases: 0 })
    const q = resolveQuantity(item({ quantityFormula: "Nombre de cage d'escalier" }), sansCage)
    expect(q.quantity).toBeUndefined()
    expect(q.reason).toContain('cages')
  })
})

describe('quantité par unité de prix, à défaut de formule', () => {
  const ctx = buildQuantityContext({ ...DOSSIER, roofType: 'PENTE' })

  it('reconnaît les unités qui désignent une grandeur', () => {
    expect(computeQuantity(item({ unit: 'CHF/m² fenêtres' }), ctx)).toBe(561)
    expect(computeQuantity(item({ unit: 'CHF/m² SP' }), ctx)).toBe(1416)
    expect(computeQuantity(item({ unit: 'CHF/m² de toiture' }), ctx)).toBe(956)
    expect(computeQuantity(item({ unit: 'Forfait' }), ctx)).toBe(1)
  })

  it('laisse en saisie manuelle les unités génériques', () => {
    for (const unit of ['CHF/m²', 'CHF/m2', 'CHF/U', 'CHF/pce', 'CHF/ml']) {
      expect(computeQuantity(item({ unit }), ctx), unit).toBeUndefined()
    }
  })
})

describe('coûts', () => {
  beforeEach(() => setMarketCoeff(1.123))

  it('applique le coefficient marché au prix du catalogue', () => {
    expect(appliedUnitPrice('1500')).toBe(1684.5)
    expect(computeCost(item({ priceMauvais: '180' }), 'MAUVAIS', 1868)).toBe(377_598) // 180 × 1868 × 1.123
  })

  it('ne chiffre rien quand le prix du catalogue est un texte', () => {
    expect(priceToNumber('sur devis')).toBeUndefined()
    expect(computeCost(item({ priceMoyen: 'sur devis' }), 'MOYEN', 100)).toBeUndefined()
  })

  it('ne chiffre rien sans quantité', () => {
    expect(computeCost(item({ priceMauvais: '180' }), 'MAUVAIS', undefined)).toBeUndefined()
  })

  it('déduit la priorité de l’état', () => {
    expect(STATE_PRIORITY.MAUVAIS).toBe('I')
    expect(STATE_PRIORITY.MOYEN).toBe('II')
    expect(STATE_PRIORITY.BON).toBe('III')
  })
})

describe('contrôles de vraisemblance', () => {
  it('signale un périmètre qui ne peut pas être celui du bâtiment', () => {
    // Relevé réel : 346 ml annoncés pour 708 m² d'emprise (contour d'îlot VECTOR25).
    const w = perimeterWarning(346, 708)
    expect(w).toContain('114 ml attendus')
  })

  it('accepte un périmètre cohérent', () => {
    expect(perimeterWarning(114, 708)).toBeNull()
    expect(perimeterWarning(140, 708)).toBeNull() // bâtiment allongé
  })

  it('signale un périmètre impossible car trop court', () => {
    expect(perimeterWarning(40, 708)).toContain('trop court')
  })

  it('signale un nombre d’étages incohérent avec les surfaces', () => {
    expect(floorsWarning(2, 4248, 708)).toContain('6 niveaux')
    expect(floorsWarning(6, 4248, 708)).toBeNull()
  })
})
