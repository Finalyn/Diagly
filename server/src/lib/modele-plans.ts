/**
 * Une demande au modèle qui lit les plans, réponse reçue en flux.
 *
 * Lire des cotes, retrouver une hauteur d'étage sur une coupe, dessiner le
 * contour d'une façade demande plus qu'une extraction de texte, et une erreur
 * se propagerait à tous les métrés du dossier : ces demandes vont au modèle
 * le plus fort (ANTHROPIC_MODEL_PLANS), qui réfléchit avant de répondre.
 * Pas de température ni de budget de réflexion : ce modèle les refuse,
 * l'effort en tient lieu.
 *
 * La réponse arrive en flux : demandée d'un bloc, elle n'enverrait ses
 * en-têtes qu'une fois entièrement rédigée, et fetch abandonne au bout de
 * cinq minutes sans en-têtes (voir flux-messages.ts).
 *
 * Pas de modèle de repli en cas de refus : l'analyse d'un plan rend des
 * coordonnées en pixels de l'image envoyée, et un autre modèle qui lirait
 * l'image à une autre résolution rendrait des points faux sans que rien ne
 * le signale. Un refus est remonté tel quel.
 *
 * Partagé par la lecture des plans au démarrage d'un dossier
 * (routes/demarrage.ts) et par l'analyse d'un plan (routes/plans.ts).
 */
import { env } from "./env.js";
import { logger } from "./logger.js";
import { badRequest } from "./http-error.js";
import { AssembleurDeFlux, objetJson } from "./flux-messages.js";

/** Ce que l'utilisateur lit quand la demande échoue, selon ce qu'elle faisait. */
export interface MessagesDuModele {
  /** Le serveur n'a pas pu joindre l'API. */
  reseau: string;
  /** L'API a refusé ou a échoué. */
  indisponible: string;
  /** La requête dépasse la taille admise. */
  tropLourd: string;
  /** Le flux s'est coupé en route. */
  interrompue: string;
  /** Libellé du journal. */
  journal: string;
}

export interface ReponseDuModele {
  texte: string;
  /** Le premier objet JSON de la réponse, ou null. */
  json: unknown;
  /** La réponse a atteint max_tokens : elle est peut-être incomplète. */
  tronque: boolean;
  /** Le modèle a décliné la demande. */
  refus: boolean;
}

export async function demanderAuModeleDesPlans(
  contenu: unknown[],
  options: { maxTokens: number; signal: AbortSignal; messages: MessagesDuModele },
): Promise<ReponseDuModele> {
  const { maxTokens, signal, messages } = options;
  const debut = Date.now();
  let r: Awaited<ReturnType<typeof fetch>>;
  try {
    r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: env.ANTHROPIC_MODEL_PLANS,
        max_tokens: maxTokens,
        thinking: { type: "adaptive" },
        output_config: { effort: "high" },
        stream: true,
        messages: [{ role: "user", content: contenu }],
      }),
      signal,
    });
  } catch {
    throw badRequest(messages.reseau);
  }
  if (!r.ok || !r.body) {
    const txt = await r.text().catch(() => "");
    logger.warn({ status: r.status, body: txt.slice(0, 300) }, `anthropic ${messages.journal} error`);
    if (r.status === 413) throw badRequest(messages.tropLourd);
    throw badRequest(messages.indisponible);
  }

  const flux = new AssembleurDeFlux();
  const decodeur = new TextDecoder();
  try {
    for await (const morceau of r.body) flux.pousser(decodeur.decode(morceau as Uint8Array, { stream: true }));
    flux.pousser(decodeur.decode());
  } catch {
    throw badRequest(messages.interrompue);
  }
  const { texte, arret, erreur, jetons } = flux.terminer();
  // Les jetons disent ce que l'analyse a coûté : une ligne par appel dans le
  // journal du serveur, à multiplier par le tarif du modèle.
  logger.info({
    arret, erreur, secondes: Math.round((Date.now() - debut) / 1000),
    modele: env.ANTHROPIC_MODEL_PLANS, jetonsEntree: jetons.entree, jetonsSortie: jetons.sortie,
  }, messages.journal);
  if (erreur) throw badRequest(messages.indisponible);
  return { texte, json: objetJson(texte), tronque: arret === "max_tokens", refus: arret === "refusal" };
}
