import { describe, it, expect, beforeEach } from 'vitest'
import { baseDuProjet, calculerVariante, montantDepuisCatalogue, montantOuvrage } from './variantes'
import type { ApiCatalogItem, ApiDiagnosticItem, ApiVariant, ApiVariantLine } from './api-types'
import { buildQuantityContext, setMarketCoeff } from './diagnostic-auto'

const ouvrage = (o: Partial<ApiDiagnosticItem>): ApiDiagnosticItem => ({
  id: 'x', diagnosticId: 'd', cfcCode: '226.2', cfcLabel: 'Isolation périphérique',
  catalogItemId: null, state: 'MOYEN', priority: 'II', notes: null, works: [], photos: [],
  area: null, unit: null, yearInstalled: null, interventionYear: null,
  estimatedCost: null, improvement: null, improvementCost: null, norms: null, normsCost: null,
  createdAt: '', updatedAt: '', ...o,
})

const ligne = (o: Partial<ApiVariantLine>): ApiVariantLine => ({
  id: 'l', variantId: 'v', replacesItemId: null, catalogItemId: null, state: null,
  cfcCode: '271', label: 'Doublage intérieur', unit: 'm²', area: null,
  amount: '0', costManual: false, note: null, createdAt: '', updatedAt: '', ...o,
})

const variante = (lines: ApiVariantLine[]): ApiVariant => ({
  id: 'v', projectId: 'p', name: 'Isolation par l’intérieur', description: null,
  displayOrder: 0, lines, createdAt: '', updatedAt: '',
})

// Diagnostic de base : isolation extérieure 200 000, chaudière 40 000, peinture 10 000.
const BASE = [
  ouvrage({ id: 'iso', cfcCode: '226.2', estimatedCost: '200000' }),
  ouvrage({ id: 'chauf', cfcCode: '242.0', cfcLabel: 'Production de chaleur', estimatedCost: '40000' }),
  ouvrage({ id: 'peint', cfcCode: '285.1', cfcLabel: 'Peinture intérieure', estimatedCost: '10000' }),
]
const SANS_MAJORATION = { honoraryPct: 0, reservePct: 0 }
/** Devis de base : les 250 000 d'ouvrages, sans poste de chantier. */
const HT_DEVIS = 250_000

describe('montant d’un ouvrage', () => {
  it('additionne les trois enveloppes', () => {
    expect(montantOuvrage(ouvrage({
      estimatedCost: '1000', improvementCost: '500', normsCost: '250',
    }))).toBe(1750)
  })
})

describe('diagnostic de base', () => {
  it('reprend le total du devis tel quel', () => {
    expect(baseDuProjet(HT_DEVIS, SANS_MAJORATION).ht).toBe(250_000)
  })
})

describe('variante', () => {
  it('remplace un ouvrage et laisse le reste du diagnostic intact', () => {
    const v = calculerVariante(
      variante([ligne({ replacesItemId: 'iso', label: 'Isolation intérieure', amount: '120000' })]),
      BASE, SANS_MAJORATION, HT_DEVIS)

    expect(v.htConserve).toBe(50_000)   // chaudière + peinture, inchangés
    expect(v.htArbitrages).toBe(120_000)
    expect(v.ht).toBe(170_000)
    expect(v.ecartHt).toBe(-80_000)     // 80 000 de moins que le diagnostic de base
  })

  it('cumule plusieurs arbitrages : isolation intérieure et passage au pellet', () => {
    const v = calculerVariante(variante([
      ligne({ id: 'a', replacesItemId: 'iso', label: 'Isolation intérieure', amount: '120000' }),
      ligne({ id: 'b', replacesItemId: 'chauf', label: 'Chaudière à pellets', amount: '65000' }),
    ]), BASE, SANS_MAJORATION, HT_DEVIS)

    expect(v.htConserve).toBe(10_000)   // il ne reste que la peinture
    expect(v.ht).toBe(195_000)
    expect(v.ecartHt).toBe(-55_000)
  })

  it('compte un travail nouveau en plus, sans rien retirer', () => {
    const v = calculerVariante(
      variante([ligne({ label: 'Panneaux photovoltaïques', amount: '45000' })]),
      BASE, SANS_MAJORATION, HT_DEVIS)

    expect(v.htConserve).toBe(250_000)
    expect(v.ht).toBe(295_000)
    expect(v.ecartHt).toBe(45_000)
  })

  it('traite un montant à zéro comme un renoncement à l’ouvrage', () => {
    const v = calculerVariante(
      variante([ligne({ replacesItemId: 'iso', label: 'Isolation reportée', amount: '0' })]),
      BASE, SANS_MAJORATION, HT_DEVIS)

    expect(v.ht).toBe(50_000)
    expect(v.ecartHt).toBe(-200_000)
  })

  it('dit pour chaque arbitrage ce qu’il coûte de plus ou de moins', () => {
    const v = calculerVariante(variante([
      ligne({ id: 'a', replacesItemId: 'chauf', label: 'Chauffage à distance', amount: '55000' }),
      ligne({ id: 'b', label: 'Sous-station CAD', amount: '12000' }),
    ]), BASE, SANS_MAJORATION, HT_DEVIS)

    expect(v.arbitrages[0].montantRemplace).toBe(40_000)
    expect(v.arbitrages[0].ecart).toBe(15_000)   // le CAD coûte 15 000 de plus
    expect(v.arbitrages[1].remplace).toBeNull()
    expect(v.arbitrages[1].ecart).toBe(12_000)   // un ajout coûte son montant entier
  })

  it("redevient un ajout quand l'ouvrage remplacé a disparu du diagnostic", () => {
    // « iso » n'est plus au dossier : le devis ne vaut donc plus que 50 000, et on
    // ne peut retrancher un montant qui n'y figure pas.
    const v = calculerVariante(
      variante([ligne({ replacesItemId: 'iso', label: 'Isolation intérieure', amount: '120000' })]),
      BASE.filter((it) => it.id !== 'iso'), SANS_MAJORATION, 50_000)

    expect(v.arbitrages[0].remplace).toBeNull()
    expect(v.arbitrages[0].montantRemplace).toBe(0)
    expect(v.htConserve).toBe(50_000)
    expect(v.ht).toBe(170_000)   // la ligne devient un simple ajout
  })

  it('applique la même cascade de majorations que le devis de base', () => {
    const v = calculerVariante(
      variante([ligne({ replacesItemId: 'iso', label: 'Isolation intérieure', amount: '120000' })]),
      BASE, { honoraryPct: 16, reservePct: 5 }, HT_DEVIS)

    expect(v.cascade.honoraires).toBe(27_200)      // 16 % de 170 000
    expect(v.cascade.reserve).toBeCloseTo(9_860)   // 5 % de 197 200
    expect(v.cascade.sousTotal).toBeCloseTo(207_060)
    expect(Math.round(v.cascade.total)).toBe(223_832) // 207 060 × 1.081
  })

  it('garde les postes de chantier du devis, qu’aucun arbitrage ne touche', () => {
    // Devis de base = 250 000 d'ouvrages + 18 000 de postes de chantier.
    const v = calculerVariante(
      variante([ligne({ replacesItemId: 'iso', label: 'Isolation intérieure', amount: '120000' })]),
      BASE, SANS_MAJORATION, 268_000)

    expect(v.htConserve).toBe(68_000)   // 50 000 d'ouvrages + les 18 000 de chantier
    expect(v.ht).toBe(188_000)
    expect(v.ecartHt).toBe(-80_000)     // l'écart ne dépend que de l'arbitrage
  })

  it('ne compte pas deux fois un ouvrage arbitré', () => {
    const v = calculerVariante(
      variante([ligne({ replacesItemId: 'peint', label: 'Peinture haut de gamme', amount: '18000' })]),
      BASE, SANS_MAJORATION, HT_DEVIS)

    expect(v.ht).toBe(258_000) // 240 000 conservés + 18 000, et non 268 000
  })
})

// ---------------------------------------------------------------------------
// Plus-value automatique : le prix vient du catalogue, comme au diagnostic.
// ---------------------------------------------------------------------------

const article = (o: Partial<ApiCatalogItem>): ApiCatalogItem => ({
  id: 1, displayOrder: 1, category: null, categoryCfc: null, description: '', cfcCode: null,
  workTbe: null, workBon: null, workMoyen: null, workMauvais: null, workImprovement: null, workNorms: null,
  descTbe: null, descBon: null, descMoyen: null, descMauvais: null, unit: null, quantityFormula: null,
  priceTbe: null, priceBon: null, priceMoyen: null, priceMauvais: null,
  priceImprovement: null, priceNorms: null, scaffoldingNote: null, ...o,
})

// Fenêtres PVC et bois-métal, prix au m² par état, tels que le catalogue les porte.
const PVC = article({ id: 15, description: 'Fenêtres en matières synthétiques', priceMoyen: '450', priceMauvais: '800' })
const BOIS_METAL = article({ id: 14, description: 'Fenêtres en bois-métal', priceMoyen: '620', priceMauvais: '1100' })

describe('montant depuis le catalogue', () => {
  beforeEach(() => setMarketCoeff(1))

  it('chiffre la solution retenue au prix de son état', () => {
    expect(montantDepuisCatalogue(BOIS_METAL, 'MAUVAIS', 23)).toBe(25_300) // 23 × 1100
  })

  it('donne la plus-value du PVC vers le bois-métal, à état égal', () => {
    const pvc = montantDepuisCatalogue(PVC, 'MAUVAIS', 23)!
    const boisMetal = montantDepuisCatalogue(BOIS_METAL, 'MAUVAIS', 23)!
    expect(boisMetal - pvc).toBe(6_900) // 23 × (1100 − 800)
  })

  it("suit le changement d'état sur un même article : moyen devient mauvais", () => {
    expect(montantDepuisCatalogue(PVC, 'MOYEN', 23)).toBe(10_350)   // 23 × 450
    expect(montantDepuisCatalogue(PVC, 'MAUVAIS', 23)).toBe(18_400) // 23 × 800
  })

  it('indexe comme le reste du dossier', () => {
    setMarketCoeff(1.2)
    expect(montantDepuisCatalogue(BOIS_METAL, 'MAUVAIS', 23)).toBe(30_360) // 25 300 × 1.2
  })

  it('ne calcule rien plutôt que d’inventer, quand une donnée manque', () => {
    expect(montantDepuisCatalogue(null, 'MOYEN', 23)).toBeUndefined()
    expect(montantDepuisCatalogue(BOIS_METAL, null, 23)).toBeUndefined()
    expect(montantDepuisCatalogue(BOIS_METAL, 'MOYEN', null)).toBeUndefined()
    // Prix non renseigné pour cet état : le catalogue est muet, on ne devine pas.
    expect(montantDepuisCatalogue(BOIS_METAL, 'TRES_BON', 23)).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Rechiffrage depuis la base : la variante suit le dossier.
// ---------------------------------------------------------------------------

/** Fenêtres : la quantité se déduit de la façade et de la part vitrée. */
const FENETRES = article({
  id: 14, description: 'Fenêtres en bois-métal', cfcCode: '221.1',
  unit: 'CHF/m² fenêtres', quantityFormula: 'm2 de façade x % de fenêtre',
  priceMoyen: '80', priceMauvais: '1050',
})

const contexte = (batiment: Parameters<typeof buildQuantityContext>[0]) => ({
  catalogue: new Map([[14, FENETRES]]),
  qtyCtx: buildQuantityContext(batiment),
})

// Périmètre 58 m, 5 étages de 2,7 m, 22 % de vitrage -> 172 m² de fenêtres.
const BATIMENT = { perimeter: 58, nbFloors: 5, floorHeight: 2.7, windowPct: 22, builtArea: 190 }

describe('rechiffrage depuis le bâtiment', () => {
  beforeEach(() => setMarketCoeff(1))

  it('déduit la quantité des dimensions plutôt que de la relire telle quelle', () => {
    const v = calculerVariante(
      variante([ligne({ catalogItemId: 14, state: 'MAUVAIS', area: 23, amount: '24150' })]),
      BASE, SANS_MAJORATION, HT_DEVIS, contexte(BATIMENT))

    expect(v.arbitrages[0].quantite).toBe(172)        // et non les 23 enregistrés
    expect(v.arbitrages[0].montant).toBe(180_600)     // 172 × 1050
  })

  it('suit une correction du dossier : plus de façade, plus de fenêtres', () => {
    const v = calculerVariante(
      variante([ligne({ catalogItemId: 14, state: 'MAUVAIS', area: 23, amount: '24150' })]),
      BASE, SANS_MAJORATION, HT_DEVIS, contexte({ ...BATIMENT, perimeter: 80 }))

    expect(v.arbitrages[0].quantite).toBe(238)        // 80 × 5 × 2,7 × 22 %
    expect(v.arbitrages[0].montant).toBe(249_900)
  })

  it('respecte un montant repris à la main : il ne doit plus bouger', () => {
    const v = calculerVariante(
      variante([ligne({ catalogItemId: 14, state: 'MAUVAIS', area: 23, amount: '24150', costManual: true })]),
      BASE, SANS_MAJORATION, HT_DEVIS, contexte(BATIMENT))

    expect(v.arbitrages[0].quantite).toBe(23)
    expect(v.arbitrages[0].montant).toBe(24_150)
  })

  it("préfère une quantité relevée sur place à la formule", () => {
    const releve = ouvrage({ id: 'fen', cfcCode: '221.2', estimatedCost: '1610', area: 23, quantityManual: true })
    const v = calculerVariante(
      variante([ligne({ replacesItemId: 'fen', catalogItemId: 14, state: 'MAUVAIS', area: 23, amount: '0' })]),
      [releve], SANS_MAJORATION, 1_610, contexte(BATIMENT))

    expect(v.arbitrages[0].quantite).toBe(23)         // la mesure l'emporte
    expect(v.arbitrages[0].montant).toBe(24_150)
    expect(v.arbitrages[0].ecart).toBe(22_540)        // la plus-value du brief
  })

  it('dit sur quelle grandeur du dossier la quantité est prise', () => {
    const v = calculerVariante(
      variante([ligne({ catalogItemId: 14, state: 'MAUVAIS', area: 23, amount: '24150' })]),
      BASE, SANS_MAJORATION, HT_DEVIS, contexte(BATIMENT))
    // Sans cette mention, une base aberrante — doubler des parois sur l'emprise au
    // sol — ne se distingue pas d'une base juste : les deux ne sont qu'un nombre.
    expect(v.arbitrages[0].baseMetre).toBe('surface vitrée')
  })

  it('garde les valeurs enregistrées quand rien ne permet de rechiffrer', () => {
    const v = calculerVariante(
      variante([ligne({ catalogItemId: null, state: null, area: 12, amount: '9000' })]),
      BASE, SANS_MAJORATION, HT_DEVIS, contexte(BATIMENT))

    expect(v.arbitrages[0].quantite).toBe(12)
    expect(v.arbitrages[0].montant).toBe(9_000)
  })
})
