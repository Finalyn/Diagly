/**
 * La présentation des métrés : des diapositives 16:9 tirées du jeu de plans.
 *
 * Ce que le bureau remet au maître d'ouvrage sans rien retaper. Pour chaque
 * élément métré (les pièces, les façades, les portes palières…), d'abord le
 * plan de repérage de chaque feuille où il paraît : ses seules formes, dans
 * sa couleur et numérotées, sur le dessin en retrait. Puis le tableau par
 * niveau, sous-sol, rez, étages, chaque étage type multiplié par les étages
 * qu'il représente, et le total général. Suivent, quand le dossier en a, les
 * surfaces SIA 416 et les photos de l'existant des ouvrages rattachés.
 *
 * Rien ne se recalcule ici : les quantités sont celles du panneau
 * (quantites.ts), tirées par le même calcul (deriveesPonderees), et seules
 * les formes qui entrent dans ses totaux paraissent. Une proposition de l'IA,
 * un repère déjà compté sur un plan d'étage, une forme posée sur une feuille
 * sans échelle restent hors de la présentation comme hors des totaux ; le
 * tableau dit combien il en a laissé de côté.
 *
 * Un métré n'a pas besoin d'un diagnostic : sans relevé ni photo, la
 * présentation sort entière, seulement sans les diapositives de l'existant.
 *
 * Module pur, sans canevas ni réseau, pour être vérifiable par les tests.
 */
import type { ElementState, PlanAnnotation, PlanPoint } from '../api-types'
import { CATEGORIE, CATEGORIES_COMPTEES, type CategorieComptee } from '../base-cfc/comptages'
import { echelleDePage, longueurPolyligne } from '../plan-quantites'
import { COULEURS_CATEGORIE } from './analyse-ia'
import { enAttente, estPdf, feuilleDe, NOMS_VUES, surLaPage } from './feuilles'
import { boiteDe, pointPourEtiquette, type Boite } from './formes'
import {
  classificationDe, compteAuTotal, deriveesPonderees, quantiteLisible,
  type ClassificationQ, type CleClassification, type InstanceQ, type PanneauQuantites, type PlanPourQuantites, type QuantiteDerivee,
} from './quantites'
import type { UniteRecap } from './recapitulatif'
import {
  CATEGORIES_SIA416, COULEUR_NON_AFFECTEE, COULEURS_SIA416, MENTION_SIA416, NOMS_SIA416, type CategorieSia416, type Sia416,
} from './sia416'

// ---------------------------------------------------------------- format

/** Une diapositive : 1280 × 720, le 16:9 des présentations, soit 13,33 × 7,5 pouces à l'impression. */
export const DIAPO = { largeur: 1280, hauteur: 720 } as const
/** La place du plan sur une diapositive de repérage, à côté de sa légende. */
export const PLACE_DU_PLAN = { largeur: 860, hauteur: 520 } as const
/** Les niveaux d'un tableau sur une diapositive : au-delà, il continue sur la suivante. */
export const LIGNES_PAR_TABLEAU = 6
/** Les éléments du récapitulatif sur une diapositive. */
export const LIGNES_PAR_RECAPITULATIF = 8
/** Les formes nommées dans la légende d'un repérage. */
export const LISTE_MAX = 12
/** Les photos de l'existant d'un élément : de quoi voir, pas un reportage. */
export const PHOTOS_MAX = 6

/** La clé des surfaces SIA 416 parmi les éléments qu'on coche. */
export const CLE_SIA416 = 'sia416'

// ---------------------------------------------------------------- les éléments

/** Un élément métré : une classification du panneau, ou une catégorie d'éléments comptés. */
export type CleElement = Exclude<CleClassification, 'elements'> | `cat:${CategorieComptee}`

/** Une feuille du jeu, telle que la présentation la montre. */
export interface FeuilleMetre {
  /** `planId#page` */
  cle: string
  planId: string
  page: number
  /** « 102 Étage type (1er au 3e) » : le numéro et le titre lus au cartouche. */
  libelle: string
  /** Le niveau, comme le panneau le nomme : « 1er au 3e », « Façade sud ». */
  niveau: string
  multiplicateur: number
  /** Pixels du repère des annotations par mètre ; null sans échelle. */
  echelle: number | null
  /** Le 1:100 du cartouche, quand c'est bien l'échelle posée. */
  echelleImprimee: number | null
  /**
   * Le cadrage du plan : la zone dessinée de la feuille, toutes formes
   * validées comprises, avec une marge, au format de la place du plan. Le
   * cartouche et les marges vides restent dehors, et chaque élément d'une
   * même feuille se montre dans le même cadre.
   */
  cadre: Boite
  /** Rang de la feuille dans le jeu. */
  rang: number
}

export interface FormeReperee {
  id: string
  /** De 1 à n sur tout l'élément, niveau après niveau : le tableau reprend ces numéros. */
  numero: number
  nom: string
  nature: InstanceQ['nature']
  points: PlanPoint[]
  trous: PlanPoint[][]
  /** Mesure de la forme, pour un étage. Un repère vaut 1. */
  valeur: number
  unite: UniteRecap
  couleur: string
  /** Où poser le numéro : au cœur d'une zone, au milieu d'une longueur, sur le repère. */
  ancre: PlanPoint
  /** L'ouvrage du relevé que la forme mesure. */
  itemId: string | null
}

export interface EtageDeLElement {
  feuille: FeuilleMetre
  formes: FormeReperee[]
  /** Pour un seul étage. */
  parEtage: QuantiteDerivee[]
  /** Étages identiques compris. */
  total: QuantiteDerivee[]
  /** Codes CFC des ouvrages rattachés aux formes de la feuille. */
  cfc: string[]
}

export interface ElementMetre {
  cle: CleElement
  classification: CleClassification
  categorie: CategorieComptee | null
  titre: string
  /** La couleur de la classification dans le panneau des quantités, celle de la catégorie pour un élément compté. */
  couleur: string
  /** Dans l'ordre des niveaux. */
  etages: EtageDeLElement[]
  /** Les totaux du jeu, étages identiques compris : ceux du panneau. */
  totaux: QuantiteDerivee[]
  /** Les ouvrages rattachés aux formes, dans l'ordre où elles paraissent. */
  ouvrages: string[]
  /** Formes validées sur une feuille sans échelle : hors total. */
  sansEchelle: number
  /** Repères validés déjà comptés sur un plan d'étage : hors total. */
  dejaComptes: number
}

const sansAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * Le rang d'un niveau, pour ranger les tableaux du bas vers le haut :
 * « 2e sous-sol » avant « Sous-sol », puis « Rez », « 1er », « 1er au 3e »,
 * les combles et la toiture. null quand le nom ne dit pas de niveau (une
 * façade, une coupe) : ces feuilles suivent, dans l'ordre du jeu.
 */
export function rangDuNiveau(nom: string): number | null {
  const t = sansAccents(nom)
  const sousSol = t.match(/(\d+)\s*(?:er|re|e|eme)?\s*sous[- ]?sols?/)
  if (sousSol) return -Number(sousSol[1])
  if (/sous[- ]?sols?|\bss\b|\bcaves?\b|souterrain/.test(t)) return -1
  const negatif = t.match(/(?:^|\s)-\s?(\d+)\b/)
  if (negatif) return -Number(negatif[1])
  if (/rez[- ]?inferieur/.test(t)) return -0.5
  if (/rez[- ]?superieur/.test(t)) return 0.5
  if (/\brez\b|\brdc\b/.test(t)) return 0
  const etage = t.match(/\b(\d+)\s*(?:er|re|e|eme)\b/) ?? t.match(/\betages?\s+(\d+)\b/)
  if (etage) return Number(etage[1])
  if (/combles?|attique|galetas|sous[- ]toit/.test(t)) return 50
  if (/toiture|\btoit\b/.test(t)) return 60
  return null
}

/** Les niveaux connus d'abord, du plus bas au plus haut ; les autres feuilles ensuite, dans l'ordre du jeu. */
export function ordonnerParNiveau<T>(xs: T[], nom: (x: T) => string, rang: (x: T) => number): T[] {
  return xs
    .map((x) => ({ x, niveau: rangDuNiveau(nom(x)), rang: rang(x) }))
    .sort((a, b) => {
      if (a.niveau != null && b.niveau != null) return a.niveau - b.niveau || a.rang - b.rang
      if (a.niveau != null) return -1
      if (b.niveau != null) return 1
      return a.rang - b.rang
    })
    .map((y) => y.x)
}

/**
 * Le cadre d'une feuille autour de ses formes : leur boîte, une marge, une
 * taille minimale (un seul repère ne se montre pas à bout portant), puis le
 * format voulu, centré.
 */
export function cadrer(b: Boite, ratio: number): Boite {
  const marge = Math.max(b.largeur, b.hauteur) * 0.06 + 24
  let largeur = Math.max(b.largeur + 2 * marge, 480)
  let hauteur = Math.max(b.hauteur + 2 * marge, 480 / ratio)
  if (largeur / hauteur < ratio) largeur = hauteur * ratio
  else hauteur = largeur / ratio
  const cx = b.x + b.largeur / 2
  const cy = b.y + b.hauteur / 2
  return { x: cx - largeur / 2, y: cy - hauteur / 2, largeur, hauteur }
}

/** Le point à mi-longueur d'un tracé. */
export function milieuDuTrace(pts: PlanPoint[]): PlanPoint {
  if (pts.length < 2) return pts[0] ?? { x: 0, y: 0 }
  let reste = longueurPolyligne(pts) / 2
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i]
    const l = Math.hypot(b.x - a.x, b.y - a.y)
    if (l >= reste && l > 0) return { x: a.x + ((b.x - a.x) * reste) / l, y: a.y + ((b.y - a.y) * reste) / l }
    reste -= l
  }
  return pts[pts.length - 1]
}

/** « 102 Étage type (1er au 3e) », sinon le type de vue, sinon le document et sa page. */
function libelleDeFeuille(numero: string | null | undefined, titre: string | null | undefined, repli: string): string {
  return [numero?.trim(), titre?.trim()].filter(Boolean).join(' ') || repli
}

/**
 * Les éléments métrés du jeu et leurs feuilles, dans l'ordre du panneau : les
 * classifications, et à la place des éléments comptés, chacune de leurs
 * catégories. Un élément sans forme dans les totaux n'y est pas.
 *
 * Les ouvrages du relevé, quand le dossier en a, donnent les codes CFC des
 * formes qui leur sont rattachées.
 */
export function elementsMetres(
  panneau: PanneauQuantites, jeu: PlanPourQuantites[], ouvrages: Pick<OuvragePresentation, 'id' | 'cfcCode'>[] = [],
): ElementMetre[] {
  const formes = new Map(jeu.map((x) => [x.plan.id, new Map((x.plan.annotations ?? []).map((a) => [a.id, a]))]))
  const feuilles = feuillesDuJeu(panneau, jeu)
  const codes = new Map(ouvrages.map((o) => [o.id, o.cfcCode]))
  const out: ElementMetre[] = []
  for (const c of panneau.classifications) {
    if (c.cle === 'elements') {
      for (const def of CATEGORIES_COMPTEES) {
        const e = elementDe(c, def.cle, feuilles, formes, codes)
        if (e) out.push(e)
      }
    } else {
      const e = elementDe(c, null, feuilles, formes, codes)
      if (e) out.push(e)
    }
  }
  return out
}

function feuillesDuJeu(panneau: PanneauQuantites, jeu: PlanPourQuantites[]): Map<string, FeuilleMetre> {
  const parPlan = new Map(jeu.map((x) => [x.plan.id, x]))
  const out = new Map<string, FeuilleMetre>()
  for (const c of panneau.classifications) {
    for (const e of c.etages) {
      if (out.has(e.cle)) continue
      const x = parPlan.get(e.planId)
      if (!x) continue
      const pdf = estPdf(x.plan)
      const f = feuilleDe(x.feuilles, e.page)
      const repli = f.type ? NOMS_VUES[f.type] : pdf ? `${x.plan.name}, page ${e.page}` : x.plan.name
      const echelle = echelleDePage(x.plan, pdf ? e.page : 1)
      // Le 1:100 du cartouche ne se dit que s'il correspond à l'échelle posée :
      // un plan réétalonné à la main n'est peut-être plus à l'échelle imprimée.
      const imprimee = f.echelle?.imprimee ?? null
      const memeEchelle = !!imprimee && echelle != null && imprimee.pxParM > 0 && Math.abs(echelle - imprimee.pxParM) / imprimee.pxParM < 0.001
      // Le cadre suit tout ce qui est validé sur la feuille, toutes classifications confondues.
      const points = (x.plan.annotations ?? [])
        .filter((a) => surLaPage(a, e.page, pdf) && !enAttente(a) && classificationDe(a) != null)
        .flatMap((a) => a.points)
      out.set(e.cle, {
        cle: e.cle,
        planId: e.planId,
        page: e.page,
        libelle: libelleDeFeuille(f.numero, f.titre, repli),
        niveau: e.nom,
        multiplicateur: e.multiplicateur,
        echelle,
        echelleImprimee: memeEchelle ? imprimee!.denominateur : null,
        cadre: cadrer(boiteDe(points), PLACE_DU_PLAN.largeur / PLACE_DU_PLAN.hauteur),
        rang: e.rang,
      })
    }
  }
  return out
}

function elementDe(
  c: ClassificationQ,
  categorie: CategorieComptee | null,
  feuilles: Map<string, FeuilleMetre>,
  formes: Map<string, Map<string, PlanAnnotation>>,
  codes: Map<string, string | null>,
): ElementMetre | null {
  const sienne = (i: InstanceQ) => !i.brouillon && (categorie == null || i.categorie === categorie)
  const bruts = c.etages
    .map((e) => ({ e, retenues: e.instances.filter((i) => sienne(i) && compteAuTotal(i)) }))
    .filter((x) => x.retenues.length > 0 && feuilles.has(x.e.cle))
  if (!bruts.length) return null

  const couleur = categorie ? COULEURS_CATEGORIE[categorie] : c.couleur
  // Une catégorie comptée ne garde que son nombre : le panneau le range sous « Éléments comptés ».
  const quantites = (xs: { i: InstanceQ; mult: number }[]) => {
    const d = deriveesPonderees(c.cle, xs)
    return categorie ? d.filter((x) => x.cle === 'nombre') : d
  }
  const ouvrages: string[] = []
  let numero = 0
  const etages = ordonnerParNiveau(bruts, (x) => x.e.nom, (x) => x.e.rang).map(({ e, retenues }) => {
    // Les repères gardent l'ordre de leurs numéros sur la feuille.
    const triees = categorie ? [...retenues].sort((a, b) => numeroDuRepere(formes, a) - numeroDuRepere(formes, b)) : retenues
    const cfc = new Set<string>()
    const formesE: FormeReperee[] = triees.flatMap((i) => {
      const a = formes.get(i.planId)?.get(i.id)
      if (!a) return []
      numero += 1
      if (a.itemId && !ouvrages.includes(a.itemId)) ouvrages.push(a.itemId)
      const code = a.itemId ? codes.get(a.itemId) : null
      if (code) cfc.add(code)
      return [{
        id: i.id,
        numero,
        nom: i.nom,
        nature: i.nature,
        points: a.points,
        trous: a.trous ?? [],
        valeur: i.valeur ?? 0,
        unite: i.unite,
        couleur,
        ancre: i.nature === 'comptage' ? a.points[0] : i.nature === 'surface' ? pointPourEtiquette(a.points) : milieuDuTrace(a.points),
        itemId: a.itemId ?? null,
      }]
    })
    return {
      feuille: feuilles.get(e.cle)!,
      formes: formesE,
      parEtage: quantites(retenues.map((i) => ({ i, mult: 1 }))),
      total: quantites(retenues.map((i) => ({ i, mult: e.multiplicateur }))),
      cfc: [...cfc].sort((a, b) => a.localeCompare(b, 'fr', { numeric: true })),
    }
  })
  const validees = c.etages.flatMap((e) => e.instances.filter((i) => sienne(i) && !i.aValider))
  return {
    cle: categorie ? `cat:${categorie}` : (c.cle as Exclude<CleClassification, 'elements'>),
    classification: c.cle,
    categorie,
    titre: categorie ? CATEGORIE[categorie].libelle : c.titre,
    couleur,
    etages,
    totaux: quantites(bruts.flatMap(({ e, retenues }) => retenues.map((i) => ({ i, mult: e.multiplicateur })))),
    ouvrages,
    sansEchelle: validees.filter((i) => i.valeur == null).length,
    dejaComptes: validees.filter((i) => i.valeur != null && !!i.horsTotal).length,
  }
}

function numeroDuRepere(formes: Map<string, Map<string, PlanAnnotation>>, i: InstanceQ): number {
  return formes.get(i.planId)?.get(i.id)?.repere?.numero ?? 0
}

// ---------------------------------------------------------------- l'existant

/** Un ouvrage du relevé, ce que la présentation en montre. */
export interface OuvragePresentation {
  id: string
  cfcCode: string | null
  libelle: string
  etat: ElementState | null
  photos: string[]
  /** La catégorie comptée de l'ouvrage (comptages.ts, categorieDuReleve), pour les éléments comptés. */
  categorie?: CategorieComptee | null
}

export interface PhotoExistant {
  src: string
  /** « 221.2 · Fenêtres bois » */
  legende: string
  etat: ElementState | null
}

/**
 * Les photos de l'existant d'un élément : celles des ouvrages rattachés à ses
 * zones, et pour un élément compté, celles des relevés de sa catégorie (la
 * même règle que la répartition des comptages). Une photo par ouvrage
 * d'abord, puis les suivantes, jusqu'à six.
 */
export function photosDeLElement(e: ElementMetre, ouvrages: OuvragePresentation[]): PhotoExistant[] {
  const parId = new Map(ouvrages.map((o) => [o.id, o]))
  const ids = [...e.ouvrages]
  if (e.categorie) for (const o of ouvrages) if (o.categorie === e.categorie && !ids.includes(o.id)) ids.push(o.id)
  const avec = ids.map((id) => parId.get(id)).filter((o): o is OuvragePresentation => !!o && o.photos.length > 0)
  const out: PhotoExistant[] = []
  for (let rang = 0; out.length < PHOTOS_MAX && avec.some((o) => o.photos.length > rang); rang++) {
    for (const o of avec) {
      if (out.length >= PHOTOS_MAX) break
      const src = o.photos[rang]
      if (src) out.push({ src, legende: [o.cfcCode, o.libelle].filter(Boolean).join(' · '), etat: o.etat })
    }
  }
  return out
}

// ---------------------------------------------------------------- les diapositives

export interface ResumeElement { cle: CleElement; titre: string; couleur: string }

export interface DiapoTitre {
  type: 'titre'
  cle: string
  titre: string
  batiment: string
  adresse: string
  date: string
  /** La photo de garde du dossier, sinon le premier plan et ses formes. */
  image: { genre: 'photo'; src: string } | { genre: 'plan'; feuille: FeuilleMetre; formes: FormeReperee[] } | null
  /** Ce que la présentation contient, dans son ordre. */
  sommaire: { cle: string; titre: string; couleur: string }[]
}

export interface LigneListe { numero: number; nom: string; quantite: string }

export interface DiapoReperage {
  type: 'reperage'
  cle: string
  titre: string
  sousTitre: string | null
  element: ResumeElement
  feuille: FeuilleMetre
  formes: FormeReperee[]
  /** « 6 pce », sur cette feuille, pour un étage. */
  quantite: string
  /** « × 3 étages identiques = 18 pce » */
  etages: string | null
  /** Les autres quantités de la feuille, pour un étage : « Surface 23,52 m² », « Plinthes 168,20 ml ». */
  detail: string[]
  /** Les formes nommées, pour une surface ou une longueur. */
  liste: LigneListe[]
  /** Les formes que la liste n'a pas pu nommer. */
  autres: number
}

export interface ColonneTableau { cle: string; libelle: string; unite: UniteRecap }

export interface CelluleTableau {
  /** Étages identiques compris. */
  total: string
  /** « 6 pce par étage », quand la feuille vaut plusieurs étages. */
  parEtage: string | null
}

export interface LigneDeTableau {
  cle: string
  niveau: string
  feuille: string
  /** « 1 à 3 » : les numéros du plan de repérage. */
  numeros: string
  multiplicateur: number
  cellules: CelluleTableau[]
  cfc: string
}

/** La part d'un niveau dans le total de l'élément, pour sa barre. */
export interface BarreNiveau {
  cle: string
  niveau: string
  multiplicateur: number
  /** La cellule du tableau, étages identiques compris. */
  valeur: string
  /** De 0 à 1 : la part du niveau dans le total général. */
  part: number
}

/** La carte du total général, à côté ou sous le tableau. */
export interface SyntheseTableau {
  /** « 6 pce », « 659,68 m² » : la première cellule du total général. */
  total: string
  /** « Nombre », « Sol » : ce que le total compte. */
  libelle: string
  /** Les autres colonnes du total : « Plinthes 568,08 ml ». */
  autres: string[]
  /** Chaque niveau, dans l'ordre du tableau. */
  barres: BarreNiveau[]
}

export interface DiapoTableau {
  type: 'tableau'
  cle: string
  titre: string
  element: ResumeElement
  colonnes: ColonneTableau[]
  avecCfc: boolean
  lignes: LigneDeTableau[]
  /** Le total général, sur la dernière diapositive du tableau. */
  total: string[] | null
  /** Le total général en grand et la part de chaque niveau, avec lui. */
  synthese: SyntheseTableau | null
  partie: { n: number; sur: number } | null
  notes: string[]
}

export interface FormeSia416 extends FormeReperee { categorie: CategorieSia416 | null }

export interface LegendeSia416 { cle: CategorieSia416 | 'non'; nom: string; couleur: string; surface: string }

export interface DiapoSiaPlan {
  type: 'sia-plan'
  cle: string
  titre: string
  sousTitre: string | null
  feuille: FeuilleMetre
  formes: FormeSia416[]
  legende: LegendeSia416[]
  mention: string
}

export interface DiapoSiaTableau {
  type: 'sia-tableau'
  cle: string
  titre: string
  colonnes: { cle: string; libelle: string; couleur: string | null }[]
  lignes: { cle: string; niveau: string; multiplicateur: number; cellules: CelluleTableau[] }[]
  total: string[]
  /** Les totaux en grand, et la SN partagée entre ses catégories. */
  synthese: {
    sp: string
    sn: string
    sc: string
    parts: { cle: string; libelle: string; couleur: string; valeur: string; part: number }[]
  }
  mention: string
  alertes: string[]
}

export interface DiapoExistant {
  type: 'existant'
  cle: string
  titre: string
  element: ResumeElement
  photos: PhotoExistant[]
}

export interface DiapoRecapitulatif {
  type: 'recapitulatif'
  cle: string
  titre: string
  lignes: { cle: string; titre: string; couleur: string; principal: string; autres: string[] }[]
  partie: { n: number; sur: number } | null
}

export type Diapositive = DiapoTitre | DiapoReperage | DiapoTableau | DiapoSiaPlan | DiapoSiaTableau | DiapoExistant | DiapoRecapitulatif

export interface OptionsPresentation {
  /** Les éléments écartés, par leur clé ; CLE_SIA416 écarte les surfaces SIA 416. */
  exclus: string[]
  titre: boolean
  photos: boolean
  recapitulatif: boolean
  /** Le dessin en retrait sous les formes. Il ne change que le rendu du plan. */
  attenue: boolean
}

export const OPTIONS_PRESENTATION: OptionsPresentation = { exclus: [], titre: true, photos: true, recapitulatif: true, attenue: true }

export interface ContextePresentation {
  batiment: string
  adresse: string
  date: Date
  ouvrages: OuvragePresentation[]
  /** La photo de garde du dossier, choisie dans Photos ou la première venue. */
  photoDeGarde: string | null
}

const DATE_LONGUE = new Intl.DateTimeFormat('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' })

/** Les quantités qui méritent une colonne : la principale, et les autres quand elles ne sont pas nulles. */
export function colonnesDe(totaux: QuantiteDerivee[]): ColonneTableau[] {
  return totaux.filter((d, i) => i === 0 || d.valeur !== 0).map((d) => ({ cle: d.cle, libelle: d.libelle, unite: d.unite }))
}

const valeurDe = (ds: QuantiteDerivee[], cle: string) => ds.find((d) => d.cle === cle)?.valeur ?? 0
const resume = (e: ElementMetre): ResumeElement => ({ cle: e.cle, titre: e.titre, couleur: e.couleur })
const pluriel = (n: number, mot: string, motPluriel = `${mot}s`) => `${n} ${n > 1 ? motPluriel : mot}`

function decouper<T>(xs: T[], n: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n))
  return out.length ? out : [[]]
}

/** « 1 à 3 », ou le seul numéro. */
function plage(formes: FormeReperee[]): string {
  if (!formes.length) return ''
  const a = formes[0].numero, b = formes[formes.length - 1].numero
  return a === b ? String(a) : `${a} à ${b}`
}

/** Le niveau dit sous le titre d'un repérage, quand le libellé de la feuille ne le dit pas déjà. */
function sousTitreDe(f: FeuilleMetre): string | null {
  const parts = [
    sansAccents(f.libelle).includes(sansAccents(f.niveau)) ? null : f.niveau,
    f.multiplicateur > 1 ? `${f.multiplicateur} étages identiques` : null,
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : null
}

function diapoReperage(e: ElementMetre, x: EtageDeLElement): DiapoReperage {
  const principal = x.parEtage[0]
  const total = x.total[0]
  // Les mêmes colonnes que le tableau de l'élément.
  const [, ...secondaires] = colonnesDe(e.totaux)
  const nommees = e.classification !== 'elements'
  const liste = nommees
    ? x.formes.slice(0, x.formes.length > LISTE_MAX ? LISTE_MAX - 1 : LISTE_MAX)
      .map((f) => ({ numero: f.numero, nom: f.nom, quantite: quantiteLisible(f.valeur, f.unite) }))
    : []
  return {
    type: 'reperage',
    cle: `reperage-${e.cle}-${x.feuille.cle}`,
    titre: `${e.titre} · ${x.feuille.libelle}`,
    sousTitre: sousTitreDe(x.feuille),
    element: resume(e),
    feuille: x.feuille,
    formes: x.formes,
    quantite: quantiteLisible(principal.valeur, principal.unite),
    etages: x.feuille.multiplicateur > 1 ? `× ${x.feuille.multiplicateur} étages identiques = ${quantiteLisible(total.valeur, total.unite)}` : null,
    detail: secondaires.map((c) => `${c.libelle} ${quantiteLisible(valeurDe(x.parEtage, c.cle), c.unite)}`),
    liste,
    autres: nommees ? x.formes.length - liste.length : 0,
  }
}

function diaposTableau(e: ElementMetre): DiapoTableau[] {
  const colonnes = colonnesDe(e.totaux)
  const lignes: LigneDeTableau[] = e.etages.map((x) => ({
    cle: x.feuille.cle,
    niveau: x.feuille.niveau,
    feuille: x.feuille.libelle,
    numeros: plage(x.formes),
    multiplicateur: x.feuille.multiplicateur,
    cellules: colonnes.map((c) => ({
      total: quantiteLisible(valeurDe(x.total, c.cle), c.unite),
      parEtage: x.feuille.multiplicateur > 1 ? `${quantiteLisible(valeurDe(x.parEtage, c.cle), c.unite)} par étage` : null,
    })),
    cfc: x.cfc.join(', '),
  }))
  const notes = [
    e.sansEchelle > 0 ? `${pluriel(e.sansEchelle, 'forme')} sur une feuille sans échelle, hors total.` : null,
    e.dejaComptes > 0 ? `${pluriel(e.dejaComptes, 'repère')} d’élévation déjà ${e.dejaComptes > 1 ? 'comptés' : 'compté'} sur un plan d’étage, hors total.` : null,
  ].filter((n): n is string => !!n)
  const parties = decouper(lignes, LIGNES_PAR_TABLEAU)
  const avecCfc = lignes.some((l) => l.cfc)
  const total = colonnes.map((c) => quantiteLisible(valeurDe(e.totaux, c.cle), c.unite))
  // La part de chaque niveau se lit sur la quantité principale, celle de la première colonne.
  const principale = colonnes[0]
  const totalPrincipal = valeurDe(e.totaux, principale.cle)
  const synthese: SyntheseTableau = {
    total: total[0],
    libelle: principale.libelle,
    autres: colonnes.slice(1).map((c, i) => `${c.libelle} ${total[i + 1]}`),
    barres: e.etages.map((x, i) => ({
      cle: x.feuille.cle,
      niveau: x.feuille.niveau,
      multiplicateur: x.feuille.multiplicateur,
      valeur: lignes[i].cellules[0].total,
      part: totalPrincipal > 0 ? valeurDe(x.total, principale.cle) / totalPrincipal : 0,
    })),
  }
  return parties.map((ls, k) => {
    const derniere = k === parties.length - 1
    return {
      type: 'tableau',
      cle: `tableau-${e.cle}-${k + 1}`,
      titre: k > 0 ? `${e.titre} (suite)` : e.titre,
      element: resume(e),
      colonnes,
      avecCfc,
      lignes: ls,
      total: derniere ? total : null,
      synthese: derniere ? synthese : null,
      partie: parties.length > 1 ? { n: k + 1, sur: parties.length } : null,
      notes: derniere ? notes : [],
    }
  })
}

function diaposSia416(sia: Sia416, pieces: ElementMetre | undefined): Diapositive[] {
  const out: Diapositive[] = []
  const parFeuille = new Map((pieces?.etages ?? []).map((x) => [x.feuille.cle, x]))
  for (const e of sia.etages) {
    const x = parFeuille.get(e.cle)
    if (!x || !e.pieces.length) continue
    const categorie = new Map(e.pieces.map((p) => [p.id, p.categorie]))
    const formes: FormeSia416[] = x.formes.map((f) => {
      const c = categorie.get(f.id) ?? null
      return { ...f, categorie: c, couleur: c ? COULEURS_SIA416[c] : COULEUR_NON_AFFECTEE }
    })
    const legende: LegendeSia416[] = [
      ...CATEGORIES_SIA416.filter((c) => e.categories[c] > 0)
        .map((c) => ({ cle: c, nom: NOMS_SIA416[c], couleur: COULEURS_SIA416[c], surface: quantiteLisible(e.categories[c], 'm²') })),
      ...(e.nonAffectee > 0 ? [{ cle: 'non' as const, nom: 'Pièces sans affectation', couleur: COULEUR_NON_AFFECTEE, surface: quantiteLisible(e.nonAffectee, 'm²') }] : []),
    ]
    out.push({
      type: 'sia-plan',
      cle: `sia-plan-${e.cle}`,
      titre: `Surfaces SIA 416 · ${x.feuille.libelle}`,
      sousTitre: sousTitreDe(x.feuille),
      feuille: x.feuille,
      formes,
      legende,
      mention: MENTION_SIA416,
    })
  }
  const t = sia.total
  const avecNonAffectee = t.nonAffectee > 0
  const colonnes = [
    { cle: 'SP', libelle: 'SP', couleur: null },
    { cle: 'SN', libelle: 'SN', couleur: null },
    { cle: 'SC', libelle: 'SC', couleur: null },
    ...CATEGORIES_SIA416.map((c) => ({ cle: c, libelle: c, couleur: COULEURS_SIA416[c] })),
    ...(avecNonAffectee ? [{ cle: 'NA', libelle: 'Non aff.', couleur: COULEUR_NON_AFFECTEE }] : []),
  ]
  const nc = (v: number | null) => (v == null ? 'n.c.' : quantiteLisible(v, 'm²'))
  const valeurs = (e: { sp: number | null; sn: number; sc: number | null; categories: Record<CategorieSia416, number>; nonAffectee: number }) => [
    e.sp, e.sn, e.sc, ...CATEGORIES_SIA416.map((c) => e.categories[c]), ...(avecNonAffectee ? [e.nonAffectee] : []),
  ]
  const etages = ordonnerParNiveau(sia.etages, (e) => e.nom, (e) => sia.etages.indexOf(e))
  out.push({
    type: 'sia-tableau',
    cle: 'sia-tableau',
    titre: 'Surfaces SIA 416',
    colonnes,
    lignes: etages.map((e) => ({
      cle: e.cle,
      niveau: e.nom,
      multiplicateur: e.multiplicateur,
      cellules: valeurs(e).map((v) => ({
        total: nc(v == null ? null : v * e.multiplicateur),
        parEtage: e.multiplicateur > 1 && v ? `${quantiteLisible(v, 'm²')} par étage` : null,
      })),
    })),
    total: valeurs(t).map(nc),
    synthese: {
      sp: nc(t.sp),
      sn: nc(t.sn),
      sc: nc(t.sc),
      parts: [
        ...CATEGORIES_SIA416.map((c) => ({ cle: c as string, libelle: c as string, couleur: COULEURS_SIA416[c], v: t.categories[c] })),
        { cle: 'NA', libelle: 'Non affectée', couleur: COULEUR_NON_AFFECTEE, v: t.nonAffectee },
      ].filter((x) => x.v > 0).map(({ v, ...x }) => ({ ...x, valeur: quantiteLisible(v, 'm²'), part: t.sn > 0 ? v / t.sn : 0 })),
    },
    mention: MENTION_SIA416,
    alertes: sia.alertes.slice(0, 3),
  })
  return out
}

function diaposRecapitulatif(elements: ElementMetre[]): DiapoRecapitulatif[] {
  const lignes = elements.map((e) => {
    const [principal, ...autres] = colonnesDe(e.totaux)
    return {
      cle: e.cle,
      titre: e.titre,
      couleur: e.couleur,
      principal: quantiteLisible(valeurDe(e.totaux, principal.cle), principal.unite),
      autres: autres.map((c) => `${c.libelle} ${quantiteLisible(valeurDe(e.totaux, c.cle), c.unite)}`),
    }
  })
  const parties = decouper(lignes, LIGNES_PAR_RECAPITULATIF)
  return parties.map((ls, k) => ({
    type: 'recapitulatif',
    cle: `recapitulatif-${k + 1}`,
    titre: k > 0 ? 'Récapitulatif (suite)' : 'Récapitulatif',
    lignes: ls,
    partie: parties.length > 1 ? { n: k + 1, sur: parties.length } : null,
  }))
}

/**
 * Les diapositives, dans l'ordre : la page de titre, puis chaque élément
 * retenu (ses repérages feuille par feuille, son tableau, ses photos de
 * l'existant), les surfaces SIA 416 à la suite des pièces, et le
 * récapitulatif. Rien de validé : aucune diapositive.
 */
export function composerPresentation(
  elements: ElementMetre[], sia: Sia416, ctx: ContextePresentation, options: OptionsPresentation,
): Diapositive[] {
  if (!elements.length) return []
  const exclus = new Set(options.exclus)
  const retenus = elements.filter((e) => !exclus.has(e.cle))
  const avecSia = !exclus.has(CLE_SIA416) && sia.etages.some((e) => e.pieces.length > 0)
  const out: Diapositive[] = []

  if (options.titre) {
    const premier = retenus[0]?.etages[0]?.feuille ?? elements[0].etages[0].feuille
    const image: DiapoTitre['image'] = ctx.photoDeGarde
      ? { genre: 'photo', src: ctx.photoDeGarde }
      : { genre: 'plan', feuille: premier, formes: elements.flatMap((e) => e.etages.filter((x) => x.feuille.cle === premier.cle).flatMap((x) => x.formes)) }
    out.push({
      type: 'titre',
      cle: 'titre',
      titre: 'Plans de repérage et métrés',
      batiment: ctx.batiment,
      adresse: ctx.adresse,
      date: DATE_LONGUE.format(ctx.date),
      image,
      sommaire: [...retenus.map(resume), ...(avecSia ? [{ cle: CLE_SIA416, titre: 'Surfaces SIA 416', couleur: COULEURS_SIA416.SUP }] : [])],
    })
  }

  let siaPosee = false
  const poserSia = () => {
    if (!avecSia || siaPosee) return
    out.push(...diaposSia416(sia, elements.find((e) => e.cle === 'pieces')))
    siaPosee = true
  }
  for (const e of retenus) {
    for (const x of e.etages) out.push(diapoReperage(e, x))
    out.push(...diaposTableau(e))
    if (options.photos) {
      const photos = photosDeLElement(e, ctx.ouvrages)
      if (photos.length) out.push({ type: 'existant', cle: `existant-${e.cle}`, titre: `Existant · ${e.titre}`, element: resume(e), photos })
    }
    // Les surfaces SIA 416 se lisent juste après les pièces dont elles viennent.
    if (e.cle === 'pieces') poserSia()
  }
  poserSia()
  if (options.recapitulatif && retenus.length) out.push(...diaposRecapitulatif(retenus))
  return out
}

/**
 * Les feuilles à rendre pour ces diapositives, une fois chacune : le cadre est
 * le même pour tous les éléments d'une feuille. La page de titre montre son
 * plan tel quel ; les repérages, en retrait quand on le demande.
 */
export function feuillesARendre(diapositives: Diapositive[], attenue: boolean): { feuille: FeuilleMetre; attenue: boolean }[] {
  const out = new Map<string, { feuille: FeuilleMetre; attenue: boolean }>()
  const ajouter = (feuille: FeuilleMetre, enRetrait: boolean) => {
    const k = `${feuille.cle}@${enRetrait ? 'a' : 'c'}`
    if (!out.has(k)) out.set(k, { feuille, attenue: enRetrait })
  }
  for (const d of diapositives) {
    if (d.type === 'titre' && d.image?.genre === 'plan') ajouter(d.image.feuille, false)
    if (d.type === 'reperage' || d.type === 'sia-plan') ajouter(d.feuille, attenue)
  }
  return [...out.values()]
}

/**
 * L'échelle graphique d'un plan : la longueur ronde (1, 2, 5, 10 m…) dont la
 * barre approche le plus 140 px de diapositive, sans dépasser 220.
 * `reperesParPixel` dit combien d'unités du repère des annotations tient un
 * pixel de la diapositive, une fois le cadre posé dans sa place.
 */
export function echelleGraphique(pxParM: number, reperesParPixel: number): { metres: number; longueur: number } | null {
  if (!(pxParM > 0) || !(reperesParPixel > 0)) return null
  const parMetre = pxParM / reperesParPixel
  const ronds = [0.5, 1, 2, 5, 10, 20, 50, 100, 200].filter((m) => m * parMetre <= 220)
  if (!ronds.length) return null
  const choix = ronds.reduce((a, b) => (Math.abs(b * parMetre - 140) < Math.abs(a * parMetre - 140) ? b : a))
  const longueur = choix * parMetre
  return longueur >= 30 ? { metres: choix, longueur } : null
}

/** « Métrés Immeuble Les Essais 18.10.2026 » : le nom du PDF, sans les caractères qu'un système de fichiers refuse. */
export function nomDuPdf(batiment: string, date = new Date()): string {
  const jj = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const propre = batiment.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim() || 'bâtiment'
  return `Métrés ${propre} ${jj}.${mm}.${date.getFullYear()}`
}
