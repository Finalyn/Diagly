import { describe, it, expect, beforeAll } from 'vitest'
import {
  COULEUR_PROPOSITION, COULEURS_CATEGORIE, COULEURS_PAR_TYPE, GRAND_COTE_MAX, bilanDeFacade, dimensionsPourLeModele, ecartAuxCotes,
  imageVersCanevas, mesureDeLaZone, nomDuRepere, propositionsDeLAnalyse, tientDansLeModele, validerProposition, validerRepere,
  type PageRendue,
} from './analyse-ia'
import {
  FACADE_SUD, OUVERTURES_FACADE, PLAN_ETAGE_TYPE, PORTES_ETAGE_TYPE, geometrieDePdf, pdfEtageType, pdfFacade, versCanevas,
} from './plans-de-test'
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

/**
 * Les repères d'éléments comptés sur le plan d'étage type : une porte palière
 * de chaque côté du palier, trois portes de pièce par logement. Le modèle
 * rend leur centre à quelques pixels près ; ils doivent tomber sur le
 * canevas là où sont les portes, numérotés dans leur catégorie, et ne
 * jamais compter dans un métré.
 */
describe('les repères du plan d’étage type', () => {
  let page: PageRendue
  let analyse: AnalysePlan

  beforeAll(async () => {
    const g = await geometrieDePdf(pdfEtageType())
    const image = dimensionsPourLeModele(g.largeurPt, g.hauteurPt, true)
    page = {
      numero: 1, largeurImage: image.largeur, hauteurImage: image.hauteur,
      largeurCanevas: g.largeurCanevas, hauteurCanevas: g.hauteurCanevas,
      largeurPagePt: g.largeurPt, hauteurPagePt: g.hauteurPt, index: g.index,
    }
    const k = image.largeur / g.largeurCanevas
    analyse = {
      pages: [{ page: 1, type: 'plan_etage', titre: 'Étage type (1er au 3e)', orientation: null, echelle: '1:100', echelleOu: 'cartouche', cote: null, remarque: null }],
      zones: [],
      elements: PORTES_ETAGE_TYPE.map((p) => {
        const c = versCanevas(PLAN_ETAGE_TYPE, p.x, p.y)
        return { page: 1, categorie: p.categorie, point: [c.x * k + 2, c.y * k - 2] as PointImage, libelle: null }
      }),
      comptages: [{ categorie: 'porte_paliere', nombre: 6, surface: null, detail: '2 par palier × 3 étages = 6', pages: [1], confiance: 'haute' }],
      ecartees: [],
      remarques: null,
    }
  })

  it('dessine un vrai plan vectoriel, avec ses portes et leurs arcs', async () => {
    const g = await geometrieDePdf(pdfEtageType())
    expect(g.geo.nombre).toBeGreaterThan(100)
    expect(PLAN_ETAGE_TYPE.attendu.portesPalieres).toBe(6)
    expect(PLAN_ETAGE_TYPE.attendu.portesInterieures).toBe(18)
    expect(PLAN_ETAGE_TYPE.attendu.fenetres).toBe(36)
    expect(PORTES_ETAGE_TYPE.filter((p) => p.categorie === 'porte_paliere')).toHaveLength(PLAN_ETAGE_TYPE.attendu.portesPalieresParEtage)
    expect(PORTES_ETAGE_TYPE.filter((p) => p.categorie === 'porte_interieure')).toHaveLength(PLAN_ETAGE_TYPE.attendu.portesInterieuresParEtage)
  })

  it('pose un repère par porte, là où elle est, numéroté dans sa catégorie', () => {
    let n = 0
    const { annotations } = propositionsDeLAnalyse(analyse, [page], { estPdf: true, identifiant: () => `r${n++}` })
    const reperes = annotations.filter((a) => a.type === 'repere')
    expect(reperes).toHaveLength(PORTES_ETAGE_TYPE.length)
    for (const [i, p] of PORTES_ETAGE_TYPE.entries()) {
      const attendu = versCanevas(PLAN_ETAGE_TYPE, p.x, p.y)
      expect(Math.hypot(reperes[i].points[0].x - attendu.x, reperes[i].points[0].y - attendu.y)).toBeLessThan(3)
      expect(reperes[i].repere?.categorie).toBe(p.categorie)
      expect(reperes[i].color).toBe(COULEURS_CATEGORIE[p.categorie])
    }
    expect(reperes.filter((a) => a.repere?.categorie === 'porte_paliere').map((a) => a.repere?.numero)).toEqual([1, 2])
    expect(reperes.filter((a) => a.repere?.categorie === 'porte_interieure').map((a) => a.repere?.numero)).toEqual([1, 2, 3, 4, 5, 6])
    expect(nomDuRepere(reperes[1])).toBe('Porte palière 2')
  })

  it('ne compte jamais un repère dans un métré, validé ou non', () => {
    const { annotations } = propositionsDeLAnalyse(analyse, [page], { estPdf: true, identifiant: () => 'r' })
    const repere = annotations[0]
    expect(repere.repere?.aValider).toBe(true)
    expect(natureDe(repere)).toBe('aucune')
    const valide = validerRepere(repere)
    expect(valide.repere).toEqual({ categorie: 'porte_paliere', numero: 1 })
    expect(natureDe(valide)).toBe('aucune')
    expect(validerRepere(valide)).toBe(valide)
  })

  it('ignore un repère d’une page qui n’a pas été envoyée', () => {
    const autre = { ...analyse, elements: analyse.elements!.map((e) => ({ ...e, page: 2 })) }
    expect(propositionsDeLAnalyse(autre, [page], { estPdf: true, identifiant: () => 'r' }).annotations).toEqual([])
  })

  /**
   * La chambre ouest du logement A : entre le mur de façade (nu intérieur à
   * 0,30 m), la cloison de 12 cm du couloir (y = 6,12 m), la cloison de la
   * salle de bain (x = 3,50 m) et le mur nord (nu intérieur à 10,70 m), soit
   * 3,20 × 4,58 = 14,656 m². Le modèle place les angles à l'œil, à quelques
   * pixels ; l'aimantation doit les ramener au nu intérieur.
   */
  it('accroche une pièce au nu intérieur de ses murs et garde son type une fois validée', () => {
    const k = page.largeurImage / page.largeurCanevas
    const img = (x: number, y: number, dx: number, dy: number): PointImage => {
      const c = versCanevas(PLAN_ETAGE_TYPE, x, y)
      return [c.x * k + dx, c.y * k + dy]
    }
    const piece: AnalysePlan = {
      ...analyse,
      elements: [],
      zones: [{
        page: 1, type: 'piece', libelle: 'Logement A, Chambre', orientation: null, mesure: 'surface',
        points: [img(0.3, 6.12, 3, -2), img(3.5, 6.12, -2, 3), img(3.5, 10.7, 2, 2), img(0.3, 10.7, -3, 1)],
        releveId: null, confiance: 'moyenne', valeurCotee: null, cotes: null, remarque: null,
      }],
    }
    const { annotations } = propositionsDeLAnalyse(piece, [page], { estPdf: true, identifiant: () => 'p' })
    const pxParM = 1600 / 42 * (100 / PLAN_ETAGE_TYPE.echelle)
    expect(annotations[0].proposition?.type).toBe('piece')
    expect(mesureDeLaZone(annotations[0], pxParM)).toBeCloseTo(3.2 * 4.58, 1)
    const validee = validerProposition(annotations[0])
    expect(validee).toMatchObject({ typeZone: 'piece', text: 'Logement A, Chambre', color: COULEURS_PAR_TYPE.piece })
  })
})
