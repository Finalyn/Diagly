/**
 * Commencer avec des plans : de la lecture relue aux champs du dossier.
 *
 * L'IA lit sur les plans les grandeurs dont les métrés partent (emprise,
 * périmètre, étages, hauteur d'étage, vitrages…). Le diagnostiqueur les relit
 * et peut corriger chacune ; ce module traduit ce qu'il a retenu dans les
 * champs exacts du formulaire de création (ProjectNew) et du schéma du
 * serveur (routes/projects.ts). Une valeur que le dossier refuserait (un
 * nombre d'étages non entier, une surface négative) ne remplit rien : le
 * champ reste à saisir plutôt que de faire échouer la création.
 */
import type { CleGrandeurPlans, ElementCompteLu, GrandeurLue, LecturePlans, RoofType } from './api-types'
import { CLES_CATEGORIES, NOMBRE_MAX, type CategorieComptee, type Comptages } from './base-cfc/comptages'

/** Les champs du dossier que des plans remplissent, sous leurs noms du formulaire et du serveur. */
export interface ChampsDesPlans {
  builtArea?: number
  perimeter?: number
  nbFloors?: number
  floorHeight?: number
  floorArea?: number
  facadeArea?: number
  /** Part vitrée en fraction (0,3), comme le formulaire la tient ; il l'envoie en pourcent. */
  windowPct?: number
  nbApartments?: number
  nbStaircases?: number
  roofType?: RoofType
  apartmentTypes?: Record<string, number>
}

/** Une grandeur proposée à la relecture, et le champ du dossier qu'elle remplit. */
export interface GrandeurAffichee {
  cle: CleGrandeurPlans
  libelle: string
  unite: string
  entier?: boolean
  /** Sans champ, la grandeur est montrée pour information : le dossier n'a pas où la ranger. */
  champ?: keyof ChampsDesPlans
}

/** Dans l'ordre où un métreur les donne : le bâtiment, ses façades, ses logements. */
export const GRANDEURS_DES_PLANS: GrandeurAffichee[] = [
  { cle: 'emprise', libelle: 'Emprise au sol', unite: 'm²', champ: 'builtArea' },
  { cle: 'perimetre', libelle: 'Périmètre des façades', unite: 'm', champ: 'perimeter' },
  { cle: 'etagesHorsSol', libelle: 'Étages hors sol', unite: '', entier: true, champ: 'nbFloors' },
  { cle: 'hauteurEtage', libelle: 'Hauteur d’étage', unite: 'm', champ: 'floorHeight' },
  { cle: 'surfacePlancher', libelle: 'Surface de plancher', unite: 'm²', champ: 'floorArea' },
  { cle: 'surfaceFacade', libelle: 'Surface de façade', unite: 'm²', champ: 'facadeArea' },
  { cle: 'tauxVitrage', libelle: 'Taux de vitrage', unite: '%', champ: 'windowPct' },
  { cle: 'logements', libelle: 'Logements', unite: '', entier: true, champ: 'nbApartments' },
  { cle: 'cagesEscalier', libelle: 'Cages d’escalier', unite: '', entier: true, champ: 'nbStaircases' },
  { cle: 'sousSols', libelle: 'Sous-sols', unite: '', entier: true },
  { cle: 'hauteurTotale', libelle: 'Hauteur totale', unite: 'm' },
  { cle: 'surfaceFenetres', libelle: 'Surface des fenêtres', unite: 'm²' },
  { cle: 'surfaceToiture', libelle: 'Surface de toiture', unite: 'm²' },
]

/** Ce que le diagnostiqueur retient à la relecture, corrections comprises. */
export interface ValeursRetenues {
  grandeurs: Record<CleGrandeurPlans, number | null>
  typeToit: RoofType | null
  typologies: Record<string, number> | null
  /** Le nombre retenu pour chaque catégorie d'éléments comptés ; null = non compté. */
  elements: Partial<Record<CategorieComptee, number | null>>
  /** Les comptes que le diagnostiqueur a vérifiés sans les changer. */
  confirmes: CategorieComptee[]
}

export function valeursInitiales(l: LecturePlans): ValeursRetenues {
  const grandeurs = Object.fromEntries(
    GRANDEURS_DES_PLANS.map((g) => [g.cle, l.grandeurs[g.cle]?.valeur ?? null]),
  ) as Record<CleGrandeurPlans, number | null>
  const elements = Object.fromEntries(CLES_CATEGORIES.map((c) => [c, l.elements?.[c]?.nombre ?? null]))
  return { grandeurs, typeToit: l.typeToit.valeur, typologies: l.typologies.valeur, elements, confirmes: [] }
}

/**
 * Les éléments comptés à enregistrer au dossier, depuis ce qui a été relu.
 *
 * Un compte lu sur les plans y entre avec sa source, ses pages et son calcul,
 * tenu pour « à vérifier » tant que le diagnostiqueur ne l'a ni confirmé ni
 * corrigé. Corrigé, il perd le calcul de l'IA, qui ne décrit plus le nombre
 * retenu, et le dit. Un nombre que les plans n'avaient pas donné est une
 * saisie.
 */
export function comptagesDepuisPlans(l: LecturePlans, v: ValeursRetenues, noms: string[]): Comptages {
  const r: Comptages = {}
  const majLe = new Date().toISOString()
  for (const cle of CLES_CATEGORIES) {
    const n = v.elements[cle]
    if (n === null || n === undefined || !Number.isInteger(n) || n < 0 || n > NOMBRE_MAX) continue
    const lu: ElementCompteLu | undefined = l.elements?.[cle]
    const luSurLesPlans = lu?.nombre != null
    const corrige = luSurLesPlans && lu!.nombre !== n
    r[cle] = {
      categorie: cle,
      nombre: n,
      surface: cle === 'fenetre' && luSurLesPlans && !corrige ? lu!.surface : null,
      source: luSurLesPlans ? 'plans' : 'saisie',
      detail: corrige ? `Corrigé à la relecture ; lu sur les plans : ${lu!.nombre}` : luSurLesPlans ? lu!.detail : null,
      pages: luSurLesPlans ? lu!.pages.map((pg) => lieuDeLaPage(pg, noms) ?? pg) : [],
      confiance: luSurLesPlans && !corrige ? lu!.confiance : null,
      valide: !luSurLesPlans || corrige || v.confirmes.includes(cle),
      majLe,
    }
  }
  return r
}

/** Un compte à regarder de près : estimé, ou lu avec une confiance basse. */
export const elementAVerifier = (e: ElementCompteLu | undefined): boolean =>
  !!e && e.nombre !== null && (e.methode === 'estimation' || e.confiance === 'basse')

const positif = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0
const entierAuMoins = (v: number | null | undefined, min: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min

/**
 * Les champs du dossier, depuis les valeurs retenues.
 *
 * Le taux de vitrage se déduit des surfaces de fenêtres et de façade quand il
 * manque : c'est le même calcul que la lecture aurait fait, sur des valeurs
 * que le diagnostiqueur vient de relire.
 */
export function champsDepuisPlans(v: ValeursRetenues): ChampsDesPlans {
  const g = v.grandeurs
  const c: ChampsDesPlans = {}
  if (positif(g.emprise)) c.builtArea = g.emprise
  if (positif(g.perimetre)) c.perimeter = g.perimetre
  if (entierAuMoins(g.etagesHorsSol, 1)) c.nbFloors = g.etagesHorsSol
  if (positif(g.hauteurEtage)) c.floorHeight = g.hauteurEtage
  if (positif(g.surfacePlancher)) c.floorArea = g.surfacePlancher
  if (positif(g.surfaceFacade)) c.facadeArea = g.surfaceFacade
  if (entierAuMoins(g.logements, 0)) c.nbApartments = g.logements
  if (entierAuMoins(g.cagesEscalier, 0)) c.nbStaircases = g.cagesEscalier

  const taux = positif(g.tauxVitrage)
    ? g.tauxVitrage
    : positif(g.surfaceFenetres) && positif(g.surfaceFacade) ? (g.surfaceFenetres / g.surfaceFacade) * 100 : null
  if (taux !== null && taux > 0 && taux <= 100) c.windowPct = Math.round(taux * 10) / 1000

  if (v.typeToit) c.roofType = v.typeToit
  if (v.typologies) {
    const types = Object.fromEntries(
      Object.entries(v.typologies).filter(([k, n]) => /^[0-9]+(\.5)?$/.test(k) && entierAuMoins(n, 0)),
    )
    if (Object.keys(types).length) c.apartmentTypes = types
  }
  return c
}

/**
 * Le repère d'une page avec le nom de son fichier : « F2 p. 3 » devient
 * « coupe.pdf, p. 3 ». Les noms sont ceux des fichiers déposés, dans l'ordre
 * de l'envoi. Un repère qui ne suit pas cette forme reste tel quel.
 */
export function lieuDeLaPage(page: string | null, noms: string[]): string | null {
  if (!page) return null
  const m = page.match(/^F(\d+)(?: p\. (\d+))?$/)
  const nom = m ? noms[Number(m[1]) - 1] : undefined
  if (!m || !nom) return page
  // Une image n'a qu'une page : son numéro n'apprend rien.
  return m[2] && /\.pdf$/i.test(nom) ? `${nom}, p. ${m[2]}` : nom
}

/** Une valeur à vérifier de près : estimée, ou lue avec une confiance basse. */
export const aVerifier = (g: GrandeurLue<unknown> | undefined): boolean =>
  !!g && g.valeur !== null && (g.methode === 'estimation' || g.confiance === 'basse')
