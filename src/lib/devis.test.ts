import { describe, it, expect, beforeEach } from 'vitest'
import { buildDevis, cascadeDe, postesDeChantier, uniteCourte, POSTES_AUTOMATIQUES } from './devis'
import { setMarketCoeff } from './diagnostic-auto'
import { formatPrixUnitaire } from './utils'
import type { ApiCatalogItem, ApiDiagnosticItem } from './api-types'

const ouvrage = (o: Partial<ApiDiagnosticItem>): ApiDiagnosticItem => ({
  id: 'x', diagnosticId: 'd', cfcCode: '226.2', cfcLabel: 'Isolation périphérique',
  catalogItemId: null, state: 'MOYEN', priority: 'II', notes: null, works: [], photos: [],
  area: null, unit: null, yearInstalled: null, interventionYear: null,
  estimatedCost: null, improvement: null, improvementCost: null, norms: null, normsCost: null,
  createdAt: '', updatedAt: '', ...o,
})

const article = (o: Partial<ApiCatalogItem>): ApiCatalogItem => ({
  id: 1, displayOrder: 1, category: null, categoryCfc: null, description: '', cfcCode: null,
  workTbe: null, workBon: null, workMoyen: null, workMauvais: null, workImprovement: null, workNorms: null,
  descTbe: null, descBon: null, descMoyen: null, descMauvais: null, unit: null, quantityFormula: null,
  priceTbe: null, priceBon: null, priceMoyen: null, priceMauvais: null,
  priceImprovement: null, priceNorms: null, scaffoldingNote: null, ...o,
})

const LABELS = new Map([['226', 'Crépissages de façade'], ['287', 'Nettoyage du bâtiment'],
  ['101', 'Relevés, études géotechniques'], ['211', "Travaux d'entreprise de maçonnerie"]])
const SANS_SURFACE = { honoraryPct: 0, reservePct: 0, floorArea: null }

// Le coefficient marché est un état global du module : on le neutralise pour que
// les montants attendus soient lisibles, et on le restaure là où il est testé.
beforeEach(() => setMarketCoeff(1))

describe('cascade des majorations', () => {
  it('applique la réserve sur le montant déjà majoré des honoraires', () => {
    const c = cascadeDe(100_000, 16, 5)
    expect(c.honoraires).toBe(16_000)
    expect(c.reserve).toBe(5_800) // 5 % de 116 000, pas de 100 000
    expect(c.sousTotal).toBe(121_800)
    expect(Math.round(c.total)).toBe(131_666)
  })

  it('ne majore rien quand les pourcentages sont nuls, hors TVA', () => {
    const c = cascadeDe(1000, 0, 0)
    expect(c.sousTotal).toBe(1000)
    expect(Math.round(c.total)).toBe(1081)
  })
})

describe('enveloppes d’un ouvrage', () => {
  it('éclate réparation, amélioration et normes en trois lignes distinctes', () => {
    const d = buildDevis([ouvrage({
      estimatedCost: '1000', improvement: 'Isolation renforcée', improvementCost: '500',
      norms: 'Garde-corps SIA 358', normsCost: '250', area: 10, unit: 'CHF/m²',
    })], LABELS, [], SANS_SURFACE)

    const lignes = d.blocs.find((b) => b.cle === 'II')!.positions[0].lignes
    expect(lignes.map((l) => l.enveloppe)).toEqual(['Réparation', 'Amélioration', 'Mise aux normes'])
    expect(lignes.map((l) => l.montant)).toEqual([1000, 500, 250])
  })

  it('calcule le prix unitaire appliqué, que le client peut recalculer', () => {
    const d = buildDevis([ouvrage({ estimatedCost: '2400', area: 16, unit: 'CHF/m²' })],
      LABELS, [], SANS_SURFACE)
    const ligne = d.blocs.find((b) => b.cle === 'II')!.positions[0].lignes[0]
    expect(ligne.prixUnitaire).toBe(150) // 2400 / 16
    expect(ligne.unite).toBe('m²')
  })

  it('laisse le prix unitaire vide plutôt que de diviser par zéro', () => {
    const d = buildDevis([ouvrage({ estimatedCost: '5000', area: 0 })], LABELS, [], SANS_SURFACE)
    expect(d.blocs.find((b) => b.cle === 'II')!.positions[0].lignes[0].prixUnitaire).toBeNull()
  })

  it('écarte du devis un ouvrage sans montant', () => {
    const d = buildDevis([ouvrage({ estimatedCost: null })], LABELS, [], SANS_SURFACE)
    expect(d.blocs.filter((b) => b.cle !== 'AUTO')).toHaveLength(0)
  })

  it("ne fait pas entrer les photos dans le devis : elles restent au chapitre de l'état", () => {
    const d = buildDevis([ouvrage({
      estimatedCost: '100', photos: ['data:image/jpeg;base64,aaa'],
    })], LABELS, [], SANS_SURFACE)
    const ligne = d.blocs.find((b) => b.cle === 'II')!.positions[0].lignes[0]
    expect(ligne).not.toHaveProperty('photos')
  })
})

describe('groupement par priorité puis position CFC', () => {
  it('range les ouvrages sous leur position à 3 chiffres', () => {
    const d = buildDevis([
      ouvrage({ id: 'a', cfcCode: '226.2', estimatedCost: '1000' }),
      ouvrage({ id: 'b', cfcCode: '226.1', estimatedCost: '500' }),
    ], LABELS, [], SANS_SURFACE)
    const positions = d.blocs.find((b) => b.cle === 'II')!.positions
    expect(positions).toHaveLength(1)
    expect(positions[0].code).toBe('226')
    expect(positions[0].label).toBe('Crépissages de façade')
    expect(positions[0].montant).toBe(1500)
  })

  it('sépare les priorités et garde un bloc pour celles non arbitrées', () => {
    const d = buildDevis([
      ouvrage({ id: 'a', priority: 'I', estimatedCost: '100' }),
      ouvrage({ id: 'b', priority: null, estimatedCost: '200' }),
    ], LABELS, [], SANS_SURFACE)
    expect(d.blocs.map((b) => b.cle)).toEqual(['AUTO', 'I', 'NC'])
    expect(d.blocs.find((b) => b.cle === 'NC')!.ht).toBe(200)
  })

  it('somme le total général sur tous les blocs, postes de chantier compris', () => {
    const d = buildDevis([ouvrage({ estimatedCost: '1000' })], LABELS, [],
      { honoraryPct: 0, reservePct: 0, floorArea: 100 })
    const auto = d.blocs.find((b) => b.cle === 'AUTO')!.ht
    expect(auto).toBe(1000 + 5000) // nettoyage 100 m² × 10 + protection 5000
    expect(d.ht).toBe(auto + 1000)
  })
})

describe('postes imposés par le classeur', () => {
  it('compte le nettoyage au m² de surface de plancher', () => {
    const lignes = postesDeChantier([], new Map(), { honoraryPct: 0, reservePct: 0, floorArea: 853 })
    const nettoyage = lignes.find((l) => l.cfcCode === POSTES_AUTOMATIQUES.nettoyage.cfc)!
    expect(nettoyage.montant).toBe(8530) // 853 × 10
    expect(nettoyage.automatique).toBe(true)
  })

  it('omet le nettoyage quand la surface de plancher est inconnue, sans inventer', () => {
    const lignes = postesDeChantier([], new Map(), SANS_SURFACE)
    expect(lignes.find((l) => l.cfcCode === POSTES_AUTOMATIQUES.nettoyage.cfc)).toBeUndefined()
  })

  it('compte toujours la protection des ouvrages, en forfait', () => {
    const lignes = postesDeChantier([], new Map(), SANS_SURFACE)
    expect(lignes.find((l) => l.cfcCode === POSTES_AUTOMATIQUES.protection.cfc)!.montant).toBe(5000)
  })

  it("ajoute l'échafaudage dès qu'un revêtement de mur des communs est en fin de vie", () => {
    const catalogue = new Map([[7, article({ id: 7, category: 'Revêtement de murs' })]])
    const lignes = postesDeChantier(
      [ouvrage({ catalogItemId: 7, state: 'MAUVAIS', localisation: 'COMMUNS' })], catalogue, SANS_SURFACE)
    expect(lignes.find((l) => l.cle === 'auto:echafaudage')!.montant).toBe(5000)
  })

  it("n'ajoute pas l'échafaudage pour un revêtement seulement dégradé", () => {
    const catalogue = new Map([[7, article({ id: 7, category: 'Revêtement de murs' })]])
    const lignes = postesDeChantier(
      [ouvrage({ catalogItemId: 7, state: 'MOYEN', localisation: 'COMMUNS' })], catalogue, SANS_SURFACE)
    expect(lignes.find((l) => l.cle === 'auto:echafaudage')).toBeUndefined()
  })

  it("n'échafaude pas la cage pour un plafond d'appartement en fin de vie", () => {
    // Le classeur dit « pour les communs (cage d'escalier) ». Tant que le relevé
    // ne distinguait pas les deux, refaire un plafond de salon montait un
    // échafaudage dans la cage : 5 000 CHF au devis sans raison.
    const catalogue = new Map([[8, article({ id: 8, category: 'Revêtement de plafonds' })]])
    const lignes = postesDeChantier(
      [ouvrage({ catalogItemId: 8, state: 'MAUVAIS', localisation: 'LOGEMENTS' })], catalogue, SANS_SURFACE)
    expect(lignes.find((l) => l.cle === 'auto:echafaudage')).toBeUndefined()
  })

  it("n'échafaude la cage qu'une fois, même si les deux côtés sont en fin de vie", () => {
    const catalogue = new Map([
      [7, article({ id: 7, category: 'Revêtement de murs' })],
      [8, article({ id: 8, category: 'Revêtement de plafonds' })],
    ])
    const lignes = postesDeChantier([
      ouvrage({ id: 'a', catalogItemId: 7, state: 'MAUVAIS', localisation: 'COMMUNS' }),
      ouvrage({ id: 'b', catalogItemId: 8, state: 'MAUVAIS', localisation: 'LOGEMENTS' }),
    ], catalogue, SANS_SURFACE)
    expect(lignes.filter((l) => l.cle === 'auto:echafaudage')).toHaveLength(1)
  })

  it("n'ajoute pas l'échafaudage pour une façade en fin de vie : la règle vise l'intérieur", () => {
    const catalogue = new Map([[3, article({ id: 3, category: 'FACADE' })]])
    const lignes = postesDeChantier(
      [ouvrage({ catalogItemId: 3, state: 'MAUVAIS' })], catalogue, SANS_SURFACE)
    expect(lignes.find((l) => l.cle === 'auto:echafaudage')).toBeUndefined()
  })

  it('indexe les postes du classeur comme les prix du catalogue', () => {
    setMarketCoeff(1.2)
    const lignes = postesDeChantier([], new Map(), { honoraryPct: 0, reservePct: 0, floorArea: 100 })
    expect(lignes.find((l) => l.cle === 'auto:protection')!.montant).toBe(6000) // 5000 × 1.2
    expect(lignes.find((l) => l.cle === 'auto:nettoyage')!.montant).toBe(1200) // 100 × 10 × 1.2
  })

  it('énonce la règle de chaque poste, pour qu’un montant sans ouvrage reste explicable', () => {
    const d = buildDevis([], LABELS, [], { honoraryPct: 0, reservePct: 0, floorArea: 100 })
    expect(d.reglesAppliquees).toHaveLength(2)
    expect(d.reglesAppliquees[0]).toContain('CFC 287')
  })
})

describe('unité du catalogue', () => {
  it('retire le préfixe monétaire pour ne garder que l’unité de métré', () => {
    expect(uniteCourte('CHF/m²')).toBe('m²')
    expect(uniteCourte('CHF / pce')).toBe('pce')
    expect(uniteCourte('CHF/m² de toiture')).toBe('m² de toiture')
  })

  it('rend null sur une unité absente ou purement monétaire', () => {
    expect(uniteCourte(null)).toBeNull()
    expect(uniteCourte('CHF')).toBeNull()
  })
})

describe('un montant se refait de tête', () => {
  /**
   * La règle du lot 1.3 : quantité × prix unitaire = montant, sur chaque ligne.
   * Un devis que le destinataire ne peut pas recalculer est un devis qu'il
   * conteste. Le prix unitaire étant arrondi au centime, on tolère l'écart de
   * cet arrondi, et rien de plus.
   */
  /** Toutes les lignes du devis, quel que soit le bloc où elles sont tombées. */
  const toutesLesLignes = (devis: ReturnType<typeof buildDevis>) =>
    devis.blocs.flatMap((b) => b.positions.flatMap((p) => p.lignes))

  const verifier = (lignes: { quantite: number | null; prixUnitaire: number | null; montant: number }[]) => {
    expect(lignes.length).toBeGreaterThan(0)
    for (const l of lignes) {
      if (l.quantite == null || l.prixUnitaire == null) continue
      // Un centime d'écart par unité au maximum : c'est l'arrondi du prix unitaire.
      expect(Math.abs(l.quantite * l.prixUnitaire - l.montant)).toBeLessThanOrEqual(l.quantite * 0.005 + 0.01)
    }
  }

  it('tient sur les trois enveloppes d’un ouvrage', () => {
    const devis = buildDevis([ouvrage({
      area: 840, unit: 'CHF/m²', estimatedCost: '94332',
      improvement: 'Isolation', improvementCost: '12345',
      norms: 'SIA 358', normsCost: '777',
    })], LABELS, [], SANS_SURFACE)
    verifier(toutesLesLignes(devis))
  })

  it('tient sur une quantité qui ne tombe pas juste', () => {
    // 94 332 / 840 = 112.30 exactement : c'est le cas releve par le bureau, où
    // l'affichage arrondi au franc donnait 840 × 112 = 94 080 et faisait douter.
    const devis = buildDevis([ouvrage({ area: 840, unit: 'CHF/m²', estimatedCost: '94332' })],
      LABELS, [], SANS_SURFACE)
    const ligne = toutesLesLignes(devis).find((l) => !l.automatique && l.enveloppe === 'Réparation')!
    expect(ligne.prixUnitaire).toBe(112.3)
    expect(ligne.quantite! * ligne.prixUnitaire!).toBe(94332)
  })

  it('tient aussi sur les postes comptés d’office', () => {
    verifier(postesDeChantier([ouvrage({ estimatedCost: '50000' })], new Map(),
      { honoraryPct: 0, reservePct: 0, floorArea: 1100 }))
  })

  it('ne fabrique pas de prix unitaire sans quantité', () => {
    const devis = buildDevis([ouvrage({ area: null, estimatedCost: '5000' })], LABELS, [], SANS_SURFACE)
    // Par le libellé, et non par le montant : un poste compté d'office peut
    // porter la même somme, et c'est lui qu'on attraperait.
    const ligne = toutesLesLignes(devis).find((l) => !l.automatique)!
    expect(ligne.montant).toBe(5000)
    expect(ligne.quantite).toBeNull()
    expect(ligne.prixUnitaire).toBeNull()
  })
})

describe('affichage du prix unitaire', () => {
  it('montre les centimes quand il y en a, et pas sinon', () => {
    expect(formatPrixUnitaire(112.3)).toMatch(/112[.,]30 CHF/)
    expect(formatPrixUnitaire(112)).toBe('112 CHF')
  })
})
