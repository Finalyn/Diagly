/**
 * De la réponse de l'analyse aux zones posées sur le plan.
 *
 * Le modèle lit une image de la page et rend des points en pixels de cette
 * image. L'éditeur, lui, dessine dans le repère de son canevas de 1600 px de
 * large. Entre les deux : une mise à l'échelle, puis l'aimantation sur la
 * géométrie vectorielle de la page quand c'est un PDF, et la proposition
 * d'échelle, qui croise l'échelle imprimée avec une cote lue.
 *
 * Tout ce qui sort d'ici est une proposition : une zone porte le champ
 * `proposition` et ne compte dans aucun métré tant que l'utilisateur ne l'a
 * pas validée ; une échelle n'est posée qu'une fois confirmée.
 *
 * Module pur, sans canevas ni réseau : les pages arrivent déjà rendues et
 * indexées.
 */
import type {
  AnalysePlan, ConfianceZone, PlanAnnotation, PlanPoint, PointImage, PropositionIA, TypePageAnalysee, TypeZoneIA,
} from '../api-types'
import { CATEGORIE, type CategorieComptee } from '../base-cfc/comptages'
import { aimanter, type IndexGeometrie } from './geometrie-vectorielle'
import { proposerEchelle, type PropositionEchelle } from './echelle-exacte'
import { airePolygone, longueurPolyligne } from '../plan-quantites'

// ---------------------------------------------------------------- image envoyée

/** Grand côté au-delà duquel le modèle réduit l'image avant de la lire. */
export const GRAND_COTE_MAX = 2576
/**
 * Nombre de tuiles de 28 × 28 px qu'une image peut occuper sans être réduite
 * (3,75 mégapixels). Une feuille A3 de 2576 px de large en dépasse : il faut
 * tenir les deux limites, sinon le modèle lirait une image réduite et ses
 * coordonnées ne correspondraient plus à celle qu'on lui a envoyée.
 */
export const TUILES_MAX = 4784
const TUILE = 28

/** L'image respecte-t-elle les deux limites du modèle ? */
export function tientDansLeModele(largeur: number, hauteur: number): boolean {
  return Math.max(largeur, hauteur) <= GRAND_COTE_MAX
    && Math.ceil(largeur / TUILE) * Math.ceil(hauteur / TUILE) <= TUILES_MAX
}

/**
 * Les dimensions de l'image à envoyer, au plus grand de ce que le modèle lit
 * tel quel.
 *
 * Un PDF se rend à n'importe quelle résolution : on vise la plus grande
 * permise. Une photo, elle, ne s'agrandit pas : on ne fait que la réduire si
 * elle dépasse.
 */
export function dimensionsPourLeModele(largeur: number, hauteur: number, agrandir: boolean): { largeur: number; hauteur: number } {
  const grand = Math.max(largeur, hauteur)
  const plafond = agrandir ? GRAND_COTE_MAX : Math.min(GRAND_COTE_MAX, Math.floor(grand))
  // On descend pixel par pixel sur le grand côté jusqu'à tenir dans la
  // surface permise : quelques centaines d'essais au plus, et pas un pixel de
  // perdu sur la résolution que le modèle aurait pu lire.
  for (let g = plafond; g > 1; g--) {
    const k = g / grand
    const l = Math.max(1, Math.floor(largeur * k))
    const h = Math.max(1, Math.floor(hauteur * k))
    if (tientDansLeModele(l, h)) return { largeur: l, hauteur: h }
  }
  return { largeur: 1, hauteur: 1 }
}

// ---------------------------------------------------------------- repères

/** Une page telle qu'elle a été envoyée, et ce qu'il faut pour revenir au canevas. */
export interface PageRendue {
  numero: number
  /** Dimensions de l'image envoyée au modèle. */
  largeurImage: number
  hauteurImage: number
  /** Dimensions du canevas de l'éditeur pour cette page. */
  largeurCanevas: number
  hauteurCanevas: number
  /** Taille de la feuille en points PDF ; null pour une image. */
  largeurPagePt: number | null
  hauteurPagePt: number | null
  /** Géométrie vectorielle de la page, null pour une image ou un PDF scanné. */
  index: IndexGeometrie | null
}

/** Un point en pixels de l'image envoyée, ramené dans le repère du canevas. */
export function imageVersCanevas(p: PointImage, page: PageRendue): PlanPoint {
  return {
    x: (p[0] * page.largeurCanevas) / page.largeurImage,
    y: (p[1] * page.hauteurCanevas) / page.hauteurImage,
  }
}

// ---------------------------------------------------------------- vocabulaire

/** La couleur des zones proposées : aucune des couleurs de tracé ne la reprend. */
export const COULEUR_PROPOSITION = '#0d9488'

/** La couleur d'une zone une fois validée, prise dans la palette de l'éditeur. */
export const COULEURS_PAR_TYPE: Record<TypeZoneIA, string> = {
  facade: '#3b82f6',
  fenetre: '#f59e0b',
  porte: '#f59e0b',
  toiture: '#ef4444',
  emprise: '#22c55e',
  dalle: '#22c55e',
  mur: '#a855f7',
  // Un indigo à part : sur un plan d'étage, les pièces couvrent presque tout,
  // et elles ne doivent se confondre ni avec la dalle ni avec les murs.
  piece: '#6366f1',
  autre: '#111827',
}

export const NOMS_TYPES_ZONE: Record<TypeZoneIA, string> = {
  facade: 'Façade', fenetre: 'Fenêtre', porte: 'Porte', toiture: 'Toiture',
  emprise: 'Emprise', dalle: 'Dalle', mur: 'Mur', piece: 'Pièce', autre: 'Autre',
}

export const NOMS_TYPES_PAGE: Record<TypePageAnalysee, string> = {
  plan_etage: 'Plan d’étage', elevation: 'Élévation', coupe: 'Coupe',
  toiture: 'Toiture', situation: 'Situation', autre: 'Autre',
}

export const NOMS_CONFIANCE: Record<ConfianceZone, string> = { haute: 'confiance haute', moyenne: 'confiance moyenne', basse: 'confiance basse' }

/**
 * La couleur des repères d'éléments comptés, une par catégorie : sur un plan
 * d'étage où se mêlent portes palières, portes intérieures et fenêtres, c'est
 * la couleur qui dit d'un coup d'œil ce que l'IA a vu où.
 */
export const COULEURS_CATEGORIE: Record<CategorieComptee, string> = {
  porte_entree: '#dc2626',
  porte_paliere: '#7c3aed',
  porte_interieure: '#db2777',
  fenetre: '#0284c7',
  fenetre_toit: '#0891b2',
  balcon: '#16a34a',
  cuisine: '#ea580c',
  appareil_sanitaire: '#a16207',
}

/** « Porte palière 3 » : le nom d'un repère, au singulier, avec son rang. */
export function nomDuRepere(a: Pick<PlanAnnotation, 'repere'>): string {
  if (!a.repere) return 'Repère'
  const s = CATEGORIE[a.repere.categorie].singulier
  return `${s.charAt(0).toUpperCase()}${s.slice(1)} ${a.repere.numero}`
}

/**
 * Le contour qu'un métré retient pour chaque type de zone.
 *
 * Une ouverture se mesure au vide de maçonnerie, donc au cadre extérieur ; une
 * façade, une toiture, une emprise au nu extérieur. Une dalle se mesure à
 * l'intérieur des murs de façade, une pièce au nu intérieur de ses murs et
 * cloisons. Pour un mur ou le reste, rien n'est préféré : seuls les traits
 * suivis décident.
 */
const PREFERENCE: Record<TypeZoneIA, 'exterieur' | 'interieur' | null> = {
  facade: 'exterieur', fenetre: 'exterieur', porte: 'exterieur', toiture: 'exterieur', emprise: 'exterieur',
  dalle: 'interieur', piece: 'interieur', mur: null, autre: null,
}

// ---------------------------------------------------------------- propositions

/** L'échelle proposée pour une page, avec de quoi la présenter. */
export interface EchelleDePage extends PropositionEchelle {
  page: number
  type: TypePageAnalysee
  titre: string | null
}

export interface Propositions {
  annotations: PlanAnnotation[]
  echelles: EchelleDePage[]
}

/**
 * Transforme la réponse de l'analyse en zones à valider et en échelles à confirmer.
 *
 * `identifiant` fournit l'identifiant de chaque annotation, comme l'éditeur
 * le fait pour un tracé à la main.
 */
export function propositionsDeLAnalyse(
  analyse: AnalysePlan,
  pages: PageRendue[],
  options: { estPdf: boolean; identifiant: () => string },
): Propositions {
  const parNumero = new Map(pages.map((p) => [p.numero, p]))
  const annotations: PlanAnnotation[] = []

  // Les repères des éléments comptés : un point par porte ou par fenêtre,
  // numéroté dans sa catégorie et sa page, à valider comme les zones. Pas
  // d'aimantation : le centre d'une ouverture ne tombe sur aucun trait.
  const rangs = new Map<string, number>()
  for (const e of analyse.elements ?? []) {
    const page = parNumero.get(e.page)
    if (!page) continue
    const cle = `${e.page}@${e.categorie}`
    const numero = (rangs.get(cle) ?? 0) + 1
    rangs.set(cle, numero)
    annotations.push({
      id: options.identifiant(),
      type: 'repere',
      points: [imageVersCanevas(e.point, page)],
      page: options.estPdf ? e.page : undefined,
      color: COULEURS_CATEGORIE[e.categorie],
      text: e.libelle ?? undefined,
      repere: { categorie: e.categorie, numero, aValider: true },
    })
  }

  for (const z of analyse.zones) {
    const page = parNumero.get(z.page)
    if (!page) continue
    const brut = z.points.map((p) => imageVersCanevas(p, page))
    const ferme = z.mesure === 'surface'
    const aimante = aimanter(page.index, brut, { ferme, preference: PREFERENCE[z.type] })
    const proposition: PropositionIA = {
      type: z.type,
      libelle: z.libelle,
      orientation: z.orientation,
      confiance: z.confiance,
      aimantee: aimante.complete,
      sommetsAimantes: aimante.nombreAimantes,
      couverture: Math.round(aimante.couvertureMoyenne * 100) / 100,
      valeurCotee: z.valeurCotee,
      cotes: z.cotes,
      remarque: z.remarque,
    }
    annotations.push({
      id: options.identifiant(),
      type: ferme ? 'hatch' : 'measure',
      points: aimante.points,
      page: options.estPdf ? z.page : undefined,
      color: COULEUR_PROPOSITION,
      text: z.libelle,
      itemId: z.releveId,
      proposition,
    })
  }

  const echelles: EchelleDePage[] = []
  for (const p of analyse.pages) {
    const page = parNumero.get(p.page)
    if (!page) continue
    let cote = null
    if (p.cote) {
      const r = aimanter(page.index, [imageVersCanevas(p.cote.p1, page), imageVersCanevas(p.cote.p2, page)], { ferme: false })
      cote = { texte: p.cote.texte, longueurM: p.cote.longueurM, p1: r.points[0], p2: r.points[1], aimantee: r.complete }
    }
    const proposee = proposerEchelle({
      largeurPagePt: page.largeurPagePt,
      largeurCanevasPx: page.largeurCanevas,
      echelleImprimee: p.echelle,
      ouEchelle: p.echelleOu,
      cote,
    })
    echelles.push({ ...proposee, page: p.page, type: p.type, titre: p.titre })
  }

  return { annotations, echelles }
}

/** Valider un repère : il reste sur le plan, en trait plein, et part avec lui à l'export. */
export function validerRepere(a: PlanAnnotation): PlanAnnotation {
  if (!a.repere?.aValider) return a
  return { ...a, repere: { categorie: a.repere.categorie, numero: a.repere.numero } }
}

/**
 * Valider une proposition : elle devient une annotation ordinaire.
 *
 * Même forme qu'une zone tracée à la main, son ouvrage compris : le report
 * vers le relevé la traite dès lors comme n'importe quelle autre. Elle prend
 * la couleur de son type, pour qu'on distingue encore, d'un coup d'œil, les
 * façades des fenêtres, et garde ce type : le récapitulatif des Métrés range
 * les quantités par là.
 */
export function validerProposition(a: PlanAnnotation): PlanAnnotation {
  if (!a.proposition) return a
  const { proposition, ...reste } = a
  return {
    ...reste,
    color: COULEURS_PAR_TYPE[proposition.type],
    text: proposition.libelle,
    typeZone: proposition.type,
    // Aimantée sur le dessin, sa surface est celle du plan : elle reste
    // affichée au centième une fois validée.
    ...(proposition.aimantee ? { mesureExacte: true } : {}),
  }
}

/** Mesure réelle d'une zone, en m² ou en m ; null sans échelle. */
export function mesureDeLaZone(a: PlanAnnotation, pxParM: number | null): number | null {
  if (!pxParM || pxParM <= 0) return null
  if (a.type === 'hatch') return airePolygone(a.points) / (pxParM * pxParM)
  if (a.type === 'measure') return longueurPolyligne(a.points) / pxParM
  return null
}

/**
 * Écart entre la mesure de la zone et ce que donnent ses cotes imprimées.
 *
 * Le modèle a lu « 1.20 × 1.40 » sur le plan ; la zone, aimantée sur le
 * dessin, mesure 1,68 m² : les deux concordent, et la mesure est sûre. Un
 * écart dit au contraire qu'il faut regarder la zone de près.
 */
export function ecartAuxCotes(a: PlanAnnotation, pxParM: number | null): number | null {
  const v = a.proposition?.valeurCotee
  const m = mesureDeLaZone(a, pxParM)
  if (!v || m == null) return null
  return Math.abs(m - v) / v
}

/**
 * Façade brute, ouvertures et façade nette d'une page d'élévation.
 *
 * C'est pour ce calcul que les fenêtres sont des zones à part : la façade se
 * dessine pleine, chaque ouverture à côté, et la différence donne la surface
 * d'enduit ou d'isolation.
 */
export function bilanDeFacade(zones: PlanAnnotation[], pxParM: number | null): { brute: number; ouvertures: number; nette: number; nombreOuvertures: number } | null {
  if (!pxParM) return null
  let brute = 0, ouvertures = 0, nombreOuvertures = 0, facades = 0
  for (const z of zones) {
    const t = z.proposition?.type
    if (z.type !== 'hatch' || !t) continue
    const m = mesureDeLaZone(z, pxParM) ?? 0
    if (t === 'facade') { brute += m; facades++ }
    if (t === 'fenetre' || t === 'porte') { ouvertures += m; nombreOuvertures++ }
  }
  if (facades === 0) return null
  return { brute, ouvertures, nette: brute - ouvertures, nombreOuvertures }
}
