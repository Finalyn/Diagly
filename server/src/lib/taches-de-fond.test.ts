import { describe, it, expect, vi } from "vitest";

vi.mock("./logger.js", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
const { TachesDeFond } = await import("./taches-de-fond.js");
const { badRequest } = await import("./http-error.js");

const MESSAGES = { introuvable: "Introuvable.", dejaEnCours: "Déjà en cours.", echec: "Échec.", journal: "essai" };
const attendre = () => new Promise((r) => setTimeout(r, 0));

/** Une tâche qu'on termine à la main. */
function aLaMain<T>() {
  let finir!: (v: T) => void, echouer!: (e: unknown) => void;
  let signal: AbortSignal | null = null;
  const travail = (s: AbortSignal) => { signal = s; return new Promise<T>((ok, ko) => { finir = ok; echouer = ko; }); };
  return { travail, finir: (v: T) => finir(v), echouer: (e: unknown) => echouer(e), signal: () => signal };
}

describe("les tâches de fond", () => {
  it("rendent un numéro tout de suite, puis le résultat une seule fois", async () => {
    const taches = new TachesDeFond<{ ok: boolean }>(MESSAGES);
    const t = aLaMain<{ ok: boolean }>();
    const id = taches.lancer("alice", t.travail, "plan-1");
    expect(taches.suivre(id, "alice", "plan-1")).toEqual({ etat: "en_cours" });
    t.finir({ ok: true });
    await attendre();
    expect(taches.suivre(id, "alice", "plan-1")).toEqual({ etat: "prete", resultat: { ok: true } });
    expect(() => taches.suivre(id, "alice", "plan-1")).toThrow("Introuvable.");
  });

  it("ne se laissent suivre ni par un autre compte, ni pour un autre plan", () => {
    const taches = new TachesDeFond<number>(MESSAGES);
    const id = taches.lancer("alice", aLaMain<number>().travail, "plan-1");
    expect(() => taches.suivre(id, "bob", "plan-1")).toThrow("Introuvable.");
    expect(() => taches.suivre(id, "alice", "plan-2")).toThrow("Introuvable.");
  });

  it("n’en acceptent qu’une à la fois par compte", () => {
    const taches = new TachesDeFond<number>(MESSAGES);
    taches.lancer("alice", aLaMain<number>().travail);
    expect(() => taches.lancer("alice", aLaMain<number>().travail)).toThrow("Déjà en cours.");
    expect(() => taches.lancer("bob", aLaMain<number>().travail)).not.toThrow();
  });

  it("rendent le message d’une erreur prévue, et un message générique sinon", async () => {
    const taches = new TachesDeFond<number>(MESSAGES);
    const prevue = aLaMain<number>();
    const a = taches.lancer("alice", prevue.travail);
    prevue.echouer(badRequest("Plan trop lourd."));
    await attendre();
    expect(() => taches.suivre(a, "alice")).toThrow("Plan trop lourd.");
    const imprevue = aLaMain<number>();
    const b = taches.lancer("alice", imprevue.travail);
    imprevue.echouer(new Error("socket hang up"));
    await attendre();
    expect(() => taches.suivre(b, "alice")).toThrow("Échec.");
  });

  it("s’arrêtent à la demande de leur propriétaire seulement", () => {
    const taches = new TachesDeFond<number>(MESSAGES);
    const t = aLaMain<number>();
    const id = taches.lancer("alice", t.travail);
    taches.arreter(id, "bob");
    expect(t.signal()?.aborted).toBe(false);
    taches.arreter(id, "alice");
    expect(t.signal()?.aborted).toBe(true);
    expect(() => taches.suivre(id, "alice")).toThrow("Introuvable.");
  });

  it("oublient et arrêtent une tâche non réclamée au bout du délai", () => {
    let maintenant = 0;
    const taches = new TachesDeFond<number>(MESSAGES, { oubliApres: 1000, maintenant: () => maintenant });
    const t = aLaMain<number>();
    const id = taches.lancer("alice", t.travail);
    maintenant = 2000;
    taches.lancer("bob", aLaMain<number>().travail);
    expect(t.signal()?.aborted).toBe(true);
    expect(() => taches.suivre(id, "alice")).toThrow("Introuvable.");
  });
});
