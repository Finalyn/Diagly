import parametres from './parametres.json'
import type { ElementEnveloppe, Etat, EtatElement } from './calcul'

/**
 * Ce que le diagnostic apporte à l'estimation énergétique.
 *
 * Le diagnostiqueur a déjà relevé l'état de la toiture, des façades, des fenêtres.
 * Le lui redemander serait à la fois une perte de temps et une source de
 * divergence : deux écrans finiraient par dire deux choses du même bâtiment.
 *
 * La correspondance entre codes CFC et éléments vit dans parametres.json, et elle
 * demande une relecture : un préfixe oublié rend un élément muet.
 */

export type EtatApi = 'TRES_BON' | 'BON' | 'MOYEN' | 'MAUVAIS' | null | undefined

export interface OuvrageReleve {
  cfcCode: string
  state: EtatApi
  cfcLabel?: string
}

const ETATS: Record<string, Etat> = { TRES_BON: 1, BON: 2, MOYEN: 3, MAUVAIS: 4 }

export const etatDepuisApi = (s: EtatApi): Etat | null => (s ? ETATS[s] ?? null : null)

const CORRESPONDANCE = parametres.correspondanceCfc as unknown as Record<string, string[]>

const ELEMENTS: ElementEnveloppe[] = ['toiture', 'facades', 'fenetres', 'sol', 'ventilation']

/** L'élément auquel un code CFC se rattache, ou null s'il n'alimente rien. */
export function elementDuCfc(cfcCode: string): ElementEnveloppe | 'production' | null {
  const code = (cfcCode ?? '').trim()
  for (const [element, prefixes] of Object.entries(CORRESPONDANCE)) {
    if (element.startsWith('_')) continue
    if (prefixes.some((p) => code.startsWith(p))) {
      return element as ElementEnveloppe | 'production'
    }
  }
  return null
}

export interface RepriseDiagnostic {
  elements: Record<ElementEnveloppe, EtatElement>
  etatProduction: Etat
  /** Éléments qu'aucun ouvrage relevé n'a renseignés : ils sont restés au défaut. */
  manquants: (ElementEnveloppe | 'production')[]
  /** Combien d'ouvrages ont alimenté chaque élément, pour pouvoir le dire à l'écran. */
  comptes: Record<string, number>
}

/**
 * Reprend les états du diagnostic.
 *
 * `defaut` est l'état attribué à un élément qu'aucun ouvrage ne renseigne. Il vaut
 * 3 (moyen) : poser 1 ferait passer pour excellent ce qui n'a simplement pas été
 * regardé, et l'estimation mentirait dans le sens le plus flatteur.
 */
export function reprendreDuDiagnostic(ouvrages: OuvrageReleve[], defaut: Etat = 3): RepriseDiagnostic {
  const pire: Record<string, Etat> = {}
  const comptes: Record<string, number> = {}

  for (const o of ouvrages) {
    const cible = elementDuCfc(o.cfcCode)
    if (!cible) continue
    const etat = etatDepuisApi(o.state)
    if (etat == null) continue
    comptes[cible] = (comptes[cible] ?? 0) + 1
    // Le plus mauvais l'emporte : une façade dont un pan est en ruine n'est pas moyenne.
    pire[cible] = Math.max(pire[cible] ?? 1, etat) as Etat
  }

  const manquants: (ElementEnveloppe | 'production')[] = []
  const elements = {} as Record<ElementEnveloppe, EtatElement>

  for (const e of ELEMENTS) {
    if (pire[e] == null) manquants.push(e)
    elements[e] = { etat: pire[e] ?? defaut, anneeRenovation: null }
  }
  if (pire.production == null) manquants.push('production')

  return {
    elements,
    etatProduction: pire.production ?? defaut,
    manquants,
    comptes,
  }
}
