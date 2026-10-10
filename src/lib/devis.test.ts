import { describe, it, expect, beforeEach } from 'vitest'
import { buildDevis, cascadeDe, postesDeChantier, tableauDesOptions, uniteCourte } from './devis'
import { setMarketCoeff } from './diagnostic-auto'
import { formatPrixUnitaire } from './utils'
import type { ApiArticle, ApiDiagnosticItem, ApiEtapeVisite, ApiPosteAutomatique } from './api-types'
import type { DonneesBatiment } from './base-cfc/quantites'

const ouvrage = (o: Partial<ApiDiagnosticItem>): ApiDiagnosticItem => ({
  id: 'x', diagnosticId: 'd', cfcCode: '226.1', cfcLabel: 'Façade crépie non isolée',
  catalogItemId: null, articleId: 'A015', etapeNumero: 1,
  state: 'MOYEN', priority: 'II', notes: null, works: [], photos: [],
  area: null, unit: null, yearInstalled: null, interventionYear: null,
  estimatedCost: null, improvement: null, improvementCost: null, norms: null, normsCost: null,
  createdAt: '', updatedAt: '', ...o,
})

const article = (o: Partial<ApiArticle>): ApiArticle => ({
  id: 'A015', cfcCode: '226.1', nom: 'Façade crépie non isolée', domaineRapport: 'Façades',
  groupeAlternatives: 'Revêtement de façade', echafaudage: true, uniteEntretien: 'm2',
  uniteRemplacement: 'm2', baseQuantite: 'surface_facade', indicationQuantite: null, coefficient: 1,
  noteDiagnostiqueur: null, articleLieId: null, actif: true, ligneOrigine: null,
  etats: [], etapes: [{ articleId: 'A015', etapeNumero: 1, ordreDansEtape: 8 }], ...o,
})

const A015 = article({})
const A009 = article({ id: 'A009', cfcCode: '215.2', nom: 'Façade ventilée métallique' })
const A100 = article({
  id: 'A100', cfcCode: '285.1', nom: 'Peinture intérieure – murs', domaineRapport: 'Intérieur – murs',
  groupeAlternatives: 'Finition de paroi', echafaudage: false, baseQuantite: 'surface_plancher',
  etapes: [
    { articleId: 'A100', etapeNumero: 2, ordreDansEtape: 31 },
    { articleId: 'A100', etapeNumero: 5, ordreDansEtape: 34 },
  ],
})

const POSTES: ApiPosteAutomatique[] = [
  { cfcCode: '121', libelle: 'Protection des ouvrages existants', declencheur: 'toujours', unite: 'forfait', prix: 5000, regleQuantite: 'forfait', remarque: null },
  { cfcCode: '211.1', libelle: 'Échafaudage de façade', declencheur: 'echafaudage_facade', unite: 'm2', prix: 35, regleQuantite: 'surface_echafaudee', remarque: null },
  { cfcCode: '285.0', libelle: 'Échafaudage cage d’escalier', declencheur: 'communs_mauvais', unite: 'forfait', prix: 5000, regleQuantite: 'par_cage_escalier', remarque: null },
  { cfcCode: '287', libelle: 'Nettoyage complet du bâtiment', declencheur: 'toujours', unite: 'm2', prix: 10, regleQuantite: 'surface_plancher', remarque: null },
]

const ETAPES: ApiEtapeVisite[] = [
  { numero: 1, nom: 'Façade', zone: 'Extérieur' },
  { numero: 2, nom: "Cage d'escalier", zone: 'Communs' },
  { numero: 5, nom: 'Appartements', zone: 'Logements' },
]

const BASE = { articles: [A015, A009, A100], postes: POSTES, etapes: ETAPES }

const batiment = (o: Partial<DonneesBatiment> = {}): DonneesBatiment => ({
  surfacePlancher: null, surfaceBatie: null, surfaceTerrain: null, surfaceFacade: null,
  surfaceFenetres: null, nombreLogements: null, logementsParTypologie: null, nombrePiecesEau: null,
  nombreEtages: null, nombreCages: null, nombrePortesEntree: null, hauteur: null, surfaceParking: null,
  ...o,
})

const LABELS = new Map([
  ['226', 'Crépissages de façade'], ['287', 'Nettoyage du bâtiment'],
  ['121', 'Installations de chantier'], ['211', 'Échafaudages'], ['285', 'Peintures intérieures'],
])
const NU = { honoraryPct: 0, reservePct: 0, batiment: batiment() }

// Le coefficient marché est un état global du module : on le neutralise pour que
// les montants attendus soient lisibles, et on le restaure là où il est testé.
beforeEach(() => setMarketCoeff(1))

describe('cascade des majorations', () => {
  it('applique la réserve sur le montant déjà majoré des honoraires', () => {
    const c = cascadeDe(100_000, 12, 10)
    expect(c.honoraires).toBe(12_000)
    expect(c.reserve).toBeCloseTo(11_200, 2)
    expect(c.sousTotal).toBeCloseTo(123_200, 2)
    expect(c.total).toBeCloseTo(133_179.2, 1)
  })

  it('ne majore rien quand les pourcentages sont nuls, hors TVA', () => {
    const c = cascadeDe(50_000, 0, 0)
    expect(c.sousTotal).toBe(50_000)
    expect(c.total).toBeCloseTo(54_050, 2)
  })
})

describe('les enveloppes d’un ouvrage', () => {
  it('sépare la réparation de la remise aux normes', () => {
    const d = buildDevis(
      [ouvrage({ estimatedCost: '12000', normsCost: '3000', norms: 'Mise aux normes incendie' })],
      LABELS, BASE, NU,
    )
    const lignes = d.blocs.flatMap((b) => b.positions.flatMap((p) => p.lignes)).filter((l) => !l.automatique)
    expect(lignes.map((l) => l.enveloppe)).toEqual(['Réparation', 'Mise aux normes'])
  })

  it('sort l’amélioration du devis principal pour la mettre aux options', () => {
    const d = buildDevis(
      [ouvrage({ estimatedCost: '12000', improvementCost: '40000', improvement: 'Isolation périphérique' })],
      LABELS, BASE, NU,
    )
    const principal = d.blocs.flatMap((b) => b.positions.flatMap((p) => p.lignes)).filter((l) => !l.automatique)
    expect(principal.map((l) => l.enveloppe)).toEqual(['Réparation'])
    expect(d.options.lignes.map((l) => l.montant)).toEqual([40_000])
    // Le total principal ne la porte pas : c'est une décision, pas un engagement.
    expect(d.blocs.find((b) => b.cle === 'II')!.ht).toBe(12_000)
  })

  it('écarte du devis un ouvrage sans montant', () => {
    const d = buildDevis([ouvrage({ estimatedCost: null })], LABELS, BASE, NU)
    expect(d.blocs.some((b) => b.cle === 'II')).toBe(false)
  })

  it('calcule le prix unitaire appliqué, que le client peut recalculer', () => {
    const d = buildDevis([ouvrage({ estimatedCost: '18000', area: 200 })], LABELS, BASE, NU)
    const l = d.blocs.find((b) => b.cle === 'II')!.positions[0].lignes[0]
    expect(l.prixUnitaire).toBe(90)
    expect(l.quantite! * l.prixUnitaire!).toBeCloseTo(l.montant, 2)
  })

  it('laisse le prix unitaire vide plutôt que de diviser par zéro', () => {
    const d = buildDevis([ouvrage({ estimatedCost: '18000', area: 0 })], LABELS, BASE, NU)
    expect(d.blocs.find((b) => b.cle === 'II')!.positions[0].lignes[0].prixUnitaire).toBeNull()
  })
})

describe('règle 9, une ligne par étape', () => {
  const cage = ouvrage({ id: 'r1', articleId: 'A100', etapeNumero: 2, cfcCode: '285.1', cfcLabel: 'Peinture intérieure – murs', estimatedCost: '9600' })
  const appartements = ouvrage({ id: 'r2', articleId: 'A100', etapeNumero: 5, cfcCode: '285.1', cfcLabel: 'Peinture intérieure – murs', estimatedCost: '28800' })

  it('nomme l’étape de chaque ligne quand l’ouvrage est relevé deux fois', () => {
    const d = buildDevis([cage, appartements], LABELS, BASE, NU)
    const lignes = d.blocs.find((b) => b.cle === 'II')!.positions[0].lignes
    expect(lignes.map((l) => l.libelle).sort()).toEqual([
      'Peinture intérieure – murs · Appartements',
      "Peinture intérieure – murs · Cage d'escalier",
    ])
  })

  it('n’alourdit pas le libellé d’un ouvrage relevé une seule fois', () => {
    const d = buildDevis([ouvrage({ estimatedCost: '12000' })], LABELS, BASE, NU)
    expect(d.blocs.find((b) => b.cle === 'II')!.positions[0].lignes[0].libelle)
      .toBe('Façade crépie non isolée')
  })

  it('trie les positions par code CFC, à l’usage suisse', () => {
    const d = buildDevis(
      [cage, ouvrage({ estimatedCost: '12000' })],
      LABELS, BASE, { ...NU, batiment: batiment({ surfacePlancher: 1200, surfaceFacade: 400 }) },
    )
    const auto = d.blocs.find((b) => b.cle === 'AUTO')!
    expect(auto.positions.map((p) => p.code)).toEqual(['121', '211', '287'])
  })
})

describe('règle 7, les postes automatiques', () => {
  const avecBatiment = { honoraryPct: 0, reservePct: 0, batiment: batiment({ surfacePlancher: 1200, surfaceFacade: 400, nombreCages: 2 }) }

  it('compte toujours la protection et le nettoyage', () => {
    const lignes = postesDeChantier([], BASE, avecBatiment)
    expect(lignes.map((l) => l.cfcCode)).toEqual(['121', '287'])
    expect(lignes.find((l) => l.cfcCode === '287')).toMatchObject({ quantite: 1200, montant: 12_000 })
  })

  it('lit les prix dans la table et jamais en dur', () => {
    const cher = { ...BASE, postes: POSTES.map((p) => (p.cfcCode === '287' ? { ...p, prix: 12 } : p)) }
    expect(postesDeChantier([], cher, avecBatiment).find((l) => l.cfcCode === '287')!.montant).toBe(14_400)
  })

  it('ajoute l’échafaudage de façade dès qu’un ouvrage qui en demande est chiffré', () => {
    const lignes = postesDeChantier([ouvrage({ estimatedCost: '72000', area: 400 })], BASE, avecBatiment)
    expect(lignes.find((l) => l.cfcCode === '211.1')).toMatchObject({ quantite: 400, montant: 14_000 })
  })

  it('ne compte pas deux fois la même façade', () => {
    // Moitié crépie, moitié ventilée, les deux à refaire : 400 m², pas 800.
    const lignes = postesDeChantier([
      ouvrage({ id: 'a', estimatedCost: '36000', area: 200 }),
      ouvrage({ id: 'b', articleId: 'A009', cfcCode: '215.2', estimatedCost: '40000', area: 200 }),
    ], BASE, avecBatiment)
    expect(lignes.find((l) => l.cfcCode === '211.1')!.quantite).toBe(400)
  })

  it('n’échafaude pas la façade pour un ouvrage intérieur', () => {
    const lignes = postesDeChantier(
      [ouvrage({ articleId: 'A100', etapeNumero: 5, cfcCode: '285.1', estimatedCost: '28800', area: 1200 })],
      BASE, avecBatiment,
    )
    expect(lignes.find((l) => l.cfcCode === '211.1')).toBeUndefined()
  })

  it('échafaude la cage d’escalier par cage, quand ses murs sont en fin de vie', () => {
    const lignes = postesDeChantier(
      [ouvrage({ articleId: 'A100', etapeNumero: 2, cfcCode: '285.1', state: 'MAUVAIS', estimatedCost: '9600' })],
      BASE, avecBatiment,
    )
    expect(lignes.find((l) => l.cfcCode === '285.0')).toMatchObject({ quantite: 2, montant: 10_000 })
  })

  it('n’échafaude pas la cage pour des murs d’appartement en fin de vie', () => {
    const lignes = postesDeChantier(
      [ouvrage({ articleId: 'A100', etapeNumero: 5, cfcCode: '285.1', state: 'MAUVAIS', estimatedCost: '28800' })],
      BASE, avecBatiment,
    )
    expect(lignes.find((l) => l.cfcCode === '285.0')).toBeUndefined()
  })

  it('indexe les postes comme les prix du catalogue', () => {
    setMarketCoeff(1.1)
    expect(postesDeChantier([], BASE, avecBatiment).find((l) => l.cfcCode === '287')!.montant).toBe(13_200)
  })

  it('énonce la règle de chaque poste, pour qu’un montant sans ouvrage reste explicable', () => {
    const d = buildDevis([], LABELS, BASE, avecBatiment)
    expect(d.reglesAppliquees).toHaveLength(2)
    expect(d.reglesAppliquees[0]).toContain('CFC 121')
  })
})

describe('règle 8, l’échafaudage des options', () => {
  const option = ouvrage({ estimatedCost: null, improvement: 'Isolation périphérique crépie', improvementCost: '124000', area: 400 })

  it('ajoute l’échafaudage au tableau des options', () => {
    const t = tableauDesOptions([option], BASE, false)
    expect(t.lignes[0].echafaudage).toMatchObject({ montant: 14_000 })
    expect(t.ht).toBe(124_000)
    expect(t.total).toBe(138_000)
  })

  it('ne le compte pas deux fois quand le devis principal le porte déjà', () => {
    const t = tableauDesOptions([option], BASE, true)
    expect(t.lignes[0].echafaudage!.montant).toBeNull()
    expect(t.lignes[0].echafaudage!.mention).toBe('Échafaudage déjà compté au devis principal.')
    expect(t.total).toBe(124_000)
  })

  it('se tait pour une option qui ne demande pas d’échafaudage', () => {
    const interieur = ouvrage({
      articleId: 'A100', etapeNumero: 5, cfcCode: '285.1', estimatedCost: null,
      improvement: 'Peinture minérale', improvementCost: '20000',
    })
    expect(tableauDesOptions([interieur], BASE, false).lignes[0].echafaudage).toBeNull()
  })

  it('voit l’échafaudage du devis principal quand il y est', () => {
    const d = buildDevis(
      [ouvrage({ estimatedCost: '72000', area: 400, improvement: 'Isolation', improvementCost: '124000' })],
      LABELS, BASE, { honoraryPct: 0, reservePct: 0, batiment: batiment({ surfaceFacade: 400 }) },
    )
    expect(d.options.lignes[0].echafaudage!.montant).toBeNull()
    expect(d.options.echafaudage).toBe(0)
  })
})

describe('unité du catalogue', () => {
  it('retire le préfixe monétaire pour ne garder que l’unité de métré', () => {
    expect(uniteCourte('CHF/m²')).toBe('m²')
    expect(uniteCourte('CHF / m2')).toBe('m2')
    expect(uniteCourte('m²')).toBe('m²')
  })

  it('rend null sur une unité absente ou purement monétaire', () => {
    expect(uniteCourte(null)).toBeNull()
    expect(uniteCourte('CHF')).toBeNull()
  })
})

describe('un montant se refait de tête', () => {
  it('tient sur la ligne d’un ouvrage', () => {
    const d = buildDevis([ouvrage({ estimatedCost: '27000', area: 300 })], LABELS, BASE, NU)
    const l = d.blocs.find((b) => b.cle === 'II')!.positions[0].lignes[0]
    expect(l.quantite! * l.prixUnitaire!).toBeCloseTo(l.montant, 2)
  })

  it('tient sur une quantité qui ne tombe pas juste', () => {
    const d = buildDevis([ouvrage({ estimatedCost: '12345', area: 37 })], LABELS, BASE, NU)
    const l = d.blocs.find((b) => b.cle === 'II')!.positions[0].lignes[0]
    expect(l.quantite! * l.prixUnitaire!).toBeCloseTo(l.montant, 0)
  })

  it('tient aussi sur les postes comptés d’office', () => {
    const lignes = postesDeChantier([], BASE, { ...NU, batiment: batiment({ surfacePlancher: 1234 }) })
    const l = lignes.find((x) => x.cfcCode === '287')!
    expect(l.quantite! * l.prixUnitaire!).toBeCloseTo(l.montant, 0)
  })

  it('ne fabrique pas de prix unitaire sans quantité', () => {
    const d = buildDevis([ouvrage({ estimatedCost: '5000', area: null })], LABELS, BASE, NU)
    expect(d.blocs.find((b) => b.cle === 'II')!.positions[0].lignes[0].prixUnitaire).toBeNull()
  })
})

describe('affichage du prix unitaire', () => {
  it('montre les centimes quand il y en a, et pas sinon', () => {
    expect(formatPrixUnitaire(90)).toBe('90 CHF')
    expect(formatPrixUnitaire(90.5)).toMatch(/90[.,]50 CHF/)
  })
})
