/**
 * Les feuilles d'un plan, pour l'outil Métrés.
 *
 * Un PDF d'architecte porte souvent tout un jeu : plans d'étage, façades,
 * coupes. L'outil Métrés traite chaque page comme une feuille, avec ce que le
 * cartouche en dit (numéro, titre), ce qu'elle montre (plan d'étage,
 * élévation…), le niveau qu'elle représente et le nombre d'étages identiques
 * qu'elle vaut, plus l'état de son analyse par l'IA. Tout cela vit dans la
 * colonne `feuilles` du plan, un seul bloc JSON relu d'une pièce, à côté des
 * annotations.
 *
 * Ce module tient deux choses : la forme admise de ce bloc, pour qu'un
 * navigateur ne puisse pas y ranger n'importe quoi, et le remplacement des
 * propositions de l'IA sur des pages données, que la route fait en une
 * écriture plutôt que de laisser le navigateur relire, fusionner et réécrire
 * toutes les annotations.
 *
 * Module sans base ni réseau, pour être vérifiable par les tests.
 */
import { z } from "zod";

export const TYPES_VUE = ["plan_etage", "elevation", "coupe", "toiture", "situation", "autre"] as const;
export const STATUTS_ANALYSE = ["en_file", "en_cours", "prete", "erreur"] as const;
/** Les champs qu'un utilisateur peut corriger : une nouvelle analyse ne les écrase pas. */
export const CHAMPS_CORRIGEABLES = ["numero", "titre", "type", "niveau", "etagesIdentiques"] as const;

/** Une page au plus de ce numéro : au-delà, ce n'est plus un jeu de plans. */
const PAGE_MAX = 5000;
/** Le bloc entier, sérialisé : de quoi décrire un jeu de plusieurs centaines de feuilles. */
const TAILLE_MAX = 900_000;

const texte = (max: number) => z.string().max(max).nullable().optional();

/**
 * Un petit objet libre (une échelle proposée, un total compté) : sa forme
 * appartient au navigateur, qui l'a calculé, mais sa taille est bornée.
 */
const objetBorne = (max: number) => z.record(z.string(), z.unknown()).refine(
  (o) => JSON.stringify(o).length <= max,
  { message: "Objet trop volumineux." },
);

const analyseSchema = z.object({
  statut: z.enum(STATUTS_ANALYSE),
  /** Date ISO du dernier changement d'état. */
  depuis: z.string().max(40).nullable().optional(),
  /** Numéro de la tâche de fond, pour reprendre son résultat après une fermeture d'onglet. */
  tache: z.string().max(64).nullable().optional(),
  message: texte(300),
  tentatives: z.number().int().min(0).max(100).optional(),
});

const ecarteeSchema = z.object({
  page: z.number().int().nullable().optional(),
  libelle: texte(120),
  raison: z.string().max(300),
});

export const feuilleSchema = z.object({
  numero: texte(30),
  titre: texte(120),
  type: z.enum(TYPES_VUE).nullable().optional(),
  niveau: texte(40),
  etagesIdentiques: z.number().int().min(1).max(60).nullable().optional(),
  /** Hauteur d'étage choisie dans le panneau des quantités, en mètres : la surface des murs en dépend. */
  hauteurEtage: z.number().min(1).max(20).nullable().optional(),
  orientation: texte(30),
  corrige: z.array(z.enum(CHAMPS_CORRIGEABLES)).max(CHAMPS_CORRIGEABLES.length).optional(),
  analyse: analyseSchema.nullable().optional(),
  /** L'échelle que l'analyse propose, en attente de confirmation dans l'éditeur. */
  echelle: objetBorne(6000).nullable().optional(),
  remarque: texte(300),
  ecartees: z.array(ecarteeSchema).max(40).optional(),
  sansGeometrie: z.boolean().optional(),
  tronque: z.boolean().optional(),
});

const lotSchema = z.object({
  pages: z.array(z.number().int().min(1).max(PAGE_MAX)).max(50),
  le: z.string().max(40),
  comptages: z.array(objetBorne(2000)).max(20),
  remarques: texte(600),
});

export const feuillesSchema = z.object({
  /** Nombre de pages du document, une fois connu. */
  nombre: z.number().int().min(1).max(PAGE_MAX).nullable().optional(),
  pages: z.record(
    z.string().regex(/^[1-9]\d{0,3}$/, "Numéro de page invalide."),
    feuilleSchema,
  ).default({}),
  /** Les derniers lots analysés : leurs totaux par catégorie, étages identiques compris. */
  lots: z.array(lotSchema).max(20).optional(),
}).refine((f) => JSON.stringify(f).length <= TAILLE_MAX, { message: "Description des feuilles trop volumineuse." });

export type Feuilles = z.infer<typeof feuillesSchema>;

// ---------------------------------------------------------------- propositions

type Annotation = Record<string, unknown>;

const estObjet = (a: unknown): a is Annotation => !!a && typeof a === "object" && !Array.isArray(a);

/** La page d'une annotation : absente, c'est la première (et la seule d'une image). */
export function pageDe(a: Annotation): number {
  return typeof a.page === "number" ? a.page : 1;
}

/** Une proposition de l'IA pas encore regardée : une zone à valider, ou un repère à valider. */
export function estEnAttente(a: Annotation): boolean {
  if (a.proposition) return true;
  const r = a.repere;
  return estObjet(r) && r.aValider === true;
}

/**
 * Remplace les propositions de l'IA en attente sur ces pages par les nouvelles.
 *
 * Ce qui a été validé reste : relancer l'analyse d'une feuille ne défait pas
 * le travail de relecture. Ce qui attendait encore est remplacé, pas ajouté,
 * et l'opération est idempotente : un résultat repris après une fermeture
 * d'onglet, puis livré une seconde fois, ne double rien.
 */
export function remplacerPropositions(actuelles: unknown, pages: number[], nouvelles: unknown[]): unknown[] {
  const liste = Array.isArray(actuelles) ? actuelles : [];
  const visees = new Set(pages);
  const gardees = liste.filter((a) => !(estObjet(a) && visees.has(pageDe(a)) && estEnAttente(a)));
  return [...gardees, ...nouvelles];
}

/** Combien d'éléments attendent d'être validés sur ce plan : de quoi le dire dans la liste des métrés. */
export function nombreAValider(annotations: unknown): number {
  return Array.isArray(annotations) ? annotations.filter((a) => estObjet(a) && estEnAttente(a)).length : 0;
}
