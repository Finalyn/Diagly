/**
 * Les éléments comptés d'un dossier, côté serveur : les catégories, ce que
 * l'IA doit compter dans chacune, et la validation de ce que le dossier
 * enregistre.
 *
 * Le navigateur a sa propre liste (src/lib/base-cfc/comptages.ts), avec le
 * rattachement aux articles de la base et le calcul des quantités. Le serveur
 * n'a besoin que des clés et des définitions : un test vérifie que les deux
 * listes portent les mêmes clés (comptages.test.ts).
 *
 * Module sans base ni réseau, pour être vérifiable par les tests.
 */
import { z } from "zod";
import { sansTiretCadratin } from "./sans-tiret.js";

export const CATEGORIES_COMPTEES = [
  "porte_entree", "porte_paliere", "porte_interieure", "fenetre",
  "fenetre_toit", "balcon", "cuisine", "appareil_sanitaire",
] as const;
export type CategorieComptee = (typeof CATEGORIES_COMPTEES)[number];

export function estUneCategorie(v: unknown): v is CategorieComptee {
  return typeof v === "string" && (CATEGORIES_COMPTEES as readonly string[]).includes(v);
}

/** Libellés pour les messages et les remarques. */
export const LIBELLES_CATEGORIES: Record<CategorieComptee, string> = {
  porte_entree: "portes d'entrée d'immeuble",
  porte_paliere: "portes palières",
  porte_interieure: "portes intérieures",
  fenetre: "fenêtres et portes-fenêtres",
  fenetre_toit: "fenêtres de toit et lanterneaux",
  balcon: "balcons",
  cuisine: "cuisines",
  appareil_sanitaire: "appareils sanitaires",
};

/**
 * Ce que l'IA doit compter dans chaque catégorie, et ce qu'elle doit en
 * laisser. Les confusions prévisibles y sont nommées : une porte palière
 * n'est pas une porte de communication, un évier de cuisine n'est pas un
 * appareil sanitaire (il appartient à l'agencement de cuisine, compté à part).
 */
export const DEFINITIONS_POUR_LIA: Record<CategorieComptee, string> = {
  porte_entree: "porte_entree : porte extérieure de la cage d'escalier, par où l'on entre dans l'immeuble (une porte à deux vantaux compte pour une) ; pas les portes de garage ni les accès privatifs d'un logement au rez",
  porte_paliere: "porte_paliere : porte d'un logement qui donne sur la cage d'escalier ou sur le palier commun ; une par logement et par accès, en général",
  porte_interieure: "porte_interieure : porte à l'intérieur d'un logement ou des locaux communs (chambres, salle de bain, cave, local technique) ; ni les portes palières ni les portes d'entrée",
  fenetre: "fenetre : fenêtre et porte-fenêtre en façade, vitrine comprise ; une fenêtre à plusieurs vantaux compte pour une ; ajoute \"surface\", la somme de leurs surfaces en m², si les cotes la donnent",
  fenetre_toit: "fenetre_toit : fenêtre de toit (toiture inclinée), lanterneau ou coupole (toiture plate)",
  balcon: "balcon : balcon, loggia ou terrasse en saillie, un par dalle de balcon",
  cuisine: "cuisine : cuisine ou coin cuisine d'un logement (agencement avec évier et plan de travail)",
  appareil_sanitaire: "appareil_sanitaire : WC, lavabo, lave-mains, douche, baignoire, bidet, urinoir ; pas l'évier de cuisine, qui appartient à la cuisine",
};

/** Au-delà, ce n'est plus un immeuble mais une erreur de lecture. */
export const NOMBRE_MAX = 5000;
/** Une surface de fenêtres plus grande serait celle d'un quartier. */
export const SURFACE_MAX = 200_000;

const texteCoupe = (max: number) =>
  z.string().nullable().optional().transform((s) => {
    const t = s ? sansTiretCadratin(s.trim()).slice(0, max).trim() : "";
    return t || null;
  });

/** Un comptage tel que le dossier l'enregistre. */
const comptageSchema = z.object({
  categorie: z.string().optional(),
  nombre: z.number().int().min(0).max(NOMBRE_MAX),
  surface: z.number().positive().max(SURFACE_MAX).nullable().optional(),
  source: z.enum(["plans", "analyse", "saisie"]),
  detail: texteCoupe(300),
  pages: z.array(z.string().max(200)).max(50).optional()
    .transform((l) => (l ?? []).map((p) => sansTiretCadratin(p.trim()).slice(0, 40)).filter(Boolean).slice(0, 20)),
  confiance: z.enum(["haute", "moyenne", "basse"]).nullable().optional(),
  valide: z.boolean().optional(),
  majLe: z.string().max(40).optional(),
});

export type ComptageEnregistre = {
  categorie: CategorieComptee;
  nombre: number;
  surface: number | null;
  source: "plans" | "analyse" | "saisie";
  detail: string | null;
  pages: string[];
  confiance: "haute" | "moyenne" | "basse" | null;
  valide: boolean;
  majLe: string;
};

/**
 * Les comptages d'un dossier, validés.
 *
 * Une catégorie inconnue est refusée plutôt qu'ignorée : elle trahit un
 * navigateur qui ne parle plus la même langue que le serveur, et un
 * comptage perdu sans un mot fausserait un devis. Les nombres hors bornes
 * sont refusés ; les textes, eux, sont seulement coupés et nettoyés.
 */
export const comptagesSchema = z.strictObject(
  Object.fromEntries(CATEGORIES_COMPTEES.map((c) => [c, comptageSchema.optional()])) as Record<CategorieComptee, z.ZodOptional<typeof comptageSchema>>,
).transform((r) => {
  const sortie: Partial<Record<CategorieComptee, ComptageEnregistre>> = {};
  for (const cle of CATEGORIES_COMPTEES) {
    const c = r[cle];
    if (!c) continue;
    const date = c.majLe && !Number.isNaN(Date.parse(c.majLe)) ? new Date(c.majLe).toISOString() : new Date().toISOString();
    sortie[cle] = {
      categorie: cle,
      nombre: c.nombre,
      // Seules les fenêtres portent une surface : ailleurs, elle ne servirait à rien.
      surface: cle === "fenetre" ? c.surface ?? null : null,
      source: c.source,
      detail: c.detail,
      pages: c.pages,
      confiance: c.confiance ?? null,
      valide: c.valide ?? false,
      majLe: date,
    };
  }
  return sortie;
});
