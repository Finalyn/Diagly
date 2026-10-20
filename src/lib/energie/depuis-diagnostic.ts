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
  works?: string[]
  notes?: string | null
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
  /** Les ouvrages qui ont donné l'état retenu, nommés : « Façade crépie (Bon) ». */
  origines: Record<string, string[]>
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
  const parElement: Record<string, { nom: string; etat: Etat }[]> = {}

  for (const o of ouvrages) {
    const cible = elementDuCfc(o.cfcCode)
    if (!cible) continue
    const etat = etatDepuisApi(o.state)
    if (etat == null) continue
    comptes[cible] = (comptes[cible] ?? 0) + 1
    // Le plus mauvais l'emporte : une façade dont un pan est en ruine n'est pas moyenne.
    pire[cible] = Math.max(pire[cible] ?? 1, etat) as Etat
    ;(parElement[cible] ??= []).push({ nom: o.cfcLabel ?? o.cfcCode, etat })
  }
  const MOTS = ['', 'Très bon', 'Bon', 'Moyen', 'Mauvais']
  const origines: Record<string, string[]> = {}
  for (const [cible, liste] of Object.entries(parElement)) {
    origines[cible] = liste.filter((x) => x.etat === pire[cible]).map((x) => `${x.nom} (${MOTS[x.etat]})`)
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
    origines,
  }
}

export type SourceAgent = 'releve' | 'dossier' | 'defaut'

/**
 * L'agent énergétique, tel que le relevé le dit.
 *
 * La production de chaleur relevée au chapitre 3 (« Chaudière gaz ») passe
 * d'abord, puis l'agent du dossier (certificat, registre). Sans l'un ni
 * l'autre seulement, la valeur par défaut, et le rapport le dit. Le chapitre
 * énergie annonçait « mazout, chaudière ancienne » à côté d'une chaudière gaz
 * relevée sur place.
 */
export function agentDuReleve(
  ouvrages: OuvrageReleve[],
  agentDuDossier: string | null | undefined,
): { agent: string; source: SourceAgent } | null {
  const production = ouvrages
    .filter((o) => elementDuCfc(o.cfcCode) === 'production' && o.state)
    .map((o) => [o.cfcLabel, ...(o.works ?? []), o.notes].filter(Boolean).join(' '))
  for (const texte of production) {
    const a = agentDuTexte(texte)
    if (a) return { agent: a, source: 'releve' }
  }
  const a = agentDuDossier ? agentDuTexte(agentDuDossier) : null
  return a ? { agent: a, source: 'dossier' } : null
}

/** L'agent qu'un texte nomme, ou null. */
export function agentDuTexte(texte: string): string | null {
  const t = texte.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const condensation = /condens/.test(t)
  if (/pompe a chaleur|\bpac\b/.test(t)) return /sol|geotherm|sonde|eau-eau|eau eau/.test(t) ? 'PAC_SOL_EAU' : 'PAC_AIR_EAU'
  if (/\bgaz\b/.test(t)) return condensation ? 'GAZ_CONDENSATION' : 'GAZ_ANCIEN'
  if (/mazout|fioul|\bhuile\b/.test(t)) return condensation ? 'MAZOUT_CONDENSATION' : 'MAZOUT_ANCIEN'
  if (/\bbois\b|pellet|plaquette|granule/.test(t)) return 'BOIS'
  if (/chauffage a distance|\bcad\b|reseau de chaleur|thermoreseau/.test(t)) return 'CAD'
  if (/electrique/.test(t)) return 'ELECTRIQUE_DIRECT'
  return null
}
