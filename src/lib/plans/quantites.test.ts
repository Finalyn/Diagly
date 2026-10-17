import { describe, it, expect } from 'vitest'
import { classificationDe, entreesSia416, filtrerEtTrier, panneauDesQuantites, trouverInstance, type PlanPourQuantites } from './quantites'
import { surfacesSia416 } from './sia416'
import type { PlanAnnotation, TypeZoneIA } from '../api-types'

/** 10 px par mètre sur toutes les pages : un carré de 100 px de côté mesure 100 m². */
const ECHELLE = { id: 'pages', type: 'pages' as const, points: [], pageScales: { 1: 10, 2: 10, 3: 10 } }

let n = 0
const rect = (page: number, l: number, h: number, typeZone?: TypeZoneIA, extra: Partial<PlanAnnotation> = {}, x = 0, y = 0): PlanAnnotation => ({
  id: `z${n++}`, type: 'hatch', page, typeZone,
  points: [{ x: x * 10, y: y * 10 }, { x: (x + l) * 10, y: y * 10 }, { x: (x + l) * 10, y: (y + h) * 10 }, { x: x * 10, y: (y + h) * 10 }], ...extra,
})
const trait = (page: number, longueur: number, typeZone?: TypeZoneIA): PlanAnnotation => ({
  id: `t${n++}`, type: 'measure', page, typeZone, points: [{ x: 0, y: 0 }, { x: longueur * 10, y: 0 }, { x: longueur * 10, y: 0.0001 }],
})
const repere = (page: number, categorie: 'porte_paliere' | 'fenetre', aValider = false): PlanAnnotation => ({
  id: `r${n++}`, type: 'repere', page, points: [{ x: 1, y: 1 }], repere: { categorie, numero: 1, ...(aValider ? { aValider } : {}) },
})

const jeu: PlanPourQuantites[] = [{
  plan: {
    id: 'p', name: 'Jeu', mimeType: 'application/pdf', scalePxPerM: null,
    annotations: [
      ECHELLE,
      rect(1, 12, 9, 'emprise'), rect(1, 4, 5, 'piece', { text: 'Séjour' }), rect(1, 3, 4, 'piece', { text: 'Couloir' }),
      rect(2, 12, 9, 'emprise'), rect(2, 4, 5, 'piece', { text: 'Chambre', sia416: 'SUS' }), trait(2, 20, 'mur'),
      rect(2, 2, 2, 'piece', { proposition: { type: 'piece', libelle: 'Bain', confiance: 'basse' } as never }),
      repere(2, 'porte_paliere'), repere(2, 'porte_paliere'), repere(2, 'fenetre', true), repere(3, 'porte_paliere'),
      rect(3, 12, 8, 'facade'), rect(3, 1.2, 1.5, 'fenetre', {}, 1, 1), rect(3, 1.2, 1.5, 'fenetre', {}, 4, 1), rect(3, 1, 2, 'porte', {}, 6, 0),
      rect(3, 2, 2, undefined, { text: 'Auvent' }, 20, 20),
      { id: 'note', type: 'note', points: [{ x: 0, y: 0 }], page: 1, text: 'à voir' },
    ],
  },
  feuilles: {
    pages: {
      1: { type: 'plan_etage', niveau: 'Rez', etagesIdentiques: 1 },
      2: { type: 'plan_etage', niveau: '1er au 3e', etagesIdentiques: 3, hauteurEtage: 2.5 },
      3: { type: 'elevation', titre: 'Façade sud' },
    },
  },
}]

const p = panneauDesQuantites(jeu, { hauteurDuDossier: 2.9 })
const classe = (cle: string) => p.classifications.find((c) => c.cle === cle)!
const derivee = (cle: string, d: string) => classe(cle).derivees.find((x) => x.cle === d)!.valeur

describe('le classement des formes', () => {
  it('range chaque forme dans sa classification, et laisse de côté ce qui ne se mesure pas', () => {
    expect(classificationDe({ type: 'hatch', points: rect(1, 1, 1).points, typeZone: 'dalle' })).toBe('dalles')
    expect(classificationDe({ type: 'measure', points: [{ x: 0, y: 0 }, { x: 1, y: 0 }] })).toBe('libres')
    expect(classificationDe({ type: 'note', points: [{ x: 0, y: 0 }] })).toBeNull()
    expect(p.classifications.map((c) => c.cle)).toEqual(['pieces', 'facades', 'fenetres', 'portes', 'dalles', 'murs', 'elements', 'libres'])
  })
})

describe('le panneau des quantités', () => {
  it('liste les propositions de l’IA, marquées à valider, sans les compter', () => {
    const pieces = classe('pieces')
    expect(pieces.aValider).toBe(1)
    expect(pieces.etages[1].instances.find((i) => i.nom === 'Bain')).toMatchObject({ aValider: true, confiance: 'basse' })
    // Sol : 20 + 12 au rez, 20 × 3 à l'étage type.
    expect(derivee('pieces', 'surface')).toBeCloseTo(32 + 60, 6)
    expect(derivee('pieces', 'nombre')).toBe(2 + 3)
    expect(p.aValider).toBe(2)
  })

  it('tire les plinthes du périmètre de chaque pièce', () => {
    const sejour = classe('pieces').etages[0].instances.find((i) => i.nom === 'Séjour')!
    expect(sejour.derivees.find((x) => x.cle === 'plinthes')!.valeur).toBeCloseTo(18, 6)
    expect(derivee('pieces', 'plinthes')).toBeCloseTo(18 + 14 + 18 * 3, 6)
  })

  it('déduit d’une façade les ouvertures qui tombent dedans', () => {
    const f = classe('facades').etages[0].instances[0]
    expect(f.valeur).toBeCloseTo(96, 6)
    expect(f.derivees.find((x) => x.cle === 'ouvertures')!.valeur).toBeCloseTo(1.8 * 2 + 2, 6)
    expect(derivee('facades', 'nette')).toBeCloseTo(96 - 5.6, 6)
    expect(derivee('fenetres', 'nombre')).toBe(2)
    expect(derivee('fenetres', 'surface')).toBeCloseTo(3.6, 6)
  })

  it('donne la face d’un mur à la hauteur de sa feuille, ou à celle du dossier', () => {
    expect(classe('murs').etages[0].hauteur).toBe(2.5)
    expect(derivee('murs', 'longueur')).toBeCloseTo(60, 3)
    expect(derivee('murs', 'face')).toBeCloseTo(60 * 2.5, 2)
    expect(classe('pieces').etages[0].hauteur).toBe(2.9)
  })

  it('ne recompte pas un repère vu en élévation quand sa catégorie est pointée en plan', () => {
    const el = classe('elements')
    expect(derivee('elements', 'nombre')).toBe(6)
    expect(el.etages.find((e) => e.page === 3)!.instances[0].horsTotal).toBeTruthy()
  })

  it('retire une découpe de la pièce, et fait faire le tour du poteau aux plinthes', () => {
    const poteau = [{ x: 10, y: 10 }, { x: 20, y: 10 }, { x: 20, y: 20 }, { x: 10, y: 20 }]
    const avec = panneauDesQuantites([{ ...jeu[0], plan: { ...jeu[0].plan, annotations: [ECHELLE, rect(1, 4, 5, 'piece', { text: 'Hall', trous: [poteau] })] } }])
    const hall = avec.classifications[0].etages[0].instances[0]
    expect(hall.valeur).toBeCloseTo(20 - 1, 6)
    expect(hall.derivees.find((x) => x.cle === 'plinthes')!.valeur).toBeCloseTo(18 + 4, 6)
  })

  it('compte déjà la forme en cours de tracé', () => {
    const avec = panneauDesQuantites(jeu, {
      brouillon: { planId: 'p', page: 1, nature: 'surface', typeZone: 'piece', points: rect(1, 2, 3).points },
    })
    const pieces = avec.classifications.find((c) => c.cle === 'pieces')!
    expect(pieces.derivees[0].valeur).toBeCloseTo(92 + 6, 6)
    expect(pieces.etages[0].instances.some((i) => i.brouillon)).toBe(true)
  })

  it('retrouve une forme par son identifiant', () => {
    const id = classe('facades').etages[0].instances[0].id
    expect(trouverInstance(p, id)?.classification.cle).toBe('facades')
  })
})

describe('filtrer et trier', () => {
  it('garde les formes dont le nom contient le texte cherché, accents ignorés', () => {
    const r = filtrerEtTrier(p.classifications, 'sejour', 'nom')
    expect(r.map((c) => c.cle)).toEqual(['pieces'])
    expect(r[0].etages.flatMap((e) => e.instances.map((i) => i.nom))).toEqual(['Séjour'])
  })

  it('trie par quantité, la plus grande d’abord', () => {
    const r = filtrerEtTrier(p.classifications, '', 'quantite')
    expect(r.find((c) => c.cle === 'pieces')!.etages[0].instances.map((i) => i.nom)).toEqual(['Séjour', 'Couloir'])
  })
})

describe('les entrées SIA 416', () => {
  it('donnent par étage les emprises et les pièces validées, avec l’affectation choisie', () => {
    const e = entreesSia416(p)
    expect(e.map((x) => x.nom)).toEqual(['Rez', '1er au 3e'])
    expect(e[1].pieces).toEqual([expect.objectContaining({ nom: 'Chambre', surface: expect.closeTo(20, 6), affectation: 'SUS' })])
    const s = surfacesSia416(e)
    expect(s.total.sp).toBeCloseTo(108 + 108 * 3, 6)
    expect(s.total.categories.SUP).toBeCloseTo(20, 6)
    expect(s.total.categories.SD).toBeCloseTo(12, 6)
    expect(s.total.categories.SUS).toBeCloseTo(60, 6)
  })
})
