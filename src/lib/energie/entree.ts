import {
  appliquerMesures, calculer, libelleElement,
  type Agent, type Categorie, type ElementEnveloppe, type EntreeEnergie, type Etat, type Mesure, type Resultat,
} from './calcul'
import { reprendreDuDiagnostic, type OuvrageReleve, type RepriseDiagnostic } from './depuis-diagnostic'

/**
 * Comment un projet devient une entrée de calcul énergétique.
 *
 * Cette construction vit ici et non dans l'écran, parce que deux endroits la
 * demandent : l'onglet, où l'on règle les paramètres, et le rapport, qui les
 * reprend. Deux assemblages séparés finiraient par diverger, et le même bâtiment
 * afficherait deux classes selon l'endroit où on le regarde.
 */

export const ELEMENTS: ElementEnveloppe[] = ['toiture', 'facades', 'fenetres', 'sol', 'ventilation']

/** Ce que l'utilisateur a corrigé à la main, rangé dans energyData du projet. */
export interface SaisieEnergie {
  categorie?: Categorie
  sre?: number | null
  anneeConstruction?: number | null
  agentChauffage?: Agent
  agentEcs?: Agent | null
  photovoltaiqueKwc?: number | null
  etats?: Partial<Record<ElementEnveloppe | 'production', Etat>>
  renovations?: Partial<Record<ElementEnveloppe, number | null>>
  mesures?: string[]
}

export interface ProjetPourEnergie {
  yearBuilt?: number | null
  buildingType?: string | null
  sre?: number | null
  floorArea?: number | null
}

/** Catégorie énergétique déduite du type de bâtiment du dossier. */
export function categorieParDefaut(type?: string | null): Categorie {
  if (type === 'LOGEMENT') return 'COLLECTIF'
  if (type === 'BUREAU' || type === 'ADMINISTRATIF' || type === 'SCOLAIRE') return 'ADMINISTRATIF'
  return 'INDIVIDUEL'
}

export interface MesurePossible {
  cle: string
  libelle: string
  mesure: Mesure
  /** Le diagnostic la justifie : l'élément concerné est dégradé. */
  conseillee: boolean
}

export interface AssemblageEnergie {
  entree: EntreeEnergie
  reprise: RepriseDiagnostic
  mesuresPossibles: MesurePossible[]
  /** Clés des mesures retenues. Par défaut, celles que le diagnostic justifie. */
  cochees: string[]
  avant: Resultat
  apres: Resultat
}

/** L'entrée de calcul, et tout ce qui en découle. */
export function assembler(
  projet: ProjetPourEnergie,
  ouvrages: OuvrageReleve[],
  saisie: SaisieEnergie = {},
): AssemblageEnergie {
  const reprise = reprendreDuDiagnostic(ouvrages)

  const entree: EntreeEnergie = {
    anneeConstruction: saisie.anneeConstruction ?? projet.yearBuilt ?? 1970,
    categorie: saisie.categorie ?? categorieParDefaut(projet.buildingType),
    sre: saisie.sre ?? projet.sre ?? projet.floorArea ?? 0,
    agentChauffage: saisie.agentChauffage ?? 'MAZOUT_ANCIEN',
    etatProduction: saisie.etats?.production ?? reprise.etatProduction,
    agentEcs: saisie.agentEcs ?? null,
    photovoltaiqueKwc: saisie.photovoltaiqueKwc ?? null,
    elements: Object.fromEntries(ELEMENTS.map((e) => [e, {
      etat: saisie.etats?.[e] ?? reprise.elements[e].etat,
      anneeRenovation: saisie.renovations?.[e] ?? null,
    }])) as EntreeEnergie['elements'],
  }

  const mesuresPossibles: MesurePossible[] = []
  for (const e of ELEMENTS) {
    mesuresPossibles.push({
      cle: `isoler:${e}`,
      libelle: e === 'ventilation'
        ? "Reprendre l'étanchéité et la ventilation"
        : `Isoler ${libelleElement(e).toLowerCase()}`,
      mesure: { type: 'ISOLER', element: e },
      conseillee: entree.elements[e].etat >= 3,
    })
  }
  mesuresPossibles.push({
    cle: 'production:PAC_AIR_EAU',
    libelle: 'Remplacer la production par une pompe à chaleur air-eau',
    mesure: { type: 'PRODUCTION', agent: 'PAC_AIR_EAU' },
    conseillee: entree.etatProduction >= 3,
  })
  if (!entree.photovoltaiqueKwc) {
    mesuresPossibles.push({
      cle: 'pv:10',
      libelle: 'Poser 10 kWc de photovoltaïque',
      mesure: { type: 'PHOTOVOLTAIQUE', kwc: 10 },
      conseillee: false,
    })
  }

  const cochees = saisie.mesures ?? mesuresPossibles.filter((m) => m.conseillee).map((m) => m.cle)
  const retenues = mesuresPossibles.filter((m) => cochees.includes(m.cle)).map((m) => m.mesure)

  return {
    entree,
    reprise,
    mesuresPossibles,
    cochees,
    avant: calculer(entree),
    apres: calculer(appliquerMesures(entree, retenues)),
  }
}
