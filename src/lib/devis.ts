/**
 * Construction du devis, à la maille CFC 3 chiffres, groupé par priorité.
 *
 * Ce module tient les règles de chiffrage qui viennent du classeur du bureau
 * (DIAGLY_FINAL, Feuil2) et non de la saisie du diagnostiqueur :
 *
 *  - un ouvrage peut porter jusqu'à trois enveloppes distinctes (réparation,
 *    amélioration, remise aux normes), chacune avec son prix dans le catalogue.
 *    Elles deviennent trois lignes de devis, pas une somme opaque ;
 *  - trois postes s'ajoutent d'office à tout devis, d'après la « note générale
 *    importante » du classeur : nettoyage, protection des ouvrages, et un
 *    échafaudage de cage d'escalier dès qu'un revêtement de mur ou de plafond
 *    est en fin de vie.
 *
 * Le calcul est ici, hors des composants, pour être vérifiable par des tests :
 * un devis faux ne se voit pas à l'écran, il se voit chez le client.
 */
import { appliedUnitPrice, getMarketCoeff } from './diagnostic-auto'
import { cfcPositionCode } from './cfc'
import { suffixeLocalisation } from './localisation'
import type { ApiCatalogItem, ApiDiagnosticItem, Priority } from './api-types'

/** TVA suisse appliquée au sous-total travaux + honoraires + réserve. */
export const TVA = 0.081

/** Ordre de lecture du devis : le plus urgent d'abord. */
export const PRIORITES: Priority[] = ['I', 'II', 'III']

/**
 * Horizon d'intervention associé à chaque priorité, dit en clair dans le devis.
 * Barème du bureau : 0-5 ans, 5-10 ans, au-delà de 10 ans.
 */
export const HORIZON: Record<Priority, string> = {
  I: '0 à 5 ans',
  II: '5 à 10 ans',
  III: 'au-delà de 10 ans',
}

/**
 * Postes que le classeur impose dans tout devis, quel que soit le diagnostic.
 * Les montants sont des prix catalogue : ils suivent l'indice comme les autres.
 */
export const POSTES_AUTOMATIQUES = {
  /** CFC 287 — nettoyage complet de l'immeuble, au m² de surface de plancher. */
  nettoyage: { cfc: '287', prixParM2: 10 },
  /** CFC 101 — protection des ouvrages existants, forfait global. */
  protection: { cfc: '101', forfait: 5000 },
  /**
   * CFC 211 — échafaudage de cage d'escalier, forfait, déclenché par un
   * revêtement de mur ou de plafond **des communs** en fin de vie (code 4 du
   * classeur). Le classeur dit « pour les communs (cage d'escalier) » : un
   * plafond d'appartement à refaire ne monte pas d'échafaudage dans la cage.
   */
  echafaudageCommuns: { cfc: '211', forfait: 5000 },
} as const

/** Catégories du classeur qui déclenchent l'échafaudage de cage d'escalier. */
const CATEGORIES_MURS_PLAFONDS = ['Revêtement de murs', 'Revêtement de plafonds']

export type Enveloppe = 'Réparation' | 'Amélioration' | 'Mise aux normes' | 'Poste de chantier'

export interface DevisLigne {
  /** Unique dans le devis : un ouvrage peut produire plusieurs lignes. */
  cle: string
  cfcCode: string
  libelle: string
  enveloppe: Enveloppe
  quantite: number | null
  unite: string | null
  /** Prix unitaire réellement appliqué = montant ÷ quantité. null si pas de quantité. */
  prixUnitaire: number | null
  montant: number
  /** Travaux décrits pour cette enveloppe, ou la règle pour un poste de chantier. */
  remarque: string
  /** true pour les postes imposés par le classeur, absents du diagnostic. */
  automatique: boolean
}

export interface DevisPosition {
  /** Code CFC à 3 chiffres ("226"), "" si le code de l'ouvrage n'en porte pas. */
  code: string
  label: string
  lignes: DevisLigne[]
  montant: number
}

export interface Cascade {
  ht: number
  honoraires: number
  reserve: number
  sousTotal: number
  tva: number
  total: number
}

export interface DevisBloc {
  /** Priorité, ou 'AUTO' pour les postes de chantier, ou 'NC' si non arbitrée. */
  cle: Priority | 'AUTO' | 'NC'
  titre: string
  horizon: string
  positions: DevisPosition[]
  ht: number
  cascade: Cascade
}

export interface Devis {
  blocs: DevisBloc[]
  ht: number
  cascade: Cascade
  /** Règles appliquées d'office, à énoncer sous le devis. */
  reglesAppliquees: string[]
}

export interface DevisOptions {
  honoraryPct: number | null
  reservePct: number | null
  /** Surface de plancher, pour le nettoyage au m². */
  floorArea: number | null
}

const num = (v: string | null | undefined) => (v ? Number(v) : 0)

/** Honoraires puis réserve puis TVA — la réserve porte sur le montant déjà majoré. */
export function cascadeDe(ht: number, honoraryPct: number, reservePct: number): Cascade {
  const honoraires = ht * honoraryPct / 100
  const apresHonoraires = ht + honoraires
  const reserve = apresHonoraires * reservePct / 100
  const sousTotal = apresHonoraires + reserve
  const tva = sousTotal * TVA
  return { ht, honoraires, reserve, sousTotal, tva, total: sousTotal + tva }
}

/** Prix unitaire appliqué : ce que le client peut recalculer depuis la ligne. */
function prixUnitaire(montant: number, quantite: number | null): number | null {
  if (quantite == null || quantite <= 0) return null
  return Math.round((montant / quantite) * 100) / 100
}

/** Unité du catalogue débarrassée de son préfixe monétaire ("CHF/m²" -> "m²"). */
export function uniteCourte(unit: string | null | undefined): string | null {
  if (!unit) return null
  return unit.replace(/^CHF\s*\/?\s*/i, '').trim() || null
}

/** Les trois enveloppes d'un ouvrage, chacune devenant sa propre ligne si elle est chiffrée. */
function lignesDeLOuvrage(it: ApiDiagnosticItem): DevisLigne[] {
  const quantite = it.area ?? null
  const unite = uniteCourte(it.unit)
  const travaux = it.works.filter((w) => w && w !== 'Néant').join(' · ')

  const enveloppes: [Enveloppe, number, string][] = [
    ['Réparation', num(it.estimatedCost), travaux],
    ['Amélioration', num(it.improvementCost), it.improvement ?? ''],
    ['Mise aux normes', num(it.normsCost), it.norms ?? ''],
  ]

  return enveloppes
    .filter(([, montant]) => montant > 0)
    .map(([enveloppe, montant, remarque]) => ({
      cle: `${it.id}:${enveloppe}`,
      cfcCode: it.cfcCode,
      // Deux relevés du même article peuvent se suivre au devis — la peinture des
      // communs et celle des logements. Sans le suffixe, le lecteur voit deux
      // lignes identiques à des montants différents et croit à un doublon.
      libelle: `${it.cfcLabel}${suffixeLocalisation(it.localisation)}`,
      enveloppe,
      quantite,
      unite,
      prixUnitaire: prixUnitaire(montant, quantite),
      montant,
      remarque,
      automatique: false,
    }))
}

/**
 * Postes imposés par la note générale du classeur.
 *
 * Ils ne viennent d'aucune observation : ils accompagnent le chantier dès lors
 * qu'il y a des travaux. Chacun porte sa règle en clair, pour qu'un montant qui
 * n'a pas d'ouvrage en face reste explicable.
 */
export function postesDeChantier(
  items: ApiDiagnosticItem[],
  catalogue: Map<number, ApiCatalogItem>,
  options: DevisOptions,
): DevisLigne[] {
  const coeff = getMarketCoeff()
  const lignes: DevisLigne[] = []

  const surface = options.floorArea ?? 0
  if (surface > 0) {
    const pu = Math.round(POSTES_AUTOMATIQUES.nettoyage.prixParM2 * coeff * 100) / 100
    lignes.push({
      cle: 'auto:nettoyage',
      cfcCode: POSTES_AUTOMATIQUES.nettoyage.cfc,
      libelle: "Nettoyage complet de l'immeuble",
      enveloppe: 'Poste de chantier',
      quantite: surface,
      unite: 'm² SP',
      prixUnitaire: pu,
      montant: Math.round(surface * pu),
      remarque: `Compté d'office sur tout devis : ${POSTES_AUTOMATIQUES.nettoyage.prixParM2} CHF par m² de surface de plancher.`,
      automatique: true,
    })
  }

  const protection = Math.round(POSTES_AUTOMATIQUES.protection.forfait * coeff)
  lignes.push({
    cle: 'auto:protection',
    cfcCode: POSTES_AUTOMATIQUES.protection.cfc,
    libelle: 'Protection des ouvrages existants',
    enveloppe: 'Poste de chantier',
    quantite: 1,
    unite: 'forfait',
    prixUnitaire: protection,
    montant: protection,
    remarque: "Compté d'office sur tout devis, en forfait global.",
    automatique: true,
  })

  // Échafaudage de cage d'escalier : déclenché par un revêtement de mur ou de
  // plafond **des communs** en fin de vie. Tant que le relevé ne distinguait pas
  // les communs des logements, la règle se déclenchait sur n'importe quel
  // revêtement et montait un échafaudage de cage pour un plafond d'appartement.
  // Le relevé porte maintenant sa localisation : la règle peut viser juste.
  const declencheur = items.find((it) => {
    if (it.state !== 'MAUVAIS' || it.catalogItemId == null) return false
    if (it.localisation !== 'COMMUNS') return false
    const c = catalogue.get(it.catalogItemId)
    return !!c?.category && CATEGORIES_MURS_PLAFONDS.includes(c.category)
  })
  if (declencheur) {
    const forfait = Math.round(POSTES_AUTOMATIQUES.echafaudageCommuns.forfait * coeff)
    lignes.push({
      cle: 'auto:echafaudage',
      cfcCode: POSTES_AUTOMATIQUES.echafaudageCommuns.cfc,
      libelle: "Échafaudage de cage d'escalier",
      enveloppe: 'Poste de chantier',
      quantite: 1,
      unite: 'forfait',
      prixUnitaire: forfait,
      montant: forfait,
      remarque: `Déclenché par « ${declencheur.cfcLabel} » des communs en fin de vie : un revêtement de mur ou de plafond de cage d'escalier à remplacer impose un échafaudage intérieur.`,
      automatique: true,
    })
  }

  return lignes
}

/** Regroupe des lignes par position CFC à 3 chiffres, triées par code. */
function grouperParPosition(lignes: DevisLigne[], labels: Map<string, string>): DevisPosition[] {
  const parCode = new Map<string, DevisLigne[]>()
  for (const l of lignes) {
    const code = cfcPositionCode(l.cfcCode) ?? ''
    if (!parCode.has(code)) parCode.set(code, [])
    parCode.get(code)!.push(l)
  }
  return Array.from(parCode.entries())
    .map(([code, dedans]) => ({
      code,
      label: code ? (labels.get(code) ?? `CFC ${code}`) : 'Hors nomenclature',
      lignes: dedans.sort((a, b) => b.montant - a.montant),
      montant: dedans.reduce((s, l) => s + l.montant, 0),
    }))
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
}

/**
 * Devis complet : postes de chantier, puis les travaux par priorité.
 *
 * `labels` est l'index de la nomenclature CFC (code -> libellé officiel), pour
 * que le client lise « 226 Crépissages de façade » et non un code nu.
 */
export function buildDevis(
  items: ApiDiagnosticItem[],
  labels: Map<string, string>,
  catalogItems: ApiCatalogItem[],
  options: DevisOptions,
): Devis {
  const honoraryPct = options.honoraryPct ?? 0
  const reservePct = options.reservePct ?? 0
  const catalogue = new Map(catalogItems.map((c) => [c.id, c]))

  const blocs: DevisBloc[] = []

  // 1. Les postes de chantier, en tête : ils conditionnent le reste.
  const auto = postesDeChantier(items, catalogue, options)
  if (auto.length > 0) {
    const ht = auto.reduce((s, l) => s + l.montant, 0)
    blocs.push({
      cle: 'AUTO',
      titre: 'Postes de chantier',
      horizon: 'avec les travaux engagés',
      positions: grouperParPosition(auto, labels),
      ht,
      cascade: cascadeDe(ht, honoraryPct, reservePct),
    })
  }

  // 2. Les travaux relevés, par priorité. Un ouvrage sans montant n'entre pas au
  //    devis : il reste décrit au chapitre de l'état.
  const parPriorite = new Map<Priority | 'NC', DevisLigne[]>()
  for (const it of items) {
    const lignes = lignesDeLOuvrage(it)
    if (lignes.length === 0) continue
    const cle = it.priority ?? 'NC'
    if (!parPriorite.has(cle)) parPriorite.set(cle, [])
    parPriorite.get(cle)!.push(...lignes)
  }

  for (const cle of [...PRIORITES, 'NC' as const]) {
    const lignes = parPriorite.get(cle)
    if (!lignes || lignes.length === 0) continue
    const ht = lignes.reduce((s, l) => s + l.montant, 0)
    blocs.push({
      cle,
      titre: cle === 'NC' ? 'Priorité à arbitrer' : `Priorité ${cle}`,
      horizon: cle === 'NC' ? 'non déterminé' : HORIZON[cle],
      positions: grouperParPosition(lignes, labels),
      ht,
      cascade: cascadeDe(ht, honoraryPct, reservePct),
    })
  }

  const ht = blocs.reduce((s, b) => s + b.ht, 0)
  const reglesAppliquees = auto.map((l) => `CFC ${l.cfcCode}, ${l.libelle} : ${l.remarque}`)

  return { blocs, ht, cascade: cascadeDe(ht, honoraryPct, reservePct), reglesAppliquees }
}

/**
 * Prix unitaire du catalogue pour l'état constaté, indexé.
 *
 * Sert de contrôle à côté du prix appliqué : si les deux divergent, c'est que le
 * coût a été forcé à la main ou que la quantité a été reprise sur place.
 */
export function prixCatalogue(c: ApiCatalogItem | undefined, state: string | null): number | undefined {
  if (!c || !state) return undefined
  const brut = state === 'TRES_BON' ? c.priceTbe
    : state === 'BON' ? c.priceBon
    : state === 'MOYEN' ? c.priceMoyen
    : state === 'MAUVAIS' ? c.priceMauvais
    : null
  return appliedUnitPrice(brut)
}
