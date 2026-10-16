/**
 * L'analyse d'un plan par l'IA, pour l'outil de métré.
 *
 * Le modèle regarde une page de plan rendue en image, dit ce qu'elle montre
 * (plan d'étage, élévation, coupe…), lit son échelle et une cote de contrôle,
 * puis dessine les zones à métrer : la façade, chacune de ses fenêtres, la
 * toiture, l'emprise. Ces zones arrivent dans l'outil Plan « à valider » : le
 * diagnostiqueur les relit, les corrige, les rattache à un ouvrage, et seules
 * celles qu'il valide comptent dans le métré.
 *
 * Ce module tient la consigne et la validation de la réponse. Un modèle se
 * trompe de façons prévisibles : un point hors de l'image, un contour qui se
 * recoupe, trois sommets alignés, un type inventé, un ouvrage qui n'est pas
 * dans la liste. Rien de cela ne part vers l'écran : la zone est écartée, avec
 * la raison, et l'écran dit combien l'ont été et pourquoi.
 *
 * Les coordonnées sont en pixels de l'image envoyée. L'image doit donc
 * arriver au modèle telle quelle, sans être réduite : au plus 2576 px de grand
 * côté et 3,75 mégapixels (4784 tuiles de 28 px). La route le vérifie avant
 * d'envoyer, sur les dimensions lues dans le fichier lui-même.
 *
 * Module sans base ni réseau, pour être vérifiable par les tests.
 */
import { z } from "zod";
import { sansTiretCadratin } from "./sans-tiret.js";
import { echelleLue } from "./lecture-plans.js";

// ---------------------------------------------------------------- vocabulaire

export const TYPES_PAGE = ["plan_etage", "elevation", "coupe", "toiture", "situation", "autre"] as const;
export type TypePage = (typeof TYPES_PAGE)[number];

export const TYPES_ZONE = ["facade", "fenetre", "porte", "toiture", "emprise", "dalle", "mur", "autre"] as const;
export type TypeZone = (typeof TYPES_ZONE)[number];

export const CONFIANCES = ["haute", "moyenne", "basse"] as const;
export type Confiance = (typeof CONFIANCES)[number];

export type Point = [number, number];

/** Une page telle qu'elle est envoyée : son numéro dans le document et l'image. */
export interface PageEnvoyee {
  numero: number;
  largeurImage: number;
  hauteurImage: number;
  /** Taille de la feuille en points PDF ; null pour une image. */
  largeurPt: number | null;
  hauteurPt: number | null;
}

/** Un ouvrage du relevé, proposé au rattachement. */
export interface OuvrageEnvoye {
  id: string;
  cfcCode: string | null;
  libelle: string;
  unite: string | null;
}

export interface PageAnalysee {
  page: number;
  type: TypePage;
  titre: string | null;
  orientation: string | null;
  echelle: string | null;
  echelleOu: string | null;
  cote: { texte: string; longueurM: number; p1: Point; p2: Point } | null;
  remarque: string | null;
}

export interface ZoneAnalysee {
  page: number;
  type: TypeZone;
  libelle: string;
  orientation: string | null;
  mesure: "surface" | "longueur";
  points: Point[];
  releveId: string | null;
  confiance: Confiance;
  valeurCotee: number | null;
  cotes: string | null;
  remarque: string | null;
}

export interface ZoneEcartee {
  page: number | null;
  libelle: string | null;
  raison: string;
}

export interface AnalysePlan {
  pages: PageAnalysee[];
  zones: ZoneAnalysee[];
  ecartees: ZoneEcartee[];
  remarques: string | null;
}

// ---------------------------------------------------------------- images

/** Grand côté au-delà duquel le modèle réduit l'image (et ses coordonnées ne collent plus). */
export const GRAND_COTE_MAX = 2576;
/** Tuiles de 28 px au plus : 3,75 mégapixels. */
export const TUILES_MAX = 4784;

export function tientDansLeModele(largeur: number, hauteur: number): boolean {
  return largeur > 0 && hauteur > 0 && Math.max(largeur, hauteur) <= GRAND_COTE_MAX
    && Math.ceil(largeur / 28) * Math.ceil(hauteur / 28) <= TUILES_MAX;
}

/**
 * Les dimensions d'une image PNG ou JPEG, lues dans le fichier.
 *
 * On ne croit pas le navigateur sur parole : les coordonnées que rendra le
 * modèle dépendent des vraies dimensions de l'image, et ce sont elles qui
 * servent à valider les points.
 */
export function dimensionsImage(octets: Buffer): { largeur: number; hauteur: number; type: "image/png" | "image/jpeg" } | null {
  // PNG : signature, puis le bloc IHDR et ses deux entiers de 4 octets.
  if (octets.length >= 24 && octets.readUInt32BE(0) === 0x89504e47 && octets.toString("ascii", 12, 16) === "IHDR") {
    return { largeur: octets.readUInt32BE(16), hauteur: octets.readUInt32BE(20), type: "image/png" };
  }
  // JPEG : on parcourt les segments jusqu'à un début d'image (SOF0 à SOF15, hors DHT, JPG et DAC).
  if (octets.length >= 4 && octets[0] === 0xff && octets[1] === 0xd8) {
    let i = 2;
    while (i + 9 < octets.length) {
      if (octets[i] !== 0xff) { i++; continue; }
      const marqueur = octets[i + 1];
      if (marqueur === 0xff) { i++; continue; }
      if (marqueur === 0xd8 || marqueur === 0x01 || (marqueur >= 0xd0 && marqueur <= 0xd7)) { i += 2; continue; }
      const longueur = octets.readUInt16BE(i + 2);
      if (marqueur >= 0xc0 && marqueur <= 0xcf && marqueur !== 0xc4 && marqueur !== 0xc8 && marqueur !== 0xcc) {
        return { hauteur: octets.readUInt16BE(i + 5), largeur: octets.readUInt16BE(i + 7), type: "image/jpeg" };
      }
      i += 2 + longueur;
    }
  }
  return null;
}

// ---------------------------------------------------------------- consigne

/** La présentation d'une page, placée juste avant son image. */
export function presentationDePage(p: PageEnvoyee): string {
  const feuille = p.largeurPt && p.hauteurPt
    ? `PDF vectoriel, feuille de ${Math.round((p.largeurPt * 25.4) / 72)} × ${Math.round((p.hauteurPt * 25.4) / 72)} mm`
    : "image (photo ou scan d'un plan)";
  return `Page ${p.numero} : image de ${p.largeurImage} × ${p.hauteurImage} px ; ${feuille}.`;
}

function ligneOuvrage(o: OuvrageEnvoye): string {
  return `${o.id} | ${o.cfcCode ?? "-"} | ${o.libelle.replace(/\s+/g, " ").slice(0, 120)} | ${o.unite ?? "-"}`;
}

/** Ce que le modèle reçoit après les images des pages. */
export function consigneAnalyse(pages: PageEnvoyee[], ouvrages: OuvrageEnvoye[]): string {
  const exemple = pages[0] ?? { numero: 1, largeurImage: 2296, hauteurImage: 1623 };
  const liste = ouvrages.length
    ? ouvrages.slice(0, 400).map(ligneOuvrage).join("\n")
    : "(le relevé ne contient encore aucun ouvrage : mets \"releveId\": null partout)";
  return `Tu es métreur en Suisse romande. Les images ci-dessus sont des pages de plans d'architecte, chacune précédée de son numéro de page et de sa taille en pixels. Tu prépares le métré : dire ce que montre chaque page, lire son échelle, et dessiner les zones à mesurer, que le diagnostiqueur validera une à une avant qu'elles comptent.

COORDONNÉES
Tous les points sont en pixels de l'image de leur page, sous la forme [x, y] : origine en haut à gauche, x vers la droite, y vers le bas. Une image de ${exemple.largeurImage} × ${exemple.hauteurImage} px va de [0, 0] à [${exemple.largeurImage}, ${exemple.hauteurImage}]. Vise le pixel exact : chaque point sera ensuite accroché au trait du dessin le plus proche, à une dizaine de pixels près, il doit donc tomber sur l'angle réellement dessiné et non à côté.

POUR CHAQUE PAGE
- "type" : "plan_etage", "elevation" (une façade), "coupe", "toiture" (plan de toiture), "situation" ou "autre" ;
- "titre" : tel qu'il est écrit (« Façade sud », « Rez-de-chaussée »), ou null ;
- "orientation" : pour une élévation, l'orientation de la façade (« sud », « nord-est ») si le titre ou le plan la donne, sinon null ;
- "echelle" : l'échelle imprimée, sous la forme « 1:100 », lue au cartouche ou sous le titre du dessin ; null si aucune n'est écrite. N'en déduis jamais une d'après le dessin. "echelleOu" : où tu l'as lue (« cartouche », « sous le titre »), ou null ;
- "cote" : UNE cote de contrôle, imprimée et bien lisible, de préférence la plus longue cote totale du dessin principal, horizontale ou verticale : { "texte": "12.40", "longueurM": 12.40, "p1": [x, y], "p2": [x, y] }. p1 et p2 sont les deux extrémités de la ligne de cote, là où elle croise ses lignes d'attache (au centre des traits obliques ou des pointes de flèches). Convertis en mètres : « 1240 » en centimètres vaut 12.40. null si aucune cote n'est lisible ;
- "zones" : les zones à métrer de la page (voir ci-dessous) ;
- "remarque" : ce qui gêne la lecture de la page, en une phrase, ou null.

CHAQUE ZONE
- "type" : "facade", "fenetre", "porte", "toiture", "emprise", "dalle", "mur" ou "autre" ;
- "libelle" : court et précis, pour la retrouver : « Façade sud », « Fenêtre 1er étage, 2e depuis la gauche », « Emprise du rez » ;
- "orientation" : pour une façade et ses ouvertures, sinon null ;
- "mesure" : "surface" (au moins 3 points, le contour fermé dans l'ordre, sans répéter le premier point à la fin) ou "longueur" (exactement 2 points, les deux extrémités d'un segment droit) ;
- "points" : la liste des sommets [x, y] ;
- "releveId" : l'ouvrage du relevé que cette zone quantifie, par son id dans la liste ci-dessous, avec une unité compatible (m² pour une surface, ml ou m pour une longueur) ; null si aucun ne convient vraiment ;
- "confiance" : "haute", "moyenne" ou "basse" ;
- "valeurCotee" : la surface en m² ou la longueur en m que donnent les cotes imprimées, si elles suffisent à la calculer (1.20 × 1.40 = 1.68), sinon null ; "cotes" : les cotes employées (« 1.20 × 1.40 »), sinon null ;
- "remarque" : ce qui est douteux, en une phrase, ou null.

CE QU'IL FAUT DESSINER
- Sur une élévation : la façade entière, zone "facade" : le contour extérieur brut du mur, du terrain fini (ou du haut du socle s'il est distinct) jusqu'au haut de l'acrotère ou à l'égout du toit, sans découper les ouvertures. Puis CHAQUE fenêtre et CHAQUE porte comme zone à part, au contour extérieur du cadre (le vide de maçonnerie), pour que la façade moins ses ouvertures se calcule. La toiture visible en élévation seulement si elle fait partie de la façade dessinée.
- Sur un plan d'étage : l'emprise (contour extérieur des murs de façade, au nu extérieur) ; la dalle (surface intérieure brute, au nu intérieur des murs de façade) si elle se lit clairement.
- Sur un plan de toiture : chaque pan de toiture.
- Sur une coupe ou un plan de situation : rien, sauf une surface évidente et utile au métré.

RÈGLES
1. Ne rien inventer : une zone qui n'est pas dessinée ne se propose pas, une cote illisible ne se devine pas.
2. Préférer les cotes imprimées : quand elles existent, place les points en accord avec elles et remplis "valeurCotee".
3. Rien hors du dessin : le cartouche, la légende, les cotes, les textes et le cadre de la feuille ne sont pas des zones.
4. Confiance basse dès que le contour est douteux (trait peu lisible, photo de travers, élément caché ou coupé), haute seulement quand le contour est net et que les cotes le confirment.
5. Au plus 150 zones en tout.
6. N'utilise jamais le tiret cadratin.

OUVRAGES DU RELEVÉ (id | CFC | libellé | unité)
${liste}

Réponds UNIQUEMENT par un objet JSON valide, sans texte autour :
{
 "pages": [
  {
   "page": ${exemple.numero}, "type": "elevation", "titre": "Façade sud", "orientation": "sud",
   "echelle": "1:100", "echelleOu": "cartouche",
   "cote": { "texte": "12.40", "longueurM": 12.40, "p1": [412, 1236], "p2": [1102, 1236] },
   "zones": [
    { "type": "facade", "libelle": "Façade sud", "orientation": "sud", "mesure": "surface", "points": [[412, 1110], [1102, 1110], [1102, 676], [412, 676]], "releveId": null, "confiance": "haute", "valeurCotee": 96.72, "cotes": "12.40 × 7.80", "remarque": null }
   ],
   "remarque": null
  }
 ],
 "remarques": "ce qu'il faut vérifier, en deux phrases au plus, ou null"
}`;
}

// ---------------------------------------------------------------- validation

const texte = (max: number) =>
  z.union([z.string(), z.number()]).transform((s) => sansTiretCadratin(String(s).trim()).slice(0, max) || null)
    .nullable().optional().catch(null);

const zoneBrute = z.object({
  page: z.unknown().optional(),
  type: z.unknown().optional(),
  libelle: texte(120),
  orientation: texte(30),
  mesure: z.unknown().optional(),
  points: z.unknown().optional(),
  releveId: z.unknown().optional(),
  confiance: z.unknown().optional(),
  valeurCotee: z.unknown().optional(),
  cotes: texte(80),
  remarque: texte(300),
}).passthrough();

const pageBrute = z.object({
  page: z.unknown().optional(),
  type: z.unknown().optional(),
  titre: texte(120),
  orientation: texte(30),
  echelle: z.unknown().optional(),
  echelleOu: texte(60),
  cote: z.unknown().optional(),
  zones: z.array(z.unknown()).optional().catch([]),
  remarque: texte(300),
}).passthrough();

const analyseBrute = z.object({
  pages: z.array(z.unknown()).optional().catch([]),
  zones: z.array(z.unknown()).optional().catch([]),
  remarques: texte(600),
}).passthrough();

const sansAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Au-delà, la réponse ne décrit plus un plan mais un inventaire : le reste est écarté. */
export const MAX_ZONES = 200;
/** Un contour de plus de sommets n'est pas une zone de métré. */
const MAX_SOMMETS = 200;

function typeDePage(v: unknown): TypePage {
  if (typeof v !== "string") return "autre";
  const t = sansAccents(v).replace(/[\s'-]+/g, "_");
  if ((TYPES_PAGE as readonly string[]).includes(t)) return t as TypePage;
  if (t.includes("etage") || t.includes("plan_du") || t === "plan" || t.includes("niveau")) return "plan_etage";
  if (t.includes("elevation") || t.includes("facade")) return "elevation";
  if (t.includes("coupe")) return "coupe";
  if (t.includes("toit")) return "toiture";
  if (t.includes("situation")) return "situation";
  return "autre";
}

function confianceLue(v: unknown): Confiance {
  if (typeof v !== "string") return "basse";
  const t = sansAccents(v);
  const anglais: Record<string, Confiance> = { high: "haute", medium: "moyenne", low: "basse" };
  return (CONFIANCES as readonly string[]).includes(t) ? (t as Confiance) : anglais[t] ?? "basse";
}

function nombre(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const t = v.replace(/[\s'’]/g, "").replace(",", ".");
    return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : null;
  }
  return null;
}

function entier(v: unknown): number | null {
  const n = nombre(v);
  return n !== null && Number.isInteger(n) ? n : null;
}

/**
 * Un point dans l'image, ou la raison de son refus.
 *
 * Un point qui dépasse le bord d'un demi pour cent est ramené sur le bord :
 * le modèle vise un angle du dessin collé au cadre, l'écart ne dit rien. Au-delà,
 * le point est faux, et la zone avec lui.
 */
function pointLu(v: unknown, l: number, h: number): Point | string {
  let x: number | null = null, y: number | null = null;
  if (Array.isArray(v) && v.length === 2) { x = nombre(v[0]); y = nombre(v[1]); }
  else if (v && typeof v === "object" && "x" in v && "y" in v) { x = nombre((v as { x: unknown }).x); y = nombre((v as { y: unknown }).y); }
  if (x === null || y === null) return "un point n'est pas une paire de nombres";
  const tx = l * 0.005, ty = h * 0.005;
  if (x < -tx || y < -ty || x > l + tx || y > h + ty) return `un point tombe hors de l'image (${Math.round(x)}, ${Math.round(y)})`;
  return [Math.min(l, Math.max(0, x)), Math.min(h, Math.max(0, y))];
}

function aire(pts: Point[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    s += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1];
  }
  return Math.abs(s) / 2;
}

function seCroisent(a: Point, b: Point, c: Point, d: Point): boolean {
  const o = (p: Point, q: Point, r: Point) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}

/** Un contour qui se recoupe (en huit, en nœud) n'a pas de surface qui veuille dire quelque chose. */
export function seRecoupe(pts: Point[]): boolean {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      // Côtés voisins : ils partagent un sommet, ce n'est pas un croisement.
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      if (seCroisent(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n])) return true;
    }
  }
  return false;
}

/** Retire les sommets répétés : deux points à moins d'un pixel, et le premier recopié à la fin. */
function sansDoublons(pts: Point[]): Point[] {
  const r: Point[] = [];
  for (const p of pts) {
    const d = r[r.length - 1];
    if (!d || Math.hypot(p[0] - d[0], p[1] - d[1]) >= 1) r.push(p);
  }
  if (r.length > 2 && Math.hypot(r[0][0] - r[r.length - 1][0], r[0][1] - r[r.length - 1][1]) < 1) r.pop();
  return r;
}

const LIBELLES_PAR_DEFAUT: Record<TypeZone, string> = {
  facade: "Façade", fenetre: "Fenêtre", porte: "Porte", toiture: "Toiture",
  emprise: "Emprise", dalle: "Dalle", mur: "Mur", autre: "Zone",
};

/**
 * La réponse brute du modèle, validée.
 *
 * `pages` dit ce qui a été envoyé (numéros et tailles d'image), `releveIds`
 * les ouvrages qui pouvaient être suggérés. Rend null si la réponse n'a pas
 * la forme d'une analyse.
 */
export function validerAnalyse(brut: unknown, pages: PageEnvoyee[], releveIds: string[]): AnalysePlan | null {
  if (!brut || typeof brut !== "object" || Array.isArray(brut)) return null;
  const lu = analyseBrute.safeParse(brut);
  if (!lu.success) return null;

  const envoyees = new Map(pages.map((p) => [p.numero, p]));
  const ouvrages = new Set(releveIds);
  const ecartees: ZoneEcartee[] = [];
  const zones: ZoneAnalysee[] = [];
  const pagesLues: PageAnalysee[] = [];
  const vues = new Set<number>();

  // Les zones peuvent arriver dans leur page (la forme demandée) ou à plat,
  // avec leur numéro de page : les deux se lisent.
  const aPlat: { brut: unknown; page: unknown }[] = (lu.data.zones ?? []).map((z) => ({
    brut: z, page: z && typeof z === "object" ? (z as { page?: unknown }).page : undefined,
  }));

  for (const pb of lu.data.pages ?? []) {
    const p = pageBrute.safeParse(pb);
    if (!p.success) continue;
    // Une seule page envoyée : un numéro absent ou faux ne peut désigner qu'elle.
    let numero = entier(p.data.page);
    if ((numero === null || !envoyees.has(numero)) && pages.length === 1) numero = pages[0].numero;
    const envoyee = numero !== null ? envoyees.get(numero) : undefined;
    if (!envoyee || numero === null) {
      const n = (p.data.zones ?? []).length;
      if (n > 0) ecartees.push({ page: numero, libelle: null, raison: `${n} zone${n > 1 ? "s" : ""} sur une page qui n'a pas été envoyée` });
      continue;
    }
    for (const z of p.data.zones ?? []) aPlat.push({ brut: z, page: numero });
    if (vues.has(numero)) continue;
    vues.add(numero);

    let cote: PageAnalysee["cote"] = null;
    let remarque = p.data.remarque ?? null;
    if (p.data.cote && typeof p.data.cote === "object") {
      const c = p.data.cote as Record<string, unknown>;
      const longueurM = nombre(c.longueurM);
      const p1 = pointLu(c.p1, envoyee.largeurImage, envoyee.hauteurImage);
      const p2 = pointLu(c.p2, envoyee.largeurImage, envoyee.hauteurImage);
      const raison = longueurM === null || longueurM < 0.1 || longueurM > 2000 ? "longueur invalide"
        : typeof p1 === "string" ? p1 : typeof p2 === "string" ? p2
        : Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) < 20 ? "extrémités trop proches pour contrôler l'échelle"
        : null;
      if (raison) remarque = [remarque, `Cote de contrôle écartée : ${raison}.`].filter(Boolean).join(" ");
      else cote = { texte: (texte(40).parse(c.texte) ?? String(longueurM)), longueurM: longueurM!, p1: p1 as Point, p2: p2 as Point };
    }

    pagesLues.push({
      page: numero,
      type: typeDePage(p.data.type),
      titre: p.data.titre ?? null,
      orientation: p.data.orientation ? p.data.orientation.toLowerCase() : null,
      echelle: echelleLue(p.data.echelle),
      echelleOu: p.data.echelleOu ?? null,
      cote,
      remarque,
    });
  }

  for (const { brut: zb, page } of aPlat) {
    const z = zoneBrute.safeParse(zb);
    if (!z.success) { ecartees.push({ page: null, libelle: null, raison: "zone illisible" }); continue; }
    const d = z.data;
    let numero = entier(page ?? d.page);
    if ((numero === null || !envoyees.has(numero)) && pages.length === 1) numero = pages[0].numero;
    const envoyee = numero !== null ? envoyees.get(numero) : undefined;
    const libelleBrut = d.libelle ?? null;
    const ecarter = (raison: string) => ecartees.push({ page: numero, libelle: libelleBrut, raison });

    if (!envoyee || numero === null) { ecarter("page qui n'a pas été envoyée"); continue; }
    if (zones.length >= MAX_ZONES) { ecarter(`au-delà de ${MAX_ZONES} zones`); continue; }

    const typeTexte = typeof d.type === "string" ? sansAccents(d.type).replace(/[\s-]+/g, "_") : "";
    if (!(TYPES_ZONE as readonly string[]).includes(typeTexte)) {
      ecarter(`type inconnu${typeTexte ? ` « ${String(d.type).slice(0, 30)} »` : ""}`);
      continue;
    }
    const type = typeTexte as TypeZone;

    if (!Array.isArray(d.points)) { ecarter("points absents"); continue; }
    if (d.points.length > MAX_SOMMETS) { ecarter(`plus de ${MAX_SOMMETS} sommets`); continue; }
    const lus = d.points.map((v) => pointLu(v, envoyee.largeurImage, envoyee.hauteurImage));
    const refus = lus.find((p): p is string => typeof p === "string");
    if (refus) { ecarter(refus); continue; }
    const points = sansDoublons(lus as Point[]);

    let mesure: "surface" | "longueur";
    if (d.mesure === undefined || d.mesure === null) mesure = points.length >= 3 ? "surface" : "longueur";
    else if (d.mesure === "surface" || d.mesure === "longueur") mesure = d.mesure;
    else { ecarter(`mesure inconnue « ${String(d.mesure).slice(0, 20)} »`); continue; }

    if (mesure === "surface") {
      if (points.length < 3) { ecarter("une surface demande au moins trois sommets distincts"); continue; }
      if (seRecoupe(points)) { ecarter("contour qui se recoupe"); continue; }
      // Une surface plus petite qu'un carré de quatre pixels, ou que le cent-millième de l'image, est un trait aplati.
      if (aire(points) < Math.max(16, envoyee.largeurImage * envoyee.hauteurImage * 1e-5)) { ecarter("contour aplati, sans surface"); continue; }
    } else {
      if (points.length !== 2) { ecarter("une longueur se donne par ses deux extrémités"); continue; }
      if (Math.hypot(points[1][0] - points[0][0], points[1][1] - points[0][1]) < 4) { ecarter("longueur nulle"); continue; }
    }

    let remarque = d.remarque ?? null;
    let releveId: string | null = null;
    if (typeof d.releveId === "string" && d.releveId.trim()) {
      if (ouvrages.has(d.releveId.trim())) releveId = d.releveId.trim();
      else remarque = [remarque, "Ouvrage suggéré inconnu du relevé : rattachement retiré."].filter(Boolean).join(" ");
    }
    const valeur = nombre(d.valeurCotee);

    zones.push({
      page: numero,
      type,
      libelle: libelleBrut || LIBELLES_PAR_DEFAUT[type],
      orientation: d.orientation ? d.orientation.toLowerCase() : null,
      mesure,
      points,
      releveId,
      confiance: confianceLue(d.confiance),
      valeurCotee: valeur !== null && valeur > 0 && valeur < 1_000_000 ? valeur : null,
      cotes: d.cotes ?? null,
      remarque,
    });
  }

  pagesLues.sort((a, b) => a.page - b.page);
  return { pages: pagesLues, zones, ecartees, remarques: lu.data.remarques ?? null };
}
