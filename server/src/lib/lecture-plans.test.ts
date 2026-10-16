import { describe, it, expect } from "vitest";
import {
  CLES_GRANDEURS, CONSIGNE_PLANS, MAX_IMAGE_ENCODEE, blocsDesPlans, echelleLue, nombreLu, repereDePage, validerLecturePlans,
} from "./lecture-plans.js";
import { CATEGORIES_COMPTEES } from "./comptages.js";

const G = (valeur: unknown, extra: Record<string, unknown> = {}) => ({
  valeur, page: "F1 p. 1", methode: "cote lue", confiance: "haute", remarque: null, ...extra,
});

// Une lecture propre d'un petit immeuble : ce que le modèle rend quand tout va bien.
const lectureValide = () => ({
  estUnJeuDePlans: true,
  projet: { nom: "Résidence du Lac", adresse: "Avenue de la Gare 12", npa: "1003", localite: "Lausanne", canton: "vd" },
  pages: [
    { page: "F1 p. 1", type: "plan d'étage", titre: "Rez-de-chaussée", echelle: "1 : 100" },
    { page: "F2 p. 1", type: "coupe", titre: "Coupe A-A", echelle: "1/50" },
    { page: "F2 p. 2", type: "élévation", titre: "Façade sud", echelle: null },
  ],
  grandeurs: {
    emprise: G(226.3, { methode: "calcul depuis des cotes", confiance: "moyenne", remarque: "12,40 × 18,25 = 226,3 m²" }),
    perimetre: G(61.3, { methode: "calcul depuis des cotes", confiance: "moyenne" }),
    etagesHorsSol: G(4),
    sousSols: G(1),
    hauteurEtage: G(2.85, { page: "F2 p. 1" }),
    hauteurTotale: G(13.2, { page: "F2 p. 1" }),
    surfacePlancher: G(905, { methode: "surface imprimée" }),
    surfaceFacade: G(700, { methode: "calcul depuis des cotes", confiance: "moyenne" }),
    surfaceFenetres: G(175, { methode: "calcul depuis des cotes", confiance: "moyenne" }),
    tauxVitrage: G(25, { methode: "calcul depuis des cotes", confiance: "moyenne" }),
    logements: G(8),
    cagesEscalier: G(1),
    typeToit: G("PLATE", { page: "F2 p. 1" }),
    surfaceToiture: G(230, { methode: "estimation", confiance: "basse", remarque: "emprise et débords" }),
  },
  facadesParOrientation: [
    { orientation: "Sud", ...G(210, { page: "F2 p. 2", methode: "calcul depuis des cotes", confiance: "moyenne" }) },
  ],
  typologies: G({ "3.5": 4, "4,5": 4 }),
  remarques: "Pas de plan des combles.",
});

describe("une lecture de plans valide", () => {
  const l = validerLecturePlans(lectureValide(), 2)!;

  it("garde chaque grandeur avec sa page, sa méthode et sa confiance", () => {
    expect(l.estUnJeuDePlans).toBe(true);
    expect(l.grandeurs.emprise).toEqual({
      valeur: 226.3, page: "F1 p. 1", methode: "calcul depuis des cotes", confiance: "moyenne", remarque: "12,40 × 18,25 = 226,3 m²",
    });
    expect(l.grandeurs.hauteurEtage.valeur).toBe(2.85);
    expect(l.grandeurs.hauteurEtage.page).toBe("F2 p. 1");
    expect(l.grandeurs.etagesHorsSol.valeur).toBe(4);
    expect(l.grandeurs.tauxVitrage.valeur).toBe(25);
    expect(l.typeToit.valeur).toBe("PLATE");
  });

  it("rend toutes les grandeurs demandées, même celles que le modèle a oubliées", () => {
    const sans = lectureValide();
    delete (sans.grandeurs as Record<string, unknown>).surfaceToiture;
    const r = validerLecturePlans(sans, 2)!;
    expect(Object.keys(r.grandeurs).sort()).toEqual([...CLES_GRANDEURS].sort());
    expect(r.grandeurs.surfaceToiture.valeur).toBeNull();
  });

  it("ramène les échelles à « 1:100 » et le canton en majuscules", () => {
    expect(l.pages.map((p) => p.echelle)).toEqual(["1:100", "1:50", null]);
    expect(l.projet).toEqual({ nom: "Résidence du Lac", adresse: "Avenue de la Gare 12", npa: "1003", localite: "Lausanne", canton: "VD" });
  });

  it("réunit les typologies sous des clés que le dossier accepte", () => {
    expect(l.typologies.valeur).toEqual({ "3.5": 4, "4.5": 4 });
    // 4 + 4 = 8 logements : rien à signaler.
    expect(l.typologies.confiance).toBe("haute");
  });

  it("garde les façades par orientation", () => {
    expect(l.facadesParOrientation).toHaveLength(1);
    expect(l.facadesParOrientation[0]).toMatchObject({ orientation: "Sud", valeur: 210, page: "F2 p. 2" });
  });
});

describe("les valeurs aberrantes", () => {
  const avec = (cle: string, g: unknown) => {
    const l = lectureValide();
    (l.grandeurs as Record<string, unknown>)[cle] = g;
    return validerLecturePlans(l, 2)!;
  };

  it("écarte une valeur négative, avec une remarque", () => {
    const g = avec("emprise", G(-226)).grandeurs.emprise;
    expect(g.valeur).toBeNull();
    expect(g.remarque).toMatch(/négative/);
  });

  it("écarte plus de soixante étages", () => {
    const g = avec("etagesHorsSol", G(75)).grandeurs.etagesHorsSol;
    expect(g.valeur).toBeNull();
    expect(g.remarque).toMatch(/75.*1 à 60/);
  });

  it("écarte une hauteur d'étage hors de 2 à 6 m", () => {
    expect(avec("hauteurEtage", G(27)).grandeurs.hauteurEtage.valeur).toBeNull();
    expect(avec("hauteurEtage", G(1.2)).grandeurs.hauteurEtage.valeur).toBeNull();
    expect(avec("hauteurEtage", G(6)).grandeurs.hauteurEtage.valeur).toBe(6);
  });

  it("écarte un taux de vitrage hors de 0 à 100 %, mais relit une fraction", () => {
    const l = lectureValide();
    l.grandeurs.tauxVitrage = G(140);
    l.grandeurs.surfaceFenetres = G(null);
    expect(validerLecturePlans(l, 2)!.grandeurs.tauxVitrage.valeur).toBeNull();
    // Avec les deux surfaces lues, le taux écarté est recalculé, et la remarque le dit.
    const recalcule = avec("tauxVitrage", G(140)).grandeurs.tauxVitrage;
    expect(recalcule.valeur).toBe(25);
    expect(recalcule.remarque).toMatch(/Déduit.*écartée/);
    const fraction = avec("tauxVitrage", G(0.3)).grandeurs.tauxVitrage;
    expect(fraction.valeur).toBe(30);
    expect(fraction.remarque).toMatch(/fraction/);
  });

  it("écarte un nombre d'étages ou de logements non entier", () => {
    expect(avec("etagesHorsSol", G(4.5)).grandeurs.etagesHorsSol.valeur).toBeNull();
    expect(avec("logements", G(7.5)).grandeurs.logements.valeur).toBeNull();
  });

  it("écarte un texte à la place d'un nombre, mais lit « 1'450 » et « 2,85 »", () => {
    const g = avec("surfacePlancher", G("environ mille")).grandeurs.surfacePlancher;
    expect(g.valeur).toBeNull();
    expect(g.remarque).toMatch(/illisible/);
    expect(avec("surfacePlancher", G("1'450")).grandeurs.surfacePlancher.valeur).toBe(1450);
    expect(avec("hauteurEtage", G("2,85")).grandeurs.hauteurEtage.valeur).toBe(2.85);
  });

  it("met en doute un périmètre trop court pour l'emprise", () => {
    const l = avec("perimetre", G(30));
    expect(l.grandeurs.perimetre.valeur).toBe(30);
    expect(l.grandeurs.perimetre.confiance).toBe("basse");
    expect(l.grandeurs.emprise.confiance).toBe("basse");
    expect(l.grandeurs.perimetre.remarque).toMatch(/Incohérent/);
  });

  it("met en doute plus de fenêtres que de façade", () => {
    const l = avec("surfaceFenetres", G(800));
    expect(l.grandeurs.surfaceFenetres.confiance).toBe("basse");
    expect(l.grandeurs.surfaceFacade.confiance).toBe("basse");
  });

  it("met en doute des typologies qui ne font pas le compte des logements", () => {
    const l = avec("logements", G(10));
    expect(l.typologies.confiance).toBe("basse");
    expect(l.typologies.remarque).toMatch(/8.*10/);
  });

  it("refuse un type de toit inconnu", () => {
    const g = avec("typeToit", G("toit végétal")).typeToit;
    expect(g.valeur).toBeNull();
    expect(g.remarque).toMatch(/non reconnu/);
  });
});

describe("la méthode et la confiance", () => {
  it("ne laisse jamais une estimation en confiance haute", () => {
    const l = lectureValide();
    l.grandeurs.surfaceToiture = G(230, { methode: "estimation", confiance: "haute" });
    expect(validerLecturePlans(l, 2)!.grandeurs.surfaceToiture.confiance).toBe("basse");
  });

  it("traite une valeur sans méthode comme une estimation", () => {
    const l = lectureValide();
    (l.grandeurs as Record<string, unknown>).cagesEscalier = 2;
    const g = validerLecturePlans(l, 2)!.grandeurs.cagesEscalier;
    expect(g.valeur).toBe(2);
    expect(g.methode).toBe("estimation");
    expect(g.confiance).toBe("basse");
    expect(g.remarque).toMatch(/Méthode non indiquée/);
  });

  it("accepte une méthode sans accents et une confiance en anglais", () => {
    const l = lectureValide();
    l.grandeurs.surfacePlancher = G(905, { methode: "Surface imprimee", confiance: "high" });
    const g = validerLecturePlans(l, 2)!.grandeurs.surfacePlancher;
    expect(g.methode).toBe("surface imprimée");
    expect(g.confiance).toBe("haute");
  });
});

describe("les champs manquants", () => {
  it("rend une lecture vide mais complète quand le modèle n'a presque rien dit", () => {
    const l = validerLecturePlans({ estUnJeuDePlans: true }, 1)!;
    expect(l.pages).toEqual([]);
    for (const cle of CLES_GRANDEURS) expect(l.grandeurs[cle].valeur).toBeNull();
    expect(l.typeToit.valeur).toBeNull();
    expect(l.typologies.valeur).toBeNull();
    expect(l.facadesParOrientation).toEqual([]);
    expect(l.projet).toEqual({ nom: null, adresse: null, npa: null, localite: null, canton: null });
  });

  it("garde la remarque d'une grandeur que les plans ne donnent pas", () => {
    const l = lectureValide();
    l.grandeurs.hauteurEtage = G(null, { remarque: "aucune coupe fournie" });
    const g = validerLecturePlans(l, 2)!.grandeurs.hauteurEtage;
    expect(g).toEqual({ valeur: null, page: null, methode: null, confiance: null, remarque: "aucune coupe fournie" });
  });

  it("déduit le taux de vitrage des surfaces lues quand il manque", () => {
    const l = lectureValide();
    l.grandeurs.tauxVitrage = G(null);
    const g = validerLecturePlans(l, 2)!.grandeurs.tauxVitrage;
    expect(g.valeur).toBe(25);
    expect(g.methode).toBe("calcul depuis des cotes");
    expect(g.confiance).toBe("moyenne");
  });

  it("refuse ce qui n'est pas une lecture", () => {
    expect(validerLecturePlans(null, 1)).toBeNull();
    expect(validerLecturePlans([1, 2], 1)).toBeNull();
    expect(validerLecturePlans("texte", 1)).toBeNull();
  });

  it("dit quand les fichiers ne sont pas des plans", () => {
    expect(validerLecturePlans({ estUnJeuDePlans: false }, 1)!.estUnJeuDePlans).toBe(false);
  });

  it("retire le tiret cadratin des remarques", () => {
    const l = lectureValide();
    l.remarques = "Plans anciens \u2014 cotes à vérifier.";
    expect(validerLecturePlans(l, 2)!.remarques).toBe("Plans anciens, cotes à vérifier.");
  });
});

describe("les repères", () => {
  it("ramène une page à « F1 p. 3 » et écarte un fichier qui n'existe pas", () => {
    expect(repereDePage("f1, page 3", 2)).toBe("F1 p. 3");
    expect(repereDePage("F2", 2)).toBe("F2");
    expect(repereDePage("F3 p. 1", 2)).toBeNull();
    expect(repereDePage(4, 1)).toBe("F1 p. 4");
  });

  it("lit les échelles usuelles et rien d'autre", () => {
    expect(echelleLue("Échelle 1:200")).toBe("1:200");
    expect(echelleLue("1/1'000")).toBe("1:1000");
    expect(echelleLue("sans échelle")).toBeNull();
    expect(echelleLue(100)).toBe("1:100");
  });

  it("lit les nombres écrits à la suisse", () => {
    expect(nombreLu("1 450,5")).toBe(1450.5);
    expect(nombreLu("12 m")).toBeNull();
    expect(nombreLu(Number.NaN)).toBeNull();
  });
});

describe("les fichiers envoyés au modèle", () => {
  it("fait d'un PDF un document et d'une photo une image, chacun précédé de son repère", () => {
    const blocs = blocsDesPlans([
      { nom: "rez.pdf", type: "application/pdf", contenu: Buffer.from("%PDF") },
      { nom: "coupe.JPG", type: "application/octet-stream", contenu: Buffer.from("jpg") },
    ]);
    expect(blocs.map((b) => b.type)).toEqual(["text", "document", "text", "image"]);
    expect(blocs[0]).toEqual({ type: "text", text: "Fichier F1 : « rez.pdf »" });
    expect(blocs[3]).toMatchObject({ source: { media_type: "image/jpeg" } });
  });

  it("refuse un format qui n'est pas un plan", () => {
    expect(() => blocsDesPlans([{ nom: "plan.dwg", type: "application/acad", contenu: Buffer.from("x") }])).toThrow(/ni un PDF ni une image/);
  });

  it("refuse une image trop lourde pour le modèle", () => {
    const lourde = Buffer.alloc(Math.ceil((MAX_IMAGE_ENCODEE * 3) / 4) + 10);
    expect(() => blocsDesPlans([{ nom: "photo.png", type: "image/png", contenu: lourde }])).toThrow(/trop lourde/);
  });
});

describe("la consigne", () => {
  it("demande chacune des grandeurs que la validation attend", () => {
    for (const cle of CLES_GRANDEURS) expect(CONSIGNE_PLANS).toContain(`"${cle}"`);
    expect(CONSIGNE_PLANS).toContain('"typeToit"');
  });
});

describe("les éléments comptés", () => {
  const E = (nombre: unknown, extra: Record<string, unknown> = {}) => ({
    nombre, surface: null, pages: ["F1 p. 1"], methode: "compté sur le plan", confiance: "haute", detail: null, ...extra,
  });
  const avec = (elements: unknown) => validerLecturePlans({ ...lectureValide(), elements }, 2)!;

  it("garde chaque compte avec ses pages, sa méthode, sa confiance et son calcul", () => {
    const l = avec({
      porte_paliere: E(6, { methode: "compté et multiplié par les étages identiques", detail: "2 par palier × 3 étages = 6", pages: ["F1 p. 2", "F1 p. 2", "F9 p. 1"] }),
      fenetre: E(24, { surface: 40.32, pages: "F2 p. 2" }),
    });
    expect(l.elements.porte_paliere).toEqual({
      nombre: 6, surface: null, pages: ["F1 p. 2"], methode: "compté et multiplié par les étages identiques",
      confiance: "haute", detail: "2 par palier × 3 étages = 6", remarque: null,
    });
    expect(l.elements.fenetre.surface).toBe(40.32);
    expect(l.elements.fenetre.pages).toEqual(["F2 p. 2"]);
  });

  it("rend toutes les catégories, à null celles que les plans ne permettent pas de compter", () => {
    const l = avec({ balcon: { nombre: null, detail: "balcons non dessinés" } });
    expect(Object.keys(l.elements).sort()).toEqual([...CATEGORIES_COMPTEES].sort());
    expect(l.elements.balcon).toMatchObject({ nombre: null, detail: "balcons non dessinés" });
    expect(l.elements.cuisine.nombre).toBeNull();
    expect(validerLecturePlans({ estUnJeuDePlans: true }, 1)!.elements.porte_paliere.nombre).toBeNull();
  });

  it("écarte un nombre négatif, décimal, illisible ou au-delà de cinq mille", () => {
    const l = avec({ porte_paliere: E(-2), cuisine: E(4.5), balcon: E("beaucoup"), appareil_sanitaire: E(6000) });
    expect(l.elements.porte_paliere).toMatchObject({ nombre: null, remarque: expect.stringMatching(/négatif/) });
    expect(l.elements.cuisine).toMatchObject({ nombre: null, remarque: expect.stringMatching(/non entier/) });
    expect(l.elements.balcon).toMatchObject({ nombre: null, remarque: expect.stringMatching(/illisible/) });
    expect(l.elements.appareil_sanitaire).toMatchObject({ nombre: null, remarque: expect.stringMatching(/au-delà de 5000/) });
  });

  it("accepte zéro, un nombre nu et un nombre écrit en texte", () => {
    const l = avec({ balcon: E(0), cuisine: 8, porte_entree: E("2") });
    expect(l.elements.balcon.nombre).toBe(0);
    expect(l.elements.cuisine).toMatchObject({ nombre: 8, methode: "estimation", confiance: "basse" });
    expect(l.elements.porte_entree.nombre).toBe(2);
  });

  it("écarte une catégorie inconnue, en le disant", () => {
    const l = avec({ ascenseur: E(1), porte_paliere: E(6) });
    expect(l.elements.porte_paliere.nombre).toBe(6);
    expect(l.remarques).toMatch(/catégorie inconnue : « ascenseur »/);
  });

  it("lit aussi une liste, et garde la première lecture d'une catégorie donnée deux fois", () => {
    // Accents, majuscules et espaces ne changent pas la catégorie : « Porte palière » est porte_paliere.
    const l = avec([{ categorie: "Porte palière", ...E(6) }, { categorie: "porte_paliere", ...E(9) }, { categorie: "Balcon", ...E(4) }]);
    expect(l.elements.porte_paliere.nombre).toBe(6);
    expect(l.elements.balcon.nombre).toBe(4);
  });

  it("ne laisse jamais une estimation en confiance haute", () => {
    const l = avec({ appareil_sanitaire: E(16, { methode: "estimation", confiance: "haute" }), balcon: E(4, { methode: "devinette" }) });
    expect(l.elements.appareil_sanitaire.confiance).toBe("basse");
    expect(l.elements.balcon).toMatchObject({ methode: "estimation", confiance: "basse", remarque: expect.stringMatching(/Méthode non indiquée/) });
  });

  it("ne garde une surface que pour les fenêtres, et l'écarte si elle est absurde", () => {
    const l = avec({ balcon: E(4, { surface: 20 }), fenetre: E(10, { surface: -3 }) });
    expect(l.elements.balcon.surface).toBeNull();
    expect(l.elements.fenetre).toMatchObject({ nombre: 10, surface: null, remarque: expect.stringMatching(/Surface des fenêtres écartée/) });
  });

  it("met en doute plus de trois portes palières par logement", () => {
    // 8 logements : 30 portes palières, c'est un étage compté plusieurs fois.
    const l = avec({ porte_paliere: E(30), cuisine: E(8) });
    expect(l.elements.porte_paliere.confiance).toBe("basse");
    expect(l.elements.porte_paliere.remarque).toMatch(/plus de 3 par logement/);
    expect(l.elements.cuisine.confiance).toBe("haute");
  });

  it("met en doute plus de portes d'entrée que les cages n'en portent, et plus de fenêtres que de façade", () => {
    const l = avec({ porte_entree: E(9), fenetre: E(20, { surface: 900 }) });
    expect(l.elements.porte_entree.confiance).toBe("basse");
    expect(l.elements.fenetre.confiance).toBe("basse");
    expect(l.elements.fenetre.remarque).toMatch(/fenêtres pour 700 m² de façade/);
  });

  it("retire le tiret cadratin du calcul", () => {
    const l = avec({ porte_paliere: E(6, { detail: "2 par palier — 3 étages" }) });
    expect(l.elements.porte_paliere.detail).toBe("2 par palier, 3 étages");
  });

  it("demande chaque catégorie dans la consigne", () => {
    for (const c of CATEGORIES_COMPTEES) expect(CONSIGNE_PLANS).toContain(`"${c}": E`);
    expect(CONSIGNE_PLANS).toContain("étage type");
    expect(CONSIGNE_PLANS).not.toContain("—");
  });
});
