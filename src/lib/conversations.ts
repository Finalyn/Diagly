/**
 * Les conversations de l'assistant, gardées sur l'appareil.
 *
 * Elles vivent dans le navigateur et non sur le serveur : une conversation est
 * un brouillon de raisonnement, pas une pièce du dossier, et la garder côté
 * serveur demanderait une table, des routes et une politique de conservation
 * pour une matière que personne ne relit deux semaines plus tard. La
 * contrepartie est réelle et il faut la connaître : l'historique ne suit pas
 * d'un appareil à l'autre.
 *
 * Les photos jointes ne sont pas gardées. Une image en base64 pèse plus que
 * tout le texte d'une conversation, et le quota du navigateur se compte en
 * quelques mégaoctets : les stocker ferait échouer l'enregistrement, donc
 * perdre aussi le texte. Elles restent le temps de la session.
 */

export interface MessageChat {
  role: 'user' | 'assistant'
  content: string
  /** Photos jointes, en data URL. Vivantes en mémoire seulement. */
  images?: string[]
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

export function lireConversations(): Conversation[] {
  try {
    const brut = localStorage.getItem(CLE)
    const lu: unknown = brut ? JSON.parse(brut) : []
    if (!Array.isArray(lu)) return []
    return lu
      .filter((c): c is Conversation => !!c && typeof c === 'object' && typeof (c as Conversation).id === 'string')
      .sort((a, b) => b.modifieeLe - a.modifieeLe)
  } catch {
    return []
  }
}

export function ecrireConversations(liste: Conversation[]) {
  try {
    const allegees = liste
      .slice()
      .sort((a, b) => b.modifieeLe - a.modifieeLe)
      .slice(0, MAXIMUM)
      // Le texte seulement : voir l'en-tête de ce fichier.
      .map((c) => ({ ...c, messages: c.messages.map(({ role, content }) => ({ role, content })) }))
    localStorage.setItem(CLE, JSON.stringify(allegees))
  } catch {
    /* quota atteint ou stockage refusé : la session continue sans mémoire */
  }
}
