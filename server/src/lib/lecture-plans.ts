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
    remarques: d.remarques ? sansTiretCadratin(d.remarques) : null,
  };
}
