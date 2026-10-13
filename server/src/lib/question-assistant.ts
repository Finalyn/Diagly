/**
 * Les questions à choix que l'assistant peut poser.
 *
 * Quand une demande est ambiguë, une question écrite en prose oblige
 * l'utilisateur à taper sa réponse au pouce, sur le chantier. L'assistant
 * dispose donc d'un outil, `poser_question`, que le front affiche comme une
 * carte : une étiquette, la question, deux à quatre options qui se touchent,
 * et toujours un champ pour répondre autre chose.
 *
 * L'outil n'est « exécuté » par personne : c'est l'utilisateur qui y répond,
 * plus tard, par un message ordinaire. Ce fichier tient les trois moments de
 * ce va-et-vient, sans dépendre d'Express ni du réseau pour pouvoir être
 * testé : la définition envoyée à l'API, la validation de ce que le modèle en
 * fait, et la mise en texte de la question et de sa réponse quand la
 * conversation repart vers le modèle.
 */
import { z } from "zod";

export const NOM_OUTIL_QUESTION = "poser_question";

/** Une pastille au-dessus de la question : au-delà, elle passe sur deux lignes au téléphone. */
export const ETIQUETTE_MAX = 12;
const QUESTION_MAX = 300;
const LIBELLE_MAX = 80;
const DESCRIPTION_MAX = 240;

export interface OptionQuestion {
  libelle: string;
  description: string;
  /** Le modèle l'a marquée « (recommandé) ». Elle est alors placée en premier. */
  recommande: boolean;
}

export interface QuestionAssistant {
  question: string;
  etiquette: string;
  options: OptionQuestion[];
  choixMultiple: boolean;
}

/**
 * La définition de l'outil, telle que l'API Anthropic la reçoit.
 *
 * `strict: true` garantit que l'entrée respecte la forme du schéma (champs
 * présents, types justes, rien de plus). Le mode strict refuse en revanche
 * les bornes de longueur et de nombre (maxLength, minItems, maxItems) : elles
 * sont donc dites dans les descriptions, pour le modèle, et contrôlées ici par
 * zod, pour nous. C'est ce que font les SDK officiels quand ils retirent ces
 * contraintes du schéma envoyé.
 */
export const OUTIL_POSER_QUESTION = {
  name: NOM_OUTIL_QUESTION,
  description:
    "Affiche a l'utilisateur une question a choix: une carte avec une etiquette, la question et 2 a 4 options cliquables. " +
    "L'utilisateur peut toujours repondre autre chose en texte libre. Sa reponse arrive au tour suivant comme un message ordinaire. " +
    "A utiliser seulement quand la reponse change vraiment ce que tu vas produire, ou pour proposer clairement les suites possibles.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      question: {
        type: "string",
        description: "La question, en une phrase claire qui se comprend sans relire la conversation.",
      },
      etiquette: {
        type: "string",
        description: `UN mot, deux au plus, ${ETIQUETTE_MAX} caracteres au plus espaces compris: « Document », « Destinataire », « Priorites », « Suite ». Jamais « Type de document » (16 caracteres): abrege.`,
      },
      options: {
        type: "array",
        description:
          "De 2 a 4 options concretes et distinctes, sans option « Autre » (une reponse libre est toujours possible). Si l'une est preferable, place-la en premier et termine son libelle par « (recommandé) ».",
        items: {
          type: "object",
          properties: {
            libelle: { type: "string", description: "Le choix en 1 a 5 mots." },
            description: { type: "string", description: "Une phrase courte qui dit ce que ce choix implique." },
          },
          required: ["libelle", "description"],
          additionalProperties: false,
        },
      },
      choixMultiple: {
        type: "boolean",
        description: "true seulement si plusieurs options peuvent etre retenues ensemble.",
      },
    },
    required: ["question", "etiquette", "options", "choixMultiple"],
    additionalProperties: false,
  },
} as const;

/** Ce que le prompt système ajoute quand le client sait afficher les cartes. */
export const CONSIGNE_QUESTIONS = `Questions a choix: l'outil ${NOM_OUTIL_QUESTION} affiche a l'utilisateur une carte avec 2 a 4 options qu'il touche pour repondre (il peut aussi repondre autre chose en texte libre).
Utilise-le seulement dans deux cas: la demande est ambigue ET la reponse change vraiment ce que tu vas produire (rapport complet ou synthese, quel diagnostic parmi plusieurs, pour quel destinataire); ou, apres une reponse, pour proposer clairement les suites possibles quand plusieurs directions se valent.
Dans ces deux cas, passe TOUJOURS par l'outil: jamais une liste de choix ecrite en texte, jamais « Lequel? » en fin de message.
Jamais pour une information que tu trouves dans les diagnostics ou le contexte fournis: lis-les d'abord. Jamais pour confirmer l'evidence, ni a chaque reponse.
Une seule question a la fois: si plusieurs points sont flous, pose d'abord celui qui change le plus le resultat, puis attends la reponse. Plus de 4 possibilites: propose les 4 plus probables, l'utilisateur peut ecrire les autres.
Options concretes, courtes et distinctes. Si une option est preferable, place-la en premier et termine son libelle par « (recommandé) ». Pas d'option « Autre »: le champ de reponse libre est toujours sous les options. Etiquette: un mot de ${ETIQUETTE_MAX} caracteres au plus (« Document », pas « Type de document »), sinon la carte n'est pas affichee.
Quand tu appelles l'outil, ton texte tient en une phrase courte (« Une precision avant de rediger. ») ou est vide. N'ecris JAMAIS la question ni les options en texte, ni en liste: la carte les affiche deja, les repeter les ferait apparaitre deux fois.`;

const texte = (max: number) => z.string().trim().min(1).max(max);

/**
 * La forme exacte attendue du modèle. Stricte : une clé en trop veut dire que
 * le modèle a mal compris l'outil, et mieux vaut ne rien afficher qu'une carte
 * bancale.
 */
const entreeModele = z.strictObject({
  question: texte(QUESTION_MAX),
  etiquette: texte(ETIQUETTE_MAX),
  // Le libellé porte encore sa marque « (recommandé) » : la borne est celle d'après son retrait, plus la marque.
  options: z.array(z.strictObject({ libelle: texte(LIBELLE_MAX + 16), description: texte(DESCRIPTION_MAX) })).min(2).max(4),
  choixMultiple: z.boolean(),
});

/** « (recommandé) », « (Recommandée) », « (recommande) » en fin de libellé. */
const MARQUE_RECOMMANDE = /\s*\(\s*recommand[ée]e?\s*\)\s*$/i;

/** Sans accents ni capitales : deux libellés qui ne diffèrent que par là sont le même choix. */
const plier = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Valide l'entrée d'un appel à `poser_question` et la met en forme pour le
 * front. Rend null si quoi que ce soit cloche : la route garde alors le texte
 * du modèle et n'affiche pas de carte.
 */
export function validerQuestion(entree: unknown): QuestionAssistant | null {
  const lu = entreeModele.safeParse(entree);
  if (!lu.success) return null;

  const options: OptionQuestion[] = lu.data.options.map((o) => {
    const marque = o.libelle.match(MARQUE_RECOMMANDE);
    return {
      libelle: marque ? o.libelle.slice(0, marque.index).trim() : o.libelle,
      description: o.description,
      recommande: !!marque,
    };
  });

  if (options.some((o) => o.libelle.length === 0 || o.libelle.length > LIBELLE_MAX)) return null;
  // Deux options au même libellé : la réponse renvoyée ne dirait pas laquelle a été touchée.
  if (new Set(options.map((o) => plier(o.libelle))).size !== options.length) return null;
  // Une recommandation, ou aucune : deux options « recommandées » n'en recommandent aucune.
  if (options.filter((o) => o.recommande).length > 1) return null;

  // La recommandée vient en tête, comme la consigne le demande au modèle ;
  // les autres gardent leur ordre (le tri de JavaScript est stable).
  options.sort((a, b) => Number(b.recommande) - Number(a.recommande));

  return {
    question: lu.data.question,
    etiquette: lu.data.etiquette,
    options,
    choixMultiple: lu.data.choixMultiple,
  };
}

/** Un bloc du contenu d'une réponse de l'API Messages, réduit à ce qu'on en lit. */
export interface BlocReponse {
  type: string;
  text?: string;
  name?: string;
  input?: unknown;
}

/**
 * La question posée dans une réponse du modèle, s'il en a posé une valide.
 * Les appels parallèles sont coupés à la requête ; s'il en restait plusieurs,
 * seule la première compte : une question à la fois.
 */
export function extraireQuestion(contenu: BlocReponse[]): QuestionAssistant | null {
  const appel = contenu.find((b) => b.type === "tool_use" && b.name === NOM_OUTIL_QUESTION);
  return appel ? validerQuestion(appel.input) : null;
}

/**
 * Une question telle que le front la renvoie avec l'historique.
 *
 * Plus souple que la sortie du modèle : le front y ajoute la réponse donnée,
 * qu'on ignore ici (zod retire les clés inconnues), et la question a déjà été
 * validée à l'aller. Les bornes restent : c'est une entrée du client.
 */
export const questionHistorique = z.object({
  question: texte(QUESTION_MAX),
  etiquette: texte(ETIQUETTE_MAX),
  options: z
    .array(z.object({ libelle: texte(LIBELLE_MAX), description: texte(DESCRIPTION_MAX), recommande: z.boolean().optional() }))
    .min(2)
    .max(4),
  choixMultiple: z.boolean(),
});

// ------------------------------------------------------------ le tour suivant
//
// Comment la réponse revient au modèle. L'API attend, après un appel d'outil,
// un message utilisateur qui commence par un bloc tool_result portant
// l'identifiant de l'appel. Le faire voudrait dire garder cet identifiant dans
// les conversations de l'appareil, et, sur un modèle qui réfléchit avant de
// répondre, renvoyer aussi les blocs de réflexion de ce tour, sans quoi l'API
// refuse la requête. L'historique est donc reconstruit en texte : le tour de
// l'assistant redevient sa phrase (ou la question elle-même s'il n'avait rien
// écrit), et le message suivant de l'utilisateur rappelle la question à
// laquelle il répond. Aucun bloc tool_use ne repart, donc aucune règle
// d'appariement ne peut être enfreinte, quel que soit le modèle configuré.
// Le rappel est placé du côté de l'utilisateur, et non dans le tour de
// l'assistant, pour que le modèle ne prenne pas l'habitude d'écrire ses
// questions en texte au lieu d'appeler l'outil.

/** Le texte d'un tour de l'assistant, tel que le modèle le relira. Jamais vide : l'API refuse un bloc texte vide. */
export function texteAssistantPourApi(contenu: string, question?: { question: string } | null): string {
  const propre = contenu.trim();
  if (propre) return propre;
  return question?.question ?? "(reponse vide)";
}

/** Le texte d'un message de l'utilisateur, précédé du rappel de la question à laquelle il répond. */
export function texteUtilisateurPourApi(
  contenu: string,
  questionPrecedente?: { question: string; options: { libelle: string }[]; choixMultiple: boolean } | null,
): string {
  if (!questionPrecedente) return contenu;
  const choix = questionPrecedente.options.map((o) => o.libelle).join(" ; ");
  const plusieurs = questionPrecedente.choixMultiple ? ", plusieurs possibles" : "";
  return `(Réponse à ta question « ${questionPrecedente.question} », choix proposés : ${choix}${plusieurs}.)\n${contenu}`;
}
