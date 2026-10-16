import { describe, it, expect, beforeAll } from 'vitest'
import {
  COULEUR_PROPOSITION, COULEURS_PAR_TYPE, GRAND_COTE_MAX, bilanDeFacade, dimensionsPourLeModele, ecartAuxCotes,
  imageVersCanevas, mesureDeLaZone, propositionsDeLAnalyse, tientDansLeModele, validerProposition, type PageRendue,
} from './analyse-ia'
import { FACADE_SUD, OUVERTURES_FACADE, geometrieDePdf, pdfFacade, versCanevas } from './plans-de-test'
import { natureDe } from '../plan-quantites'
import type { AnalysePlan, PointImage, ZoneAnalysee } from '../api-types'

describe('l’image envoyée au modèle', () => {
  it('tient dans les deux limites : 2576 px de grand côté et 4784 tuiles de 28 px', () => {
    const a3 = dimensionsPourLeModele(FACADE_SUD.largeurPt, FACADE_SUD.hauteurPt, true)
    expect(tientDansLeModele(a3.largeur, a3.hauteur)).toBe(true)
    // Une feuille A3 à 2576 px de large dépasserait la limite de surface.
    expect(tientDansLeModele(2576, 1822)).toBe(false)
    expect(a3.largeur).toBeGreaterThan(2200)
    expect(a3.largeur / a3.hauteur).toBeCloseTo(FACADE_SUD.largeurPt / FACADE_SUD.hauteurPt, 2)
    // Un plan en bande, très allongé, bute sur le grand côté.
    expect(dimensionsPourLeModele(4000, 800, true).largeur).toBe(GRAND_COTE_MAX)
  })

  it('n’agrandit jamais une photo, mais la réduit si elle dépasse', () => {
    expect(dimensionsPourLeModele(800, 600, false)).toEqual({ largeur: 800, hauteur: 600 })
    const photo = dimensionsPourLeModele(4032, 3024, false)
    expect(tientDansLeModele(photo.largeur, photo.hauteur)).toBe(true)
    expect(photo.largeur / photo.hauteur).toBeCloseTo(4 / 3, 2)
  })

  it('ramène les points de l’image dans le repère du canevas', () => {
    const page = { largeurImage: 2296, hauteurImage: 1623, largeurCanevas: 1600, hauteurCanevas: 1131.43 } as PageRendue
    expect(imageVersCanevas([2296, 1623], page)).toEqual({ x: 1600, y: 1131.43 })
    const p = imageVersCanevas([1148, 811.5], page)
    expect(p.x).toBeCloseTo(800, 9)
    expect(p.y).toBeCloseTo(565.715, 9)
  })
})

/**
 * Une analyse simulée de la façade de test, comme le modèle la rendrait :
 * des points à l'œil, à quelques pixels de l'image près, l'échelle lue au
 * cartouche, la cote totale de 12,40 m.
 */
describe('une analyse de la façade de test au 1:100', () => {
  let page: PageRendue
  let analyse: AnalysePlan
  // Pseudo-aléa reproductible : jusqu'à ±4 px d'image, soit ±2,8 px de canevas.
  let graine = 7
  const bruit = () => { graine = (graine * 16807) % 2147483647; return ((graine / 2147483647) - 0.5) * 8 }

  beforeAll(async () => {
    const g = await geometrieDePdf(pdfFacade())
    const image = dimensionsPourLeModele(g.largeurPt, g.hauteurPt, true)
    page = {
      numero: 1, largeurImage: image.largeur, hauteurImage: image.hauteur,
      largeurCanevas: g.largeurCanevas, hauteurCanevas: g.hauteurCanevas,
      largeurPagePt: g.largeurPt, hauteurPagePt: g.hauteurPt, index: g.index,
    }
    const k = image.largeur / g.largeurCanevas
    const img = (x: number, y: number): PointImage => {
      const c = versCanevas(FACADE_SUD, x, y)
      return [c.x * k + bruit(), c.y * k + bruit()]
    }
    const rect = (x: number, y: number, l: number, h: number) => [img(x, y), img(x + l, y), img(x + l, y + h), img(x, y + h)]
    const zone = (z: Partial<ZoneAnalysee> & Pick<ZoneAnalysee, 'type' | 'libelle' | 'points'>): ZoneAnalysee => ({
      page: 1, orientation: 'sud', mesure: 'surface', releveId: null, confiance: 'haute', valeurCotee: null, cotes: null, remarque: null, ...z,
    })
    analyse = {
      pages: [{
        page: 1, type: 'elevation', titre: 'Façade sud', orientation: 'sud', echelle: '1:100', echelleOu: 'cartouche',
        cote: { texte: '12.40', longueurM: 12.4, p1: img(0, -1.6), p2: img(12.4, -1.6) }, remarque: null,
      }],
      zones: [
        zone({ type: 'facade', libelle: 'Façade sud', points: rect(0, 0, 12.4, 7.8), releveId: 'crepi', valeurCotee: 96.72, cotes: '12.40 × 7.80' }),
        ...OUVERTURES_FACADE.map((o, i) => zone({
          type: o.type, libelle: `${o.type === 'porte' ? 'Porte' : 'Fenêtre'} ${i + 1}`,
          points: rect(o.x, o.y, o.largeur, o.hauteur), releveId: o.type === 'porte' ? null : 'fenetres',
          valeurCotee: o.largeur * o.hauteur,
        })),
        zone({ type: 'autre', libelle: 'Socle', mesure: 'longueur', points: [img(0, 0), img(12.4, 0)] }),
      ],
      ecartees: [],
      remarques: null,
    }
  })

  it('propose l’échelle imprimée, vérifiée sur la cote', () => {
    let n = 0
    const { echelles } = propositionsDeLAnalyse(analyse, [page], { estPdf: true, identifiant: () => `z${n++}` })
    expect(echelles).toHaveLength(1)
    expect(echelles[0].statut).toBe('verifiee')
    expect(echelles[0].pxParM).toBeCloseTo(1600 / 42, 6)
    expect(echelles[0].cote?.aimantee).toBe(true)
    expect(echelles[0].ecart).toBeLessThan(0.001)
    expect(echelles[0].resume).toMatch(/^1:100 au cartouche, vérifiée sur la cote 12,40 m/)
  })

  it('pose des zones aimantées qui mesurent les vraies dimensions', () => {
    let n = 0
    const { annotations, echelles } = propositionsDeLAnalyse(analyse, [page], { estPdf: true, identifiant: () => `z${n++}` })
    const pxParM = echelles[0].pxParM!
    expect(annotations).toHaveLength(OUVERTURES_FACADE.length + 2)
    for (const a of annotations) {
      expect(a.proposition?.aimantee).toBe(true)
      expect(a.color).toBe(COULEUR_PROPOSITION)
      expect(a.page).toBe(1)
    }
    const facade = annotations[0]
    expect(facade.type).toBe('hatch')
    expect(facade.itemId).toBe('crepi')
    expect(mesureDeLaZone(facade, pxParM)).toBeCloseTo(96.72, 2)
    expect(ecartAuxCotes(facade, pxParM)).toBeLessThan(1e-4)
    for (const [i, o] of OUVERTURES_FACADE.entries()) {
      expect(mesureDeLaZone(annotations[i + 1], pxParM)).toBeCloseTo(o.largeur * o.hauteur, 3)
    }
    const socle = annotations[annotations.length - 1]
    expect(socle.type).toBe('measure')
    expect(mesureDeLaZone(socle, pxParM)).toBeCloseTo(12.4, 3)

    const bilan = bilanDeFacade(annotations, pxParM)!
    expect(bilan.brute).toBeCloseTo(FACADE_SUD.attendu.facadeBrute, 2)
    expect(bilan.ouvertures).toBeCloseTo(FACADE_SUD.attendu.ouvertures, 2)
    expect(bilan.nette).toBeCloseTo(FACADE_SUD.attendu.facadeNette, 2)
    expect(bilan.nombreOuvertures).toBe(15)
  })

  it('ne compte une zone dans le métré qu’une fois validée, avec son ouvrage', () => {
    const { annotations } = propositionsDeLAnalyse(analyse, [page], { estPdf: true, identifiant: () => 'z' })
    const proposee = annotations[0]
    expect(natureDe(proposee)).toBe('aucune')
    const validee = validerProposition(proposee)
    expect(validee.proposition).toBeUndefined()
    expect(natureDe(validee)).toBe('surface')
    expect(validee).toMatchObject({ type: 'hatch', itemId: 'crepi', text: 'Façade sud', color: COULEURS_PAR_TYPE.facade, page: 1 })
    expect(validee.points).toEqual(proposee.points)
    // Aimantée sur le dessin, sa surface est celle du plan : affichée au centième.
    expect(proposee.proposition?.aimantee).toBe(true)
    expect(validee.mesureExacte).toBe(true)
  })

  it('ne marque pas exacte une zone validée qui n’était pas aimantée', () => {
    const { annotations } = propositionsDeLAnalyse(analyse, [{ ...page, index: null }], { estPdf: true, identifiant: () => 'z' })
    expect(validerProposition(annotations[0]).mesureExacte).toBeUndefined()
  })

  it('garde tels quels les sommets d’une page sans géométrie, et le dit', () => {
    const sansGeometrie = { ...page, index: null }
    const { annotations, echelles } = propositionsDeLAnalyse(analyse, [sansGeometrie], { estPdf: true, identifiant: () => 'z' })
    expect(annotations.every((a) => a.proposition?.aimantee === false)).toBe(true)
    // L'échelle imprimée reste exacte ; seule la cote, lue à l'œil, n'est plus aimantée.
    expect(echelles[0].statut).toBe('verifiee')
    expect(echelles[0].cote?.aimantee).toBe(false)
    expect(echelles[0].pxParM).toBeCloseTo(1600 / 42, 6)
  })

  it('ignore une zone d’une page qui n’a pas été envoyée', () => {
    const autre = { ...analyse, zones: analyse.zones.map((z) => ({ ...z, page: 2 })) }
    expect(propositionsDeLAnalyse(autre, [page], { estPdf: true, identifiant: () => 'z' }).annotations).toEqual([])
  })
})
