import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import ExcelJS from "exceljs";
import mammoth from "mammoth";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middlewares/auth.js";
import { aiLimiter } from "../middlewares/rate-limit.js";
import { env } from "../lib/env.js";
import { logger } from "../lib/logger.js";
import { badRequest } from "../lib/http-error.js";

/**
 * Démarrer un diagnostic à partir d'un fichier.
 *
 * Deux portes : un document quelconque (ancien rapport, relevé Excel, état des
 * lieux Word ou PDF), dont l'IA tire le bâtiment et les éléments observés ; ou
 * un certificat énergétique CECB, dont elle tire le bâtiment, l'étiquette et
 * les mesures recommandées.
 *
 * Les éléments sont rapprochés des articles de la base CFC par l'IA, qui reçoit
 * la liste complète ; le serveur vérifie ensuite chaque rapprochement (article
 * existant, étape où il se relève) et écarte ce qui ne tient pas. Rien n'est
 * créé ici : la réponse sert à pré-remplir l'assistant de création, que
 * l'utilisateur relit avant de valider.
 */
const router = Router();
router.use(requireAuth);
router.use(aiLimiter);

const MO = 1024 * 1024;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * MO } });
/** Un fichier trop lourd donne un message, pas une erreur 500. */
const recevoir: import("express").RequestHandler = (req, res, next) =>
  upload.single("file")(req, res, (err: unknown) => {
    if (err && (err as { code?: string }).code === "LIMIT_FILE_SIZE") return next(badRequest("Fichier trop lourd : 12 Mo au plus."));
    return next(err as Error | undefined);
  });

/** Au-delà, le texte coûte cher et n'apporte plus rien : un relevé tient dans bien moins. */
const MAX_TEXTE = 120_000;

type Bloc =
  | { type: "text"; text: string }
  | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } };

const extension = (nom: string) => nom.toLowerCase().split(".").pop() ?? "";

/** Le fichier, sous une forme que Claude lit : le PDF tel quel, le reste en texte. */
async function contenuDuFichier(file: Express.Multer.File): Promise<Bloc> {
  const ext = extension(file.originalname);
  if (file.mimetype === "application/pdf" || ext === "pdf") {
    return { type: "document", source: { type: "base64", media_type: "application/pdf", data: file.buffer.toString("base64") } };
  }
  if (ext === "docx") {
    const { value } = await mammoth.extractRawText({ buffer: file.buffer });
    return { type: "text", text: `Contenu du document Word « ${file.originalname} » :\n\n${value.slice(0, MAX_TEXTE)}` };
  }
  if (ext === "xlsx" || ext === "xlsm") {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(file.buffer as unknown as ArrayBuffer);
    const feuilles: string[] = [];
    wb.eachSheet((ws) => {
      const lignes: string[] = [];
      ws.eachRow({ includeEmpty: false }, (row) => {
        const valeurs = (row.values as unknown[]).slice(1).map((v) => {
          if (v === null || v === undefined) return "";
          if (typeof v === "object") {
            const o = v as { text?: string; result?: unknown; richText?: { text: string }[] };
            if (o.richText) return o.richText.map((r) => r.text).join("");
            if (o.text) return o.text;
            if (o.result !== undefined) return String(o.result);
            if (v instanceof Date) return v.toISOString().slice(0, 10);
            return "";
          }
          return String(v).replace(/\s+/g, " ").trim();
        });
        if (valeurs.some(Boolean)) lignes.push(valeurs.join(" | "));
      });
      if (lignes.length) feuilles.push(`## Feuille « ${ws.name} »\n${lignes.join("\n")}`);
    });
    return { type: "text", text: `Contenu du classeur Excel « ${file.originalname} » (colonnes séparées par |) :\n\n${feuilles.join("\n\n").slice(0, MAX_TEXTE)}` };
  }
  if (ext === "csv" || ext === "txt") {
    return { type: "text", text: `Contenu du fichier « ${file.originalname} » :\n\n${file.buffer.toString("utf8").slice(0, MAX_TEXTE)}` };
  }
  if (ext === "doc" || ext === "xls") {
    throw badRequest(`Le format .${ext} (ancien Office) n'est pas lu. Enregistrez le fichier en .${ext}x ou en PDF.`);
  }
  throw badRequest("Formats acceptés : PDF, Word (.docx), Excel (.xlsx), CSV ou texte.");
}

/** La base CFC, résumée pour le prompt : une ligne par article, avec ses étapes. */
async function baseResumee() {
  const [articles, etapes] = await Promise.all([
    prisma.article.findMany({
      where: { actif: true },
      select: { id: true, cfcCode: true, nom: true, etapes: { select: { etapeNumero: true } } },
      orderBy: { cfcCode: "asc" },
    }),
    prisma.etapeVisite.findMany({ select: { numero: true, nom: true, zone: true }, orderBy: { numero: "asc" } }),
  ]);
  const texte = [
    "ÉTAPES DE VISITE (numéro : nom, zone)",
    ...etapes.map((e) => `${e.numero} : ${e.nom} (${e.zone})`),
    "",
    "ARTICLES (id | CFC | nom | étapes où il se relève)",
    ...articles.map((a) => `${a.id} | ${a.cfcCode} | ${a.nom} | ${a.etapes.map((x) => x.etapeNumero).join(",")}`),
  ].join("\n");
  const etapesParArticle = new Map(articles.map((a) => [a.id, a.etapes.map((x) => x.etapeNumero)]));
  return { texte, etapesParArticle };
}

async function demanderAClaude(contenu: Bloc, consigne: string, maxTokens: number) {
  let r: Awaited<ReturnType<typeof fetch>>;
  try {
    r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: env.ANTHROPIC_MODEL,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: [contenu, { type: "text", text: consigne }] }],
      }),
    });
  } catch {
    throw badRequest("Lecture momentanément indisponible (réseau).");
  }
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    logger.warn({ status: r.status, body: txt.slice(0, 300) }, "anthropic demarrage error");
    throw badRequest("Lecture momentanément indisponible.");
  }
  const data = (await r.json()) as { content?: { type: string; text?: string }[]; stop_reason?: string };
  const text = (data.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
  const debut = text.indexOf("{");
  const fin = text.lastIndexOf("}");
  if (debut < 0 || fin <= debut) return { json: null, tronque: data.stop_reason === "max_tokens" };
  try {
    return { json: JSON.parse(text.slice(debut, fin + 1)) as unknown, tronque: data.stop_reason === "max_tokens" };
  } catch {
    return { json: null, tronque: data.stop_reason === "max_tokens" };
  }
}

// ---------------------------------------------------------------- schémas

const num = z.number().finite().nullable().optional();
const int = z.number().int().nullable().optional();
const str = z.string().max(500).nullable().optional();

const batimentSchema = z.object({
  nom: str, adresse: str, npa: str, localite: str, canton: str, egid: str,
  anneeConstruction: int, anneeRenovation: int,
  type: z.enum(["LOGEMENT", "VILLA", "CHALET", "SCOLAIRE", "BUREAU", "ADMINISTRATIF", "INDUSTRIEL", "HOTEL", "COMMERCIAL", "AUTRE"]).nullable().optional().catch(null),
  nbLogements: int, nbEtages: int, nbCages: int,
  surfacePlancher: num, surfaceBatie: num, surfaceTerrain: num, perimetre: num,
}).partial().catch({});

const etat = z.enum(["TRES_BON", "BON", "MOYEN", "MAUVAIS"]).nullable().optional().catch(null);

const BATIMENT_JSON = `"batiment": {
  "nom": "nom usuel de l'immeuble ou null",
  "adresse": "rue et numéro", "npa": "1003", "localite": "Lausanne", "canton": "VD (abréviation à 2 lettres)",
  "egid": "identifiant fédéral du bâtiment ou null",
  "anneeConstruction": 1965, "anneeRenovation": null,
  "type": "LOGEMENT|VILLA|CHALET|SCOLAIRE|BUREAU|ADMINISTRATIF|INDUSTRIEL|HOTEL|COMMERCIAL|AUTRE",
  "nbLogements": 12, "nbEtages": 5, "nbCages": 1,
  "surfacePlancher": 1450, "surfaceBatie": 320, "surfaceTerrain": null, "perimetre": null
}`;

/** Garde un rapprochement seulement si l'article existe et se relève à l'étape donnée. */
function rapprocher(articleId: unknown, etapeNumero: unknown, etapesParArticle: Map<string, number[]>) {
  if (typeof articleId !== "string") return { articleId: null, etapeNumero: null };
  const etapes = etapesParArticle.get(articleId.trim().toUpperCase());
  if (!etapes || etapes.length === 0) return { articleId: null, etapeNumero: null };
  const n = typeof etapeNumero === "number" ? etapeNumero : Number(etapeNumero);
  return { articleId: articleId.trim().toUpperCase(), etapeNumero: etapes.includes(n) ? n : etapes[0] };
}

// ---------------------------------------------------------------- document

router.post("/document", recevoir, async (req, res) => {
  if (!env.ANTHROPIC_API_KEY) { res.json({ configured: false }); return; }
  const file = req.file;
  if (!file) throw badRequest("Aucun fichier reçu.");
  const contenu = await contenuDuFichier(file);
  const base = await baseResumee();

  const consigne = `Tu es diagnostiqueur de bâtiments en Suisse romande. Le document ci-dessus décrit un bâtiment : ancien rapport de diagnostic, relevé d'état, état des lieux, tableau Excel de suivi, ou autre.

Extrais :
1. les informations du bâtiment ;
2. chaque élément de construction dont le document parle (façade, fenêtres, toiture, chauffage, sanitaires, ascenseur, etc.), avec son état s'il est indiqué.

Rapproche chaque élément d'UN article de la base CFC ci-dessous (par son id) et de l'étape de visite où il se relève (parmi celles de l'article). Si aucun article ne correspond vraiment, mets "articleId": null. N'invente rien : un champ absent du document vaut null.

États : TRES_BON (neuf ou comme neuf), BON (usure normale), MOYEN (entretien ou réparation à prévoir), MAUVAIS (à remplacer, dégâts). Traduis l'échelle du document (notes, couleurs, « à refaire », priorités I/II/III) vers ces quatre états ; null si le document ne dit rien de l'état.

${base.texte}

Réponds UNIQUEMENT par un objet JSON valide, sans texte autour :
{
 "estUnBatiment": true,
 ${BATIMENT_JSON},
 "elements": [
  { "source": "libellé tel qu'il apparaît dans le document (court)", "articleId": "A005", "etapeNumero": 1, "etat": "MOYEN", "remarque": "observation utile reprise du document, en une phrase, ou null", "annee": null }
 ],
 "resume": "deux phrases sur ce que contient le document",
 "confiance": "high|medium|low"
}
"estUnBatiment" = false si le document ne décrit aucun bâtiment. N'utilise jamais le tiret cadratin.`;

  const { json, tronque } = await demanderAClaude(contenu, consigne, 12_000);
  const schema = z.object({
    estUnBatiment: z.boolean().optional(),
    batiment: batimentSchema.optional(),
    elements: z.array(z.object({
      source: z.string().max(300).catch(""), articleId: z.unknown(), etapeNumero: z.unknown(),
      etat, remarque: str.catch(null), annee: int.catch(null),
    }).passthrough()).max(300).catch([]),
    resume: str.catch(null),
    confiance: z.enum(["high", "medium", "low"]).nullable().optional().catch(null),
  }).passthrough();
  const lu = json ? schema.safeParse(json) : null;
  if (!lu || !lu.success) { res.json({ configured: true, lecture: null, tronque }); return; }

  const elements = lu.data.elements.map((e) => ({
    source: e.source,
    ...rapprocher(e.articleId, e.etapeNumero, base.etapesParArticle),
    etat: e.etat ?? null,
    remarque: e.remarque ?? null,
    annee: e.annee ?? null,
  }));
  res.json({
    configured: true,
    tronque,
    lecture: {
      estUnBatiment: lu.data.estUnBatiment !== false,
      batiment: lu.data.batiment ?? {},
      elements,
      resume: lu.data.resume ?? null,
      confiance: lu.data.confiance ?? null,
    },
  });
});

// ---------------------------------------------------------------- CECB

router.post("/cecb", recevoir, async (req, res) => {
  if (!env.ANTHROPIC_API_KEY) { res.json({ configured: false }); return; }
  const file = req.file;
  if (!file) throw badRequest("Aucun fichier reçu.");
  if (file.mimetype !== "application/pdf" && extension(file.originalname) !== "pdf") throw badRequest("Le certificat doit être un PDF.");
  const contenu = await contenuDuFichier(file);
  const base = await baseResumee();

  const consigne = `Tu es expert des certificats énergétiques cantonaux des bâtiments (CECB) en Suisse. Le PDF ci-dessus est un certificat. Extrais uniquement ce qui y figure ; un champ absent vaut null, n'invente jamais.

Pour chaque mesure d'amélioration recommandée, indique l'article de la base CFC ci-dessous qui correspond à l'élément EXISTANT concerné, celui que le diagnostiqueur ira vérifier sur place, et non à la solution proposée : pour « isoler la façade », la façade actuelle (non isolée) ; pour « remplacer la chaudière à mazout par une pompe à chaleur », la chaudière à mazout. Donne aussi l'étape de visite où cet article se relève. "articleId": null si l'élément existant n'a pas d'article (par exemple une installation qui n'existe pas encore). Recopie les libellés avec leurs accents.

${base.texte}

Réponds UNIQUEMENT par un objet JSON valide, sans texte autour :
{
 "estUnCertificat": true,
 ${BATIMENT_JSON},
 "energie": {
  "sre": 250.5, "consumptionHeat": 120.0, "consumptionElec": 30.0,
  "energyAgent": "Mazout|Gaz|Pompe à chaleur|Bois|Électricité|Chauffage à distance|...",
  "classEnvelope": "A|B|C|D|E|F|G", "classGlobal": "A|B|C|D|E|F|G",
  "refYear": 2019, "dateCertificat": "2021-05-17"
 },
 "mesures": [ { "label": "mesure recommandée, courte", "priorite": "haute|moyenne|basse", "articleId": "A010", "etapeNumero": 1 } ],
 "confiance": "high|medium|low"
}
"sre" en m². Consommations en kWh/m² par an. "estUnCertificat" = false si le PDF n'est pas un certificat énergétique. N'utilise jamais le tiret cadratin.`;

  const { json, tronque } = await demanderAClaude(contenu, consigne, 4000);
  const schema = z.object({
    estUnCertificat: z.boolean().optional(),
    batiment: batimentSchema.optional(),
    energie: z.object({
      sre: num, consumptionHeat: num, consumptionElec: num, energyAgent: str,
      classEnvelope: str, classGlobal: str, refYear: int, dateCertificat: str,
    }).partial().catch({}).optional(),
    mesures: z.array(z.object({
      label: z.string().max(300).catch(""), priorite: z.string().max(20).nullable().optional().catch(null),
      articleId: z.unknown(), etapeNumero: z.unknown(),
    }).passthrough()).max(60).catch([]),
    confiance: z.enum(["high", "medium", "low"]).nullable().optional().catch(null),
  }).passthrough();
  const lu = json ? schema.safeParse(json) : null;
  if (!lu || !lu.success) { res.json({ configured: true, lecture: null, tronque }); return; }

  res.json({
    configured: true,
    tronque,
    lecture: {
      estUnCertificat: lu.data.estUnCertificat !== false,
      batiment: lu.data.batiment ?? {},
      energie: lu.data.energie ?? {},
      mesures: lu.data.mesures.filter((m) => m.label).map((m) => ({
        label: m.label, priorite: m.priorite ?? null, ...rapprocher(m.articleId, m.etapeNumero, base.etapesParArticle),
      })),
      confiance: lu.data.confiance ?? null,
    },
  });
});

export default router;
