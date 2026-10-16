/**
 * L'échelle d'une page, calculée plutôt que tracée.
 *
 * Étalonner à la main, c'est tracer un trait sur une cote et saisir sa
 * longueur : à cinq pixels près sur un trait de trois cents, la page entière
 * est fausse de près de 2 %, et chaque surface de 4 %. Un PDF vectoriel en sait
 * pourtant davantage : sa page a une taille en points (1 pt = 1/72 de pouce),
 * donc chaque pixel du canevas correspond à une longueur connue sur la
 * feuille. Avec l'échelle imprimée au cartouche, « 1:100 », un pixel vaut une
 * longueur réelle connue exactement :
 *
 *   mètres par pixel = (largeur de la page en pt / largeur du canevas en px)
 *                      × (0,0254 / 72) × dénominateur
 *
 * Reste qu'une échelle imprimée peut mentir : un PDF « ajusté à la page » à
 * l'impression, un plan A1 exporté en A3, un cartouche recopié d'un autre
 * dessin. On la croise donc avec une cote lue sur le dessin ; au-delà de 2 %
 * d'écart, rien n'est appliqué d'office et l'écart est montré.
 *
 * Pour une image (photo, scan), la taille physique est inconnue : seule une
 * cote permet d'étalonner, et l'échelle obtenue reste approximative.
 *
 * Module pur, sans canevas ni pdf.js, pour être vérifiable par les tests.
 */
import type { PlanPoint } from '../api-types'

/** Un pouce, en mètres : la définition même du point typographique (1/72 de pouce). */
export const POUCE_M = 0.0254

/** Écart toléré entre l'échelle imprimée et la cote de contrôle. */
export const ECART_TOLERE = 0.02

/**
 * Mètres réels par pixel du canevas, d'après l'échelle imprimée.
 *
 * `largeurPagePt` est la largeur de la feuille telle qu'elle est rendue (la
 * page tournée a déjà échangé ses côtés), `largeurCanevasPx` celle du canevas
 * de l'éditeur pour cette même page.
 */
export function metresParPixel(largeurPagePt: number, largeurCanevasPx: number, denominateur: number): number {
  return (largeurPagePt / largeurCanevasPx) * (POUCE_M / 72) * denominateur
}

/** La même échelle, dans l'unité qu'enregistre le plan : des pixels par mètre. */
export function pxParMetreImprime(largeurPagePt: number, largeurCanevasPx: number, denominateur: number): number {
  return 1 / metresParPixel(largeurPagePt, largeurCanevasPx, denominateur)
}

/** Le dénominateur d'une échelle écrite « 1:100 », « 1/50 » ou « 1 : 200 ». */
export function denominateurDe(echelle: string | null | undefined): number | null {
  if (!echelle) return null
  const m = echelle.match(/1\s*[:/]\s*(\d[\d'’]*)/)
  if (!m) return null
  const d = Number(m[1].replace(/['’]/g, ''))
  return Number.isFinite(d) && d >= 1 && d <= 100_000 ? d : null
}

/** Pixels par mètre d'après une cote : la longueur du trait sur le canevas, divisée par sa valeur. */
export function pxParMetreDeCote(p1: PlanPoint, p2: PlanPoint, longueurM: number): number | null {
  const px = Math.hypot(p2.x - p1.x, p2.y - p1.y)
  if (!(longueurM > 0) || !(px > 0)) return null
  return px / longueurM
}

/** Écart relatif de `mesure` par rapport à `reference`. */
export function ecartRelatif(mesure: number, reference: number): number {
  return Math.abs(mesure - reference) / reference
}

/** Un nombre à la française : 12,4 et non 12.4. */
export function fr(v: number, decimales = 2): string {
  return v.toFixed(decimales).replace('.', ',')
}

/** Ce que l'analyse a lu sur la page, et ce qu'il faut pour calculer. */
export interface DonneesEchelle {
  /** Largeur de la feuille en points PDF ; null pour une image. */
  largeurPagePt: number | null
  /** Largeur du canevas de l'éditeur pour cette page, en pixels. */
  largeurCanevasPx: number
  /** Échelle imprimée lue, « 1:100 », ou null. */
  echelleImprimee: string | null
  /** Où elle a été lue (« cartouche »), pour le dire à l'utilisateur. */
  ouEchelle?: string | null
  /** Cote de contrôle, ses extrémités déjà ramenées dans le repère du canevas. */
  cote: { texte: string; longueurM: number; p1: PlanPoint; p2: PlanPoint; aimantee?: boolean } | null
}

/**
 * Le verdict sur l'échelle d'une page.
 *
 * - `verifiee` : échelle imprimée, confirmée par la cote à moins de 2 % ;
 * - `non-verifiee` : échelle imprimée, aucune cote lisible pour la confirmer ;
 * - `conflit` : échelle imprimée et cote en désaccord, rien n'est retenu
 *   d'office ;
 * - `approximative` : seule la cote donne l'échelle (image, ou PDF sans
 *   échelle écrite) ;
 * - `aucune` : rien ne permet d'étalonner.
 */
export type StatutEchelle = 'verifiee' | 'non-verifiee' | 'conflit' | 'approximative' | 'aucune'

export interface PropositionEchelle {
  statut: StatutEchelle
  /** L'échelle retenue d'office, en px/m ; null en cas de conflit ou faute de données. */
  pxParM: number | null
  /** Vrai quand l'échelle retenue vient de la taille de la page : elle est alors exacte. */
  exacte: boolean
  imprimee: { denominateur: number; pxParM: number; ou: string | null } | null
  cote: { texte: string; longueurM: number; pxParM: number; p1: PlanPoint; p2: PlanPoint; aimantee: boolean } | null
  /** Écart entre l'échelle imprimée et la cote, en fraction (0,003 = 0,3 %). */
  ecart: number | null
  /** La phrase qui dit d'où vient l'échelle : « 1:100 au cartouche, vérifiée sur la cote 12,40 m ». */
  resume: string
}

/**
 * Propose l'échelle d'une page à partir de ce que l'analyse a lu.
 *
 * La fonction ne pose rien : elle dit ce qu'elle retiendrait et pourquoi.
 * C'est l'utilisateur qui confirme, et c'est l'éditeur qui applique.
 */
export function proposerEchelle(d: DonneesEchelle): PropositionEchelle {
  const denominateur = denominateurDe(d.echelleImprimee)
  const ou = d.ouEchelle?.trim() || null
  const estPdf = d.largeurPagePt != null && d.largeurPagePt > 0

  const imprimee = estPdf && denominateur
    ? { denominateur, pxParM: pxParMetreImprime(d.largeurPagePt!, d.largeurCanevasPx, denominateur), ou }
    : null
  const pxCote = d.cote ? pxParMetreDeCote(d.cote.p1, d.cote.p2, d.cote.longueurM) : null
  const cote = d.cote && pxCote
    ? { texte: d.cote.texte, longueurM: d.cote.longueurM, pxParM: pxCote, p1: d.cote.p1, p2: d.cote.p2, aimantee: d.cote.aimantee ?? false }
    : null

  const lue = denominateur ? `1:${denominateur}${ou ? ` ${ouLisible(ou)}` : ''}` : null
  const surLaCote = cote ? `la cote ${fr(cote.longueurM)} m` : null

  if (imprimee && cote) {
    const ecart = ecartRelatif(cote.pxParM, imprimee.pxParM)
    if (ecart <= ECART_TOLERE) {
      return {
        statut: 'verifiee', pxParM: imprimee.pxParM, exacte: true, imprimee, cote, ecart,
        resume: `${lue}, vérifiée sur ${surLaCote} (écart ${fr(ecart * 100, 1)} %)`,
      }
    }
    return {
      statut: 'conflit', pxParM: null, exacte: false, imprimee, cote, ecart,
      resume: `${lue} et ${surLaCote} ne concordent pas (écart ${fr(ecart * 100, 1)} %) : le PDF a peut-être été réduit à l'impression`,
    }
  }
  if (imprimee) {
    return {
      statut: 'non-verifiee', pxParM: imprimee.pxParM, exacte: true, imprimee, cote: null, ecart: null,
      resume: `${lue}, sans cote lisible pour la vérifier`,
    }
  }
  if (cote) {
    const pourquoi = estPdf
      ? 'aucune échelle imprimée'
      : lue ? `${lue} lue, inutilisable sur une image dont la taille réelle est inconnue` : 'image sans taille réelle connue'
    return {
      statut: 'approximative', pxParM: cote.pxParM, exacte: false, imprimee: null, cote, ecart: null,
      resume: `Approximative, d'après ${surLaCote} (${pourquoi})`,
    }
  }
  return {
    statut: 'aucune', pxParM: null, exacte: false, imprimee: null, cote: null, ecart: null,
    resume: lue && !estPdf
      ? `${lue} lue, mais aucune cote lisible : étalonnez à la main`
      : 'Ni échelle imprimée ni cote lisible : étalonnez à la main',
  }
}

/** « cartouche » devient « au cartouche », « sous le titre » reste tel quel. */
function ouLisible(ou: string): string {
  const t = ou.toLowerCase()
  if (/^(au|à|a|dans|sous|sur|en|près|pres)\b/.test(t)) return t
  if (t.startsWith('cartouche')) return `au ${t}`
  return `(${t})`
}
