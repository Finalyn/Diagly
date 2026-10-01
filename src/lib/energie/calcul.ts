import parametres from './parametres.json'

/**
 * Estimation énergétique indicative, méthode simplifiée inspirée du CECB.
 *
 * Ce n'est PAS un CECB. Seul un expert CECB certifié peut délivrer un certificat
 * officiel, et rien ici ne doit être présenté autrement.
 *
 * Le module ne connaît ni React ni l'API : il prend des nombres, il rend des
 * nombres, et il rend aussi la trace de son raisonnement. Cette trace n'est pas
 * un ornement : une estimation qu'on ne peut pas ouvrir ne se discute pas avec un
 * propriétaire, et ne se corrige pas quand un paramètre se révèle faux.
 *
 * Toutes les constantes vivent dans parametres.json. Certaines y sont marquées
 * « à valider » : voir `tablesProvisoires()`.
 */

export const PARAMETRES = parametres

export type Categorie = 'INDIVIDUEL' | 'COLLECTIF' | 'ADMINISTRATIF'
export type Etat = 1 | 2 | 3 | 4
export type ElementEnveloppe = 'toiture' | 'facades' | 'fenetres' | 'sol' | 'ventilation'
export type Classe = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'

/** Agents disponibles, lus depuis la configuration (les clés en _ sont des commentaires). */
export const AGENTS = Object.keys(parametres.agents).filter((k) => !k.startsWith('_'))
export type Agent = string

export interface EtatElement {
  /** 1 très bon, 2 bon, 3 moyen, 4 mauvais. */
  etat: Etat
  /** Année d'une rénovation énergétique déjà faite sur cet élément. */
  anneeRenovation?: number | null
}

export interface EntreeEnergie {
  anneeConstruction: number
  categorie: Categorie
  /** Surface de référence énergétique, m². */
  sre: number
  agentChauffage: Agent
  /** État de la production de chaleur, 1 à 4. Dégrade le rendement à 3 et 4. */
  etatProduction: Etat
  /** Agent de l'ECS quand elle est séparée du chauffage. Sinon null. */
  agentEcs?: Agent | null
  /** Puissance photovoltaïque installée, kWc. */
  photovoltaiqueKwc?: number | null
  elements: Record<ElementEnveloppe, EtatElement>
}

/** Une étape du calcul, telle qu'elle s'affiche derrière « voir le calcul ». */
export interface Ligne {
  libelle: string
  detail: string
  valeur: number
  unite?: string
}

export interface ResultatEnveloppe {
  qh: number
  qhBase: number
  qhLimite: number
  ratio: number
  classe: Classe
  lignes: Ligne[]
}

export interface ResultatGlobal {
  qww: number
  rendement: number
  energieFinale: number
  apportPv: number
  energiePonderee: number
  classe: Classe
  lignes: Ligne[]
}

export interface Resultat {
  enveloppe: ResultatEnveloppe
  global: ResultatGlobal
  /** Tables encore provisoires au moment du calcul. Vide = tout est validé. */
  provisoire: string[]
}

const ELEMENTS: ElementEnveloppe[] = ['toiture', 'facades', 'fenetres', 'sol', 'ventilation']

const LIBELLES: Record<ElementEnveloppe, string> = {
  toiture: 'Toiture et dalle sous combles',
  facades: 'Façades',
  fenetres: 'Fenêtres',
  sol: 'Dalle sur sous-sol et sol',
  ventilation: 'Ventilation et étanchéité',
}

export const libelleElement = (e: ElementEnveloppe) => LIBELLES[e]

/**
 * Les tables dont les valeurs sont encore provisoires.
 *
 * L'interface doit le dire. Une estimation calculée sur une table de pondération
 * inventée reste un chiffre faux, et le mot « indicative » ne le rattrape pas.
 */
export const tablesProvisoires = (): string[] => parametres.aValider

/** Besoin de chauffage de base, selon la période de construction. */
export function besoinDeBase(annee: number): { valeur: number; libelle: string } {
  const p = parametres.besoinDeBase.periodes.find((x) => annee <= x.jusqua)
    ?? parametres.besoinDeBase.periodes[parametres.besoinDeBase.periodes.length - 1]
  return { valeur: p.valeur, libelle: p.libelle }
}

const coefEtat = (etat: Etat): number =>
  (parametres.coefEtat as unknown as Record<string, number>)[String(etat)] ?? 1

const part = (e: ElementEnveloppe): number =>
  (parametres.partsDeperdition as Record<string, number>)[e] ?? 0

const agent = (cle: Agent) =>
  (parametres.agents as unknown as Record<string, { libelle: string; rendement: number; ponderation: number }>)[cle]

export const libelleAgent = (cle: Agent): string => agent(cle)?.libelle ?? cle

const arrondi = (v: number, d = 1): number => Math.round(v * 10 ** d) / 10 ** d

/**
 * Classe de l'enveloppe.
 *
 * Chaque élément apporte sa part de déperdition, corrigée par son état. Un
 * élément déjà rénové n'apporte pas la déperdition de l'année de construction du
 * bâtiment mais celle de l'année de sa rénovation : c'est tout l'intérêt de poser
 * la question, et c'est ce qui permet au scénario après travaux de se calculer
 * avec la même formule.
 */
export function calculerEnveloppe(entree: EntreeEnergie): ResultatEnveloppe {
  const base = besoinDeBase(entree.anneeConstruction)
  const lignes: Ligne[] = [{
    libelle: 'Besoin de chauffage de base',
    detail: `Période de construction ${base.libelle}`,
    valeur: base.valeur,
    unite: 'kWh/m²·an',
  }]

  let qh = 0
  for (const e of ELEMENTS) {
    const etatEl = entree.elements[e]
    const p = part(e)
    const ce = coefEtat(etatEl.etat)
    const renove = etatEl.anneeRenovation != null
    const baseEl = renove ? besoinDeBase(etatEl.anneeRenovation!) : base
    const apport = p * ce * baseEl.valeur
    qh += apport
    lignes.push({
      libelle: LIBELLES[e],
      detail: renove
        ? `${Math.round(p * 100)} % des déperditions, état ${etatEl.etat} (coefficient ${ce}), rénové en ${etatEl.anneeRenovation} donc base ${baseEl.valeur} (${baseEl.libelle})`
        : `${Math.round(p * 100)} % des déperditions, état ${etatEl.etat} (coefficient ${ce}), base ${baseEl.valeur}`,
      valeur: arrondi(apport),
      unite: 'kWh/m²·an',
    })
  }

  const qhLimite = (parametres.qhLimite as unknown as Record<string, number>)[entree.categorie] ?? 40
  const ratio = qh / qhLimite

  lignes.push(
    { libelle: 'Besoin de chauffage Qh', detail: 'Somme des apports', valeur: arrondi(qh), unite: 'kWh/m²·an' },
    { libelle: 'Valeur limite du neuf', detail: `Catégorie ${entree.categorie.toLowerCase()}`, valeur: qhLimite, unite: 'kWh/m²·an' },
    { libelle: 'Ratio', detail: `${arrondi(qh)} divisé par ${qhLimite}`, valeur: arrondi(ratio, 2) },
  )

  return { qh, qhBase: base.valeur, qhLimite, ratio, classe: classeEnveloppe(ratio), lignes }
}

export function classeEnveloppe(ratio: number): Classe {
  for (const s of parametres.seuilsEnveloppe) {
    if (s.ratioMax == null || ratio <= s.ratioMax) return s.classe as Classe
  }
  return 'G'
}

export function classeGlobale(energiePonderee: number): Classe {
  for (const s of parametres.seuilsGlobal.paliers) {
    if (s.max == null || energiePonderee <= s.max) return s.classe as Classe
  }
  return 'G'
}

/**
 * Classe globale : chauffage et eau chaude, convertis en énergie finale puis
 * pondérés selon l'agent, moins ce que le photovoltaïque couvre sur place.
 */
export function calculerGlobal(entree: EntreeEnergie, qh: number): ResultatGlobal {
  const qww = (parametres.besoinECS as unknown as Record<string, number>)[entree.categorie] ?? 14
  const a = agent(entree.agentChauffage)
  if (!a) throw new Error(`Agent énergétique inconnu : ${entree.agentChauffage}`)

  const degrade = parametres.degradationRendement.etatsConcernes.includes(entree.etatProduction)
  const rendement = degrade ? a.rendement * (1 - parametres.degradationRendement.part) : a.rendement

  const energieFinale = (qh + qww) / rendement
  const energieAvantPv = energieFinale * a.ponderation

  const kwc = entree.photovoltaiqueKwc ?? 0
  const pv = parametres.photovoltaique
  // Ramené au mètre carré de SRE, comme tout le reste. Sans SRE, pas d'apport :
  // mieux vaut ne rien déduire que déduire n'importe quoi.
  const apportPv = kwc > 0 && entree.sre > 0
    ? (kwc * pv.productionParKwc * pv.partAutoconsommee) / entree.sre
    : 0

  const energiePonderee = Math.max(0, energieAvantPv - apportPv)

  const lignes: Ligne[] = [
    { libelle: 'Besoin de chauffage Qh', detail: "Issu du calcul de l'enveloppe", valeur: arrondi(qh), unite: 'kWh/m²·an' },
    { libelle: 'Eau chaude sanitaire', detail: `Forfait catégorie ${entree.categorie.toLowerCase()}`, valeur: qww, unite: 'kWh/m²·an' },
    {
      libelle: 'Rendement du système',
      detail: degrade
        ? `${libelleAgent(entree.agentChauffage)}, rendement ${a.rendement} dégradé de ${Math.round(parametres.degradationRendement.part * 100)} % car la production est en état ${entree.etatProduction}`
        : `${libelleAgent(entree.agentChauffage)}`,
      valeur: arrondi(rendement, 2),
    },
    { libelle: 'Énergie finale', detail: `(${arrondi(qh)} + ${qww}) divisé par ${arrondi(rendement, 2)}`, valeur: arrondi(energieFinale), unite: 'kWh/m²·an' },
    { libelle: 'Pondération', detail: `Facteur ${a.ponderation} pour ${libelleAgent(entree.agentChauffage)}`, valeur: a.ponderation },
  ]

  if (apportPv > 0) {
    lignes.push({
      libelle: 'Photovoltaïque autoconsommé',
      detail: `${kwc} kWc, ${pv.productionParKwc} kWh par kWc, ${Math.round(pv.partAutoconsommee * 100)} % autoconsommés, rapportés à ${entree.sre} m²`,
      valeur: -arrondi(apportPv),
      unite: 'kWh/m²·an',
    })
  }

  lignes.push({
    libelle: 'Énergie pondérée',
    detail: apportPv > 0
      ? `${arrondi(energieAvantPv)} moins ${arrondi(apportPv)} de photovoltaïque`
      : `${arrondi(energieFinale)} fois ${a.ponderation}`,
    valeur: arrondi(energiePonderee),
    unite: 'kWh/m²·an',
  })

  return {
    qww,
    rendement,
    energieFinale,
    apportPv,
    energiePonderee,
    classe: classeGlobale(energiePonderee),
    lignes,
  }
}

export function calculer(entree: EntreeEnergie): Resultat {
  const enveloppe = calculerEnveloppe(entree)
  return {
    enveloppe,
    global: calculerGlobal(entree, enveloppe.qh),
    provisoire: tablesProvisoires(),
  }
}

/* ------------------------------------------------------------------ mesures */

export type Mesure =
  | { type: 'ISOLER'; element: ElementEnveloppe }
  | { type: 'PRODUCTION'; agent: Agent }
  | { type: 'PHOTOVOLTAIQUE'; kwc: number }

/**
 * Le scénario après travaux.
 *
 * Aucune formule nouvelle : une mesure remplace la valeur de l'élément concerné,
 * et le même calcul repasse dessus. C'est ce qui garantit qu'un gain affiché est
 * du même ordre que l'état qu'il corrige, et non le produit d'un second modèle.
 */
export function appliquerMesures(entree: EntreeEnergie, mesures: Mesure[]): EntreeEnergie {
  const apres: EntreeEnergie = {
    ...entree,
    elements: { ...entree.elements },
  }

  for (const m of mesures) {
    if (m.type === 'ISOLER') {
      apres.elements[m.element] = {
        etat: parametres.renovation.etatEquivalent as Etat,
        anneeRenovation: parametres.renovation.anneeEquivalente,
      }
    }
    if (m.type === 'PRODUCTION') {
      apres.agentChauffage = m.agent
      apres.etatProduction = 1
    }
    if (m.type === 'PHOTOVOLTAIQUE') {
      apres.photovoltaiqueKwc = m.kwc
    }
  }

  return apres
}

/** Ce que le scénario fait gagner, en valeur et en part. */
export function comparer(avant: Resultat, apres: Resultat, sre: number) {
  const ecart = avant.global.energiePonderee - apres.global.energiePonderee
  return {
    gainPourcent: avant.global.energiePonderee > 0
      ? arrondi((ecart / avant.global.energiePonderee) * 100)
      : 0,
    economieParM2: arrondi(ecart),
    economieParAn: Math.round(ecart * sre),
  }
}
