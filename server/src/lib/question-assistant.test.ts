import { describe, it, expect } from "vitest";
import {
  ETIQUETTE_MAX,
  NOM_OUTIL_QUESTION,
  OUTIL_POSER_QUESTION,
  extraireQuestion,
  questionHistorique,
  texteAssistantPourApi,
  texteUtilisateurPourApi,
  validerQuestion,
} from "./question-assistant.js";

// Ce que le modèle envoie quand il suit la consigne.
const entree = (patch: Record<string, unknown> = {}) => ({
  question: "Quel rapport voulez-vous envoyer à la régie ?",
  etiquette: "Rapport",
  options: [
    { libelle: "Rapport complet (recommandé)", description: "Tous les éléments, les coûts et le plan de travaux." },
    { libelle: "Synthèse", description: "Une page avec les priorités I et les montants totaux." },
  ],
  choixMultiple: false,
  ...patch,
});

describe("validerQuestion", () => {
  it("accepte une question bien formée et retire la marque « (recommandé) » du libellé", () => {
    const q = validerQuestion(entree());
    expect(q).toEqual({
      question: "Quel rapport voulez-vous envoyer à la régie ?",
      etiquette: "Rapport",
      options: [
        { libelle: "Rapport complet", description: "Tous les éléments, les coûts et le plan de travaux.", recommande: true },
        { libelle: "Synthèse", description: "Une page avec les priorités I et les montants totaux.", recommande: false },
      ],
      choixMultiple: false,
    });
  });

  it("place l'option recommandée en premier sans déranger l'ordre des autres", () => {
    const q = validerQuestion(
      entree({
        options: [
          { libelle: "Toiture", description: "a" },
          { libelle: "Façades", description: "b" },
          { libelle: "Fenêtres (Recommandée)", description: "c" },
        ],
      }),
    );
    expect(q?.options.map((o) => [o.libelle, o.recommande])).toEqual([
      ["Fenêtres", true],
      ["Toiture", false],
      ["Façades", false],
    ]);
  });

  it("retire les espaces autour des textes", () => {
    const q = validerQuestion(entree({ question: "  Pour qui ?  ", etiquette: " Destinataire " }));
    expect(q?.question).toBe("Pour qui ?");
    expect(q?.etiquette).toBe("Destinataire");
  });

  it("garde le choix multiple", () => {
    expect(validerQuestion(entree({ choixMultiple: true }))?.choixMultiple).toBe(true);
  });

  it(`refuse une étiquette de plus de ${ETIQUETTE_MAX} caractères`, () => {
    expect(validerQuestion(entree({ etiquette: "Destinataires" }))).toBeNull();
    expect(validerQuestion(entree({ etiquette: "Destinataire" }))).not.toBeNull();
  });

  it("refuse moins de deux options ou plus de quatre", () => {
    const option = (n: number) => ({ libelle: `Choix ${n}`, description: "Une phrase." });
    expect(validerQuestion(entree({ options: [option(1)] }))).toBeNull();
    expect(validerQuestion(entree({ options: [1, 2, 3, 4, 5].map(option) }))).toBeNull();
    expect(validerQuestion(entree({ options: [1, 2, 3, 4].map(option) }))?.options).toHaveLength(4);
  });

  it("refuse un champ manquant, vide ou du mauvais type", () => {
    expect(validerQuestion({ ...entree(), question: undefined })).toBeNull();
    expect(validerQuestion(entree({ question: "   " }))).toBeNull();
    expect(validerQuestion(entree({ choixMultiple: "non" }))).toBeNull();
    expect(validerQuestion(entree({ options: "Rapport complet, Synthèse" }))).toBeNull();
    expect(validerQuestion(entree({ options: [{ libelle: "A", description: "" }, { libelle: "B", description: "b" }] }))).toBeNull();
  });

  it("refuse une clé inconnue, au premier niveau comme dans une option", () => {
    expect(validerQuestion(entree({ aide: "texte" }))).toBeNull();
    expect(
      validerQuestion(entree({ options: [{ libelle: "A", description: "a", lien: "x" }, { libelle: "B", description: "b" }] })),
    ).toBeNull();
  });

  it("refuse deux options au même libellé, même à la casse et aux accents près", () => {
    const options = [
      { libelle: "Façades", description: "a" },
      { libelle: "facades", description: "b" },
    ];
    expect(validerQuestion(entree({ options }))).toBeNull();
  });

  it("refuse un libellé réduit à sa marque", () => {
    const options = [
      { libelle: "(recommandé)", description: "a" },
      { libelle: "Synthèse", description: "b" },
    ];
    expect(validerQuestion(entree({ options }))).toBeNull();
  });

  it("refuse plus d'une option recommandée", () => {
    const options = [
      { libelle: "Rapport complet (recommandé)", description: "a" },
      { libelle: "Synthèse (recommandé)", description: "b" },
    ];
    expect(validerQuestion(entree({ options }))).toBeNull();
  });

  it("refuse ce qui n'est pas un objet", () => {
    expect(validerQuestion(null)).toBeNull();
    expect(validerQuestion("Quel rapport ?")).toBeNull();
    expect(validerQuestion([entree()])).toBeNull();
  });
});

describe("extraireQuestion", () => {
  it("lit l'appel à poser_question à côté du texte", () => {
    const q = extraireQuestion([
      { type: "text", text: "Une précision avant de rédiger." },
      { type: "tool_use", name: NOM_OUTIL_QUESTION, input: entree() },
    ]);
    expect(q?.etiquette).toBe("Rapport");
  });

  it("ne rend rien sans appel, pour un autre outil ou pour une entrée invalide", () => {
    expect(extraireQuestion([{ type: "text", text: "Voici la synthèse." }])).toBeNull();
    expect(extraireQuestion([{ type: "tool_use", name: "autre_outil", input: entree() }])).toBeNull();
    expect(extraireQuestion([{ type: "tool_use", name: NOM_OUTIL_QUESTION, input: entree({ options: [] }) }])).toBeNull();
  });

  it("ne garde que la première question", () => {
    const q = extraireQuestion([
      { type: "tool_use", name: NOM_OUTIL_QUESTION, input: entree({ etiquette: "Premiere" }) },
      { type: "tool_use", name: NOM_OUTIL_QUESTION, input: entree({ etiquette: "Seconde" }) },
    ]);
    expect(q?.etiquette).toBe("Premiere");
  });
});

describe("la définition envoyée à l'API", () => {
  it("est stricte et ne porte pas les bornes que le mode strict refuse", () => {
    expect(OUTIL_POSER_QUESTION.strict).toBe(true);
    const schema = JSON.stringify(OUTIL_POSER_QUESTION.input_schema);
    for (const borne of ["maxLength", "minLength", "minItems", "maxItems", "minimum", "maximum"]) {
      expect(schema).not.toContain(borne);
    }
    expect(OUTIL_POSER_QUESTION.input_schema.additionalProperties).toBe(false);
    expect(OUTIL_POSER_QUESTION.input_schema.properties.options.items.additionalProperties).toBe(false);
  });
});

describe("questionHistorique", () => {
  it("relit la question renvoyée par le client, réponse comprise, sans garder la réponse", () => {
    const q = validerQuestion(entree())!;
    const lu = questionHistorique.safeParse({ ...q, reponse: { choix: ["Synthèse"] } });
    expect(lu.success).toBe(true);
    expect(lu.success && "reponse" in lu.data).toBe(false);
  });
});

describe("le tour suivant, en texte", () => {
  const question = validerQuestion(entree())!;

  it("garde la phrase de l'assistant telle quelle", () => {
    expect(texteAssistantPourApi("Une précision avant de rédiger.", question)).toBe("Une précision avant de rédiger.");
  });

  it("met la question à la place d'un tour sans texte : l'API refuse un bloc vide", () => {
    expect(texteAssistantPourApi("  ", question)).toBe(question.question);
    expect(texteAssistantPourApi("", null)).not.toBe("");
  });

  it("rappelle la question et ses choix devant la réponse de l'utilisateur", () => {
    const t = texteUtilisateurPourApi("Synthèse", question);
    expect(t).toContain(question.question);
    expect(t).toContain("Rapport complet ; Synthèse");
    expect(t.endsWith("\nSynthèse")).toBe(true);
  });

  it("dit quand plusieurs choix étaient possibles", () => {
    expect(texteUtilisateurPourApi("Toiture, Façades", { ...question, choixMultiple: true })).toContain("plusieurs possibles");
  });

  it("laisse un message sans question précédente intact", () => {
    expect(texteUtilisateurPourApi("Résume ce diagnostic", undefined)).toBe("Résume ce diagnostic");
  });
});
