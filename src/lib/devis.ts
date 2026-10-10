/**
 * Construction du devis, à la maille CFC 3 chiffres, groupé par priorité.
 *
 * Ce module tient les règles de chiffrage qui viennent de la base du bureau et
 * non de la saisie du diagnostiqueur :
 *
 *  - un ouvrage relevé dans deux étapes donne deux lignes, distinguées par le
 *    nom de leur étape : « Peinture intérieure, murs · Cage d'escalier » et
 *    « ... · Appartements ». Sans ce sous-titre, deux lignes identiques à des
 *    montants différents se lisent comme un doublon ;
 *  - quatre postes s'ajoutent d'office, dont les prix sont lus dans la table
 *    des postes automatiques et jamais écrits ici ;
 *  - les améliorations sortent du total principal et vont au tableau des
 *    options : ce sont des travaux qu'on peut décider de ne pas faire. Les
 *    remises aux normes, elles, restent au devis, parce qu'on ne décide pas de
 *    s'en passer.
 *
 * Le calcul est ici, hors des composants, pour être vérifiable par des tests :
 * un devis faux ne se voit pas à l'écran, il se voit chez le client.
 */
import { appliedUnitPrice, getMarketCoeff } from './diagnostic-auto'
import { cfcPositionCode } from './cfc'
import { comparerCodesCfc } from './base-cfc/devis-cfc'
import {
  echafaudageDeLOption, postesAutomatiques,
  type Priorite, type ReleveDuDevis,
} from './base-cfc/postes'
import type { DonneesBatiment } from './base-cfc/quantites'
import type {
  ApiArticle, ApiDiagnosticItem, ApiEtapeVisite, ApiPosteAutomatique, Priority,
} from './api-types'

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

/** Ce que le devis a besoin de connaître de la base. */
export interface BaseDuDevis {
  articles: ApiArticle[]
  postes: ApiPosteAutomatique[]
  etapes: ApiEtapeVisite[]
}

/** Une amélioration retenue, chiffrée hors du total principal. */
export interface LigneOption {
  cle: string
  cfcCode: string
  libelle: string
  travaux: string
  quantite: number | null
  unite: string | null
  prixUnitaire: number | null
  montant: number
  /** Échafaudage propre à cette option, ou la mention qui dit pourquoi il n'y en a pas. */
  echafaudage: { montant: number | null; mention: string } | null
}

/** Le tableau des options, hors devis principal. */
export interface TableauDesOptions {
  lignes: LigneOption[]
  /** Somme des options elles-mêmes. */
  ht: number
  /** Somme des échafaudages qu'elles ajoutent. */
  echafaudage: number
  total: number
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
  /** Les améliorations, chiffrées à part : on peut décider de ne pas les faire. */
  options: TableauDesOptions
  ht: number
  cascade: Cascade
  /** Règles appliquées d'office, à énoncer sous le devis. */
  reglesAppliquees: string[]
}

export interface DevisOptions {
  honoraryPct: number | null
  reservePct: number | null
  /** Données du bâtiment, dont les postes automatiques tirent leurs quantités. */
  batiment: DonneesBatiment
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

/**
 * Les enveloppes d'un ouvrage qui entrent au devis principal.
 *
 * La réparation et la remise aux normes. L'amélioration n'y est pas : elle va
 * au tableau des options, hors total, parce qu'on peut décider de ne pas la
 * faire. Une remise aux normes, non.
 */
function lignesDeLOuvrage(it: ApiDiagnosticItem, sousTitre: string | null): DevisLigne[] {
  const quantite = it.area ?? null
  const unite = uniteCourte(it.unit)
  const travaux = it.works.filter((w) => w && w !== 'Néant').join(' · ')

  const enveloppes: [Enveloppe, number, string][] = [
    ['Réparation', num(it.estimatedCost), travaux],
    ['Mise aux normes', num(it.normsCost), it.norms ?? ''],
  ]

  return enveloppes
    .filter(([, montant]) => montant > 0)
    .map(([enveloppe, montant, remarque]) => ({
      cle: `${it.id}:${enveloppe}`,
      cfcCode: it.cfcCode,
      // Deux relevés du même article se suivent au devis, la peinture de la cage
      // d'escalier et celle des appartements. Sans le nom de leur étape, le
      // lecteur voit deux lignes identiques à des montants différents et croit
      // à un doublon.
      libelle: sousTitre ? `${it.cfcLabel} · ${sousTitre}` : it.cfcLabel,
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
 * Le sous-titre de chaque relevé : le nom de son étape, et seulement quand il
 * en faut un.
 *
 * Mettre « Façade » sous un crépi de façade n'apprend rien et alourdit la
 * lecture. Le mettre sous une peinture relevée deux fois est indispensable.
 */
function sousTitresDesReleves(items: ApiDiagnosticItem[], etapes: ApiEtapeVisite[]): Map<string, string | null> {
  const etapesParArticle = new Map<string, Set<number>>()
  for (const it of items) {
    if (!it.articleId || it.etapeNumero == null) continue
    if (!etapesParArticle.has(it.articleId)) etapesParArticle.set(it.articleId, new Set())
    etapesParArticle.get(it.articleId)!.add(it.etapeNumero)
  }

  const nomDeLEtape = new Map(etapes.map((e) => [e.numero, e.nom]))
  const parReleve = new Map<string, string | null>()
  for (const it of items) {
    const plusieurs = it.articleId ? (etapesParArticle.get(it.articleId)?.size ?? 0) > 1 : false
    parReleve.set(it.id, plusieurs && it.etapeNumero != null ? nomDeLEtape.get(it.etapeNumero) ?? null : null)
  }
  return parReleve
}

/**
 * Les relevés, tels que les règles des postes automatiques les lisent.
 *
 * Un relevé dont l'article n'est pas dans la base n'y entre pas : on ne sait
 * pas s'il demande un échafaudage, et deviner ferait apparaître ou disparaître
 * un poste de plusieurs milliers de francs.
 */
function relevesPourLesPostes(items: ApiDiagnosticItem[], articles: ApiArticle[]): ReleveDuDevis[] {
  const parId = new Map(articles.map((a) => [a.id, a]))
  const etats: Record<string, string> = {
    TRES_BON: 'tres_bon', BON: 'bon', MOYEN: 'moyen', MAUVAIS: 'mauvais',
  }
  const dedans: ReleveDuDevis[] = []
  for (const it of items) {
    const article = it.articleId ? parId.get(it.articleId) : undefined
    if (!article) continue
    dedans.push({
      articleId: article.id,
      nom: article.nom,
      etapeNumero: it.etapeNumero ?? 0,
      echafaudage: article.echafaudage,
      baseQuantite: article.baseQuantite,
      domaineRapport: article.domaineRapport,
      etat: it.state ? etats[it.state] ?? null : null,
      quantite: it.area ?? null,
      montant: num(it.estimatedCost) + num(it.normsCost),
      priorite: (it.priority as Priorite | null) ?? null,
    })
  }
  return dedans
}

/**
 * Les postes que la base impose dans tout devis.
 *
 * Quatre postes, et leurs prix sont lus dans la table : le bureau doit pouvoir
 * changer le prix d'un échafaudage sans qu'on touche au code. Ils suivent
 * ensuite l'indice de la construction comme les prix du catalogue, parce qu'un
 * devis daté d'aujourd'hui se chiffre au marché d'aujourd'hui.
 *
 * Le calcul lui-même est dans base-cfc/postes.ts, avec ses tests. Ici, on
 * l'habille pour le devis.
 */
export function postesDeChantier(
  items: ApiDiagnosticItem[],
  base: BaseDuDevis,
  options: DevisOptions,
): DevisLigne[] {
  const coeff = getMarketCoeff()
  const indexes = base.postes.map((p) => ({ ...p, prix: Math.round(p.prix * coeff * 100) / 100 }))
  const releves = relevesPourLesPostes(items, base.articles)

  return postesAutomatiques(releves, indexes, {
    surfacePlancher: options.batiment.surfacePlancher,
    surfaceFacade: options.batiment.surfaceFacade,
    nombreCages: options.batiment.nombreCages,
  }).map((l) => ({
    cle: `auto:${l.cfcCode}`,
    cfcCode: l.cfcCode,
    libelle: l.libelle,
    enveloppe: 'Poste de chantier' as const,
    quantite: l.quantite,
    unite: uniteDuPoste(l.unite),
    prixUnitaire: l.prixUnitaire,
    montant: Math.round(l.montant ?? 0),
    remarque: l.remarque,
    automatique: true,
  }))
}

/** Unité d'un poste, écrite pour le devis. */
function uniteDuPoste(unite: string): string {
  return unite === 'm2' ? 'm²' : unite
}

/**
 * Le tableau des options : les améliorations retenues, hors total principal.
 *
 * Leurs prix sont donnés hors échafaudage. Une isolation périphérique à 310
 * francs le mètre carré n'inclut pas les 35 francs de l'échafaudage, et
 * l'arbitrage se ferait sur un montant faux. On l'ajoute donc, sauf si le devis
 * principal échafaude déjà cette façade, où on le dit au lieu de le compter.
 */
export function tableauDesOptions(
  items: ApiDiagnosticItem[],
  base: BaseDuDevis,
  echafaudageAuDevisPrincipal: boolean,
): TableauDesOptions {
  const coeff = getMarketCoeff()
  const poste211 = base.postes.find((p) => p.cfcCode === '211.1')
  const posteIndexe = poste211
    ? { ...poste211, prix: Math.round(poste211.prix * coeff * 100) / 100 }
    : undefined
  const parId = new Map(base.articles.map((a) => [a.id, a]))
  const sousTitres = sousTitresDesReleves(items, base.etapes)

  const lignes: LigneOption[] = []
  for (const it of items) {
    const montant = num(it.improvementCost)
    if (montant <= 0) continue
    const article = it.articleId ? parId.get(it.articleId) : undefined
    const sousTitre = sousTitres.get(it.id) ?? null
    const quantite = it.area ?? null

    const echafaudage = article
      ? echafaudageDeLOption(
        { articleId: article.id, nom: article.nom, echafaudage: article.echafaudage, quantite },
        posteIndexe,
        echafaudageAuDevisPrincipal,
      )
      : null

    lignes.push({
      cle: `option:${it.id}`,
      cfcCode: it.cfcCode,
      libelle: sousTitre ? `${it.cfcLabel} · ${sousTitre}` : it.cfcLabel,
      travaux: it.improvement ?? '',
      quantite,
      unite: uniteCourte(it.unit),
      prixUnitaire: prixUnitaire(montant, quantite),
      montant,
      echafaudage: echafaudage
        ? { montant: echafaudage.aCompter ? Math.round(echafaudage.montant ?? 0) : null, mention: echafaudage.mention }
        : null,
    })
  }

  lignes.sort((a, b) => comparerCodesCfc(a.cfcCode, b.cfcCode) || a.libelle.localeCompare(b.libelle, 'fr'))
  const ht = lignes.reduce((s, l) => s + l.montant, 0)
  const echafaudage = lignes.reduce((s, l) => s + (l.echafaudage?.montant ?? 0), 0)
  return { lignes, ht, echafaudage, total: ht + echafaudage }
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
    // Tri par code CFC a l'usage suisse : 211.1 avant 221, et 281.9 avant 281.10.
    .sort((a, b) => comparerCodesCfc(a.code, b.code))
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
  base: BaseDuDevis,
  options: DevisOptions,
): Devis {
  const honoraryPct = options.honoraryPct ?? 0
  const reservePct = options.reservePct ?? 0
  const sousTitres = sousTitresDesReleves(items, base.etapes)

  const blocs: DevisBloc[] = []

  // 1. Les postes de chantier, en tête : ils conditionnent le reste.
  const auto = postesDeChantier(items, base, options)
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
    const lignes = lignesDeLOuvrage(it, sousTitres.get(it.id) ?? null)
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

  // 3. Les améliorations, hors total principal : ce sont des décisions, pas des
  //    travaux engagés. Si l'échafaudage de façade est déjà au devis, elles ne
  //    le repaient pas.
  const echafaudageAuDevis = auto.some((l) => l.cfcCode === '211.1')
  const optionsRetenues = tableauDesOptions(items, base, echafaudageAuDevis)

  const ht = blocs.reduce((s, b) => s + b.ht, 0)
  const reglesAppliquees = auto.map((l) => `CFC ${l.cfcCode}, ${l.libelle} : ${l.remarque}`)

  return {
    blocs,
    options: optionsRetenues,
    ht,
    cascade: cascadeDe(ht, honoraryPct, reservePct),
    reglesAppliquees,
  }
}

/**
 * Prix unitaire de la base pour l'état constaté, indexé.
 *
 * Sert de contrôle à côté du prix appliqué : si les deux divergent, c'est que le
 * coût a été forcé à la main ou que la quantité a été reprise sur place.
 */
export function prixCatalogue(
  c: { priceTbe: number | null; priceBon: number | null; priceMoyen: number | null; priceMauvais: number | null } | undefined,
  state: string | null,
): number | undefined {
  if (!c || !state) return undefined
  const brut = state === 'TRES_BON' ? c.priceTbe
    : state === 'BON' ? c.priceBon
    : state === 'MOYEN' ? c.priceMoyen
    : state === 'MAUVAIS' ? c.priceMauvais
    : null
  return appliedUnitPrice(brut)
}
