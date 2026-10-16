import { describe, it, expect } from "vitest";
import { AssembleurDeFlux, objetJson } from "./flux-messages.js";

const evenement = (type: string, data: unknown) => `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;

// Un flux tel que l'API le rend : réflexion, puis texte en plusieurs morceaux.
const FLUX = [
  evenement("message_start", { type: "message_start", message: { id: "msg_1", content: [] } }),
  evenement("content_block_start", { type: "content_block_start", index: 0, content_block: { type: "thinking", thinking: "" } }),
  evenement("content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking: "Je lis la coupe" } }),
  evenement("content_block_stop", { type: "content_block_stop", index: 0 }),
  evenement("ping", { type: "ping" }),
  evenement("content_block_start", { type: "content_block_start", index: 1, content_block: { type: "text", text: "" } }),
  evenement("content_block_delta", { type: "content_block_delta", index: 1, delta: { type: "text_delta", text: '{"estUnJeuDePlans": ' } }),
  evenement("content_block_delta", { type: "content_block_delta", index: 1, delta: { type: "text_delta", text: "true}" } }),
  evenement("content_block_stop", { type: "content_block_stop", index: 1 }),
  evenement("message_delta", { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 42 } }),
  evenement("message_stop", { type: "message_stop" }),
].join("");

describe("AssembleurDeFlux", () => {
  it("rassemble le texte, sans la réflexion, et garde la raison de l'arrêt", () => {
    const a = new AssembleurDeFlux();
    a.pousser(FLUX);
    expect(a.terminer()).toEqual({ texte: '{"estUnJeuDePlans": true}', arret: "end_turn", erreur: null });
  });

  it("supporte un flux découpé n'importe où, retours chariot compris", () => {
    const a = new AssembleurDeFlux();
    const crlf = FLUX.replace(/\n/g, "\r\n");
    for (let i = 0; i < crlf.length; i += 7) a.pousser(crlf.slice(i, i + 7));
    expect(a.terminer()).toEqual({ texte: '{"estUnJeuDePlans": true}', arret: "end_turn", erreur: null });
  });

  it("signale une erreur survenue en cours de route", () => {
    const a = new AssembleurDeFlux();
    a.pousser(evenement("error", { type: "error", error: { type: "overloaded_error", message: "Overloaded" } }));
    expect(a.terminer().erreur).toBe("overloaded_error");
  });

  it("dit qu'une réponse a été coupée par la limite", () => {
    const a = new AssembleurDeFlux();
    a.pousser(evenement("message_delta", { type: "message_delta", delta: { stop_reason: "max_tokens" } }));
    expect(a.terminer().arret).toBe("max_tokens");
  });
});

describe("objetJson", () => {
  it("trouve l'objet même entouré d'une phrase", () => {
    expect(objetJson('Voici la lecture : {"a": 1} Bonne journée.')).toEqual({ a: 1 });
  });

  it("rend null sans objet lisible", () => {
    expect(objetJson("rien")).toBeNull();
    expect(objetJson("{ pas du json }")).toBeNull();
  });
});
