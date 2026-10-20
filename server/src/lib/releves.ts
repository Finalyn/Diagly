import { z } from "zod";
import { ElementState, Localisation, Priority } from "@prisma/client";

/**
 * Les règles d'un relevé (élément de diagnostic), sans base ni réseau.
 *
 * Séparées de la route pour être vérifiables : la création et la
 * modification doivent suivre les mêmes règles, y compris quand une création
 * renvoyée par l'appareil se lit comme une modification.
 */

export const itemBaseSchema = z.object({
  cfcCode: z.string().min(1).max(10),
  cfcLabel: z.string().min(1).max(255),
  catalogItemId: z.number().int().positive().optional(),
  /// Article de la base v3 et etape de visite. Ensemble, ils identifient le
  /// releve : le meme article releve dans deux etapes fait deux releves
  /// independants, avec deux etats et deux series de photos.
  articleId: z.string().min(1).max(8).nullable().optional(),
  etapeNumero: z.number().int().min(1).max(20).nullable().optional(),
  /// Communs / logements : la note generale du classeur veut que les articles du
  /// chapitre interieur se relevent des deux cotes, avec des choix differents.
  localisation: z.nativeEnum(Localisation).nullable().optional(),
  state: z.nativeEnum(ElementState).nullable().optional(),
  priority: z.nativeEnum(Priority).nullable().optional(),
  notes: z.string().max(10_000).optional(),
  /// Pas de .default([]) ici : `updateItemSchema` est ce schema rendu partiel, et un
  /// defaut survit a .partial(). Une mise a jour qui ne renvoyait pas ces deux champs
  /// les recevait donc a vide et ecrasait le contenu : poser une priorite depuis
  /// l'editeur effacait les travaux et les photos de la visite. Le defaut est applique
  /// a la creation seulement, la ou il a un sens.
  works: z.array(z.string().min(1)).optional(),
  photos: z.array(z.string().min(1)).optional(),
  /// Zero est une quantite : l'appareil l'envoie pour une surface nulle (un
  /// ouvrage releve dont la surface n'est pas encore connue ou n'existe pas).
  /// Le refuser faisait rejeter tout le releve, photos et etat compris.
  area: z.number().min(0).nullable().optional(),
  sharePct: z.number().min(0).max(100).nullable().optional(),
  /// Unites de la categorie comptee qui reviennent a ce type (2 portes palieres
  /// en bois sur 6). Zero passe : un releve renvoye par un appareil plus ancien
  /// ne doit pas etre refuse en bloc pour cela, l'ecran ne le propose pas.
  unites: z.number().int().min(0).max(5000).nullable().optional(),
  /// Verrous de saisie : une valeur reprise a la main ne doit plus etre recalculee.
  quantityManual: z.boolean().optional(),
  costManual: z.boolean().optional(),
  unit: z.string().max(50).optional(),
  /// null efface l'annee de pose : le rapport dit alors « non relevee ».
  yearInstalled: z.number().int().min(1500).max(2100).nullable().optional(),
  interventionYear: z.number().int().min(1900).max(2200).nullable().optional(),
  estimatedCost: z.number().min(0).nullable().optional(),
  /// Coefficient marche en vigueur au moment ou le cout a ete calcule.
  costIndex: z.number().positive().max(10).nullable().optional(),
  improvement: z.string().max(2000).nullable().optional(),
  improvementCost: z.number().min(0).nullable().optional(),
  norms: z.string().max(2000).nullable().optional(),
  normsCost: z.number().min(0).nullable().optional(),
  /// Releves dont l'amelioration rend la reparation inutile, celui-ci compris :
  /// le devis en deduit le montant net de l'option.
  improvementReplaces: z.array(z.string().min(1).max(40)).max(50).nullable().optional(),
});

// L'identifiant d'un relevé peut venir de l'appareil (UUID) : une saisie faite
// hors-ligne a ainsi son identifiant définitif dès le terrain, et un renvoi
// après une coupure ne crée pas de doublon (voir src/lib/hors-ligne).
export const createItemSchema = itemBaseSchema.extend({ id: z.string().uuid().optional() });
export const updateItemSchema = itemBaseSchema.partial();

export type CreationReleve = z.infer<typeof createItemSchema>;
export type ModificationReleve = z.infer<typeof updateItemSchema>;

/**
 * Le corps d'une création renvoyée, lu comme une modification du relevé
 * déjà enregistré.
 *
 * Le renvoi arrive quand la réponse à la première création s'est perdue. Son
 * corps peut porter plus que le premier envoi (une version précédente de
 * l'app y fondait l'état, la note et les photos saisis entre-temps) : rendre
 * le relevé tel quel les perdait sans un mot. Il passe donc par le schéma de
 * la modification, qui laisse tomber l'identifiant et n'ajoute aucune valeur
 * par défaut : un champ absent du renvoi ne touche pas au relevé.
 */
export function modificationDuRenvoi(corps: CreationReleve): ModificationReleve {
  return updateItemSchema.parse(corps);
}
