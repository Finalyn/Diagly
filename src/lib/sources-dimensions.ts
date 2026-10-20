/**
 * D'où vient chaque dimension de la fiche du bâtiment.
 *
 * Les métrés tirés des plans valent mieux qu'un ratio du registre : quand les
 * plans d'un dossier sont analysés et leurs formes validées, la surface de
 * plancher, la surface bâtie, la façade, la toiture et la part vitrée qu'ils
 * donnent remplacent les valeurs de la fiche, avec la mention « issu des
 * plans ». Les quantités du devis qui en dépendent suivent (quantite-comptee.ts,
 * recalculsDuBatiment).
 *
 * Une valeur corrigée à la main l'emporte, mais seulement tant que les plans
 * ne changent pas : la source garde la valeur que les plans donnaient, et une
 * nouvelle analyse qui en donne une autre reprend la main. Sans cela, une
 * correction d'un jour figerait le dossier contre toutes les mesures suivantes.
 */
import type { ApiProject, DimensionSuivie, SourceDimension, SourcesDimensions } from './api-types'
import type { PanneauQuantites } from './plans/quantites'
import type { Sia416 } from './plans/sia416'
import { rangDuNiveau } from './plans/presentation'
import { computeProjectMetrics, type ProjectGeometry } from './formulas'

/** Ce qu'on dit d'une source dans la fiche et dans le rapport. */
export const LIBELLE_SOURCE: Record<SourceDimension, string> = {
  plans: 'issu des plans',
  registre: 'registre des bâtiments et ratios',
  saisie: 'saisi au dossier',
  defaut: 'valeur par défaut',
}

/** La source d'une dimension, quand le dossier la connaît. */
export function sourceDe(
  project: Pick<ApiProject, 'sources'> | null | undefined,
  champ: DimensionSuivie,
): SourceDimension | null {
  return project?.sources?.[champ]?.source ?? null
}

/** Les dimensions que les plans donnent, arrondies comme la fiche les garde. */
export type DimensionsDesPlans = Partial<Record<DimensionSuivie, number>>

const valeurDe = (panneau: PanneauQuantites, classification: string, cle: string): number | null => {
  const c = panneau.classifications.find((x) => x.cle === classification)
  const d = c?.derivees.find((x) => x.cle === cle)
  return d && d.valeur > 0 ? d.valeur : null
}

const arrondi = (v: number, decimales = 0) => {
  const f = 10 ** decimales
  return Math.round(v * f) / f
}

/**
 * Les dimensions du bâtiment tirées des métrés validés.
 *
 * Seules les formes validées et mises à l'échelle comptent (le panneau les
 * trie déjà). Une dimension que les plans ne donnent pas n'apparaît pas : on
 * ne remplace pas une valeur de la fiche par un zéro.
 */
export function dimensionsDesPlans(panneau: PanneauQuantites, sia: Sia416 | null): DimensionsDesPlans {
  const d: DimensionsDesPlans = {}

  if (sia?.total.sp != null && sia.total.sp > 0) d.floorArea = arrondi(sia.total.sp)

  // L'emprise : la plus grande dalle d'un niveau hors sol, pour un seul étage.
  const dalles = panneau.classifications.find((x) => x.cle === 'dalles')
  if (dalles) {
    const emprises = dalles.etages
      .map((e) => {
        const v = e.derivees.find((x) => x.cle === 'emprise')?.valeur
        const rang = rangDuNiveau(e.nom)
        return v && v > 0 ? { valeur: v / Math.max(1, e.multiplicateur), horsSol: rang == null || rang >= 0 } : null
      })
      .filter((x): x is { valeur: number; horsSol: boolean } => x !== null)
    const retenues = emprises.some((x) => x.horsSol) ? emprises.filter((x) => x.horsSol) : emprises
    if (retenues.length > 0) d.builtArea = arrondi(Math.max(...retenues.map((x) => x.valeur)))
  }

  const facade = valeurDe(panneau, 'facades', 'brute')
  if (facade) {
    d.facadeArea = arrondi(facade)
    const ouvertures = valeurDe(panneau, 'facades', 'ouvertures') ?? valeurDe(panneau, 'fenetres', 'surface')
    if (ouvertures) d.windowPct = arrondi(Math.min(100, ouvertures / facade * 100), 1)
  }

  const toiture = valeurDe(panneau, 'toiture', 'surface')
  if (toiture) d.roofArea = arrondi(toiture)

  // Les étages hors sol qui portent une surface de plancher, étages identiques compris.
  if (sia && sia.etages.length > 0) {
    const horsSol = sia.etages.filter((e) => {
      const rang = rangDuNiveau(e.nom)
      return e.sp != null && e.sp > 0 && rang != null && rang >= 0 && rang < 60
    })
    const n = horsSol.reduce((s, e) => s + Math.max(1, e.multiplicateur), 0)
    if (n > 0) d.nbFloors = n
  }

  return d
}

const proche = (a: number | null | undefined, b: number) =>
  a != null && Math.abs(a - b) <= Math.max(0.5, Math.abs(b) * 0.001)

export interface MiseAJourDepuisPlans {
  patch: Partial<Pick<ApiProject, 'floorArea' | 'builtArea' | 'facadeArea' | 'windowPct' | 'roofArea' | 'nbFloors'>>
  sources: SourcesDimensions
  /** Les dimensions remplacées, pour le dire à l'écran. */
  champs: DimensionSuivie[]
  /**
   * Les mesures écartées parce que les plans semblent incomplets : une seule
   * élévation tracée donne une façade de 97 m² pour un immeuble qui en a 600.
   */
  ecartees: { champ: DimensionSuivie; plans: number; fiche: number }[]
}

/**
 * En dessous de cette part de la valeur de la fiche, une surface tirée des
 * plans est tenue pour incomplète (une façade sur quatre, deux étages sur
 * cinq) et n'est pas reportée. Au-dessus, les plans l'emportent, même s'ils
 * donnent moins : c'est le registre qui se trompe le plus souvent.
 */
export const PART_MINIMALE_DES_PLANS = 0.6

/** Les surfaces qu'un jeu de plans incomplet sous-estime. */
const SURFACES: DimensionSuivie[] = ['floorArea', 'builtArea', 'facadeArea', 'roofArea', 'nbFloors']

/**
 * Ce que les plans changent dans la fiche, ou null s'ils ne changent rien.
 *
 * Une dimension corrigée à la main garde sa valeur tant que les plans donnent
 * la même mesure qu'au moment de la correction.
 */
export function miseAJourDepuisPlans(
  project: Pick<ApiProject, 'sources' | 'floorArea' | 'builtArea' | 'facadeArea' | 'windowPct' | 'roofArea' | 'nbFloors'> & ProjectGeometry,
  dims: DimensionsDesPlans,
  maintenant = new Date().toISOString(),
): MiseAJourDepuisPlans | null {
  const sources: SourcesDimensions = { ...(project.sources ?? {}) }
  const patch: MiseAJourDepuisPlans['patch'] = {}
  const champs: DimensionSuivie[] = []
  const ecartees: MiseAJourDepuisPlans['ecartees'] = []
  // Ce que la fiche donne aujourd'hui : la façade et la toiture se calculent,
  // elles ne sont pas toujours écrites.
  const metrics = computeProjectMetrics(project)
  const fiche = (champ: DimensionSuivie): number | null | undefined =>
    champ === 'facadeArea' ? metrics.facade || null
    : champ === 'roofArea' ? metrics.roof
    : project[champ as keyof typeof project] as number | null | undefined
  // La façade et la part vitrée vont ensemble : une façade écartée emporte sa part vitrée.
  const ref = fiche('facadeArea')
  const facadeEcartee = dims.facadeArea != null && ref != null && ref > 0
    && sources.facadeArea?.source !== 'plans' && dims.facadeArea < ref * PART_MINIMALE_DES_PLANS

  for (const [champ, valeur] of Object.entries(dims) as [keyof MiseAJourDepuisPlans['patch'], number][]) {
    const s = sources[champ]
    const actuelle = project[champ] as number | null | undefined
    const enFiche = fiche(champ)
    // Une valeur déjà tirée des plans suit les plans ; une valeur venue
    // d'ailleurs ne cède qu'à une mesure plausible.
    if (s?.source !== 'plans' && SURFACES.includes(champ) && enFiche != null && enFiche > 0 && valeur < enFiche * PART_MINIMALE_DES_PLANS) {
      ecartees.push({ champ, plans: valeur, fiche: Math.round(enFiche) })
      continue
    }
    if (champ === 'windowPct' && facadeEcartee) continue
    if (s?.source === 'saisie' && s.valeur != null && proche(s.valeur, valeur)) continue
    if (s?.source === 'plans' && proche(actuelle, valeur) && proche(s.valeur, valeur)) continue
    if (!proche(actuelle, valeur)) {
      ;(patch as Record<string, number>)[champ] = valeur
      champs.push(champ)
    }
    sources[champ] = { source: 'plans', valeur, majLe: maintenant }
  }

  const sourcesChangent = JSON.stringify(sources) !== JSON.stringify(project.sources ?? {})
  if (champs.length === 0 && !sourcesChangent) return ecartees.length > 0 ? { patch, sources, champs, ecartees } : null
  return { patch, sources, champs, ecartees }
}

/**
 * Les sources après une correction à la main de la fiche.
 *
 * La dimension passe en « saisi au dossier », et garde la mesure que les
 * plans donnaient : c'est elle qui dira si une nouvelle analyse a changé.
 */
export function sourcesApresSaisie(
  project: Pick<ApiProject, 'sources'>,
  champs: DimensionSuivie[],
): SourcesDimensions {
  const sources: SourcesDimensions = { ...(project.sources ?? {}) }
  for (const champ of champs) {
    const avant = sources[champ]
    sources[champ] = { source: 'saisie', ...(avant?.valeur != null ? { valeur: avant.valeur } : {}) }
  }
  return sources
}

export { facadeMesuree } from './formulas'
