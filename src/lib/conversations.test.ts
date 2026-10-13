import { describe, it, expect, beforeEach } from 'vitest'
import {
  titreDepuis, nouvelleConversation, lireConversations, ecrireConversations, oublierConversations,
  texteDeReponse, reponseDepuisTexte, repondreDerniereQuestion, questionPourApi,
  type Conversation, type MessageChat, type QuestionPosee,
} from './conversations'

const stockage = () => {
  let data: Record<string, string> = {}
  return {
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => { data[k] = v },
    removeItem: (k: string) => { delete data[k] },
    clear: () => { data = {} },
  }
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: stockage(), configurable: true })
})

const conv = (patch: Partial<Conversation> = {}): Conversation => ({
  ...nouvelleConversation(),
  ...patch,
})

describe('titreDepuis', () => {
  it('prend la question telle quelle quand elle est courte', () => {
    expect(titreDepuis('Résume ce diagnostic')).toBe('Résume ce diagnostic')
  })

  it('coupe sur un mot entier et marque la coupe', () => {
    const t = titreDepuis('Explique-moi pourquoi la priorité de la toiture est passée en urgente cette année')
    expect(t.length).toBeLessThanOrEqual(49)
    expect(t.endsWith('…')).toBe(true)
    expect(t).not.toMatch(/\s…$/)
  })

  it('écrase les retours à la ligne', () => {
    expect(titreDepuis('Deux\n\nlignes')).toBe('Deux lignes')
  })

  it('donne un titre par défaut à une question vide', () => {
    expect(titreDepuis('   ')).toBe('Nouvelle conversation')
  })
})

describe('nouvelleConversation', () => {
  it('donne un identifiant différent à chaque fois', () => {
    const ids = new Set(Array.from({ length: 50 }, () => nouvelleConversation().id))
    expect(ids.size).toBe(50)
  })
})

describe('lecture et écriture', () => {
  it('rend une liste vide quand rien n’a été écrit', () => {
    expect(lireConversations()).toEqual([])
  })

  it('relit ce qui a été écrit, la plus récente d’abord', () => {
    ecrireConversations([
      conv({ id: 'a', titre: 'Ancienne', modifieeLe: 100 }),
      conv({ id: 'b', titre: 'Récente', modifieeLe: 900 }),
    ])
    expect(lireConversations().map((c) => c.id)).toEqual(['b', 'a'])
  })

  it('ne garde pas les photos : elles feraient sauter le quota', () => {
    ecrireConversations([conv({
      id: 'a',
      messages: [{ role: 'user', content: 'Regarde', images: ['data:image/png;base64,AAAA'] }],
    })])
    expect(lireConversations()[0].messages[0]).toEqual({ role: 'user', content: 'Regarde' })
  })

  it('ne garde que les quarante plus récentes', () => {
    ecrireConversations(Array.from({ length: 60 }, (_, i) => conv({ id: `c${i}`, modifieeLe: i })))
    const lues = lireConversations()
    expect(lues).toHaveLength(40)
    expect(lues[0].id).toBe('c59')
    expect(lues.some((c) => c.id === 'c0')).toBe(false)
  })

  it('survit à un contenu illisible', () => {
    localStorage.setItem('diagly.assistant.conversations', '{pas du json')
    expect(lireConversations()).toEqual([])
  })

  it('ignore les entrées qui n’ont pas la bonne forme', () => {
    localStorage.setItem('diagly.assistant.conversations', JSON.stringify([null, 42, { titre: 'sans id' }, { id: 'ok', titre: 'T', modifieeLe: 1, messages: [], diagnostics: [] }]))
    expect(lireConversations().map((c) => c.id)).toEqual(['ok'])
  })

  it('ne jette pas quand le stockage refuse d’écrire', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: { getItem: () => null, setItem: () => { throw new Error('quota') } },
      configurable: true,
    })
    expect(() => ecrireConversations([conv()])).not.toThrow()
  })
})

const question = (patch: Partial<QuestionPosee> = {}): QuestionPosee => ({
  question: 'Quel rapport voulez-vous envoyer à la régie ?',
  etiquette: 'Rapport',
  options: [
    { libelle: 'Rapport complet', description: 'Tous les éléments et le plan de travaux.', recommande: true },
    { libelle: 'Synthèse', description: 'Une page avec les priorités I.', recommande: false },
  ],
  choixMultiple: false,
  ...patch,
})

const ecrireBrut = (valeur: unknown) => localStorage.setItem('diagly.assistant.conversations', JSON.stringify(valeur))

describe('questions à choix gardées', () => {
  it('relit une conversation écrite avant les questions, sans rien y ajouter', () => {
    // Exactement ce qu'écrivait la version précédente.
    ecrireBrut([{
      id: 'ancienne',
      titre: 'Toiture',
      modifieeLe: 5,
      messages: [{ role: 'user', content: 'Résume' }, { role: 'assistant', content: 'Voici le résumé.' }],
      diagnostics: ['p1'],
    }])
    const [c] = lireConversations()
    expect(c.messages).toEqual([{ role: 'user', content: 'Résume' }, { role: 'assistant', content: 'Voici le résumé.' }])
    expect(c.messages.every((m) => !('question' in m))).toBe(true)
    expect(c.diagnostics).toEqual(['p1'])
  })

  it('garde la question et sa réponse à l’écriture, et les relit', () => {
    const q = question({ reponse: { choix: ['Synthèse'] } })
    ecrireConversations([conv({
      id: 'a',
      messages: [
        { role: 'user', content: 'Prépare le rapport' },
        { role: 'assistant', content: '', question: q },
        { role: 'user', content: 'Synthèse' },
      ],
    })])
    const relue = lireConversations()[0]
    expect(relue.messages[1]).toEqual({ role: 'assistant', content: '', question: q })
  })

  it('écarte une question mal formée sans perdre le message qui la porte', () => {
    ecrireBrut([{
      id: 'a', titre: 'T', modifieeLe: 1, diagnostics: [],
      messages: [
        { role: 'user', content: 'Prépare le rapport' },
        { role: 'assistant', content: 'Une précision.', question: { question: 'Lequel ?', etiquette: 'X', options: 'A ou B', choixMultiple: false } },
        { role: 'assistant', content: 'Encore.', question: { ...question(), options: [question().options[0]] } },
      ],
    }])
    const messages = lireConversations()[0].messages
    expect(messages.map((m) => m.content)).toEqual(['Prépare le rapport', 'Une précision.', 'Encore.'])
    expect(messages.some((m) => m.question)).toBe(false)
  })

  it('écarte un tour vide dont la question est illisible, et les messages sans forme', () => {
    ecrireBrut([{
      id: 'a', titre: 'T', modifieeLe: 1, diagnostics: [],
      messages: [
        { role: 'user', content: 'Bonjour' },
        { role: 'assistant', content: '', question: { question: '' } },
        null,
        { role: 'systeme', content: 'x' },
        { role: 'user' },
      ],
    }])
    expect(lireConversations()[0].messages).toEqual([{ role: 'user', content: 'Bonjour' }])
  })

  it('ignore une réponse mal formée mais garde la question, encore active', () => {
    ecrireBrut([{
      id: 'a', titre: 'T', modifieeLe: 1, diagnostics: [],
      messages: [{ role: 'assistant', content: '', question: { ...question(), reponse: 'Synthèse' } }],
    }])
    const q = lireConversations()[0].messages[0].question
    expect(q?.etiquette).toBe('Rapport')
    expect(q?.reponse).toBeUndefined()
  })

  it('complète une conversation à qui il manque des champs', () => {
    ecrireBrut([{ id: 'nue' }])
    expect(lireConversations()).toEqual([{ id: 'nue', titre: 'Nouvelle conversation', modifieeLe: 0, messages: [], diagnostics: [] }])
  })
})

describe('répondre à une question', () => {
  it('écrit la réponse comme l’utilisateur l’aurait tapée', () => {
    expect(texteDeReponse({ choix: ['Rapport complet'] })).toBe('Rapport complet')
    expect(texteDeReponse({ choix: ['Toiture', 'Façades'] })).toBe('Toiture, Façades')
    expect(texteDeReponse({ choix: [], autre: '  Les deux, en commençant par la synthèse  ' })).toBe('Les deux, en commençant par la synthèse')
    expect(texteDeReponse({ choix: ['Toiture'], autre: 'Et la cave' })).toBe('Toiture. Et la cave')
  })

  it('reconnaît une option tapée dans le champ du bas, aux accents et capitales près', () => {
    expect(reponseDepuisTexte(question(), 'synthese')).toEqual({ choix: ['Synthèse'] })
    expect(reponseDepuisTexte(question(), 'Plutôt un courriel')).toEqual({ choix: [], autre: 'Plutôt un courriel' })
  })

  it('reconnaît plusieurs options tapées, en choix multiple seulement', () => {
    const multiple = question({ choixMultiple: true })
    expect(reponseDepuisTexte(multiple, 'synthèse, rapport complet')).toEqual({ choix: ['Rapport complet', 'Synthèse'] })
    expect(reponseDepuisTexte(question(), 'synthèse, rapport complet').autre).toBe('synthèse, rapport complet')
  })

  it('ferme la dernière question, avec la réponse donnée ou déduite du texte', () => {
    const fil: MessageChat[] = [{ role: 'user', content: 'Prépare' }, { role: 'assistant', content: '', question: question() }]
    expect(repondreDerniereQuestion(fil, 'Synthèse', { choix: ['Synthèse'] })[1].question?.reponse).toEqual({ choix: ['Synthèse'] })
    expect(repondreDerniereQuestion(fil, 'Autre chose')[1].question?.reponse).toEqual({ choix: [], autre: 'Autre chose' })
    // La conversation d'origine n'est pas modifiée : React compare les références.
    expect(fil[1].question?.reponse).toBeUndefined()
  })

  it('ne touche ni une question déjà répondue ni une question qui n’est plus au bas du fil', () => {
    const repondue: MessageChat[] = [{ role: 'assistant', content: '', question: question({ reponse: { choix: ['Synthèse'] } }) }]
    expect(repondreDerniereQuestion(repondue, 'Rapport complet')).toBe(repondue)
    const depassee: MessageChat[] = [{ role: 'assistant', content: '', question: question() }, { role: 'user', content: 'Synthèse' }]
    expect(repondreDerniereQuestion(depassee, 'Encore')).toBe(depassee)
  })

  it('renvoie la question au serveur sans la réponse', () => {
    expect(questionPourApi(question({ reponse: { choix: ['Synthèse'] } }))).not.toHaveProperty('reponse')
  })
})

describe('fin de session', () => {
  it('efface les conversations : le compte suivant ne les retrouve pas', () => {
    ecrireConversations([conv({ id: 'a', titre: 'Toiture rue du Lac' })])
    oublierConversations()
    expect(lireConversations()).toEqual([])
  })

  it('ne jette pas quand le stockage est indisponible', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: { removeItem: () => { throw new Error('refusé') } },
      configurable: true,
    })
    expect(() => oublierConversations()).not.toThrow()
  })
})
