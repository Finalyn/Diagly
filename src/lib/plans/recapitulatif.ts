/**
 * Le récapitulatif des quantités validées d'un jeu de plans.
 *
 * L'outil Métrés analyse toutes les feuilles d'un bâtiment ; ce qui a été
 * validé feuille par feuille doit se lire d'un coup, rangé comme un métreur
 * le range : façades, fenêtres, portes, toiture, emprise et dalles par
 * étage, murs, pièces, éléments comptés. Un plan d'étage type vaut pour
 * chaque étage qu'il représente : ses quantités sont multipliées, et la
 * ligne le dit.
 *
 * Ne compte que ce qui est validé : une proposition de l'IA n'entre dans
 * aucun total (voir `natureDe`), elle est seulement comptée à part, pour dire
 * que le récapitulatif n'est pas encore complet. Une zone posée sur une
 * feuille sans échelle n'a pas de mesure : elle est comptée à part aussi.
 *
 * Chaque ligne garde ses sources (plan, page, annotation) : c'est par là que
 * le panneau des quantités reliera chaque chiffre à sa forme sur le plan.
 *
 * Module pur, sans canevas ni réseau, pour être vérifiable par les tests.
 */
import type { ApiPlan, FeuillesPlan, PlanAnnotation, TypePageAnalysee, TypeZoneIA } from '../api-types'
import { CATEGORIE, CLES_CATEGORIES, type CategorieComptee } from '../base-cfc/comptages'
import { airePolygone, echelleDePage, longueurPolyligne, natureDe } from '../plan-quantites'
import { enAttente, estPdf, feuilleDe, multiplicateur, NOMS_VUES } from './feuilles'

export type UniteRecap = 'm²' | 'ml' | 'pce'

/** D'où vient une quantité : la forme sur le plan, et ce qu'elle apporte. */
export interface SourceRecap {
  planId: string
  page: number
  annotationId: string
  /** Mesure de la forme (m², m) ou 1 pour une pièce comptée, avant multiplication. */
  valeur: number
  multiplicateur: number
}

export interface LigneRecap {
  cle: string
  libelle: string
  unite: UniteRecap
  /** Étages identiques compris. */
  quantite: number
  /** Le calcul ou la provenance, en clair : « 2 feuilles », « 3 étages identiques ». */
  detail: string | null
  /** Ligne de total : elle reprend les lignes du groupe au-dessus d'elle. */
  total?: boolean
  sources: SourceRecap[]
}

export type CleGroupe = 'facades' | 'fenetres' | 'portes' | 'toiture' | 'etages' | 'murs' | 'pieces' | 'elements' | 'autres'

export interface GroupeRecap {
  cle: CleGroupe
  titre: string
  lignes: LigneRecap[]
}

export interface Recapitulatif {
  groupes: GroupeRecap[]
  /** Propositions de l'IA (zones et repères) qui attendent encore d'être validées. */
  aValider: number
  /** Zones validées posées sur une feuille sans échelle : elles n'ont pas de mesure. */
  sansEchelle: number
}

/** Un plan, ses feuilles, et ses annotations les plus récentes (celles de l'éditeur ouvert, s'il l'est). */
export interface PlanPourRecap {
  plan: Pick<ApiPlan, 'id' | 'name' | 'mimeType' | 'scalePxPerM' | 'annotations'>
  feuilles: FeuillesPlan
}

/** Une forme validée et ce qu'elle mesure, replacée dans sa feuille. */
interface Mesure {
  source: SourceRecap
  type: TypeZoneIA | null
  nature: 'surface' | 'longueur'
  /** null : la feuille n'a pas d'échelle. */
  mesure: number | null
  /** La feuille : de quoi faire une ligne par étage. */
  cleFeuille: string
  nomFeuille: string
}

function nomDeLaFeuille(f: FeuillesPlan, page: number, nomPlan: string, pdf: boolean): string {
  const x = feuilleDe(f, page)
  const nom = x.niveau?.trim() || x.titre?.trim() || (x.type ? NOMS_VUES[x.type] : null)
  if (nom) return nom
  return pdf ? `${nomPlan}, page ${page}` : nomPlan
}

/**
 * « × 3 étages identiques » quand tout vient d'un même étage type, « étages
 * identiques compris » quand la ligne mêle des feuilles simples et des étages
 * types, rien quand aucune feuille n'est multipliée.
 */
function detailMultiplicateur(sources: SourceRecap[]): string | null {
  const mults = [...new Set(sources.map((s) => s.multiplicateur))]
  if (!mults.some((m) => m > 1)) return null
  return mults.length === 1 ? `× ${mults[0]} étages identiques` : 'étages identiques compris'
}

function somme(sources: SourceRecap[]): number {
  return sources.reduce((s, x) => s + x.valeur * x.multiplicateur, 0)
}

function ligne(cle: string, libelle: string, unite: UniteRecap, sources: SourceRecap[], detail?: string | null, total?: boolean): LigneRecap {
  // Un total additionne des feuilles simples et des étages types : « × 3 »
  // laisserait croire que tout le total est multiplié.
  const parDefaut = total
    ? (sources.some((s) => s.multiplicateur > 1) ? 'étages identiques compris' : null)
    : detailMultiplicateur(sources)
  return { cle, libelle, unite, quantite: somme(sources), detail: detail === undefined ? parDefaut : detail, sources, ...(total ? { total } : {}) }
}

const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`

export function recapitulatifDuJeu(jeu: PlanPourRecap[]): Recapitulatif {
  const mesures: Mesure[] = []
  const reperes: { categorie: CategorieComptee; vue: TypePageAnalysee | null; source: SourceRecap }[] = []
  let aValider = 0
  let sansEchelle = 0

  for (const { plan, feuilles } of jeu) {
    const pdf = estPdf(plan)
    for (const a of plan.annotations ?? []) {
      if (enAttente(a)) { aValider++; continue }
      const page = pdf ? a.page ?? 1 : 1
      const feuille = feuilleDe(feuilles, page)
      const mult = multiplicateur(feuille)
      if (a.type === 'repere' && a.repere) {
        reperes.push({ categorie: a.repere.categorie, vue: feuille.type ?? null, source: { planId: plan.id, page, annotationId: a.id, valeur: 1, multiplicateur: mult } })
        continue
      }
      const nature = natureDe(a)
      if (nature === 'aucune') continue
      const echelle = echelleDePage(plan, page)
      const mesure = mesureDe(a, nature, echelle)
      if (mesure == null) sansEchelle++
      mesures.push({
        source: { planId: plan.id, page, annotationId: a.id, valeur: mesure ?? 0, multiplicateur: mult },
        type: a.typeZone ?? null,
        nature,
        mesure,
        cleFeuille: `${plan.id}#${page}`,
        nomFeuille: nomDeLaFeuille(feuilles, page, plan.name, pdf),
      })
    }
  }

  const surfaces = (type: TypeZoneIA) => mesures.filter((m) => m.type === type && m.nature === 'surface' && m.mesure != null)
  const comptees = (type: TypeZoneIA) => mesures.filter((m) => m.type === type && m.nature === 'surface')
  const groupes: GroupeRecap[] = []
  const ajouter = (cle: CleGroupe, titre: string, lignes: LigneRecap[]) => {
    const utiles = lignes.filter((l) => l.sources.length > 0)
    if (utiles.length) groupes.push({ cle, titre, lignes: utiles })
  }

  // Façades : brute, ouvertures dessinées sur les mêmes feuilles, nette.
  const facades = surfaces('facade')
  const feuillesDeFacade = new Set(facades.map((m) => m.cleFeuille))
  const ouvertures = [...surfaces('fenetre'), ...surfaces('porte')].filter((m) => feuillesDeFacade.has(m.cleFeuille))
  const lignesFacades: LigneRecap[] = [ligne('facades-brute', 'Surface brute', 'm²', facades.map((m) => m.source))]
  if (facades.length && ouvertures.length) {
    const ouv = ouvertures.map((m) => m.source)
    lignesFacades.push(ligne('facades-ouvertures', 'Ouvertures déduites', 'm²', ouv, pluriel(ouv.length, 'ouverture', 'ouvertures')))
    lignesFacades.push({
      ...ligne('facades-nette', 'Surface nette', 'm²', [...facades.map((m) => m.source), ...ouv.map((s) => ({ ...s, valeur: -s.valeur }))], null, true),
    })
  }
  ajouter('facades', 'Façades', lignesFacades)

  const fenetres = comptees('fenetre')
  ajouter('fenetres', 'Fenêtres', [
    ligne('fenetres-nombre', 'Nombre', 'pce', fenetres.map((m) => ({ ...m.source, valeur: 1 }))),
    ligne('fenetres-surface', 'Surface', 'm²', surfaces('fenetre').map((m) => m.source)),
  ])

  const portes = comptees('porte')
  ajouter('portes', 'Portes', [
    ligne('portes-nombre', 'Nombre', 'pce', portes.map((m) => ({ ...m.source, valeur: 1 }))),
    ligne('portes-surface', 'Surface', 'm²', surfaces('porte').map((m) => m.source)),
  ])

  ajouter('toiture', 'Toiture', [ligne('toiture', 'Surface', 'm²', surfaces('toiture').map((m) => m.source))])

  // Emprise et dalles : une ligne par étage, dans l'ordre des feuilles.
  const parEtage = (type: 'emprise' | 'dalle') => {
    const groupesFeuilles = new Map<string, Mesure[]>()
    for (const m of surfaces(type)) groupesFeuilles.set(m.cleFeuille, [...(groupesFeuilles.get(m.cleFeuille) ?? []), m])
    return [...groupesFeuilles.entries()].map(([cle, ms]) =>
      ligne(`${type}-${cle}`, `${ms[0].nomFeuille}, ${type === 'emprise' ? 'emprise' : 'dalle'}`, 'm²', ms.map((m) => m.source)))
  }
  const emprises = parEtage('emprise')
  const dalles = parEtage('dalle')
  const lignesEtages = [...emprises, ...dalles]
  if (emprises.length > 1) lignesEtages.push(ligne('emprises-total', 'Total des emprises', 'm²', emprises.flatMap((l) => l.sources), undefined, true))
  if (dalles.length > 1) lignesEtages.push(ligne('dalles-total', 'Total des dalles', 'm²', dalles.flatMap((l) => l.sources), undefined, true))
  ajouter('etages', 'Emprise et dalles par étage', lignesEtages)

  ajouter('murs', 'Murs', [ligne('murs', 'Longueur', 'ml', mesures.filter((m) => m.type === 'mur' && m.nature === 'longueur' && m.mesure != null).map((m) => m.source))])

  // Pièces : par étage, leur nombre et leur surface.
  const pieces = surfaces('piece')
  const piecesParFeuille = new Map<string, Mesure[]>()
  for (const m of pieces) piecesParFeuille.set(m.cleFeuille, [...(piecesParFeuille.get(m.cleFeuille) ?? []), m])
  const lignesPieces = [...piecesParFeuille.entries()].map(([cle, ms]) => {
    const sources = ms.map((m) => m.source)
    const mult = detailMultiplicateur(sources)
    return ligne(`pieces-${cle}`, ms[0].nomFeuille, 'm²', sources, [pluriel(ms.length, 'pièce', 'pièces'), mult].filter(Boolean).join(', '))
  })
  if (lignesPieces.length > 1) lignesPieces.push(ligne('pieces-total', 'Total des pièces', 'm²', pieces.map((m) => m.source), undefined, true))
  ajouter('pieces', 'Pièces', lignesPieces)

  // Une même fenêtre se voit sur le plan d'étage et sur l'élévation : quand
  // une catégorie est pointée sur des plans d'étage, ce sont eux qui font foi,
  // et les repères des autres vues ne sont pas recomptés. Sans plan d'étage
  // (une porte d'entrée vue seulement en façade), les autres vues comptent.
  ajouter('elements', 'Éléments comptés', CLES_CATEGORIES.map((c) => {
    const siens = reperes.filter((r) => r.categorie === c)
    const enPlan = siens.filter((r) => r.vue === 'plan_etage')
    const retenus = (enPlan.length ? enPlan : siens).map((r) => r.source)
    const autres = siens.length - retenus.length
    const detail = [
      detailMultiplicateur(retenus),
      autres ? `sans les ${pluriel(autres, 'repère', 'repères')} d’autres vues` : null,
    ].filter(Boolean).join(', ') || null
    return ligne(`element-${c}`, CATEGORIE[c].libelle, 'pce', retenus, detail)
  }))

  // Le reste : tracé à la main, validé d'une analyse d'avant les types, ou « autre ».
  const autres = mesures.filter((m) => (m.type == null || m.type === 'autre') && m.mesure != null)
  ajouter('autres', 'Autres mesures', [
    ligne('autres-surfaces', 'Surfaces', 'm²', autres.filter((m) => m.nature === 'surface').map((m) => m.source)),
    ligne('autres-longueurs', 'Longueurs', 'ml', autres.filter((m) => m.nature === 'longueur').map((m) => m.source)),
  ])

  return { groupes, aValider, sansEchelle }
}

function mesureDe(a: PlanAnnotation, nature: 'surface' | 'longueur', pxParM: number | null): number | null {
  if (!pxParM || pxParM <= 0) return null
  return nature === 'surface' ? airePolygone(a.points) / (pxParM * pxParM) : longueurPolyligne(a.points) / pxParM
}
