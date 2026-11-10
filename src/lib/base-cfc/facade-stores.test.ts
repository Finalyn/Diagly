import { describe, expect, it } from 'vitest'
import { alerteFacade } from './facade-stores'
import type { ApiArticle, ApiDiagnosticItem } from '../api-types'

const releve = (o: Partial<ApiDiagnosticItem>): ApiDiagnosticItem => ({
  id: 'x', diagnosticId: 'd', cfcCode: '226.1', cfcLabel: 'Façade crépie non isolée', catalogItemId: null,
  articleId: 'A015', etapeNumero: 1, state: 'BON', priority: null, notes: null, works: [], photos: [],
  area: null, unit: null, yearInstalled: null, interventionYear: null, estimatedCost: null,
  improvement: null, improvementCost: null, norms: null, normsCost: null, createdAt: '', updatedAt: '', ...o,
})
const ARTICLES = [
  { id: 'A015', groupeAlternatives: 'Revêtement de façade' },
  { id: 'A038', groupeAlternatives: null },
] as ApiArticle[]

const facade = (o: Partial<ApiDiagnosticItem> = {}) => releve({ id: 'f', ...o })
const volets = (o: Partial<ApiDiagnosticItem> = {}) => releve({ id: 'v', cfcCode: '228.1', cfcLabel: 'Volets roulants', articleId: 'A038', ...o })

describe('les stores d’une façade refaite', () => {
  it('se taisent tant que la façade n’est ni mauvaise ni améliorée', () => {
    expect(alerteFacade([facade({ state: 'MOYEN' }), volets()], ARTICLES)).toBeNull()
  })

  it('demandent une décision quand la façade est mauvaise ou améliorée', () => {
    expect(alerteFacade([facade({ state: 'MAUVAIS' }), volets()], ARTICLES)!.aTraiter.map((i) => i.id)).toEqual(['v'])
    expect(alerteFacade([facade({ improvement: 'Isolation périphérique' }), volets()], ARTICLES)!.aTraiter).toHaveLength(1)
  })

  it('ne redemandent rien une fois déposés, remplacés ou mauvais', () => {
    for (const v of [volets({ deposeRepose: true }), volets({ remplacement: true }), volets({ state: 'MAUVAIS' })]) {
      expect(alerteFacade([facade({ state: 'MAUVAIS' }), v], ARTICLES)!.aTraiter).toEqual([])
    }
  })

  it('laissent de côté les films contre l’éblouissement, collés sur le vitrage', () => {
    const film = releve({ id: 'film', cfcCode: '228.4', articleId: 'A041' })
    expect(alerteFacade([facade({ state: 'MAUVAIS' }), film], ARTICLES)!.aTraiter).toEqual([])
  })
})
