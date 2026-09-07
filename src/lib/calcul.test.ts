import { describe, it, expect, beforeEach } from 'vitest'
import { computeProjectMetrics, facadeSurface, roofSurface, perimeterWarning, floorsWarning } from './formulas'
import {
  buildQuantityContext, resolveQuantity, computeQuantity, computeCost,
  setMarketCoeff, appliedUnitPrice, priceToNumber, STATE_PRIORITY,
} from './diagnostic-auto'
import type { ApiCatalogItem } from './api-types'
import seedData from '../../server/prisma/seed-data.json'

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
    // Les appareils sanitaires ne se déduisent pas : le nombre dépend de la typologie
    // des logements, il est relevé sur place (retour terrain du 1er septembre 2026).
    const sanitaire = resolveQuantity(item({ quantityFormula: "2 pce par pièce d'eau" }), ctx)
    expect(sanitaire.quantity).toBeUndefined()
    expect(sanitaire.reason).toContain('sur place')
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

describe('règles par code CFC, pour les items sans formule', () => {
  const ctx = buildQuantityContext(DOSSIER)

  it('compte les menuiseries des communs en portes palières', () => {
    const q = resolveQuantity(item({ cfcCode: '273.0', unit: 'CHF/U', description: 'Portes intérieures - Bois' }), ctx)
    expect(q.quantity).toBe(8) // une par logement
    expect(q.basis).toContain('palières')
  })

  it('chiffre les revêtements intérieurs à la surface de plancher', () => {
    for (const [cfc, desc] of [['281', 'Sols - Parquet'], ['282', 'Murs intérieurs - Peinture/Crépi'], ['283', 'Plafonds - Plâtre/Crépi']]) {
      expect(computeQuantity(item({ cfcCode: cfc, unit: 'CHF/m²', description: desc }), ctx), desc).toBe(1416)
    }
  })

  it('réserve la faïence aux salles de bain', () => {
    const q = resolveQuantity(item({ cfcCode: '282', unit: 'CHF/m²', description: 'Murs intérieurs - Faïences' }), ctx)
    expect(q.quantity).toBe(56) // 8 logements × 7 m²
    expect(q.basis).toContain('salles de bain')
  })
})

describe('descentes d’eaux pluviales', () => {
  const F = 'Descentes EP : 4/8/10 selon surface bâtie x hauteur'
  const hauteur = (g: Partial<typeof DOSSIER>) => buildQuantityContext({ ...DOSSIER, ...g })

  it('compte 4 descentes jusqu’à 400 m² d’emprise', () => {
    // 4 descentes × (2 étages × 2.7 m) = 21.6 → 22 ml
    expect(computeQuantity(item({ quantityFormula: F }), hauteur({ builtArea: 350 }))).toBe(22)
  })

  it('compte 8 descentes entre 400 et 900 m²', () => {
    expect(computeQuantity(item({ quantityFormula: F }), hauteur({ builtArea: 708 }))).toBe(43)
  })

  it('compte 10 descentes au-delà de 900 m²', () => {
    expect(computeQuantity(item({ quantityFormula: F }), hauteur({ builtArea: 1200 }))).toBe(54)
  })

  it('suit la hauteur réelle du bâtiment', () => {
    expect(computeQuantity(item({ quantityFormula: F }), hauteur({ builtArea: 708, nbFloors: 6 }))).toBe(130)
  })

  it('ne conclut pas si l’emprise ou la hauteur manque', () => {
    const q = resolveQuantity(item({ quantityFormula: F }), hauteur({ builtArea: 0 }))
    expect(q.quantity).toBeUndefined()
    expect(q.reason).toContain('emprise')
  })
})

// ---------------------------------------------------------------------------
// Garde-fou : toute formule du catalogue doit être reconnue par le résolveur.
// Le bureau fait évoluer son tableau ; une formulation nouvelle passerait
// silencieusement en saisie manuelle et personne ne le verrait. Ce test échoue
// à la place, en nommant la formule à traiter.
// ---------------------------------------------------------------------------
describe('formules du catalogue', () => {
  /** Formules qui appellent volontairement un relevé sur place. */
  const AU_RELEVE = new Set([
    '2 pce par pièce d\'eau',
    '25 m2 par salle d\'eau',
    'A définir',
    'pce',
  ])

  it('sont toutes résolues, sauf celles qui appellent un relevé', () => {
    const seed = seedData as {
      items: { quantityFormula?: string | null; unit?: string | null; cfcCode?: string | null }[]
    }
    // Dossier complet : toutes les grandeurs du bâtiment sont renseignées.
    const ctx = buildQuantityContext({
      perimeter: 346, nbFloors: 2, floorHeight: 2.7, builtArea: 708, floorArea: 1416,
      terrainArea: 1505, windowPct: 30, nbApartments: 8, nbStaircases: 2, roofType: 'PENTE',
      apartmentTypes: { '3.5': 5, '4.5': 3 },
    } as never)

    const nonResolues = [...new Set(seed.items.map((i) => i.quantityFormula).filter(Boolean) as string[])]
      .filter((f) => !AU_RELEVE.has(f))
      .filter((f) => resolveQuantity({ quantityFormula: f, unit: 'CHF/m²', cfcCode: '999' }, ctx).quantity == null)

    expect(nonResolues).toEqual([])
  })
})
