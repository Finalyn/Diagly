/**
 * La maquette 3D d'un jeu de plans, pour l'outil Métrés.
 *
 * Rien n'y est deviné par l'IA : la maquette se monte des seules formes
 * validées des plans d'étage, par géométrie. Une feuille donne un ou
 * plusieurs niveaux (un étage type vaut pour chaque étage qu'il représente),
 * à la hauteur réglée sur la feuille, sinon à celle de la fiche du dossier.
 *
 * Les murs sont ce que le plan noircit : l'emprise du bâtiment moins ses
 * pièces, cloisons comprises, plus les murs tracés à la main. Sans emprise,
 * elle se déduit des pièces, élargies d'un demi-mur. Les repères des portes
 * et des fenêtres percent les murs à leur place : une porte du sol au
 * linteau, une fenêtre de l'allège au linteau. Les murs se montent donc en
 * trois bandes : sous l'allège, entre l'allège et le linteau, au-dessus.
 *
 * Chaque feuille est centrée sur son emprise : les niveaux se superposent
 * sans que les plans aient été dessinés au même endroit de leur page.
 *
 * Coordonnées en mètres, celles du plan : x vers la droite, y vers le bas de
 * la feuille. Module pur, sans three.js : la vue (components/metres/Maquette3D.tsx)
 * ne fait que dessiner ce qu'il rend.
 */
import polygonClipping, { type Geom, type MultiPolygon, type Polygon } from 'polygon-clipping'
import type { PlanAnnotation, PlanPoint } from '../api-types'
import type { CategorieComptee } from '../base-cfc/comptages'
import { aireDeLaForme, echelleDePage, natureDuTrace } from '../plan-quantites'
import { nomDuRepere } from './analyse-ia'
import { COMBLES, lireEtages, nomDuNiveau } from './etages'
import { enAttente, estPdf, feuilleDe, multiplicateur } from './feuilles'
import { rangDuNiveau } from './presentation'
import { classificationDe, HAUTEUR_PAR_DEFAUT, nomDEtage, type PlanPourQuantites } from './quantites'
import { affectationParDefaut, type CategorieSia416 } from './sia416'

/** Épaisseur de la dalle, posée au pied de chaque niveau ; les murs partent de son dessus. */
export const DALLE = 0.2
/** Hauteur de l'allège et du linteau, depuis le sol fini. */
export const ALLEGE = 0.9
export const LINTEAU = 2.1
/** Épaisseur prêtée à un mur tracé en longueur, et demi-mur qui élargit les pièces quand il manque l'emprise. */
const MUR_TRACE = 0.2
const DEMI_MUR = 0.15
/** Jusqu'où une ouverture perce, de part et d'autre de son repère : assez pour traverser un mur de façade. */
const PERCEMENT = 0.9

/** La largeur prêtée à chaque ouverture repérée. */
const LARGEURS: Partial<Record<CategorieComptee, number>> = {
  porte_entree: 1.2, porte_paliere: 0.9, porte_interieure: 0.8, fenetre: 1.2,
}
const PORTES: CategorieComptee[] = ['porte_entree', 'porte_paliere', 'porte_interieure']

export type Pt = [number, number]

export interface Piece3D {
  id: string
  nom: string
  contour: Pt[]
  trous: Pt[][]
  /** Surface au sol, en m², trous retirés. */
  surface: number
  sia: CategorieSia416 | null
  /** L'ouvrage du diagnostic que la pièce mesure, s'il y en a un. */
  itemId: string | null
}

export interface Ouverture3D {
  id: string
  nom: string
  categorie: CategorieComptee
  centre: Pt
  /** La direction du mur qu'elle perce, en radians, dans le repère du plan. */
  angle: number
  largeur: number
  porte: boolean
}

/** Une tranche de murs, entre deux hauteurs comptées depuis le sol fini du niveau. */
export interface Bande3D {
  bas: number
  haut: number
  forme: MultiPolygon
}

/** Ce qu'une feuille donne à monter : la même pour chaque étage qu'elle représente. */
export interface Feuille3D {
  /** `planId#page` */
  cle: string
  nom: string
  hauteur: number
  dalle: MultiPolygon
  murs: Bande3D[]
  pieces: Piece3D[]
  ouvertures: Ouverture3D[]
}

export interface Niveau3D {
  rang: number
  nom: string
  /** Le pied de la dalle du niveau, en mètres, le rez à 0. */
  z: number
  feuille: Feuille3D
}

export interface Maquette3D {
  niveaux: Niveau3D[]
  /** Les feuilles d'étage qu'on n'a pas pu monter, et pourquoi. */
  ecartees: { nom: string; raison: string }[]
  /** L'encombrement de la maquette : x et y du plan, z en hauteur. */
  boite: { x0: number; y0: number; x1: number; y1: number; z0: number; z1: number }
}

export interface OptionsMaquette {
  /** Hauteur d'étage de la fiche du dossier ; HAUTEUR_PAR_DEFAUT sans elle. */
  hauteurDuDossier?: number | null
}

/** Un rectangle tourné : `largeur` le long de `angle`, `profondeur` en travers. */
function rectangle(c: Pt, angle: number, largeur: number, profondeur: number): Polygon {
  const ux = Math.cos(angle), uy = Math.sin(angle)
  const nx = -uy, ny = ux
  const l = largeur / 2, p = profondeur / 2
  return [[
    [c[0] - ux * l - nx * p, c[1] - uy * l - ny * p],
    [c[0] + ux * l - nx * p, c[1] + uy * l - ny * p],
    [c[0] + ux * l + nx * p, c[1] + uy * l + ny * p],
    [c[0] - ux * l + nx * p, c[1] - uy * l + ny * p],
  ]]
}

/** Un segment épaissi, prolongé d'une demi-épaisseur à chaque bout pour que deux segments se rejoignent. */
function segmentEpais(a: Pt, b: Pt, epaisseur: number): Polygon | null {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1])
  if (l < 1e-6) return null
  return rectangle([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], Math.atan2(b[1] - a[1], b[0] - a[0]), l + epaisseur, epaisseur)
}

/** Le polygone élargi de `d` de chaque côté de ses bords, angles carrés. */
function elargir(contour: Pt[], d: number): Geom {
  const bords = contour.map((p, i) => segmentEpais(p, contour[(i + 1) % contour.length], 2 * d)).filter((x): x is Polygon => !!x)
  return polygonClipping.union([contour], ...bords)
}

function aire(anneau: Pt[]): number {
  let s = 0
  for (let i = 0; i < anneau.length; i++) {
    const p = anneau[i], q = anneau[(i + 1) % anneau.length]
    s += p[0] * q[1] - q[0] * p[1]
  }
  return Math.abs(s) / 2
}

function distanceAuSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const l2 = dx * dx + dy * dy
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2))
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))
}

/** La direction du bord le plus proche d'un point : celle du mur qu'une ouverture perce. */
function directionLaPlusProche(p: Pt, anneaux: Pt[][]): number {
  let meilleure = Infinity
  let angle = 0
  for (const r of anneaux) {
    for (let i = 0; i < r.length; i++) {
      const a = r[i], b = r[(i + 1) % r.length]
      const d = distanceAuSegment(p, a, b)
      if (d < meilleure) { meilleure = d; angle = Math.atan2(b[1] - a[1], b[0] - a[0]) }
    }
  }
  return angle
}

const deplacer = (m: MultiPolygon, dx: number, dy: number): MultiPolygon =>
  m.map((poly) => poly.map((anneau) => anneau.map(([x, y]) => [x + dx, y + dy] as Pt)))

/** Une feuille d'étage lue, avant d'être rangée parmi les niveaux. */
interface FeuilleLue {
  feuille: Feuille3D
  rangs: number[] | null
  multiplicateur: number
}

/**
 * Ce qu'une feuille d'étage donne à monter, ou la raison pour laquelle elle
 * ne donne rien. null : la feuille n'est pas un plan d'étage, ou ne porte ni
 * pièce ni emprise validée.
 */
function lireFeuille(
  { plan, feuilles }: PlanPourQuantites,
  page: number,
  annotations: PlanAnnotation[],
  hauteurDefaut: number,
): FeuilleLue | { raison: string; nom: string } | null {
  const x = feuilleDe(feuilles, page)
  if (x.type && x.type !== 'plan_etage') return null
  const nom = nomDEtage(feuilles, page, plan.name, estPdf(plan))
  const validees = annotations.filter((a) => !enAttente(a))
  const pieces = validees.filter((a) => classificationDe(a) === 'pieces' && natureDuTrace(a) === 'surface')
  const emprises = validees.filter((a) => a.typeZone === 'emprise' && natureDuTrace(a) === 'surface')
  if (!pieces.length && !emprises.length) return null
  const echelle = echelleDePage(plan, page)
  if (!echelle) return { nom, raison: 'sans échelle' }

  const m = (p: PlanPoint): Pt => [p.x / echelle, p.y / echelle]
  const anneau = (pts: PlanPoint[]) => pts.map(m)

  try {
    const polysPieces: Polygon[] = pieces.map((a) => [anneau(a.points), ...(a.trous ?? []).map(anneau)])
    const lesPieces = polysPieces.length ? polygonClipping.union(polysPieces[0], ...polysPieces.slice(1)) : []

    // Les murs tracés à la main : un trait en longueur prend l'épaisseur d'un mur, une surface reste ce qu'elle est.
    const traces: Polygon[] = []
    for (const a of validees.filter((v) => classificationDe(v) === 'murs')) {
      const pts = anneau(a.points)
      if (natureDuTrace(a) === 'surface') traces.push([pts])
      else for (let i = 0; i + 1 < pts.length; i++) {
        const s = segmentEpais(pts[i], pts[i + 1], MUR_TRACE)
        if (s) traces.push(s)
      }
    }

    // L'emprise : celle du plan, sinon les pièces élargies d'un demi-mur ; les murs tracés en font partie.
    const bases: Geom[] = emprises.length
      ? emprises.map((a) => [anneau(a.points)] as Polygon)
      : polysPieces.map((p) => elargir(p[0], DEMI_MUR))
    const emprise = polygonClipping.union(bases[0], ...bases.slice(1), ...traces)
    const murs = traces.length
      ? polygonClipping.union(polygonClipping.difference(emprise, lesPieces), ...traces)
      : polygonClipping.difference(emprise, lesPieces)

    // Les ouvertures, dans la direction du bord le plus proche, et ce qu'elles retirent aux murs.
    const bords: Pt[][] = [...emprise.flat(), ...lesPieces.flat()]
    const ouvertures: Ouverture3D[] = []
    for (const a of validees) {
      const categorie = a.type === 'repere' ? a.repere?.categorie : undefined
      const largeur = categorie ? LARGEURS[categorie] : undefined
      if (!categorie || !largeur || !a.points[0]) continue
      const centre = m(a.points[0])
      ouvertures.push({
        id: a.id, nom: nomDuRepere(a), categorie, centre, angle: directionLaPlusProche(centre, bords), largeur,
        porte: PORTES.includes(categorie),
      })
    }
    const percements = (portes: boolean) => ouvertures
      .filter((o) => o.porte === portes)
      .map((o) => rectangle(o.centre, o.angle, o.largeur, PERCEMENT * 2))
    const portes = percements(true)
    const fenetres = percements(false)
    const sousAllege = portes.length ? polygonClipping.difference(murs, ...portes) : murs
    const entreDeux = fenetres.length ? polygonClipping.difference(sousAllege, ...fenetres) : sousAllege

    const hauteur = x.hauteurEtage != null && x.hauteurEtage > 0 ? x.hauteurEtage : hauteurDefaut
    const sol = Math.max(LINTEAU + 0.1, hauteur - DALLE)
    const bandes: Bande3D[] = [
      { bas: 0, haut: ALLEGE, forme: sousAllege },
      { bas: ALLEGE, haut: LINTEAU, forme: entreDeux },
      { bas: LINTEAU, haut: sol, forme: murs },
    ]

    // Centrée sur son emprise, pour que les feuilles se superposent.
    const tous = emprise.flat(2)
    const xs = tous.map((p) => p[0]), ys = tous.map((p) => p[1])
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2
    const ici = (p: Pt): Pt => [p[0] - cx, p[1] - cy]

    const feuille: Feuille3D = {
      cle: `${plan.id}#${page}`,
      nom,
      hauteur,
      dalle: deplacer(emprise, -cx, -cy),
      murs: bandes.map((b) => ({ ...b, forme: deplacer(b.forme, -cx, -cy) })),
      pieces: pieces.map((a, i) => {
        const [contour, ...trous] = polysPieces[i]
        const nomPiece = (a.proposition?.libelle ?? a.text ?? '').trim() || `Pièce ${i + 1}`
        return {
          id: a.id,
          nom: nomPiece,
          contour: contour.map(ici),
          trous: trous.map((t) => t.map(ici)),
          surface: aireDeLaForme(a) / (echelle * echelle),
          sia: a.sia416 ?? affectationParDefaut(nomPiece),
          itemId: a.itemId ?? null,
        }
      }),
      ouvertures: ouvertures.map((o) => ({ ...o, centre: ici(o.centre) })),
    }
    const rangs = lireEtages(x.niveau) ?? (() => {
      const r = rangDuNiveau(nom)
      return r != null && r !== 60 ? [r] : null
    })()
    return { feuille, rangs, multiplicateur: multiplicateur(x) }
  } catch {
    // Une forme qui se recoupe elle-même : la feuille reste à plat plutôt que de casser la maquette.
    return { nom, raison: 'formes illisibles' }
  }
}

/** La maquette du jeu de plans : chaque feuille d'étage montée à son niveau. */
export function maquetteDuJeu(jeu: PlanPourQuantites[], options: OptionsMaquette = {}): Maquette3D {
  const hauteurDefaut = options.hauteurDuDossier && options.hauteurDuDossier > 0 ? options.hauteurDuDossier : HAUTEUR_PAR_DEFAUT
  const lues: FeuilleLue[] = []
  const ecartees: Maquette3D['ecartees'] = []

  for (const x of jeu) {
    const pdf = estPdf(x.plan)
    const parPage = new Map<number, PlanAnnotation[]>()
    for (const a of x.plan.annotations ?? []) {
      const page = pdf ? a.page ?? 1 : 1
      parPage.set(page, [...(parPage.get(page) ?? []), a])
    }
    for (const page of [...parPage.keys()].sort((p, q) => p - q)) {
      const r = lireFeuille(x, page, parPage.get(page)!, hauteurDefaut)
      if (!r) continue
      if ('raison' in r) ecartees.push(r)
      else lues.push(r)
    }
  }

  // Chaque étage reçoit sa feuille : celles qui disent leurs étages d'abord,
  // les autres ensuite, au-dessus, autant d'étages que leur multiplicateur.
  const parRang = new Map<number, Feuille3D>()
  for (const l of lues.filter((y) => y.rangs)) {
    for (const r of l.rangs!) {
      if (!parRang.has(r)) parRang.set(r, l.feuille)
    }
  }
  let suivant = Math.max(-1, ...[...parRang.keys()].filter((r) => r < COMBLES)) + 1
  for (const l of lues.filter((y) => !y.rangs)) {
    for (let k = 0; k < l.multiplicateur; k++) {
      while (parRang.has(suivant)) suivant++
      parRang.set(suivant, l.feuille)
    }
  }

  // Les niveaux s'empilent dans l'ordre de leurs rangs : le rez à 0, les sous-sols dessous.
  const rangs = [...parRang.keys()].sort((p, q) => p - q)
  const niveaux: Niveau3D[] = []
  let haut = 0
  for (const r of rangs.filter((v) => v >= 0)) {
    const feuille = parRang.get(r)!
    niveaux.push({ rang: r, nom: Number.isInteger(r) ? nomDuNiveau(r) : feuille.nom, z: haut, feuille })
    haut += feuille.hauteur
  }
  let bas = 0
  for (const r of rangs.filter((v) => v < 0).reverse()) {
    const feuille = parRang.get(r)!
    bas -= feuille.hauteur
    niveaux.unshift({ rang: r, nom: Number.isInteger(r) ? nomDuNiveau(r) : feuille.nom, z: bas, feuille })
  }

  const points = niveaux.flatMap((n) => n.feuille.dalle.flat(2))
  const xs = points.map((p) => p[0]), ys = points.map((p) => p[1])
  const boite = points.length
    ? { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys), z0: bas, z1: haut }
    : { x0: 0, y0: 0, x1: 0, y1: 0, z0: 0, z1: 0 }
  return { niveaux, ecartees, boite }
}

/** La surface d'une forme de la maquette, en m² : pour les tests et les infobulles. */
export function surfaceDe(m: MultiPolygon): number {
  return m.reduce((s, poly) => s + aire(poly[0] as Pt[]) - poly.slice(1).reduce((t, r) => t + aire(r as Pt[]), 0), 0)
}
