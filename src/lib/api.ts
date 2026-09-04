import { useAuth } from '@/stores/auth'
import type {
  ApiCatalogItem, ApiCfcEntry, ApiDiagnostic, ApiDiagnosticItem,
  ApiProject, ApiOperation, ApiPlan, ApiBoard, ApiEvent, AuthResponse,
} from './api-types'

// En prod, l'app est servie par le même domaine que l'API -> requêtes same-origin
// (BASE_URL vide = chemins relatifs /api...). En dev local (localhost), on vise le
// backend sur :4000. VITE_API_URL, si défini au build, reste prioritaire.
export const BASE_URL =
  import.meta.env.VITE_API_URL ??
  (typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)
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

async function refreshAccessToken(): Promise<string | null> {
  if (refreshing) return refreshing
  const refreshToken = useAuth.getState().refreshToken
  if (!refreshToken) return null

  refreshing = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })
      if (!res.ok) {
        // Session definitivement perdue : on efface aussi les donnees en cache local.
        // Import dynamique : evite un cycle d'import entre api.ts et session.ts.
        void import('./session').then((m) => m.purgeLocalSession())
        return null
      }
      const data = (await res.json()) as AuthResponse
      useAuth.getState().setAuth(data.user, data.accessToken, data.refreshToken)
      return data.accessToken
    } catch {
      // Echec reseau : la session peut encore etre valide (mode hors-ligne), on ne
      // purge rien, on se contente de ne pas rejouer la requete.
      return null
    } finally {
      refreshing = null
    }
  })()

  return refreshing
}

interface RequestOpts {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
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

// ---------------- API surface ----------------

export const api = {
  auth: {
    register: (body: { email: string; password: string; firstName?: string; lastName?: string; companyName?: string; phone?: string }) =>
      request<AuthResponse>('/api/auth/register', { method: 'POST', body, withAuth: false }),
    // Login : renvoie soit les tokens, soit une demande de code 2FA (ticket).
    login: (body: { email: string; password: string }) =>
      request<AuthResponse | { twoFactorRequired: true; ticket: string }>('/api/auth/login', { method: 'POST', body, withAuth: false }),
    // Étape 2 : vérifie le code de l'app d'authentification.
    twoFactorVerify: (body: { ticket: string; code: string }) =>
      request<AuthResponse>('/api/auth/2fa/verify', { method: 'POST', body, withAuth: false }),
    // Configuration 2FA (utilisateur connecté).
    twoFactorSetup: () =>
      request<{ otpauth: string; qr: string; secret: string }>('/api/auth/2fa/setup', { method: 'POST' }),
    twoFactorEnable: (code: string) =>
      request<{ enabled: boolean }>('/api/auth/2fa/enable', { method: 'POST', body: { code } }),
    twoFactorDisable: (code: string) =>
      request<{ enabled: boolean }>('/api/auth/2fa/disable', { method: 'POST', body: { code } }),
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
    vapid: () => request<{ publicKey: string | null; enabled: boolean }>('/api/push/vapid', { withAuth: false }),
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
    update: (id: string, body: { name?: string; scalePxPerM?: number | null; annotations?: unknown[] }) =>
      request<{ plan: ApiPlan }>(`/api/plans/${id}`, { method: 'PUT', body }),
    delete: (id: string) => request<void>(`/api/plans/${id}`, { method: 'DELETE' }),
    // Le serveur signe l'accès au fichier : on ne reconstruit plus l'URL à partir du
    // nom, sinon le téléchargement est refusé (403).
    fileUrl: (plan: ApiPlan) => `${BASE_URL}${plan.fileUrl}`,
  },

  boards: {
    list: (projectId: string) =>
      request<{ boards: ApiBoard[]; count: number }>('/api/boards', { query: { projectId } }),
    get: (id: string) => request<{ board: ApiBoard }>(`/api/boards/${id}`),
    create: (body: { projectId: string; name?: string; data?: unknown }) =>
      request<{ board: ApiBoard }>('/api/boards', { method: 'POST', body }),
    update: (id: string, body: { name?: string; data?: unknown }) =>
      request<{ board: ApiBoard }>(`/api/boards/${id}`, { method: 'PUT', body }),
    delete: (id: string) => request<void>(`/api/boards/${id}`, { method: 'DELETE' }),
  },

  assistant: {
    chat: (body: { messages: { role: 'user' | 'assistant'; content: string }[]; projectId?: string }) =>
      request<{ reply: string; configured: boolean }>('/api/assistant/chat', { method: 'POST', body }),
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
    members: () => request<{ members: import('./api-types').OrgMember[] }>('/api/org/members'),
    setRole: (userId: string, role: import('./api-types').OrgRole) => request<{ member: import('./api-types').OrgMember }>(`/api/org/members/${userId}`, { method: 'PUT', body: { role } }),
    removeMember: (userId: string) => request<void>(`/api/org/members/${userId}`, { method: 'DELETE' }),
    invitations: () => request<{ invitations: import('./api-types').OrgInvitation[] }>('/api/org/invitations'),
    invite: (email: string, role: import('./api-types').OrgRole) => request<{ invitation: import('./api-types').OrgInvitation; acceptUrl: string; emailSent: boolean; mailConfigured: boolean }>('/api/org/invitations', { method: 'POST', body: { email, role } }),
    revokeInvite: (id: string) => request<void>(`/api/org/invitations/${id}`, { method: 'DELETE' }),
    inviteInfo: (token: string) => request<{ organizationName: string; role: import('./api-types').OrgRole; email: string }>(`/api/org/invitations/token/${token}`),
    accept: (token: string) => request<{ ok: boolean; organizationId: string; role: import('./api-types').OrgRole }>(`/api/org/invitations/token/${token}/accept`, { method: 'POST' }),
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

  events: {
    list: (q?: { from?: string; to?: string }) =>
      request<{ events: ApiEvent[]; count: number }>('/api/events', { query: q }),
    create: (body: Partial<ApiEvent> & { title: string; startAt: string }) =>
      request<{ event: ApiEvent }>('/api/events', { method: 'POST', body }),
    update: (id: string, body: Partial<ApiEvent>) =>
      request<{ event: ApiEvent }>(`/api/events/${id}`, { method: 'PUT', body }),
    delete: (id: string) => request<void>(`/api/events/${id}`, { method: 'DELETE' }),
  },

  diagnostics: {
    get: (id: string) =>
      request<{ diagnostic: ApiDiagnostic; items: ApiDiagnosticItem[] }>(`/api/diagnostics/${id}`),
    update: (id: string, body: Partial<ApiDiagnostic>) =>
      request<{ diagnostic: ApiDiagnostic }>(`/api/diagnostics/${id}`, { method: 'PUT', body }),
    delete: (id: string) => request<void>(`/api/diagnostics/${id}`, { method: 'DELETE' }),

    listItems: (id: string) =>
      request<{ items: ApiDiagnosticItem[]; count: number }>(`/api/diagnostics/${id}/items`),
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
