import { describe, it, expect } from "vitest";
import {
  consigneAnalyse, dimensionsImage, presentationDePage, seRecoupe, tientDansLeModele, validerAnalyse, MAX_ZONES,
  type PageEnvoyee,
} from "./analyse-plans.js";

const PAGE: PageEnvoyee = { numero: 1, largeurImage: 2296, hauteurImage: 1623, largeurPt: 1190.55, hauteurPt: 841.89 };
const RELEVE = ["crepi", "fenetres"];

const zone = (extra: Record<string, unknown> = {}) => ({
  type: "fenetre", libelle: "Fenêtre rez, 1re", orientation: "Sud", mesure: "surface",
  points: [[100, 100], [160, 100], [160, 170], [100, 170]], releveId: "fenetres", confiance: "haute",
  valeurCotee: 1.68, cotes: "1.20 × 1.40", remarque: null, ...extra,
});

const reponse = (zones: unknown[], page: Record<string, unknown> = {}) => ({
  pages: [{
    page: 1, type: "elevation", titre: "Façade sud", orientation: "Sud", echelle: "1 : 100", echelleOu: "cartouche",
    cote: { texte: "12.40", longueurM: 12.4, p1: [400, 1200], p2: [1090, 1200] }, zones, remarque: null, ...page,
  }],
  remarques: "Pas de coupe.",
});

describe("une analyse valide", () => {
  const a = validerAnalyse(reponse([zone(), zone({ type: "facade", libelle: "Façade sud", releveId: "crepi", points: [[50, 50], [1000, 50], [1000, 900], [50, 900]], valeurCotee: 96.72 })]), [PAGE], RELEVE)!;

  it("garde la page, son échelle ramenée à « 1:100 » et sa cote de contrôle", () => {
    expect(a.pages).toEqual([{
      page: 1, type: "elevation", titre: "Façade sud", orientation: "sud", echelle: "1:100", echelleOu: "cartouche",
      cote: { texte: "12.40", longueurM: 12.4, p1: [400, 1200], p2: [1090, 1200] }, remarque: null,
    }]);
    expect(a.remarques).toBe("Pas de coupe.");
  });

  it("garde les zones avec leur page, leurs points et leur ouvrage", () => {
    expect(a.ecartees).toEqual([]);
    expect(a.zones).toHaveLength(2);
    expect(a.zones[0]).toEqual({
      page: 1, type: "fenetre", libelle: "Fenêtre rez, 1re", orientation: "sud", mesure: "surface",
      points: [[100, 100], [160, 100], [160, 170], [100, 170]], releveId: "fenetres", confiance: "haute",
      valeurCotee: 1.68, cotes: "1.20 × 1.40", remarque: null,
    });
    expect(a.zones[1].releveId).toBe("crepi");
  });
});

describe("ce que la validation écarte", () => {
  const ecartee = (z: Record<string, unknown>) => {
    const a = validerAnalyse(reponse([zone(z)]), [PAGE], RELEVE)!;
    expect(a.zones).toHaveLength(0);
    expect(a.ecartees).toHaveLength(1);
    return a.ecartees[0].raison;
  };

  it("un point hors de l’image", () => {
    expect(ecartee({ points: [[100, 100], [2600, 100], [160, 170]] })).toMatch(/hors de l'image/);
    expect(ecartee({ points: [[100, 100], ["a", 100], [160, 170]] })).toMatch(/paire de nombres/);
  });

  it("ramène sur le bord un point qui le dépasse à peine", () => {
    const a = validerAnalyse(reponse([zone({ points: [[-3, 0], [300, 0], [300, 1625], [0, 1625]] })]), [PAGE], RELEVE)!;
    expect(a.zones[0].points).toEqual([[0, 0], [300, 0], [300, 1623], [0, 1623]]);
  });

  it("un contour dégénéré : trop peu de sommets, aplati ou qui se recoupe", () => {
    expect(ecartee({ points: [[100, 100], [160, 100]] })).toMatch(/trois sommets/);
    expect(ecartee({ points: [[100, 100], [100.4, 100.2], [160, 100], [160, 100]] })).toMatch(/trois sommets/);
    expect(ecartee({ points: [[100, 100], [200, 100], [300, 100.5]] })).toMatch(/aplati/);
    expect(ecartee({ points: [[100, 100], [200, 200], [200, 100], [100, 200]] })).toMatch(/se recoupe/);
  });

  it("un type ou une mesure inconnus", () => {
    expect(ecartee({ type: "balcon" })).toMatch(/type inconnu « balcon »/);
    expect(ecartee({ mesure: "volume" })).toMatch(/mesure inconnue/);
  });

  it("une longueur qui n’a pas exactement deux extrémités", () => {
    expect(ecartee({ type: "mur", mesure: "longueur", points: [[0, 0], [10, 0], [10, 10]] })).toMatch(/deux extrémités/);
  });

  it("une zone sur une page qui n’a pas été envoyée", () => {
    const deux: PageEnvoyee[] = [PAGE, { ...PAGE, numero: 3 }];
    const a = validerAnalyse({ pages: [{ page: 2, type: "elevation", zones: [zone()] }] }, deux, RELEVE)!;
    expect(a.zones).toEqual([]);
    expect(a.ecartees[0].raison).toMatch(/pas été envoyée/);
  });

  it("au-delà du plafond de zones", () => {
    const a = validerAnalyse(reponse(Array.from({ length: MAX_ZONES + 3 }, () => zone())), [PAGE], RELEVE)!;
    expect(a.zones).toHaveLength(MAX_ZONES);
    expect(a.ecartees).toHaveLength(3);
  });

  it("garde la zone mais retire un ouvrage qui n’est pas dans le relevé", () => {
    const a = validerAnalyse(reponse([zone({ releveId: "invente" })]), [PAGE], RELEVE)!;
    expect(a.zones[0].releveId).toBeNull();
    expect(a.zones[0].remarque).toMatch(/inconnu du relevé/);
  });

  it("écarte une cote de contrôle invalide, en le disant sur la page", () => {
    const a = validerAnalyse(reponse([], { cote: { texte: "12.40", longueurM: 12.4, p1: [400, 1200], p2: [405, 1200] } }), [PAGE], RELEVE)!;
    expect(a.pages[0].cote).toBeNull();
    expect(a.pages[0].remarque).toMatch(/Cote de contrôle écartée : extrémités trop proches/);
  });
});

describe("les écarts de forme tolérés", () => {
  it("lit les zones à plat, les types de page en clair, les confiances en anglais", () => {
    const a = validerAnalyse({
      pages: [{ page: "1", type: "Plan d'étage", echelle: "Échelle 1/50" }],
      zones: [{ ...zone({ confiance: "medium", type: "Fenêtre" }), page: 1 }],
    }, [PAGE], RELEVE)!;
    expect(a.pages[0].type).toBe("plan_etage");
    expect(a.pages[0].echelle).toBe("1:50");
    expect(a.zones[0].type).toBe("fenetre");
    expect(a.zones[0].confiance).toBe("moyenne");
  });

  it("déduit la mesure du nombre de points, retire le premier point recopié à la fin", () => {
    const a = validerAnalyse(reponse([zone({ mesure: undefined, points: [[100, 100], [160, 100], [160, 170], [100, 170], [100, 100]] })]), [PAGE], RELEVE)!;
    expect(a.zones[0].mesure).toBe("surface");
    expect(a.zones[0].points).toHaveLength(4);
  });

  it("remplace le tiret cadratin et donne un libellé par défaut", () => {
    const a = validerAnalyse(reponse([zone({ libelle: null, remarque: "Cadre peu lisible — à vérifier" })]), [PAGE], RELEVE)!;
    expect(a.zones[0].libelle).toBe("Fenêtre");
    expect(a.zones[0].remarque).toBe("Cadre peu lisible, à vérifier");
  });

  it("refuse ce qui n’a pas la forme d’une analyse", () => {
    expect(validerAnalyse(null, [PAGE], RELEVE)).toBeNull();
    expect(validerAnalyse([1, 2], [PAGE], RELEVE)).toBeNull();
    expect(validerAnalyse({}, [PAGE], RELEVE)).toEqual({ pages: [], zones: [], ecartees: [], remarques: null });
  });
});

describe("les images envoyées", () => {
  it("lit les dimensions d’un PNG et d’un JPEG", () => {
    const png = Buffer.alloc(33);
    png.writeUInt32BE(0x89504e47, 0); png.writeUInt32BE(0x0d0a1a0a, 4);
    png.writeUInt32BE(13, 8); png.write("IHDR", 12, "ascii");
    png.writeUInt32BE(2296, 16); png.writeUInt32BE(1623, 20);
    expect(dimensionsImage(png)).toEqual({ largeur: 2296, hauteur: 1623, type: "image/png" });

    // SOI, un segment APP0 de 16 octets, puis SOF0 : hauteur 1200, largeur 1600.
    const jpeg = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, ...Array(14).fill(0),
      0xff, 0xc0, 0x00, 0x11, 0x08, 0x04, 0xb0, 0x06, 0x40, 0x03, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ]);
    expect(dimensionsImage(jpeg)).toEqual({ largeur: 1600, hauteur: 1200, type: "image/jpeg" });
    expect(dimensionsImage(Buffer.from("pas une image"))).toBeNull();
  });

  it("vérifie les deux limites du modèle", () => {
    expect(tientDansLeModele(2296, 1623)).toBe(true);
    expect(tientDansLeModele(2576, 1822)).toBe(false);
    expect(tientDansLeModele(2600, 100)).toBe(false);
  });
});

describe("la consigne", () => {
  it("présente chaque page et liste les ouvrages", () => {
    expect(presentationDePage(PAGE)).toBe("Page 1 : image de 2296 × 1623 px ; PDF vectoriel, feuille de 420 × 297 mm.");
    expect(presentationDePage({ ...PAGE, largeurPt: null, hauteurPt: null })).toMatch(/photo ou scan/);
    const c = consigneAnalyse([PAGE], [{ id: "crepi", cfcCode: "226.2", libelle: "Crépi de façade", unite: "m²" }]);
    expect(c).toContain("crepi | 226.2 | Crépi de façade | m²");
    expect(c).toContain("[2296, 1623]");
    expect(c).not.toContain("—");
  });

  it("détecte un contour en huit", () => {
    expect(seRecoupe([[0, 0], [10, 10], [10, 0], [0, 10]])).toBe(true);
    expect(seRecoupe([[0, 0], [10, 0], [10, 10], [0, 10]])).toBe(false);
  });
});
