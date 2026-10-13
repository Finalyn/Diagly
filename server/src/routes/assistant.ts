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
import { sansTiretCadratin } from "../lib/sans-tiret.js";
import { normaliserAnalysePhoto } from "../lib/analyse-photo.js";
import {
  CONSIGNE_QUESTIONS,
  OUTIL_POSER_QUESTION,
  extraireQuestion,
  questionHistorique,
  texteAssistantPourApi,
  texteUtilisateurPourApi,
  type BlocReponse,
} from "../lib/question-assistant.js";

const router = Router();
router.use(requireAuth);
router.use(aiLimiter); // quota par utilisateur : protege la facture Anthropic

const chatSchema = z.object({
  messages: z
    .array(
      z
        .object({
          role: z.enum(["user", "assistant"]),
          // Vide seulement pour un tour de l'assistant reduit a sa question a
          // choix: le modele peut appeler l'outil sans rien ecrire avant.
          content: z.string().max(8000),
          // Photos jointes au message, en data URL base64. Bornees: chaque image
          // coute cher en jetons, et la facture est au prorata.
          images: z.array(z.string().max(8_000_000)).max(4).optional(),
          // La question a choix posee a ce tour, renvoyee par le client avec
          // l'historique. Mal formee, elle est ignoree plutot que de faire
          // echouer toute la conversation.
          question: questionHistorique.optional().catch(undefined),
        })
        // Un tour de l'assistant peut arriver vide, sa question ecartee a la
        // relecture: texteAssistantPourApi le remplit, et la conversation
        // continue plutot que d'echouer en entier. Un message vide de
        // l'utilisateur, lui, n'a pas de sens.
        .refine((m) => m.role === "assistant" || m.content.trim().length > 0, {
          message: "Message vide.",
        }),
    )
    .min(1)
    .max(30),
  projectId: z.string().optional(),
  // Diagnostics rattaches a la conversation. Le premier porte le contexte
  // detaille, les suivants un resume: trois dossiers complets depasseraient
  // la fenetre du modele.
  projectIds: z.array(z.string()).max(5).optional(),
  // Le client sait afficher les questions a choix. Sans ce drapeau, l'outil
  // n'est pas propose au modele: l'app iPhone embarque son front, et une
  // version ancienne, qui ignore le champ « question » de la reponse, perdrait
  // la question et ne garderait que la phrase qui l'introduit.
  questionsAChoix: z.boolean().optional(),
});

/** Transforme une data URL en bloc image pour l'API Anthropic. */
function blocImage(dataUrl: string) {
  const m = dataUrl.match(/^data:(image[/][a-zA-Z0-9.+-]+);base64,(.+)$/s);
  return m ? { type: "image" as const, source: { type: "base64" as const, media_type: m[1], data: m[2] } } : null;
}

/**
 * Le prompt systeme. La consigne sur les demandes vagues change quand le client
 * sait afficher les questions a choix: « pose une question breve » poussait le
 * modele a ecrire sa question en texte, en plus de la carte.
 */
const systeme = (questionsAChoix: boolean) => `Tu es l'assistant de Diagly, logiciel suisse de diagnostic de batiment et de planification de renovation (directions de travaux, regies, architectes).
Reponds COURT, clair et direct: droit au but, 1 a 3 phrases en general. Pas d'introduction ni de conclusion superflue, pas de blabla. Une liste seulement si c'est vraiment plus clair. ${
  questionsAChoix
    ? "Si la demande est vague, pose UNE question avec l'outil poser_question plutot que de deviner."
    : "Si la question est vague, pose une question breve plutot que de deviner."
}
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

  const { messages, projectId, projectIds, questionsAChoix } = req.body as z.infer<typeof chatSchema>;

  const scope = await ownerScopeFor(req.auth!.sub);
  let system = questionsAChoix ? `${systeme(true)}\n\n${CONSIGNE_QUESTIONS}` : systeme(false);

  // Les dossiers rattaches a la conversation: le premier en detail, les
  // autres en resume. Trois contextes complets depasseraient la fenetre.
  const rattaches = [...new Set([...(projectIds ?? []), ...(projectId ? [projectId] : [])])];
  const [principal, ...autres] = rattaches;
  if (principal) {
    const detail = await buildProjectContext(principal, scope);
    if (detail) system += `\n\n${detail}`;
  }
  for (const id of autres.slice(0, 4)) {
    const brief = await buildProjectBrief(id, scope);
    if (brief) system += `\n\n${brief}`;
  }
  const portfolio = await buildPortfolioBrief(scope, principal);
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
        // Un peu de marge pour l'appel d'outil: une question tronquee par la
        // limite serait rejetee a la validation, et la carte perdue.
        max_tokens: 1200,
        system,
        // Une photo jointe devient un bloc image place avant le texte: le
        // modele lit mieux l'image quand la question la suit. Les questions a
        // choix des tours precedents repartent en texte (voir
        // question-assistant.ts, « le tour suivant »).
        messages: messages.map((m, i) => {
          const precedent = i > 0 ? messages[i - 1] : undefined;
          const texte =
            m.role === "assistant"
              ? texteAssistantPourApi(m.content, m.question)
              : texteUtilisateurPourApi(m.content, precedent?.role === "assistant" ? precedent.question : undefined);
          const blocs = (m.images ?? []).map(blocImage).filter((b): b is NonNullable<typeof b> => b !== null);
          return blocs.length > 0
            ? { role: m.role, content: [...blocs, { type: "text" as const, text: texte }] }
            : { role: m.role, content: texte };
        }),
        // Le modele reste libre (auto): la plupart des tours n'appellent pas
        // de question, et il ne doit en poser que si elle sert. Les appels
        // paralleles sont coupes: une question a la fois.
        ...(questionsAChoix
          ? { tools: [OUTIL_POSER_QUESTION], tool_choice: { type: "auto", disable_parallel_tool_use: true } }
          : {}),
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

  const data = (await r.json()) as { content?: BlocReponse[] };
  const contenu = data.content ?? [];
  const texte = contenu
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("\n")
    .trim();

  // Quand le modele appelle poser_question, sa reponse s'arrete la (stop_reason
  // « tool_use »). Personne n'execute l'outil: la question part au client, qui
  // l'affiche en carte, et c'est la reponse de l'utilisateur, au tour suivant,
  // qui en tient lieu. Le champ « question » s'ajoute a la reponse habituelle:
  // un client qui ne le connait pas ne le lit pas.
  const question = questionsAChoix ? extraireQuestion(contenu) : null;
  if (question) {
    // Le texte rédigé par le modèle part sans tiret cadratin (sans-tiret.ts).
    const propre = {
      ...question,
      question: sansTiretCadratin(question.question),
      options: question.options.map((o) => ({ ...o, libelle: sansTiretCadratin(o.libelle), description: sansTiretCadratin(o.description) })),
    };
    res.json({ reply: sansTiretCadratin(texte), question: propre, configured: true });
    return;
  }

  // Un appel dont l'entree n'a pas passe la validation est ignore, le texte
  // garde. S'il n'y avait que lui, la precision se demande en clair plutot
  // que par une bulle vide.
  const appelRate = questionsAChoix ? contenu.find((c) => c.type === "tool_use") : undefined;
  if (appelRate) logger.warn({ input: JSON.stringify(appelRate.input ?? null).slice(0, 500) }, "question assistant invalide");
  const reply = sansTiretCadratin(texte) || (appelRate ? "Pouvez-vous préciser votre demande ?" : "(réponse vide)");
  res.json({ reply, configured: true });
});

// ---------- Guide terrain : analyse d'une photo (vision) ----------

// 3 Mo par photo : le client redimensionne a 1280 px (~300 Ko), la marge est large.
// Sans borne, 8 photos pouvaient partir a l'API Anthropic a chaque appel, 40 fois par
// tranche de 10 minutes et par compte : la facture, pas seulement le serveur, est en jeu.
const MAX_IMAGE_CHARS = 3 * 1024 * 1024;
const visionSchema = z.object({
  images: z.array(z.string().min(1).max(MAX_IMAGE_CHARS)).min(1).max(8), // data URLs (image/jpeg;base64,...)
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

  // Sans cette regle, le modele evaluait tout ce qu'on lui montrait : une capture
  // d'ecran de logiciel recevait « BON, priorite III » et une note de facade. Mieux
  // vaut ne rien proposer et dire quoi supprimer qu'inventer un etat.
  const reglePhoto = `Regle photo inutilisable: mets "photoInutilisable" a true si une photo ne permet pas d'evaluer l'element: capture d'ecran, photo d'un ecran ou d'un document, sujet sans rapport avec le batiment, image floue, sombre ou lointaine au point d'etre inexploitable${cfcCode ? ", ou element different du CFC selectionne (matchesSelected false)" : ""}. Dans ce cas ne propose AUCUN etat: "state", "priority", "stateReason" et "note" a null, "raisonInutilisable" dit ce qui cloche en une phrase courte, "photosAEcarter" liste les numeros des photos en cause (1 = premiere photo envoyee). Si une seule photo pose probleme parmi plusieurs, n'evalue pas non plus: l'utilisateur la supprimera puis relancera l'analyse. Une usure, une salissure ou un defaut visibles ne rendent PAS une photo inutilisable: c'est justement ce qu'il faut evaluer. Sinon "photoInutilisable" a false, "raisonInutilisable" vide et "photosAEcarter" vide.`;

  const prompt = `Tu es un expert du diagnostic de batiment en Suisse. Analyse ${imageBlocks.length > 1 ? `ces ${imageBlocks.length} photos (differents angles/details d'un meme element), en une seule evaluation d'ensemble` : "cette photo"} prise(s) sur place. ${guidance}
${brief ? brief + "\n" : ""}
Repond UNIQUEMENT avec un objet JSON valide (aucun texte autour), avec exactement ces champs:
{
 "element": "ce que montre la photo, en une courte phrase",
 "cfc": { "code": "ex 221.1", "label": "libelle court", "confidence": "high|medium|low" },
 "matchesSelected": true,
 "photoInutilisable": false,
 "raisonInutilisable": "si photoInutilisable, ce qui cloche en une phrase courte, sinon vide",
 "photosAEcarter": [],
 "state": "TRES_BON|BON|MOYEN|MAUVAIS, ou null si photoInutilisable",
 "stateReason": "justification courte de l'etat",
 "priority": "I|II|III",
 "note": "note d'observation professionnelle, 1 a 2 phrases, en francais, sans tiret cadratin",
 "needMorePhoto": false,
 "morePhotoReason": "ce qu'il faudrait photographier en plus (ou a reprendre si photoInutilisable), sinon vide",
 "confidence": "high|medium|low"
}
Regle etat: TRES_BON=neuf/recent, BON=usure normale, MOYEN=degradation visible a surveiller, MAUVAIS=defaut necessitant intervention. Priorite: I=securite/urgent, II=moyen terme, III=confort.
${reglePhoto}`;

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
  const brute = extractJson(text);
  if (!brute) {
    res.json({ configured: true, analysis: null, raw: text.slice(0, 500) });
    return;
  }
  // Une photo inutilisable ne repart jamais avec un etat, meme si le modele en a
  // propose un malgre la consigne (voir analyse-photo.ts).
  const analysis = normaliserAnalysePhoto(brute, imageBlocks.length, !!cfcCode);

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
      .trim();
  res.json({ configured: true, reply: sansTiretCadratin(reply) || "(réponse vide)" });
});

// ---------- Import d'un certificat énergétique (PDF) : lecture, pas émission ----------

const pdfUpload = multer({
  storage: multer.memoryStorage(),
  // 12 Mo : un certificat energetique fait quelques centaines de Ko. Au-dela, c'est le
  // serveur qui garde le fichier en memoire puis le convertit en base64 pour l'API.
  limits: { fileSize: 12 * 1024 * 1024 },
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
