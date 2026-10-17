import { describe, it, expect } from 'vitest'
import { recapitulatifDuJeu, type PlanPourRecap } from './recapitulatif'
import type { PlanAnnotation, TypeZoneIA } from '../api-types'

/** 10 px par mètre sur toutes les pages : un carré de 100 px de côté mesure 100 m². */
const ECHELLE = { id: 'pages', type: 'pages' as const, points: [], pageScales: { 1: 10, 2: 10, 3: 10 } }

let n = 0
const rect = (page: number, l: number, h: number, typeZone?: TypeZoneIA, extra: Partial<PlanAnnotation> = {}): PlanAnnotation => ({
  id: `z${n++}`, type: 'hatch', page, typeZone,
  points: [{ x: 0, y: 0 }, { x: l * 10, y: 0 }, { x: l * 10, y: h * 10 }, { x: 0, y: h * 10 }], ...extra,
})
const trait = (page: number, longueur: number, typeZone?: TypeZoneIA): PlanAnnotation => ({
  id: `t${n++}`, type: 'measure', page, typeZone, points: [{ x: 0, y: 0 }, { x: longueur * 10, y: 0 }],
})
const repere = (page: number, categorie: 'porte_paliere' | 'fenetre', aValider = false): PlanAnnotation => ({
  id: `r${n++}`, type: 'repere', page, points: [{ x: 1, y: 1 }], repere: { categorie, numero: 1, ...(aValider ? { aValider } : {}) },
})

/**
 * Un petit jeu : la page 1 est le rez, la page 2 l'étage type du 1er au 3e,
 * la page 3 la façade sud avec deux fenêtres et une porte.
 */
const jeu: PlanPourRecap[] = [{
  plan: {
    id: 'p', name: 'Jeu', mimeType: 'application/pdf', scalePxPerM: null,
    annotations: [
      ECHELLE,
      rect(1, 12, 9, 'emprise'), rect(1, 11, 8, 'dalle'), rect(1, 4, 5, 'piece'), rect(1, 3, 4, 'piece'),
      rect(2, 12, 9, 'emprise'), rect(2, 4, 5, 'piece'), trait(2, 20, 'mur'),
      repere(2, 'porte_paliere'), repere(2, 'porte_paliere'), repere(2, 'fenetre', true),
      rect(3, 12, 8, 'facade'), rect(3, 1.2, 1.5, 'fenetre'), rect(3, 1.2, 1.5, 'fenetre'), rect(3, 1, 2, 'porte'),
      rect(3, 2, 2, undefined), rect(3, 5, 5, 'toiture', { proposition: { type: 'toiture' } as never }),
    ],
  },
  feuilles: {
    pages: {
      1: { type: 'plan_etage', niveau: 'Rez', etagesIdentiques: 1 },
      2: { type: 'plan_etage', niveau: '1er au 3e', etagesIdentiques: 3 },
      3: { type: 'elevation', titre: 'Façade sud' },
    },
  },
}]

const r = recapitulatifDuJeu(jeu)
const groupe = (cle: string) => r.groupes.find((g) => g.cle === cle)!
const ligneDe = (cle: string, l: string) => groupe(cle).lignes.find((x) => x.cle === l)!

describe('le récapitulatif d’un jeu de plans', () => {
  it('compte à part ce qui attend d’être validé, et ne le met dans aucun total', () => {
    expect(r.aValider).toBe(2)
    expect(r.groupes.find((g) => g.cle === 'toiture')).toBeUndefined()
  })

  it('déduit les ouvertures de la façade dessinées sur la même feuille', () => {
    expect(ligneDe('facades', 'facades-brute').quantite).toBeCloseTo(96, 6)
    expect(ligneDe('facades', 'facades-ouvertures').quantite).toBeCloseTo(1.8 * 2 + 2, 6)
    expect(ligneDe('facades', 'facades-nette').quantite).toBeCloseTo(96 - 5.6, 6)
    expect(ligneDe('fenetres', 'fenetres-nombre').quantite).toBe(2)
    expect(ligneDe('portes', 'portes-nombre').quantite).toBe(1)
  })

  it('multiplie l’étage type par le nombre d’étages qu’il représente, et le dit', () => {
    const etage = ligneDe('etages', 'emprise-p#2')
    expect(etage.libelle).toBe('1er au 3e, emprise')
    expect(etage.quantite).toBeCloseTo(108 * 3, 6)
    expect(etage.detail).toBe('× 3 étages identiques')
    expect(ligneDe('etages', 'emprises-total').quantite).toBeCloseTo(108 * 4, 6)
    expect(ligneDe('etages', 'emprises-total').detail).toBe('étages identiques compris')
    expect(ligneDe('murs', 'murs').quantite).toBeCloseTo(60, 6)
    expect(ligneDe('elements', 'element-porte_paliere').quantite).toBe(6)
  })

  it('range les pièces par étage, avec leur nombre', () => {
    const rez = ligneDe('pieces', 'pieces-p#1')
    expect(rez.quantite).toBeCloseTo(32, 6)
    expect(rez.detail).toBe('2 pièces')
    expect(ligneDe('pieces', 'pieces-p#2').detail).toBe('1 pièce, × 3 étages identiques')
    expect(ligneDe('pieces', 'pieces-total').quantite).toBeCloseTo(32 + 60, 6)
  })

  it('garde les zones sans type à part, et la source de chaque quantité', () => {
    expect(ligneDe('autres', 'autres-surfaces').quantite).toBeCloseTo(4, 6)
    expect(ligneDe('murs', 'murs').sources[0]).toMatchObject({ planId: 'p', page: 2, valeur: 20, multiplicateur: 3 })
  })

  it('ne recompte pas en élévation ce que les plans d’étage pointent déjà, et dit les multiplicateurs mêlés', () => {
    const r2 = recapitulatifDuJeu([{
      plan: {
        id: 'q', name: 'Jeu', mimeType: 'application/pdf', scalePxPerM: null,
        annotations: [
          repere(1, 'fenetre'), repere(1, 'fenetre'), repere(2, 'fenetre'),
          repere(3, 'fenetre'), repere(3, 'fenetre'), repere(3, 'fenetre'),
          { ...repere(3, 'porte_paliere'), repere: { categorie: 'porte_entree', numero: 1 } },
        ],
      },
      feuilles: { pages: { 1: { type: 'plan_etage' }, 2: { type: 'plan_etage', etagesIdentiques: 3 }, 3: { type: 'elevation' } } },
    }])
    const lignes = r2.groupes.find((g) => g.cle === 'elements')!.lignes
    expect(lignes.find((l) => l.cle === 'element-fenetre')).toMatchObject({
      quantite: 2 + 3, detail: 'étages identiques compris, sans les 3 repères d’autres vues',
    })
    expect(lignes.find((l) => l.cle === 'element-porte_entree')).toMatchObject({ quantite: 1, detail: null })
  })

  it('compte à part les zones d’une feuille sans échelle, sans leur donner de mesure', () => {
    const sans = recapitulatifDuJeu([{
      plan: { id: 'i', name: 'Photo', mimeType: 'image/jpeg', scalePxPerM: null, annotations: [rect(1, 2, 2, 'facade'), rect(1, 1, 1, 'fenetre')] },
      feuilles: { pages: {} },
    }])
    expect(sans.sansEchelle).toBe(2)
    expect(sans.groupes.map((g) => g.cle)).toEqual(['fenetres'])
    expect(sans.groupes[0].lignes.map((l) => [l.cle, l.quantite])).toEqual([['fenetres-nombre', 1]])
  })
})
