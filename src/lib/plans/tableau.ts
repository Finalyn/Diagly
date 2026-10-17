/**
 * La vue tableau des Métrés : une ligne par forme métrée, tout le jeu de
 * plans dans une seule grille, reliée à ses formes.
 *
 * Le panneau des quantités range par classification, puis par étage, puis par
 * forme : c'est une arborescence qu'on déplie. Un métreur veut aussi voir tout
 * à plat, comme dans le « Grid Report » des logiciels de métré : chaque forme
 * avec sa feuille, son étage, son local, sa quantité et ce qu'on en tire,
 * l'ouvrage CFC qui la reçoit, sa catégorie SIA 416, d'où elle vient et si
 * elle a été validée. On regroupe comme on veut (classification, étage,
 * ouvrage, feuille), on trie, on cherche, on filtre.
 *
 * Rien ne se recalcule ici : chaque ligne reprend la forme telle que le
 * panneau la compte (quantites.ts), et les sous-totaux passent par le même
 * calcul que lui (deriveesPonderees), sur les seules lignes du groupe. Sans
 * filtre, regroupé par classification, le tableau donne donc exactement les
 * totaux du panneau, étages identiques multipliés et propositions à valider
 * exclues. La catégorie SIA 416 suit la règle de sia416.ts.
 *
 * Module pur, sans canevas ni réseau, pour être vérifiable par les tests.
 */
import type { ConfianceZone, PlanAnnotation } from '../api-types'
import { provenanceDe } from './export-metres'
import {
  CLASSIFICATIONS, compteAuTotal, deriveesPonderees, entreesSia416, type CleClassification, type InstanceQ, type PanneauQuantites,
  type QuantiteDerivee,
} from './quantites'
import type { UniteRecap } from './recapitulatif'
import { affectationParDefaut, surfacesSia416, type CategorieSia416, type Sia416 } from './sia416'

// ---------------------------------------------------------------- provenance

/** D'où vient une forme, en quatre familles : de quoi filtrer et trier. */
export type Provenance = 'ia_aimantee' | 'ia' | 'manuel' | 'symbole'

export const NOMS_PROVENANCE: Record<Provenance, string> = {
  ia_aimantee: 'IA aimantée',
  ia: 'IA',
  manuel: 'Manuel',
  symbole: 'Symbole',
}

/**
 * La famille de provenance d'une forme, selon la même lecture que l'export
 * (provenanceDe) : aimantée quand ses sommets suivent les traits du dessin,
 * manuelle quand elle a été tracée, remplie ou comptée à la main.
 */
export function provenanceCourte(a: Pick<PlanAnnotation, 'proposition' | 'repere' | 'origine' | 'typeZone' | 'mesureExacte'> | null): Provenance {
  if (!a) return 'manuel'
  if (a.proposition) return a.proposition.aimantee ? 'ia_aimantee' : 'ia'
  if (a.repere) return a.origine === 'symbole' ? 'symbole' : a.origine ? 'manuel' : 'ia'
  if (a.origine || !a.typeZone) return 'manuel'
  return a.mesureExacte ? 'ia_aimantee' : 'ia'
}

// ---------------------------------------------------------------- lignes

/** Un ouvrage du relevé, tel que le tableau l'affiche. */
export interface OuvrageTableau {
  id: string
  cfcCode: string | null
  libelle: string
}

export interface ContexteTableau {
  /** Le numéro lu au cartouche et le titre d'une feuille. */
  feuille: (planId: string, page: number) => { numero: string | null; titre: string }
  /** La forme d'origine : provenance, ouvrage rattaché. */
  annotation: (planId: string, id: string) => PlanAnnotation | null
  ouvrages: OuvrageTableau[]
}

export interface LigneTableau {
  /** `planId#id` : unique dans tout le jeu. */
  cle: string
  id: string
  planId: string
  page: number
  /** La forme telle que le panneau la compte, pour les sous-totaux. */
  instance: InstanceQ
  classification: CleClassification
  titreClassification: string
  couleur: string
  /** `planId#page` */
  cleFeuille: string
  feuille: { numero: string | null; titre: string }
  /** Rang de la feuille dans le jeu : l'ordre des documents, puis des pages. */
  rang: number
  etage: string
  /** Étages identiques que la feuille représente. */
  multiplicateur: number
  nom: string
  nature: 'surface' | 'longueur' | 'comptage'
  /** Pour la forme seule, un étage ; null sans échelle. Un repère vaut 1. */
  quantite: number | null
  unite: UniteRecap
  /** Ce qu'on tire de la forme : plinthes, ouvertures et surface nette, face de mur. */
  derivees: QuantiteDerivee[]
  ouvrage: OuvrageTableau | null
  /** Une zone ou une longueur se rattache à un ouvrage ; un repère compté, non. */
  rattachable: boolean
  /** Pour une pièce : la catégorie choisie, ou devinée d'après le nom du local. */
  sia416: { categorie: CategorieSia416 | null; parDefaut: boolean } | null
  provenance: Provenance
  /** La provenance en clair, comme à l'export. */
  provenanceDetail: string
  confiance: ConfianceZone | null
  statut: 'a_valider' | 'valide'
  /** Validée mais hors des totaux : sans échelle, ou déjà comptée sur un plan d'étage. */
  horsTotal: string | null
  /** Entre dans les totaux. */
  compte: boolean
  /** Rang dans l'ordre naturel : feuille, classification, place dans la feuille. */
  ordre: number
}

export const cleDeLigne = (planId: string, id: string) => `${planId}#${id}`

/** Les lignes du tableau, dans l'ordre naturel. La forme en cours de tracé n'y figure pas. */
export function lignesDuTableau(panneau: PanneauQuantites, sia: Sia416, ctx: ContexteTableau): LigneTableau[] {
  // L'affectation SIA 416 telle que les surfaces la retiennent, pour les pièces validées.
  const affectees = new Map<string, { categorie: CategorieSia416 | null; parDefaut: boolean }>()
  for (const e of sia.etages) {
    const planId = e.cle.split('#')[0]
    for (const p of e.pieces) affectees.set(cleDeLigne(planId, p.id), { categorie: p.categorie, parDefaut: p.parDefaut })
  }
  const ouvrages = new Map(ctx.ouvrages.map((o) => [o.id, o]))
  const brutes: { ligne: LigneTableau; tri: [number, number, number] }[] = []
  panneau.classifications.forEach((c, ci) => {
    for (const e of c.etages) {
      e.instances.forEach((i, k) => {
        if (i.brouillon) return
        const cle = cleDeLigne(i.planId, i.id)
        const a = ctx.annotation(i.planId, i.id)
        const itemId = a?.itemId ?? null
        const ouvrage = itemId ? ouvrages.get(itemId) ?? { id: itemId, cfcCode: null, libelle: 'Ouvrage retiré du relevé' } : null
        let sia416: LigneTableau['sia416'] = null
        if (c.cle === 'pieces') {
          // Même règle que sia416.ts : le choix l'emporte, sinon le nom du local.
          const choisie = i.sia416 ?? null
          const devinee = choisie ?? affectationParDefaut(i.nom)
          sia416 = affectees.get(cle) ?? { categorie: devinee, parDefaut: !choisie && devinee != null }
        }
        const horsTotal = i.aValider ? null : i.horsTotal ?? (i.valeur == null ? 'sans échelle' : null)
        brutes.push({ tri: [e.rang, ci, k], ligne: {
          cle,
          id: i.id,
          planId: i.planId,
          page: i.page,
          instance: i,
          classification: c.cle,
          titreClassification: c.titre,
          couleur: i.couleur,
          cleFeuille: e.cle,
          feuille: ctx.feuille(i.planId, i.page),
          rang: e.rang,
          etage: e.nom,
          multiplicateur: e.multiplicateur,
          nom: i.nom,
          nature: i.nature,
          quantite: i.valeur,
          unite: i.unite,
          derivees: i.derivees,
          ouvrage,
          rattachable: i.nature !== 'comptage',
          sia416,
          provenance: provenanceCourte(a),
          provenanceDetail: provenanceDe(a),
          confiance: i.confiance,
          statut: i.aValider ? 'a_valider' : 'valide',
          horsTotal,
          compte: compteAuTotal(i),
          ordre: 0,
        } })
      })
    }
  })
  brutes.sort((x, y) => x.tri[0] - y.tri[0] || x.tri[1] - y.tri[1] || x.tri[2] - y.tri[2])
  return brutes.map(({ ligne }, ordre) => ({ ...ligne, ordre }))
}

// ---------------------------------------------------------------- totaux

/**
 * Le panneau réduit à certaines formes : mêmes classifications, mêmes
 * étages, mêmes calculs. C'est par lui que passent les sous-totaux d'un groupe
 * et le total des lignes affichées.
 */
export function panneauDesLignes(panneau: PanneauQuantites, garder: (cle: string) => boolean): PanneauQuantites {
  let aValider = 0
  let sansEchelle = 0
  const classifications = panneau.classifications.flatMap((c) => {
    const etages = c.etages.flatMap((e) => {
      const instances = e.instances.filter((i) => !i.brouillon && garder(cleDeLigne(i.planId, i.id)))
      if (!instances.length) return []
      return [{
        ...e,
        instances,
        derivees: deriveesPonderees(c.cle, instances.filter(compteAuTotal).map((i) => ({ i, mult: e.multiplicateur }))),
        aValider: instances.filter((i) => i.aValider).length,
      }]
    })
    if (!etages.length) return []
    const instances = etages.flatMap((e) => e.instances)
    const c2 = {
      ...c,
      etages,
      derivees: deriveesPonderees(c.cle, etages.flatMap((e) => e.instances.filter(compteAuTotal).map((i) => ({ i, mult: e.multiplicateur })))),
      aValider: instances.filter((i) => i.aValider).length,
      sansEchelle: instances.filter((i) => !i.aValider && i.valeur == null).length,
      nombre: instances.length,
    }
    aValider += c2.aValider
    sansEchelle += c2.sansEchelle
    return [c2]
  })
  return { classifications, aValider, sansEchelle }
}

/** Le total d'une classification dans un groupe : sa quantité principale d'abord, puis les dérivées. */
export interface TotalClassification {
  cle: CleClassification
  titre: string
  couleur: string
  derivees: QuantiteDerivee[]
  /** Formes listées, à valider comprises. */
  nombre: number
  aValider: number
}

function totauxDe(panneau: PanneauQuantites, lignes: LigneTableau[]): TotalClassification[] {
  const cles = new Set(lignes.map((l) => l.cle))
  return panneauDesLignes(panneau, (k) => cles.has(k)).classifications.map((c) => ({
    cle: c.cle, titre: c.titre, couleur: c.couleur, derivees: c.derivees, nombre: c.nombre, aValider: c.aValider,
  }))
}

// ---------------------------------------------------------------- filtrer

const comparable = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export interface FiltresTableau {
  recherche: string
  statut: 'tous' | 'a_valider' | 'valide'
  classification: CleClassification | null
  /** La feuille choisie dans le navigateur ; null pour tout le jeu. */
  feuille: { planId: string; page: number } | null
}

export const SANS_FILTRE: FiltresTableau = { recherche: '', statut: 'tous', classification: null, feuille: null }

/** Les lignes retenues par les filtres. La recherche lit le local, l'étage, la feuille, la classification et l'ouvrage. */
export function filtrerLignes(lignes: LigneTableau[], f: FiltresTableau): LigneTableau[] {
  const q = comparable(f.recherche.trim())
  return lignes.filter((l) => {
    if (f.statut !== 'tous' && l.statut !== f.statut) return false
    if (f.classification && l.classification !== f.classification) return false
    if (f.feuille && (l.planId !== f.feuille.planId || l.page !== f.feuille.page)) return false
    if (!q) return true
    const texte = [
      l.nom, l.etage, l.feuille.numero ?? '', l.feuille.titre, l.titreClassification,
      l.ouvrage ? `${l.ouvrage.cfcCode ?? ''} ${l.ouvrage.libelle}` : '', l.sia416?.categorie ?? '', NOMS_PROVENANCE[l.provenance],
    ].join(' ')
    return comparable(texte).includes(q)
  })
}

// ---------------------------------------------------------------- trier

export type ColonneTri =
  | 'ordre' | 'feuille' | 'etage' | 'nom' | 'classification' | 'quantite' | 'ouvrage' | 'sia416' | 'provenance' | 'confiance' | 'statut'

export interface Tri { colonne: ColonneTri; sens: 'asc' | 'desc' }

export const TRI_NATUREL: Tri = { colonne: 'ordre', sens: 'asc' }

const texte = (a: string, b: string) => a.localeCompare(b, 'fr', { numeric: true, sensitivity: 'base' })
const RANG_CONFIANCE: Record<ConfianceZone, number> = { haute: 0, moyenne: 1, basse: 2 }
const RANG_PROVENANCE: Record<Provenance, number> = { ia_aimantee: 0, ia: 1, symbole: 2, manuel: 3 }
const RANG_CLASSIFICATION = new Map(CLASSIFICATIONS.map((c, i) => [c.cle, i]))

/**
 * Compare deux lignes sur une colonne. Ce qui manque (une quantité sans
 * échelle, une ligne sans ouvrage, sans confiance) passe toujours en dernier,
 * dans un sens comme dans l'autre ; à égalité, l'ordre naturel départage.
 */
function comparer(a: LigneTableau, b: LigneTableau, tri: Tri): number {
  const s = tri.sens === 'asc' ? 1 : -1
  const manque = (x: unknown, y: unknown) => (x == null ? (y == null ? 0 : 1) : y == null ? -1 : null)
  let r = 0
  switch (tri.colonne) {
    case 'ordre': r = 0; break
    case 'feuille': r = s * (a.rang - b.rang); break
    case 'etage': r = s * texte(a.etage, b.etage) || s * (a.rang - b.rang); break
    case 'nom': r = s * texte(a.nom, b.nom); break
    case 'classification': r = s * ((RANG_CLASSIFICATION.get(a.classification) ?? 0) - (RANG_CLASSIFICATION.get(b.classification) ?? 0)); break
    case 'quantite': r = manque(a.quantite, b.quantite) ?? s * (a.quantite! - b.quantite!); break
    case 'ouvrage': r = manque(a.ouvrage, b.ouvrage) ?? s * texte(`${a.ouvrage!.cfcCode ?? ''} ${a.ouvrage!.libelle}`, `${b.ouvrage!.cfcCode ?? ''} ${b.ouvrage!.libelle}`); break
    case 'sia416': r = manque(a.sia416?.categorie, b.sia416?.categorie) ?? s * texte(a.sia416!.categorie!, b.sia416!.categorie!); break
    case 'provenance': r = s * (RANG_PROVENANCE[a.provenance] - RANG_PROVENANCE[b.provenance]); break
    case 'confiance': r = manque(a.confiance, b.confiance) ?? s * (RANG_CONFIANCE[a.confiance!] - RANG_CONFIANCE[b.confiance!]); break
    case 'statut': r = s * ((a.statut === 'a_valider' ? 0 : 1) - (b.statut === 'a_valider' ? 0 : 1)); break
  }
  return r || a.ordre - b.ordre
}

export function trierLignes(lignes: LigneTableau[], tri: Tri): LigneTableau[] {
  return [...lignes].sort((a, b) => comparer(a, b, tri))
}

// ---------------------------------------------------------------- regrouper

export type Regroupement = 'classification' | 'etage' | 'ouvrage' | 'feuille' | 'aucun'

export const REGROUPEMENTS: readonly { cle: Regroupement; libelle: string }[] = [
  { cle: 'classification', libelle: 'Classification' },
  { cle: 'etage', libelle: 'Étage' },
  { cle: 'ouvrage', libelle: 'Ouvrage CFC' },
  { cle: 'feuille', libelle: 'Feuille' },
  { cle: 'aucun', libelle: 'Aucun' },
]

export function estUnRegroupement(v: unknown): v is Regroupement {
  return typeof v === 'string' && REGROUPEMENTS.some((r) => r.cle === v)
}

export interface GroupeTableau {
  cle: string
  titre: string
  /** Un détail sous le titre : les étages identiques, le libellé de la feuille. */
  detail: string | null
  /** La couleur d'une classification ; null pour les autres regroupements. */
  couleur: string | null
  lignes: LigneTableau[]
  /** Par classification présente : ses totaux sur les lignes du groupe, étages identiques compris. */
  totaux: TotalClassification[]
  aValider: number
}

/** « 102 · Étage type », ou le seul titre quand la feuille n'a pas de numéro. */
export function libelleDeLaFeuille(f: { numero: string | null; titre: string }): string {
  return f.numero ? `${f.numero} · ${f.titre}` : f.titre
}

interface Paquet { cle: string; titre: string; detail: string | null; couleur: string | null; ordre: number | string; lignes: LigneTableau[] }

function paquets(lignes: LigneTableau[], mode: Regroupement): Paquet[] {
  if (mode === 'aucun') return [{ cle: 'tout', titre: 'Toutes les formes', detail: null, couleur: null, ordre: 0, lignes }]
  const parCle = new Map<string, Paquet>()
  for (const l of lignes) {
    let cle: string, titre: string, detail: string | null = null, couleur: string | null = null, ordre: number | string
    switch (mode) {
      case 'classification':
        cle = l.classification; titre = l.titreClassification; couleur = l.couleur
        ordre = RANG_CLASSIFICATION.get(l.classification) ?? 0
        break
      case 'etage':
        cle = comparable(l.etage.trim()); titre = l.etage
        detail = l.multiplicateur > 1 ? `× ${l.multiplicateur} étages identiques` : null
        ordre = l.rang
        break
      case 'feuille':
        cle = l.cleFeuille; titre = libelleDeLaFeuille(l.feuille)
        detail = l.multiplicateur > 1 ? `${l.etage} · × ${l.multiplicateur} étages identiques` : l.etage !== l.feuille.titre ? l.etage : null
        ordre = l.rang
        break
      case 'ouvrage':
        cle = l.ouvrage?.id ?? ''
        titre = l.ouvrage ? [l.ouvrage.cfcCode, l.ouvrage.libelle].filter(Boolean).join(' · ') : 'Sans ouvrage rattaché'
        // Les ouvrages dans l'ordre des codes CFC ; ce qui n'est rattaché à rien, à la fin.
        ordre = l.ouvrage ? `0 ${l.ouvrage.cfcCode ?? '~'} ${l.ouvrage.libelle}` : '1'
        break
    }
    const p = parCle.get(cle)
    if (p) {
      p.lignes.push(l)
      // Un étage présent sur plusieurs feuilles se range à la première.
      if (typeof ordre === 'number' && typeof p.ordre === 'number') p.ordre = Math.min(p.ordre, ordre)
    } else {
      parCle.set(cle, { cle, titre, detail, couleur, ordre, lignes: [l] })
    }
  }
  return [...parCle.values()].sort((a, b) => (typeof a.ordre === 'number' && typeof b.ordre === 'number'
    ? a.ordre - b.ordre
    : texte(String(a.ordre), String(b.ordre))))
}

/**
 * Ce que l'écran retient du tableau quand on part voir une forme sur le plan
 * et qu'on revient : la recherche, les filtres, le tri, la sélection, les
 * groupes repliés.
 */
export interface EtatTableau {
  recherche: string
  statut: FiltresTableau['statut']
  classification: CleClassification | null
  tri: Tri
  /** Clés des lignes cochées (`planId#id`). */
  selection: ReadonlySet<string>
  /** Clés des groupes repliés. */
  replies: ReadonlySet<string>
}

export const ETAT_TABLEAU_INITIAL: EtatTableau = {
  recherche: '', statut: 'tous', classification: null, tri: TRI_NATUREL, selection: new Set(), replies: new Set(),
}

export interface VueTableau {
  groupes: GroupeTableau[]
  /** Le total général des lignes affichées, par classification. */
  totaux: TotalClassification[]
  /** Les surfaces SIA 416 des pièces affichées ; null sans pièce ni emprise. */
  sia: Sia416 | null
  nombre: number
  aValider: number
}

export interface OptionsVue {
  filtres: FiltresTableau
  regroupement: Regroupement
  tri: Tri
}

/** Le tableau tel qu'il s'affiche : filtré, regroupé, trié, avec ses sous-totaux et son total. */
export function vueDuTableau(panneau: PanneauQuantites, lignes: LigneTableau[], o: OptionsVue): VueTableau {
  const retenues = filtrerLignes(lignes, o.filtres)
  const groupes = paquets(retenues, o.regroupement).map((p) => ({
    cle: p.cle,
    titre: p.titre,
    detail: p.detail,
    couleur: p.couleur,
    lignes: trierLignes(p.lignes, o.tri),
    totaux: totauxDe(panneau, p.lignes),
    aValider: p.lignes.filter((l) => l.statut === 'a_valider').length,
  }))
  const cles = new Set(retenues.map((l) => l.cle))
  const reduit = panneauDesLignes(panneau, (k) => cles.has(k))
  const sia = surfacesSia416(entreesSia416(reduit))
  return {
    groupes,
    totaux: reduit.classifications.map((c) => ({ cle: c.cle, titre: c.titre, couleur: c.couleur, derivees: c.derivees, nombre: c.nombre, aValider: c.aValider })),
    sia: sia.etages.length ? sia : null,
    nombre: retenues.length,
    aValider: retenues.filter((l) => l.statut === 'a_valider').length,
  }
}
