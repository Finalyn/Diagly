/**
 * L'agenda du Finalyn Hub, où chaque démo réservée s'inscrit.
 *
 * Le Hub expose un serveur MCP (JSON-RPC sur POST /mcp) qui agit au nom d'une
 * personne, par son jeton personnel (« fh_mcp_ », créé dans le Hub, Mon
 * compte, Assistant IA). Diagly s'en sert comme d'une API : create_event à la
 * réservation, update_event au déplacement, delete_event à l'annulation.
 *
 * Tout est best-effort : un Hub injoignable ne doit jamais faire échouer une
 * réservation. L'hôte reçoit de toute façon l'e-mail, et la démo reste dans
 * Diagly ; la réservation retient seulement qu'elle n'est pas dans le Hub.
 */
import { env } from "./env.js";
import { logger } from "./logger.js";

export const hubConfigure = () => Boolean(env.HUB_MCP_TOKEN);

async function outil(nom: string, args: Record<string, unknown>): Promise<string | null> {
  if (!env.HUB_MCP_TOKEN) return null;
  try {
    const controle = new AbortController();
    const minuteur = setTimeout(() => controle.abort(), 8000);
    const reponse = await fetch(env.HUB_MCP_URL, {
      method: "POST",
      signal: controle.signal,
      headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${env.HUB_MCP_TOKEN}` },
      body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: "tools/call", params: { name: nom, arguments: args } }),
    });
    clearTimeout(minuteur);
    if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
    const corps = await reponse.json() as { result?: { content?: { text?: string }[]; isError?: boolean }; error?: { message?: string } };
    const texte = corps.result?.content?.map((c) => c.text ?? "").join(" ") ?? "";
    if (corps.error || corps.result?.isError) throw new Error(corps.error?.message ?? texte);
    return texte;
  } catch (e) {
    logger.warn({ err: (e as Error).message, outil: nom }, "démos : agenda du Hub injoignable");
    return null;
  }
}

export interface EvenementDeDemo {
  titre: string;
  /** « 2026-10-28 », à Zurich. */
  date: string;
  /** « 10:00 ». */
  debut: string;
  fin: string;
}

/** L'événement créé dans le Hub, ou null s'il n'a pas pu l'être. */
export async function inscrireAuHub(e: EvenementDeDemo): Promise<string | null> {
  const texte = await outil("create_event", {
    title: e.titre, startDate: e.date, startTime: e.debut, endTime: e.fin,
    allDay: false, visibility: "prive", category: "rdv", reminderMinutes: 15,
  });
  return texte?.match(/\(id ([0-9a-f-]{8,})\)/i)?.[1] ?? null;
}

export async function deplacerAuHub(id: string, e: EvenementDeDemo): Promise<boolean> {
  return (await outil("update_event", { id, title: e.titre, startDate: e.date, startTime: e.debut, endTime: e.fin })) != null;
}

export async function retirerDuHub(id: string): Promise<boolean> {
  return (await outil("delete_event", { id })) != null;
}
