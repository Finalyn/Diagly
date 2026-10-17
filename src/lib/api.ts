import { useAuth } from '@/stores/auth'
import { estAppNative } from '@/lib/plateforme'
import { avecSaisiesEnAttente } from '@/lib/hors-ligne/etat'
import type {
  ApiCatalogItem, ApiCfcEntry, ApiDiagnostic, ApiDiagnosticItem,
  ApiProject, ApiOperation, ApiPlan, ApiEvent, AuthResponse,
  ApiVariant, ApiVariantLine, ElementState,
  ApiArticle, ApiArticleEcrit, ApiBaseCfc, ApiModificationArticle, ApiNoeudCfc, ApiPosteAutomatique,
  ApiNotification, CanauxDisponibles,
} from './api-types'

// En prod, l'app est servie par le même domaine que l'API -> requêtes same-origin
// (BASE_URL vide = chemins relatifs /api...). En dev local (localhost), on vise le
// backend sur :4000. VITE_API_URL, si défini au build, reste prioritaire.
// L'app iPhone/iPad est servie depuis capacitor://localhost : son nom d'hôte est
// « localhost », il faut donc la reconnaître avant le test du dev local, sans quoi
// elle chercherait l'API sur le téléphone lui-même.
export const BASE_URL =
  import.meta.env.VITE_API_URL ??
  (estAppNative
    ? 'https://diagly.ch'
    : typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)
      ? 'http://localhost:4000'
      : '')

export class ApiError extends Error {
  status: number
  details?: unknown
  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

let refreshing: Promise<string | null> | null = null
/** Après un échec passager du rafraîchissement, pas de nouvel essai avant cette heure. */
let rafraichirPasAvant = 0
const PAUSE_APRES_ECHEC_MS = 5_000

async function refreshAccessToken(): Promise<string | null> {
  if (refreshing) return refreshing
  const refreshToken = useAuth.getState().refreshToken
  if (!refreshToken) return null
  if (Date.now() < rafraichirPasAvant) return null

  refreshing = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })
      if (res.status === 401) {
        // Le serveur refuse ce jeton (expiré, révoqué, inconnu) : session
        // définitivement perdue, on efface aussi les données en cache local.
        // Import dynamique : évite un cycle d'import entre api.ts et session.ts.
        void import('./session').then((m) => m.purgeLocalSession())
        return null
      }
      if (!res.ok) {
        // 502 pendant une mise en ligne, 429, page d'erreur d'un intermédiaire :
        // rien ne dit que la session est perdue. Purger ici effaçait le cache
        // du terrain pour une simple coupure. On la garde et on retentera.
        rafraichirPasAvant = Date.now() + PAUSE_APRES_ECHEC_MS
        return null
      }
      const data = (await res.json()) as AuthResponse
      useAuth.getState().setAuth(data.user, data.accessToken, data.refreshToken)
      return data.accessToken
    } catch {
      // Échec réseau : la session peut encore être valide (mode hors-ligne), on ne
      // purge rien, on se contente de ne pas rejouer la requête. Si la rotation a
      // eu lieu sans que la réponse arrive, le serveur tolère l'ancien jeton une
      // minute (server/src/lib/rotation-session.ts).
      rafraichirPasAvant = Date.now() + PAUSE_APRES_ECHEC_MS
      return null
    } finally {
      refreshing = null
    }
  })()

  return refreshing
}

interface RequestOpts {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  query?: Record<string, string | number | undefined>
  /** Si false : ne tente pas le refresh automatique sur 401 (utile pour /auth/login). */
  withAuth?: boolean
}

async function request<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  const { method = 'GET', body, query, withAuth = true } = opts

  const qs = query
    ? '?' + new URLSearchParams(
        Object.entries(query)
          .filter(([, v]) => v !== undefined && v !== '')
          .map(([k, v]) => [k, String(v)])
      ).toString()
    : ''

  const doFetch = async (token: string | null) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (withAuth && token) headers.Authorization = `Bearer ${token}`
    return fetch(`${BASE_URL}${path}${qs}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  }

  let res = await doFetch(useAuth.getState().accessToken)

  if (res.status === 401 && withAuth) {
    const newToken = await refreshAccessToken()
    if (newToken) {
      res = await doFetch(newToken)
    }
  }

  if (res.status === 204) return undefined as T

  const text = await res.text()
  const data = text ? JSON.parse(text) : null

  if (!res.ok) {
    const message = (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string')
      ? data.error
      : `HTTP ${res.status}`
    throw new ApiError(res.status, message, data?.details)
  }

  return data as T
}

/** Comme request(), mais renvoie un fichier binaire (Blob) + son nom — pour les téléchargements authentifiés. */
/** L'étape du code, après le mot de passe : application (totp) ou code envoyé par email. */
export interface EtapeDoubleAuth {
  twoFactorRequired: true
  ticket: string
  method?: 'totp' | 'email'
  /** Adresse masquée où le code est parti (méthode email). */
  email?: string
}

/** Envoi d'un fichier en multipart (champ « file »), réponse JSON. */
async function envoyerFichier<T>(path: string, file: File): Promise<T> {
  const fd = new FormData()
  fd.append('file', file)
  return envoyerFormulaire<T>(path, fd)
}

/** Plusieurs fichiers d'un coup, sous le champ « files » (un jeu de plans). */
async function envoyerFichiers<T>(path: string, files: File[]): Promise<T> {
  const fd = new FormData()
  for (const f of files) fd.append('files', f)
  return envoyerFormulaire<T>(path, fd)
}

/**
 * Un formulaire de fichiers. Une session expirée pendant que l'écran restait
 * ouvert se renouvelle une fois, puis l'envoi repart : le diagnostiqueur qui a
 * choisi ses plans n'a pas à les choisir de nouveau.
 */
async function envoyerFormulaire<T>(path: string, fd: FormData): Promise<T> {
  const envoyer = (token: string | null) =>
    fetch(`${BASE_URL}${path}`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd })
  let res = await envoyer(useAuth.getState().accessToken)
  if (res.status === 401) {
    const t = await refreshAccessToken()
    if (t) res = await envoyer(t)
  }
  const text = await res.text()
  let data: { error?: string; details?: unknown } | null = null
  try { data = text ? JSON.parse(text) : null } catch { /* réponse non JSON */ }
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `HTTP ${res.status}`, data?.details)
  return data as T
}

async function requestBlob(path: string, opts: { method?: 'GET' | 'POST'; body?: unknown } = {}): Promise<{ blob: Blob; filename: string }> {
  const { method = 'GET', body } = opts
  const doFetch = (token: string | null) => {
    const headers: Record<string, string> = {}
    if (token) headers.Authorization = `Bearer ${token}`
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    return fetch(`${BASE_URL}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined })
  }
  let res = await doFetch(useAuth.getState().accessToken)
  if (res.status === 401) {
    const t = await refreshAccessToken()
    if (t) res = await doFetch(t)
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new ApiError(res.status, txt || `HTTP ${res.status}`)
  }
  const cd = res.headers.get('Content-Disposition') ?? ''
  const m = cd.match(/filename="?([^"]+)"?/)
  return { blob: await res.blob(), filename: m?.[1] ?? 'export' }
}

/** Déclenche le téléchargement d'un Blob dans le navigateur. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Ce qu'on peut écrire d'un plan. */
export interface CorpsMajPlan {
  name?: string
  scalePxPerM?: number | null
  annotations?: unknown[]
  feuilles?: import('./api-types').FeuillesPlan | null
  /** Remplace les propositions de l'IA en attente sur ces pages (voir server/src/lib/feuilles-plans.ts). */
  propositions?: { pages: number[]; annotations: unknown[] }
}

/** Les pages rendues d'un plan, et les ouvrages du relevé, pour l'analyse par l'IA. */
export interface EnvoiAnalyse {
  pages: { image: Blob; numero: number; largeurPt: number | null; hauteurPt: number | null }[]
  ouvrages: { id: string; cfcCode: string | null; libelle: string; unite: string | null }[]
}

export type ResultatAnalyseServeur = {
  configured: boolean
  tronque?: boolean
  refus?: boolean
  analyse?: import('./api-types').AnalysePlan | null
}

// ---------------- API surface ----------------

export const api = {
  auth: {
    register: (body: { email: string; password: string; firstName?: string; lastName?: string; companyName?: string; phone?: string }) =>
      request<AuthResponse>('/api/auth/register', { method: 'POST', body, withAuth: false }),
    // Login : renvoie soit les tokens, soit une demande de code 2FA (ticket).
    login: (body: { email: string; password: string }) =>
      request<AuthResponse | EtapeDoubleAuth>('/api/auth/login', { method: 'POST', body, withAuth: false }),
    // « Se connecter avec Apple » depuis l'app iPhone/iPad : le jeton d'identité
    // remis par iOS, vérifié par le serveur auprès d'Apple.
    apple: (body: { identityToken: string; authorizationCode?: string; firstName?: string; lastName?: string }) =>
      request<AuthResponse | EtapeDoubleAuth>('/api/auth/apple', { method: 'POST', body, withAuth: false }),
    // Google depuis l'app iPhone/iPad : le code reçu au retour, échangé avec le
    // secret que l'app a gardé (PKCE). Rend la session, ou l'étape du code 2FA.
    echangeApp: (body: { code: string; verifier: string }) =>
      request<AuthResponse | EtapeDoubleAuth>('/api/auth/app/echange', { method: 'POST', body, withAuth: false }),
    // Les connexions que le site peut proposer (Apple, Google), selon la configuration du serveur.
    fournisseurs: () =>
      request<{ google: boolean; apple: boolean }>('/api/auth/fournisseurs', { withAuth: false }),
    // Suppression du compte par son titulaire (exigée par Apple, et due au titre de la nLPD).
    supprimerCompte: () =>
      request<void>('/api/auth/compte/supprimer', { method: 'POST', body: { confirmation: 'SUPPRIMER' } }),
    // Étape 2 : vérifie le code de l'app d'authentification.
    twoFactorVerify: (body: { ticket: string; code: string }) =>
      request<AuthResponse>('/api/auth/2fa/verify', { method: 'POST', body, withAuth: false }),
    // Configuration 2FA (utilisateur connecté).
    twoFactorSetup: () =>
      request<{ otpauth: string; qr: string; secret: string }>('/api/auth/2fa/setup', { method: 'POST' }),
    twoFactorEnable: (code: string) =>
      request<{ enabled: boolean }>('/api/auth/2fa/enable', { method: 'POST', body: { code } }),
    // Code par email : renvoi à la connexion, méthodes proposables, confirmation.
    twoFactorResend: (ticket: string) =>
      request<EtapeDoubleAuth>('/api/auth/2fa/resend', { method: 'POST', body: { ticket }, withAuth: false }),
    twoFactorOptions: () => request<{ email: boolean; adresse: string | null }>('/api/auth/2fa/options'),
    twoFactorEmailCode: () =>
      request<{ ticket: string; email: string }>('/api/auth/2fa/email/code', { method: 'POST' }),
    twoFactorEmailEnable: (ticket: string, code: string) =>
      request<{ enabled: boolean; method: string }>('/api/auth/2fa/email/enable', { method: 'POST', body: { ticket, code } }),
    twoFactorDisable: (code: string, ticket?: string) =>
      request<{ enabled: boolean }>('/api/auth/2fa/disable', { method: 'POST', body: { code, ticket } }),
    me: () => request<{ user: import('./api-types').ApiUser }>('/api/auth/me'),
    updateProfile: (body: { firstName?: string | null; lastName?: string | null; companyName?: string | null; phone?: string | null }) =>
      request<{ user: import('./api-types').ApiUser }>('/api/auth/me', { method: 'PUT', body }),
    updatePreferences: (body: Partial<import('./api-types').UserPreferences>) =>
      request<{ user: import('./api-types').ApiUser }>('/api/auth/preferences', { method: 'PUT', body }),
    changePassword: (body: { currentPassword: string; newPassword: string }) =>
      request<{ ok: boolean }>('/api/auth/change-password', { method: 'POST', body }),
    logout: (refreshToken: string) =>
      request<void>('/api/auth/logout', { method: 'POST', body: { refreshToken }, withAuth: false }),
    // Mot de passe oublié : réponse toujours identique, que l'adresse existe ou non.
    forgotPassword: (email: string) =>
      request<{ ok: boolean; mailConfigured: boolean }>('/api/auth/forgot-password', { method: 'POST', body: { email }, withAuth: false }),
    resetPassword: (body: { token: string; password: string }) =>
      request<{ ok: boolean }>('/api/auth/reset-password', { method: 'POST', body, withAuth: false }),
  },

  cfc: {
    catalog: (q?: { level?: number; parent?: string; search?: string }) =>
      request<{ entries: ApiCfcEntry[]; count: number }>('/api/cfc/catalog', { query: q }),
    catalogEntry: (code: string) =>
      request<{ entry: ApiCfcEntry }>(`/api/cfc/catalog/${encodeURIComponent(code)}`),
    items: (q?: { category?: string; cfc?: string; search?: string }) =>
      request<{ items: ApiCatalogItem[]; count: number }>('/api/cfc/items', { query: q }),
    item: (id: number) =>
      request<{ item: ApiCatalogItem }>(`/api/cfc/items/${id}`),
    categories: () =>
      request<{ categories: string[] }>('/api/cfc/categories'),
    createItem: (body: Partial<ApiCatalogItem>) =>
      request<{ item: ApiCatalogItem }>('/api/cfc/items', { method: 'POST', body }),
    updateItem: (id: number, body: Partial<ApiCatalogItem>) =>
      request<{ item: ApiCatalogItem }>(`/api/cfc/items/${id}`, { method: 'PUT', body }),
    deleteItem: (id: number) =>
      request<void>(`/api/cfc/items/${id}`, { method: 'DELETE' }),
    // Reinitialise tout le catalogue de l'utilisateur au defaut (supprime ses personnalisations).
    resetToDefault: () =>
      request<{ reset: number }>('/api/cfc/items/reset', { method: 'POST' }),
    /** La base v3 entière : articles, états, étapes de visite, postes automatiques. */
    base: () => request<ApiBaseCfc>('/api/cfc/base'),
    /** La nomenclature CFC, servie à part car le diagnostic n'en a pas besoin. */
    baseNomenclature: () =>
      request<{ noeuds: ApiNoeudCfc[]; count: number }>('/api/cfc/base/nomenclature'),
    /** Les modifications d'un article, la plus récente d'abord. */
    historique: (id: string) =>
      request<{ lignes: ApiModificationArticle[]; count: number }>(
        `/api/cfc/base/articles/${encodeURIComponent(id)}/historique`),
    /** Modifie un article de la base commune. Réservé aux responsables. */
    updateArticle: (id: string, body: Partial<ApiArticleEcrit>) =>
      request<{ article: ApiArticle; modifications: number }>(
        `/api/cfc/base/articles/${encodeURIComponent(id)}`, { method: 'PUT', body }),
    /** Crée un article dans la base commune. */
    createArticle: (body: ApiArticleEcrit & { id: string }) =>
      request<{ article: ApiArticle }>('/api/cfc/base/articles', { method: 'POST', body }),
    /** Modifie un poste automatique : son prix vaut pour tous les devis suivants. */
    updatePoste: (code: string, body: { libelle?: string; prix?: number; remarque?: string | null }) =>
      request<{ poste: ApiPosteAutomatique }>(
        `/api/cfc/base/postes/${encodeURIComponent(code)}`, { method: 'PUT', body }),
  },

  projects: {
    list: () => request<{ projects: ApiProject[]; count: number }>('/api/projects'),
    get: (id: string) =>
      request<{ project: ApiProject; diagnostics: ApiDiagnostic[] }>(`/api/projects/${id}`),
    create: (body: Partial<ApiProject>) =>
      request<{ project: ApiProject }>('/api/projects', { method: 'POST', body }),
    update: (id: string, body: Partial<ApiProject>) =>
      request<{ project: ApiProject }>(`/api/projects/${id}`, { method: 'PUT', body }),
    delete: (id: string) => request<void>(`/api/projects/${id}`, { method: 'DELETE' }),
    diagnostics: (projectId: string) =>
      request<{ diagnostics: ApiDiagnostic[]; count: number }>(`/api/projects/${projectId}/diagnostics`),
    createDiagnostic: (projectId: string, body: { visitDate?: string; notes?: string }) =>
      request<{ diagnostic: ApiDiagnostic }>(`/api/projects/${projectId}/diagnostics`, { method: 'POST', body }),
    enableShare: (id: string) =>
      request<{ token: string }>(`/api/projects/${id}/share`, { method: 'POST' }),
    disableShare: (id: string) =>
      request<void>(`/api/projects/${id}/share`, { method: 'DELETE' }),
  },

  // Rapport public en lecture seule (aucune auth requise).
  share: {
    get: (token: string) =>
      request<import('./api-types').PublicReport>(`/api/share/${token}`, { withAuth: false }),
  },

  push: {
    vapid: () => request<{ publicKey: string | null; enabled: boolean; ios?: boolean }>('/api/push/vapid', { withAuth: false }),
    // App iPhone/iPad : le jeton APNs de l'appareil.
    appareil: (jeton: string) => request<void>('/api/push/appareil', { method: 'POST', body: { jeton } }),
    retirerAppareil: (jeton: string) => request<void>('/api/push/appareil/retirer', { method: 'POST', body: { jeton } }),
    subscribe: (sub: PushSubscriptionJSON) => request<{ id: string }>('/api/push/subscribe', { method: 'POST', body: sub }),
    unsubscribe: (endpoint: string) => request<void>('/api/push/unsubscribe', { method: 'POST', body: { endpoint } }),
    test: () => request<{ sent: number }>('/api/push/test', { method: 'POST' }),
  },

  operations: {
    list: () => request<{ operations: ApiOperation[]; count: number }>('/api/operations'),
    get: (id: string) =>
      request<{ operation: ApiOperation; projects: ApiProject[] }>(`/api/operations/${id}`),
    create: (body: { name: string; clientName?: string; aggregationMode?: import('./api-types').AggregationMode }) =>
      request<{ operation: ApiOperation }>('/api/operations', { method: 'POST', body }),
    update: (id: string, body: Partial<Pick<ApiOperation, 'name' | 'clientName' | 'aggregationMode' | 'status'>>) =>
      request<{ operation: ApiOperation }>(`/api/operations/${id}`, { method: 'PUT', body }),
    delete: (id: string) => request<void>(`/api/operations/${id}`, { method: 'DELETE' }),
  },

  plans: {
    list: (projectId: string) =>
      request<{ plans: ApiPlan[]; count: number }>('/api/plans', { query: { projectId } }),
    upload: async (projectId: string, file: File, name?: string): Promise<{ plan: ApiPlan }> => {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('projectId', projectId)
      if (name) fd.append('name', name)
      const token = useAuth.getState().accessToken
      const res = await fetch(`${BASE_URL}/api/plans`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      })
      const text = await res.text()
      const data = text ? JSON.parse(text) : null
      if (!res.ok) throw new ApiError(res.status, data?.error ?? `HTTP ${res.status}`, data?.details)
      return data
    },
    update: (id: string, body: CorpsMajPlan) =>
      request<{ plan: ApiPlan }>(`/api/plans/${id}`, { method: 'PUT', body }),
    delete: (id: string) => request<void>(`/api/plans/${id}`, { method: 'DELETE' }),
    /** Les métrés du compte : un par dossier qui a des plans, sans les annotations. */
    metres: () => request<{ metres: import('./api-types').ApiMetre[]; count: number }>('/api/plans/metres'),
    /**
     * Analyse du plan par l'IA : échelle, cote de contrôle, zones à valider.
     *
     * Les pages partent déjà rendues en image, avec la taille de leur feuille
     * et les ouvrages du relevé. L'analyse se fait en tâche de fond côté
     * serveur (une à trois minutes), comme la lecture des plans : l'envoi rend
     * un numéro, puis on demande toutes les 3 s où elle en est. Un signal
     * abandonné l'arrête côté serveur aussi.
     */
    analyser: async (planId: string, envoi: EnvoiAnalyse, signal?: AbortSignal): Promise<ResultatAnalyseServeur> => {
      const depart = await api.plans.lancerAnalyse(planId, envoi)
      if (!depart.enCours) return depart
      return api.plans.suivreAnalyse(planId, depart.enCours, { signal, arreterAuServeur: true })
    },
    /**
     * Le départ seul : rend le numéro de la tâche de fond. L'outil Métrés le
     * garde avec la feuille, pour reprendre le résultat si l'onglet se ferme
     * avant la fin.
     */
    lancerAnalyse: (planId: string, envoi: EnvoiAnalyse) => {
      const fd = new FormData()
      fd.append('donnees', JSON.stringify({
        pages: envoi.pages.map(({ numero, largeurPt, hauteurPt }) => ({ numero, largeurPt, hauteurPt })),
        ouvrages: envoi.ouvrages,
      }))
      for (const p of envoi.pages) fd.append('pages', p.image, `page-${p.numero}.${p.image.type === 'image/jpeg' ? 'jpg' : 'png'}`)
      return envoyerFormulaire<ResultatAnalyseServeur & { enCours?: string }>(`/api/plans/${planId}/analyse`, fd)
    },
    /**
     * Le suivi d'une tâche lancée, toutes les 3 s jusqu'à ce qu'elle soit prête.
     *
     * `arreterAuServeur` : un signal abandonné arrête aussi la tâche côté
     * serveur. L'éditeur le veut (fermer l'éditeur, c'est renoncer) ; l'outil
     * Métrés non, quand on quitte l'écran : la tâche continue et son résultat
     * se reprend au retour.
     */
    suivreAnalyse: async (
      planId: string, tache: string, options: { signal?: AbortSignal; arreterAuServeur?: boolean } = {},
    ): Promise<ResultatAnalyseServeur> => {
      const { signal, arreterAuServeur = false } = options
      const arreter = () => { if (arreterAuServeur) api.plans.arreterAnalyse(planId, tache) }
      if (signal?.aborted) { arreter(); throw new DOMException('Analyse abandonnée', 'AbortError') }
      signal?.addEventListener('abort', arreter, { once: true })
      try {
        const limite = Date.now() + 15 * 60_000
        while (Date.now() < limite) {
          await new Promise((r) => setTimeout(r, 3000))
          if (signal?.aborted) throw new DOMException('Analyse abandonnée', 'AbortError')
          const etat = await request<ResultatAnalyseServeur & { etat: 'en_cours' | 'prete' }>(`/api/plans/${planId}/analyse/${tache}`)
          if (etat.etat === 'prete') return etat
        }
        api.plans.arreterAnalyse(planId, tache)
        throw new Error('L’analyse prend trop de temps. Réessayez avec une seule page.')
      } finally {
        signal?.removeEventListener('abort', arreter)
      }
    },
    /** La tâche lancée sur ce plan et pas encore réclamée, si le serveur en tient une. */
    tacheEnCours: (planId: string) => request<{ enCours: string | null }>(`/api/plans/${planId}/analyse`),
    arreterAnalyse: (planId: string, tache: string) => {
      void request(`/api/plans/${planId}/analyse/${tache}`, { method: 'DELETE' }).catch(() => undefined)
    },
    // Le serveur signe l'accès au fichier : on ne reconstruit plus l'URL à partir du
    // nom, sinon le téléchargement est refusé (403).
    fileUrl: (plan: ApiPlan) => `${BASE_URL}${plan.fileUrl}`,
  },

  assistant: {
    chat: (body: {
      messages: {
        role: 'user' | 'assistant'
        /** Vide seulement pour un tour de l'assistant réduit à sa question à choix. */
        content: string
        images?: string[]
        /** La question posée à ce tour : le serveur la rappelle au modèle avec la réponse qui suit. */
        question?: import('./api-types').QuestionAssistant
      }[]
      projectId?: string
      /** Diagnostics rattachés : le premier est lu en détail, les suivants en résumé. */
      projectIds?: string[]
      /** Ce client sait afficher les questions à choix : sans ce drapeau, l'assistant n'en pose pas. */
      questionsAChoix?: boolean
    }) =>
      request<{
        /** Le texte de la réponse. Vide quand l'assistant n'a fait que poser sa question. */
        reply: string
        configured: boolean
        question?: import('./api-types').QuestionAssistant
      }>('/api/assistant/chat', { method: 'POST', body }),
    vision: (body: { images: string[]; cfcCode?: string; cfcLabel?: string; projectId?: string }) =>
      request<{ configured: boolean; analysis: import('./api-types').GuideAnalysis | null }>('/api/assistant/vision', { method: 'POST', body }),
    // Répondre à l'analyse : conversation de suivi (photos + analyse + contexte) → réponse texte.
    analysisChat: (body: {
      images: string[]; cfcCode?: string; cfcLabel?: string; projectId?: string
      analysis?: import('./api-types').GuideAnalysis | null
      messages: { role: 'user' | 'assistant'; content: string }[]
    }) => request<{ configured: boolean; reply: string }>('/api/assistant/analysis-chat', { method: 'POST', body }),
    // Import d'un certificat énergétique (PDF) : lecture → extraction structurée à valider.
    certificateImport: async (projectId: string, file: File): Promise<{ configured: boolean; extraction: import('./api-types').CecbExtraction | null }> => {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('projectId', projectId)
      const token = useAuth.getState().accessToken
      const res = await fetch(`${BASE_URL}/api/assistant/cecb-import`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      })
      const text = await res.text()
      const data = text ? JSON.parse(text) : null
      if (!res.ok) throw new ApiError(res.status, data?.error ?? `HTTP ${res.status}`, data?.details)
      return data
    },
  },

  geo: {
    // Affectation précise (RDPPF/ÖREB cantonal) — via le backend (pas de CORS côté service).
    affectation: (east: number, north: number, canton: string, egrid?: string | null) =>
      request<{ supported: boolean; egrid?: string | null; affectation?: string | null; affectations?: string[]; noise?: string | null; restrictions?: { theme: string; legend: string }[] }>(
        '/api/geo/affectation', { query: { east, north, canton, egrid: egrid ?? undefined } }),
  },

  market: {
    // Coefficient d'indexation des prix sur le marché suisse (indice OFS des prix de la construction).
    index: () =>
      request<{ coeff: number; base: number; index: number; indexDate: string; source: string }>('/api/market/index'),
  },

  export: {
    // Modèle standard livré par défaut (base éditable).
    defaultTemplate: () =>
      request<{ template: import('./api-types').ExportTemplate }>('/api/export/default-template'),
    // Aperçu / payload canonique (= futur endpoint API).
    getJson: (projectId: string) =>
      request<import('./api-types').DiagnosticExportPayload>(`/api/export/projects/${projectId}`, { query: { format: 'json' } }),
    // Téléchargement authentifié (CSV/XLSX) avec modèle en ligne (édition non enregistrée).
    download: (
      projectId: string,
      opts: { format: 'csv' | 'xlsx'; template?: import('./api-types').ExportTemplate; sheet?: string },
    ) =>
      requestBlob(`/api/export/projects/${projectId}`, {
        method: 'POST',
        body: { format: opts.format, template: opts.template, sheet: opts.sheet },
      }),
    // Le métré d'un jeu de plans, calculé dans le navigateur, mis en classeur par le serveur.
    metres: (projectId: string, metre: import('./plans/export-metres').ExportMetres) =>
      requestBlob(`/api/export/metres/${projectId}`, { method: 'POST', body: metre }),
  },

  support: {
    createTicket: (body: { subject: string; category?: string; body: string; attachments?: string[] }) =>
      request<{ ticket: import('./api-types').SupportTicket; emailSent: boolean }>('/api/support/tickets', { method: 'POST', body }),
    tickets: () => request<{ tickets: import('./api-types').SupportTicket[] }>('/api/support/tickets'),
    ticket: (id: string) => request<{ ticket: import('./api-types').SupportTicketDetail }>(`/api/support/tickets/${id}`),
    reply: (id: string, body: { body: string; attachments?: string[] }) =>
      request<{ message: import('./api-types').SupportMessage }>(`/api/support/tickets/${id}/messages`, { method: 'POST', body }),
    uploadAttachment: async (file: File): Promise<{ url: string }> => {
      const fd = new FormData()
      fd.append('file', file)
      const token = useAuth.getState().accessToken
      const res = await fetch(`${BASE_URL}/api/support/attachments`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd })
      const text = await res.text()
      const data = text ? JSON.parse(text) : null
      if (!res.ok) throw new ApiError(res.status, data?.error ?? `HTTP ${res.status}`, data?.details)
      return data
    },
    attachmentUrl: (url: string) => (url.startsWith('http') ? url : `${BASE_URL}${url}`),
  },

  org: {
    get: () => request<{ organization: import('./api-types').Organization | null; role: import('./api-types').OrgRole | null }>('/api/org'),
    create: (name: string) => request<{ organization: import('./api-types').Organization; role: import('./api-types').OrgRole }>('/api/org', { method: 'POST', body: { name } }),
    rename: (name: string) => request<{ organization: import('./api-types').Organization; role: import('./api-types').OrgRole }>('/api/org', { method: 'PUT', body: { name } }),
    members: () => request<{ members: import('./api-types').OrgMember[] }>('/api/org/members'),
    setRole: (userId: string, role: import('./api-types').OrgRole) => request<{ member: import('./api-types').OrgMember }>(`/api/org/members/${userId}`, { method: 'PUT', body: { role } }),
    removeMember: (userId: string) => request<void>(`/api/org/members/${userId}`, { method: 'DELETE' }),
    invitations: () => request<{ invitations: import('./api-types').OrgInvitation[] }>('/api/org/invitations'),
    invite: (email: string, role: import('./api-types').OrgRole) => request<{ invitation: import('./api-types').OrgInvitation; acceptUrl: string; emailSent: boolean; mailConfigured: boolean }>('/api/org/invitations', { method: 'POST', body: { email, role } }),
    revokeInvite: (id: string) => request<void>(`/api/org/invitations/${id}`, { method: 'DELETE' }),
    inviteInfo: (token: string) => request<{ organizationName: string; role: import('./api-types').OrgRole; email: string }>(`/api/org/invitations/token/${token}`),
    accept: (token: string) => request<{ ok: boolean; organizationId: string; role: import('./api-types').OrgRole }>(`/api/org/invitations/token/${token}/accept`, { method: 'POST' }),
  },

  notifications: {
    /** Le centre de notifications : tout ce que l'application a signalé. */
    list: (q?: { limite?: number; nonLues?: boolean }) =>
      request<{
        notifications: ApiNotification[]
        nonLues: number
        canaux: CanauxDisponibles
      }>('/api/notifications', {
        query: { limite: q?.limite, nonLues: q?.nonLues ? 'true' : undefined },
      }),
    marquerLue: (id: string) =>
      request<{ lues: number }>(`/api/notifications/${encodeURIComponent(id)}/lue`, { method: 'PUT' }),
    toutMarquerLu: () => request<{ lues: number }>('/api/notifications/lues', { method: 'PUT' }),
    supprimer: (id: string) =>
      request<void>(`/api/notifications/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  },

  apiKeys: {
    list: () => request<{ keys: import('./api-types').ApiKey[] }>('/api/api-keys'),
    create: (name: string) => request<import('./api-types').ApiKeyCreated>('/api/api-keys', { method: 'POST', body: { name } }),
    revoke: (id: string) => request<void>(`/api/api-keys/${id}`, { method: 'DELETE' }),
  },

  webhooks: {
    events: () => request<{ events: import('./api-types').WebhookEventType[] }>('/api/webhooks/events'),
    list: () => request<{ endpoints: import('./api-types').WebhookEndpoint[] }>('/api/webhooks'),
    create: (body: { url: string; events: string[]; description?: string }) =>
      request<{ endpoint: import('./api-types').WebhookEndpoint }>('/api/webhooks', { method: 'POST', body }),
    update: (id: string, body: { url?: string; events?: string[]; active?: boolean; description?: string | null }) =>
      request<{ endpoint: import('./api-types').WebhookEndpoint }>(`/api/webhooks/${id}`, { method: 'PUT', body }),
    remove: (id: string) => request<void>(`/api/webhooks/${id}`, { method: 'DELETE' }),
    rotateSecret: (id: string) => request<{ endpoint: import('./api-types').WebhookEndpoint }>(`/api/webhooks/${id}/rotate-secret`, { method: 'POST' }),
    test: (id: string) => request<{ ok: boolean }>(`/api/webhooks/${id}/test`, { method: 'POST' }),
    deliveries: (id: string) => request<{ deliveries: import('./api-types').WebhookDelivery[] }>(`/api/webhooks/${id}/deliveries`),
    replay: (deliveryId: string) => request<{ delivery: import('./api-types').WebhookDelivery }>(`/api/webhooks/deliveries/${deliveryId}/replay`, { method: 'POST' }),
  },

  /** Démarrer un diagnostic depuis des plans, un document (Word, Excel, PDF) ou un CECB : lecture par l'IA. */
  demarrage: {
    /**
     * La lecture des plans se fait en tâche de fond côté serveur (une à trois
     * minutes) : l'envoi rend un numéro, puis on demande toutes les 3 s où elle
     * en est. Pour l'appelant, rien ne change : une promesse du résultat final.
     * Un signal abandonné arrête la lecture côté serveur aussi.
     */
    plans: async (files: File[], signal?: AbortSignal) => {
      type Resultat = { configured: boolean; tronque?: boolean; refus?: boolean; lecture?: import('./api-types').LecturePlans | null }
      const depart = await envoyerFichiers<Resultat & { enCours?: string }>('/api/demarrage/plans', files)
      if (!depart.enCours) return depart
      const id = depart.enCours
      const arreter = () => { void request(`/api/demarrage/plans/${id}`, { method: 'DELETE' }).catch(() => undefined) }
      signal?.addEventListener('abort', arreter, { once: true })
      try {
        const limite = Date.now() + 15 * 60_000
        while (Date.now() < limite) {
          await new Promise((r) => setTimeout(r, 3000))
          if (signal?.aborted) throw new DOMException('Lecture abandonnée', 'AbortError')
          const etat = await request<Resultat & { etat: 'en_cours' | 'prete' }>(`/api/demarrage/plans/${id}`)
          if (etat.etat === 'prete') return etat
        }
        throw new Error('La lecture des plans prend trop de temps. Réessayez avec moins de pages.')
      } finally {
        signal?.removeEventListener('abort', arreter)
      }
    },
    document: (file: File) =>
      envoyerFichier<{ configured: boolean; tronque?: boolean; lecture?: import('./api-types').LectureDocument | null }>('/api/demarrage/document', file),
    cecb: (file: File) =>
      envoyerFichier<{ configured: boolean; tronque?: boolean; lecture?: import('./api-types').LectureCecb | null }>('/api/demarrage/cecb', file),
  },
  /** Organisation de la visite d'un dossier : interlocuteurs, rendez-vous, mails. */
  visite: {
    get: (projectId: string) =>
      request<{ plan: import('./api-types').VisitPlan | null; contacts: import('./api-types').VisitContact[]; mails: import('./api-types').VisitMail[]; mailConfigured: boolean }>(`/api/visite/${projectId}`),
    savePlan: (projectId: string, plan: Partial<import('./api-types').VisitPlan>) =>
      request<{ plan: import('./api-types').VisitPlan }>(`/api/visite/${projectId}/plan`, { method: 'PUT', body: plan }),
    addContact: (projectId: string, body: Partial<import('./api-types').VisitContact>) =>
      request<{ contact: import('./api-types').VisitContact }>(`/api/visite/${projectId}/contacts`, { method: 'POST', body }),
    updateContact: (id: string, body: Partial<import('./api-types').VisitContact>) =>
      request<{ contact: import('./api-types').VisitContact }>(`/api/visite/contacts/${id}`, { method: 'PUT', body }),
    removeContact: (id: string) => request<void>(`/api/visite/contacts/${id}`, { method: 'DELETE' }),
    sendMail: (projectId: string, body: { template: string; subject: string; body: string; recipients: { name: string; email: string }[]; mode: 'send' | 'messagerie' }) =>
      request<{ mail: import('./api-types').VisitMail }>(`/api/visite/${projectId}/mails`, { method: 'POST', body }),
  },
  /** L'annuaire des partenaires (tenu par Finalyn) et les mises en relation. */
  partenaires: {
    config: () => request<{ admin: boolean; mailConfigured: boolean }>('/api/partenaires/config'),
    list: (tous?: boolean) =>
      request<{ partenaires: import('./api-types').Partenaire[] }>('/api/partenaires', { query: tous ? { tous: 1 } : undefined }),
    create: (body: Partial<import('./api-types').Partenaire>) =>
      request<{ partenaire: import('./api-types').Partenaire }>('/api/partenaires', { method: 'POST', body }),
    update: (id: string, body: Partial<import('./api-types').Partenaire>) =>
      request<{ partenaire: import('./api-types').Partenaire }>(`/api/partenaires/${id}`, { method: 'PUT', body }),
    remove: (id: string) => request<{ retire: boolean; supprime: boolean }>(`/api/partenaires/${id}`, { method: 'DELETE' }),
    contacter: (id: string, body: { projectId: string | null; partagerRapport: boolean; objet: string; message: string; mode: 'send' | 'messagerie' }) =>
      request<{ demande: import('./api-types').DemandePartenaire }>(`/api/partenaires/${id}/demandes`, { method: 'POST', body }),
    /** Compte l'ouverture de l'offre d'un outil (le lien s'ouvre à côté). */
    ouvrirOffre: (id: string) => request<{ url: string }>(`/api/partenaires/${id}/offre`, { method: 'POST' }),
    demandes: () => request<{ demandes: import('./api-types').DemandePartenaire[] }>('/api/partenaires/demandes'),
    suivre: (id: string, statut: 'EN_COURS' | 'TERMINEE' | 'MESSAGERIE') =>
      request<{ demande: import('./api-types').DemandePartenaire }>(`/api/partenaires/demandes/${id}`, { method: 'PATCH', body: { statut } }),
    demandesAdmin: () => request<{ demandes: import('./api-types').DemandePartenaireAdmin[] }>('/api/partenaires/admin/demandes'),
  },
  events: {
    list: (q?: { from?: string; to?: string }) =>
      request<{ events: ApiEvent[]; count: number }>('/api/events', { query: q }),
    create: (body: Partial<ApiEvent> & { title: string; startAt: string }) =>
      request<{ event: ApiEvent }>('/api/events', { method: 'POST', body }),
    update: (id: string, body: Partial<ApiEvent>) =>
      request<{ event: ApiEvent }>(`/api/events/${id}`, { method: 'PUT', body }),
    delete: (id: string) => request<void>(`/api/events/${id}`, { method: 'DELETE' }),
  },
  /**
   * Variantes de projet : les arbitrages qui changent, pas une copie du dossier.
   * Trois au maximum, la limite est tenue par le serveur.
   */
  variants: {
    list: (projectId: string) =>
      request<{ variants: ApiVariant[]; count: number; max: number }>(`/api/variants/projects/${projectId}`),
    create: (projectId: string, body: { name: string; description?: string | null }) =>
      request<{ variant: ApiVariant }>(`/api/variants/projects/${projectId}`, { method: 'POST', body }),
    update: (id: string, body: Partial<{ name: string; description: string | null; displayOrder: number }>) =>
      request<{ variant: ApiVariant }>(`/api/variants/${id}`, { method: 'PUT', body }),
    remove: (id: string) => request<void>(`/api/variants/${id}`, { method: 'DELETE' }),
    addLine: (variantId: string, body: {
      replacesItemId?: string | null; catalogItemId?: number | null; state?: ElementState | null
      cfcCode: string; label: string; unit?: string | null; area?: number | null
      amount: number; costManual?: boolean; note?: string | null
    }) => request<{ line: ApiVariantLine }>(`/api/variants/${variantId}/lines`, { method: 'POST', body }),
    updateLine: (lineId: string, body: Partial<{
      replacesItemId: string | null; catalogItemId: number | null; state: ElementState | null
      cfcCode: string; label: string; unit: string | null; area: number | null
      amount: number; costManual: boolean; note: string | null
    }>) => request<{ line: ApiVariantLine }>(`/api/variants/lines/${lineId}`, { method: 'PUT', body }),
    removeLine: (lineId: string) => request<void>(`/api/variants/lines/${lineId}`, { method: 'DELETE' }),
  },


  diagnostics: {
    // Les deux lectures des relevés montrent aussi les saisies pas encore
    // envoyées (lib/hors-ligne) : un rafraîchissement ne les fait pas disparaître.
    get: async (id: string) => {
      const r = await request<{ diagnostic: ApiDiagnostic; items: ApiDiagnosticItem[] }>(`/api/diagnostics/${id}`)
      return Array.isArray(r.items) ? { ...r, items: avecSaisiesEnAttente(r.items, id) } : r
    },
    update: (id: string, body: Partial<ApiDiagnostic>) =>
      request<{ diagnostic: ApiDiagnostic }>(`/api/diagnostics/${id}`, { method: 'PUT', body }),
    delete: (id: string) => request<void>(`/api/diagnostics/${id}`, { method: 'DELETE' }),

    listItems: async (id: string) => {
      const r = await request<{ items: ApiDiagnosticItem[]; count: number }>(`/api/diagnostics/${id}/items`)
      const items = avecSaisiesEnAttente(r.items, id)
      return { ...r, items, count: items.length }
    },
    recentItems: () =>
      request<{ items: import('./api-types').RecentDiagnosticItem[] }>('/api/diagnostics/recent-items'),
    createItem: (diagId: string, body: Partial<ApiDiagnosticItem>) =>
      request<{ item: ApiDiagnosticItem }>(`/api/diagnostics/${diagId}/items`, { method: 'POST', body }),
    updateItem: (itemId: string, body: Partial<ApiDiagnosticItem>) =>
      request<{ item: ApiDiagnosticItem }>(`/api/diagnostics/items/${itemId}`, { method: 'PUT', body }),
    deleteItem: (itemId: string) =>
      request<void>(`/api/diagnostics/items/${itemId}`, { method: 'DELETE' }),
    /** Ramène les coûts du dossier au coefficient marché du jour. preview = simulation. */
    reindex: (id: string, preview = false) =>
      request<{
        preview: boolean
        market: { coeff: number; base: number; index: number; indexDate: string; source: string }
        legacyIndex: number
        items: { total: number; updated: number; manual: number }
        before: number; after: number; delta: number
      }>(`/api/diagnostics/${id}/reindex`, { method: 'POST', query: { preview: preview ? '1' : undefined } }),
  },
}
