/**
 * Un article de la base v3, présenté comme l'écran de visite sait le lire.
 *
 * L'écran de saisie, l'éditeur d'ouvrage et la couche de calcul ont été écrits
 * pour l'ancien catalogue : des travaux par état dans six champs, des prix dans
 * six autres. La base v3 range les mêmes choses en lignes d'état. Ce module
 * fait la traduction, de sorte que la bascule de la base ne demande pas de
 * réécrire six cents lignes d'éditeur le même jour.
 *
 * Trois différences méritent d'être dites, parce qu'elles se voient à l'écran.
 *
 * La base v3 ne décrit pas les états : l'ancien catalogue avait un texte
 * « voici à quoi ressemble un état moyen », le classeur du bureau n'en a pas.
 * Les descriptions sont donc vides, et le guide d'état ne propose plus que les
 * quatre noms d'état.
 *
 * Le prix de l'état moyen n'est pas lu mais calculé, part fixe plus fraction du
 * prix de remplacement. La part retenue est celle du catalogue : l'ajuster par
 * relevé demandera une colonne, et d'ici là le coût se force à la main.
 *
 * La quantité ne se devine plus d'une unité ni d'une formule en texte : chaque
 * article dit sa base de quantité. C'est le progrès principal de cette base, et
 * la raison pour laquelle ce pont ne porte pas de formule.
 */

import type { ApiArticle } from '../api-types'
import type { QuantityResolution } from '../diagnostic-auto'
import { cleDuReleve } from './etapes'
import { prixUnitaire } from './prix'
import { quantiteDeBase, type DonneesBatiment } from './quantites'
import type { BaseQuantite, EtatArticle, Unite } from './normaliser'

/** Les quatre états que le diagnostiqueur constate, tels que l'app les nomme. */
export type EtatConstate = 'TRES_BON' | 'BON' | 'MOYEN' | 'MAUVAIS'

/** De l'état de l'app à celui de la base. */
export const ETAT_DE_LA_BASE: Record<EtatConstate, EtatArticle> = {
  TRES_BON: 'tres_bon',
  BON: 'bon',
  MOYEN: 'moyen',
  MAUVAIS: 'mauvais',
}

/** Unité, écrite pour l'écran. */
export function uniteEnClair(u: Unite): string {
  switch (u) {
    case 'm2': return 'm²'
    case 'ml': return 'ml'
    case 'pce': return 'pce'
    case 'forfait': return 'forfait'
  }
}

export interface OuvrageSaisi {
  /** « A100@2 » : l'article dans son étape, ce qui identifie le relevé. */
  id: string
  articleId: string
  etapeNumero: number | null
  cfcCode: string
  /** Nom de l'article. */
  description: string
  /** Chapitre du rapport, qui tient lieu de catégorie. */
  category: string
  unit: string
  /** Unité du remplacement, qui peut différer de celle de l'entretien. */
  uniteRemplacement: string

  workTbe: string | null
  workBon: string | null
  workMoyen: string | null
  workMauvais: string | null
  workImprovement: string | null
  workNorms: string | null

  priceTbe: number | null
  priceBon: number | null
  priceMoyen: number | null
  priceMauvais: number | null
  priceImprovement: number | null
  priceNorms: number | null

  /** La base v3 ne décrit pas les états : ces champs restent vides. */
  descTbe: null
  descBon: null
  descMoyen: null
  descMauvais: null

  /** Groupe d'alternatives, sous le nom que l'écran connaît. */
  surfaceGroup: string | null
  scaffoldingNote: string | null
  /** Aucune formule en texte : la base dit sa base de quantité. */
  quantityFormula: null

  baseQuantite: BaseQuantite
  coefficient: number
  /** Part du prix Mauvais retenue pour l'état moyen, telle qu'au catalogue. */
  partPrixMauvais: number | null
  /** Ce que le classeur met entre parenthèses, à afficher à la saisie. */
  indication: string | null
  /** Consigne interne. Jamais imprimée dans le rapport. */
  note: string | null
  articleLieId: string | null
  echafaudage: boolean
}

const travaux = (a: ApiArticle, etat: EtatArticle) =>
  a.etats.find((e) => e.etat === etat)?.travaux ?? null

const prixDe = (a: ApiArticle, etat: EtatArticle) =>
  a.etats.find((e) => e.etat === etat)?.prix ?? null

/**
 * L'article tel que l'écran de visite le consomme.
 *
 * L'étape voyage avec l'ouvrage : c'est elle qui distingue la peinture de la
 * cage d'escalier de celle des appartements, et sans elle les deux relevés
 * retomberaient l'un sur l'autre.
 */
export function ouvrageDeLArticle(article: ApiArticle, etapeNumero: number | null = null): OuvrageSaisi {
  const ligneMoyen = article.etats.find((e) => e.etat === 'moyen')
  const prixMauvais = prixDe(article, 'mauvais')

  return {
    id: etapeNumero === null ? article.id : cleDuReleve(article.id, etapeNumero),
    articleId: article.id,
    etapeNumero,
    cfcCode: article.cfcCode,
    description: article.nom,
    category: article.domaineRapport,
    unit: uniteEnClair(article.uniteEntretien),
    uniteRemplacement: uniteEnClair(article.uniteRemplacement),

    workTbe: travaux(article, 'tres_bon'),
    workBon: travaux(article, 'bon'),
    workMoyen: travaux(article, 'moyen'),
    workMauvais: travaux(article, 'mauvais'),
    workImprovement: travaux(article, 'amelioration'),
    workNorms: travaux(article, 'normes'),

    priceTbe: prixDe(article, 'tres_bon'),
    priceBon: prixDe(article, 'bon'),
    // Le seul prix qui se calcule : part fixe plus fraction du remplacement.
    priceMoyen: ligneMoyen
      ? prixUnitaire('moyen', { prix: ligneMoyen.prix, partPrixMauvais: ligneMoyen.partPrixMauvais }, { prixMauvais })
      : null,
    priceMauvais: prixMauvais,
    priceImprovement: prixDe(article, 'amelioration'),
    priceNorms: prixDe(article, 'normes'),

    descTbe: null,
    descBon: null,
    descMoyen: null,
    descMauvais: null,

    surfaceGroup: article.groupeAlternatives,
    scaffoldingNote: article.echafaudage ? 'Échafaudage nécessaire' : null,
    quantityFormula: null,

    baseQuantite: article.baseQuantite,
    coefficient: article.coefficient,
    partPrixMauvais: ligneMoyen?.partPrixMauvais ?? null,
    indication: article.indicationQuantite,
    note: article.noteDiagnostiqueur,
    articleLieId: article.articleLieId,
    echafaudage: article.echafaudage,
  }
}

/** Les travaux proposés pour un état constaté. */
export function travauxDeLEtat(ouvrage: OuvrageSaisi, etat: EtatConstate): string | null {
  switch (etat) {
    case 'TRES_BON': return ouvrage.workTbe
    case 'BON': return ouvrage.workBon
    case 'MOYEN': return ouvrage.workMoyen
    case 'MAUVAIS': return ouvrage.workMauvais
  }
}

/** Le prix unitaire catalogue pour un état constaté, hors indexation. */
export function prixDeLEtat(ouvrage: OuvrageSaisi, etat: EtatConstate): number | null {
  switch (etat) {
    case 'TRES_BON': return ouvrage.priceTbe
    case 'BON': return ouvrage.priceBon
    case 'MOYEN': return ouvrage.priceMoyen
    case 'MAUVAIS': return ouvrage.priceMauvais
  }
}

/**
 * Ce que chaque base de quantite prend dans le dossier, dit en clair.
 *
 * Affiche a cote de la quantite calculee : un metre par 2,7 qui donne 972 m2
 * n'inspire pas confiance tant qu'on ne lit pas « surface de facade ». Et
 * quand la donnee manque, c'est ce libelle qui dit quoi aller saisir.
 */
export const BASES_EN_CLAIR: Record<BaseQuantite, string> = {
  surface_plancher: 'surface de plancher',
  surface_batie: 'surface bâtie',
  surface_terrain: 'surface de terrain',
  surface_facade: 'surface de façade',
  surface_fenetres: 'surface de fenêtres',
  facade_moins_fenetres: 'façade hors fenêtres',
  nombre_logements: 'nombre de logements',
  nombre_pieces_eau: "nombre de pièces d'eau",
  nombre_etages: "nombre d'étages",
  nombre_cages: "nombre de cages d'escalier",
  nombre_portes_entree: "nombre de portes d'entrée",
  forfait: 'prix forfaitaire',
  saisie_manuelle: 'quantité relevée sur place',
  regle_stores: 'stores, comptés par taille de logement',
  regle_eaux_pluviales: "descentes d'eaux pluviales, par palier de surface bâtie",
  regle_sprinklers: 'surface de parking, ou surface bâtie à défaut',
}

/**
 * La quantite d'un ouvrage, et d'ou elle vient.
 *
 * Meme forme de reponse que l'ancienne resolution par formule, pour que
 * l'editeur de releve l'affiche sans changer : la quantite, la grandeur
 * employee, et la raison quand il faut la saisir a la main.
 */
export function resolutionDeQuantite(ouvrage: OuvrageSaisi, batiment: DonneesBatiment): QuantityResolution {
  const base = ouvrage.baseQuantite
  const nom = BASES_EN_CLAIR[base]

  if (base === 'saisie_manuelle') {
    return {
      quantity: undefined,
      origin: 'manuelle',
      basis: ouvrage.indication ?? nom,
      reason: ouvrage.indication ?? 'quantité à relever sur place',
    }
  }

  const quantite = quantiteDeBase({ baseQuantite: base, coefficient: ouvrage.coefficient }, batiment)
  if (quantite === null) {
    return { quantity: undefined, origin: 'manuelle', basis: nom, reason: `${nom} non renseignée sur ce dossier` }
  }
  if (base === 'forfait') return { quantity: 1, origin: 'forfait', basis: nom }
  return { quantity: quantite, origin: 'formule', basis: nom }
}

/**
 * L'ouvrage d'un releve, quand la base le connait encore.
 *
 * null pour un releve d'avant la bascule, ou dont l'article n'a pas de
 * repreneur : il garde son etat, ses travaux, sa quantite et son cout, et
 * l'editeur le laisse corriger a la main. Rien n'est perdu, rien n'est
 * reinvente.
 */
export function ouvrageDuReleve(
  releve: { articleId?: string | null; etapeNumero?: number | null } | null | undefined,
  articles: ApiArticle[],
): OuvrageSaisi | null {
  if (!releve?.articleId) return null
  const article = articles.find((a) => a.id === releve.articleId)
  if (!article) return null
  return ouvrageDeLArticle(article, releve.etapeNumero ?? null)
}
