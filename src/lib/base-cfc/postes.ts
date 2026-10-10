/**
 * Les postes qui s'ajoutent au devis sans venir d'une observation.
 *
 * Quatre postes, et leurs prix sont lus dans la table postes_automatiques, pas
 * écrits ici : le bureau doit pouvoir changer le prix d'un échafaudage sans
 * qu'on touche au code.
 *
 *  - 211.1 échafaudage de façade, dès qu'un ouvrage qui en demande un porte
 *    des travaux chiffrés ;
 *  - 285.0 échafaudage de cage d'escalier, par cage, quand un mur ou un plafond
 *    des communs est en fin de vie ;
 *  - 287 nettoyage complet, toujours, au m² de surface de plancher ;
 *  - 121 protection des ouvrages existants, toujours, en forfait.
 *
 * La difficulté est l'échafaudage de façade. Sept types de façade, des
 * fenêtres, des volets et une toiture peuvent tous demander le même
 * échafaudage : il se compte une fois. Et comme un échafaudage loué à la
 * journée se paie au temps du chantier le plus long, le poste prend la
 * priorité la plus urgente des ouvrages qui le déclenchent.
 */

import type { BaseQuantite, Unite } from './normaliser'
import type { PosteBase } from './assembler'

export type Priorite = 'I' | 'II' | 'III'

/** Les ouvrages des communs dont la fin de vie impose un échafaudage de cage. */
export const DOMAINES_MURS_PLAFONDS = ['Intérieur – murs', 'Intérieur – plafonds']

/** Numéro de l'étape « Cage d'escalier » dans l'ordre de visite. */
export const ETAPE_CAGE = 2

/**
 * Les bases de quantité qui désignent le même plan de façade.
 *
 * Une fenêtre est dans la façade, pas devant : l'échafaudage qui sert à la
 * remplacer est celui de la façade. Additionner les deux surfaces compterait
 * le même mètre carré deux fois.
 */
const PLAN_DE_FACADE: BaseQuantite[] = ['surface_facade', 'surface_fenetres', 'facade_moins_fenetres']

/** Ce que les règles ont besoin de savoir d'un relevé chiffré. */
export interface ReleveDuDevis {
  articleId: string
  nom: string
  etapeNumero: number
  echafaudage: boolean
  baseQuantite: BaseQuantite
  domaineRapport: string
  /** Fin de vie, au sens du classeur. */
  etat: string | null
  quantite: number | null
  /** Montant des travaux retenus. Zéro ou null = rien de chiffré. */
  montant: number | null
  priorite: Priorite | null
}

/** Les données du bâtiment dont les postes ont besoin. */
export interface DonneesDesPostes {
  surfacePlancher: number | null
  surfaceFacade: number | null
  nombreCages: number | null
}

export interface LignePoste {
  cfcCode: string
  libelle: string
  unite: Unite
  quantite: number | null
  prixUnitaire: number
  /** null quand la quantité manque : un poste sans quantité n'est pas gratuit. */
  montant: number | null
  priorite: Priorite | null
  /** La règle, en clair : un montant sans ouvrage en face doit s'expliquer. */
  remarque: string
}

const ORDRE: Priorite[] = ['I', 'II', 'III']

/** La plus urgente d'une liste de priorités. null si aucune n'est arbitrée. */
export function plusUrgente(priorites: (Priorite | null)[]): Priorite | null {
  for (const p of ORDRE) if (priorites.includes(p)) return p
  return null
}

/** Un relevé porte-t-il des travaux chiffrés ? */
const chiffre = (r: ReleveDuDevis) => r.montant !== null && r.montant > 0

const arrondi = (v: number) => Math.round(v * 100) / 100

export interface SurfaceEchafaudee {
  /** null quand la surface de façade manque : à saisir, pas à deviner. */
  quantite: number | null
  /** Les ouvrages qui déclenchent l'échafaudage, pour la remarque. */
  declencheurs: string[]
  priorite: Priorite | null
  /** true quand la surface de façade entière est retenue. */
  facadeEntiere: boolean
}

/**
 * La surface à échafauder, sans compter deux fois la même façade.
 *
 * Deux cas. Si tous les ouvrages concernés sont dans le plan de façade, on
 * additionne leurs surfaces, parce qu'une façade à moitié crépie ne
 * s'échafaude que là où l'on travaille, et on plafonne à la surface de la
 * façade. Si l'un d'eux ne s'y trouve pas, une toiture ou un balcon par
 * exemple, l'échafaudage fait le tour du bâtiment et c'est la façade entière.
 */
export function surfaceEchafaudee(releves: ReleveDuDevis[], surfaceFacade: number | null): SurfaceEchafaudee {
  const concernes = releves.filter((r) => r.echafaudage && chiffre(r))
  const vide: SurfaceEchafaudee = { quantite: null, declencheurs: [], priorite: null, facadeEntiere: false }
  if (concernes.length === 0) return vide

  const declencheurs = concernes.map((r) => r.nom)
  const priorite = plusUrgente(concernes.map((r) => r.priorite))
  if (surfaceFacade === null) return { quantite: null, declencheurs, priorite, facadeEntiere: false }

  const horsPlan = concernes.some((r) => !PLAN_DE_FACADE.includes(r.baseQuantite))
  if (horsPlan) return { quantite: surfaceFacade, declencheurs, priorite, facadeEntiere: true }

  const somme = concernes.reduce((s, r) => s + (r.quantite ?? 0), 0)
  const quantite = Math.min(arrondi(somme), surfaceFacade)
  return { quantite, declencheurs, priorite, facadeEntiere: quantite >= surfaceFacade }
}

/** Un mur ou un plafond de la cage d'escalier est-il en fin de vie ? */
export function cageAEchafauder(releves: ReleveDuDevis[]): ReleveDuDevis | null {
  return releves.find((r) =>
    r.etapeNumero === ETAPE_CAGE
    && r.etat === 'mauvais'
    && DOMAINES_MURS_PLAFONDS.includes(r.domaineRapport),
  ) ?? null
}

const dePoste = (postes: PosteBase[], cfcCode: string) => postes.find((p) => p.cfcCode === cfcCode)

/**
 * Les postes à ajouter au devis, dans l'ordre de leur code CFC.
 *
 * Un poste dont la quantité ne peut pas être établie est quand même rendu,
 * avec un montant null : il doit apparaître au devis comme une ligne à
 * compléter, et non disparaître en silence.
 */
export function postesAutomatiques(
  releves: ReleveDuDevis[],
  postes: PosteBase[],
  donnees: DonneesDesPostes,
): LignePoste[] {
  const lignes: LignePoste[] = []

  const protection = dePoste(postes, '121')
  if (protection) {
    lignes.push({
      cfcCode: protection.cfcCode,
      libelle: protection.libelle,
      unite: protection.unite,
      quantite: 1,
      prixUnitaire: protection.prix,
      montant: protection.prix,
      priorite: null,
      remarque: protection.remarque ?? "Compté d'office sur tout devis, en forfait.",
    })
  }

  const facade = dePoste(postes, '211.1')
  if (facade) {
    const s = surfaceEchafaudee(releves, donnees.surfaceFacade)
    if (s.declencheurs.length > 0) {
      lignes.push({
        cfcCode: facade.cfcCode,
        libelle: facade.libelle,
        unite: facade.unite,
        quantite: s.quantite,
        prixUnitaire: facade.prix,
        montant: s.quantite === null ? null : arrondi(s.quantite * facade.prix),
        priorite: s.priorite,
        remarque: remarqueEchafaudage(s),
      })
    }
  }

  const cage = dePoste(postes, '285.0')
  if (cage) {
    const declencheur = cageAEchafauder(releves)
    if (declencheur) {
      const cages = donnees.nombreCages ?? 1
      lignes.push({
        cfcCode: cage.cfcCode,
        libelle: cage.libelle,
        unite: cage.unite,
        quantite: cages,
        prixUnitaire: cage.prix,
        montant: arrondi(cages * cage.prix),
        priorite: declencheur.priorite,
        remarque: `Déclenché par « ${declencheur.nom} » de la cage d'escalier en fin de vie, compté par cage.`,
      })
    }
  }

  const nettoyage = dePoste(postes, '287')
  if (nettoyage) {
    const sp = donnees.surfacePlancher
    lignes.push({
      cfcCode: nettoyage.cfcCode,
      libelle: nettoyage.libelle,
      unite: nettoyage.unite,
      quantite: sp,
      prixUnitaire: nettoyage.prix,
      montant: sp === null ? null : arrondi(sp * nettoyage.prix),
      priorite: null,
      remarque: nettoyage.remarque
        ?? "Compté d'office sur tout devis, au m² de surface de plancher.",
    })
  }

  return lignes
}

function remarqueEchafaudage(s: SurfaceEchafaudee): string {
  const liste = s.declencheurs.slice(0, 3).join(', ')
  const reste = s.declencheurs.length > 3 ? `, et ${s.declencheurs.length - 3} autres ouvrages` : ''
  const etendue = s.facadeEntiere
    ? "Surface de la façade entière, l'échafaudage faisant le tour du bâtiment."
    : 'Surface des façades concernées, une même façade comptée une seule fois.'
  return `Déclenché par ${liste}${reste}. ${etendue}`
}

/** Une option d'amélioration, telle qu'elle figure au tableau des options. */
export interface OptionChiffree {
  articleId: string
  nom: string
  echafaudage: boolean
  quantite: number | null
}

export interface EchafaudageDeLOption {
  /** false quand le devis principal le porte déjà : rien à ajouter. */
  aCompter: boolean
  quantite: number | null
  prixUnitaire: number
  montant: number | null
  /** La mention à afficher sous l'option. */
  mention: string
}

/**
 * Le coût d'échafaudage d'une option d'amélioration.
 *
 * Les améliorations sont chiffrées hors du total principal, et leurs prix sont
 * donnés hors échafaudage : une isolation périphérique à 310 CHF le mètre carré
 * n'inclut pas les 35 francs de l'échafaudage. Les ajouter au tableau des
 * options évite la mauvaise surprise au moment d'arbitrer. Mais si le devis
 * principal échafaude déjà cette façade, les compter une seconde fois
 * surévaluerait l'option, et c'est le genre d'écart qui fait renoncer à des
 * travaux utiles. On le dit alors au lieu de le compter.
 *
 * null quand l'ouvrage ne demande pas d'échafaudage : il n'y a rien à dire.
 */
export function echafaudageDeLOption(
  option: OptionChiffree,
  poste: PosteBase | undefined,
  dejaAuDevisPrincipal: boolean,
): EchafaudageDeLOption | null {
  if (!option.echafaudage || !poste) return null

  if (dejaAuDevisPrincipal) {
    return {
      aCompter: false,
      quantite: null,
      prixUnitaire: poste.prix,
      montant: null,
      mention: 'Échafaudage déjà compté au devis principal.',
    }
  }

  const quantite = option.quantite
  return {
    aCompter: true,
    quantite,
    prixUnitaire: poste.prix,
    montant: quantite === null ? null : arrondi(quantite * poste.prix),
    mention: `Échafaudage compris, ${poste.prix} CHF par m² de façade.`,
  }
}
