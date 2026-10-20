import { describe, it, expect, beforeEach } from 'vitest'
import {
  annonceDesVariantes, buildDevis, cascadeDe, enveloppeDe, listeEnClair, postesDeChantier, sansPrixAnnonce, uniteCourte,
  type Devis,
} from './devis'
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
// L'installation de chantier se règle par dossier : à zéro ici, pour que les
// montants attendus ne portent que ce que chaque test regarde.
const SANS_INSTALLATION = { pct: 0, minimum: 0 }
const NU = { honoraryPct: 0, reservePct: 0, batiment: batiment(), installation: SANS_INSTALLATION }

/** Les lignes tirées des relevés, sans les postes de chantier. */
const travaux = (d: Devis) => d.lignes.filter((l) => l.releveId != null)

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
    expect(travaux(d).map((l) => l.enveloppe)).toEqual(['Réparation', 'Mise aux normes'])
  })

  it('compte l’amélioration au total général, dans son enveloppe', () => {
    const d = buildDevis(
      [ouvrage({ estimatedCost: '12000', improvementCost: '40000', improvement: 'Isolation périphérique' })],
      LABELS, BASE, NU,
    )
    expect(travaux(d).map((l) => l.enveloppe)).toEqual(['Réparation', 'Amélioration'])
    expect(enveloppeDe(d, 'Amélioration').ht).toBe(40_000)
    expect(enveloppeDe(d, 'Réparation').ht).toBe(12_000)
    // Le total général porte aussi les postes comptés d'office.
    expect(d.ht - enveloppeDe(d, 'Poste de chantier').ht).toBe(52_000)
  })

  it('fait retomber la somme des enveloppes sur le total général, TTC compris', () => {
    const d = buildDevis(
      [
        ouvrage({ id: 'a', estimatedCost: '12000', area: 400, normsCost: '3000', norms: 'Garde-corps' }),
        ouvrage({ id: 'b', articleId: 'A100', etapeNumero: 5, cfcCode: '285.1', estimatedCost: '9000', improvement: 'Peinture minérale', improvementCost: '4000' }),
      ],
      LABELS, BASE,
      {
        honoraryPct: 12, reservePct: 10, batiment: batiment({ surfacePlancher: 1200, surfaceFacade: 400 }),
        installation: { pct: 3, minimum: 0 }, frais: [{ libelle: 'Autorisations', pct: null, montant: 2500 }, { libelle: 'Assurances', pct: 0.5, montant: null }],
      },
    )
    const ht = d.enveloppes.reduce((s, e) => s + e.ht, 0)
    const ttc = d.enveloppes.reduce((s, e) => s + e.cascade.total, 0)
    expect(ht).toBe(d.ht)
    expect(ttc).toBeCloseTo(d.cascade.total, 6)
    expect(d.lignes.reduce((s, l) => s + l.montant, 0)).toBe(d.ht)
  })

  it('garde au devis, à chiffrer, un état Moyen sans prix', () => {
    // L'étanchéité de toiture en priorité I à 0 CHF disparaissait du total.
    const d = buildDevis([ouvrage({ estimatedCost: null, area: 300 })], LABELS, BASE, NU)
    const l = travaux(d)[0]
    expect(l).toMatchObject({ enveloppe: 'Réparation', aChiffrer: true, montant: 0, priorite: 'II' })
    expect(d.aChiffrer.filter((x) => x.releveId)).toHaveLength(1)
  })

  it('ne prescrit rien là où la base dit « Néant » pour l’état', () => {
    const neant = { ...BASE, articles: [article({ etats: [{ etat: 'moyen', travaux: 'Néant', prix: null, partPrixMauvais: null, unite: 'm2' }] }), A009, A100] }
    const d = buildDevis([ouvrage({ estimatedCost: null })], LABELS, neant, NU)
    expect(travaux(d)).toHaveLength(0)
  })

  it('laisse hors du devis un ouvrage pas encore évalué', () => {
    const d = buildDevis([ouvrage({ state: null, priority: null, estimatedCost: null })], LABELS, BASE, NU)
    expect(travaux(d)).toHaveLength(0)
  })

  it('montre à chiffrer une amélioration retenue sans montant', () => {
    const d = buildDevis(
      [ouvrage({ state: 'BON', priority: 'III', estimatedCost: null, improvement: 'Isolation des caissons de stores', improvementCost: null })],
      LABELS, BASE, NU,
    )
    expect(travaux(d)).toEqual([expect.objectContaining({ enveloppe: 'Amélioration', aChiffrer: true })])
  })

  it('calcule le prix unitaire appliqué, que le client peut recalculer', () => {
    const d = buildDevis([ouvrage({ estimatedCost: '18000', area: 200 })], LABELS, BASE, NU)
    const l = travaux(d)[0]
    expect(l.prixUnitaire).toBe(90)
    expect(l.quantite! * l.prixUnitaire!).toBeCloseTo(l.montant, 2)
  })

  it('laisse le prix unitaire vide plutôt que de diviser par zéro', () => {
    const d = buildDevis([ouvrage({ estimatedCost: '18000', area: 0 })], LABELS, BASE, NU)
    expect(travaux(d)[0].prixUnitaire).toBeNull()
  })
})

describe('un seul compteur par priorité', () => {
  it('compte les lignes de travaux, les mêmes pour la synthèse et le récapitulatif', () => {
    const d = buildDevis([
      ouvrage({ id: 'a', priority: 'I', state: 'MAUVAIS', estimatedCost: '10000', norms: 'Garde-corps', normsCost: '2000' }),
      ouvrage({ id: 'b', priority: 'I', state: 'MAUVAIS', estimatedCost: '5000' }),
      ouvrage({ id: 'c', priority: 'III', state: 'BON', estimatedCost: null, improvement: 'ITE', improvementCost: '30000' }),
    ], LABELS, BASE, { ...NU, batiment: batiment({ surfacePlancher: 800, surfaceFacade: 400 }) })
    expect(d.priorites.map((p) => [p.cle, p.lignes, p.ht])).toEqual([
      ['I', 3, 17_000], ['II', 0, 0], ['III', 1, 30_000],
    ])
  })
})

describe('le prix annoncé est le prix appliqué', () => {
  it('retire du texte le prix qu’il annonce', () => {
    expect(sansPrixAnnonce("Ajout d'isolation, épaisseur 16 cm, à 260 CHF/m²")).toBe("Ajout d'isolation, épaisseur 16 cm")
    expect(sansPrixAnnonce('Remplacement complet')).toBe('Remplacement complet')
  })

  it('dit l’indexation quand elle change le prix du catalogue', () => {
    setMarketCoeff(1.476)
    const base = { ...BASE, articles: [article({ etats: [{ etat: 'amelioration', travaux: 'ITE', prix: 260, partPrixMauvais: null, unite: 'm2' }] }), A009, A100] }
    const d = buildDevis(
      [ouvrage({ state: 'BON', estimatedCost: null, area: 100, improvement: 'ITE, à 260 CHF/m²', improvementCost: String(Math.round(260 * 100 * 1.476)) })],
      LABELS, base, NU,
    )
    const l = travaux(d).find((x) => x.enveloppe === 'Amélioration')!
    expect(l.remarque).toBe('ITE')
    expect(l.indexation).toEqual({ prixCatalogue: 260, coeff: 1.476 })
    expect(l.prixModifie).toBe(false)
  })

  it('signale un prix repris à la main', () => {
    const d = buildDevis([ouvrage({ estimatedCost: '20000', area: 100, costManual: true })], LABELS, BASE, NU)
    expect(travaux(d)[0].prixModifie).toBe(true)
  })

  it('repère les variantes annoncées pour un seul montant', () => {
    expect(annonceDesVariantes('Réhaussement OU / ET remplissage')).toBe(true)
    expect(annonceDesVariantes('Remplacement des joints')).toBe(false)
  })
})

describe('une amélioration remplace la réparation qu’elle rend inutile', () => {
  it('déduit la réfection du crépi et le nettoyage de la même façade, sous l’amélioration', () => {
    const d = buildDevis([
      ouvrage({ id: 'crepi', estimatedCost: '30000', area: 400, improvement: 'Isolation périphérique', improvementCost: '124000', improvementReplaces: ['crepi', 'nettoyage'] }),
      ouvrage({ id: 'nettoyage', articleId: 'A009', cfcCode: '215.2', cfcLabel: 'Nettoyage de façade', estimatedCost: '6000', area: 400 }),
    ], LABELS, BASE, { ...NU, batiment: batiment({ surfaceFacade: 400 }) })
    const amelioration = enveloppeDe(d, 'Amélioration')
    expect(amelioration.ht).toBe(124_000 - 30_000 - 6000)
    // La réparation reste entière dans son enveloppe : on peut ne pas faire l'amélioration.
    expect(enveloppeDe(d, 'Réparation').ht).toBe(36_000)
    const i = d.lignes.findIndex((l) => l.cle === 'crepi:Amélioration')
    expect(d.lignes[i + 1]).toMatchObject({ montant: -30_000, rattacheA: 'crepi:Amélioration' })
  })

  it('ne déduit rien d’une amélioration sans montant', () => {
    const d = buildDevis([
      ouvrage({ id: 'crepi', estimatedCost: '30000', improvement: 'ITE', improvementCost: null, improvementReplaces: ['crepi'] }),
    ], LABELS, BASE, NU)
    expect(d.lignes.some((l) => l.montant < 0)).toBe(false)
  })
})

describe('l’installation de chantier', () => {
  const lignes = [ouvrage({ estimatedCost: '100000' })]

  it('paraît à chiffrer tant que le dossier ne l’a pas réglée', () => {
    const d = buildDevis(lignes, LABELS, BASE, { ...NU, installation: undefined })
    expect(d.lignes.find((l) => l.cfcCode === '211.0')).toMatchObject({ aChiffrer: true, enveloppe: 'Poste de chantier' })
  })

  it('prend un pourcentage des travaux, avec un minimum', () => {
    const pct = buildDevis(lignes, LABELS, BASE, { ...NU, installation: { pct: 4, minimum: 3000 } })
    expect(pct.lignes.find((l) => l.cfcCode === '211.0')!.montant).toBe(4000)
    const min = buildDevis(lignes, LABELS, BASE, { ...NU, installation: { pct: 2, minimum: 5000 } })
    expect(min.lignes.find((l) => l.cfcCode === '211.0')!.montant).toBe(5000)
  })

  it('disparaît quand le dossier la met à zéro', () => {
    const d = buildDevis(lignes, LABELS, BASE, NU)
    expect(d.lignes.find((l) => l.cfcCode === '211.0')).toBeUndefined()
  })
})

describe('les frais secondaires', () => {
  it('s’ajoutent après la réserve, en pourcentage ou en montant', () => {
    const c = cascadeDe(100_000, 10, 5, [{ libelle: 'Assurances', pct: 1, montant: null }, { libelle: 'Taxes', pct: null, montant: 2000 }])
    expect(c.frais).toBe(3000)
    expect(c.sousTotal).toBeCloseTo(100_000 + 10_000 + 5_500 + 3000, 6)
  })
})

describe('règle 9, une ligne par étape', () => {
  const cage = ouvrage({ id: 'r1', articleId: 'A100', etapeNumero: 2, cfcCode: '285.1', cfcLabel: 'Peinture intérieure – murs', estimatedCost: '9600' })
  const appartements = ouvrage({ id: 'r2', articleId: 'A100', etapeNumero: 5, cfcCode: '285.1', cfcLabel: 'Peinture intérieure – murs', estimatedCost: '28800' })

  it('nomme l’étape de chaque ligne quand l’ouvrage est relevé deux fois', () => {
    const d = buildDevis([cage, appartements], LABELS, BASE, NU)
    expect(travaux(d).map((l) => l.libelle).sort()).toEqual([
      'Peinture intérieure – murs · Appartements',
      "Peinture intérieure – murs · Cage d'escalier",
    ])
  })

  it('n’alourdit pas le libellé d’un ouvrage relevé une seule fois', () => {
    const d = buildDevis([ouvrage({ estimatedCost: '12000' })], LABELS, BASE, NU)
    expect(travaux(d)[0].libelle).toBe('Façade crépie non isolée')
  })

  it('trie les positions par code CFC, à l’usage suisse', () => {
    const d = buildDevis(
      [cage, ouvrage({ estimatedCost: '12000' })],
      LABELS, BASE, { ...NU, batiment: batiment({ surfacePlancher: 1200, surfaceFacade: 400 }) },
    )
    expect(d.positions.map((p) => p.code)).toEqual(['121', '211', '226', '285', '287'])
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

describe('règle 8, l’échafaudage des améliorations', () => {
  const ite = ouvrage({ state: 'BON', priority: 'III', estimatedCost: null, improvement: 'Isolation périphérique crépie', improvementCost: '124000', area: 400 })
  const opts = { ...NU, batiment: batiment({ surfaceFacade: 400 }) }

  it('porte dans l’enveloppe des améliorations l’échafaudage qu’aucun autre travail ne monte', () => {
    const d = buildDevis([ite], LABELS, BASE, opts)
    const l = d.lignes.find((x) => x.cle === 'auto:211.1:amelioration')!
    expect(l).toMatchObject({ enveloppe: 'Amélioration', quantite: 400, montant: 14_000 })
    expect(enveloppeDe(d, 'Amélioration').ht).toBe(138_000)
    expect(d.surfaceEchafaudee).toBe(400)
  })

  it('ne le compte pas deux fois quand les réparations échafaudent déjà la façade', () => {
    const d = buildDevis([ouvrage({ id: 'r', estimatedCost: '72000', area: 400 }), { ...ite, id: 'i' }], LABELS, BASE, opts)
    expect(d.lignes.find((x) => x.cle === 'auto:211.1:amelioration')).toBeUndefined()
    expect(d.lignes.filter((x) => x.cfcCode === '211.1')).toHaveLength(1)
    expect(d.surfaceEchafaudee).toBe(400)
  })

  it('ne compte que le complément quand les réparations n’en échafaudent qu’une partie', () => {
    const d = buildDevis([ouvrage({ id: 'r', estimatedCost: '36000', area: 200 }), { ...ite, id: 'i', articleId: 'A009', cfcCode: '215.2', area: 200 }], LABELS, BASE, opts)
    expect(d.lignes.find((x) => x.cle === 'auto:211.1:amelioration')!.quantite).toBe(200)
    expect(d.surfaceEchafaudee).toBe(400)
  })

  it('se tait pour une amélioration qui ne demande pas d’échafaudage', () => {
    const interieur = ouvrage({
      articleId: 'A100', etapeNumero: 5, cfcCode: '285.1', state: 'BON', estimatedCost: null,
      improvement: 'Peinture minérale', improvementCost: '20000',
    })
    expect(buildDevis([interieur], LABELS, BASE, opts).lignes.some((x) => x.cfcCode === '211.1')).toBe(false)
  })
})

describe('l’accord des listes générées', () => {
  it('accorde « autre » au singulier', () => {
    expect(listeEnClair(['a', 'b', 'c', 'd'])).toBe('a, b, c et 1 autre ouvrage')
    expect(listeEnClair(['a', 'b', 'c', 'd', 'e'])).toBe('a, b, c et 2 autres ouvrages')
    expect(listeEnClair(['a', 'b'])).toBe('a et b')
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
    const l = travaux(d)[0]
    expect(l.quantite! * l.prixUnitaire!).toBeCloseTo(l.montant, 2)
  })

  it('tient sur une quantité qui ne tombe pas juste', () => {
    const d = buildDevis([ouvrage({ estimatedCost: '12345', area: 37 })], LABELS, BASE, NU)
    const l = travaux(d)[0]
    expect(l.quantite! * l.prixUnitaire!).toBeCloseTo(l.montant, 0)
  })

  it('tient aussi sur les postes comptés d’office', () => {
    const lignes = postesDeChantier([], BASE, { ...NU, batiment: batiment({ surfacePlancher: 1234 }) })
    const l = lignes.find((x) => x.cfcCode === '287')!
    expect(l.quantite! * l.prixUnitaire!).toBeCloseTo(l.montant, 0)
  })

  it('ne fabrique pas de prix unitaire sans quantité', () => {
    const d = buildDevis([ouvrage({ estimatedCost: '5000', area: null })], LABELS, BASE, NU)
    expect(travaux(d)[0].prixUnitaire).toBeNull()
  })

  it('garde à chiffrer un poste dont la quantité manque', () => {
    const d = buildDevis([ouvrage({ estimatedCost: '5000' })], LABELS, BASE, NU)
    expect(d.lignes.find((l) => l.cfcCode === '287')).toMatchObject({ aChiffrer: true, montant: 0 })
  })
})

describe('affichage du prix unitaire', () => {
  it('montre les centimes quand il y en a, et pas sinon', () => {
    expect(formatPrixUnitaire(90)).toBe('90 CHF')
    expect(formatPrixUnitaire(90.5)).toMatch(/90[.,]50 CHF/)
  })
})
