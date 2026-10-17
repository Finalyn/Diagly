/**
 * Le panneau des quantités de l'outil Métrés : ce qui est mesuré sur tout le
 * jeu de plans, rangé comme un métreur le range.
 *
 * Trois niveaux, comme chez les logiciels de métré : la classification
 * (pièces, façades, fenêtres, murs…), puis l'étage (une feuille du jeu), puis
 * chaque forme posée sur le plan. Chaque niveau porte ses totaux, et chaque
 * forme ce qu'on en tire : une pièce donne son sol et le périmètre de ses
 * plinthes, une façade sa surface brute, ses ouvertures et sa surface nette,
 * un mur tracé en longueur la surface d'une face à la hauteur de l'étage.
 *
 * Les règles de phase 1 tiennent toujours : une proposition de l'IA est
 * listée, marquée « à valider », et n'entre dans aucun total ; un étage type
 * vaut pour chaque étage qu'il représente ; une forme posée sur une feuille
 * sans échelle n'a pas de mesure. La forme en cours de tracé, elle, compte
 * déjà : c'est celle qu'on est en train de mesurer, et le total la suit.
 *
 * Chaque forme garde son plan, sa page et son identifiant : c'est par là que
 * le panneau relie chaque chiffre à sa forme, dans les deux sens.
 *
 * Module pur, sans canevas ni réseau, pour être vérifiable par les tests.
 */
import type { ApiPlan, ConfianceZone, FeuillesPlan, PlanAnnotation, PlanPoint, TypeZoneIA } from '../api-types'
import { CATEGORIE, CLES_CATEGORIES, type CategorieComptee } from '../base-cfc/comptages'
import { aireDeLaForme, echelleDePage, longueurPolyligne, natureDuTrace } from '../plan-quantites'
import { COULEURS_CATEGORIE, COULEURS_PAR_TYPE, NOMS_TYPES_ZONE, nomDuRepere } from './analyse-ia'
import { enAttente, estPdf, feuilleDe, multiplicateur, NOMS_VUES } from './feuilles'
import { centreDeSurface, pointDansPolygone } from './formes'
import type { UniteRecap } from './recapitulatif'
import type { CategorieSia416, EntreeEtageSia416 } from './sia416'

/** Hauteur d'étage par défaut, sans fiche du dossier ni réglage de la feuille. */
export const HAUTEUR_PAR_DEFAUT = 2.7

export type CleClassification = 'pieces' | 'facades' | 'fenetres' | 'portes' | 'toiture' | 'dalles' | 'murs' | 'elements' | 'libres'

export interface DefinitionClassification {
  cle: CleClassification
  titre: string
  couleur: string
  /** L'outil qui dessine dans cette classification. */
  outil: 'surface' | 'longueur' | 'comptage'
  /** Le type que prend une forme dessinée dedans ; null pour les mesures libres et les comptages. */
  typeZone: TypeZoneIA | null
}

export const CLASSIFICATIONS: readonly DefinitionClassification[] = [
  { cle: 'pieces', titre: 'Pièces', couleur: COULEURS_PAR_TYPE.piece, outil: 'surface', typeZone: 'piece' },
  { cle: 'facades', titre: 'Façades', couleur: COULEURS_PAR_TYPE.facade, outil: 'surface', typeZone: 'facade' },
  { cle: 'fenetres', titre: 'Fenêtres', couleur: COULEURS_PAR_TYPE.fenetre, outil: 'surface', typeZone: 'fenetre' },
  { cle: 'portes', titre: 'Portes', couleur: '#d97706', outil: 'surface', typeZone: 'porte' },
  { cle: 'toiture', titre: 'Toiture', couleur: COULEURS_PAR_TYPE.toiture, outil: 'surface', typeZone: 'toiture' },
  // Une forme dessinée ici est une emprise : c'est elle qui donne la SP d'un étage, au nu extérieur.
  { cle: 'dalles', titre: 'Dalles et emprise', couleur: COULEURS_PAR_TYPE.emprise, outil: 'surface', typeZone: 'emprise' },
  { cle: 'murs', titre: 'Murs', couleur: COULEURS_PAR_TYPE.mur, outil: 'longueur', typeZone: 'mur' },
  { cle: 'elements', titre: 'Éléments comptés', couleur: '#0f766e', outil: 'comptage', typeZone: null },
  { cle: 'libres', titre: 'Mesures libres', couleur: '#111827', outil: 'surface', typeZone: null },
]

export const CLASSIFICATION: Record<CleClassification, DefinitionClassification> = Object.fromEntries(
  CLASSIFICATIONS.map((c) => [c.cle, c]),
) as Record<CleClassification, DefinitionClassification>

const PAR_TYPE: Record<TypeZoneIA, CleClassification> = {
  piece: 'pieces', facade: 'facades', fenetre: 'fenetres', porte: 'portes', toiture: 'toiture',
  emprise: 'dalles', dalle: 'dalles', mur: 'murs', autre: 'libres',
}

/** La classification d'une forme ; null pour ce qui ne se métré pas (note, flèche, croquis, calque). */
export function classificationDe(a: Pick<PlanAnnotation, 'type' | 'points' | 'repere' | 'proposition' | 'typeZone'>): CleClassification | null {
  if (a.type === 'repere') return a.repere ? 'elements' : null
  if (natureDuTrace(a) === 'aucune') return null
  const t = a.proposition?.type ?? a.typeZone ?? null
  return t ? PAR_TYPE[t] : 'libres'
}

export interface QuantiteDerivee {
  cle: string
  libelle: string
  valeur: number
  unite: UniteRecap
}

export interface InstanceQ {
  id: string
  planId: string
  page: number
  nom: string
  nature: 'surface' | 'longueur' | 'comptage'
  /** Mesure de la forme, pour un seul étage ; null sans échelle. Un comptage vaut 1. */
  valeur: number | null
  unite: UniteRecap
  /** Ce qu'on tire de la forme : plinthes, ouvertures, face de mur. */
  derivees: QuantiteDerivee[]
  aValider: boolean
  /** Hors des totaux pour une autre raison que la validation : un repère déjà compté sur un plan d'étage. */
  horsTotal: string | null
  confiance: ConfianceZone | null
  couleur: string
  categorie?: CategorieComptee
  typeZone: TypeZoneIA | null
  /** Catégorie SIA 416 choisie à la main, pour une pièce. */
  sia416?: CategorieSia416
  /** La forme en cours de tracé, pas encore posée. */
  brouillon?: boolean
}

export interface EtageQ {
  /** `planId#page` */
  cle: string
  planId: string
  page: number
  /** Rang de la feuille dans le jeu : l'ordre des documents, puis des pages. */
  rang: number
  nom: string
  multiplicateur: number
  /** Hauteur d'étage retenue pour les murs, en mètres. */
  hauteur: number
  /** La hauteur vient du réglage de la feuille. */
  hauteurReglee: boolean
  instances: InstanceQ[]
  /** Étages identiques compris ; la première est la quantité principale. */
  derivees: QuantiteDerivee[]
  aValider: number
}

export interface ClassificationQ extends DefinitionClassification {
  etages: EtageQ[]
  /** Étages identiques compris ; la première est la quantité principale. */
  derivees: QuantiteDerivee[]
  aValider: number
  /** Formes validées posées sur une feuille sans échelle : sans mesure. */
  sansEchelle: number
  /** Toutes les formes listées, à valider comprises. */
  nombre: number
}

export interface PanneauQuantites {
  classifications: ClassificationQ[]
  aValider: number
  sansEchelle: number
}

/** Un plan du jeu, ses feuilles, et ses annotations les plus récentes (celles de l'éditeur ouvert, s'il l'est). */
export interface PlanPourQuantites {
  plan: Pick<ApiPlan, 'id' | 'name' | 'mimeType' | 'scalePxPerM' | 'annotations'>
  feuilles: FeuillesPlan
}

/** La forme en cours de tracé dans l'éditeur ouvert. */
export interface Brouillon {
  planId: string
  page: number
  nature: 'surface' | 'longueur'
  points: PlanPoint[]
  typeZone: TypeZoneIA | null
}

export interface OptionsQuantites {
  /** Hauteur d'étage de la fiche du dossier ; HAUTEUR_PAR_DEFAUT sans elle. */
  hauteurDuDossier?: number | null
  brouillon?: Brouillon | null
}

/** Le nom d'une feuille dans le panneau : son niveau, sinon son titre, sinon sa page. */
export function nomDEtage(f: FeuillesPlan, page: number, nomPlan: string, pdf: boolean): string {
  const x = feuilleDe(f, page)
  const nom = x.niveau?.trim() || x.titre?.trim() || (x.type ? NOMS_VUES[x.type] : null)
  if (nom) return nom
  return pdf ? `${nomPlan}, page ${page}` : nomPlan
}

/** Le nom d'une forme : son libellé, sinon son type et son rang. */
function nomDe(a: PlanAnnotation, rang: number, cle: CleClassification): string {
  if (a.type === 'repere') return nomDuRepere(a)
  const t = (a.proposition?.libelle ?? a.text ?? '').trim()
  if (t) return t
  const type = a.typeZone ?? null
  if (type && type !== 'autre') return `${NOMS_TYPES_ZONE[type]} ${rang}`
  return cle === 'libres' && natureDuTrace(a) === 'longueur' ? `Longueur ${rang}` : `Surface ${rang}`
}

const d = (cle: string, libelle: string, valeur: number, unite: UniteRecap): QuantiteDerivee => ({ cle, libelle, valeur, unite })

interface Brute {
  a: PlanAnnotation
  planId: string
  page: number
  cle: CleClassification
  nature: 'surface' | 'longueur' | 'comptage'
  valeur: number | null
  echelle: number | null
  aValider: boolean
  brouillon?: boolean
}

export function panneauDesQuantites(jeu: PlanPourQuantites[], options: OptionsQuantites = {}): PanneauQuantites {
  const hauteurDefaut = options.hauteurDuDossier && options.hauteurDuDossier > 0 ? options.hauteurDuDossier : HAUTEUR_PAR_DEFAUT
  const etagesConnus = new Map<string, { planId: string; page: number; nom: string; mult: number; hauteur: number; reglee: boolean; ordre: number; vue: string | null }>()
  const brutes: Brute[] = []

  for (const [rangPlan, { plan, feuilles }] of jeu.entries()) {
    const pdf = estPdf(plan)
    const etage = (page: number) => {
      const cle = `${plan.id}#${page}`
      let e = etagesConnus.get(cle)
      if (!e) {
        const x = feuilleDe(feuilles, page)
        const reglee = x.hauteurEtage != null && x.hauteurEtage > 0
        e = {
          planId: plan.id, page, nom: nomDEtage(feuilles, page, plan.name, pdf), mult: multiplicateur(x),
          hauteur: reglee ? x.hauteurEtage! : hauteurDefaut, reglee, ordre: rangPlan * 100_000 + page, vue: x.type ?? null,
        }
        etagesConnus.set(cle, e)
      }
      return e
    }
    const annotations = [...(plan.annotations ?? [])]
    const b = options.brouillon
    if (b && b.planId === plan.id && b.points.length >= (b.nature === 'surface' ? 3 : 2)) {
      annotations.push({ id: '__brouillon', type: b.nature === 'surface' ? 'hatch' : 'measure', points: b.points, page: b.page, typeZone: b.typeZone ?? undefined, text: 'En cours de tracé' })
    }
    for (const a of annotations) {
      const cle = classificationDe(a)
      if (!cle) continue
      const page = pdf ? a.page ?? 1 : 1
      etage(page)
      const echelle = echelleDePage(plan, page)
      const nature = a.type === 'repere' ? 'comptage' : natureDuTrace(a) === 'surface' ? 'surface' : 'longueur'
      const valeur = nature === 'comptage'
        ? 1
        : !echelle ? null
          : nature === 'surface' ? aireDeLaForme(a) / (echelle * echelle) : longueurPolyligne(a.points) / echelle
      brutes.push({ a, planId: plan.id, page, cle, nature, valeur, echelle, aValider: enAttente(a), brouillon: a.id === '__brouillon' })
    }
  }

  // Une même fenêtre se voit sur le plan d'étage et sur l'élévation : quand
  // une catégorie est pointée sur des plans d'étage, ce sont eux qui font foi
  // (même règle que le récapitulatif de phase 1).
  const vueDe = (x: Brute) => etagesConnus.get(`${x.planId}#${x.page}`)?.vue ?? null
  const categoriesEnPlan = new Set<CategorieComptee>()
  for (const x of brutes) {
    if (x.cle === 'elements' && !x.aValider && vueDe(x) === 'plan_etage') categoriesEnPlan.add(x.a.repere!.categorie)
  }

  // Les ouvertures validées de chaque façade : celles dont le centre tombe dedans, sur la même feuille.
  const ouverturesDe = (f: Brute): number => {
    let s = 0
    for (const o of brutes) {
      if (o.planId !== f.planId || o.page !== f.page || o.aValider || o.valeur == null || o.nature !== 'surface') continue
      if (o.cle !== 'fenetres' && o.cle !== 'portes') continue
      if (pointDansPolygone(centreDeSurface(o.a.points), f.a.points)) s += o.valeur
    }
    return s
  }

  const rangs = new Map<string, number>()
  const instanceDe = (x: Brute, hauteur: number): InstanceQ => {
    const cleRang = `${x.planId}#${x.page}#${x.cle}`
    const rang = (rangs.get(cleRang) ?? 0) + 1
    rangs.set(cleRang, rang)
    const a = x.a
    const derivees: QuantiteDerivee[] = []
    if (x.valeur != null) {
      if (x.cle === 'pieces' && x.nature === 'surface' && x.echelle) {
        // Les plinthes font aussi le tour d'un poteau découpé dans la pièce.
        const tour = [a.points, ...(a.trous ?? [])].reduce((s, c) => s + longueurPolyligne([...c, c[0]]), 0)
        derivees.push(d('plinthes', 'Plinthes', tour / x.echelle, 'ml'))
      }
      if (x.cle === 'facades' && x.nature === 'surface') {
        const o = ouverturesDe(x)
        derivees.push(d('ouvertures', 'Ouvertures', o, 'm²'), d('nette', 'Nette', x.valeur - o, 'm²'))
      }
      if (x.cle === 'murs' && x.nature === 'longueur') derivees.push(d('face', 'Face', x.valeur * hauteur, 'm²'))
    }
    const categorie = a.repere?.categorie
    const horsTotal = x.cle === 'elements' && !x.aValider && categorie && categoriesEnPlan.has(categorie) && vueDe(x) !== 'plan_etage'
      ? 'déjà compté sur un plan d’étage'
      : null
    const def = CLASSIFICATION[x.cle]
    return {
      id: a.id,
      planId: x.planId,
      page: x.page,
      nom: nomDe(a, rang, x.cle),
      nature: x.nature,
      valeur: x.valeur,
      unite: x.nature === 'comptage' ? 'pce' : x.nature === 'surface' ? 'm²' : 'ml',
      derivees,
      aValider: x.aValider,
      horsTotal,
      confiance: a.proposition?.confiance ?? null,
      couleur: categorie ? COULEURS_CATEGORIE[categorie] : a.proposition ? def.couleur : a.color ?? def.couleur,
      typeZone: a.proposition?.type ?? a.typeZone ?? null,
      ...(categorie ? { categorie } : {}),
      ...(a.sia416 ? { sia416: a.sia416 } : {}),
      ...(x.brouillon ? { brouillon: true } : {}),
    }
  }

  const classifications: ClassificationQ[] = []
  let aValiderTotal = 0
  let sansEchelleTotal = 0
  for (const def of CLASSIFICATIONS) {
    const siennes = brutes.filter((x) => x.cle === def.cle)
    if (!siennes.length) continue
    const parEtage = new Map<string, Brute[]>()
    for (const x of siennes) {
      const k = `${x.planId}#${x.page}`
      parEtage.set(k, [...(parEtage.get(k) ?? []), x])
    }
    const etages: EtageQ[] = [...parEtage.entries()]
      .sort((p, q) => etagesConnus.get(p[0])!.ordre - etagesConnus.get(q[0])!.ordre)
      .map(([k, xs]) => {
        const e = etagesConnus.get(k)!
        const instances = xs.map((x) => instanceDe(x, e.hauteur))
        const comptent = instances.filter((i) => !i.aValider && !i.horsTotal && i.valeur != null)
        return {
          cle: k, planId: e.planId, page: e.page, rang: e.ordre, nom: e.nom, multiplicateur: e.mult, hauteur: e.hauteur, hauteurReglee: e.reglee,
          instances,
          derivees: deriveesDe(def.cle, comptent, e.mult),
          aValider: instances.filter((i) => i.aValider).length,
        }
      })
    const toutes = etages.flatMap((e) => e.instances.filter((i) => !i.aValider && !i.horsTotal && i.valeur != null).map((i) => ({ i, mult: e.multiplicateur })))
    const aValider = siennes.filter((x) => x.aValider).length
    const sansEchelle = siennes.filter((x) => !x.aValider && x.valeur == null).length
    aValiderTotal += aValider
    sansEchelleTotal += sansEchelle
    classifications.push({
      ...def,
      etages,
      derivees: deriveesPonderees(def.cle, toutes),
      aValider,
      sansEchelle,
      nombre: siennes.filter((x) => !x.brouillon).length,
    })
  }
  return { classifications, aValider: aValiderTotal, sansEchelle: sansEchelleTotal }
}

function deriveesDe(cle: CleClassification, instances: InstanceQ[], mult: number): QuantiteDerivee[] {
  return deriveesPonderees(cle, instances.map((i) => ({ i, mult })))
}

/** Les totaux d'une classification ou d'un étage, chaque forme multipliée par les étages identiques de sa feuille. */
function deriveesPonderees(cle: CleClassification, xs: { i: InstanceQ; mult: number }[]): QuantiteDerivee[] {
  const sum = (f: (i: InstanceQ) => number | null | undefined) => xs.reduce((s, { i, mult }) => s + (f(i) ?? 0) * mult, 0)
  const der = (i: InstanceQ, k: string) => i.derivees.find((x) => x.cle === k)?.valeur
  const nombre = (f: (i: InstanceQ) => boolean = () => true) => xs.reduce((s, { i, mult }) => s + (f(i) ? mult : 0), 0)
  const surfaces = (i: InstanceQ) => (i.nature === 'surface' ? i.valeur : 0)
  const longueurs = (i: InstanceQ) => (i.nature === 'longueur' ? i.valeur : 0)
  switch (cle) {
    case 'pieces':
      return [d('surface', 'Sol', sum(surfaces), 'm²'), d('plinthes', 'Plinthes', sum((i) => der(i, 'plinthes')), 'ml'), d('nombre', 'Pièces', nombre(), 'pce')]
    case 'facades':
      return [d('brute', 'Brute', sum(surfaces), 'm²'), d('ouvertures', 'Ouvertures', sum((i) => der(i, 'ouvertures')), 'm²'), d('nette', 'Nette', sum((i) => der(i, 'nette')), 'm²')]
    case 'fenetres':
    case 'portes':
      return [d('nombre', 'Nombre', nombre(), 'pce'), d('surface', 'Surface', sum(surfaces), 'm²')]
    case 'toiture':
      return [d('surface', 'Surface', sum(surfaces), 'm²')]
    case 'dalles': {
      const emprise = sum((i) => (i.typeZone === 'emprise' ? surfaces(i) : 0))
      const dalle = sum((i) => (i.typeZone !== 'emprise' ? surfaces(i) : 0))
      const r = [d('emprise', 'Emprise', emprise, 'm²'), d('dalle', 'Dalles', dalle, 'm²')]
      return emprise === 0 && dalle > 0 ? r.reverse() : r
    }
    case 'murs':
      return [d('longueur', 'Longueur', sum(longueurs), 'ml'), d('face', 'Face', sum((i) => der(i, 'face')), 'm²'), ...(sum(surfaces) > 0 ? [d('surface', 'Surfaces', sum(surfaces), 'm²')] : [])]
    case 'elements':
      return [
        d('nombre', 'Nombre', nombre(), 'pce'),
        ...CLES_CATEGORIES
          .map((c) => d(`cat-${c}`, CATEGORIE[c].libelle, nombre((i) => i.categorie === c), 'pce'))
          .filter((x) => x.valeur > 0),
      ]
    case 'libres': {
      const s = sum(surfaces), l = sum(longueurs)
      const r = [d('surface', 'Surfaces', s, 'm²'), d('longueur', 'Longueurs', l, 'ml')]
      return s === 0 && l > 0 ? r.reverse() : r
    }
  }
}

// ---------------------------------------------------------------- lecture

const NOMBRE = new Intl.NumberFormat('fr-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const ENTIER = new Intl.NumberFormat('fr-CH', { maximumFractionDigits: 0 })

/** « 1 234,56 m² », « 18 pce » : au centième pour ce qui se mesure, entier pour ce qui se compte. */
export function quantiteLisible(v: number, unite: UniteRecap): string {
  return `${unite === 'pce' ? ENTIER.format(v) : NOMBRE.format(v)} ${unite}`
}

// ---------------------------------------------------------------- filtrer et trier

const comparable = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export type TriQuantites = 'nom' | 'quantite'

/**
 * Le panneau filtré par nom et trié. La recherche garde les formes dont le
 * nom, l'étage ou la classification contient le texte ; une classification
 * ou un étage sans forme retenue disparaît. Les totaux, eux, restent ceux du
 * jeu entier : filtrer ne change pas ce qui est mesuré.
 */
export function filtrerEtTrier(classifications: ClassificationQ[], recherche: string, tri: TriQuantites): ClassificationQ[] {
  const q = comparable(recherche.trim())
  const ordre = (a: InstanceQ, b: InstanceQ) => (tri === 'nom'
    ? a.nom.localeCompare(b.nom, 'fr', { numeric: true })
    : (b.valeur ?? -1) - (a.valeur ?? -1))
  return classifications.flatMap((c) => {
    const titreRetenu = !q || comparable(c.titre).includes(q)
    const etages = c.etages.flatMap((e) => {
      const etageRetenu = titreRetenu || comparable(e.nom).includes(q)
      const instances = e.instances.filter((i) => etageRetenu || comparable(i.nom).includes(q)).sort(ordre)
      return instances.length ? [{ ...e, instances }] : []
    })
    return etages.length ? [{ ...c, etages }] : []
  })
}

// ---------------------------------------------------------------- SIA 416

/**
 * Ce que chaque feuille apporte aux surfaces SIA 416 : ses emprises, ses
 * dalles et ses pièces validées, mesurées. Une proposition n'y entre pas, une
 * forme sans échelle non plus.
 */
export function entreesSia416(panneau: PanneauQuantites): EntreeEtageSia416[] {
  const parEtage = new Map<string, EntreeEtageSia416 & { rang: number }>()
  const entree = (e: EtageQ) => {
    let x = parEtage.get(e.cle)
    if (!x) { x = { cle: e.cle, nom: e.nom, multiplicateur: e.multiplicateur, emprises: [], dalles: [], pieces: [], rang: e.rang }; parEtage.set(e.cle, x) }
    return x
  }
  for (const c of panneau.classifications) {
    if (c.cle !== 'pieces' && c.cle !== 'dalles') continue
    for (const e of c.etages) {
      for (const i of e.instances) {
        if (i.aValider || i.brouillon || i.valeur == null || i.nature !== 'surface') continue
        const x = entree(e)
        if (c.cle === 'pieces') x.pieces.push({ id: i.id, nom: i.nom, surface: i.valeur, affectation: i.sia416 ?? null })
        else if (i.typeZone === 'emprise') x.emprises.push(i.valeur)
        else x.dalles.push(i.valeur)
      }
    }
  }
  // Dans l'ordre des feuilles du jeu.
  return [...parEtage.values()].sort((a, b) => a.rang - b.rang)
    .map((e) => ({ cle: e.cle, nom: e.nom, multiplicateur: e.multiplicateur, emprises: e.emprises, dalles: e.dalles, pieces: e.pieces }))
}

// ---------------------------------------------------------------- recherche d'une forme

/** La forme d'un identifiant, et ce que le panneau en dit. */
export function trouverInstance(panneau: PanneauQuantites, id: string): { classification: ClassificationQ; etage: EtageQ; instance: InstanceQ } | null {
  for (const c of panneau.classifications) {
    for (const e of c.etages) {
      const i = e.instances.find((x) => x.id === id)
      if (i) return { classification: c, etage: e, instance: i }
    }
  }
  return null
}
