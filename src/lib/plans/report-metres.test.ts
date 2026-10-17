import { describe, it, expect } from 'vitest'
import { comptagesDuJeu, resumeDuReport } from './report-metres'
import { panneauDesQuantites, type PlanPourQuantites } from './quantites'
import type { PlanAnnotation } from '../api-types'

const ECHELLE = { id: 'pages', type: 'pages' as const, points: [], pageScales: { 1: 10, 2: 10 } }
let n = 0
const repere = (page: number, categorie: 'porte_paliere' | 'cuisine', aValider = false): PlanAnnotation => ({
  id: `r${n++}`, type: 'repere', page, points: [{ x: 1, y: 1 }], repere: { categorie, numero: 1, ...(aValider ? { aValider } : {}) },
})
const zone = (page: number, cote: number, itemId: string): PlanAnnotation => ({
  id: `z${n++}`, type: 'hatch', page, itemId, typeZone: 'piece',
  points: [{ x: 0, y: 0 }, { x: cote * 10, y: 0 }, { x: cote * 10, y: cote * 10 }, { x: 0, y: cote * 10 }],
})

const jeu: PlanPourQuantites[] = [{
  plan: {
    id: 'p', name: 'Jeu', mimeType: 'application/pdf', scalePxPerM: null,
    annotations: [
      ECHELLE,
      repere(1, 'cuisine'),
      repere(2, 'porte_paliere'), repere(2, 'porte_paliere'), repere(2, 'cuisine'), repere(2, 'cuisine', true),
      zone(1, 5, 'sol'), zone(2, 4, 'sol'),
    ],
  },
  feuilles: { pages: { 1: { type: 'plan_etage', niveau: 'Rez' }, 2: { type: 'plan_etage', niveau: '1er au 3e', etagesIdentiques: 3 } } },
}]
const panneau = panneauDesQuantites(jeu)

describe('le report des éléments comptés', () => {
  it('multiplie les repères validés d’un étage type, et dit le calcul', () => {
    const c = comptagesDuJeu(panneau, 'le')
    expect(c.porte_paliere).toMatchObject({ nombre: 6, source: 'plans', valide: true, detail: '2 × 3 étages (1er au 3e) = 6' })
    expect(c.cuisine).toMatchObject({ nombre: 4, detail: '1 (Rez) + 1 × 3 étages (1er au 3e) = 4' })
    expect(c.fenetre).toBeUndefined()
  })
})

describe('le résumé avant le report', () => {
  it('dit ce qui change au dossier et ce qui part sur chaque ouvrage', () => {
    const r = resumeDuReport(panneau, jeu, {
      porte_paliere: { categorie: 'porte_paliere', nombre: 4, surface: null, source: 'saisie', detail: null, pages: [], confiance: null, valide: true, majLe: '' },
    }, [{ id: 'sol', cfcCode: '281', cfcLabel: 'Revêtements de sol', unit: 'CHF/m²', area: 10 }])
    expect(r.lignesComptages).toEqual(['Portes palières : 6 (au dossier : 4)', 'Cuisines : 4 (nouveau)'])
    expect(r.remplacements).toEqual(['Portes palières : 4 (saisi à la main) remplacé par 6'])
    expect(r.ouvrages).toHaveLength(1)
    // 25 m² au rez, 16 m² × 3 à l'étage type.
    expect(r.ouvrages[0].verdict).toEqual({ ok: true, quantite: 73 })
    expect(r.aEcrire).toBe(3)
  })
})
