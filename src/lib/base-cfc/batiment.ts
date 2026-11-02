/**
 * De la fiche du dossier aux données dont les quantités ont besoin.
 *
 * La fiche d'un immeuble est saisie champ par champ, et certains manquent
 * toujours. Ce module fait la traduction, avec une règle qui compte : un champ
 * vide devient null et jamais zéro. Zéro mètre carré de façade est une
 * affirmation, l'absence de la donnée est une question, et les deux ne doivent
 * pas se ressembler dans un devis.
 *
 * La façade se calcule du périmètre, des étages et de la hauteur d'étage, sauf
 * quand elle a été mesurée sur les plans ou saisie au dossier : la mesure passe
 * alors avant. Sans source, la valeur enregistrée ne sert que de repli : écrite
 * une fois à la création du dossier, elle ne suivrait plus une correction du
 * périmètre.
 */

import type { ApiBatiment, SourcesDimensions } from '../api-types'
import { batimentsDuDossier, cumulerLesBatiments } from './batiments'
import { facadeMesuree } from '../formulas'
import {
  surfaceFacade, surfaceFenetres,
  type DonneesBatiment, type RepartitionLogements,
} from './quantites'
import { comptagesDuDossier } from './comptages'

/** Les champs de la fiche du dossier qui servent aux quantités. */
export interface FicheDuBatiment {
  floorArea?: number | null
  builtArea?: number | null
  terrainArea?: number | null
  /** Surface de façade relevée, repli du calcul par le périmètre. */
  facadeArea?: number | null
  perimeter?: number | null
  nbFloors?: number | null
  floorHeight?: number | null
  nbApartments?: number | null
  nbStaircases?: number | null
  /** Répartition par typologie : { "3.5": 5, "4.5": 2 }. */
  apartmentTypes?: Record<string, number> | null
  /** Part vitrée de la façade, en pourcent ou en fraction. */
  windowPct?: number | null
  /** Surface de parking, facultative : les sprinklers la prennent si elle existe. */
  parkingArea?: number | null
  /**
   * Les bâtiments du dossier, quand il en compte plusieurs. Leurs grandeurs
   * l'emportent sur les champs de la fiche, qui ne décrivent qu'un bâtiment.
   */
  batiments?: ApiBatiment[] | null
  /** Les éléments comptés du dossier, tels que stockés (JSON). */
  comptages?: unknown
  /** D'où vient chaque dimension : une façade mesurée passe avant le périmètre. */
  sources?: SourcesDimensions | null
}

/** Hauteur d'étage retenue faute de mieux, usage du bureau. */
export const HAUTEUR_DETAGE_PAR_DEFAUT = 2.7

/** Portes d'entrée d'immeuble : une par cage d'escalier. */
export const ENTREES_PAR_CAGE = 1

/** Pièces d'eau par logement : une salle de bain et une cuisine. */
export const PIECES_DEAU_PAR_LOGEMENT = 2

/** Une valeur utilisable, ou null. Zéro et les valeurs absurdes valent null. */
const valeur = (v: number | null | undefined): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null

/**
 * La répartition des logements par typologie.
 *
 * Les clés de la fiche sont des nombres de pièces, écrits avec un point ou une
 * virgule. On les range par tranche plutôt que par égalité exacte : un
 * trois-pièces se compte avec les trois-et-demi, puisque la règle des stores
 * ne distingue que les petits logements des grands.
 */
export function repartitionDesLogements(
  types: Record<string, number> | null | undefined,
): RepartitionLogements | null {
  if (!types) return null
  const r: RepartitionLogements = {}
  let trouve = false
  for (const [typologie, nombre] of Object.entries(types)) {
    const pieces = Number(String(typologie).replace(',', '.').replace('+', ''))
    if (!Number.isFinite(pieces) || !Number.isFinite(nombre) || nombre <= 0) continue
    trouve = true
    const champ: keyof RepartitionLogements =
      pieces < 2 ? 'p1_5'
      : pieces < 3 ? 'p2_5'
      : pieces < 4 ? 'p3_5'
      : pieces < 5 ? 'p4_5'
      : 'p5_5plus'
    r[champ] = (r[champ] ?? 0) + nombre
  }
  return trouve ? r : null
}

/**
 * Les données du bâtiment, telles que les règles de quantité les attendent.
 *
 * Un dossier qui porte plusieurs bâtiments cumule ce qui est extensif — plancher,
 * emprise, logements, cages — et prend la hauteur du plus haut. Le périmètre et
 * la surface de façade restent ceux de la fiche : pour des bâtiments mitoyens,
 * ils se mesurent sur l'ensemble, et les additionner par bâtiment compterait les
 * murs mitoyens. Voir batiments.ts.
 *
 * Sans bâtiments déclarés, rien ne change : la fiche décrit un bâtiment unique,
 * comme avant.
 */
export function donneesDuBatiment(fiche: FicheDuBatiment): DonneesBatiment {
  const batiments = batimentsDuDossier(fiche.batiments)
  const cumul = batiments ? cumulerLesBatiments(batiments) : null

  const etages = cumul?.nbFloors ?? valeur(fiche.nbFloors)
  const hauteurEtage = valeur(fiche.floorHeight) ?? HAUTEUR_DETAGE_PAR_DEFAUT
  const facade = facadeMesuree(fiche)
    ?? surfaceFacade(valeur(fiche.perimeter), etages, hauteurEtage)
    ?? valeur(fiche.facadeArea)
  const logements = cumul?.nbApartments ?? valeur(fiche.nbApartments)
  const cages = cumul?.nbStaircases ?? valeur(fiche.nbStaircases)
  const typologies = cumul?.apartmentTypes ?? fiche.apartmentTypes

  return {
    surfacePlancher: cumul?.floorArea ?? valeur(fiche.floorArea),
    surfaceBatie: cumul?.builtArea ?? valeur(fiche.builtArea),
    surfaceTerrain: valeur(fiche.terrainArea),
    surfaceFacade: facade,
    surfaceFenetres: surfaceFenetres(facade, partVitree(fiche.windowPct)),
    nombreLogements: logements,
    logementsParTypologie: repartitionDesLogements(typologies),
    nombrePiecesEau: logements === null ? null : logements * PIECES_DEAU_PAR_LOGEMENT,
    nombreEtages: etages,
    nombreCages: cages,
    nombrePortesEntree: cages === null ? null : cages * ENTREES_PAR_CAGE,
    hauteur: etages === null ? null : etages * hauteurEtage,
    surfaceParking: valeur(fiche.parkingArea),
    comptages: comptagesDuDossier(fiche.comptages),
  }
}

/** La part vitrée, acceptée en pourcent (30) comme en fraction (0,3). */
function partVitree(brut: number | null | undefined): number | null {
  const v = valeur(brut)
  if (v === null) return null
  return v > 1 ? v / 100 : v
}

/** Libellé de chaque donnée, pour dire au diagnostiqueur ce qui manque. */
export const LIBELLES_DU_BATIMENT: Record<keyof DonneesBatiment, string> = {
  surfacePlancher: 'surface de plancher',
  surfaceBatie: 'surface bâtie',
  surfaceTerrain: 'surface de terrain',
  surfaceFacade: 'surface de façade',
  surfaceFenetres: 'surface de fenêtres',
  nombreLogements: 'nombre de logements',
  logementsParTypologie: 'répartition des logements par typologie',
  nombrePiecesEau: "nombre de pièces d'eau",
  nombreEtages: "nombre d'étages",
  nombreCages: "nombre de cages d'escalier",
  nombrePortesEntree: "nombre de portes d'entrée",
  hauteur: 'hauteur du bâtiment',
  surfaceParking: 'surface de parking',
  comptages: 'éléments comptés',
}

/**
 * Les données manquantes, nommées en clair.
 *
 * La surface de parking n'y figure pas : elle est facultative, et les
 * sprinklers se rabattent sur la surface bâtie. Réclamer un champ facultatif
 * apprend au diagnostiqueur à ignorer les avertissements.
 */
export function donneesManquantes(d: DonneesBatiment): string[] {
  const facultatives = new Set<keyof DonneesBatiment>(['surfaceParking', 'comptages'])
  return (Object.keys(LIBELLES_DU_BATIMENT) as (keyof DonneesBatiment)[])
    .filter((c) => !facultatives.has(c))
    .filter((c) => d[c] === null || d[c] === undefined)
    .map((c) => LIBELLES_DU_BATIMENT[c])
}
