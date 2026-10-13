/**
 * Les conversations de l'assistant, gardées sur l'appareil.
 *
 * Elles vivent dans le navigateur et non sur le serveur : une conversation est
 * un brouillon de raisonnement, pas une pièce du dossier, et la garder côté
 * serveur demanderait une table, des routes et une politique de conservation
 * pour une matière que personne ne relit deux semaines plus tard. La
 * contrepartie est réelle et il faut la connaître : l'historique ne suit pas
 * d'un appareil à l'autre. Il ne survit pas non plus à la fin de la session
 * (session.ts) : sur une tablette partagée, le compte suivant ne doit pas lire
 * les questions du précédent.
 *
 * Les photos jointes ne sont pas gardées. Une image en base64 pèse plus que
 * tout le texte d'une conversation, et le quota du navigateur se compte en
 * quelques mégaoctets : les stocker ferait échouer l'enregistrement, donc
 * perdre aussi le texte. Elles restent le temps de la session.
 *
 * Les questions à choix de l'assistant, elles, sont gardées avec leur réponse :
 * quelques centaines d'octets, et sans elles, une conversation relue le
 * lendemain montrerait des réponses à des questions disparues. Elles sont
 * venues après les premières conversations : la lecture accepte donc des
 * messages qui n'en ont pas, et écarte une question mal formée sans perdre le
 * message qui la porte.
 */

import type { QuestionAssistant } from './api-types'

/** Ce que l'utilisateur a répondu : les options touchées, sa propre réponse, ou les deux en choix multiple. */
export interface ReponseQuestion {
  /** Les libellés choisis, dans l'ordre des options. */
  choix: string[]
  /** Ce qu'il a écrit au lieu de toucher une option, ou en plus en choix multiple. */
  autre?: string
}

export interface QuestionPosee extends QuestionAssistant {
  /** Absente tant que personne n'a répondu. */
  reponse?: ReponseQuestion
}

export interface MessageChat {
  role: 'user' | 'assistant'
  /** Vide seulement pour un tour de l'assistant réduit à sa question. */
  content: string
  /** Photos jointes, en data URL. Vivantes en mémoire seulement. */
  images?: string[]
  /** La question à choix posée à ce tour par l'assistant. */
  question?: QuestionPosee
}

export interface Conversation {
  id: string
  titre: string
  /** Horodatage de la dernière écriture, pour l'ordre de la liste. */
  modifieeLe: number
  messages: MessageChat[]
  /** Diagnostics rattachés, par identifiant. */
  diagnostics: string[]
}

const CLE = 'diagly.assistant.conversations'
/** Au delà, les plus anciennes sortent : le stockage du navigateur est borné. */
const MAXIMUM = 40

export const nouvelleConversation = (): Conversation => ({
  id: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
  titre: 'Nouvelle conversation',
  modifieeLe: Date.now(),
  messages: [],
  diagnostics: [],
})

/**
 * Le titre, tiré de la première question.
 *
 * Nommer soi-même ses conversations est une corvée que personne ne fait : la
 * première phrase dit déjà de quoi il s'agit.
 */
export function titreDepuis(texte: string): string {
  const propre = texte.replace(/\s+/g, ' ').trim()
  if (propre.length <= 48) return propre || 'Nouvelle conversation'
  const coupe = propre.slice(0, 48)
  const espace = coupe.lastIndexOf(' ')
  return `${espace > 24 ? coupe.slice(0, espace) : coupe}…`
}

// ------------------------------------------------------------- la relecture

type Brut = Record<string, unknown>
const estObjet = (v: unknown): v is Brut => !!v && typeof v === 'object' && !Array.isArray(v)
const nonNul = <T,>(v: T | null): v is T => v !== null

function lireReponse(brut: unknown): ReponseQuestion | undefined {
  if (!estObjet(brut) || !Array.isArray(brut.choix)) return undefined
  const choix = brut.choix.filter((c): c is string => typeof c === 'string')
  const autre = typeof brut.autre === 'string' && brut.autre.trim() ? brut.autre : undefined
  return autre ? { choix, autre } : { choix }
}

/** Une question relue du stockage, ou rien si elle ne peut pas s'afficher proprement. */
function lireQuestion(brut: unknown): QuestionPosee | undefined {
  if (!estObjet(brut)) return undefined
  const { question, etiquette, options, choixMultiple } = brut
  if (typeof question !== 'string' || !question.trim() || typeof etiquette !== 'string') return undefined
  if (typeof choixMultiple !== 'boolean' || !Array.isArray(options) || options.length < 2 || options.length > 4) return undefined
  const lues = options
    .map((o) => (estObjet(o) && typeof o.libelle === 'string' && o.libelle.trim() && typeof o.description === 'string'
      ? { libelle: o.libelle, description: o.description, ...(typeof o.recommande === 'boolean' ? { recommande: o.recommande } : {}) }
      : null))
    .filter(nonNul)
  if (lues.length !== options.length) return undefined
  const reponse = lireReponse(brut.reponse)
  return { question, etiquette, options: lues, choixMultiple, ...(reponse ? { reponse } : {}) }
}

function lireMessage(brut: unknown): MessageChat | null {
  if (!estObjet(brut) || (brut.role !== 'user' && brut.role !== 'assistant') || typeof brut.content !== 'string') return null
  const question = brut.role === 'assistant' ? lireQuestion(brut.question) : undefined
  // Un tour vide privé de sa question n'aurait rien à montrer, et le serveur le refuserait.
  if (!brut.content.trim() && !question) return null
  return question ? { role: brut.role, content: brut.content, question } : { role: brut.role, content: brut.content }
}

function lireConversation(brut: unknown): Conversation | null {
  if (!estObjet(brut) || typeof brut.id !== 'string') return null
  return {
    id: brut.id,
    titre: typeof brut.titre === 'string' && brut.titre ? brut.titre : 'Nouvelle conversation',
    modifieeLe: typeof brut.modifieeLe === 'number' ? brut.modifieeLe : 0,
    messages: Array.isArray(brut.messages) ? brut.messages.map(lireMessage).filter(nonNul) : [],
    diagnostics: Array.isArray(brut.diagnostics) ? brut.diagnostics.filter((d): d is string => typeof d === 'string') : [],
  }
}

/**
 * Relit les conversations de l'appareil.
 *
 * Chaque entrée est reconstruite champ par champ plutôt que crue sur parole :
 * le stockage a pu être écrit par une version plus ancienne de l'application,
 * et une question à moitié lisible ne doit pas empêcher la page de s'afficher.
 */
export function lireConversations(): Conversation[] {
  try {
    const brut = localStorage.getItem(CLE)
    const lu: unknown = brut ? JSON.parse(brut) : []
    if (!Array.isArray(lu)) return []
    return lu
      .map(lireConversation)
      .filter(nonNul)
      .sort((a, b) => b.modifieeLe - a.modifieeLe)
  } catch {
    return []
  }
}

/** Efface les conversations de l'appareil, à la fin d'une session. */
export function oublierConversations(): void {
  try {
    localStorage.removeItem(CLE)
  } catch {
    /* stockage indisponible : il n'y a rien à effacer */
  }
}

export function ecrireConversations(liste: Conversation[]) {
  try {
    const allegees = liste
      .slice()
      .sort((a, b) => b.modifieeLe - a.modifieeLe)
      .slice(0, MAXIMUM)
      // Le texte et les questions, pas les photos : voir l'en-tête de ce fichier.
      .map((c) => ({
        ...c,
        messages: c.messages.map(({ role, content, question }) => (question ? { role, content, question } : { role, content })),
      }))
    localStorage.setItem(CLE, JSON.stringify(allegees))
  } catch {
    /* quota atteint ou stockage refusé : la session continue sans mémoire */
  }
}

// ------------------------------------------------------------ les questions

/** Sans accents ni capitales : « facades » répond à l'option « Façades ». */
const plier = (texte: string) => texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/**
 * La réponse telle qu'elle part, en message de l'utilisateur : ce qu'il aurait
 * tapé lui-même. Le modèle la lit, et la conversation relue aussi.
 */
export function texteDeReponse(reponse: ReponseQuestion): string {
  const choix = reponse.choix.join(', ')
  const autre = reponse.autre?.trim() ?? ''
  if (choix && autre) return `${choix}. ${autre}`
  return choix || autre
}

/**
 * Une réponse tapée dans le champ du bas plutôt que touchée sur la carte.
 * Si elle reprend une option, la carte la montrera choisie ; sinon, c'est une
 * autre réponse.
 */
export function reponseDepuisTexte(question: QuestionAssistant, texte: string): ReponseQuestion {
  const propre = texte.trim()
  const trouver = (morceau: string) => question.options.find((o) => plier(o.libelle) === plier(morceau))
  const seule = trouver(propre)
  if (seule) return { choix: [seule.libelle] }
  if (question.choixMultiple) {
    const morceaux = propre.split(',').map((m) => m.trim()).filter(Boolean)
    const trouvees = morceaux.map(trouver)
    if (morceaux.length > 1 && trouvees.every(Boolean)) {
      return { choix: question.options.filter((o) => trouvees.includes(o)).map((o) => o.libelle) }
    }
  }
  return { choix: [], autre: propre }
}

/**
 * Ferme la question restée ouverte au bas du fil, au moment où un message de
 * l'utilisateur la suit.
 *
 * Qu'il touche une option ou qu'il tape dans le champ du bas, son message
 * suivant est la réponse : c'est ainsi que le serveur le présente au modèle.
 * La carte le montre donc aussi, et cesse d'être active.
 */
export function repondreDerniereQuestion(messages: MessageChat[], texte: string, reponse?: ReponseQuestion): MessageChat[] {
  const dernier = messages[messages.length - 1]
  if (!dernier || dernier.role !== 'assistant' || !dernier.question || dernier.question.reponse) return messages
  const donnee = reponse ?? reponseDepuisTexte(dernier.question, texte)
  return [...messages.slice(0, -1), { ...dernier, question: { ...dernier.question, reponse: donnee } }]
}

/** La question telle que le serveur l'attend dans l'historique : sans la réponse, qui suit en message. */
export function questionPourApi(q: QuestionPosee): QuestionAssistant {
  return { question: q.question, etiquette: q.etiquette, options: q.options, choixMultiple: q.choixMultiple }
}
