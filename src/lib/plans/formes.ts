/**
 * Petites mesures sur les formes posées sur un plan : où est une forme, où
 * écrire son nom, qu'est-ce qui tombe dedans.
 *
 * Module pur, partagé par le panneau des quantités, les étiquettes et la
 * revue : tous ont besoin de savoir où se trouve une zone sans dessiner.
 */
import type { PlanPoint } from '../api-types'

export interface Boite { x: number; y: number; largeur: number; hauteur: number }

export function boiteDe(pts: PlanPoint[]): Boite {
  if (!pts.length) return { x: 0, y: 0, largeur: 0, hauteur: 0 }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const p of pts) {
    if (p.x < x0) x0 = p.x
    if (p.y < y0) y0 = p.y
    if (p.x > x1) x1 = p.x
    if (p.y > y1) y1 = p.y
  }
  return { x: x0, y: y0, largeur: x1 - x0, hauteur: y1 - y0 }
}

export function pointDansPolygone(p: PlanPoint, pts: PlanPoint[]): boolean {
  let dedans = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    if (((pts[i].y > p.y) !== (pts[j].y > p.y)) && (p.x < ((pts[j].x - pts[i].x) * (p.y - pts[i].y)) / (pts[j].y - pts[i].y) + pts[i].x)) dedans = !dedans
  }
  return dedans
}

/** Le centre de gravité de la surface (et non la moyenne des sommets, que des sommets serrés d'un côté tirent à eux). */
export function centreDeSurface(pts: PlanPoint[]): PlanPoint {
  let a = 0, cx = 0, cy = 0
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length]
    const k = p.x * q.y - q.x * p.y
    a += k
    cx += (p.x + q.x) * k
    cy += (p.y + q.y) * k
  }
  if (Math.abs(a) < 1e-9) {
    const n = pts.length || 1
    return { x: pts.reduce((s, p) => s + p.x, 0) / n, y: pts.reduce((s, p) => s + p.y, 0) / n }
  }
  return { x: cx / (3 * a), y: cy / (3 * a) }
}

function distanceAuBord(p: PlanPoint, pts: PlanPoint[]): number {
  let d = Infinity
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length]
    const dx = b.x - a.x, dy = b.y - a.y
    const l2 = dx * dx + dy * dy
    const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2))
    d = Math.min(d, Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)))
  }
  return d
}

/**
 * Où écrire le nom d'une zone : au centre de gravité s'il tombe dedans et
 * assez loin des bords, sinon au point de la zone le plus éloigné de ses
 * bords, cherché sur une grille. Le centre d'un séjour en L tombe dans
 * l'angle rentrant, hors de la pièce : son nom s'écrirait dans la voisine.
 */
export function pointPourEtiquette(pts: PlanPoint[]): PlanPoint {
  if (pts.length < 3) return pts[0] ?? { x: 0, y: 0 }
  const c = centreDeSurface(pts)
  const b = boiteDe(pts)
  const marge = Math.min(b.largeur, b.hauteur) / 4
  if (pointDansPolygone(c, pts) && distanceAuBord(c, pts) >= marge * 0.9) return c
  let meilleur = c, dMax = pointDansPolygone(c, pts) ? distanceAuBord(c, pts) : -1
  const N = 24
  for (let i = 1; i < N; i++) {
    for (let j = 1; j < N; j++) {
      const p = { x: b.x + (b.largeur * i) / N, y: b.y + (b.hauteur * j) / N }
      if (!pointDansPolygone(p, pts)) continue
      const d = distanceAuBord(p, pts)
      if (d > dMax) { dMax = d; meilleur = p }
    }
  }
  return meilleur
}
