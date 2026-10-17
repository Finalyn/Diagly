/**
 * Chercher un symbole sur les feuilles d'un jeu de plans.
 *
 * On encadre un symbole sur une feuille (une fenêtre en élévation, un WC, une
 * prise) ; ses traits, lus dans la géométrie vectorielle du PDF, forment un
 * gabarit. On le cherche ensuite sur chaque feuille vectorielle : partout où
 * l'on retrouve les mêmes traits, à la même taille, il y a une occurrence.
 * Les occurrences se revoient puis deviennent des repères de comptage.
 *
 * La recherche compare des traits et non des pixels : elle ne se laisse pas
 * tromper par une hachure ou un texte posés dessus, et elle est exacte au
 * dixième de millimètre du dessin. Elle a les limites de cette exactitude :
 * un symbole dessiné à une autre échelle (une feuille au 1:50, l'autre au
 * 1:100) ou déformé ne se retrouve pas. Les quatre rotations d'équerre et
 * leurs miroirs, si : une porte s'ouvre à gauche comme à droite.
 *
 * L'ancre du gabarit est son trait le plus long : seuls les traits de la page
 * de même longueur et de même direction proposent une position, que les
 * autres traits du gabarit confirment ou non.
 *
 * Module pur, sans canevas ni pdf.js, pour être vérifiable par les tests.
 */
import type { Geometrie, IndexGeometrie } from './geometrie-vectorielle'
import type { Boite } from './formes'

/** Un symbole encadré : ses traits, relatifs au centre du cadre. */
export interface Gabarit {
  /** x1, y1, x2, y2 par trait, relatifs au centre du cadre. */
  segments: number[]
  largeur: number
  hauteur: number
}

export interface Occurrence {
  /** Centre de l'occurrence, en pixels du canevas. */
  x: number
  y: number
  largeur: number
  hauteur: number
  /** Part des traits du gabarit retrouvés, de 0 à 1. */
  score: number
}

/** Un symbole a au moins ce nombre de traits : en deçà, c'est un trait de mur, pas un symbole. */
export const TRAITS_MIN = 3
/** Au-delà, le cadre a pris un morceau de plan, pas un symbole. */
export const TRAITS_MAX = 400

/**
 * Les traits du dessin entièrement compris dans le cadre, ramenés à son
 * centre. Un trait qui sort du cadre appartient au plan alentour (un mur, une
 * ligne de cote) : il n'est pas du symbole.
 */
export function gabaritDansLeCadre(geo: Geometrie, cadre: Boite, marge = 1): Gabarit | null {
  const x0 = cadre.x - marge, y0 = cadre.y - marge, x1 = cadre.x + cadre.largeur + marge, y1 = cadre.y + cadre.hauteur + marge
  const cx = cadre.x + cadre.largeur / 2, cy = cadre.y + cadre.hauteur / 2
  const dedans = (x: number, y: number) => x >= x0 && x <= x1 && y >= y0 && y <= y1
  const segments: number[] = []
  const s = geo.segments
  for (let i = 0; i < geo.nombre; i++) {
    const a = s[i * 4], b = s[i * 4 + 1], c = s[i * 4 + 2], d = s[i * 4 + 3]
    if (Math.hypot(c - a, d - b) < 0.5) continue
    if (!dedans(a, b) || !dedans(c, d)) continue
    segments.push(a - cx, b - cy, c - cx, d - cy)
  }
  const n = segments.length / 4
  if (n < TRAITS_MIN || n > TRAITS_MAX) return null
  return { segments, largeur: cadre.largeur, hauteur: cadre.hauteur }
}

/** Les huit variantes d'un gabarit : quatre rotations d'équerre, et leurs miroirs. */
export function variantes(g: Gabarit): Gabarit[] {
  const transformations: ((x: number, y: number) => [number, number])[] = [
    (x, y) => [x, y], (x, y) => [-y, x], (x, y) => [-x, -y], (x, y) => [y, -x],
    (x, y) => [-x, y], (x, y) => [y, x], (x, y) => [x, -y], (x, y) => [-y, -x],
  ]
  const vues = new Set<string>()
  const sortie: Gabarit[] = []
  for (const [k, t] of transformations.entries()) {
    const segments: number[] = []
    for (let i = 0; i < g.segments.length; i += 4) {
      const [a, b] = t(g.segments[i], g.segments[i + 1])
      const [c, d] = t(g.segments[i + 2], g.segments[i + 3])
      segments.push(a, b, c, d)
    }
    // Un symbole symétrique a des variantes identiques : une seule suffit.
    const cle = signature(segments)
    if (vues.has(cle)) continue
    vues.add(cle)
    const tourne = k % 2 === 1 || k === 5 || k === 7
    sortie.push({ segments, largeur: tourne ? g.hauteur : g.largeur, hauteur: tourne ? g.largeur : g.hauteur })
  }
  return sortie
}

/** Une empreinte des traits, indifférente à leur ordre et à leur sens, au dixième de pixel. */
function signature(segments: number[]): string {
  const traits: string[] = []
  for (let i = 0; i < segments.length; i += 4) {
    const p = `${Math.round(segments[i] * 10)},${Math.round(segments[i + 1] * 10)}`
    const q = `${Math.round(segments[i + 2] * 10)},${Math.round(segments[i + 3] * 10)}`
    traits.push(p < q ? `${p};${q}` : `${q};${p}`)
  }
  return traits.sort().join('|')
}

/** Le trait de la page qui reproduit ce trait du gabarit, déplacé de (tx, ty), existe-t-il ? */
function retrouve(index: IndexGeometrie, x1: number, y1: number, x2: number, y2: number, tol: number): boolean {
  const proches = index.dansLeRectangle(Math.min(x1, x2) - tol, Math.min(y1, y2) - tol, Math.max(x1, x2) + tol, Math.max(y1, y2) + tol)
  for (const i of proches) {
    const [a, b, c, d] = index.segment(i)
    if ((Math.hypot(a - x1, b - y1) <= tol && Math.hypot(c - x2, d - y2) <= tol)
      || (Math.hypot(a - x2, b - y2) <= tol && Math.hypot(c - x1, d - y1) <= tol)) return true
  }
  return false
}

function chercherUneVariante(index: IndexGeometrie, g: Gabarit, tol: number, seuil: number): Occurrence[] {
  const n = g.segments.length / 4
  // L'ancre : le trait le plus long du gabarit.
  let ancre = 0, lMax = -1
  for (let i = 0; i < n; i++) {
    const l = Math.hypot(g.segments[i * 4 + 2] - g.segments[i * 4], g.segments[i * 4 + 3] - g.segments[i * 4 + 1])
    if (l > lMax) { lMax = l; ancre = i }
  }
  const [ax1, ay1, ax2, ay2] = g.segments.slice(ancre * 4, ancre * 4 + 4)
  const ux = (ax2 - ax1) / lMax, uy = (ay2 - ay1) / lMax
  const essayees = new Set<string>()
  const trouvees: Occurrence[] = []
  const geo = index.geo
  for (let i = 0; i < geo.nombre; i++) {
    const a = geo.segments[i * 4], b = geo.segments[i * 4 + 1], c = geo.segments[i * 4 + 2], d = geo.segments[i * 4 + 3]
    const l = Math.hypot(c - a, d - b)
    if (Math.abs(l - lMax) > tol) continue
    const vx = (c - a) / l, vy = (d - b) / l
    // Même direction, dans un sens ou dans l'autre.
    if (Math.abs(ux * vy - uy * vx) > 0.02) continue
    const [px, py] = ux * vx + uy * vy > 0 ? [a, b] : [c, d]
    const tx = px - ax1, ty = py - ay1
    const cle = `${Math.round(tx)},${Math.round(ty)}`
    if (essayees.has(cle)) continue
    essayees.add(cle)
    let ok = 0, rate = 0
    const ratesPermis = n - Math.ceil(seuil * n)
    for (let k = 0; k < n && rate <= ratesPermis; k++) {
      const o = k * 4
      if (retrouve(index, g.segments[o] + tx, g.segments[o + 1] + ty, g.segments[o + 2] + tx, g.segments[o + 3] + ty, tol)) ok++
      else rate++
    }
    if (rate > ratesPermis) continue
    trouvees.push({ x: tx, y: ty, largeur: g.largeur, hauteur: g.hauteur, score: ok / n })
  }
  return trouvees
}

/**
 * Les occurrences d'un gabarit sur une page, toutes variantes confondues.
 * Deux occurrences dont les centres sont plus proches que le tiers du
 * symbole n'en font qu'une : la meilleure.
 */
export function chercherSymbole(index: IndexGeometrie, gabarit: Gabarit, options: { tolerance?: number; seuil?: number } = {}): Occurrence[] {
  const tol = options.tolerance ?? 1.2
  const seuil = options.seuil ?? 0.9
  const toutes = variantes(gabarit).flatMap((v) => chercherUneVariante(index, v, tol, seuil))
  toutes.sort((p, q) => q.score - p.score)
  const retenues: Occurrence[] = []
  for (const o of toutes) {
    const ecart = Math.min(o.largeur, o.hauteur) / 3
    if (retenues.some((r) => Math.hypot(r.x - o.x, r.y - o.y) < ecart)) continue
    retenues.push(o)
  }
  return retenues.sort((p, q) => p.y - q.y || p.x - q.x)
}
