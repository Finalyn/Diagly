import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middlewares/auth.js";
import { validateBody } from "../middlewares/validate.js";
import { aiLimiter } from "../middlewares/rate-limit.js";
import { env } from "../lib/env.js";
import { logger } from "../lib/logger.js";
import { badRequest } from "../lib/http-error.js";
import { ownerScopeFor } from "../lib/org-context.js";
import { buildProjectContext, buildProjectBrief, buildPortfolioBrief } from "../lib/ai-context.js";

const router = Router();
router.use(requireAuth);
router.use(aiLimiter); // quota par utilisateur : protege la facture Anthropic

const chatSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(8000) }))
    .min(1)
    .max(30),
  projectId: z.string().optional(),
});

const SYSTEM = `Tu es l'assistant de Diagly, logiciel suisse de diagnostic de batiment et de planification de renovation (directions de travaux, regies, architectes).
Reponds COURT, clair et direct: droit au but, 1 a 3 phrases en general. Pas d'introduction ni de conclusion superflue, pas de blabla. Une liste seulement si c'est vraiment plus clair. Si la question est vague, pose une question breve plutot que de deviner.
Domaine: interpretation de diagnostic, codes CFC, estimation de couts, priorisation des travaux (I = urgent/securite, II = moyen terme, III = confort), redaction de rapport. Contexte suisse: CHF au format 1'234'567, TVA 8.1%, normes SIA. Estimations indicatives, a verifier sur place. N'utilise jamais le tiret cadratin.`;

router.post("/chat", validateBody(chatSchema), async (req, res) => {
  if (!env.ANTHROPIC_API_KEY) {
    res.json({
      reply:
        "L'assistant IA n'est pas encore active sur ce serveur. Ajoutez une cle ANTHROPIC_API_KEY dans la configuration du serveur pour l'activer.",
      configured: false,
    });
    return;
  }

  const { messages, projectId } = req.body as z.infer<typeof chatSchema>;

  const scope = await ownerScopeFor(req.auth!.sub);
  let system = SYSTEM;
  // Contexte DETAILLE du diagnostic ouvert (toutes les infos) + apercu du parc (pour repondre sur n'importe lequel).
  if (projectId) {
    const detail = await buildProjectContext(projectId, scope);
    if (detail) system += `\n\n${detail}`;
  }
  const portfolio = await buildPortfolioBrief(scope, projectId);
  if (portfolio) system += `\n\n${portfolio}`;

  let r: Awaited<ReturnType<typeof fetch>>;
  try {
    r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: env.ANTHROPIC_MODEL,
        max_tokens: 700,
        system,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });
  } catch {
    throw badRequest("Assistant momentanement indisponible (reseau).");
  }

  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    logger.warn({ status: r.status, body: txt.slice(0, 300) }, "anthropic chat error");
    throw badRequest("Assistant momentanement indisponible.");
  }

  const data = (await r.json()) as { content?: { type: string; text?: string }[] };
  const reply =
    (data.content ?? [])
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("\n")
      .trim() || "(reponse vide)";

  res.json({ reply, configured: true });
});

// ---------- Guide terrain : analyse d'une photo (vision) ----------

const visionSchema = z.object({
  images: z.array(z.string().min(1)).min(1).max(8), // data URLs (image/jpeg;base64,...)
  cfcCode: z.string().optional(),
  cfcLabel: z.string().optional(),
  projectId: z.string().optional(),
});

/** Extrait le premier objet JSON d'un texte (le modele peut entourer de ```json). */
function extractJson(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

router.post("/vision", validateBody(visionSchema), async (req, res) => {
  if (!env.ANTHROPIC_API_KEY) {
    res.json({ configured: false, analysis: null });
    return;
  }
  const { images, cfcCode, cfcLabel, projectId } = req.body as z.infer<typeof visionSchema>;

  // Chaque photo devient un bloc image ; le modele les analyse ENSEMBLE (plusieurs angles d'un meme element).
  const imageBlocks = images
    .map((img) => {
      const m = img.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s);
      return m ? { type: "image" as const, source: { type: "base64" as const, media_type: m[1], data: m[2] } } : null;
    })
    .filter((b): b is NonNullable<typeof b> => b !== null);
  if (imageBlocks.length === 0) throw badRequest("Aucune image valide (data URL base64 attendue).");

  // Contexte du batiment (age, renovation, energie) : l'IA en tient compte pour juger l'usure.
  const brief = projectId ? await buildProjectBrief(projectId, await ownerScopeFor(req.auth!.sub)) : null;

  const guidance = cfcCode
    ? `L'utilisateur a pre-selectionne l'element CFC ${cfcCode}${cfcLabel ? ` (${cfcLabel})` : ""}. Indique via "matchesSelected" si les photos correspondent bien a cet element.`
    : `Aucun element CFC n'est pre-selectionne: propose le plus probable et mets matchesSelected a null.`;

  const prompt = `Tu es un expert du diagnostic de batiment en Suisse. Analyse ${imageBlocks.length > 1 ? `ces ${imageBlocks.length} photos (differents angles/details d'un meme element), en une seule evaluation d'ensemble` : "cette photo"} prise(s) sur place. ${guidance}
${brief ? brief + "\n" : ""}
Repond UNIQUEMENT avec un objet JSON valide (aucun texte autour), avec exactement ces champs:
{
 "element": "ce que montre la photo, en une courte phrase",
 "cfc": { "code": "ex 221.1", "label": "libelle court", "confidence": "high|medium|low" },
 "matchesSelected": true,
 "state": "TRES_BON|BON|MOYEN|MAUVAIS",
 "stateReason": "justification courte de l'etat",
 "priority": "I|II|III",
 "note": "note d'observation professionnelle, 1 a 2 phrases, en francais, sans tiret cadratin",
 "needMorePhoto": false,
 "morePhotoReason": "ce qu'il faudrait photographier en plus si utile, sinon vide",
 "confidence": "high|medium|low"
}
Regle etat: TRES_BON=neuf/recent, BON=usure normale, MOYEN=degradation visible a surveiller, MAUVAIS=defaut necessitant intervention. Priorite: I=securite/urgent, II=moyen terme, III=confort.`;

  let r: Awaited<ReturnType<typeof fetch>>;
  try {
    r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: env.ANTHROPIC_MODEL,
        max_tokens: 700,
        messages: [
          {
            role: "user",
            content: [...imageBlocks, { type: "text", text: prompt }],
          },
        ],
      }),
    });
  } catch {
    throw badRequest("Guide IA momentanement indisponible (reseau).");
  }

  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    logger.warn({ status: r.status, body: txt.slice(0, 300) }, "anthropic vision error");
    throw badRequest("Guide IA momentanement indisponible.");
  }

  const data = (await r.json()) as { content?: { type: string; text?: string }[] };
  const text = (data.content ?? [])
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("");
  const analysis = extractJson(text);
  if (!analysis) {
    res.json({ configured: true, analysis: null, raw: text.slice(0, 500) });
    return;
  }

  // Verifie le code CFC propose contre le catalogue (libelle officiel + existence).
  const cfc = analysis.cfc as { code?: string; label?: string; confidence?: string } | undefined;
  if (cfc?.code) {
    try {
      const entry = await prisma.cfcCatalogEntry.findFirst({ where: { code: cfc.code } });
      (analysis.cfc as Record<string, unknown>).known = !!entry;
      if (entry?.label) (analysis.cfc as Record<string, unknown>).label = entry.label;
    } catch {
      /* lookup best-effort */
    }
  }

  res.json({ configured: true, analysis });
});

// ---------- Répondre à l'analyse : conversation de suivi sur une analyse photo ----------

const analysisChatSchema = z.object({
  images: z.array(z.string().min(1)).min(1).max(8),
  cfcCode: z.string().optional(),
  cfcLabel: z.string().optional(),
  projectId: z.string().optional(),
  analysis: z.record(z.string(), z.unknown()).nullable().optional(), // analyse IA initiale (JSON)
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(4000) }))
    .min(1)
    .max(20),
});

router.post("/analysis-chat", validateBody(analysisChatSchema), async (req, res) => {
  if (!env.ANTHROPIC_API_KEY) {
    res.json({ configured: false, reply: "Guide IA non active sur ce serveur." });
    return;
  }
  const { images, cfcCode, cfcLabel, projectId, analysis, messages } = req.body as z.infer<typeof analysisChatSchema>;

  const imageBlocks = images
    .map((img) => {
      const m = img.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s);
      return m ? { type: "image" as const, source: { type: "base64" as const, media_type: m[1], data: m[2] } } : null;
    })
    .filter((b): b is NonNullable<typeof b> => b !== null);
  if (imageBlocks.length === 0) throw badRequest("Aucune image valide (data URL base64 attendue).");

  const brief = projectId ? await buildProjectBrief(projectId, await ownerScopeFor(req.auth!.sub)) : null;

  const system =
    `Tu es un expert du diagnostic de batiment en Suisse qui dialogue avec le diagnostiqueur a propos d'un element qu'il vient de photographier. ` +
    `Reponds COURT et concret (1 a 4 phrases), en francais, sans tiret cadratin. Tu peux reviser ton evaluation (etat, priorite, note) si les remarques de l'utilisateur le justifient, en expliquant pourquoi. ` +
    `Etats: TRES_BON=neuf/recent, BON=usure normale, MOYEN=degradation a surveiller, MAUVAIS=defaut necessitant intervention. Priorites: I=securite/urgent, II=moyen terme, III=confort.` +
    (cfcCode ? `\nElement concerne: CFC ${cfcCode}${cfcLabel ? ` (${cfcLabel})` : ""}.` : "") +
    (brief ? `\n${brief}` : "") +
    (analysis ? `\nTon analyse initiale (JSON): ${JSON.stringify(analysis)}` : "");

  // Les photos sont attachees au 1er tour utilisateur ; la conversation suit.
  const first = messages[0];
  const rest = messages.slice(1);
  const apiMessages = [
    { role: "user" as const, content: [...imageBlocks, { type: "text" as const, text: first.content }] },
    ...rest.map((m) => ({ role: m.role, content: m.content })),
  ];

  let r: Awaited<ReturnType<typeof fetch>>;
  try {
    r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model: env.ANTHROPIC_MODEL, max_tokens: 500, system, messages: apiMessages }),
    });
  } catch {
    throw badRequest("Guide IA momentanement indisponible (reseau).");
  }
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    logger.warn({ status: r.status, body: txt.slice(0, 300) }, "anthropic analysis-chat error");
    throw badRequest("Guide IA momentanement indisponible.");
  }
  const data = (await r.json()) as { content?: { type: string; text?: string }[] };
  const reply =
    (data.content ?? [])
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("\n")
      .trim() || "(reponse vide)";
  res.json({ configured: true, reply });
});

// ---------- Import d'un certificat énergétique (PDF) : lecture, pas émission ----------

const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 }, // 30 Mo
  fileFilter: (_req, file, cb) => cb(null, file.mimetype === "application/pdf"),
});

// Validation souple de l'extraction (on ne veut pas rejeter une lecture correcte pour un detail).
const cecbSchema = z
  .object({
    isCertificate: z.boolean().optional(),
    sre: z.number().nullable().optional(),
    consumptionHeat: z.number().nullable().optional(),
    consumptionElec: z.number().nullable().optional(),
    energyAgent: z.string().nullable().optional(),
    classEnvelope: z.string().nullable().optional(),
    classGlobal: z.string().nullable().optional(),
    refYear: z.number().int().nullable().optional(),
    measures: z.array(z.object({ label: z.string(), priority: z.string().optional() })).optional(),
    confidence: z.enum(["high", "medium", "low"]).nullable().optional(),
  })
  .passthrough();

router.post("/cecb-import", pdfUpload.single("file"), async (req, res) => {
  if (!env.ANTHROPIC_API_KEY) {
    res.json({ configured: false, extraction: null });
    return;
  }
  const file = req.file;
  if (!file || file.mimetype !== "application/pdf") throw badRequest("Un fichier PDF est requis (application/pdf, 30 Mo max).");
  const pdfBase64 = file.buffer.toString("base64");

  const prompt = `Tu es un expert des certificats energetiques de batiment en Suisse (type CECB). On te fournit un certificat energetique au format PDF. Extrais uniquement les donnees presentes dans le document.
Repond UNIQUEMENT avec un objet JSON valide (aucun texte autour), avec exactement ces champs (mets null si l'information est absente ou illisible, n'invente jamais):
{
 "isCertificate": true,
 "sre": 250.5,
 "consumptionHeat": 120.0,
 "consumptionElec": 30.0,
 "energyAgent": "Mazout|Gaz|Pompe a chaleur|Bois|Electricite|...",
 "classEnvelope": "A|B|C|D|E|F|G",
 "classGlobal": "A|B|C|D|E|F|G",
 "refYear": 2019,
 "measures": [ { "label": "courte description de la mesure recommandee", "priority": "haute|moyenne|basse" } ],
 "confidence": "high|medium|low"
}
"isCertificate" = false si le PDF n'est pas un certificat energetique. "sre" en m2. Consommations en kWh/m2 par an si disponibles. "measures" = [] si aucune mesure. N'utilise jamais le tiret cadratin.`;

  let r: Awaited<ReturnType<typeof fetch>>;
  try {
    r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: env.ANTHROPIC_MODEL,
        max_tokens: 1400,
        messages: [
          {
            role: "user",
            content: [
              { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } },
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
    });
  } catch {
    throw badRequest("Lecture du certificat momentanement indisponible (reseau).");
  }

  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    logger.warn({ status: r.status, body: txt.slice(0, 300) }, "anthropic cecb import error");
    throw badRequest("Lecture du certificat momentanement indisponible.");
  }

  const data = (await r.json()) as { content?: { type: string; text?: string }[] };
  const text = (data.content ?? [])
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("");
  const raw = extractJson(text);
  const parsed = raw ? cecbSchema.safeParse(raw) : null;
  if (!parsed || !parsed.success) {
    res.json({ configured: true, extraction: null, raw: text.slice(0, 500) });
    return;
  }
  res.json({ configured: true, extraction: parsed.data });
});

export default router;
