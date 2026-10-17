import { describe, it, expect } from 'vitest'
import { exportDuMetre, nomDuClasseur, provenanceDe } from './export-metres'
import { entreesSia416, panneauDesQuantites, type PlanPourQuantites } from './quantites'
import { surfacesSia416 } from './sia416'
import type { PlanAnnotation } from '../api-types'

const ECHELLE = { id: 'pages', type: 'pages' as const, points: [], pageScales: { 1: 10, 2: 10 } }
const carre = (cote: number) => [{ x: 0, y: 0 }, { x: cote * 10, y: 0 }, { x: cote * 10, y: cote * 10 }, { x: 0, y: cote * 10 }]
const annotations: PlanAnnotation[] = [
  ECHELLE,
  { id: 'e1', type: 'hatch', page: 1, points: carre(10), typeZone: 'emprise' },
  { id: 'p1', type: 'hatch', page: 1, points: carre(4), typeZone: 'piece', text: 'Séjour', mesureExacte: true },
  { id: 'p2', type: 'hatch', page: 2, points: carre(3), typeZone: 'piece', text: 'Couloir', origine: 'remplissage' },
  { id: 'p3', type: 'hatch', page: 2, points: carre(2), proposition: { type: 'piece', libelle: 'Bain', confiance: 'basse', aimantee: false } as never },
]
const jeu: PlanPourQuantites[] = [{
  plan: { id: 'p', name: 'Jeu', mimeType: 'application/pdf', scalePxPerM: null, annotations },
  feuilles: { pages: { 1: { niveau: 'Rez' }, 2: { niveau: '1er au 3e', etagesIdentiques: 3 } } },
}]
const panneau = panneauDesQuantites(jeu)
const m = exportDuMetre(panneau, surfacesSia416(entreesSia416(panneau)), {
  batiment: 'Immeuble Les Essais', adresse: 'Lausanne',
  feuille: (_planId, page) => `Page ${page}`,
  annotation: (_planId, id) => annotations.find((a) => a.id === id) ?? null,
  date: new Date('2026-10-17T10:00:00Z'),
})

describe('le métré mis en lignes pour Excel', () => {
  it('détaille chaque classification par étage, étages identiques compris, puis la totalise', () => {
    const pieces = m.recapitulatif.filter((l) => l.classification === 'Pièces')
    expect(pieces.find((l) => l.etage === '1er au 3e' && l.designation === 'Sol')).toMatchObject({ quantite: 27, detail: '3 étages identiques compris' })
    expect(pieces.find((l) => l.total && l.designation === 'Total sol')).toMatchObject({ quantite: 43, unite: 'm²' })
  })

  it('donne une ligne par forme, avec sa provenance et son statut', () => {
    expect(m.detail.map((l) => [l.local, l.quantite, l.provenance, l.statut])).toEqual(expect.arrayContaining([
      ['Séjour', 16, 'IA, aimantée sur le dessin', 'Validé'],
      ['Couloir', 9, 'Remplissage d’un clic', 'Validé'],
      ['Bain', 4, 'IA, placée à l’œil', 'À valider'],
    ]))
  })

  it('range les surfaces SIA 416 par étage, puis au total, avec la mention', () => {
    expect(m.mention).toBe('À vérifier, selon SIA 416:2003')
    expect(m.sia416.find((l) => l.estTotal && l.grandeur.startsWith('SN'))?.total).toBe(16 + 27)
    expect(m.sia416.find((l) => l.etage === 'Rez' && l.grandeur.startsWith('SP'))).toMatchObject({ parEtage: 100, total: 100 })
    expect(m.le).toBe('17.10.2026')
  })

  it('nomme le fichier sans accents ni espaces', () => {
    expect(nomDuClasseur('Immeuble Les Essais', new Date('2026-10-17T10:00:00Z'))).toBe('Metre_Immeuble-Les-Essais_2026-10-17.xlsx')
    expect(provenanceDe(null)).toBe('Tracé à la main')
  })
})
