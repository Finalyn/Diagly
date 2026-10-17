/**
 * Scanner un plan papier : d'une photo prise de biais, un PDF à l'échelle.
 *
 * Un plan imprimé se photographie rarement de face. Pour qu'il se mesure
 * comme un PDF d'architecte, il faut trois choses, et c'est ce module :
 *
 * - redresser la feuille : ses quatre coins, repérés sur la photo (détection
 *   du plus grand quadrilatère clair, ou à la main), donnent l'homographie
 *   qui ramène la feuille à un rectangle, à la résolution de la photo ;
 * - retrouver ses proportions : une photo de biais raccourcit un côté plus
 *   que l'autre. La méthode de Zhang et He (« Whiteboard scanning and image
 *   enhancement », 2007) les déduit des quatre coins, en estimant au passage
 *   la focale de l'appareil. Toutes les feuilles A ont les mêmes proportions
 *   (1 sur racine de 2) : le rapport dit l'orientation et confirme qu'on a
 *   bien les coins de la feuille, pas sa taille, que l'on choisit ;
 * - donner à la page du PDF la taille réelle de la feuille (A3 paysage :
 *   420 × 297 mm). L'analyse lit alors l'échelle imprimée, « 1:100 », et la
 *   vérifie sur une cote, exactement comme pour un PDF vectoriel
 *   (echelle-exacte.ts). Une taille fausse se voit à cette vérification.
 *
 * L'amélioration d'un plan photographié corrige l'éclairage (le papier
 * devient blanc partout, ombre comprise) et tend le contraste, sans seuil
 * brutal : un trait fin et gris reste un trait, il ne disparaît pas dans le
 * blanc ni ne s'épaissit en noir.
 *
 * Module pur, sans canevas ni réseau (jsPDF seul, chargé à la demande pour
 * l'assemblage), pour être vérifiable par les tests.
 */

export interface Point { x: number; y: number }
/** Les coins d'une feuille : haut-gauche, haut-droite, bas-droite, bas-gauche. */
export type Quad = [Point, Point, Point, Point]
/** Une matrice 3 × 3, ligne par ligne. */
export type Matrice3 = [number, number, number, number, number, number, number, number, number]

const dist = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y)

// ---------------------------------------------------------------- homographie

/**
 * L'homographie qui envoie les quatre points `de` sur les quatre points
 * `vers` : huit équations, huit inconnues (le dernier terme vaut 1), résolues
 * par élimination de Gauss avec pivot partiel. Null si les points sont
 * dégénérés (trois alignés).
 */
export function homographie(de: Quad, vers: Quad): Matrice3 | null {
  const a: number[][] = []
  for (let i = 0; i < 4; i++) {
    const { x, y } = de[i]
    const { x: u, y: v } = vers[i]
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u])
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y, v])
  }
  for (let c = 0; c < 8; c++) {
    let pivot = c
    for (let r = c + 1; r < 8; r++) if (Math.abs(a[r][c]) > Math.abs(a[pivot][c])) pivot = r
    if (Math.abs(a[pivot][c]) < 1e-12) return null
    ;[a[c], a[pivot]] = [a[pivot], a[c]]
    for (let r = 0; r < 8; r++) {
      if (r === c) continue
      const k = a[r][c] / a[c][c]
      if (k === 0) continue
      for (let j = c; j < 9; j++) a[r][j] -= k * a[c][j]
    }
  }
  const h = a.map((ligne, i) => ligne[8] / ligne[i])
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1]
}

export function appliquer(m: Matrice3, p: Point): Point {
  const w = m[6] * p.x + m[7] * p.y + m[8]
  return { x: (m[0] * p.x + m[1] * p.y + m[2]) / w, y: (m[3] * p.x + m[4] * p.y + m[5]) / w }
}

/** Les coins d'un rectangle de l × h, dans l'ordre des coins d'une feuille. */
export function rectangle(largeur: number, hauteur: number): Quad {
  return [{ x: 0, y: 0 }, { x: largeur, y: 0 }, { x: largeur, y: hauteur }, { x: 0, y: hauteur }]
}

/** Les coins proposés quand rien n'est détecté : un peu en retrait des bords de la photo. */
export function coinsParDefaut(largeur: number, hauteur: number, retrait = 0.04): Quad {
  const dx = largeur * retrait, dy = hauteur * retrait
  return [{ x: dx, y: dy }, { x: largeur - dx, y: dy }, { x: largeur - dx, y: hauteur - dy }, { x: dx, y: hauteur - dy }]
}

/**
 * Quatre points remis dans l'ordre des coins : un coin tiré par-dessus son
 * voisin ne retourne pas la feuille. Tri par angle autour du centre, puis le
 * haut-gauche en premier (le plus petit x + y).
 */
export function ordonnerCoins(points: Point[]): Quad {
  const c = { x: points.reduce((s, p) => s + p.x, 0) / 4, y: points.reduce((s, p) => s + p.y, 0) / 4 }
  const tries = [...points].sort((p, q) => Math.atan2(p.y - c.y, p.x - c.x) - Math.atan2(q.y - c.y, q.x - c.x))
  let debut = 0
  for (let i = 1; i < 4; i++) if (tries[i].x + tries[i].y < tries[debut].x + tries[debut].y) debut = i
  const q = [0, 1, 2, 3].map((k) => tries[(debut + k) % 4])
  return [q[0], q[1], q[2], q[3]]
}

/** Le quadrilatère est-il convexe, sans côté de longueur nulle ? */
export function estConvexe(q: Quad): boolean {
  let signe = 0
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4], c = q[(i + 2) % 4]
    const z = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)
    if (Math.abs(z) < 1e-9) return false
    if (signe === 0) signe = Math.sign(z)
    else if (Math.sign(z) !== signe) return false
  }
  return true
}

// ---------------------------------------------------------------- proportions

type V3 = [number, number, number]
const vect = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const scal = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

/**
 * Le rapport largeur / hauteur de la feuille réelle, déduit de ses quatre
 * coins sur la photo (Zhang et He). Le centre optique est pris au centre de
 * la photo ; la focale se déduit des coins. Photographiée presque de face, la
 * feuille ne dit rien de la focale : on en prend une ordinaire (celle d'un
 * objectif de téléphone), et le rapport vaut alors à peu près celui des côtés.
 */
export function rapportDeLaFeuille(coins: Quad, largeurImage: number, hauteurImage: number): number {
  const u0 = largeurImage / 2, v0 = hauteurImage / 2
  const [hg, hd, bd, bg] = coins
  const m = (p: Point): V3 => [p.x - u0, p.y - v0, 1]
  const m1 = m(hg), m2 = m(hd), m3 = m(bg), m4 = m(bd)
  const k2 = scal(vect(m1, m4), m3) / scal(vect(m2, m4), m3)
  const k3 = scal(vect(m1, m4), m2) / scal(vect(m3, m4), m2)
  const n2: V3 = [k2 * m2[0] - m1[0], k2 * m2[1] - m1[1], k2 * m2[2] - m1[2]]
  const n3: V3 = [k3 * m3[0] - m1[0], k3 * m3[1] - m1[1], k3 * m3[2] - m1[2]]
  const grand = Math.max(largeurImage, hauteurImage)
  let f2 = -(n2[0] * n3[0] + n2[1] * n3[1]) / (n2[2] * n3[2])
  // Une focale hors de ce qu'un appareil photo peut avoir trahit une feuille vue de face.
  if (!Number.isFinite(f2) || f2 < (0.25 * grand) ** 2 || f2 > (6 * grand) ** 2) f2 = (0.8 * grand) ** 2
  const r = Math.sqrt((n2[0] ** 2 + n2[1] ** 2 + f2 * n2[2] ** 2) / (n3[0] ** 2 + n3[1] ** 2 + f2 * n3[2] ** 2))
  if (Number.isFinite(r) && r > 0) return r
  // Dernier recours : la moyenne des côtés opposés.
  return (dist(hg, hd) + dist(bg, bd)) / (dist(hg, bg) + dist(hd, bd))
}

/**
 * La taille en pixels de la feuille redressée : le côté le mieux résolu sur
 * la photo garde sa résolution, l'autre suit le rapport. Au-delà de
 * `maxPixels` (la limite des canevas de Safari sur iPhone et iPad), tout se
 * réduit d'autant.
 */
export function tailleRedressee(coins: Quad, rapport: number, maxPixels = 14_000_000): { largeur: number; hauteur: number } {
  const [hg, hd, bd, bg] = coins
  const l = Math.max(dist(hg, hd), dist(bg, bd))
  const h = Math.max(dist(hg, bg), dist(hd, bd))
  let largeur = Math.max(l, h * rapport)
  let hauteur = largeur / rapport
  const k = Math.min(1, Math.sqrt(maxPixels / (largeur * hauteur)))
  largeur *= k
  hauteur *= k
  return { largeur: Math.max(1, Math.round(largeur)), hauteur: Math.max(1, Math.round(hauteur)) }
}

// ---------------------------------------------------------------- formats

export type FormatPapier = 'A4' | 'A3' | 'A2' | 'A1' | 'A0'
export type Orientation = 'portrait' | 'paysage'

/** Les formats ISO 216, en millimètres, debout. */
export const FORMATS: Record<FormatPapier, { largeur: number; hauteur: number }> = {
  A4: { largeur: 210, hauteur: 297 },
  A3: { largeur: 297, hauteur: 420 },
  A2: { largeur: 420, hauteur: 594 },
  A1: { largeur: 594, hauteur: 841 },
  A0: { largeur: 841, hauteur: 1189 },
}
export const LISTE_FORMATS: readonly FormatPapier[] = ['A4', 'A3', 'A2', 'A1', 'A0']

/** Le format le plus courant d'un plan imprimé au bureau : proposé tant qu'on n'a rien choisi. */
export const FORMAT_PAR_DEFAUT: FormatPapier = 'A3'

/**
 * Écart toléré entre le rapport mesuré et celui d'une feuille A. En deçà,
 * c'est l'imprécision des coins, et la page prend le format exact ; au-delà,
 * les coins ne sont pas ceux d'une feuille A (feuille coupée, cadrage sur le
 * seul dessin) et l'image garde ses proportions.
 */
export const TOLERANCE_FORMAT = 0.04

export interface ProposeFormat {
  orientation: Orientation
  /** Les proportions sont celles d'une feuille A. */
  conforme: boolean
  /** Écart relatif au rapport d'une feuille A. */
  ecart: number
}

/** L'orientation que le rapport des côtés indique, et s'il est celui d'une feuille A. */
export function proposerFormat(rapport: number): ProposeFormat {
  const long = Math.max(rapport, 1 / rapport)
  const ecart = Math.abs(long - Math.SQRT2) / Math.SQRT2
  return { orientation: rapport >= 1 ? 'paysage' : 'portrait', conforme: ecart <= TOLERANCE_FORMAT, ecart }
}

export function dimensionsPage(format: FormatPapier, orientation: Orientation): { largeur: number; hauteur: number } {
  const f = FORMATS[format]
  return orientation === 'paysage' ? { largeur: f.hauteur, hauteur: f.largeur } : { ...f }
}

/** Un point PDF vaut 1/72 de pouce. */
export const PT_PAR_MM = 72 / 25.4

export interface PlacementPage {
  /** La page, en millimètres. */
  largeur: number
  hauteur: number
  /** L'image dans la page, en millimètres. */
  x: number
  y: number
  l: number
  h: number
  /** L'image couvre la page bord à bord : ses coins sont ceux de la feuille. */
  pleinePage: boolean
}

/**
 * Où poser l'image redressée sur la page du format choisi. Aux proportions
 * d'une feuille A près de la tolérance, elle la couvre bord à bord (c'est la
 * feuille même, et l'échelle imprimée s'y applique) ; sinon elle s'y loge
 * sans être déformée, centrée.
 */
export function placement(largeurPx: number, hauteurPx: number, format: FormatPapier, orientation: Orientation): PlacementPage {
  const page = dimensionsPage(format, orientation)
  const rImage = largeurPx / hauteurPx
  const rPage = page.largeur / page.hauteur
  if (Math.abs(rImage - rPage) / rPage <= TOLERANCE_FORMAT) {
    return { ...page, x: 0, y: 0, l: page.largeur, h: page.hauteur, pleinePage: true }
  }
  const k = Math.min(page.largeur / largeurPx, page.hauteur / hauteurPx)
  const l = largeurPx * k, h = hauteurPx * k
  return { ...page, x: (page.largeur - l) / 2, y: (page.hauteur - h) / 2, l, h, pleinePage: false }
}

/** « Scan du 17.10.2026.pdf » */
export function nomDuScan(date = new Date()): string {
  const d = (n: number) => String(n).padStart(2, '0')
  return `Scan du ${d(date.getDate())}.${d(date.getMonth() + 1)}.${date.getFullYear()}.pdf`
}

// ---------------------------------------------------------------- assemblage

export interface PageAAssembler {
  /** L'image redressée, en JPEG. */
  jpeg: Uint8Array
  largeurPx: number
  hauteurPx: number
  format: FormatPapier
  orientation: Orientation
}

/**
 * Les pages scannées, en un seul PDF dont chaque page a la taille réelle de
 * sa feuille. Les images passent telles quelles (JPEG), sans être recompressées.
 */
export async function assemblerPdf(pages: PageAAssembler[], titre = 'Plan scanné'): Promise<ArrayBuffer> {
  if (!pages.length) throw new Error('Aucune page à assembler.')
  const { jsPDF } = await import('jspdf')
  let doc: InstanceType<typeof jsPDF> | null = null
  for (const p of pages) {
    const pl = placement(p.largeurPx, p.hauteurPx, p.format, p.orientation)
    const sens = pl.largeur > pl.hauteur ? 'landscape' : 'portrait'
    if (!doc) doc = new jsPDF({ unit: 'mm', format: [pl.largeur, pl.hauteur], orientation: sens, compress: true })
    else doc.addPage([pl.largeur, pl.hauteur], sens)
    doc.addImage(p.jpeg, 'JPEG', pl.x, pl.y, pl.l, pl.h, undefined, 'NONE')
  }
  doc!.setProperties({ title: titre, creator: 'Diagly' })
  return doc!.output('arraybuffer')
}

// ---------------------------------------------------------------- détection de la feuille

export interface ImageGrise {
  largeur: number
  hauteur: number
  /** Une valeur de 0 à 255 par pixel, ligne par ligne. */
  gris: Uint8Array | Uint8ClampedArray
}

/** Les niveaux de gris d'une image RGBA, éventuellement réduite d'un facteur entier. */
export function niveauxDeGris(rgba: Uint8ClampedArray | Uint8Array, largeur: number, hauteur: number): ImageGrise {
  const gris = new Uint8Array(largeur * hauteur)
  for (let i = 0, j = 0; j < gris.length; i += 4, j++) gris[j] = (rgba[i] * 77 + rgba[i + 1] * 150 + rgba[i + 2] * 29) >> 8
  return { largeur, hauteur, gris }
}

/** Le seuil d'Otsu : celui qui sépare le mieux les clairs des sombres. Rend aussi la qualité de la séparation. */
export function seuilOtsu(gris: Uint8Array | Uint8ClampedArray): { seuil: number; separation: number } {
  const histo = new Float64Array(256)
  for (let i = 0; i < gris.length; i++) histo[gris[i]]++
  const total = gris.length
  let somme = 0
  for (let i = 0; i < 256; i++) somme += i * histo[i]
  let sommeB = 0, poidsB = 0, meilleur = 0, seuil = 127
  for (let t = 0; t < 256; t++) {
    poidsB += histo[t]
    if (!poidsB) continue
    const poidsF = total - poidsB
    if (!poidsF) break
    sommeB += t * histo[t]
    const mB = sommeB / poidsB, mF = (somme - sommeB) / poidsF
    const v = poidsB * poidsF * (mB - mF) ** 2
    if (v > meilleur) { meilleur = v; seuil = t }
  }
  // Variance inter-classes rapportée à la variance totale : près de 1, deux populations nettes.
  const moyenne = somme / total
  let variance = 0
  for (let i = 0; i < 256; i++) variance += histo[i] * (i - moyenne) ** 2
  variance /= total
  return { seuil, separation: variance > 0 ? meilleur / (total * total) / variance : 0 }
}

/** Une droite ajustée sur des points (moindres carrés orthogonaux) : un point et une direction. */
function droite(points: Point[]): { p: Point; d: Point } | null {
  if (points.length < 5) return null
  let sx = 0, sy = 0
  for (const q of points) { sx += q.x; sy += q.y }
  const cx = sx / points.length, cy = sy / points.length
  let xx = 0, xy = 0, yy = 0
  for (const q of points) {
    const dx = q.x - cx, dy = q.y - cy
    xx += dx * dx; xy += dx * dy; yy += dy * dy
  }
  const angle = 0.5 * Math.atan2(2 * xy, xx - yy)
  return { p: { x: cx, y: cy }, d: { x: Math.cos(angle), y: Math.sin(angle) } }
}

function intersection(a: { p: Point; d: Point }, b: { p: Point; d: Point }): Point | null {
  const det = a.d.x * b.d.y - a.d.y * b.d.x
  if (Math.abs(det) < 1e-9) return null
  const t = ((b.p.x - a.p.x) * b.d.y - (b.p.y - a.p.y) * b.d.x) / det
  return { x: a.p.x + t * a.d.x, y: a.p.y + t * a.d.y }
}

function distanceALaDroite(q: Point, a: Point, b: Point): number {
  const l = dist(a, b)
  return l ? Math.abs((b.x - a.x) * (a.y - q.y) - (a.x - q.x) * (b.y - a.y)) / l : dist(q, a)
}

/**
 * La feuille sur la photo : le plus grand quadrilatère clair, posé sur un
 * fond plus sombre. L'image est séparée en clair et sombre (seuil d'Otsu), la
 * plus grande tache claire retenue ; ses points extrêmes donnent les coins,
 * puis chaque bord, suivi colonne par colonne ou ligne par ligne, donne une
 * droite, et les coins sont pris à l'intersection des droites. Les traits du
 * dessin, à l'intérieur, n'y touchent pas : seul le bord extérieur compte.
 *
 * Null quand ce n'est pas fiable : pas de contraste, tache trop petite, ou
 * feuille qui déborde du cadre (on ne voit pas ses coins). On place alors les
 * coins à la main.
 */
export function detecterFeuille(img: ImageGrise): Quad | null {
  const { largeur: L, hauteur: H, gris } = img
  if (L < 16 || H < 16) return null
  // Un léger flou (3 × 3) : le grain de la photo ne doit pas trouer la feuille.
  const flou = new Uint8Array(L * H)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < L; x++) {
      let s = 0, n = 0
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy
        if (yy < 0 || yy >= H) continue
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx
          if (xx < 0 || xx >= L) continue
          s += gris[yy * L + xx]; n++
        }
      }
      flou[y * L + x] = s / n
    }
  }
  const { seuil, separation } = seuilOtsu(flou)
  if (separation < 0.5) return null

  // La plus grande tache claire, remplie par une pile (4-connexité).
  const etiquette = new Int32Array(L * H)
  const pile = new Int32Array(L * H)
  let meilleure = 0, taille = 0, n = 0
  for (let i = 0; i < L * H; i++) {
    if (etiquette[i] || flou[i] <= seuil) continue
    n++
    let haut = 0, compte = 0
    pile[haut++] = i
    etiquette[i] = n
    while (haut) {
      const k = pile[--haut]
      compte++
      const x = k % L, y = (k - x) / L
      if (x > 0 && !etiquette[k - 1] && flou[k - 1] > seuil) { etiquette[k - 1] = n; pile[haut++] = k - 1 }
      if (x < L - 1 && !etiquette[k + 1] && flou[k + 1] > seuil) { etiquette[k + 1] = n; pile[haut++] = k + 1 }
      if (y > 0 && !etiquette[k - L] && flou[k - L] > seuil) { etiquette[k - L] = n; pile[haut++] = k - L }
      if (y < H - 1 && !etiquette[k + L] && flou[k + L] > seuil) { etiquette[k + L] = n; pile[haut++] = k + L }
    }
    if (compte > taille) { taille = compte; meilleure = n }
  }
  if (taille < 0.12 * L * H) return null

  // Les extrémités de la tache, colonne par colonne et ligne par ligne, et ses points extrêmes.
  const colMin = new Int32Array(L).fill(-1), colMax = new Int32Array(L).fill(-1)
  const ligMin = new Int32Array(H).fill(-1), ligMax = new Int32Array(H).fill(-1)
  let hg = { x: 0, y: 0, v: Infinity }, bd = { x: 0, y: 0, v: -Infinity }, hd = { x: 0, y: 0, v: -Infinity }, bg = { x: 0, y: 0, v: Infinity }
  let bordsTouches = [0, 0, 0, 0]
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < L; x++) {
      if (etiquette[y * L + x] !== meilleure) continue
      if (colMin[x] < 0) colMin[x] = y
      colMax[x] = y
      if (ligMin[y] < 0) ligMin[y] = x
      ligMax[y] = x
      const s = x + y, d = x - y
      if (s < hg.v) hg = { x, y, v: s }
      if (s > bd.v) bd = { x, y, v: s }
      if (d > hd.v) hd = { x, y, v: d }
      if (d < bg.v) bg = { x, y, v: d }
      if (y === 0) bordsTouches[0]++
      if (y === H - 1) bordsTouches[2]++
      if (x === 0) bordsTouches[3]++
      if (x === L - 1) bordsTouches[1]++
    }
  }
  // Une feuille qui longe le cadre sur plusieurs côtés en sort : ses coins ne sont pas sur la photo.
  bordsTouches = bordsTouches.map((c, i) => c / (i % 2 ? H : L))
  if (bordsTouches.filter((c) => c > 0.15).length >= 2) return null

  // Coins grossiers, au bord extérieur des pixels.
  const brut: Quad = [{ x: hg.x, y: hg.y }, { x: hd.x + 1, y: hd.y }, { x: bd.x + 1, y: bd.y + 1 }, { x: bg.x, y: bg.y + 1 }]
  if (!estConvexe(brut)) return null
  const diagonale = Math.hypot(L, H)
  const bande = 0.03 * diagonale

  // Chaque bord, suivi sur sa partie centrale, loin des coins arrondis ou cornés.
  const centre = (a: number, b: number) => [Math.ceil(Math.min(a, b) + 0.12 * Math.abs(b - a)), Math.floor(Math.max(a, b) - 0.12 * Math.abs(b - a))]
  const suivre = (de: number, a: number, f: (i: number) => Point | null, a1: Point, a2: Point) => {
    const pts: Point[] = []
    const [i0, i1] = centre(de, a)
    for (let i = i0; i <= i1; i++) {
      const q = f(i)
      if (q && distanceALaDroite(q, a1, a2) <= bande) pts.push(q)
    }
    return droite(pts)
  }
  const haut = suivre(brut[0].x, brut[1].x, (x) => (x >= 0 && x < L && colMin[x] >= 0 ? { x: x + 0.5, y: colMin[x] } : null), brut[0], brut[1])
  const droit = suivre(brut[1].y, brut[2].y, (y) => (y >= 0 && y < H && ligMax[y] >= 0 ? { x: ligMax[y] + 1, y: y + 0.5 } : null), brut[1], brut[2])
  const bas = suivre(brut[3].x, brut[2].x, (x) => (x >= 0 && x < L && colMax[x] >= 0 ? { x: x + 0.5, y: colMax[x] + 1 } : null), brut[3], brut[2])
  const gauche = suivre(brut[0].y, brut[3].y, (y) => (y >= 0 && y < H && ligMin[y] >= 0 ? { x: ligMin[y], y: y + 0.5 } : null), brut[0], brut[3])
  let coins: Quad = brut
  if (haut && droit && bas && gauche) {
    const fins = [intersection(gauche, haut), intersection(haut, droit), intersection(droit, bas), intersection(bas, gauche)]
    // Les droites affinent les coins ; un coin qui partirait loin trahit un bord mal suivi.
    if (fins.every((p, i) => p && dist(p, brut[i]) <= 0.05 * diagonale)) coins = fins as Quad
  }
  const cote = Math.min(dist(coins[0], coins[1]), dist(coins[1], coins[2]), dist(coins[2], coins[3]), dist(coins[3], coins[0]))
  if (!estConvexe(coins) || cote < 0.15 * Math.min(L, H)) return null
  return coins
}

// ---------------------------------------------------------------- redressement

export interface ImageRgba {
  largeur: number
  hauteur: number
  data: Uint8ClampedArray
}

/**
 * La feuille redressée : chaque pixel du rectangle de sortie va chercher sa
 * couleur sur la photo, par l'homographie, avec une interpolation bilinéaire.
 */
export function redresser(source: ImageRgba, coins: Quad, largeur: number, hauteur: number): Uint8ClampedArray<ArrayBuffer> {
  const m = homographie(rectangle(largeur, hauteur), coins)
  if (!m) throw new Error('Coins dégénérés : impossible de redresser la feuille.')
  const sortie = new Uint8ClampedArray(largeur * hauteur * 4)
  const { data, largeur: L, hauteur: H } = source
  const [a, b, c, d, e, f, g, h, i] = m
  let o = 0
  for (let y = 0; y < hauteur; y++) {
    const yc = y + 0.5
    for (let x = 0; x < largeur; x++, o += 4) {
      const xc = x + 0.5
      const w = g * xc + h * yc + i
      const u = (a * xc + b * yc + c) / w - 0.5
      const v = (d * xc + e * yc + f) / w - 0.5
      // Hors de la photo : du blanc, comme le papier.
      if (u < -0.5 || v < -0.5 || u > L - 0.5 || v > H - 0.5) {
        sortie[o] = sortie[o + 1] = sortie[o + 2] = 255
        sortie[o + 3] = 255
        continue
      }
      const x0 = Math.max(0, Math.min(L - 1, Math.floor(u))), y0 = Math.max(0, Math.min(H - 1, Math.floor(v)))
      const x1 = Math.min(L - 1, x0 + 1), y1 = Math.min(H - 1, y0 + 1)
      const fx = Math.max(0, Math.min(1, u - x0)), fy = Math.max(0, Math.min(1, v - y0))
      const p00 = (y0 * L + x0) * 4, p10 = (y0 * L + x1) * 4, p01 = (y1 * L + x0) * 4, p11 = (y1 * L + x1) * 4
      for (let k = 0; k < 3; k++) {
        const haut = data[p00 + k] + (data[p10 + k] - data[p00 + k]) * fx
        const bas = data[p01 + k] + (data[p11 + k] - data[p01 + k]) * fx
        sortie[o + k] = haut + (bas - haut) * fy
      }
      sortie[o + 3] = 255
    }
  }
  return sortie
}

// ---------------------------------------------------------------- amélioration

export type ModeScan = 'noir_blanc' | 'couleur'

/**
 * Un plan photographié rendu lisible, en place dans les pixels RGBA.
 *
 * 1. Le blanc du papier, case par case (le 90e centile de la luminance de
 *    chaque case : le papier domine, les traits sont rares), lissé : c'est
 *    l'éclairage de la photo, ombres et vignetage compris. Il ne descend pas
 *    sous 60 % du blanc d'ensemble : un grand aplat sombre reste sombre.
 * 2. Chaque pixel divisé par ce blanc : le papier vaut 1 partout.
 * 3. Une courbe de niveaux : point noir au bas de l'histogramme, point blanc
 *    à 90 % du papier, et un gamma qui fonce les gris moyens. Pas de seuil :
 *    un trait fin reste gris, il ne se perd ni ne s'épaissit.
 *
 * En couleur, la même correction s'applique à chaque canal, après une
 * balance des blancs prise sur le papier.
 */
export function ameliorer(rgba: Uint8ClampedArray, largeur: number, hauteur: number, mode: ModeScan): void {
  const n = largeur * hauteur
  // La luminance sur un octet : quatre fois moins de mémoire qu'en flottants, pour une photo de 14 millions de pixels.
  const lum = new Uint8Array(n)
  for (let i = 0, j = 0; j < n; i += 4, j++) lum[j] = (rgba[i] * 77 + rgba[i + 1] * 150 + rgba[i + 2] * 29 + 128) >> 8

  // 1. Le blanc du papier, par cases.
  const pas = Math.max(8, Math.round(Math.min(largeur, hauteur) / 40))
  const cl = Math.ceil(largeur / pas), ch = Math.ceil(hauteur / pas)
  const fond = new Float32Array(cl * ch)
  const histo = new Uint32Array(256)
  for (let cy = 0; cy < ch; cy++) {
    for (let cx = 0; cx < cl; cx++) {
      histo.fill(0)
      let total = 0
      const x1 = Math.min(largeur, (cx + 1) * pas), y1 = Math.min(hauteur, (cy + 1) * pas)
      // Une case sur deux lignes suffit à son centile, et coûte deux fois moins.
      for (let y = cy * pas; y < y1; y += 2) {
        for (let x = cx * pas; x < x1; x++) { histo[lum[y * largeur + x]]++; total++ }
      }
      let cumul = 0, v = 255
      for (let k = 0; k < 256; k++) {
        cumul += histo[k]
        if (cumul >= 0.9 * total) { v = k; break }
      }
      fond[cy * cl + cx] = v
    }
  }
  const tries = Float32Array.from(fond).sort()
  const blancGlobal = Math.max(1, tries[Math.floor(tries.length * 0.75)])
  for (let k = 0; k < fond.length; k++) fond[k] = Math.max(fond[k], 0.6 * blancGlobal, 1)
  lisser(fond, cl, ch)
  lisser(fond, cl, ch)

  // La balance des blancs : la couleur moyenne du papier.
  let pr = 0, pv = 0, pb = 0, np = 0
  for (let i = 0, j = 0; j < n; i += 4 * 7, j += 7) {
    if (lum[j] < 0.8 * blancGlobal) continue
    pr += rgba[i]; pv += rgba[i + 1]; pb += rgba[i + 2]; np++
  }
  const gains = np ? [pr / np, pv / np, pb / np].map((c) => (c > 0 ? (pr + pv + pb) / np / 3 / c : 1)) : [1, 1, 1]

  // 2. Divisé par le blanc, interpolé entre les centres des cases.
  const blanc = (x: number, y: number) => {
    const gx = Math.max(0, Math.min(cl - 1, (x + 0.5) / pas - 0.5)), gy = Math.max(0, Math.min(ch - 1, (y + 0.5) / pas - 0.5))
    const x0 = Math.floor(gx), y0 = Math.floor(gy), x1 = Math.min(cl - 1, x0 + 1), y1 = Math.min(ch - 1, y0 + 1)
    const fx = gx - x0, fy = gy - y0
    const h = fond[y0 * cl + x0] + (fond[y0 * cl + x1] - fond[y0 * cl + x0]) * fx
    const b = fond[y1 * cl + x0] + (fond[y1 * cl + x1] - fond[y1 * cl + x0]) * fx
    return h + (b - h) * fy
  }
  // Le point noir : le 0,5e centile, sur un échantillon.
  const echant: number[] = []
  for (let j = 0; j < n; j += Math.max(1, Math.floor(n / 20000))) {
    const x = j % largeur, y = (j - x) / largeur
    echant.push(lum[j] / blanc(x, y))
  }
  echant.sort((p, q) => p - q)
  const noir = Math.min(0.45, echant[Math.floor(echant.length * 0.005)] ?? 0)
  const BLANC = 0.9
  const gamma = mode === 'noir_blanc' ? 1.4 : 1.15
  const courbe = (v: number) => {
    const t = (v - noir) / (BLANC - noir)
    return t <= 0 ? 0 : t >= 1 ? 255 : 255 * t ** gamma
  }
  for (let y = 0, i = 0, j = 0; y < hauteur; y++) {
    for (let x = 0; x < largeur; x++, i += 4, j++) {
      const w = blanc(x, y)
      if (mode === 'noir_blanc') {
        const g = courbe(lum[j] / w)
        rgba[i] = rgba[i + 1] = rgba[i + 2] = g
      } else {
        rgba[i] = courbe((rgba[i] * gains[0]) / w)
        rgba[i + 1] = courbe((rgba[i + 1] * gains[1]) / w)
        rgba[i + 2] = courbe((rgba[i + 2] * gains[2]) / w)
      }
    }
  }
}

/** Un flou 3 × 3 sur la grille des cases : le blanc varie doucement, sans marches. */
function lisser(v: Float32Array, l: number, h: number) {
  const copie = Float32Array.from(v)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < l; x++) {
      let s = 0, n = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy
          if (xx < 0 || yy < 0 || xx >= l || yy >= h) continue
          s += copie[yy * l + xx]; n++
        }
      }
      v[y * l + x] = s / n
    }
  }
}
