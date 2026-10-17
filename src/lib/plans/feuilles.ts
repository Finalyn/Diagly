/**
 * Les feuilles d'un jeu de plans, pour l'outil Métrés.
 *
 * Un dossier porte un ou plusieurs documents ; chaque page d'un PDF est une
 * feuille, avec ce que le cartouche en dit (numéro, titre), ce qu'elle montre
 * (plan d'étage, élévation…), le niveau qu'elle représente, le nombre
 * d'étages identiques qu'elle vaut, et l'état de son analyse par l'IA. Le
 * serveur range tout cela dans la colonne `feuilles` du plan
 * (server/src/lib/feuilles-plans.ts) ; ce module en tient les règles :
 *
 * - quelle feuille passe à l'analyse, et dans quel lot : un lot ne mêle pas
 *   deux documents (la route analyse un plan à la fois) et compte au plus
 *   huit pages, comme l'analyse lancée depuis l'éditeur ;
 * - ce qu'une analyse écrit sur la feuille, sans écraser ce que
 *   l'utilisateur a corrigé à la main ;
 * - le nom provisoire d'un bâtiment déposé sans nom, et ce que le cartouche
 *   vient compléter ensuite.
 *
 * Module pur, sans réseau ni canevas, pour être vérifiable par les tests.
 */
import type {
  ApiPlan, ApiProject, ChampCorrigeable, ComptageAnalyse, FeuillePlan, FeuillesPlan, LotAnalyse, PageAnalysee,
  PlanAnnotation, ProjetLuAuCartouche, StatutAnalyseFeuille, TypePageAnalysee, ZoneEcartee,
} from '../api-types'
import type { EchelleDePage } from './analyse-ia'
import { echelleDePage } from '../plan-quantites'

/** Pages par lot : au-delà, une analyse coûte cher et dure trop (même plafond que l'éditeur et le serveur). */
export const PAGES_PAR_LOT = 8
/** Analyses perdues en route (serveur redémarré, tâche expirée) avant qu'on cesse de relancer d'office. */
export const TENTATIVES_MAX = 2
/** Les derniers lots gardés avec leurs totaux. */
const LOTS_GARDES = 10
/** Les propositions écartées gardées par feuille : de quoi expliquer, pas un inventaire. */
const ECARTEES_GARDEES = 30

export const NOMS_STATUTS: Record<StatutAnalyseFeuille | 'aucune', string> = {
  aucune: 'Non analysée',
  en_file: 'En file',
  en_cours: 'Analyse en cours',
  prete: 'Analysée',
  erreur: 'Erreur',
}

/** Une feuille du jeu : un plan et une de ses pages. */
export interface RefFeuille {
  planId: string
  page: number
}

export const VIDE: FeuillesPlan = { pages: {} }

/** Les plans d'un dossier dans l'ordre du dépôt : celui du navigateur des feuilles et de la file. */
export function ordonnerPlans<T extends Pick<ApiPlan, 'createdAt' | 'name'>>(plans: T[]): T[] {
  return [...plans].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.name.localeCompare(b.name))
}

export function feuillesDe(plan: Pick<ApiPlan, 'feuilles'>): FeuillesPlan {
  return plan.feuilles ?? VIDE
}

export function feuilleDe(f: FeuillesPlan, page: number): FeuillePlan {
  return f.pages[String(page)] ?? {}
}

export const estPdf = (plan: Pick<ApiPlan, 'mimeType'>) => plan.mimeType === 'application/pdf'

/** Nombre de pages du document : une image en a une ; un PDF, une fois lu. */
export function nombreDePages(plan: Pick<ApiPlan, 'mimeType'>, f: FeuillesPlan): number | null {
  return estPdf(plan) ? f.nombre ?? null : 1
}

/** L'annotation est-elle posée sur cette page ? Une image n'en a qu'une. */
export function surLaPage(a: Pick<PlanAnnotation, 'page'>, page: number, pdf: boolean): boolean {
  return !pdf || (a.page ?? 1) === page
}

/** Une proposition de l'IA pas encore regardée : zone ou repère à valider. */
export function enAttente(a: PlanAnnotation): boolean {
  return !!a.proposition || !!a.repere?.aValider
}

/**
 * La page porte-t-elle la trace d'une analyse faite avant les Métrés, depuis
 * l'éditeur ? Zones proposées, repères, zones validées depuis une proposition
 * (aimantées ou typées). Une telle page est réputée analysée : « Analyser
 * tout » ne la repaie pas sans qu'on le demande.
 */
export function porteUneAnalyse(annotations: PlanAnnotation[], page: number, pdf: boolean): boolean {
  return annotations.some((a) => surLaPage(a, page, pdf) && (!!a.proposition || !!a.repere || !!a.mesureExacte || !!a.typeZone))
}

export type EtatAnalyse = StatutAnalyseFeuille | 'aucune'

export function etatAnalyse(plan: Pick<ApiPlan, 'mimeType' | 'annotations'>, f: FeuillesPlan, page: number): EtatAnalyse {
  const statut = feuilleDe(f, page).analyse?.statut
  if (statut) return statut
  return porteUneAnalyse(plan.annotations ?? [], page, estPdf(plan)) ? 'prete' : 'aucune'
}

/**
 * Les propositions d'un lot, posées sur le plan : elles remplacent celles qui
 * attendaient encore sur ces pages, et seulement elles. Ce qui a été validé
 * reste, et livrer deux fois le même lot ne double rien. Même règle que le
 * serveur (server/src/lib/feuilles-plans.ts), pour l'éditeur ouvert.
 */
export function remplacerPropositions(actuelles: PlanAnnotation[], pages: number[], nouvelles: PlanAnnotation[]): PlanAnnotation[] {
  const visees = new Set(pages)
  return [...actuelles.filter((a) => !(enAttente(a) && visees.has(a.page ?? 1))), ...nouvelles]
}

/** Combien d'éléments attendent d'être validés sur cette page. */
export function aValiderSurLaPage(annotations: PlanAnnotation[], page: number, pdf: boolean): number {
  return annotations.filter((a) => surLaPage(a, page, pdf) && enAttente(a)).length
}

// ---------------------------------------------------------------- transitions

function avecPages(f: FeuillesPlan, pages: number[], maj: (actuelle: FeuillePlan, page: number) => FeuillePlan): FeuillesPlan {
  const suite = { ...f.pages }
  for (const p of pages) suite[String(p)] = maj(feuilleDe(f, p), p)
  return { ...f, pages: suite }
}

/** Les pages passent dans la file d'analyse. */
export function mettreEnFile(f: FeuillesPlan, pages: number[], depuis: string): FeuillesPlan {
  return avecPages(f, pages, (x) => ({ ...x, analyse: { statut: 'en_file', depuis, tentatives: x.analyse?.tentatives ?? 0 } }))
}

/** Le lot part : les pages passent en cours, avec la tâche quand on la connaît. */
export function mettreEnCours(f: FeuillesPlan, pages: number[], depuis: string, tache: string | null): FeuillesPlan {
  return avecPages(f, pages, (x) => ({ ...x, analyse: { statut: 'en_cours', depuis, tache, tentatives: x.analyse?.tentatives ?? 0 } }))
}

export function mettreEnErreur(f: FeuillesPlan, pages: number[], depuis: string, message: string): FeuillesPlan {
  return avecPages(f, pages, (x) => ({ ...x, analyse: { statut: 'erreur', depuis, message, tentatives: x.analyse?.tentatives ?? 0 } }))
}

/** On renonce : les pages redeviennent non analysées. */
export function retirerDeLaFile(f: FeuillesPlan, pages: number[]): FeuillesPlan {
  return avecPages(f, pages, (x) => ({ ...x, analyse: null }))
}

/**
 * Une analyse perdue en route (tâche expirée, serveur redémarré) : la page
 * retourne dans la file, une fois ou deux. Au-delà, elle passe en erreur et
 * attend qu'on la relance : on ne repaie pas sans fin une analyse qui se perd.
 */
export function apresUnePerte(f: FeuillesPlan, pages: number[], depuis: string): FeuillesPlan {
  return avecPages(f, pages, (x) => {
    const tentatives = (x.analyse?.tentatives ?? 0) + 1
    return tentatives >= TENTATIVES_MAX
      ? { ...x, analyse: { statut: 'erreur', depuis, message: 'L’analyse s’est perdue en route. Relancez-la.', tentatives } }
      : { ...x, analyse: { statut: 'en_file', depuis, tentatives } }
  })
}

/** Une feuille du jeu, avec ce qu'il faut pour décider de la file. */
export interface FeuilleEnFile extends RefFeuille {
  etat: EtatAnalyse
}

/**
 * Le prochain lot à analyser : le premier document qui a des pages en file,
 * et au plus huit de ses pages, dans l'ordre. Les feuilles arrivent dans
 * l'ordre du navigateur : la file suit ce que l'utilisateur voit.
 */
export function prochainLot(feuilles: FeuilleEnFile[], max = PAGES_PAR_LOT): { planId: string; pages: number[] } | null {
  const premiere = feuilles.find((x) => x.etat === 'en_file')
  if (!premiere) return null
  const pages = feuilles
    .filter((x) => x.planId === premiere.planId && x.etat === 'en_file')
    .map((x) => x.page)
    .slice(0, max)
  return { planId: premiere.planId, pages }
}

/** Les pages en cours d'analyse d'un plan, regroupées par tâche (null : partie sans numéro connu). */
export function enCoursParTache(f: FeuillesPlan): Map<string | null, number[]> {
  const groupes = new Map<string | null, number[]>()
  for (const [cle, x] of Object.entries(f.pages)) {
    if (x.analyse?.statut !== 'en_cours') continue
    const t = x.analyse.tache ?? null
    groupes.set(t, [...(groupes.get(t) ?? []), Number(cle)].sort((a, b) => a - b))
  }
  return groupes
}

// ---------------------------------------------------------------- ce que l'analyse écrit

export interface ResultatPourLesFeuilles {
  /** Les pages envoyées dans le lot. */
  numeros: number[]
  pages: PageAnalysee[]
  echelles: EchelleDePage[]
  ecartees: ZoneEcartee[]
  sansGeometrie: number[]
  tronque: boolean
  comptages: ComptageAnalyse[]
  remarques: string | null
  le: string
}

/**
 * Ce que l'analyse d'un lot écrit sur ses feuilles.
 *
 * Numéro, titre, type de vue, niveau et étages identiques viennent du
 * cartouche, sauf ceux que l'utilisateur a corrigés : relancer une feuille
 * ne défait pas une correction. L'échelle proposée attend la confirmation
 * de l'éditeur ; les totaux comptés vont avec le lot, puisqu'ils valent pour
 * toutes ses pages ensemble.
 */
export function appliquerAnalyse(f: FeuillesPlan, r: ResultatPourLesFeuilles): FeuillesPlan {
  const lues = new Map(r.pages.map((p) => [p.page, p]))
  const suite = avecPages(f, r.numeros, (x, numero) => {
    const corrige = new Set(x.corrige ?? [])
    const lue = lues.get(numero)
    const garde = <K extends ChampCorrigeable>(champ: K, valeur: FeuillePlan[K]): FeuillePlan[K] =>
      corrige.has(champ) ? x[champ] : valeur
    const ecartees = r.ecartees
      .filter((e) => e.page === numero || (e.page == null && numero === r.numeros[0]))
      .slice(0, ECARTEES_GARDEES)
    const sortie: FeuillePlan = {
      ...x,
      numero: garde('numero', lue?.feuille ?? x.numero ?? null),
      titre: garde('titre', lue?.titre ?? x.titre ?? null),
      type: garde('type', lue?.type ?? x.type ?? null),
      niveau: garde('niveau', lue ? lue.niveau ?? null : x.niveau ?? null),
      etagesIdentiques: garde('etagesIdentiques', lue ? lue.etagesIdentiques ?? null : x.etagesIdentiques ?? null),
      orientation: lue?.orientation ?? x.orientation ?? null,
      echelle: r.echelles.find((e) => e.page === numero) ?? null,
      remarque: lue?.remarque ?? null,
      ecartees,
      analyse: { statut: 'prete', depuis: r.le },
    }
    if (r.sansGeometrie.includes(numero)) sortie.sansGeometrie = true
    else delete sortie.sansGeometrie
    if (r.tronque) sortie.tronque = true
    else delete sortie.tronque
    return sortie
  })
  const lot: LotAnalyse = { pages: r.numeros, le: r.le, comptages: r.comptages, remarques: r.remarques }
  const autres = (f.lots ?? []).filter((l) => !l.pages.some((p) => r.numeros.includes(p)))
  return { ...suite, lots: [...autres, lot].slice(-LOTS_GARDES) }
}

/** Le lot qui a analysé cette page, s'il est encore gardé. */
export function lotDeLaPage(f: FeuillesPlan, page: number): LotAnalyse | null {
  return [...(f.lots ?? [])].reverse().find((l) => l.pages.includes(page)) ?? null
}

/**
 * Une correction à la main : elle s'écrit, et le champ est retenu comme
 * corrigé, pour qu'une nouvelle analyse ne revienne pas dessus.
 */
export function corrigerFeuille(f: FeuillesPlan, page: number, patch: Partial<Pick<FeuillePlan, ChampCorrigeable>>): FeuillesPlan {
  return avecPages(f, [page], (x) => {
    const corrige = new Set(x.corrige ?? [])
    for (const k of Object.keys(patch) as ChampCorrigeable[]) corrige.add(k)
    return { ...x, ...patch, corrige: [...corrige].sort() }
  })
}

// ---------------------------------------------------------------- lecture

export const NOMS_VUES: Record<TypePageAnalysee, string> = {
  plan_etage: 'Plan d’étage', elevation: 'Élévation', coupe: 'Coupe',
  toiture: 'Toiture', situation: 'Situation', autre: 'Autre',
}

/** « A-101 · Plan du rez », ou « Page 3 » tant que rien n'est lu. */
export function libelleFeuille(x: FeuillePlan, page: number, nomDuPlan?: string): string {
  const titre = x.titre?.trim()
  const numero = x.numero?.trim()
  if (numero && titre) return `${numero} · ${titre}`
  if (titre) return titre
  if (numero) return `Feuille ${numero}`
  return nomDuPlan ? `${nomDuPlan}, page ${page}` : `Page ${page}`
}

/** Le multiplicateur d'une feuille : un étage type vaut pour chaque étage qu'il représente. */
export function multiplicateur(x: FeuillePlan): number {
  const n = x.etagesIdentiques
  return n != null && Number.isInteger(n) && n >= 1 ? n : 1
}

export type StatutEchelleFeuille = 'posee' | 'a_verifier' | 'aucune'

/**
 * L'échelle d'une feuille : posée (étalonnée à la main ou confirmée dans
 * l'éditeur), proposée par l'analyse et à vérifier, ou absente.
 */
export function statutEchelle(plan: Pick<ApiPlan, 'scalePxPerM' | 'annotations'>, x: FeuillePlan, page: number): StatutEchelleFeuille {
  if (echelleDePage(plan, page) != null) return 'posee'
  if (x.echelle && x.echelle.statut !== 'aucune') return 'a_verifier'
  return 'aucune'
}

// ---------------------------------------------------------------- bâtiment

/**
 * Le nom provisoire d'un bâtiment déposé sans nom, tiré du nom du fichier :
 * « plans_rue-du-lac_12.pdf » devient « plans rue du lac 12 ».
 */
export function nomProvisoire(nomFichier: string): string {
  const sansExtension = nomFichier.replace(/\.[a-z0-9]{2,5}$/i, '')
  const propre = sansExtension.replace(/[_]+/g, ' ').replace(/(?<=\S)-(?=\S)/g, ' ').replace(/\s+/g, ' ').trim()
  return (propre || 'Bâtiment sans nom').slice(0, 120)
}

type ChampsBatiment = Pick<ApiProject, 'name' | 'address' | 'postalCode' | 'city' | 'canton'>

/**
 * Ce que le cartouche vient compléter d'un dossier ouvert depuis un dépôt.
 *
 * Le nom n'est remplacé que s'il est encore le nom provisoire tiré d'un
 * fichier : un nom tapé par l'utilisateur ne se touche pas. L'adresse, le
 * NPA et la localité ne se remplissent que vides. Le canton suit l'adresse :
 * posé d'office à la création, il n'était qu'une supposition.
 */
export function completerBatiment(
  projet: ChampsBatiment, lu: ProjetLuAuCartouche | null | undefined, nomsProvisoires: string[],
): Partial<ChampsBatiment> | null {
  if (!lu) return null
  const patch: Partial<ChampsBatiment> = {}
  if (lu.nom && nomsProvisoires.includes(projet.name) && lu.nom !== projet.name) patch.name = lu.nom
  const sansAdresse = !projet.address?.trim()
  if (sansAdresse && lu.adresse) patch.address = lu.adresse
  if (!projet.postalCode?.trim() && lu.npa) patch.postalCode = lu.npa
  if (!projet.city?.trim() && lu.localite) patch.city = lu.localite
  if (sansAdresse && lu.adresse && lu.canton && lu.canton !== projet.canton) patch.canton = lu.canton
  return Object.keys(patch).length ? patch : null
}
