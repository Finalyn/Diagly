import { describe, it, expect } from 'vitest'
import type { PlanAnnotation, TypeZoneIA } from '../api-types'
import type { CategorieComptee } from '../base-cfc/comptages'
import { ALLEGE, LINTEAU, maquetteDuJeu, surfaceDe } from './maquette3d'
import type { PlanPourQuantites } from './quantites'

/** 10 px par mètre sur toutes les pages. */
const ECHELLE = { id: 'pages', type: 'pages' as const, points: [], pageScales: { 1: 10, 2: 10, 3: 10, 5: 10 } }

let n = 0
const rect = (page: number, x: number, y: number, l: number, h: number, typeZone?: TypeZoneIA, extra: Partial<PlanAnnotation> = {}): PlanAnnotation => ({
  id: `z${n++}`, type: 'hatch', page, typeZone,
  points: [{ x: x * 10, y: y * 10 }, { x: (x + l) * 10, y: y * 10 }, { x: (x + l) * 10, y: (y + h) * 10 }, { x: x * 10, y: (y + h) * 10 }], ...extra,
})
const repere = (page: number, x: number, y: number, categorie: CategorieComptee): PlanAnnotation => ({
  id: `r${n++}`, type: 'repere', page, points: [{ x: x * 10, y: y * 10 }], repere: { categorie, numero: 1 },
})

/**
 * Un rez de 12 m sur 9, deux logements séparés par un mur de 30 cm, une
 * porte dans ce mur et une fenêtre dans la façade ouest ; un étage type du
 * 1er au 3e ; une élévation ; des combles sans emprise, et une feuille sans
 * échelle.
 */
const etage = (page: number, extra: PlanAnnotation[] = []) => [
  rect(page, 0, 0, 12, 9, 'emprise'),
  rect(page, 0.3, 0.3, 5.7, 8.4, 'piece', { text: 'Séjour' }),
  rect(page, 6.3, 0.3, 5.4, 8.4, 'piece', { text: 'Chambre' }),
  repere(page, 6.15, 4.5, 'porte_interieure'),
  repere(page, 0.15, 4.5, 'fenetre'),
  ...extra,
]

const jeu: PlanPourQuantites[] = [
  {
    plan: {
      id: 'p', name: 'Jeu', mimeType: 'application/pdf', scalePxPerM: null,
      annotations: [
        ECHELLE,
        ...etage(1),
        ...etage(2, [rect(2, 1, 1, 2, 2, 'piece', { proposition: { type: 'piece', libelle: 'Bain', confiance: 'basse' } as never })]),
        rect(3, 0, 0, 12, 8, 'facade'),
        rect(4, 0, 0, 5, 5, 'piece', { text: 'Grenier' }),
        rect(5, 2, 2, 4, 3, 'piece', { text: 'Grenier' }),
      ],
    },
    feuilles: {
      pages: {
        1: { type: 'plan_etage', niveau: 'Rez' },
        2: { type: 'plan_etage', niveau: '1er au 3e', etagesIdentiques: 3, hauteurEtage: 2.5 },
        3: { type: 'elevation', titre: 'Façade sud' },
        4: { type: 'plan_etage', niveau: 'Sous-sol' },
        5: { type: 'plan_etage', niveau: 'Combles' },
      },
    },
  },
]

const m = maquetteDuJeu(jeu, { hauteurDuDossier: 2.9 })
const rez = m.niveaux.find((x) => x.rang === 0)!.feuille
const bande = (bas: number) => surfaceDe(rez.murs.find((b) => b.bas === bas)!.forme)

describe('la maquette 3D des métrés', () => {
  it('monte chaque plan d’étage à son niveau, l’étage type pour chacun de ses étages', () => {
    expect(m.niveaux.map((x) => [x.nom, x.z])).toEqual([['Rez', 0], ['1er', 2.9], ['2ème', 5.4], ['3ème', 7.9], ['Combles', 10.4]])
    expect(m.niveaux[1].feuille).toBe(m.niveaux[3].feuille)
    expect(m.boite.z1).toBeCloseTo(13.3)
  })

  it('laisse les élévations, et dit pourquoi une feuille d’étage ne monte pas', () => {
    expect(m.niveaux.some((x) => x.feuille.nom === 'Façade sud')).toBe(false)
    expect(m.ecartees).toEqual([{ nom: 'Sous-sol', raison: 'sans échelle' }])
  })

  it('fait des murs l’emprise moins les pièces, cloison comprise', () => {
    // 12 × 9 − (5,7 + 5,4) × 8,4, au-dessus du linteau où rien ne perce.
    expect(bande(LINTEAU)).toBeCloseTo(108 - 11.1 * 8.4, 3)
  })

  it('perce la porte du sol au linteau, la fenêtre de l’allège au linteau', () => {
    const pleins = 108 - 11.1 * 8.4
    // La porte retire 80 cm du mur de 30 cm ; la fenêtre, 1,20 m de la façade de 30 cm.
    expect(bande(0)).toBeCloseTo(pleins - 0.8 * 0.3, 3)
    expect(bande(ALLEGE)).toBeCloseTo(pleins - 0.8 * 0.3 - 1.2 * 0.3, 3)
    const porte = rez.ouvertures.find((o) => o.porte)!
    expect(Math.abs(Math.sin(porte.angle))).toBeCloseTo(1)
  })

  it('ne monte que les formes validées', () => {
    const etageType = m.niveaux.find((x) => x.rang === 1)!.feuille
    expect(etageType.pieces.map((p) => p.nom)).toEqual(['Séjour', 'Chambre'])
    expect(etageType.hauteur).toBe(2.5)
  })

  it('centre chaque feuille sur son emprise, pour que les niveaux se superposent', () => {
    const pts = rez.dalle.flat(2)
    expect(Math.min(...pts.map((p) => p[0])) + Math.max(...pts.map((p) => p[0]))).toBeCloseTo(0)
    expect(Math.min(...pts.map((p) => p[1])) + Math.max(...pts.map((p) => p[1]))).toBeCloseTo(0)
  })

  it('déduit l’emprise des pièces quand le plan n’en a pas', () => {
    const combles = m.niveaux.find((x) => x.nom === 'Combles')!.feuille
    // La pièce de 4 × 3 élargie de 15 cm de chaque côté : un mur de 4,3 × 3,3 − 12 m².
    expect(surfaceDe(combles.murs[2].forme)).toBeCloseTo(4.3 * 3.3 - 12, 3)
    expect(combles.pieces[0].surface).toBeCloseTo(12)
  })

  it('range un plan d’étage sans niveau lisible au-dessus des autres', () => {
    const seul = maquetteDuJeu([{
      plan: { id: 'q', name: 'Étage type', mimeType: 'image/png', scalePxPerM: 10, annotations: etage(1) },
      feuilles: { pages: { 1: { type: 'plan_etage', niveau: 'Étage type', etagesIdentiques: 2 } } },
    }])
    expect(seul.niveaux.map((x) => x.nom)).toEqual(['Rez', '1er'])
  })
})
