import { describe, it, expect, beforeEach } from 'vitest'
import type { ApiArticle, ApiDiagnosticItem } from '../api-types'
import { computeCost, setMarketCoeff } from '../diagnostic-auto'
import { donneesDuBatiment } from './batiment'
import { ouvrageDeLArticle, resolutionDeQuantite } from './pont'
import { quantiteALAjout, quantiteAutomatique, recalculsDesComptages } from './quantite-comptee'
import { repartitionsDuDossier, type Comptage } from './comptages'

const etats = (mauvais: number) => [
  { etat: 'tres_bon' as const, travaux: 'Néant', prix: null, partPrixMauvais: null, unite: 'pce' as const },
  { etat: 'bon' as const, travaux: 'Réglage', prix: 50, partPrixMauvais: null, unite: 'pce' as const },
  { etat: 'moyen' as const, travaux: 'Remise en état', prix: 100, partPrixMauvais: 0.2, unite: 'pce' as const },
  { etat: 'mauvais' as const, travaux: 'Remplacement', prix: mauvais, partPrixMauvais: null, unite: 'pce' as const },
]

const article = (id: string, nom: string, extra: Partial<ApiArticle> = {}): ApiArticle => ({
  id, cfcCode: '273.0', nom, domaineRapport: 'Intérieur', groupeAlternatives: null, echafaudage: false,
  uniteEntretien: 'pce', uniteRemplacement: 'pce', baseQuantite: 'nombre_logements', indicationQuantite: null,
  coefficient: 1, noteDiagnostiqueur: null, articleLieId: null, actif: true, ligneOrigine: null,
  etats: etats(2000), etapes: [{ articleId: id, etapeNumero: 2, ordreDansEtape: 1 }], ...extra,
})

const BOIS = article('A134', 'Portes palières en bois')
// Un article ajouté plus tard au classeur : il rejoint la catégorie par son nom.
const METAL = article('A999', 'Portes palières en métal', { etats: etats(3000) })
const FENETRE_BOIS = article('A019', 'Fenêtres en bois', {
  cfcCode: '221.0', uniteEntretien: 'm2', uniteRemplacement: 'm2', baseQuantite: 'surface_fenetres',
  groupeAlternatives: 'Fenêtres et vitrines', etats: etats(1000).map((e) => ({ ...e, unite: 'm2' as const })),
  etapes: [{ articleId: 'A019', etapeNumero: 1, ordreDansEtape: 1 }],
})
const FENETRE_PVC = article('A021', 'Fenêtres en matière synthétique', {
  ...FENETRE_BOIS, id: 'A021', nom: 'Fenêtres en matière synthétique', etapes: [{ articleId: 'A021', etapeNumero: 1, ordreDansEtape: 2 }],
})
const ARTICLES = [BOIS, METAL, FENETRE_BOIS, FENETRE_PVC]

const C = (extra: Partial<Comptage> = {}): Comptage => ({
  categorie: 'porte_paliere', nombre: 6, surface: null, source: 'plans', detail: '2 par palier × 3 étages = 6',
  pages: ['F1 p. 2'], confiance: 'haute', valide: false, majLe: '2026-10-16T08:00:00.000Z', ...extra,
})

// Huit logements : la règle de la base en donne huit, les plans en ont compté six.
const FICHE = { nbApartments: 8, perimeter: 40, nbFloors: 4, floorHeight: 2.5, windowPct: 25 }
const batiment = (comptages: Record<string, Comptage> | null = { porte_paliere: C() }) =>
  donneesDuBatiment({ ...FICHE, comptages })

const releve = (id: string, a: ApiArticle, extra: Partial<ApiDiagnosticItem> = {}): ApiDiagnosticItem => ({
  id, diagnosticId: 'd', cfcCode: a.cfcCode, cfcLabel: a.nom, catalogItemId: null, articleId: a.id,
  etapeNumero: a.etapes[0].etapeNumero, state: null, priority: null, notes: null, works: [], photos: [],
  area: null, unit: a.uniteEntretien === 'm2' ? 'm²' : 'pce', yearInstalled: null, interventionYear: null,
  estimatedCost: null, improvement: null, improvementCost: null, norms: null, normsCost: null,
  createdAt: '', updatedAt: '', ...extra,
})

beforeEach(() => setMarketCoeff(1))

describe('la quantité d’un ouvrage compté', () => {
  it('vient du comptage et l’emporte sur la règle de la base', () => {
    const r = resolutionDeQuantite(ouvrageDeLArticle(BOIS, 2), batiment())
    expect(r).toEqual({ quantity: 6, origin: 'comptage', basis: '6 portes palières comptées sur les plans' })
  })

  it('sans comptage, rien ne change : la règle de la base', () => {
    const r = resolutionDeQuantite(ouvrageDeLArticle(BOIS, 2), batiment(null))
    expect(r).toEqual({ quantity: 8, origin: 'formule', basis: 'nombre de logements' })
  })

  it('un comptage d’une autre catégorie ne touche pas l’ouvrage', () => {
    const r = resolutionDeQuantite(ouvrageDeLArticle(BOIS, 2), batiment({ balcon: C({ categorie: 'balcon', nombre: 3 }) }))
    expect(r.origin).toBe('formule')
  })

  it('au mètre carré, prend la surface comptée, ou celle de la règle répartie au nombre', () => {
    const avec = resolutionDeQuantite(ouvrageDeLArticle(FENETRE_BOIS, 1), batiment({ fenetre: C({ categorie: 'fenetre', nombre: 24, surface: 40 }) }))
    expect(avec).toMatchObject({ quantity: 40, origin: 'comptage' })
    // Façade 40 × 4 × 2,5 = 400 m², vitrée à 25 % : 100 m² de fenêtres.
    const sans = resolutionDeQuantite(ouvrageDeLArticle(FENETRE_BOIS, 1), batiment({ fenetre: C({ categorie: 'fenetre', nombre: 24 }) }))
    expect(sans).toEqual({ quantity: 100, origin: 'comptage', basis: 'surface de fenêtres répartie selon 24 fenêtres comptées sur les plans' })
  })
})

describe('la quantité d’un relevé compté', () => {
  const repartition = (items: ApiDiagnosticItem[], b = batiment()) =>
    repartitionsDuDossier(b.comptages ?? {}, items, ARTICLES)[0] ?? null

  it('seul de sa catégorie, il prend tout le comptage', () => {
    const items = [releve('r1', BOIS)]
    expect(quantiteAutomatique(items[0], ouvrageDeLArticle(BOIS, 2), batiment(), { repartition: repartition(items), groupe: null })).toBe(6)
  })

  it('à deux types, chacun prend ses unités, et rien tant qu’elles manquent', () => {
    const items = [releve('r1', BOIS, { unites: 2 }), releve('r2', METAL)]
    const r = repartition(items)
    expect(quantiteAutomatique(items[0], ouvrageDeLArticle(BOIS, 2), batiment(), { repartition: r, groupe: null })).toBe(2)
    expect(quantiteAutomatique(items[1], ouvrageDeLArticle(METAL, 2), batiment(), { repartition: r, groupe: null })).toBeUndefined()
  })

  it('les fenêtres se partagent la surface au prorata du nombre, et la part de surface ne s’applique plus', () => {
    const b = batiment({ fenetre: C({ categorie: 'fenetre', nombre: 24 }) })
    const items = [releve('f1', FENETRE_BOIS, { unites: 18, sharePct: 50 }), releve('f2', FENETRE_PVC, { unites: 6, sharePct: 50 })]
    const r = repartition(items, b)
    expect(quantiteAutomatique(items[0], ouvrageDeLArticle(FENETRE_BOIS, 1), b, { repartition: r, groupe: null })).toBe(75)
    expect(quantiteAutomatique(items[1], ouvrageDeLArticle(FENETRE_PVC, 1), b, { repartition: r, groupe: null })).toBe(25)
  })
})

describe('l’ajout d’un type à une catégorie comptée', () => {
  it('le premier prend tout, sans rien fixer', () => {
    expect(quantiteALAjout(ouvrageDeLArticle(BOIS, 2), batiment(), [], ARTICLES)).toEqual({ quantity: 6, aFixer: [] })
  })

  it('le deuxième arrive sans quantité, et le premier garde explicitement ce qu’il avait', () => {
    const r = quantiteALAjout(ouvrageDeLArticle(METAL, 2), batiment(), [releve('r1', BOIS)], ARTICLES)
    expect(r).toEqual({ quantity: undefined, aFixer: [{ id: 'r1', unites: 6 }] })
  })

  it('sans comptage, la règle de la base comme avant', () => {
    expect(quantiteALAjout(ouvrageDeLArticle(METAL, 2), batiment(null), [releve('r1', BOIS)], ARTICLES))
      .toEqual({ quantity: 8, aFixer: [] })
  })
})

describe('les relevés à réécrire quand un comptage change', () => {
  it('réécrit la quantité et le coût d’un relevé fait avec la règle', () => {
    // Relevé fait avec la règle (8 logements), avant que les plans n'en comptent 6.
    const items = [releve('r1', BOIS, { state: 'MAUVAIS', area: 8, estimatedCost: '16000' })]
    expect(recalculsDesComptages(items, ARTICLES, batiment(), ['porte_paliere']))
      .toEqual([{ releveId: 'r1', patch: { area: 6, estimatedCost: 12000, costIndex: 1 } }])
  })

  it('ne touche ni une quantité reprise à la main, ni un coût forcé', () => {
    expect(recalculsDesComptages([releve('r1', BOIS, { area: 3, quantityManual: true })], ARTICLES, batiment(), ['porte_paliere'])).toEqual([])
    const force = recalculsDesComptages([releve('r1', BOIS, { state: 'MAUVAIS', area: 8, costManual: true, estimatedCost: '500' })], ARTICLES, batiment(), ['porte_paliere'])
    expect(force).toEqual([{ releveId: 'r1', patch: { area: 6 } }])
  })

  it('vide la quantité d’un type qui n’a pas encore son nombre', () => {
    const items = [releve('r1', BOIS, { unites: 2, area: 2 }), releve('r2', METAL, { area: 6 })]
    expect(recalculsDesComptages(items, ARTICLES, batiment(), ['porte_paliere']))
      .toEqual([{ releveId: 'r2', patch: { area: null } }])
  })

  it('un comptage retiré rend la règle de la base, part de surface comprise', () => {
    const b = batiment(null)
    const items = [releve('f1', FENETRE_BOIS, { sharePct: 40, unites: 18, area: 75 })]
    // Sa part de 40 % revient sur les 100 m² de fenêtres que donne la règle.
    expect(recalculsDesComptages(items, ARTICLES, b, ['fenetre'])).toEqual([{ releveId: 'f1', patch: { area: 40 } }])
  })

  it('laisse les catégories qui n’ont pas changé', () => {
    const items = [releve('r1', BOIS, { area: 8 })]
    expect(recalculsDesComptages(items, ARTICLES, batiment(), ['balcon'])).toEqual([])
  })
})

describe('changer le nombre d’unités d’un type', () => {
  it('réécrit la quantité et le coût, sauf ce qui a été repris à la main', async () => {
    const { patchDesUnites } = await import('./quantite-comptee')
    const items = [releve('r1', BOIS, { unites: 6, state: 'MAUVAIS' }), releve('r2', METAL)]
    const r = repartitionsDuDossier(batiment().comptages ?? {}, items, ARTICLES)[0]
    expect(patchDesUnites(items[0], 2, ouvrageDeLArticle(BOIS, 2), batiment(), r))
      .toEqual({ unites: 2, area: 2, estimatedCost: 4000, costIndex: 1 })
    expect(patchDesUnites({ ...items[0], quantityManual: true }, 2, ouvrageDeLArticle(BOIS, 2), batiment(), r)).toEqual({ unites: 2 })
    expect(patchDesUnites(items[1], null, ouvrageDeLArticle(METAL, 2), batiment(), r)).toEqual({ unites: null, area: null })
  })
})

describe('une quantité mesurée sur place garde sa mesure, pas son silence', () => {
  // France 78 : l'étanchéité de toiture plate, en mauvais état, 232,23 m²
  // relevés au mètre sur place, sortait du devis « à chiffrer : aucun prix
  // pour cet état dans la base » — alors que la base en a un. La passe de
  // recalcul s'arrêtait sur `quantityManual` avant d'écrire le montant, et le
  // verrou de la quantité verrouillait aussi le prix.
  const MESURE = { quantityManual: true, area: 232.23, state: 'MAUVAIS' as const }

  it('chiffre le relevé sans toucher à la mesure', () => {
    const r = recalculsDesComptages(
      [releve('x', FENETRE_BOIS, MESURE)], ARTICLES, batiment(), 'tous',
    )
    expect(r).toHaveLength(1)
    // 232,23 m² × 1 000.-/m² : la mesure du terrain, le prix de la base.
    expect(r[0].patch.estimatedCost).toBe(232_230)
    expect(r[0].patch.area).toBeUndefined()
  })

  it('ne touche pas à un montant déjà chiffré', () => {
    const r = recalculsDesComptages(
      [releve('x', FENETRE_BOIS, { ...MESURE, estimatedCost: '180000' })], ARTICLES, batiment(), 'tous',
    )
    expect(r).toHaveLength(0)
  })

  it('ne touche pas à un prix repris à la main, même absent', () => {
    const r = recalculsDesComptages(
      [releve('x', FENETRE_BOIS, { ...MESURE, costManual: true })], ARTICLES, batiment(), 'tous',
    )
    expect(r).toHaveLength(0)
  })

  it('chiffre aussi un relevé dont la quantité automatique est déjà juste', () => {
    // Même panne, sans mesure sur place : la quantité ne bougeait pas, donc le
    // montant ne s'écrivait jamais.
    const auto = recalculsDesComptages([releve('x', BOIS, { state: 'MAUVAIS' })], ARTICLES, batiment(), 'tous')
    const quantite = auto[0].patch.area
    const r = recalculsDesComptages(
      [releve('x', BOIS, { state: 'MAUVAIS', area: quantite as number })], ARTICLES, batiment(), 'tous',
    )
    expect(r).toHaveLength(1)
    expect(r[0].patch.estimatedCost).toBe(auto[0].patch.estimatedCost)
  })

  it('laisse tranquille un relevé sans état : il n’a rien à chiffrer', () => {
    const r = recalculsDesComptages([releve('x', FENETRE_BOIS, { quantityManual: true, area: 232.23 })], ARTICLES, batiment(), 'tous')
    expect(r).toHaveLength(0)
  })
})

describe('une amélioration retenue sans montant se chiffre', () => {
  // France 78 : « Façade en crépi non isolée · Amélioration · à chiffrer :
  // amélioration retenue sans montant », alors que la base dit 310.-/m². Le
  // montant ne s'écrivait qu'au moment où on retenait l'enveloppe ; retenue
  // avant que la base ait son prix, elle le restait pour toujours.
  const AVEC_PRIX = article('A015', 'Façade crépie non isolée', {
    cfcCode: '226.1', uniteEntretien: 'm2', uniteRemplacement: 'm2', baseQuantite: 'surface_facade',
    etats: [
      ...etats(400).map((e) => ({ ...e, unite: 'm2' as const })),
      { etat: 'amelioration' as const, travaux: 'Façade ventilée', prix: 310, partPrixMauvais: null, unite: 'm2' as const },
      { etat: 'normes' as const, travaux: 'Garde-corps au gabarit', prix: 90, partPrixMauvais: null, unite: 'm2' as const },
    ],
    etapes: [{ articleId: 'A015', etapeNumero: 1, ordreDansEtape: 1 }],
  })
  const AVEC = [...ARTICLES, AVEC_PRIX]
  const quantite = () => resolutionDeQuantite(ouvrageDeLArticle(AVEC_PRIX, 1), batiment()).quantity!

  it('comble le montant depuis le prix de la base', () => {
    const r = recalculsDesComptages(
      [releve('x', AVEC_PRIX, { state: 'MOYEN', area: quantite(), improvement: 'Façade ventilée' })],
      AVEC, batiment(), 'tous',
    )
    expect(r[0].patch.improvementCost).toBe(Math.round(quantite() * 310))
  })

  it('comble aussi une mise aux normes retenue sans montant', () => {
    const r = recalculsDesComptages(
      [releve('x', AVEC_PRIX, { state: 'MOYEN', area: quantite(), norms: 'Garde-corps au gabarit' })],
      AVEC, batiment(), 'tous',
    )
    expect(r[0].patch.normsCost).toBe(Math.round(quantite() * 90))
  })

  it('n’écrase pas une amélioration déjà chiffrée à la main', () => {
    const r = recalculsDesComptages(
      [releve('x', AVEC_PRIX, { state: 'MOYEN', area: quantite(), improvement: 'Façade ventilée', improvementCost: '99000' })],
      AVEC, batiment(), 'tous',
    )
    expect(r.find((x) => x.patch.improvementCost !== undefined)).toBeUndefined()
  })

  it('laisse « à chiffrer » ce que la base ne chiffre pas', () => {
    // 36 améliorations du classeur n'ont pas de prix : elles doivent rester
    // visibles à chiffrer, pas sortir un montant inventé.
    const sansPrix = article('A038', 'Volets roulants', {
      cfcCode: '228.1',
      etats: [...etats(180), { etat: 'amelioration' as const, travaux: 'Isolation des caissons', prix: null, partPrixMauvais: null, unite: 'pce' as const }],
      etapes: [{ articleId: 'A038', etapeNumero: 1, ordreDansEtape: 3 }],
    })
    const r = recalculsDesComptages(
      [releve('x', sansPrix, { state: 'MAUVAIS', area: 93, improvement: 'Isolation des caissons' })],
      [...ARTICLES, sansPrix], batiment(), 'tous',
    )
    expect(r.find((x) => x.patch.improvementCost !== undefined)).toBeUndefined()
  })
})

describe('un état chiffré au forfait', () => {
  // La chaudière gaz de la base v6 : entretien au forfait, remplacement au m² de plancher.
  const CHAUDIERE = article('A062', 'Chaudière gaz à condensation', {
    cfcCode: '242.0', uniteEntretien: 'forfait', uniteRemplacement: 'm2', baseQuantite: 'surface_plancher',
    etats: [
      { etat: 'bon', travaux: 'Nettoyage, réglage et contrôle', prix: 1500, partPrixMauvais: null, unite: 'forfait' },
      { etat: 'moyen', travaux: 'Remplacement du brûleur', prix: 4000, partPrixMauvais: null, unite: 'forfait' },
      { etat: 'mauvais', travaux: 'Remplacement de la chaudière', prix: 18, partPrixMauvais: null, unite: 'm2' },
    ],
  })
  const plancher = donneesDuBatiment({ ...FICHE, floorArea: 3620, comptages: null })
  const chaudiere = (extra: Partial<ApiDiagnosticItem>) => releve('c', CHAUDIERE, { area: 3620, unit: 'forfait', ...extra })

  it('se compte une fois, et le remplacement au m²', () => {
    const o = ouvrageDeLArticle(CHAUDIERE)
    expect(computeCost(o, 'MOYEN', 3620)).toBe(4000)
    expect(computeCost(o, 'MAUVAIS', 3620)).toBe(65160)
  })

  it('répare un forfait multiplié par les m² de plancher', () => {
    const [r] = recalculsDesComptages([chaudiere({ state: 'MOYEN', estimatedCost: '14480000' })], [CHAUDIERE], plancher, 'tous')
    expect(r.patch.estimatedCost).toBe(4000)
  })

  it('ne touche pas un montant repris à la main', () => {
    expect(recalculsDesComptages([chaudiere({ state: 'MOYEN', estimatedCost: '14480000', costManual: true })], [CHAUDIERE], plancher, 'tous')).toEqual([])
  })
})
