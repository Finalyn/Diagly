import { describe, it, expect, beforeAll } from 'vitest'
import {
  IDENTITE, IndexGeometrie, accrochesPres, aimanter, appliquer, couverture, extraireSegments, multiplier,
  type Geometrie, type OpsPdf,
} from './geometrie-vectorielle'
import {
  CONTOUR_REZ, FACADE_SUD, OUVERTURES_FACADE, PLAN_REZ, geometrieDePdf, pdfFacade, pdfPlanRez, versCanevas,
} from './plans-de-test'
import { airePolygone } from '../plan-quantites'
import { pxParMetreImprime } from './echelle-exacte'
import type { PlanPoint } from '../api-types'

// Les codes d'opérateurs de pdf.js 4 : une liste fabriquée à la main les emploie
// sans charger la bibliothèque.
const OPS = {
  save: 10, restore: 11, transform: 12, constructPath: 91,
  moveTo: 13, lineTo: 14, curveTo: 15, curveTo2: 16, curveTo3: 17, closePath: 18, rectangle: 19,
  stroke: 20, closeStroke: 21, fill: 22, eoFill: 23, fillStroke: 24, eoFillStroke: 25,
  closeFillStroke: 26, closeEOFillStroke: 27, endPath: 28,
  paintFormXObjectBegin: 74, paintFormXObjectEnd: 75, beginAnnotation: 80, endAnnotation: 81,
} satisfies OpsPdf

const segments = (g: Geometrie) =>
  Array.from({ length: g.nombre }, (_, i) => Array.from(g.segments.slice(i * 4, i * 4 + 4)).map((v) => Math.round(v * 1000) / 1000))

describe('les matrices', () => {
  it('composent dans l’ordre de pdf.js : la seconde s’applique d’abord', () => {
    const translation = [1, 0, 0, 1, 10, 20]
    const echelle = [2, 0, 0, 2, 0, 0]
    expect(appliquer(multiplier(translation, echelle), 1, 1)).toEqual([12, 22])
    expect(appliquer(multiplier(echelle, translation), 1, 1)).toEqual([22, 42])
    expect(multiplier(IDENTITE, echelle)).toEqual(echelle)
  })
})

describe('l’extraction des traits', () => {
  it('suit la matrice courante, les rectangles et la fermeture des chemins', () => {
    const g = extraireSegments({
      fnArray: [OPS.save, OPS.transform, OPS.constructPath, OPS.stroke, OPS.constructPath, OPS.closeStroke, OPS.restore, OPS.constructPath, OPS.stroke],
      argsArray: [
        null, [2, 0, 0, 2, 0, 0],
        [[OPS.rectangle], [1, 1, 3, 2]], null,
        [[OPS.moveTo, OPS.lineTo, OPS.lineTo], [0, 0, 1, 0, 1, 1]], null,
        null,
        [[OPS.moveTo, OPS.lineTo], [0, 0, 5, 0]], null,
      ],
    }, OPS, IDENTITE)
    expect(segments(g)).toEqual([
      // Le rectangle, agrandi deux fois.
      [2, 2, 8, 2], [8, 2, 8, 6], [8, 6, 2, 6], [2, 6, 2, 2],
      // Le triangle refermé par « s ».
      [0, 0, 2, 0], [2, 0, 2, 2], [2, 2, 0, 0],
      // Après « Q », de nouveau à l'échelle 1.
      [0, 0, 5, 0],
    ])
  })

  it('ignore les tracés de découpe, que rien ne peint', () => {
    const g = extraireSegments({
      fnArray: [OPS.constructPath, OPS.endPath, OPS.constructPath, OPS.stroke],
      argsArray: [[[OPS.rectangle], [0, 0, 100, 100]], null, [[OPS.moveTo, OPS.lineTo], [1, 1, 2, 2]], null],
    }, OPS, IDENTITE)
    expect(segments(g)).toEqual([[1, 1, 2, 2]])
  })

  it('applique la transformation de la vue : l’axe vertical du PDF monte, celui du canevas descend', () => {
    // Page de 100 × 50 pt rendue sur 200 px de large : pdf.js donne [2, 0, 0, -2, 0, 100].
    const g = extraireSegments({
      fnArray: [OPS.constructPath, OPS.stroke],
      argsArray: [[[OPS.moveTo, OPS.lineTo], [0, 0, 100, 50]], null],
    }, OPS, [2, 0, 0, -2, 0, 100])
    expect(segments(g)).toEqual([[0, 100, 200, 0]])
  })

  it('garde les extrémités des courbes comme sommets, sans en faire des côtés', () => {
    const g = extraireSegments({
      fnArray: [OPS.constructPath, OPS.stroke],
      argsArray: [[[OPS.moveTo, OPS.curveTo], [0, 0, 0, 5, 5, 10, 10, 10]], null],
    }, OPS, IDENTITE)
    expect(segments(g)).toEqual([[0, 0, 0, 0], [10, 10, 10, 10]])
  })

  it('suit la matrice d’un formulaire et oublie les annotations du document', () => {
    const g = extraireSegments({
      fnArray: [OPS.paintFormXObjectBegin, OPS.constructPath, OPS.stroke, OPS.paintFormXObjectEnd,
        OPS.beginAnnotation, OPS.constructPath, OPS.stroke, OPS.endAnnotation, OPS.constructPath, OPS.stroke],
      argsArray: [[[1, 0, 0, 1, 100, 0], null], [[OPS.moveTo, OPS.lineTo], [0, 0, 1, 0]], null, null,
        null, [[OPS.moveTo, OPS.lineTo], [50, 50, 60, 60]], null, null, [[OPS.moveTo, OPS.lineTo], [0, 0, 1, 0]], null],
    }, OPS, IDENTITE)
    expect(segments(g)).toEqual([[100, 0, 101, 0], [0, 0, 1, 0]])
  })

  it('s’arrête au plafond de traits et le signale', () => {
    const g = extraireSegments({
      fnArray: [OPS.constructPath, OPS.stroke],
      argsArray: [[[OPS.rectangle], [0, 0, 10, 10]], null],
    }, OPS, IDENTITE, 2)
    expect(g.nombre).toBe(2)
    expect(g.tronquee).toBe(true)
  })
})

describe('les accroches et la couverture', () => {
  // Un angle en L et un trait isolé.
  const geo = extraireSegments({
    fnArray: [OPS.constructPath, OPS.stroke],
    argsArray: [[[OPS.moveTo, OPS.lineTo, OPS.lineTo, OPS.moveTo, OPS.lineTo],
      [0, 100, 0, 0, 100, 0, 50, -20, 50, 120]], null],
  }, OPS, IDENTITE)
  const index = new IndexGeometrie(geo)

  it('trouvent les sommets et les croisements dans le rayon, du plus proche au plus lointain', () => {
    const a = accrochesPres(index, { x: 47, y: 3 })
    expect(a[0]).toMatchObject({ x: 50, y: 0, nature: 'intersection', croisement: true })
    // L'angle du L : deux extrémités qui se rejoignent, à la fois sommet et croisement.
    expect(accrochesPres(index, { x: 2, y: 3 })[0]).toMatchObject({ x: 0, y: 0, nature: 'sommet', croisement: true })
    // Le bout libre d'un trait n'est qu'un sommet.
    expect(accrochesPres(index, { x: 98, y: 3 })[0]).toMatchObject({ x: 100, y: 0, nature: 'sommet', croisement: false })
    expect(accrochesPres(index, { x: 25, y: 50 })).toEqual([])
  })

  it('mesure la part d’un côté suivie par un trait', () => {
    expect(couverture(index, { x: 0, y: 0 }, { x: 100, y: 0 })).toBeCloseTo(1, 5)
    expect(couverture(index, { x: 0, y: 0 }, { x: 200, y: 0 })).toBeCloseTo(0.5, 5)
    expect(couverture(index, { x: 0, y: 50 }, { x: 100, y: 50 })).toBe(0)
  })
})

const geometrieDe = (octets: Uint8Array) => geometrieDePdf(octets)

/** Décale chaque sommet de quelques pixels, comme le ferait une lecture à l'œil. */
function bruiter(pts: PlanPoint[], ecarts: [number, number][]): PlanPoint[] {
  return pts.map((p, i) => ({ x: p.x + ecarts[i % ecarts.length][0], y: p.y + ecarts[i % ecarts.length][1] }))
}

describe('la façade de test au 1:100', () => {
  let ctx: Awaited<ReturnType<typeof geometrieDe>>
  let pxParM: number
  beforeAll(async () => {
    ctx = await geometrieDe(pdfFacade())
    pxParM = pxParMetreImprime(ctx.largeurPt, ctx.largeurCanevas, FACADE_SUD.echelle)
  })
  const c = (x: number, y: number) => versCanevas(FACADE_SUD, x, y)
  const m2 = (pts: PlanPoint[]) => airePolygone(pts) / (pxParM * pxParM)

  it('donne ses traits au canevas, aux coordonnées du dessin', () => {
    expect(ctx.geo.nombre).toBeGreaterThan(150)
    for (const [x, y] of [[0, 0], [12.4, 0], [12.4, 7.8], [0, 7.8]]) {
      const [a] = accrochesPres(ctx.index, c(x, y), 3)
      expect(a.distance).toBeLessThan(0.01)
    }
  })

  it('accroche la façade à ses angles, pas aux lignes d’attache ni à l’acrotère', () => {
    // L'IA place les angles à quelques pixels : vers la ligne d'attache à
    // gauche, vers la bande d'acrotère en haut, dans le terrain en bas.
    const exact = [c(0, 0), c(12.4, 0), c(12.4, 7.8), c(0, 7.8)]
    const propose = bruiter(exact, [[-5, 3], [4, 4], [3, 8], [-6, 7]])
    const r = aimanter(ctx.index, propose, { ferme: true, preference: 'exterieur' })
    expect(r.complete).toBe(true)
    r.points.forEach((p, i) => {
      expect(p.x).toBeCloseTo(exact[i].x, 2)
      expect(p.y).toBeCloseTo(exact[i].y, 2)
    })
    expect(m2(r.points)).toBeCloseTo(FACADE_SUD.attendu.facadeBrute, 2)
    expect(r.couvertureMoyenne).toBeGreaterThan(0.95)
  })

  it('mesure chaque ouverture au cadre extérieur, même proposée entre cadre et vitrage', () => {
    for (const o of OUVERTURES_FACADE) {
      const exact = [c(o.x, o.y), c(o.x + o.largeur, o.y), c(o.x + o.largeur, o.y + o.hauteur), c(o.x, o.y + o.hauteur)]
      // Deux pixels vers l'intérieur : plus près du vitrage que du cadre.
      const propose = bruiter(exact, [[2, -2], [-2, -2], [-2, 2], [2, 2]])
      const r = aimanter(ctx.index, propose, { ferme: true, preference: 'exterieur' })
      expect(r.complete).toBe(true)
      expect(m2(r.points)).toBeCloseTo(o.largeur * o.hauteur, 3)
    }
  })

  it('laisse en place un sommet sans trait à proximité, et le dit', () => {
    const propose = [c(3, 9.5), c(4, 9.5), c(4, 10.5)]
    const r = aimanter(ctx.index, propose, { ferme: true })
    expect(r.complete).toBe(false)
    expect(r.nombreAimantes).toBe(0)
    expect(r.points).toEqual(propose)
  })

  it('accroche une cote de contrôle aux croisements de sa ligne de cote', () => {
    // Cote totale 12,40 à 1,60 m sous la façade.
    const exact = [c(0, -1.6), c(12.4, -1.6)]
    // Bruit vers l'extérieur : le dépassement de la ligne de cote (1,5 mm, soit
    // 5,7 px) est alors plus proche que le croisement avec la ligne d'attache.
    const r = aimanter(ctx.index, bruiter(exact, [[-4, -2], [4, 3]]), { ferme: false })
    expect(r.complete).toBe(true)
    const longueur = Math.hypot(r.points[1].x - r.points[0].x, r.points[1].y - r.points[0].y) / pxParM
    expect(longueur).toBeCloseTo(12.4, 3)
  })
})

describe('le plan du rez de test au 1:50', () => {
  it('accroche l’emprise en L au nu extérieur des murs', async () => {
    const ctx = await geometrieDe(pdfPlanRez())
    const pxParM = pxParMetreImprime(ctx.largeurPt, ctx.largeurCanevas, PLAN_REZ.echelle)
    const exact = CONTOUR_REZ.map(([x, y]) => versCanevas(PLAN_REZ, x, y))
    // Vers l'intérieur, là où passe le nu intérieur des murs (30 cm = 11 px au 1:50).
    const propose = bruiter(exact, [[4, -5], [-5, -4], [-4, 6], [3, 5], [-6, 4], [5, 5]])
    const r = aimanter(ctx.index, propose, { ferme: true, preference: 'exterieur' })
    expect(r.complete).toBe(true)
    expect(airePolygone(r.points) / (pxParM * pxParM)).toBeCloseTo(PLAN_REZ.attendu.emprise, 2)
  })

  it('accroche la dalle au nu intérieur des murs quand on le lui demande', async () => {
    const ctx = await geometrieDe(pdfPlanRez())
    const pxParM = pxParMetreImprime(ctx.largeurPt, ctx.largeurCanevas, PLAN_REZ.echelle)
    const e = 0.3
    const interieur: [number, number][] = [[e, e], [12.4 - e, e], [12.4 - e, 6.2 - e], [8.4 - e, 6.2 - e], [8.4 - e, 9.2 - e], [e, 9.2 - e]]
    const exact = interieur.map(([x, y]) => versCanevas(PLAN_REZ, x, y))
    // Vers l'extérieur cette fois : à mi-chemin du nu extérieur.
    const propose = bruiter(exact, [[-5, 5], [5, 5], [5, -4], [5, -5], [5, -5], [-5, -5]])
    const r = aimanter(ctx.index, propose, { ferme: true, preference: 'interieur' })
    expect(r.complete).toBe(true)
    expect(airePolygone(r.points) / (pxParM * pxParM)).toBeCloseTo(PLAN_REZ.attendu.interieur, 2)
  })
})
