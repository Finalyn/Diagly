import { describe, it, expect } from "vitest";
import { feuillesSchema, nombreAValider, remplacerPropositions } from "./feuilles-plans.js";

const zone = (id: string, page: number | undefined, extra: Record<string, unknown> = {}) => ({
  id, type: "hatch", points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], ...(page ? { page } : {}), ...extra,
});

describe("le remplacement des propositions", () => {
  const actuelles = [
    zone("validee-p1", 1),
    zone("proposee-p1", 1, { proposition: { type: "piece" } }),
    zone("proposee-p2", 2, { proposition: { type: "facade" } }),
    { id: "repere-p1", type: "repere", page: 1, points: [{ x: 1, y: 1 }], repere: { categorie: "fenetre", numero: 1, aValider: true } },
    { id: "repere-valide-p1", type: "repere", page: 1, points: [{ x: 2, y: 2 }], repere: { categorie: "fenetre", numero: 2 } },
    { id: "pages", type: "pages", points: [], pageScales: { 1: 40 } },
  ];

  it("remplace ce qui attendait sur les pages visées, garde le reste", () => {
    const r = remplacerPropositions(actuelles, [1], [zone("nouvelle-p1", 1, { proposition: { type: "piece" } })]) as { id: string }[];
    expect(r.map((a) => a.id)).toEqual(["validee-p1", "proposee-p2", "repere-valide-p1", "pages", "nouvelle-p1"]);
  });

  it("est idempotent : livré deux fois, un résultat ne double rien", () => {
    const nouvelles = [zone("n1", 2, { proposition: { type: "facade" } })];
    const une = remplacerPropositions(actuelles, [2], nouvelles);
    expect(remplacerPropositions(une, [2], nouvelles)).toEqual(une);
  });

  it("traite une annotation sans page comme posée sur la première", () => {
    const r = remplacerPropositions([zone("image", undefined, { proposition: { type: "facade" } })], [1], []);
    expect(r).toEqual([]);
  });

  it("compte ce qui attend d'être validé", () => {
    expect(nombreAValider(actuelles)).toBe(3);
    expect(nombreAValider(null)).toBe(0);
  });
});

describe("la forme admise des feuilles", () => {
  it("accepte une description complète", () => {
    const f = feuillesSchema.parse({
      nombre: 3,
      pages: {
        1: { numero: "A-101", titre: "Plan du rez", type: "plan_etage", niveau: "Rez", etagesIdentiques: 1, analyse: { statut: "prete", depuis: "2026-10-17T10:00:00Z" } },
        2: { titre: "Étage type", niveau: "1er au 3e", etagesIdentiques: 3, corrige: ["etagesIdentiques"], analyse: { statut: "en_file" } },
      },
      lots: [{ pages: [1, 2], le: "2026-10-17T10:00:00Z", comptages: [{ categorie: "fenetre", nombre: 12 }], remarques: null }],
    });
    expect(f.pages["2"].etagesIdentiques).toBe(3);
    expect(f.pages["1"].analyse?.statut).toBe("prete");
  });

  it("refuse un statut inconnu, un multiplicateur absurde ou une clé qui n'est pas une page", () => {
    expect(feuillesSchema.safeParse({ pages: { 1: { analyse: { statut: "finie" } } } }).success).toBe(false);
    expect(feuillesSchema.safeParse({ pages: { 1: { etagesIdentiques: 0 } } }).success).toBe(false);
    expect(feuillesSchema.safeParse({ pages: { 1: { etagesIdentiques: 2.5 } } }).success).toBe(false);
    expect(feuillesSchema.safeParse({ pages: { abc: {} } }).success).toBe(false);
    expect(feuillesSchema.safeParse({ pages: { 0: {} } }).success).toBe(false);
  });

  it("retire les champs inconnus plutôt que de les ranger", () => {
    const f = feuillesSchema.parse({ pages: { 1: { titre: "Coupe A", script: "<b>" } } });
    expect(f.pages["1"]).toEqual({ titre: "Coupe A" });
  });

  it("borne la taille des objets libres", () => {
    const enorme = { resume: "x".repeat(7000) };
    expect(feuillesSchema.safeParse({ pages: { 1: { echelle: enorme } } }).success).toBe(false);
  });
});
