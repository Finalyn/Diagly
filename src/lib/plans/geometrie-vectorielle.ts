/**
 * La géométrie vectorielle d'une page de PDF, et l'aimantation sur ses traits.
 *
 * Un plan d'architecte exporté en PDF n'est pas une image : chaque mur, chaque
 * cadre de fenêtre y est un segment aux coordonnées exactes. Une zone proposée
 * par l'IA, elle, est placée à l'œil, à quelques pixels près : assez pour
 * qu'une fenêtre de 1,20 × 1,40 m mesure 1,62 m² au lieu de 1,68. Accrocher
 * chaque sommet proposé au sommet ou à l'intersection de traits le plus
 * plausible rend au métré la précision du dessin.
 *
 * « Le plus plausible » et non « le plus proche » : autour d'un angle de
 * façade traînent l'extrémité d'une ligne d'attache de cote (deux millimètres
 * plus loin), la bande d'acrotère (trente centimètres plus bas), le cadre
 * intérieur d'une fenêtre (six centimètres en retrait). Le bon sommet est
 * celui d'où partent des côtés effectivement dessinés. L'aimantation choisit
 * donc l'ensemble des sommets d'un coup, en préférant ceux dont les côtés
 * suivent des traits du plan, et, à égalité, le contour extérieur : une
 * ouverture se mesure au vide de maçonnerie, une façade à son nu extérieur.
 *
 * Tout est pur et sans pdf.js : la liste d'opérateurs et les constantes OPS
 * arrivent en paramètres, ce qui permet de tester l'extraction sur une liste
 * fabriquée comme sur la sortie réelle de pdf.js.
 */
import type { PlanPoint } from '../api-types'

// ---------------------------------------------------------------- matrices

/** Matrice affine PDF [a, b, c, d, e, f] : x' = a·x + c·y + e, y' = b·x + d·y + f. */
export type Matrice = [number, number, number, number, number, number]

export const IDENTITE: Matrice = [1, 0, 0, 1, 0, 0]

/** m1 × m2, dans l'ordre de pdf.js : appliquer m2, puis m1. */
export function multiplier(m1: readonly number[], m2: readonly number[]): Matrice {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ]
}

export function appliquer(m: readonly number[], x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]
}

// ---------------------------------------------------------------- extraction

/**
 * Les opérateurs de pdf.js dont l'extraction a besoin (`pdfjsLib.OPS`).
 *
 * Passés en paramètre plutôt qu'importés : le module reste indépendant de la
 * version de pdf.js chargée, et les tests n'ont pas à la charger.
 */
export interface OpsPdf {
  save: number; restore: number; transform: number
  constructPath: number
  moveTo: number; lineTo: number; curveTo: number; curveTo2: number; curveTo3: number
  closePath: number; rectangle: number
  stroke: number; closeStroke: number
  fill: number; eoFill: number
  fillStroke: number; eoFillStroke: number; closeFillStroke: number; closeEOFillStroke: number
  endPath: number
  paintFormXObjectBegin: number; paintFormXObjectEnd: number
  beginAnnotation?: number; endAnnotation?: number
}

export interface ListeOperateurs {
  fnArray: ArrayLike<number>
  argsArray: ArrayLike<unknown>
}

/**
 * Les traits d'une page, dans le repère du canevas de l'éditeur.
 *
 * `segments` range quatre nombres par trait (x1, y1, x2, y2). Les extrémités
 * de courbes (battues de portes, arcs) y figurent comme des traits de longueur
 * nulle : ce sont des sommets auxquels s'accrocher, pas des côtés à suivre.
 */
export interface Geometrie {
  segments: Float64Array
  nombre: number
  /** Vrai si la page dépassait le plafond de traits et n'a été lue qu'en partie. */
  tronquee: boolean
}

/** Au-delà, la page est un fond hachuré ou une image vectorisée : l'aimantation n'y gagne rien. */
export const MAX_SEGMENTS = 250_000

/**
 * Extrait les traits peints d'une liste d'opérateurs pdf.js.
 *
 * Suit la matrice de transformation courante comme le fait le rendu (q, Q,
 * cm, formulaires), applique la transformation de la vue pour passer en
 * pixels du canevas, et ne garde que les chemins réellement peints : un
 * chemin terminé par « n » est un tracé de découpe, invisible, dont le cadre
 * n'a rien à faire dans l'aimantation.
 */
export function extraireSegments(
  liste: ListeOperateurs,
  ops: OpsPdf,
  transformVue: readonly number[],
  maxSegments = MAX_SEGMENTS,
): Geometrie {
  let tampon = new Float64Array(4096)
  let nombre = 0
  let tronquee = false
  const pousser = (x1: number, y1: number, x2: number, y2: number) => {
    if (nombre >= maxSegments) { tronquee = true; return }
    if ((nombre + 1) * 4 > tampon.length) {
      const plus = new Float64Array(tampon.length * 2)
      plus.set(tampon)
      tampon = plus
    }
    tampon.set([x1, y1, x2, y2], nombre * 4)
    nombre++
  }

  let ctm: Matrice = IDENTITE
  const pile: Matrice[] = []
  // Le chemin en cours, déjà en pixels du canevas, en attente de son opérateur de peinture.
  let enAttente: number[] = []
  // Point courant et début du sous-chemin, dans l'espace utilisateur du PDF.
  let cx = 0, cy = 0, dx = 0, dy = 0
  let dansAnnotation = 0

  const vers = (x: number, y: number) => appliquer(multiplier(transformVue, ctm), x, y)
  const segment = (x1: number, y1: number, x2: number, y2: number) => {
    const [a, b] = vers(x1, y1)
    const [c, d] = vers(x2, y2)
    enAttente.push(a, b, c, d)
  }
  const fermer = () => {
    if (cx !== dx || cy !== dy) segment(cx, cy, dx, dy)
    cx = dx; cy = dy
  }
  const peindre = (fermerAvant: boolean) => {
    if (fermerAvant) fermer()
    for (let i = 0; i < enAttente.length; i += 4) pousser(enAttente[i], enAttente[i + 1], enAttente[i + 2], enAttente[i + 3])
    enAttente = []
  }
  const PEINTURES = new Map<number, boolean>([
    [ops.stroke, false], [ops.fill, false], [ops.eoFill, false], [ops.fillStroke, false], [ops.eoFillStroke, false],
    [ops.closeStroke, true], [ops.closeFillStroke, true], [ops.closeEOFillStroke, true],
  ])

  for (let i = 0; i < liste.fnArray.length; i++) {
    const fn = liste.fnArray[i]
    const args = liste.argsArray[i] as unknown[] | null

    // Les annotations du document (tampons, commentaires) ne font pas partie du dessin.
    if (ops.beginAnnotation != null && fn === ops.beginAnnotation) { dansAnnotation++; continue }
    if (ops.endAnnotation != null && fn === ops.endAnnotation) { dansAnnotation = Math.max(0, dansAnnotation - 1); continue }
    if (dansAnnotation > 0) continue

    if (fn === ops.save) pile.push(ctm)
    else if (fn === ops.restore) ctm = pile.pop() ?? ctm
    else if (fn === ops.transform && args && args.length >= 6) ctm = multiplier(ctm, args.slice(0, 6) as number[])
    else if (fn === ops.paintFormXObjectBegin) {
      pile.push(ctm)
      const matrice = args?.[0]
      if (Array.isArray(matrice) && matrice.length === 6) ctm = multiplier(ctm, matrice as number[])
      else if (matrice && typeof matrice === 'object' && 'length' in matrice && (matrice as ArrayLike<number>).length === 6) {
        ctm = multiplier(ctm, Array.from(matrice as ArrayLike<number>))
      }
    } else if (fn === ops.paintFormXObjectEnd) ctm = pile.pop() ?? ctm
    else if (fn === ops.constructPath && args) {
      const sousOps = args[0] as ArrayLike<number>
      const valeurs = args[1] as ArrayLike<number>
      let j = 0
      for (let k = 0; k < sousOps.length; k++) {
        const op = sousOps[k]
        if (op === ops.moveTo) {
          cx = dx = valeurs[j++]; cy = dy = valeurs[j++]
        } else if (op === ops.lineTo) {
          const x = valeurs[j++], y = valeurs[j++]
          segment(cx, cy, x, y)
          cx = x; cy = y
        } else if (op === ops.rectangle) {
          const x = valeurs[j++], y = valeurs[j++], l = valeurs[j++], h = valeurs[j++]
          if (l === 0 || h === 0) segment(x, y, x + l, y + h)
          else {
            segment(x, y, x + l, y)
            segment(x + l, y, x + l, y + h)
            segment(x + l, y + h, x, y + h)
            segment(x, y + h, x, y)
          }
          cx = dx = x; cy = dy = y
        } else if (op === ops.curveTo) {
          // Une courbe n'est pas un côté à suivre : seules ses extrémités comptent.
          const x = valeurs[j + 4], y = valeurs[j + 5]
          j += 6
          segment(cx, cy, cx, cy)
          segment(x, y, x, y)
          cx = x; cy = y
        } else if (op === ops.curveTo2 || op === ops.curveTo3) {
          const x = valeurs[j + 2], y = valeurs[j + 3]
          j += 4
          segment(cx, cy, cx, cy)
          segment(x, y, x, y)
          cx = x; cy = y
        } else if (op === ops.closePath) {
          fermer()
        }
      }
    } else if (fn === ops.endPath) {
      enAttente = []
    } else if (PEINTURES.has(fn)) {
      peindre(PEINTURES.get(fn)!)
    }
  }

  return { segments: tampon.slice(0, nombre * 4), nombre, tronquee }
}

// ---------------------------------------------------------------- index spatial

const CELLULE = 16

/**
 * Une grille qui retrouve vite les traits proches d'un point ou d'un segment.
 *
 * Un plan d'immeuble porte des dizaines de milliers de traits ; les parcourir
 * tous pour chaque sommet proposé et chaque côté envisagé serait trop lent.
 * Chaque trait est inscrit dans les cases qu'il traverse.
 */
export class IndexGeometrie {
  readonly geo: Geometrie
  private cases = new Map<number, number[]>()

  constructor(geo: Geometrie) {
    this.geo = geo
    const s = geo.segments
    for (let i = 0; i < geo.nombre; i++) {
      const x1 = s[i * 4], y1 = s[i * 4 + 1], x2 = s[i * 4 + 2], y2 = s[i * 4 + 3]
      const l = Math.hypot(x2 - x1, y2 - y1)
      const pas = Math.max(1, Math.ceil(l / (CELLULE / 2)))
      let derniere = Number.NaN
      for (let k = 0; k <= pas; k++) {
        const cle = IndexGeometrie.cle(x1 + ((x2 - x1) * k) / pas, y1 + ((y2 - y1) * k) / pas)
        if (cle === derniere) continue
        derniere = cle
        const liste = this.cases.get(cle)
        if (!liste) this.cases.set(cle, [i])
        else if (liste[liste.length - 1] !== i) liste.push(i)
      }
    }
  }

  private static cle(x: number, y: number): number {
    const cx = Math.floor(x / CELLULE) + 32768
    const cy = Math.floor(y / CELLULE) + 32768
    return cx * 65536 + cy
  }

  /** Traits passant par les cases qui couvrent le rectangle donné (une case de marge). */
  dansLeRectangle(x0: number, y0: number, x1: number, y1: number): number[] {
    const vus = new Set<number>()
    const ax = Math.floor(Math.min(x0, x1) / CELLULE) - 1, bx = Math.floor(Math.max(x0, x1) / CELLULE) + 1
    const ay = Math.floor(Math.min(y0, y1) / CELLULE) - 1, by = Math.floor(Math.max(y0, y1) / CELLULE) + 1
    for (let cx = ax; cx <= bx; cx++) {
      for (let cy = ay; cy <= by; cy++) {
        const liste = this.cases.get((cx + 32768) * 65536 + (cy + 32768))
        if (liste) for (const i of liste) vus.add(i)
      }
    }
    return [...vus]
  }

  /** Traits proches du segment AB : ceux des cases qu'il traverse. */
  lelongDe(a: PlanPoint, b: PlanPoint): number[] {
    const l = Math.hypot(b.x - a.x, b.y - a.y)
    const pas = Math.max(1, Math.ceil(l / CELLULE))
    const vus = new Set<number>()
    for (let k = 0; k <= pas; k++) {
      const x = a.x + ((b.x - a.x) * k) / pas, y = a.y + ((b.y - a.y) * k) / pas
      const cx = Math.floor(x / CELLULE), cy = Math.floor(y / CELLULE)
      for (let ix = cx - 1; ix <= cx + 1; ix++) {
        for (let iy = cy - 1; iy <= cy + 1; iy++) {
          const liste = this.cases.get((ix + 32768) * 65536 + (iy + 32768))
          if (liste) for (const i of liste) vus.add(i)
        }
      }
    }
    return [...vus]
  }

  segment(i: number): [number, number, number, number] {
    const s = this.geo.segments
    return [s[i * 4], s[i * 4 + 1], s[i * 4 + 2], s[i * 4 + 3]]
  }
}

// ---------------------------------------------------------------- accroches

export type NatureAccroche = 'sommet' | 'intersection'

export interface Accroche {
  x: number
  y: number
  nature: NatureAccroche
  /**
   * Deux traits non parallèles s'y rejoignent ou s'y croisent : un angle de
   * mur, un coin de cadre, le pied d'une ligne d'attache sur sa ligne de cote.
   * Le bout libre d'un trait (le dépassement d'une ligne de cote, l'extrémité
   * d'une ligne d'attache) n'en est pas un, et vaut moins comme sommet.
   */
  croisement: boolean
  distance: number
}

/** Rayon d'aimantation par défaut, en pixels du canevas de 1600 px de large. */
export const RAYON_AIMANTATION = 12

/** Nombre d'accroches gardées par sommet : les plus proches. */
const ACCROCHES_PAR_SOMMET = 8
/** Au-delà, la case est une hachure : on ne croise que les traits les plus proches. */
const TRAITS_CROISES_MAX = 160

function distancePointSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1, dy = y2 - y1
  const l2 = dx * dx + dy * dy
  if (l2 === 0) return Math.hypot(px - x1, py - y1)
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

/**
 * Intersection de deux traits, prolongés d'un pixel et demi : deux murs dont
 * les traits s'arrêtent juste avant de se toucher ont quand même un angle.
 */
function intersection(a: [number, number, number, number], b: [number, number, number, number]): [number, number] | null {
  const [x1, y1, x2, y2] = a
  const [x3, y3, x4, y4] = b
  const d1x = x2 - x1, d1y = y2 - y1, d2x = x4 - x3, d2y = y4 - y3
  const l1 = Math.hypot(d1x, d1y), l2 = Math.hypot(d2x, d2y)
  if (l1 < 0.5 || l2 < 0.5) return null
  const den = d1x * d2y - d1y * d2x
  // Presque parallèles (moins d'un degré) : pas d'angle à chercher.
  if (Math.abs(den) < Math.sin(Math.PI / 180) * l1 * l2) return null
  const t = ((x3 - x1) * d2y - (y3 - y1) * d2x) / den
  const u = ((x3 - x1) * d1y - (y3 - y1) * d1x) / den
  const e1 = 1.5 / l1, e2 = 1.5 / l2
  if (t < -e1 || t > 1 + e1 || u < -e2 || u > 1 + e2) return null
  return [x1 + t * d1x, y1 + t * d1y]
}

/**
 * Les sommets et intersections du dessin à moins de `rayon` du point, du plus
 * proche au plus lointain. Deux accroches à moins d'un tiers de pixel l'une
 * de l'autre n'en font qu'une.
 */
export function accrochesPres(index: IndexGeometrie, p: PlanPoint, rayon = RAYON_AIMANTATION): Accroche[] {
  const proches = index.dansLeRectangle(p.x - rayon, p.y - rayon, p.x + rayon, p.y + rayon)
  const trouvees: Accroche[] = []
  const ajouter = (x: number, y: number, nature: NatureAccroche) => {
    const distance = Math.hypot(x - p.x, y - p.y)
    if (distance > rayon) return
    const croisement = nature === 'intersection'
    const deja = trouvees.find((a) => Math.hypot(a.x - x, a.y - y) < 0.33)
    if (deja) {
      // Une extrémité qui est aussi un croisement reste un sommet, le plus sûr
      // des deux, et garde la trace du croisement.
      if (nature === 'sommet') deja.nature = 'sommet'
      if (croisement) deja.croisement = true
      return
    }
    trouvees.push({ x, y, nature, croisement, distance })
  }

  const traits: { i: number; d: number }[] = []
  for (const i of proches) {
    const [x1, y1, x2, y2] = index.segment(i)
    ajouter(x1, y1, 'sommet')
    ajouter(x2, y2, 'sommet')
    const d = distancePointSegment(p.x, p.y, x1, y1, x2, y2)
    if (d <= rayon && (x1 !== x2 || y1 !== y2)) traits.push({ i, d })
  }
  traits.sort((a, b) => a.d - b.d)
  const croises = traits.slice(0, TRAITS_CROISES_MAX).map((t) => index.segment(t.i))
  for (let a = 0; a < croises.length; a++) {
    for (let b = a + 1; b < croises.length; b++) {
      const x = intersection(croises[a], croises[b])
      if (x) ajouter(x[0], x[1], 'intersection')
    }
  }
  return trouvees.sort((a, b) => a.distance - b.distance).slice(0, ACCROCHES_PAR_SOMMET)
}

/**
 * Part du côté AB recouverte par des traits du dessin, de 0 à 1.
 *
 * Un trait compte s'il est couché sur la droite AB, à `tolerance` pixel près
 * à ses deux bouts ; sa projection sur AB s'ajoute aux autres sans compter
 * deux fois les recouvrements. Un côté de façade suivi par son trait de
 * contour vaut 1 ; un côté inventé entre deux extrémités de cotes vaut 0.
 */
export function couverture(index: IndexGeometrie, a: PlanPoint, b: PlanPoint, tolerance = 1.2): number {
  const lx = b.x - a.x, ly = b.y - a.y
  const l = Math.hypot(lx, ly)
  if (l < 1) return 0
  const ux = lx / l, uy = ly / l
  const intervalles: [number, number][] = []
  for (const i of index.lelongDe(a, b)) {
    const [x1, y1, x2, y2] = index.segment(i)
    if (x1 === x2 && y1 === y2) continue
    const n1 = Math.abs((x1 - a.x) * uy - (y1 - a.y) * ux)
    const n2 = Math.abs((x2 - a.x) * uy - (y2 - a.y) * ux)
    if (n1 > tolerance || n2 > tolerance) continue
    const t1 = (x1 - a.x) * ux + (y1 - a.y) * uy
    const t2 = (x2 - a.x) * ux + (y2 - a.y) * uy
    const debut = Math.max(0, Math.min(t1, t2)), fin = Math.min(l, Math.max(t1, t2))
    if (fin > debut) intervalles.push([debut, fin])
  }
  intervalles.sort((p, q) => p[0] - q[0])
  let total = 0, courantDebut = -1, courantFin = -1
  for (const [d, f] of intervalles) {
    if (d > courantFin) {
      if (courantFin > courantDebut) total += courantFin - courantDebut
      courantDebut = d; courantFin = f
    } else if (f > courantFin) courantFin = f
  }
  if (courantFin > courantDebut) total += courantFin - courantDebut
  return Math.min(1, total / l)
}

// ---------------------------------------------------------------- aimantation

export interface OptionsAimantation {
  /** Contour fermé (surface) ou trait ouvert (longueur, cote). */
  ferme: boolean
  rayon?: number
  /**
   * À égalité de traits suivis, quel contour préférer : l'extérieur pour le
   * cadre et non le vitrage d'une fenêtre, le nu extérieur d'un mur ;
   * l'intérieur pour une dalle mesurée entre les murs de façade.
   */
  preference?: 'exterieur' | 'interieur' | null
}

export interface ResultatAimantation {
  points: PlanPoint[]
  /** Pour chaque sommet : s'est-il accroché au dessin ? */
  aimantes: boolean[]
  nombreAimantes: number
  /** Vrai si tous les sommets se sont accrochés. */
  complete: boolean
  /** Couverture moyenne des côtés par des traits du dessin, de 0 à 1. */
  couvertureMoyenne: number
}

// Poids du choix : suivre un trait dessiné compte le plus ; un angle où deux
// traits se rejoignent vaut mieux que le bout libre d'un trait ; s'éloigner du
// point proposé coûte un peu ; rester en l'air coûte davantage qu'un écart modeste.
const POIDS_COTE = 1
const POIDS_DISTANCE = 0.35
const POIDS_EXTERIEUR = 0.5
const POIDS_CROISEMENT = 0.2
const COUT_LIBRE = 0.25

function aireSignee(pts: PlanPoint[]): number {
  let s = 0
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length
    s += pts[i].x * pts[j].y - pts[j].x * pts[i].y
  }
  return s / 2
}

/** Normale extérieure en chaque sommet d'un contour fermé : la bissectrice des normales de ses deux côtés. */
function normalesExterieures(pts: PlanPoint[]): PlanPoint[] {
  const signe = aireSignee(pts) >= 0 ? 1 : -1
  const n = pts.length
  const normaleCote = (i: number): PlanPoint => {
    const a = pts[i], b = pts[(i + 1) % n]
    const dx = b.x - a.x, dy = b.y - a.y
    const l = Math.hypot(dx, dy) || 1
    return { x: (signe * dy) / l, y: (-signe * dx) / l }
  }
  return pts.map((_, i) => {
    const avant = normaleCote((i - 1 + n) % n), apres = normaleCote(i)
    const x = avant.x + apres.x, y = avant.y + apres.y
    const l = Math.hypot(x, y)
    return l > 1e-6 ? { x: x / l, y: y / l } : apres
  })
}

/**
 * Accroche les sommets d'une zone au dessin vectoriel.
 *
 * Chaque sommet a ses accroches possibles, plus lui-même tel que proposé. La
 * combinaison retenue est celle qui maximise, sur tout le contour, la part des
 * côtés suivie par des traits du dessin, moins un petit coût par pixel de
 * déplacement, avec la préférence extérieure en arbitre. Le choix se fait par
 * programmation dynamique autour du contour : quelques candidats par sommet,
 * le calcul reste instantané même pour un contour de cinquante sommets.
 *
 * Un sommet sans accroche dans le rayon reste où il est, et la zone n'est
 * alors pas « aimantée » : elle le dira dans la liste des propositions.
 */
export function aimanter(index: IndexGeometrie | null, points: PlanPoint[], options: OptionsAimantation): ResultatAimantation {
  const n = points.length
  const libre = (): ResultatAimantation => ({
    points: points.map((p) => ({ ...p })), aimantes: points.map(() => false), nombreAimantes: 0, complete: false, couvertureMoyenne: 0,
  })
  if (!index || index.geo.nombre === 0 || n === 0) return libre()

  const rayon = options.rayon ?? RAYON_AIMANTATION
  const normales = options.ferme && options.preference && n >= 3 ? normalesExterieures(points) : null
  const sens = options.preference === 'interieur' ? -1 : 1

  interface Candidat { p: PlanPoint; aimante: boolean; score: number }
  const candidats: Candidat[][] = points.map((p, i) => {
    const liste: Candidat[] = [{ p: { ...p }, aimante: false, score: -COUT_LIBRE }]
    for (const a of accrochesPres(index, p, rayon)) {
      let score = -POIDS_DISTANCE * (a.distance / rayon) + (a.croisement ? POIDS_CROISEMENT : 0)
      if (normales) {
        const dehors = (sens * ((a.x - p.x) * normales[i].x + (a.y - p.y) * normales[i].y)) / rayon
        score += POIDS_EXTERIEUR * Math.max(-1, Math.min(1, dehors))
      }
      liste.push({ p: { x: a.x, y: a.y }, aimante: true, score })
    }
    return liste
  })
  if (candidats.every((c) => c.length === 1)) return libre()

  const memo = new Map<string, number>()
  const cote = (i: number, a: number, j: number, b: number) => {
    const cle = `${i}:${a}:${j}:${b}`
    let v = memo.get(cle)
    if (v === undefined) {
      v = POIDS_COTE * couverture(index, candidats[i][a].p, candidats[j][b].p)
      memo.set(cle, v)
    }
    return v
  }

  // Programmation dynamique le long du contour. Pour un contour fermé, le
  // candidat du premier sommet est fixé tour à tour, et le dernier côté
  // referme sur lui ; un trait ouvert se parcourt en une fois.
  const parcourir = (depart: number | null): { score: number; choix: number[] } => {
    let scores = candidats[0].map((c, k) => (depart === null || k === depart ? c.score : -Infinity))
    const retours: number[][] = []
    for (let i = 1; i < n; i++) {
      const suivants = candidats[i].map(() => -Infinity)
      const retour = candidats[i].map(() => 0)
      for (let b = 0; b < candidats[i].length; b++) {
        for (let a = 0; a < candidats[i - 1].length; a++) {
          if (scores[a] === -Infinity) continue
          const v = scores[a] + cote(i - 1, a, i, b) + candidats[i][b].score
          if (v > suivants[b]) { suivants[b] = v; retour[b] = a }
        }
      }
      retours.push(retour)
      scores = suivants
    }
    let meilleur = -Infinity, fin = 0
    for (let b = 0; b < scores.length; b++) {
      if (scores[b] === -Infinity) continue
      const total = scores[b] + (depart !== null ? cote(n - 1, b, 0, depart) : 0)
      if (total > meilleur) { meilleur = total; fin = b }
    }
    const choix = new Array<number>(n)
    choix[n - 1] = fin
    for (let i = n - 1; i >= 1; i--) choix[i - 1] = retours[i - 1][choix[i]]
    return { score: meilleur, choix }
  }

  let meilleurChoix: number[]
  if (options.ferme && n >= 3) {
    let meilleur = { score: -Infinity, choix: [] as number[] }
    for (let k0 = 0; k0 < candidats[0].length; k0++) {
      const essai = parcourir(k0)
      if (essai.score > meilleur.score) meilleur = essai
    }
    meilleurChoix = meilleur.choix
  } else {
    meilleurChoix = parcourir(null).choix
  }

  const retenus = meilleurChoix.map((k, i) => candidats[i][k])
  const resultat = retenus.map((c) => ({ ...c.p }))
  // Deux sommets accrochés au même point dégénèrent le contour : on garde alors la proposition.
  const distincts = new Set(resultat.map((p) => `${p.x.toFixed(2)}:${p.y.toFixed(2)}`)).size
  if (distincts < Math.min(n, options.ferme ? 3 : 2)) return libre()

  const aimantes = retenus.map((c) => c.aimante)
  const nombreAimantes = aimantes.filter(Boolean).length
  const cotes = options.ferme && n >= 3 ? n : n - 1
  let somme = 0
  for (let i = 0; i < cotes; i++) somme += couverture(index, resultat[i], resultat[(i + 1) % n])
  return {
    points: resultat,
    aimantes,
    nombreAimantes,
    complete: nombreAimantes === n,
    couvertureMoyenne: cotes > 0 ? somme / cotes : 0,
  }
}
