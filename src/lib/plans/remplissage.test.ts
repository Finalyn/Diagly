import { describe, it, expect, beforeAll } from 'vitest'
import {
  contourExterieur, masqueDesTraits, masqueVide, nomDansLaZone, remplirDepuis, remplirRegion, simplifierContour, textesEnCanevas,
  type ElementDeTexte, type Masque,
} from './remplissage'
import { FACADE_SUD, PLAN_ETAGE_TYPE, geometrieDePdf, pdfEtageType, pdfFacade, versCanevas, type PlanDeTest } from './plans-de-test'
import { pxParMetreImprime } from './echelle-exacte'
import { airePolygone } from '../plan-quantites'
import type { IndexGeometrie } from './geometrie-vectorielle'

/** Un masque fabriqué à la main : un carré de 20 × 20 pixels du canevas, fermé, au milieu d'une feuille de 100 × 80. */
function carre(): Masque {
  const traits = new Float64Array([
    30, 30, 50, 30, 50, 30, 50, 50, 50, 50, 30, 50, 30, 50, 30, 30,
  ])
  return masqueDesTraits(traits, 4, 100, 80)
}

describe('le remplissage d’une région', () => {
  it('suit le contour extérieur au bord des pixels, région à main droite', () => {
    const m = masqueVide(4, 3, 1)
    // Un L de trois pixels : (1,1), (2,1), (1,2).
    m.murs.fill(1)
    m.murs[1 * 4 + 1] = 0; m.murs[1 * 4 + 2] = 0; m.murs[2 * 4 + 1] = 0
    const r = remplirRegion(m, 1, 1)!
    expect(r.compte).toBe(3)
    const c = contourExterieur(r, 4, 3)
    expect(c).toEqual([{ x: 1, y: 1 }, { x: 3, y: 1 }, { x: 3, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 3 }, { x: 1, y: 3 }])
    expect(airePolygone(c)).toBe(3)
  })

  it('ne relie pas deux pixels qui ne se touchent que par un coin', () => {
    const m = masqueVide(3, 3, 1)
    m.murs.fill(1)
    m.murs[0] = 0; m.murs[4] = 0
    const r = remplirRegion(m, 0, 0)!
    expect(r.compte).toBe(1)
  })

  it('remplit un carré fermé et retrouve ses quatre angles', () => {
    const r = remplirDepuis(carre(), { x: 40, y: 40 })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.points).toHaveLength(4)
    // Sans géométrie à quoi s'aimanter, le contour s'arrête au bord intérieur des traits du masque.
    expect(airePolygone(r.points)).toBeGreaterThan(19 * 19)
    expect(airePolygone(r.points)).toBeLessThanOrEqual(20 * 20)
  })

  it('refuse un clic hors de la pièce, qui fuit jusqu’au bord de la feuille', () => {
    expect(remplirDepuis(carre(), { x: 5, y: 5 })).toEqual({ ok: false, raison: 'fuite' })
  })

  it('refuse un clic posé sur un trait', () => {
    expect(remplirDepuis(carre(), { x: 30.2, y: 40 })).toEqual({ ok: false, raison: 'sur-un-trait' })
  })

  it('refuse une région qui couvre presque toute la feuille, même close par un cadre', () => {
    const cadre = new Float64Array([2, 2, 98, 2, 98, 2, 98, 78, 98, 78, 2, 78, 2, 78, 2, 2])
    const r = remplirDepuis(masqueDesTraits(cadre, 4, 100, 80), { x: 10, y: 10 })
    expect(r).toEqual({ ok: false, raison: 'trop-grande' })
  })

  it('simplifie un escalier de pixels en un seul côté', () => {
    const marches = Array.from({ length: 20 }, (_, i) => [{ x: i, y: Math.floor(i / 10) }, { x: i + 1, y: Math.floor(i / 10) }]).flat()
    const ferme = [...marches, { x: 20, y: 10 }, { x: 0, y: 10 }]
    expect(simplifierContour(ferme).length).toBeLessThanOrEqual(5)
  })
})

/** Les textes d'une page de test, lus par pdf.js comme le fait l'éditeur, au canevas de 1600 px. */
async function textesDePdf(octets: Uint8Array) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const pdf = await pdfjs.getDocument({ data: octets.slice(), isEvalSupported: false, verbosity: 0 }).promise
  const page = await pdf.getPage(1)
  const base = page.getViewport({ scale: 1 })
  const vue = page.getViewport({ scale: 1600 / base.width })
  const contenu = await page.getTextContent()
  return { textes: textesEnCanevas(contenu.items as ElementDeTexte[], vue.transform) }
}

/** La surface d'une zone du canevas en mètres carrés, à l'échelle exacte de la feuille de test. */
function enM2(plan: PlanDeTest, aire: number, largeurCanevas: number) {
  const k = pxParMetreImprime(plan.largeurPt, largeurCanevas, plan.echelle)
  return aire / (k * k)
}

describe('le remplissage sur l’étage type de test au 1:100', () => {
  let masque: Masque
  let index: IndexGeometrie
  let largeur: number
  beforeAll(async () => {
    const g = await geometrieDePdf(pdfEtageType(), 1, 1600, { courbes: true })
    masque = masqueDesTraits(g.geo.segments, g.geo.nombre, g.largeurCanevas, g.hauteurCanevas)
    index = g.index
    largeur = g.largeurCanevas
  })

  it('remplit la chambre du logement A, fermée par le vantail et l’arc de sa porte, à 0,5 % près', () => {
    // 3,20 × 4,58 m, moins le quart de cercle de la porte de 0,80 m, plus
    // l'embrasure de la fenêtre jusqu'au vitrage (1,20 × 0,15 m).
    const attendu = 3.2 * 4.58 - (Math.PI * 0.8 * 0.8) / 4 + 1.2 * 0.15
    const r = remplirDepuis(masque, versCanevas(PLAN_ETAGE_TYPE, 1.9, 8.4), index)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const m2 = enM2(PLAN_ETAGE_TYPE, airePolygone(r.points), largeur)
    expect(Math.abs(m2 - attendu) / attendu).toBeLessThan(0.005)
  })

  it('remplit la salle de bain voisine, sans déborder sur la chambre', () => {
    // Entre les cloisons x = 3,62 et 5,50, de y = 6,12 à 10,70, moins sa porte de 0,70 m,
    // plus l'embrasure de sa fenêtre (0,80 × 0,15 m).
    const attendu = (5.5 - 3.62) * 4.58 - (Math.PI * 0.7 * 0.7) / 4 + 0.8 * 0.15
    const r = remplirDepuis(masque, versCanevas(PLAN_ETAGE_TYPE, 4.0, 8.4), index)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const m2 = enM2(PLAN_ETAGE_TYPE, airePolygone(r.points), largeur)
    // Les appareils sanitaires dessinés dans la pièce n'en retirent rien :
    // seul le contour extérieur compte.
    expect(Math.abs(m2 - attendu) / attendu).toBeLessThan(0.005)
  })

  it('nomme la pièce d’après le texte écrit dedans', async () => {
    const { textes } = await textesDePdf(pdfEtageType())
    const r = remplirDepuis(masque, versCanevas(PLAN_ETAGE_TYPE, 1.9, 8.4), index)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(nomDansLaZone(textes, r.points)).toBe('Chambre')
  })

  it('refuse un clic hors du bâtiment', () => {
    const r = remplirDepuis(masque, versCanevas(PLAN_ETAGE_TYPE, -3, 5), index)
    expect(r.ok).toBe(false)
  })
})

describe('le remplissage sur la façade de test', () => {
  it('remplit un vantail de vitrage, entre le cadre et la traverse', async () => {
    const g = await geometrieDePdf(pdfFacade(), 1, 1600, { courbes: true })
    const masque = masqueDesTraits(g.geo.segments, g.geo.nombre, g.largeurCanevas, g.hauteurCanevas)
    // Première fenêtre du rez : x de 1,00 à 2,20, allège à 0,90 ; vitrage en retrait de 6 cm, partagé au milieu.
    const r = remplirDepuis(masque, versCanevas(FACADE_SUD, 1.3, 1.6), g.index)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const attendu = (0.6 - 0.06) * (1.4 - 0.12)
    const m2 = enM2(FACADE_SUD, airePolygone(r.points), g.largeurCanevas)
    expect(Math.abs(m2 - attendu) / attendu).toBeLessThan(0.005)
  })
})
