import { describe, it, expect } from "vitest";
import { sansTiretCadratin } from "./sans-tiret";

const T = "\u2014";

describe("sansTiretCadratin", () => {
  it("remplace un tiret entre deux membres de phrase par une virgule", () => {
    expect(sansTiretCadratin(`La façade est saine ${T} rien à prévoir.`)).toBe("La façade est saine, rien à prévoir.");
  });

  it("fait d'un tiret en début de ligne une puce", () => {
    expect(sansTiretCadratin(`Travaux :\n${T} toiture\n  ${T} fenêtres`)).toBe("Travaux :\n- toiture\n  - fenêtres");
  });

  it("ne laisse pas de virgule devant une ponctuation", () => {
    expect(sansTiretCadratin(`À surveiller ${T}.`)).toBe("À surveiller.");
  });

  it("laisse intact un texte qui n'en a pas, tirets courts compris", () => {
    const texte = "Priorité II, dans 5-10 ans : rien d'urgent.";
    expect(sansTiretCadratin(texte)).toBe(texte);
  });
});
