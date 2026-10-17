import { describe, it, expect } from 'vitest'
import { fileDeRevue } from './revue'
import type { PlanAnnotation, PropositionIA } from '../api-types'

const ECHELLE = { id: 'pages', type: 'pages' as const, points: [], pageScales: { 1: 10, 2: 10 } }
const carre = (cote: number) => [{ x: 0, y: 0 }, { x: cote * 10, y: 0 }, { x: cote * 10, y: cote * 10 }, { x: 0, y: cote * 10 }]
const proposition = (p: Partial<PropositionIA>): PropositionIA => ({
  type: 'piece', libelle: 'Pièce', orientation: null, confiance: 'haute', aimantee: true, sommetsAimantes: 4, couverture: 1,
  valeurCotee: null, cotes: null, remarque: null, ...p,
})
const zone = (id: string, page: number, p: Partial<PropositionIA>): PlanAnnotation => ({ id, type: 'hatch', page, points: carre(4), proposition: proposition(p) })

describe('la file de revue', () => {
  const jeu = [{
    plan: {
      id: 'p', name: 'Jeu', mimeType: 'application/pdf', scalePxPerM: null,
      annotations: [
        ECHELLE,
        zone('haute', 1, { libelle: 'Séjour' }),
        zone('basse', 2, { confiance: 'basse', libelle: 'Bain' }),
        zone('moyenne-libre', 1, { confiance: 'moyenne', aimantee: false, sommetsAimantes: 1 }),
        zone('moyenne', 1, { confiance: 'moyenne' }),
        zone('cotes', 1, { confiance: 'haute', valeurCotee: 16, cotes: '4.00 × 4.00' }),
        { id: 'repere', type: 'repere' as const, page: 2, points: [{ x: 1, y: 1 }], repere: { categorie: 'porte_paliere' as const, numero: 2, aValider: true } },
        { id: 'validee', type: 'hatch' as const, page: 1, points: carre(2), typeZone: 'piece' as const },
      ],
    },
    feuilles: { pages: { 1: { numero: '101', titre: 'Rez' }, 2: { numero: '102', titre: 'Étage type' } } },
  }]
  const file = fileDeRevue(jeu)

  it('parcourt tout le jeu, du moins sûr au plus sûr', () => {
    expect(file.map((e) => e.id)).toEqual(['basse', 'moyenne-libre', 'moyenne', 'repere', 'haute', 'cotes'])
  })

  it('dit d’où vient chaque élément, sa mesure et ce que disent ses cotes', () => {
    const libre = file.find((e) => e.id === 'moyenne-libre')!
    expect(libre.provenance).toBe('IA, placée à l’œil (1/4 sommets aimantés)')
    const cotes = file.find((e) => e.id === 'cotes')!
    expect(cotes.mesure).toEqual({ valeur: 16, unite: 'm²', exacte: true })
    expect(cotes.cotes).toBe('Cotes lues : 4.00 × 4.00 = 16,00 m², concordent')
    expect(cotes.feuille).toBe('101 · Rez')
    expect(file.find((e) => e.id === 'repere')).toMatchObject({ type: 'Repère · porte palière', libelle: 'Porte palière 2', confiance: null })
  })
})
