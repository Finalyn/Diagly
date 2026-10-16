import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { CATEGORIES_COMPTEES, DEFINITIONS_POUR_LIA, comptagesSchema } from "./comptages.js";

const C = (extra: Record<string, unknown> = {}) => ({
  nombre: 6, source: "plans", detail: "2 par palier × 3 étages", pages: ["F1 p. 2"], confiance: "haute", valide: false,
  majLe: "2026-10-16T08:00:00.000Z", ...extra,
});

describe("les comptages enregistrés au dossier", () => {
  it("acceptent un comptage par catégorie connue, rangé sous sa clé", () => {
    const r = comptagesSchema.parse({ porte_paliere: C({ categorie: "balcon" }), fenetre: C({ nombre: 24, surface: 41.5 }) });
    expect(r.porte_paliere).toEqual({
      categorie: "porte_paliere", nombre: 6, surface: null, source: "plans", detail: "2 par palier × 3 étages",
      pages: ["F1 p. 2"], confiance: "haute", valide: false, majLe: "2026-10-16T08:00:00.000Z",
    });
    expect(r.fenetre?.surface).toBe(41.5);
  });

  it("refusent une catégorie inconnue plutôt que de la perdre en silence", () => {
    expect(comptagesSchema.safeParse({ ascenseur: C() }).success).toBe(false);
  });

  it("refusent un nombre négatif, décimal ou hors des bornes", () => {
    for (const nombre of [-1, 2.5, 5001, "6"]) {
      expect(comptagesSchema.safeParse({ balcon: C({ nombre }) }).success).toBe(false);
    }
    expect(comptagesSchema.safeParse({ balcon: C({ nombre: 0 }) }).success).toBe(true);
  });

  it("refusent une source ou une confiance inconnues", () => {
    expect(comptagesSchema.safeParse({ balcon: C({ source: "devine" }) }).success).toBe(false);
    expect(comptagesSchema.safeParse({ balcon: C({ confiance: "certaine" }) }).success).toBe(false);
  });

  it("coupent les textes trop longs et retirent le tiret cadratin", () => {
    const r = comptagesSchema.parse({
      cuisine: C({ detail: `Une par logement — ${"x".repeat(400)}`, pages: [" F1 p. 1 ", "", "y".repeat(80)] }),
    });
    expect(r.cuisine!.detail!.length).toBeLessThanOrEqual(300);
    expect(r.cuisine!.detail).not.toContain("—");
    expect(r.cuisine!.pages).toEqual(["F1 p. 1", "y".repeat(40)]);
  });

  it("ne gardent une surface que pour les fenêtres", () => {
    expect(comptagesSchema.parse({ balcon: C({ surface: 12 }) }).balcon!.surface).toBeNull();
  });

  it("datent un comptage qui arrive sans date, et le tiennent pour non relu", () => {
    const r = comptagesSchema.parse({ balcon: { nombre: 4, source: "saisie" } });
    expect(r.balcon!.valide).toBe(false);
    expect(Number.isNaN(Date.parse(r.balcon!.majLe))).toBe(false);
  });
});

describe("la liste des catégories", () => {
  it("décrit chaque catégorie à l'IA", () => {
    for (const c of CATEGORIES_COMPTEES) expect(DEFINITIONS_POUR_LIA[c].startsWith(`${c} :`)).toBe(true);
  });

  it("porte les mêmes clés que celle du navigateur", () => {
    // Le navigateur et le serveur ont chacun leur liste : la configuration
    // TypeScript de l'un ne lit pas les sources de l'autre. On compare donc
    // le texte des deux fichiers.
    let d = process.cwd();
    for (let i = 0; i < 6 && !(existsSync(join(d, "src")) && existsSync(join(d, "server"))); i++) d = dirname(d);
    const front = readFileSync(join(d, "src", "lib", "base-cfc", "comptages.ts"), "utf8");
    const cles = [...front.matchAll(/^\s+cle: '([a-z_]+)'/gm)].map((m) => m[1]);
    expect(cles).toEqual([...CATEGORIES_COMPTEES]);
  });
});
