/**
 * Démarrer un diagnostic depuis un fichier : ce qui reste de la lecture une
 * fois relue, et sa conversion en relevés.
 *
 * Les relevés se construisent exactement comme dans l'éditeur (voir
 * DiagnosticDetail, addItem) : l'article dans son étape donne l'ouvrage, la
 * fiche du bâtiment donne la quantité, l'état donne le coût, les travaux et la
 * priorité. Un élément sans état reste « non évalué » : ni coût ni priorité
 * tant que le diagnostiqueur ne l'a pas vu.
 */
import type { ApiBaseCfc, ApiDiagnosticItem, ApiProject, BatimentLu, ElementState, EnergieLue } from './api-types'
import { ouvrageDeLArticle, resolutionDeQuantite } from './base-cfc/pont'
import { donneesDuBatiment } from './base-cfc/batiment'
import { localisationDeLaZone } from './base-cfc/catalogue'
import { computeCost, workForState, STATE_PRIORITY } from './diagnostic-auto'
import type { ChampsDesPlans } from './demarrage-plans'

export type SourceImport = 'document' | 'cecb'

/**
 * Ce qu'il faut savoir des valeurs publiques, dit au moment du choix et
 * redit à l'étape des surfaces : les registres donnent un ordre de grandeur,
 * pas une mesure, et tous les métrés du dossier en découlent.
 */
export const AVERTISSEMENT_VALEURS_PUBLIQUES =
  'Les valeurs publiques sont des estimations (périmètre déduit de l’emprise, hauteur d’étage et vitrages par défaut) : les métrés qui en découlent sont approximatifs. Vérifiez-les ou remplacez-les par vos mesures.'

/** Un départ depuis des plans : les mesures retenues, et les fichiers à ranger dans le dossier une fois créé. */
export interface PlansRetenus {
  fichiers: File[]
  champs: ChampsDesPlans
}

/** Un relevé retenu à la relecture. */
export interface ReleveRetenu {
  articleId: string
  etapeNumero: number
  etat: ElementState | null
  remarque: string | null
  annee: number | null
  /** Libellé d'origine, gardé en note pour retrouver la source. */
  source: string
}

/** Ce que la relecture transmet à l'assistant de création. */
export interface ImportPret {
  source: SourceImport | 'plans'
  fichier: string
  batiment: BatimentLu
  energie: EnergieLue | null
  mesures: { label: string; priorite: string | null }[]
  confiance: 'high' | 'medium' | 'low' | null
  releves: ReleveRetenu[]
  /** Seulement pour un départ depuis des plans. */
  plans?: PlansRetenus
}

/** La classe d'une étiquette, réduite à sa lettre (« Classe E » → « E »). */
export const lettreDeClasse = (v: string | null | undefined) => {
  const m = (v ?? '').toUpperCase().match(/[A-G]/)
  return m ? m[0] : null
}

/** Les champs du dossier que porte un certificat (création du projet). */
export function champsEnergie(imp: ImportPret) {
  const e = imp.energie
  if (!e) return {}
  const date = e.dateCertificat && !Number.isNaN(new Date(e.dateCertificat).getTime()) ? new Date(e.dateCertificat).toISOString() : undefined
  return {
    sre: e.sre ?? undefined,
    energyConsumptionHeat: e.consumptionHeat ?? undefined,
    energyConsumptionElec: e.consumptionElec ?? undefined,
    energyAgent: e.energyAgent?.slice(0, 120) || undefined,
    energyClassEnvelope: lettreDeClasse(e.classEnvelope) ?? undefined,
    energyClassGlobal: lettreDeClasse(e.classGlobal) ?? undefined,
    energyRefYear: e.refYear ?? undefined,
    energySource: 'Certificat énergétique (import)',
    energyCertDate: date,
    energyData: { measures: imp.mesures.map((m) => ({ label: m.label, priority: m.priorite ?? undefined })), confidence: imp.confiance },
  }
}

/**
 * Les relevés à créer. Un même article dans la même étape ne fait qu'un relevé :
 * le document peut en parler deux fois, les remarques se cumulent.
 */
export function relevesPourLeDiagnostic(imp: ImportPret, base: ApiBaseCfc, projet: ApiProject): Partial<ApiDiagnosticItem>[] {
  const batiment = donneesDuBatiment(projet)
  const parCle = new Map<string, { r: ReleveRetenu; notes: string[] }>()
  for (const r of imp.releves) {
    const cle = `${r.articleId}@${r.etapeNumero}`
    const note = [r.source && `« ${r.source} »`, r.remarque].filter(Boolean).join(' : ')
    const deja = parCle.get(cle)
    if (deja) { if (note) deja.notes.push(note); continue }
    parCle.set(cle, { r, notes: note ? [note] : [] })
  }

  const origine = imp.source === 'cecb' ? `Mesure du certificat énergétique « ${imp.fichier} », à vérifier sur place.` : `Repris de « ${imp.fichier} ».`
  const items: Partial<ApiDiagnosticItem>[] = []
  for (const { r, notes } of parCle.values()) {
    const article = base.articles.find((a) => a.id === r.articleId)
    if (!article) continue
    const etape = base.etapes.find((e) => e.numero === r.etapeNumero)
    const catalog = ouvrageDeLArticle(article, r.etapeNumero)
    const quantity = resolutionDeQuantite(catalog, batiment).quantity
    const state = r.etat
    const cost = state ? computeCost(catalog, state, quantity) : undefined
    const work = state ? workForState(catalog, state) : null
    items.push({
      cfcCode: catalog.cfcCode,
      cfcLabel: catalog.description,
      articleId: catalog.articleId,
      etapeNumero: r.etapeNumero,
      localisation: etape ? localisationDeLaZone(etape.zone) : null,
      state: state ?? null,
      priority: state ? STATE_PRIORITY[state] : null,
      works: work && work !== 'Néant' ? [work] : [],
      photos: [],
      sharePct: null,
      area: quantity && quantity > 0 ? quantity : null,
      unit: catalog.unit,
      estimatedCost: (cost ?? undefined) as unknown as string | undefined,
      // Le serveur borne l'année (1500 à 2100) et ne prend pas null : on omet.
      yearInstalled: r.annee && r.annee >= 1500 && r.annee <= 2100 ? r.annee : undefined,
      notes: [...notes, origine].join('\n'),
    })
  }
  return items
}
