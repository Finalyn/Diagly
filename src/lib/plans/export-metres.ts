/**
 * Le métré d'un jeu de plans, mis en lignes pour le classeur Excel.
 *
 * Trois onglets, comme le demande un métreur qui reprend les chiffres ailleurs :
 *
 * - « Récapitulatif » : hiérarchique, comme le panneau, chaque classification
 *   détaillée par étage puis totalisée ;
 * - « Détail » : une ligne par forme mesurée, avec sa feuille, son étage, son
 *   local, sa quantité, sa provenance et son statut, de quoi filtrer ou
 *   croiser dans un tableau ;
 * - « SIA 416 » : les surfaces par étage, puis le total, avec la mention qui
 *   rappelle qu'elles sont à vérifier.
 *
 * Unités suisses (m², ml, pce), arrondies au centième : c'est l'usage des
 * soumissions romandes. Le classeur lui-même est écrit par le serveur, avec
 * la bibliothèque de l'export des diagnostics (server/src/lib/export-metres.ts).
 *
 * Module pur, sans réseau, pour être vérifiable par les tests.
 */
import type { PlanAnnotation } from '../api-types'
import type { UniteRecap } from './recapitulatif'
import type { ClassificationQ, InstanceQ, PanneauQuantites } from './quantites'
import { CATEGORIES_SIA416, MENTION_SIA416, NOMS_SIA416, type Sia416 } from './sia416'

export interface LigneRecapExport {
  classification: string
  /** null sur une ligne de total. */
  etage: string | null
  designation: string
  quantite: number
  unite: UniteRecap
  detail: string | null
  total: boolean
}

export interface LigneDetailExport {
  feuille: string
  etage: string
  local: string
  classification: string
  /** Pour la forme seule, avant multiplication ; null sans échelle. */
  quantite: number | null
  unite: UniteRecap
  etagesIdentiques: number
  provenance: string
  statut: string
}

export interface LigneSiaExport {
  etage: string
  etagesIdentiques: number
  grandeur: string
  /** Pour un étage ; null quand elle n'est pas connue (SP sans emprise). */
  parEtage: number | null
  total: number | null
  remarque: string | null
  estTotal: boolean
}

export interface ExportMetres {
  batiment: string
  adresse: string
  /** Date du jour, au format suisse. */
  le: string
  mention: string
  recapitulatif: LigneRecapExport[]
  detail: LigneDetailExport[]
  sia416: LigneSiaExport[]
}

export const arrondi2 = (v: number) => Math.round(v * 100) / 100
const NOMBRE = new Intl.NumberFormat('fr-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** D'où vient une forme, en clair. */
export function provenanceDe(a: Pick<PlanAnnotation, 'proposition' | 'repere' | 'origine' | 'typeZone' | 'mesureExacte'> | null): string {
  if (!a) return 'Tracé à la main'
  if (a.proposition) return a.proposition.aimantee ? 'IA, aimantée sur le dessin' : 'IA, placée à l’œil'
  if (a.repere) return a.origine === 'symbole' ? 'Recherche de symbole' : a.origine ? 'Compté à la main' : 'IA'
  if (a.origine === 'remplissage') return 'Remplissage d’un clic'
  if (a.origine === 'main' || !a.typeZone) return 'Tracé à la main'
  return a.mesureExacte ? 'IA, aimantée sur le dessin' : 'IA'
}

function statutDe(i: InstanceQ): string {
  if (i.aValider) return 'À valider'
  if (i.horsTotal) return `Hors total (${i.horsTotal})`
  if (i.valeur == null) return 'Sans échelle'
  return 'Validé'
}

function lignesDeClassification(c: ClassificationQ): LigneRecapExport[] {
  const lignes: LigneRecapExport[] = []
  for (const e of c.etages) {
    // Un étage dont rien n'entre au total (repères déjà comptés en plan, propositions) n'a pas de ligne.
    if (e.instances.every((i) => i.aValider || i.horsTotal || i.valeur == null || i.brouillon)) continue
    for (const d of e.derivees) {
      if (d.valeur === 0 && d !== e.derivees[0]) continue
      lignes.push({
        classification: c.titre, etage: e.nom, designation: d.libelle, quantite: arrondi2(d.valeur), unite: d.unite,
        // La quantité de la ligne compte déjà chaque étage que la feuille représente.
        detail: e.multiplicateur > 1 ? `${e.multiplicateur} étages identiques compris` : null, total: false,
      })
    }
  }
  for (const d of c.derivees) {
    if (d.valeur === 0 && d !== c.derivees[0]) continue
    lignes.push({
      classification: c.titre, etage: null, designation: `Total ${d.libelle.toLowerCase()}`, quantite: arrondi2(d.valeur), unite: d.unite,
      detail: c.etages.some((e) => e.multiplicateur > 1) ? 'étages identiques compris' : null, total: true,
    })
  }
  return lignes
}

export function exportDuMetre(
  panneau: PanneauQuantites,
  sia: Sia416,
  contexte: {
    batiment: string
    adresse: string
    /** Le nom de la feuille d'un plan et d'une page : « 102 · Étage type (1er au 3e) ». */
    feuille: (planId: string, page: number) => string
    /** La forme d'origine, pour dire sa provenance. */
    annotation: (planId: string, id: string) => PlanAnnotation | null
    date?: Date
  },
): ExportMetres {
  const recapitulatif = panneau.classifications.flatMap(lignesDeClassification)
  const detail: LigneDetailExport[] = panneau.classifications.flatMap((c) => c.etages.flatMap((e) => e.instances
    .filter((i) => !i.brouillon)
    .map((i) => ({
      feuille: contexte.feuille(i.planId, i.page),
      etage: e.nom,
      local: i.nom,
      classification: c.titre,
      quantite: i.valeur == null ? null : arrondi2(i.valeur),
      unite: i.unite,
      etagesIdentiques: e.multiplicateur,
      provenance: provenanceDe(contexte.annotation(i.planId, i.id)),
      statut: statutDe(i),
    }))))

  const lignesSia: LigneSiaExport[] = []
  const grandeur = (etage: string, k: number, nom: string, v: number | null, remarque: string | null = null, estTotal = false) => {
    lignesSia.push({
      etage, etagesIdentiques: k, grandeur: nom,
      parEtage: v == null || estTotal ? null : arrondi2(v),
      total: v == null ? null : arrondi2(estTotal ? v : v * k),
      remarque, estTotal,
    })
  }
  for (const e of sia.etages) {
    grandeur(e.nom, e.multiplicateur, 'SP, surface de plancher', e.sp, e.sourceSp === 'dalle' ? 'prise sur la dalle' : e.sourceSp === 'emprise' ? 'emprise au nu extérieur' : 'sans emprise ni dalle')
    grandeur(e.nom, e.multiplicateur, 'SN, surface nette', e.sn, `${e.pieces.length} pièce${e.pieces.length > 1 ? 's' : ''}`)
    grandeur(e.nom, e.multiplicateur, 'SC, surface de construction', e.sc, 'SP moins SN')
    for (const c of CATEGORIES_SIA416) grandeur(e.nom, e.multiplicateur, `${c}, ${NOMS_SIA416[c].toLowerCase()}`, e.categories[c])
    if (e.nonAffectee > 0) grandeur(e.nom, e.multiplicateur, 'Pièces non affectées', e.nonAffectee, 'à affecter')
  }
  const t = sia.total
  grandeur('Total', 0, 'SP, surface de plancher', t.sp, t.sp == null ? 'un étage sans emprise ni dalle' : null, true)
  grandeur('Total', 0, 'SN, surface nette', t.sn, null, true)
  grandeur('Total', 0, 'SC, surface de construction', t.sc, null, true)
  grandeur('Total', 0, 'SU, surface utile (SUP + SUS)', t.su, null, true)
  for (const c of CATEGORIES_SIA416) grandeur('Total', 0, `${c}, ${NOMS_SIA416[c].toLowerCase()}`, t.categories[c], null, true)
  if (t.nonAffectee > 0) grandeur('Total', 0, 'Pièces non affectées', t.nonAffectee, 'à affecter', true)

  return {
    batiment: contexte.batiment,
    adresse: contexte.adresse,
    le: new Intl.DateTimeFormat('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(contexte.date ?? new Date()),
    mention: MENTION_SIA416,
    recapitulatif,
    detail,
    sia416: lignesSia,
  }
}

/** Le nom du fichier : « Metre_Immeuble-Les-Essais_2026-10-17.xlsx ». */
export function nomDuClasseur(batiment: string, date = new Date()): string {
  const propre = batiment.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'batiment'
  return `Metre_${propre}_${date.toISOString().slice(0, 10)}.xlsx`
}

/** « 1 234,56 » : pour les messages, pas pour le classeur, qui garde des nombres. */
export const nombreLisible = (v: number) => NOMBRE.format(v)
