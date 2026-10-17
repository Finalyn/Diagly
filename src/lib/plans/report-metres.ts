/**
 * Ce que l'outil Métrés reporte au dossier, et la phrase qui le dit avant.
 *
 * Deux mécanismes existent déjà, et le report les reprend tels quels :
 *
 * - les éléments comptés (portes, fenêtres, cuisines…) vont dans les
 *   comptages du dossier, qui donnent ensuite la quantité des ouvrages comptés
 *   (base-cfc/comptages.ts) ;
 * - les zones rattachées à un ouvrage donnent la quantité de cet ouvrage,
 *   comme depuis l'onglet Plans (plan-quantites.ts, reportPossible).
 *
 * Les Métrés y ajoutent les étages types : une porte palière pointée sur
 * l'étage type du 1er au 3e compte trois fois, une zone aussi. Et rien ne
 * s'écrit sans qu'on ait lu, avant, ce qui va changer.
 *
 * Module pur, sans réseau, pour être vérifiable par les tests.
 */
import type { ApiPlan, FeuillesPlan } from '../api-types'
import { CATEGORIE, CLES_CATEGORIES, ceQuiChange, type Comptage, type Comptages } from '../base-cfc/comptages'
import { apportsDesPlans, arrondiQuantite, reportPossible, type ApportPlan, type Reportable } from '../plan-quantites'
import { feuilleDe, multiplicateur } from './feuilles'
import type { PanneauQuantites } from './quantites'

/**
 * Les comptages que donnent les repères validés du jeu, étages types
 * multipliés. Une catégorie sans repère validé n'y figure pas : son comptage
 * au dossier, s'il existe, reste tel quel.
 */
export function comptagesDuJeu(panneau: PanneauQuantites, le = new Date().toISOString()): Comptages {
  const elements = panneau.classifications.find((c) => c.cle === 'elements')
  if (!elements) return {}
  const r: Comptages = {}
  for (const categorie of CLES_CATEGORIES) {
    const parts: { nom: string; n: number; mult: number }[] = []
    for (const e of elements.etages) {
      const n = e.instances.filter((i) => i.categorie === categorie && !i.aValider && !i.horsTotal).length
      if (n) parts.push({ nom: e.nom, n, mult: e.multiplicateur })
    }
    if (!parts.length) continue
    const nombre = parts.reduce((s, p) => s + p.n * p.mult, 0)
    const detail = parts.length === 1 && parts[0].mult === 1
      ? null
      : `${parts.map((p) => (p.mult > 1 ? `${p.n} × ${p.mult} étages (${p.nom})` : `${p.n} (${p.nom})`)).join(' + ')} = ${nombre}`
    const comptage: Comptage = {
      categorie, nombre, surface: null, source: 'plans', detail,
      pages: parts.map((p) => p.nom), confiance: null, valide: true, majLe: le,
    }
    r[categorie] = comptage
  }
  return r
}

/** Les quantités des zones rattachées à un ouvrage, étages types multipliés. */
export function apportsDuJeu(jeu: { plan: Pick<ApiPlan, 'id' | 'name' | 'scalePxPerM' | 'annotations'>; feuilles: FeuillesPlan }[]): Map<string, ApportPlan> {
  const feuilles = new Map(jeu.map((x) => [x.plan.id, x.feuilles]))
  return apportsDesPlans(
    jeu.map((x) => x.plan),
    (planId, page) => multiplicateur(feuilleDe(feuilles.get(planId) ?? { pages: {} }, page)),
  )
}

/** Un ouvrage du relevé, tel que le report le lit. */
export interface OuvrageReporte {
  id: string
  cfcCode: string | null
  cfcLabel: string
  unit: string | null
  area: number | null
}

export interface LigneOuvrage {
  ouvrage: OuvrageReporte
  apport: ApportPlan
  verdict: Reportable
}

export interface ResumeReport {
  comptages: Comptages
  /** Ce que le report des comptages remplace, en phrases (ceQuiChange). */
  remplacements: string[]
  /** Une ligne par catégorie reportée : « Portes palières : 6 (au dossier : 4) ». */
  lignesComptages: string[]
  ouvrages: LigneOuvrage[]
  /** Ce qui s'écrira vraiment : comptages, et ouvrages dont le report est possible. */
  aEcrire: number
}

const fr2 = (v: number) => String(arrondiQuantite(v)).replace('.', ',')

/** Ce que le report écrirait, sans rien écrire. */
export function resumeDuReport(
  panneau: PanneauQuantites,
  jeu: { plan: Pick<ApiPlan, 'id' | 'name' | 'scalePxPerM' | 'annotations'>; feuilles: FeuillesPlan }[],
  existants: Comptages,
  ouvrages: OuvrageReporte[],
): ResumeReport {
  const comptages = comptagesDuJeu(panneau)
  const lignesComptages = CLES_CATEGORIES.flatMap((c) => {
    const x = comptages[c]
    if (!x) return []
    const avant = existants[c]
    return [`${CATEGORIE[c].libelle} : ${x.nombre}${avant ? ` (au dossier : ${avant.nombre})` : ' (nouveau)'}`]
  })
  const apports = apportsDuJeu(jeu)
  const lignes: LigneOuvrage[] = [...apports.values()].flatMap((apport) => {
    const ouvrage = ouvrages.find((o) => o.id === apport.itemId)
    return ouvrage ? [{ ouvrage, apport, verdict: reportPossible(apport, ouvrage) }] : []
  }).sort((a, b) => (a.ouvrage.cfcCode ?? '').localeCompare(b.ouvrage.cfcCode ?? '', undefined, { numeric: true }))
  const changes = CLES_CATEGORIES.filter((c) => {
    const x = comptages[c], a = existants[c]
    return x && (!a || a.nombre !== x.nombre)
  }).length
  return {
    comptages,
    remplacements: ceQuiChange(existants, comptages),
    lignesComptages,
    ouvrages: lignes,
    aEcrire: changes + lignes.filter((l) => l.verdict.ok).length,
  }
}

/** « 23,52 m² » ou « 18 ml » : la quantité d'un apport, telle qu'elle partira. */
export function quantiteDeLApport(a: ApportPlan): string {
  return `${fr2(a.total)} ${a.nature === 'surface' ? 'm²' : 'ml'}`
}
