import { describe, it, expect, beforeEach } from 'vitest'
import type { ApiArticle, ApiDiagnosticItem } from '../api-types'
import { setMarketCoeff } from '../diagnostic-auto'
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
