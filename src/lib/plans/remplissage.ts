/**
 * Remplir une pièce d'un clic.
 *
 * Tracer une pièce sommet par sommet, c'est six clics pour un rectangle et
 * vingt pour un séjour en L avec ses embrasures. Sur un PDF vectoriel, les
 * murs sont déjà dessinés : un clic à l'intérieur suffit à retrouver la pièce,
 * comme le seau de peinture d'un logiciel de dessin.
 *
 * Le chemin est celui d'un remplissage d'image, mais sur les traits du dessin
 * et non sur ses pixels, pour que le texte des locaux ne perce pas de trous :
 *
 * 1. les traits sont tracés dans un masque, deux fois plus fin que le canevas ;
 * 2. la région est remplie depuis le clic, de proche en proche (quatre voisins :
 *    un trait en diagonale ferme bien le passage) ;
 * 3. si elle touche le bord de la feuille ou en couvre presque tout, elle fuit
 *    par une ouverture : on refuse plutôt que de poser une zone absurde ;
 * 4. son contour extérieur est suivi le long des bords de pixels, puis
 *    simplifié ;
 * 5. ses sommets sont enfin aimantés sur les traits du dessin
 *    (geometrie-vectorielle.ts) : la surface retrouve la précision du dessin,
 *    et non celle du masque.
 *
 * Les portes ne fuient pas : sur un plan d'architecte, le vantail et l'arc de
 * son ouverture ferment la pièce. Il faut pour cela les courbes aplaties en
 * traits (extraireSegments, option `courbes`).
 *
 * Module pur, sans canevas ni pdf.js, pour être vérifiable par les tests. Le
 * masque peut aussi venir des pixels sombres d'une image (un scan) : c'est le
 * même remplissage, sans l'aimantation finale.
 */
import type { PlanPoint } from '../api-types'
import { aimanter, appliquer, type IndexGeometrie } from './geometrie-vectorielle'
import { pointDansPolygone } from './formes'

/** Pixels du masque par pixel du canevas. */
export const FINESSE = 2
/** Au-delà de cette part de la feuille, la région n'est pas une pièce : elle a fui. */
export const PART_MAX = 0.45
/** Une région de moins de pixels de canevas carrés est un interstice entre deux traits. */
const AIRE_MIN = 40
/** Écart toléré à la simplification du contour, en pixels du masque. */
const TOLERANCE = 1.5

export interface Masque {
  largeur: number
  hauteur: number
  /** 1 là où passe un trait. */
  murs: Uint8Array
  /** Pixels du masque par pixel du canevas. */
  finesse: number
}

export function masqueVide(largeurCanevas: number, hauteurCanevas: number, finesse = FINESSE): Masque {
  const largeur = Math.max(1, Math.ceil(largeurCanevas * finesse))
  const hauteur = Math.max(1, Math.ceil(hauteurCanevas * finesse))
  return { largeur, hauteur, murs: new Uint8Array(largeur * hauteur), finesse }
}

/**
 * Trace un trait dans le masque, pixel après pixel le long de son grand axe.
 * Un trait ainsi tracé est continu de proche en proche par les coins : un
 * remplissage à quatre voisins ne le traverse pas.
 */
function tracer(m: Masque, x1: number, y1: number, x2: number, y2: number) {
  const f = m.finesse
  const ax = x1 * f, ay = y1 * f, bx = x2 * f, by = y2 * f
  const pas = Math.max(1, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay))))
  let px = -1, py = -1
  for (let k = 0; k <= pas; k++) {
    const x = Math.floor(ax + ((bx - ax) * k) / pas)
    const y = Math.floor(ay + ((by - ay) * k) / pas)
    if (x < 0 || y < 0 || x >= m.largeur || y >= m.hauteur) { px = -1; continue }
    m.murs[y * m.largeur + x] = 1
    // Deux pixels successifs en diagonale laisseraient passer le remplissage
    // entre eux : on bouche le coin.
    if (px >= 0 && px !== x && py !== y) m.murs[py * m.largeur + x] = 1
    px = x; py = y
  }
}

/** Le masque des traits d'une page, en pixels du canevas multipliés par la finesse. */
export function masqueDesTraits(
  segments: Float64Array, nombre: number, largeurCanevas: number, hauteurCanevas: number, finesse = FINESSE,
): Masque {
  const m = masqueVide(largeurCanevas, hauteurCanevas, finesse)
  for (let i = 0; i < nombre; i++) {
    tracer(m, segments[i * 4], segments[i * 4 + 1], segments[i * 4 + 2], segments[i * 4 + 3])
  }
  return m
}

/**
 * Le masque des pixels sombres d'une image : pour un scan, où il n'y a pas de
 * traits à lire, les murs sont ce qui est foncé.
 */
export function masqueDesPixels(donnees: Uint8ClampedArray, largeur: number, hauteur: number, seuil = 150): Masque {
  const m: Masque = { largeur, hauteur, murs: new Uint8Array(largeur * hauteur), finesse: 1 }
  for (let i = 0; i < largeur * hauteur; i++) {
    const r = donnees[i * 4], g = donnees[i * 4 + 1], b = donnees[i * 4 + 2], a = donnees[i * 4 + 3]
    const lum = a < 20 ? 255 : 0.299 * r + 0.587 * g + 0.114 * b
    if (lum < seuil) m.murs[i] = 1
  }
  return m
}

export interface Region {
  /** 1 pour chaque pixel du masque rempli. */
  pixels: Uint8Array
  compte: number
  toucheLeBord: boolean
  /** Premier pixel rempli dans l'ordre de lecture : un point du contour extérieur. */
  premier: number
}

/**
 * Remplit la région du masque qui contient le point (en pixels du masque).
 * Remplissage par lignes : chaque ligne libre est prise d'un coup, et seules
 * ses voisines du dessus et du dessous sont mises en attente.
 */
export function remplirRegion(m: Masque, x0: number, y0: number): Region | null {
  const { largeur: L, hauteur: H, murs } = m
  if (x0 < 0 || y0 < 0 || x0 >= L || y0 >= H || murs[y0 * L + x0]) return null
  const pixels = new Uint8Array(L * H)
  let pile = new Int32Array(1024)
  let haut = 0
  const empiler = (i: number) => {
    if (haut >= pile.length) {
      const plus = new Int32Array(pile.length * 2)
      plus.set(pile)
      pile = plus
    }
    pile[haut++] = i
  }
  empiler(y0 * L + x0)
  let compte = 0
  let toucheLeBord = false
  let premier = Number.MAX_SAFE_INTEGER
  while (haut > 0) {
    const i = pile[--haut]
    if (pixels[i] || murs[i]) continue
    const y = Math.floor(i / L)
    let g = i - y * L
    while (g > 0 && !murs[y * L + g - 1] && !pixels[y * L + g - 1]) g--
    let d = i - y * L
    while (d < L - 1 && !murs[y * L + d + 1] && !pixels[y * L + d + 1]) d++
    if (g === 0 || d === L - 1 || y === 0 || y === H - 1) toucheLeBord = true
    const debut = y * L + g
    if (debut < premier) premier = debut
    for (let x = g; x <= d; x++) pixels[y * L + x] = 1
    compte += d - g + 1
    for (const ny of [y - 1, y + 1]) {
      if (ny < 0 || ny >= H) continue
      let dansUnePlage = false
      for (let x = g; x <= d; x++) {
        const j = ny * L + x
        const libre = !murs[j] && !pixels[j]
        if (libre && !dansUnePlage) { empiler(j); dansUnePlage = true } else if (!libre) dansUnePlage = false
      }
    }
  }
  return { pixels, compte, toucheLeBord, premier }
}

/**
 * Le contour extérieur d'une région, suivi le long des bords de ses pixels,
 * la région toujours à main droite. Rend les coins où le contour tourne, en
 * pixels du masque : la surface du polygone est exactement celle des pixels
 * (trous non compris : une colonne au milieu d'une pièce reste dans la pièce).
 *
 * Aux coins où deux pixels de la région ne se touchent que par la diagonale,
 * le contour passe entre eux : la région est remplie à quatre voisins, ils ne
 * sont pas reliés.
 */
export function contourExterieur(r: Region, largeur: number, hauteur: number): PlanPoint[] {
  const dedans = (x: number, y: number) => x >= 0 && y >= 0 && x < largeur && y < hauteur && r.pixels[y * largeur + x] === 1
  const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1]
  const x0 = r.premier % largeur, y0 = Math.floor(r.premier / largeur)
  let cx = x0, cy = y0, d = 0
  const sommets: PlanPoint[] = [{ x: cx, y: cy }]
  const maxPas = 4 * (largeur + 1) * (hauteur + 1)
  for (let pas = 0; pas < maxPas; pas++) {
    cx += DX[d]; cy += DY[d]
    if (cx === x0 && cy === y0) break
    // Les deux pixels devant soi, à droite et à gauche du sens de marche.
    let dx: number, dy: number, gx: number, gy: number
    if (d === 0) { dx = cx; dy = cy; gx = cx; gy = cy - 1 }
    else if (d === 1) { dx = cx - 1; dy = cy; gx = cx; gy = cy }
    else if (d === 2) { dx = cx - 1; dy = cy - 1; gx = cx - 1; gy = cy }
    else { dx = cx; dy = cy - 1; gx = cx - 1; gy = cy - 1 }
    let suivant = d
    if (!dedans(dx, dy)) suivant = (d + 1) % 4
    else if (dedans(gx, gy)) suivant = (d + 3) % 4
    if (suivant !== d) sommets.push({ x: cx, y: cy })
    d = suivant
  }
  return sommets
}

function distanceAuSegment(p: PlanPoint, a: PlanPoint, b: PlanPoint): number {
  const dx = b.x - a.x, dy = b.y - a.y
  const l2 = dx * dx + dy * dy
  if (l2 === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/** Douglas-Peucker sur une ligne ouverte : garde les points qui s'écartent de plus que la tolérance. */
function simplifierLigne(pts: PlanPoint[], tolerance: number): PlanPoint[] {
  if (pts.length <= 2) return pts
  const garder = new Uint8Array(pts.length)
  garder[0] = 1
  garder[pts.length - 1] = 1
  const pile: [number, number][] = [[0, pts.length - 1]]
  while (pile.length) {
    const [a, b] = pile.pop()!
    let loin = -1, dmax = 0
    for (let i = a + 1; i < b; i++) {
      const dd = distanceAuSegment(pts[i], pts[a], pts[b])
      if (dd > dmax) { dmax = dd; loin = i }
    }
    if (loin >= 0 && dmax > tolerance) {
      garder[loin] = 1
      pile.push([a, loin], [loin, b])
    }
  }
  return pts.filter((_, i) => garder[i])
}

/** Simplifie un contour fermé : coupé en deux au point le plus éloigné du premier, chaque moitié à part. */
export function simplifierContour(pts: PlanPoint[], tolerance = TOLERANCE): PlanPoint[] {
  if (pts.length <= 4) return pts
  let loin = 0, dmax = -1
  for (let i = 1; i < pts.length; i++) {
    const dd = Math.hypot(pts[i].x - pts[0].x, pts[i].y - pts[0].y)
    if (dd > dmax) { dmax = dd; loin = i }
  }
  const aller = simplifierLigne(pts.slice(0, loin + 1), tolerance)
  const retour = simplifierLigne([...pts.slice(loin), pts[0]], tolerance)
  const tout = [...aller, ...retour.slice(1, -1)]
  // Un sommet aligné avec ses deux voisins ne dit rien : on le retire.
  return tout.filter((p, i) => {
    const a = tout[(i - 1 + tout.length) % tout.length], b = tout[(i + 1) % tout.length]
    return distanceAuSegment(p, a, b) > tolerance * 0.25
  })
}

export type RefusRemplissage = 'sur-un-trait' | 'fuite' | 'trop-grande' | 'trop-petite'

export const RAISONS_REFUS: Record<RefusRemplissage, string> = {
  'sur-un-trait': 'Le clic est tombé sur un trait : cliquez au milieu de la pièce.',
  fuite: 'La pièce n’est pas fermée : le remplissage passe par une ouverture jusqu’au bord de la feuille. Tracez-la à la main.',
  'trop-grande': 'La zone couvre presque toute la feuille : la pièce n’est sans doute pas fermée. Tracez-la à la main.',
  'trop-petite': 'Zone trop petite : le clic est tombé entre deux traits rapprochés.',
}

export type ResultatRemplissage =
  | { ok: true; points: PlanPoint[]; aimantee: boolean }
  | { ok: false; raison: RefusRemplissage }

/**
 * La pièce autour du point cliqué (en pixels du canevas), en contour simplifié
 * et, si la géométrie vectorielle est connue, aimanté sur les traits.
 */
export function remplirDepuis(m: Masque, clic: PlanPoint, index: IndexGeometrie | null = null): ResultatRemplissage {
  const f = m.finesse
  const x0 = Math.floor(clic.x * f), y0 = Math.floor(clic.y * f)
  const r = remplirRegion(m, x0, y0)
  if (!r) return { ok: false, raison: 'sur-un-trait' }
  if (r.toucheLeBord) return { ok: false, raison: 'fuite' }
  if (r.compte > PART_MAX * m.largeur * m.hauteur) return { ok: false, raison: 'trop-grande' }
  if (r.compte / (f * f) < AIRE_MIN) return { ok: false, raison: 'trop-petite' }

  const brut = contourExterieur(r, m.largeur, m.hauteur)
  const simple = simplifierContour(brut).map((p) => ({ x: p.x / f, y: p.y / f }))
  if (simple.length < 3) return { ok: false, raison: 'trop-petite' }
  if (!index) return { ok: true, points: simple, aimantee: false }
  // Le contour longe les traits à un demi-pixel du masque près : l'aimantation
  // le ramène sur le nu des murs, au sommet exact de chaque angle.
  const a = aimanter(index, simple, { ferme: true, preference: 'interieur', rayon: 6 })
  return { ok: true, points: a.points, aimantee: a.complete }
}

// ---------------------------------------------------------------- nom du local

/** Un texte de la page, ramené au canevas : son centre et la taille de ses lettres. */
export interface TexteDeLaPage {
  texte: string
  x: number
  y: number
  taille: number
}

/** Un élément de texte tel que pdf.js le rend (getTextContent). */
export interface ElementDeTexte {
  str: string
  /** Matrice du texte dans l'espace de la page, [a, b, c, d, e, f]. */
  transform: number[]
  width: number
  height: number
}

/**
 * Les textes d'une page, dans le repère du canevas de l'éditeur. Le centre
 * d'un texte et non son point de départ : le nom d'un local commence souvent
 * près d'un mur, et c'est son milieu qui dit dans quelle pièce il est écrit.
 */
export function textesEnCanevas(elements: ElementDeTexte[], transformVue: readonly number[]): TexteDeLaPage[] {
  const sortie: TexteDeLaPage[] = []
  for (const el of elements) {
    const texte = el.str?.trim()
    if (!texte || !Array.isArray(el.transform) || el.transform.length < 6) continue
    const [a, b, , , e, f] = el.transform
    const l = Math.hypot(a, b) || 1
    const ux = a / l, uy = b / l
    // Le long de la ligne de texte, puis à mi-hauteur, perpendiculairement.
    const cx = e + ux * (el.width / 2) - uy * (el.height / 2)
    const cy = f + uy * (el.width / 2) + ux * (el.height / 2)
    const [x, y] = appliquer(transformVue, cx, cy)
    const [x0, y0] = appliquer(transformVue, e, f)
    const [x1, y1] = appliquer(transformVue, e - uy * l, f + ux * l)
    sortie.push({ texte, x, y, taille: Math.hypot(x1 - x0, y1 - y0) })
  }
  return sortie
}

/**
 * Le nom d'une pièce remplie, lu sur le plan : le texte écrit dedans. Les
 * cotes et les surfaces imprimées (« 14.66 m² ») n'en sont pas : seul compte
 * ce qui porte des lettres, et parmi cela le plus gros texte, qui est le nom
 * du local plutôt qu'une annotation.
 */
export function nomDansLaZone(textes: TexteDeLaPage[], polygone: PlanPoint[]): string | null {
  const dedans = textes.filter((t) => /\p{L}{2,}/u.test(t.texte) && !/^\s*[\d.,'\s]+\s*m[2²]?\s*$/i.test(t.texte) && pointDansPolygone(t, polygone))
  if (!dedans.length) return null
  const plusGrande = Math.max(...dedans.map((t) => t.taille))
  const noms = dedans
    .filter((t) => t.taille >= plusGrande * 0.9)
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((t) => t.texte)
  return noms.join(' ').replace(/\s+/g, ' ').trim().slice(0, 80) || null
}
