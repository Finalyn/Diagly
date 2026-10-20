import { describe, it, expect, beforeEach } from 'vitest'
import { controlerLeRapport, doublons, fusionner, surfacesDepassees } from './controles-rapport'
import { buildDevis } from './devis'
import { setMarketCoeff } from './diagnostic-auto'
import type { ApiArticle, ApiDiagnosticItem, ApiEtapeVisite } from './api-types'

const releve = (o: Partial<ApiDiagnosticItem>): ApiDiagnosticItem => ({
  id: 'x', diagnosticId: 'd', cfcCode: '281.1', cfcLabel: 'Carrelage', catalogItemId: null, articleId: 'A200', etapeNumero: 5,
  state: 'BON', priority: 'III', notes: null, works: [], photos: [], area: null, unit: null, yearInstalled: null,
  interventionYear: null, estimatedCost: null, improvement: null, improvementCost: null, norms: null, normsCost: null,
  createdAt: '', updatedAt: '', ...o,
})

const article = (o: Partial<ApiArticle>): ApiArticle => ({
  id: 'A200', cfcCode: '281.1', nom: 'Carrelage', domaineRapport: 'Intérieur – sols', groupeAlternatives: null,
  echafaudage: false, uniteEntretien: 'm2', uniteRemplacement: 'm2', baseQuantite: 'surface_plancher', indicationQuantite: null,
  coefficient: 1, noteDiagnostiqueur: null, articleLieId: null, actif: true, ligneOrigine: null, etats: [], etapes: [], ...o,
})

const CREPI = article({ id: 'A015', cfcCode: '226.1', nom: 'Façade crépie', domaineRapport: 'Façades', groupeAlternatives: 'Revêtement de façade', echafaudage: true, baseQuantite: 'surface_facade' })
const PIERRE = article({ id: 'A016', cfcCode: '216.1', nom: 'Façade en pierre', domaineRapport: 'Façades', groupeAlternatives: 'Revêtement de façade', echafaudage: true, baseQuantite: 'surface_facade' })
const ARTICLES = [article({}), CREPI, PIERRE]
const ETAPES: ApiEtapeVisite[] = [{ numero: 1, nom: 'Façade', zone: 'Extérieur' }, { numero: 5, nom: 'Appartements', zone: 'Logements' }]
const FICHE = { perimeter: 50, nbFloors: 4, floorHeight: 2.5, floorArea: 800 }

beforeEach(() => setMarketCoeff(1))

const controle = (items: ApiDiagnosticItem[]) => controlerLeRapport({
  items, articles: ARTICLES, etapes: ETAPES, fiche: FICHE,
  devis: buildDevis(items, new Map(), { articles: ARTICLES, postes: [], etapes: ETAPES }, { honoraryPct: 0, reservePct: 0, batiment: { surfacePlancher: 800, surfaceBatie: null, surfaceTerrain: null, surfaceFacade: 500, surfaceFenetres: null, nombreLogements: null, nombrePiecesEau: null, nombreEtages: 4, nombreCages: null, nombrePortesEntree: null, hauteur: null }, installation: { pct: 0, minimum: 0 } }),
})

describe('les doublons', () => {
  it('repère le même ouvrage relevé trois fois dans la même zone', () => {
    const g = doublons([
      releve({ id: 'a', state: 'TRES_BON' }), releve({ id: 'b', state: 'BON' }), releve({ id: 'c', state: null }),
      releve({ id: 'd', etapeNumero: 2 }),
    ])
    expect(g.map((x) => x.map((i) => i.id))).toEqual([['a', 'b', 'c']])
  })

  it('fusionne sans rien perdre de ce qui a été vu sur place', () => {
    const f = fusionner([
      releve({ id: 'a', photos: ['p1'], notes: 'Joints fissurés' }),
      releve({ id: 'b', photos: ['p2', 'p1'], notes: 'Deux carreaux cassés', yearInstalled: 1995 }),
    ], 'a')
    expect(f).toEqual({ garde: 'a', retires: ['b'], patch: { photos: ['p1', 'p2'], notes: 'Joints fissurés\nDeux carreaux cassés', yearInstalled: 1995 } })
  })
})

describe('les bornes des surfaces', () => {
  it('signale des façades saisies sur plus que la façade du bâtiment', () => {
    // 50 ml × 4 étages × 2,5 m = 500 m² de façade ; 400 + 300 saisis à la main.
    const d = surfacesDepassees([
      releve({ id: 'c', articleId: 'A015', etapeNumero: 1, area: 400, sharePct: 50 }),
      releve({ id: 'p', articleId: 'A016', etapeNumero: 1, area: 300, sharePct: 50 }),
    ], ARTICLES, FICHE)
    expect(d).toEqual([expect.objectContaining({ saisi: 700, reference: 500, releveIds: ['c', 'p'] })])
  })

  it('se tait quand les surfaces tiennent', () => {
    expect(surfacesDepassees([
      releve({ id: 'c', articleId: 'A015', etapeNumero: 1, area: 250, sharePct: 50 }),
      releve({ id: 'p', articleId: 'A016', etapeNumero: 1, area: 250, sharePct: 50 }),
    ], ARTICLES, FICHE)).toEqual([])
  })
})

describe('le contrôle avant envoi', () => {
  it('bloque un état Mauvais sans prix et un état dégradé sans observation', () => {
    const c = controle([releve({ id: 'toit', cfcCode: '225.1', cfcLabel: 'Étanchéité de toiture', articleId: null, state: 'MAUVAIS', priority: 'I', works: ['Réfection complète'], area: 300 })])
    expect(c.map((x) => [x.genre, x.gravite])).toEqual([['sans-prix', 'bloquant'], ['sans-observation', 'bloquant']])
    expect(c[0].titre).toContain('priorité I')
  })

  it('liste les ouvrages non évalués sans bloquer', () => {
    const c = controle([releve({ id: 'n', state: null, priority: null })])
    expect(c).toEqual([expect.objectContaining({ genre: 'non-evalue', gravite: 'a-verifier' })])
  })

  it('soupçonne un bon état largement au-delà de sa durée de vie', () => {
    const c = controle([releve({ id: 'f', cfcCode: '221.1', cfcLabel: 'Fenêtres PVC', articleId: null, state: 'BON', yearInstalled: 1950 })])
    expect(c).toEqual([expect.objectContaining({ genre: 'duree-incoherente' })])
  })
})
