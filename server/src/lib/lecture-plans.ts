/**
 * La lecture d'un jeu de plans par l'IA, remise d'aplomb avant de partir vers
 * l'écran.
 *
 * Les métrés de Diagly partent de quelques chiffres du bâtiment : emprise,
 * périmètre, étages, hauteur d'étage, vitrages. Tirés des registres publics,
 * ils sont souvent faux (le périmètre y est même deviné depuis l'emprise).
 * Lus sur les plans d'architecte, ils deviennent des mesures. Encore faut-il
 * que la lecture dise d'où vient chaque chiffre, et qu'un chiffre absurde ne
 * passe pas pour une mesure : un modèle qui lit « 75 » étages ou une hauteur
 * d'étage de 27 m se trompe, et un devis bâti dessus serait faux de bout en
 * bout.
 *
 * Ce module tient donc trois règles, une fois, plutôt que de les confier au
 * modèle seul :
 * - chaque grandeur porte sa page, sa méthode (cote lue, surface imprimée,
 *   calcul depuis des cotes, estimation) et sa confiance ; une méthode
 *   absente vaut estimation, et une estimation n'a jamais qu'une confiance
 *   basse ;
 * - une valeur hors des bornes vraisemblables est remise à null, avec une
 *   remarque qui dit ce qui a été lu et pourquoi il est écarté ;
 * - deux valeurs qui se contredisent (un périmètre trop court pour l'emprise,
 *   plus de fenêtres que de façade) passent en confiance basse, puisqu'on ne
 *   sait pas laquelle est fausse.
 *
 * Module sans base ni réseau, pour être vérifiable par les tests.
 */
import { z } from "zod";
import { badRequest } from "./http-error.js";
import { sansTiretCadratin } from "./sans-tiret.js";
import {
  CATEGORIES_COMPTEES, DEFINITIONS_POUR_LIA, LIBELLES_CATEGORIES, NOMBRE_MAX, SURFACE_MAX, estUneCategorie,
  type CategorieComptee,
} from "./comptages.js";

// ---------------------------------------------------------------- vocabulaire

export const METHODES = ["cote lue", "surface imprimée", "calcul depuis des cotes", "estimation"] as const;
export type Methode = (typeof METHODES)[number];

export const CONFIANCES = ["haute", "moyenne", "basse"] as const;
export type Confiance = (typeof CONFIANCES)[number];

export type TypeToit = "PLATE" | "PENTE" | "MIXTE";

/** Une grandeur lue sur les plans, avec ce qui permet de la juger. */
export interface GrandeurLue<T> {
  valeur: T | null;
  /** Repère de la page, « F1 p. 3 » : fichier 1, page 3. */
  page: string | null;
  methode: Methode | null;
  confiance: Confiance | null;
  remarque: string | null;
}

interface Bornes {
  libelle: string;
  unite: string;
  min: number;
  max: number;
  entier?: boolean;
}

/**
 * Les grandeurs chiffrées, et ce qu'un bâtiment peut raisonnablement mesurer.
 *
 * Les bornes ne cherchent pas à juger une valeur plausible, seulement à
 * écarter l'impossible : une tour de soixante étages existe, pas une hauteur
 * d'étage de 1,20 m ni de 9 m.
 */
export const GRANDEURS = {
  emprise: { libelle: "emprise", unite: " m²", min: 5, max: 100_000 },
  perimetre: { libelle: "périmètre", unite: " m", min: 8, max: 5_000 },
  etagesHorsSol: { libelle: "étages hors sol", unite: "", min: 1, max: 60, entier: true },
  sousSols: { libelle: "sous-sols", unite: "", min: 0, max: 10, entier: true },
  hauteurEtage: { libelle: "hauteur d'étage", unite: " m", min: 2, max: 6 },
  hauteurTotale: { libelle: "hauteur totale", unite: " m", min: 2, max: 250 },
  surfacePlancher: { libelle: "surface de plancher", unite: " m²", min: 5, max: 1_000_000 },
  surfaceFacade: { libelle: "surface de façade", unite: " m²", min: 5, max: 500_000 },
  surfaceFenetres: { libelle: "surface des fenêtres", unite: " m²", min: 0.5, max: 200_000 },
  tauxVitrage: { libelle: "taux de vitrage", unite: " %", min: 0, max: 100 },
  logements: { libelle: "logements", unite: "", min: 0, max: 2_000, entier: true },
  cagesEscalier: { libelle: "cages d'escalier", unite: "", min: 0, max: 100, entier: true },
  surfaceToiture: { libelle: "surface de toiture", unite: " m²", min: 5, max: 200_000 },
} as const satisfies Record<string, Bornes>;

export type CleGrandeur = keyof typeof GRANDEURS;
export const CLES_GRANDEURS = Object.keys(GRANDEURS) as CleGrandeur[];

/** Une façade d'une orientation donnée : la même mesure, à plus petite échelle. */
const BORNES_FACADE_ORIENTEE: Bornes = { libelle: "surface de façade", unite: " m²", min: 1, max: 200_000 };

/** Comment un nombre d'éléments a été obtenu. */
export const METHODES_COMPTAGE = [
  "compté sur le plan", "compté et multiplié par les étages identiques", "lu dans un tableau", "estimation",
] as const;
export type MethodeComptage = (typeof METHODES_COMPTAGE)[number];

/** Un nombre d'éléments lu sur les plans : portes palières, fenêtres, balcons… */
export interface ElementLu {
  nombre: number | null;
  /** Surface totale en m², pour les fenêtres seulement. */
  surface: number | null;
  pages: string[];
  methode: MethodeComptage | null;
  confiance: Confiance | null;
  /** Le calcul, en clair : « 2 portes palières par palier × 3 étages = 6 ». */
  detail: string | null;
  remarque: string | null;
}

export interface PageDePlan {
  page: string;
  type: string | null;
  titre: string | null;
  /** « 1:100 », ou null si la page n'en indique pas. */
  echelle: string | null;
}

export interface LecturePlans {
  estUnJeuDePlans: boolean;
  projet: { nom: string | null; adresse: string | null; npa: string | null; localite: string | null; canton: string | null };
  pages: PageDePlan[];
  grandeurs: Record<CleGrandeur, GrandeurLue<number>>;
  typeToit: GrandeurLue<TypeToit>;
  /** Logements par nombre de pièces à la suisse : { "3.5": 4 }. */
  typologies: GrandeurLue<Record<string, number>>;
  facadesParOrientation: (GrandeurLue<number> & { orientation: string })[];
  /** Les éléments comptés, une entrée par catégorie (null quand les plans ne permettent pas de compter). */
  elements: Record<CategorieComptee, ElementLu>;
  remarques: string | null;
}

// ---------------------------------------------------------------- consigne

/** Ce que l'IA reçoit après les fichiers. Les clés citées sont celles de GRANDEURS. */
export const CONSIGNE_PLANS = `Tu es architecte et métreur en Suisse romande. Les fichiers ci-dessus, repérés F1, F2, etc., forment le jeu de plans d'un bâtiment : plans d'étage, élévations (façades), coupes, plan de situation, cartouche. Certains peuvent être des photos de plans papier.

Lis-y les mesures du bâtiment, comme le ferait un métreur : elles serviront à calculer les quantités des travaux.

Désigne chaque page par son fichier et son numéro, sous la forme « F1 p. 3 » (une image n'a qu'une page : « F2 p. 1 »). Pour chaque page, relève son type (plan d'étage, élévation, coupe, situation, cartouche, détail, autre), son titre tel qu'il est écrit (« Rez-de-chaussée », « Façade sud ») et son échelle si elle est indiquée, sous la forme « 1:100 ».

Les grandeurs, et ce qu'elles désignent :
- emprise (m²) : surface au sol du bâtiment, au contour extérieur des murs du rez, sans terrasses ni balcons ouverts ;
- perimetre (m) : longueur du contour extérieur des façades au rez ;
- etagesHorsSol : niveaux au-dessus du terrain, rez compris ; des combles aménagés comptent, un comble perdu non ;
- sousSols : nombre de niveaux enterrés ;
- hauteurEtage (m) : d'un plancher fini au suivant, valeur courante des étages, lue sur une coupe ;
- hauteurTotale (m) : du terrain au faîte ou à l'acrotère ;
- surfacePlancher (m²) : somme des surfaces brutes des niveaux hors sol, murs compris ;
- surfaceFacade (m²) : surface brute de toutes les façades hors sol, ouvertures comprises, au total ; et, si les élévations le permettent, par orientation dans "facadesParOrientation" ;
- surfaceFenetres (m²) : somme des ouvertures vitrées en façade (fenêtres, portes-fenêtres, vitrages) ;
- tauxVitrage (%) : surfaceFenetres divisée par surfaceFacade, en pourcent (30 pour 30 %) ;
- logements : nombre de logements ; et dans "typologies", leur répartition par nombre de pièces à la suisse (« 3.5 » : 4) ;
- cagesEscalier : nombre de cages d'escalier communes ;
- typeToit : PLATE, PENTE ou MIXTE ;
- surfaceToiture (m²) : surface de la couverture ; pour un toit en pente, celle des pans et non leur projection.

Compte aussi les éléments du bâtiment, dans "elements", une entrée par catégorie :
${CATEGORIES_COMPTEES.map((c) => `- ${DEFINITIONS_POUR_LIA[c]} ;`).join("\n")}

Chaque grandeur prend la forme G suivante :
{ "valeur": 226.3, "page": "F1 p. 2", "methode": "cote lue | surface imprimée | calcul depuis des cotes | estimation", "confiance": "haute | moyenne | basse", "remarque": "..." }

Règles :
1. Préfère ce qui est écrit sur le plan : une cote, une surface imprimée (tableau des surfaces, étiquette de pièce, cartouche). Une longueur mesurée sur le dessin à l'aide de l'échelle est une estimation.
2. Quand une valeur est déduite de cotes, écris le calcul dans "remarque" (par exemple « 12,40 × 18,25 = 226,3 m² »).
3. N'invente jamais. Une grandeur que les plans ne permettent pas de lire vaut null, avec dans "remarque" ce qui manque (par exemple « aucune coupe fournie »).
4. Une estimation n'est permise que marquée comme telle : "methode": "estimation" et "confiance": "basse", avec son raisonnement dans "remarque".
5. "confiance" : haute si la valeur est écrite et bien lisible ; moyenne si elle est calculée depuis des cotes sûres, ou à peine lisible ; basse sinon.
6. Les valeurs en chiffres (226.3), sans unité ni texte.
7. Si deux plans se contredisent, retiens la valeur la plus sûre et signale l'écart dans "remarque".

Chaque élément compté prend la forme E suivante :
{ "nombre": 8, "surface": null, "pages": ["F1 p. 2"], "methode": "compté sur le plan | compté et multiplié par les étages identiques | lu dans un tableau | estimation", "confiance": "haute | moyenne | basse", "detail": "2 portes palières par palier × 4 étages = 8" }

Règles du comptage :
8. Compte sur les plans d'étage. Une porte se reconnaît à son arc d'ouverture (un quart de cercle) ; une porte palière est la porte d'un logement qui donne sur la cage d'escalier ; la porte d'entrée d'immeuble est la porte extérieure de la cage.
9. Les fenêtres se comptent sur les élévations ET se recoupent avec les plans d'étage, sans compter deux fois la même : une fenêtre vue sur la façade sud et dans le plan du 1er étage est une seule fenêtre. "surface" : la somme de leurs surfaces en m², seulement si les cotes la donnent, sinon null ; jamais pour une autre catégorie.
10. Un plan d'« étage type » vaut pour chaque étage qu'il représente (son titre le dit : « Étage type (2e au 5e) » vaut 4 étages) : multiplie par ce nombre d'étages, "methode": "compté et multiplié par les étages identiques", et écris la multiplication dans "detail". Ajoute les étages dessinés à part (rez, attique) sans les compter deux fois.
11. "detail" donne toujours le calcul en une phrase courte, même sans multiplication (« 2 au rez + 2 par étage × 4 étages = 10 »).
12. N'invente jamais. Une catégorie que les plans ne permettent pas de compter vaut { "nombre": null } avec dans "detail" ce qui manque (par exemple « salles de bain non dessinées ») ; zéro seulement si les plans montrent qu'il n'y en a aucune.
13. Une estimation n'est permise que marquée comme telle : "methode": "estimation" et "confiance": "basse", avec le raisonnement dans "detail".

Réponds UNIQUEMENT par un objet JSON valide, sans texte autour :
{
 "estUnJeuDePlans": true,
 "projet": { "nom": "nom du projet au cartouche, ou null", "adresse": "rue et numéro, ou null", "npa": "1003", "localite": "Lausanne", "canton": "VD" },
 "pages": [ { "page": "F1 p. 1", "type": "plan d'étage", "titre": "Rez-de-chaussée", "echelle": "1:100" } ],
 "grandeurs": {
  "emprise": G, "perimetre": G, "etagesHorsSol": G, "sousSols": G, "hauteurEtage": G, "hauteurTotale": G,
  "surfacePlancher": G, "surfaceFacade": G, "surfaceFenetres": G, "tauxVitrage": G,
  "logements": G, "cagesEscalier": G, "typeToit": G, "surfaceToiture": G
 },
 "facadesParOrientation": [ { "orientation": "Sud", "valeur": 180.5, "page": "F3 p. 1", "methode": "calcul depuis des cotes", "confiance": "moyenne", "remarque": "..." } ],
 "typologies": { "valeur": { "3.5": 4, "4.5": 2 }, "page": "F1 p. 2", "methode": "surface imprimée", "confiance": "haute", "remarque": "..." },
 "elements": {
  ${CATEGORIES_COMPTEES.map((c) => `"${c}": E`).join(", ")}
 },
 "remarques": "ce qui manque au jeu de plans ou ce qu'il faut vérifier, en deux phrases au plus"
}
L'adresse et le nom du projet ne se remplissent que s'ils figurent sur les plans (cartouche, plan de situation) ; sinon null. "estUnJeuDePlans" = false si les fichiers ne montrent aucun plan de bâtiment. N'utilise jamais le tiret cadratin.`;

// ---------------------------------------------------------------- fichiers

const MO = 1024 * 1024;

/**
 * Une image ne doit pas dépasser 5 Mo une fois encodée, ni la requête entière
 * 32 Mo : au-delà, l'API la refuse en bloc. Mieux vaut le dire avant d'envoyer
 * qu'après une attente de plusieurs minutes.
 */
export const MAX_IMAGE_ENCODEE = 5 * MO;
export const MAX_REQUETE_ENCODEE = 31 * MO;

const TYPES_IMAGE: Record<string, "image/jpeg" | "image/png" | "image/webp"> = {
  "image/jpeg": "image/jpeg", "image/jpg": "image/jpeg", "image/png": "image/png", "image/webp": "image/webp",
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
};

export type BlocPlan =
  | { type: "text"; text: string }
  | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } }
  | { type: "image"; source: { type: "base64"; media_type: "image/jpeg" | "image/png" | "image/webp"; data: string } };

export interface FichierRecu { nom: string; type: string; contenu: Buffer }

/**
 * Les fichiers reçus, sous la forme que le modèle lit : chacun précédé de son
 * repère (F1, F2…), pour que la lecture puisse dire de quelle page vient
 * chaque mesure. Les PDF partent en blocs « document », les images en blocs
 * « image ».
 */
export function blocsDesPlans(fichiers: FichierRecu[]): BlocPlan[] {
  const blocs: BlocPlan[] = [];
  let total = 0;
  fichiers.forEach((f, i) => {
    const ext = f.nom.toLowerCase().split(".").pop() ?? "";
    const data = f.contenu.toString("base64");
    total += data.length;
    blocs.push({ type: "text", text: `Fichier F${i + 1} : « ${f.nom} »` });
    if (f.type === "application/pdf" || ext === "pdf") {
      blocs.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data } });
      return;
    }
    const image = TYPES_IMAGE[f.type] ?? TYPES_IMAGE[ext];
    if (!image) throw badRequest(`« ${f.nom} » n'est ni un PDF ni une image JPEG, PNG ou WEBP.`);
    if (data.length > MAX_IMAGE_ENCODEE) {
      throw badRequest(`L'image « ${f.nom} » est trop lourde pour être lue : réduisez-la, ou envoyez le plan en PDF.`);
    }
    blocs.push({ type: "image", source: { type: "base64", media_type: image, data } });
  });
  if (total > MAX_REQUETE_ENCODEE) {
    throw badRequest("Ces plans sont trop lourds pour être lus en une fois (environ 23 Mo au total). Retirez les pages inutiles ou allégez les PDF.");
  }
  return blocs;
}

// ---------------------------------------------------------------- validation

const texte = (max: number) =>
  z.string().transform((s) => s.trim().slice(0, max)).nullable().optional().catch(null);

/** Une grandeur telle que le modèle l'écrit ; un nombre nu vaut { valeur }. */
const grandeurBrute = z.preprocess(
  (v) => (typeof v === "number" || typeof v === "string" ? { valeur: v } : v),
  z.object({
    valeur: z.unknown().optional(),
    page: z.union([z.string(), z.number()]).nullable().optional().catch(null),
    methode: z.string().nullable().optional().catch(null),
    confiance: z.string().nullable().optional().catch(null),
    remarque: texte(600),
  }),
).nullable().optional().catch(null);

type GrandeurBrute = z.infer<typeof grandeurBrute>;

const lectureBrute = z.object({
  estUnJeuDePlans: z.boolean().optional().catch(undefined),
  projet: z.object({ nom: texte(200), adresse: texte(200), npa: texte(10), localite: texte(120), canton: texte(10) })
    .partial().nullable().optional().catch(null),
  pages: z.array(z.object({
    page: z.union([z.string(), z.number()]).nullable().optional().catch(null),
    type: texte(60),
    titre: texte(120),
    echelle: z.union([z.string(), z.number()]).nullable().optional().catch(null),
  }).catch({ page: null, type: null, titre: null, echelle: null })).optional().catch([]),
  grandeurs: z.record(z.string(), z.unknown()).optional().catch({}),
  facadesParOrientation: z.array(z.unknown()).optional().catch([]),
  typologies: z.unknown().optional(),
  elements: z.unknown().optional(),
  remarques: texte(800),
});

const sansAccents = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** Un nombre écrit en chiffres : 226.3, « 226,3 », « 1'450 ». Rien d'autre. */
export function nombreLu(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const t = v.replace(/[\s'\u2019\u00a0\u202f]/g, "").replace(",", ".");
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : null;
}

const arrondi = (v: number, decimales = 2) => Math.round(v * 10 ** decimales) / 10 ** decimales;
/** Un nombre à la française, pour les remarques : 2,7 et non 2.7. */
const fr = (v: number) => String(arrondi(v)).replace(".", ",");

function methodeLue(v: string | null | undefined): Methode | null {
  if (!v) return null;
  const t = sansAccents(v);
  return METHODES.find((m) => sansAccents(m) === t) ?? null;
}

function confianceLue(v: string | null | undefined): Confiance | null {
  if (!v) return null;
  const t = sansAccents(v);
  const anglais: Record<string, Confiance> = { high: "haute", medium: "moyenne", low: "basse" };
  return CONFIANCES.find((c) => c === t) ?? anglais[t] ?? null;
}

/**
 * Le repère d'une page, ramené à « F1 p. 3 ».
 *
 * Un repère qui désigne un fichier qui n'a pas été envoyé ne renvoie à rien :
 * il est écarté plutôt que d'envoyer le diagnostiqueur chercher une page qui
 * n'existe pas.
 */
export function repereDePage(v: unknown, nbFichiers: number): string | null {
  if (typeof v === "number" && Number.isInteger(v) && v > 0) return nbFichiers === 1 ? `F1 p. ${v}` : `p. ${v}`;
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  const m = t.match(/^F\s*(\d+)\s*[,;:-]?\s*(?:p(?:age)?\.?\s*(\d+))?$/i);
  if (m) {
    const f = Number(m[1]);
    if (f < 1 || f > nbFichiers) return null;
    return m[2] ? `F${f} p. ${Number(m[2])}` : `F${f}`;
  }
  return t.slice(0, 40);
}

/** L'échelle d'une page, ramenée à « 1:100 ». Ce qui ne s'y ramène pas vaut null. */
export function echelleLue(v: unknown): string | null {
  if (typeof v === "number") return Number.isInteger(v) && v >= 2 && v <= 100_000 ? `1:${v}` : null;
  if (typeof v !== "string") return null;
  const m = v.match(/1\s*[:/]\s*(\d[\d'\u2019]*)/);
  if (!m) return null;
  const d = Number(m[1].replace(/['\u2019]/g, ""));
  return d >= 2 && d <= 100_000 ? `1:${d}` : null;
}

const joindre = (...morceaux: (string | null | undefined)[]) => {
  const t = morceaux.filter((m) => m && m.trim()).join(" ");
  return t ? sansTiretCadratin(t) : null;
};

const vide = <T>(remarque: string | null = null): GrandeurLue<T> => ({ valeur: null, page: null, methode: null, confiance: null, remarque });

/**
 * Méthode et confiance d'une valeur retenue.
 *
 * Une valeur sans méthode est traitée comme une estimation : rien ne dit
 * qu'elle a été lue. Et une estimation n'a jamais plus qu'une confiance
 * basse, quoi que le modèle en dise.
 */
function jugement(g: NonNullable<GrandeurBrute>): { methode: Methode; confiance: Confiance; note: string | null } {
  const lue = methodeLue(g.methode);
  const methode = lue ?? "estimation";
  const confiance = methode === "estimation" ? "basse" : confianceLue(g.confiance) ?? "basse";
  return { methode, confiance, note: lue ? null : "Méthode non indiquée : traitée comme une estimation." };
}

function grandeurChiffree(brut: unknown, bornes: Bornes, nbFichiers: number, taux = false): GrandeurLue<number> {
  const g = grandeurBrute.parse(brut);
  if (!g) return vide();
  const remarque = g.remarque ?? null;
  const page = repereDePage(g.page, nbFichiers);
  const lu = nombreLu(g.valeur);
  if (lu === null) {
    const illisible = g.valeur !== null && g.valeur !== undefined && String(g.valeur).trim() !== "";
    return vide(joindre(illisible ? `Valeur illisible écartée (« ${String(g.valeur).slice(0, 40)} »).` : null, remarque));
  }

  const ecartee = (pourquoi: string): GrandeurLue<number> => ({ valeur: null, page, methode: null, confiance: null, remarque: joindre(pourquoi, remarque) });
  let v = lu;
  let conversion: string | null = null;
  // Le modèle rend parfois la part vitrée en fraction (0,3) malgré la consigne :
  // c'est une écriture, pas une autre mesure.
  if (taux && v > 0 && v < 1) {
    v = arrondi(v * 100, 1);
    conversion = `Lu en fraction (${fr(lu)}), converti en pourcent.`;
  }
  const u = bornes.unite;
  if (v < 0) return ecartee(`Valeur négative écartée (${fr(v)}${u}).`);
  if (bornes.entier && !Number.isInteger(v)) return ecartee(`Valeur non entière écartée (${fr(v)}${u}).`);
  if (v < bornes.min || v > bornes.max) {
    return ecartee(`Valeur écartée : ${fr(v)}${u}, hors des bornes vraisemblables pour ${bornes.libelle} (${fr(bornes.min)} à ${fr(bornes.max)}${u}).`);
  }
  const { methode, confiance, note } = jugement(g);
  return { valeur: arrondi(v), page, methode, confiance, remarque: joindre(conversion, note, remarque) };
}

function typeToitLu(brut: unknown, nbFichiers: number): GrandeurLue<TypeToit> {
  const g = grandeurBrute.parse(brut);
  if (!g) return vide();
  const remarque = g.remarque ?? null;
  if (g.valeur === null || g.valeur === undefined || String(g.valeur).trim() === "") return vide(remarque);
  const t = sansAccents(String(g.valeur));
  const valeur: TypeToit | null =
    t.startsWith("plat") ? "PLATE"
    : t.includes("mixte") ? "MIXTE"
    : t.includes("pente") || t.includes("pans") ? "PENTE"
    : null;
  if (!valeur) return vide(joindre(`Type de toit non reconnu (« ${String(g.valeur).slice(0, 40)} »).`, remarque));
  const { methode, confiance, note } = jugement(g);
  return { valeur, page: repereDePage(g.page, nbFichiers), methode, confiance, remarque: joindre(note, remarque) };
}

/** Les typologies, avec des clés que le dossier accepte (« 3.5 ») et des nombres entiers. */
function typologiesLues(brut: unknown, nbFichiers: number): GrandeurLue<Record<string, number>> {
  const g = grandeurBrute.parse(brut);
  if (!g) return vide();
  const remarque = g.remarque ?? null;
  const v = g.valeur;
  if (!v || typeof v !== "object" || Array.isArray(v)) return vide(remarque);
  const r: Record<string, number> = {};
  const ecartees: string[] = [];
  for (const [k, n] of Object.entries(v as Record<string, unknown>)) {
    const cle = k.replace(",", ".").replace(/\s*(pi[eè]ces?|p\.?)$/i, "").trim();
    const nb = nombreLu(n);
    if (/^\d{1,2}(\.5)?$/.test(cle) && nb !== null && Number.isInteger(nb) && nb > 0 && nb <= 2_000) {
      r[cle] = (r[cle] ?? 0) + nb;
    } else {
      ecartees.push(k);
    }
  }
  const note = ecartees.length ? `Typologies écartées : ${ecartees.slice(0, 5).map((e) => `« ${e} »`).join(", ")}.` : null;
  if (Object.keys(r).length === 0) return vide(joindre(note, remarque));
  const { methode, confiance, note: noteMethode } = jugement(g);
  return { valeur: r, page: repereDePage(g.page, nbFichiers), methode, confiance, remarque: joindre(note, noteMethode, remarque) };
}

function methodeDeComptage(v: unknown): MethodeComptage | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const t = sansAccents(v);
  return METHODES_COMPTAGE.find((m) => sansAccents(m) === t)
    // Le modèle abrège parfois : « multiplié par les étages », « tableau ».
    ?? (t.includes("multipli") ? "compté et multiplié par les étages identiques"
      : t.includes("tableau") ? "lu dans un tableau"
      : t.includes("estim") ? "estimation"
      : t.includes("compt") ? "compté sur le plan"
      : null);
}

const elementVide = (remarque: string | null = null, detail: string | null = null): ElementLu => ({
  nombre: null, surface: null, pages: [], methode: null, confiance: null, detail, remarque,
});

/**
 * Un élément compté, validé.
 *
 * Mêmes règles que les grandeurs : un nombre négatif, décimal ou hors des
 * bornes ne passe pas pour un compte, il est remis à null avec ce qui a été
 * lu ; sans méthode, c'est une estimation, et une estimation n'a jamais
 * qu'une confiance basse.
 */
function elementLu(brut: unknown, categorie: CategorieComptee, nbFichiers: number): ElementLu {
  const objet = typeof brut === "number" || typeof brut === "string" ? { nombre: brut } : brut;
  if (!objet || typeof objet !== "object" || Array.isArray(objet)) return elementVide();
  const e = objet as Record<string, unknown>;
  const detailLu = texte(300).parse(e.detail ?? e.calcul);
  const detail = detailLu ? sansTiretCadratin(detailLu) : null;
  const remarque = texte(300).parse(e.remarque) ?? null;
  const brutNombre = e.nombre ?? e.valeur;
  if (brutNombre === null || brutNombre === undefined || String(brutNombre).trim() === "") {
    return elementVide(remarque ? sansTiretCadratin(remarque) : null, detail);
  }
  const n = nombreLu(brutNombre);
  const ecarte = (pourquoi: string) => elementVide(joindre(pourquoi, remarque), detail);
  if (n === null) return ecarte(`Nombre illisible écarté (« ${String(brutNombre).slice(0, 40)} »).`);
  if (n < 0) return ecarte(`Nombre négatif écarté (${fr(n)}).`);
  if (!Number.isInteger(n)) return ecarte(`Nombre non entier écarté (${fr(n)}) : un élément se compte à l'unité.`);
  if (n > NOMBRE_MAX) return ecarte(`Nombre écarté : ${n}, au-delà de ${NOMBRE_MAX} ${LIBELLES_CATEGORIES[categorie]}.`);

  const pagesBrutes: unknown[] = Array.isArray(e.pages) ? e.pages : e.pages !== undefined ? [e.pages] : e.page !== undefined ? [e.page] : [];
  const pages = [...new Set(pagesBrutes.slice(0, 40).map((p) => repereDePage(p, nbFichiers)).filter((p): p is string => !!p))].slice(0, 20);

  let surface: number | null = null;
  let noteSurface: string | null = null;
  if (categorie === "fenetre" && e.surface !== null && e.surface !== undefined) {
    const sf = nombreLu(e.surface);
    if (sf !== null && sf > 0 && sf <= SURFACE_MAX) surface = arrondi(sf);
    else noteSurface = `Surface des fenêtres écartée (« ${String(e.surface).slice(0, 20)} »).`;
  }

  const lue = methodeDeComptage(e.methode);
  const methode: MethodeComptage = lue ?? "estimation";
  const confiance: Confiance = methode === "estimation" ? "basse" : confianceLue(typeof e.confiance === "string" ? e.confiance : null) ?? "basse";
  return {
    nombre: n,
    surface,
    pages,
    methode,
    confiance,
    detail,
    remarque: joindre(noteSurface, lue ? null : "Méthode non indiquée : traitée comme une estimation.", remarque),
  };
}

/**
 * Les éléments comptés, une entrée par catégorie connue. Le modèle peut les
 * rendre par clé (la forme demandée) ou en liste, chacun avec sa catégorie ;
 * une catégorie inconnue est écartée, et dite dans les remarques. Une
 * catégorie donnée deux fois garde sa première lecture.
 */
function elementsLus(brut: unknown, nbFichiers: number): { elements: Record<CategorieComptee, ElementLu>; inconnues: string[] } {
  const sources = new Map<CategorieComptee, unknown>();
  const inconnues: string[] = [];
  const ranger = (cle: unknown, v: unknown) => {
    const c = typeof cle === "string" ? sansAccents(cle).replace(/[\s'-]+/g, "_") : "";
    if (estUneCategorie(c)) { if (!sources.has(c)) sources.set(c, v); }
    else if (typeof cle === "string" && cle.trim()) inconnues.push(cle.trim().slice(0, 30));
  };
  if (Array.isArray(brut)) {
    for (const e of brut.slice(0, 50)) if (e && typeof e === "object") ranger((e as { categorie?: unknown }).categorie, e);
  } else if (brut && typeof brut === "object") {
    for (const [cle, v] of Object.entries(brut as Record<string, unknown>).slice(0, 50)) ranger(cle, v);
  }
  const elements = Object.fromEntries(
    CATEGORIES_COMPTEES.map((c) => [c, sources.has(c) ? elementLu(sources.get(c), c, nbFichiers) : elementVide()]),
  ) as Record<CategorieComptee, ElementLu>;
  return { elements, inconnues };
}

/** Passe une grandeur en confiance basse, avec la raison. */
function douter(g: GrandeurLue<unknown>, pourquoi: string) {
  g.confiance = "basse";
  g.remarque = joindre(g.remarque, pourquoi);
}

/**
 * Les contradictions entre grandeurs.
 *
 * Aucun contour ne peut entourer plus de surface qu'un cercle de même
 * longueur : un périmètre inférieur à 3,5 fois la racine de l'emprise est
 * impossible. Au-delà de 15 fois, le contour ressemble à celui d'un îlot
 * plutôt qu'à celui du bâtiment, l'erreur même des registres publics.
 */
function verifierLaCoherence(gr: Record<CleGrandeur, GrandeurLue<number>>, typologies: GrandeurLue<Record<string, number>>) {
  const { emprise: E, perimetre: P, surfaceFacade: F, surfaceFenetres: W, tauxVitrage: T, logements: L } = gr;
  if (E.valeur !== null && P.valeur !== null) {
    const rapport = P.valeur / Math.sqrt(E.valeur);
    if (rapport < 3.5) {
      const pourquoi = `Incohérent : un contour de ${fr(P.valeur)} m ne peut pas entourer ${fr(E.valeur)} m².`;
      douter(P, pourquoi);
      douter(E, pourquoi);
    } else if (rapport > 15) {
      douter(P, `Très long pour une emprise de ${fr(E.valeur)} m² : vérifiez qu'il s'agit du contour du seul bâtiment.`);
    }
  }
  if (F.valeur !== null && W.valeur !== null) {
    if (W.valeur > F.valeur) {
      const pourquoi = "Plus de fenêtres que de façade : l'une des deux valeurs est fausse.";
      douter(W, pourquoi);
      douter(F, pourquoi);
    } else if (T.valeur === null) {
      // Le taux se déduit des deux surfaces lues : c'est un calcul, pas une invention.
      const confiance: Confiance = [F.confiance, W.confiance].includes("basse") ? "basse"
        : [F.confiance, W.confiance].includes("moyenne") ? "moyenne" : "haute";
      gr.tauxVitrage = {
        valeur: arrondi((W.valeur / F.valeur) * 100, 1),
        page: null,
        methode: "calcul depuis des cotes",
        confiance,
        remarque: joindre(`Déduit des surfaces lues : ${fr(W.valeur)} m² de fenêtres pour ${fr(F.valeur)} m² de façade.`, T.remarque),
      };
    }
  }
  if (typologies.valeur && L.valeur !== null) {
    const somme = Object.values(typologies.valeur).reduce((s, n) => s + n, 0);
    if (somme !== L.valeur) douter(typologies, `La somme des typologies (${somme}) ne correspond pas au nombre de logements (${L.valeur}).`);
  }
}

/** Plafonds vraisemblables par logement : au-delà, le compte a sans doute pris un étage pour plusieurs. */
const PAR_LOGEMENT: Partial<Record<CategorieComptee, number>> = {
  porte_paliere: 3,
  cuisine: 2,
  balcon: 4,
  appareil_sanitaire: 12,
};

/**
 * Les comptes qui contredisent les grandeurs.
 *
 * Plus de trois portes palières par logement, plus de quatre portes d'entrée
 * par cage, plus de fenêtres en surface que la façade n'en porte : on ne
 * sait pas lequel des deux chiffres est faux, le compte passe en confiance
 * basse et la remarque dit pourquoi.
 */
function verifierLesComptes(elements: Record<CategorieComptee, ElementLu>, gr: Record<CleGrandeur, GrandeurLue<number>>) {
  const douterDuCompte = (e: ElementLu, pourquoi: string) => {
    e.confiance = "basse";
    e.remarque = joindre(e.remarque, pourquoi);
  };
  const L = gr.logements.valeur;
  if (L !== null && L > 0) {
    for (const [cle, plafond] of Object.entries(PAR_LOGEMENT) as [CategorieComptee, number][]) {
      const e = elements[cle];
      if (e.nombre !== null && e.nombre > L * plafond) {
        douterDuCompte(e, `${e.nombre} ${LIBELLES_CATEGORIES[cle]} pour ${L} logement${L > 1 ? "s" : ""} : plus de ${plafond} par logement, vérifiez qu'un étage n'a pas été compté deux fois.`);
      }
    }
  }
  const C = gr.cagesEscalier.valeur;
  const entrees = elements.porte_entree;
  if (C !== null && C > 0 && entrees.nombre !== null && entrees.nombre > C * 4) {
    douterDuCompte(entrees, `${entrees.nombre} portes d'entrée pour ${C} cage${C > 1 ? "s" : ""} d'escalier : plus de quatre par cage.`);
  }
  const f = elements.fenetre;
  const F = gr.surfaceFacade.valeur;
  if (f.surface !== null && F !== null && f.surface > F) {
    douterDuCompte(f, `${fr(f.surface)} m² de fenêtres pour ${fr(F)} m² de façade : l'une des deux valeurs est fausse.`);
  }
  if (f.nombre !== null && f.nombre > 0 && f.surface !== null && f.surface / f.nombre > 25) {
    douterDuCompte(f, `${fr(f.surface / f.nombre)} m² par fenêtre en moyenne : la surface ou le nombre est faux.`);
  }
}

/**
 * La lecture brute du modèle, validée. null si elle n'a pas la forme d'une
 * lecture (pas un objet, JSON hors sujet).
 */
export function validerLecturePlans(brut: unknown, nbFichiers: number): LecturePlans | null {
  if (!brut || typeof brut !== "object" || Array.isArray(brut)) return null;
  const lu = lectureBrute.safeParse(brut);
  if (!lu.success) return null;
  const d = lu.data;
  const sources = d.grandeurs ?? {};

  const grandeurs = Object.fromEntries(
    CLES_GRANDEURS.map((cle) => [cle, grandeurChiffree(sources[cle], GRANDEURS[cle], nbFichiers, cle === "tauxVitrage")]),
  ) as Record<CleGrandeur, GrandeurLue<number>>;
  const typologies = typologiesLues(d.typologies, nbFichiers);
  verifierLaCoherence(grandeurs, typologies);
  const { elements, inconnues } = elementsLus(d.elements, nbFichiers);
  verifierLesComptes(elements, grandeurs);

  const facadesParOrientation = (d.facadesParOrientation ?? []).slice(0, 12).flatMap((f) => {
    const orientation = f && typeof f === "object" && typeof (f as { orientation?: unknown }).orientation === "string"
      ? (f as { orientation: string }).orientation.trim().slice(0, 30) : "";
    if (!orientation) return [];
    const g = grandeurChiffree(f, BORNES_FACADE_ORIENTEE, nbFichiers);
    return g.valeur === null ? [] : [{ orientation, ...g }];
  });

  const pages = (d.pages ?? []).slice(0, 200).flatMap((p) => {
    const page = repereDePage(p.page, nbFichiers);
    const echelle = echelleLue(p.echelle);
    if (!page && !echelle && !p.titre) return [];
    return [{ page: page ?? "", type: p.type || null, titre: p.titre || null, echelle }];
  });

  const projet = d.projet ?? {};
  const npa = projet.npa && /^\d{4}$/.test(projet.npa) ? projet.npa : null;
  const canton = projet.canton && /^[A-Za-z]{2}$/.test(projet.canton) ? projet.canton.toUpperCase() : null;

  return {
    estUnJeuDePlans: d.estUnJeuDePlans !== false,
    projet: {
      nom: projet.nom || null,
      adresse: projet.adresse || null,
      npa,
      localite: projet.localite || null,
      canton,
    },
    pages,
    grandeurs,
    typeToit: typeToitLu(sources.typeToit, nbFichiers),
    typologies,
    facadesParOrientation,
    elements,
    remarques: joindre(
      d.remarques ?? null,
      inconnues.length ? `Comptes écartés, catégorie inconnue : ${inconnues.slice(0, 5).map((c) => `« ${c} »`).join(", ")}.` : null,
    ),
  };
}
