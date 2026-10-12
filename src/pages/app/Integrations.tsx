/**
 * Les intégrations : brancher Diagly sur les outils du bureau.
 *
 * Même disposition que les Paramètres : un menu dans sa carte à gauche, la
 * section dans un grand panneau à droite. Chaque section dit ce qu'elle
 * permet, montre ce qui est déjà branché, et donne l'exemple prêt à coller :
 * l'appel d'API, la vérification de signature, la commande MCP.
 *
 * Les clés d'API sont personnelles (le serveur les rattache au compte, pas à
 * l'organisation) : la page le dit, pour qu'on ne cherche pas celles d'un
 * collègue.
 */
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  KeyRound, Webhook, Loader2, Plus, Copy, Check, Trash2, ExternalLink, BookOpen, Send, RefreshCw, Eye, EyeOff,
  ChevronDown, RotateCcw, Bot, FileJson, ShieldCheck,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Input, Button } from '@/components/ui'
import { api, ApiError, BASE_URL } from '@/lib/api'
import { useIsMobile } from '@/lib/use-mobile'
import { cn, formatDate } from '@/lib/utils'
import type { ApiKey, WebhookEndpoint, WebhookDelivery, WebhookEventType } from '@/lib/api-types'

type IdSection = 'apikeys' | 'webhooks' | 'mcp'

const EVENT_LABELS: Record<WebhookEventType, string> = {
  'diagnostic.finalise': 'Diagnostic finalisé',
  'rapport.genere': 'Rapport généré',
  'element.modifie': 'Élément modifié',
  'plan_travaux.mis_a_jour': 'Plan de travaux mis à jour',
}
const EVENT_AIDE: Record<WebhookEventType, string> = {
  'diagnostic.finalise': 'Un diagnostic passe au statut terminé.',
  'rapport.genere': 'Un export Excel ou CSV est produit, ou un rapport est partagé.',
  'element.modifie': 'Un relevé est créé, modifié ou retiré. Groupé par diagnostic.',
  'plan_travaux.mis_a_jour': 'Recalculé à chaque modification des relevés.',
}
const ALL_EVENTS = Object.keys(EVENT_LABELS) as WebhookEventType[]

const API_BASE = `${BASE_URL || window.location.origin}/api/v1`
const MCP_URL = `${BASE_URL || window.location.origin}/api/mcp`

const RESSOURCES = [
  { label: 'Diagnostics', chemin: '/diagnostics', aide: 'Liste, détail, éléments, coûts et plan de travaux d’un diagnostic' },
  { label: 'Bâtiments', chemin: '/buildings', aide: 'Les bâtiments du parc et leur identifiant EGID' },
  { label: 'Portefeuille', chemin: '/portfolio', aide: 'Résumé, éléments, coûts agrégés et plan de travaux de tout le parc' },
]

const OUTILS_MCP: [string, string][] = [
  ['portfolio_summary', 'Résumé des diagnostics : bâtiments, priorités, budget'],
  ['search_diagnostics', 'Rechercher des diagnostics'],
  ['get_diagnostic', 'Détail complet d’un bâtiment'],
  ['query_elements', 'Éléments des diagnostics par CFC, état ou priorité'],
  ['aggregate_costs', 'Budget agrégé par canton, année ou priorité'],
  ['work_plan', 'Plan de travaux des diagnostics par année'],
]

export function Integrations() {
  const isMobile = useIsMobile()
  const keysQuery = useQuery({ queryKey: ['api-keys'], queryFn: () => api.apiKeys.list() })
  const endpointsQuery = useQuery({ queryKey: ['webhooks'], queryFn: () => api.webhooks.list() })
  const keys = keysQuery.isLoading ? null : keysQuery.data?.keys ?? []
  const endpoints = endpointsQuery.isLoading ? null : endpointsQuery.data?.endpoints ?? []
  const loadKeys = async () => { await keysQuery.refetch() }
  const loadEndpoints = async () => { await endpointsQuery.refetch() }

  const activeKeys = (keys ?? []).filter((k) => !k.revokedAt)
  const activeEndpoints = (endpoints ?? []).filter((e) => e.active)

  const SECTIONS: { id: IdSection; label: string; aide: string; icone: typeof KeyRound; etat: string; branche: boolean }[] = [
    {
      id: 'apikeys', label: 'Clés d’API', icone: KeyRound,
      aide: 'Accès en lecture à vos données pour un ERP, une gérance ou un partenaire',
      etat: keys === null ? '…' : activeKeys.length ? `${activeKeys.length} active${activeKeys.length > 1 ? 's' : ''}` : 'Aucune',
      branche: activeKeys.length > 0,
    },
    {
      id: 'webhooks', label: 'Webhooks', icone: Webhook,
      aide: 'Vos systèmes sont prévenus dès qu’un événement se produit',
      etat: endpoints === null ? '…' : endpoints.length ? `${activeEndpoints.length}/${endpoints.length} actif${activeEndpoints.length > 1 ? 's' : ''}` : 'Aucun',
      branche: activeEndpoints.length > 0,
    },
    {
      id: 'mcp', label: 'Assistant IA (MCP)', icone: Bot,
      aide: 'Votre propre assistant IA interroge vos diagnostics',
      etat: activeKeys.length ? 'Prêt' : 'Clé requise',
      branche: activeKeys.length > 0,
    },
  ]

  const [parametres, setParametres] = useSearchParams()
  const choisie = (SECTIONS.find((s) => s.id === parametres.get('s'))?.id ?? 'apikeys') as IdSection
  const choisir = (id: IdSection) => setParametres({ s: id }, { replace: true })
  const section = SECTIONS.find((s) => s.id === choisie)!

  // La page tient dans la fenêtre : seul le panneau de droite défile (voir
  // pageEncastree dans AppLayout). Sur téléphone, c'est la page qui défile.
  return (
    <div className={cn('space-y-4', !isMobile && 'flex h-full min-h-0 flex-col space-y-0 gap-4')}>
      <div className="shrink-0">
        <h1 className="text-xl font-bold">Intégrations</h1>
        <p className="text-sm text-muted-foreground">Reliez Diagly à vos outils : ERP, logiciel de gérance, assistant IA. Les données restent en lecture seule.</p>
      </div>

      <div className={cn('flex gap-4', isMobile ? 'flex-col' : 'min-h-0 flex-1 items-start')}>
        {/* ----- Le menu, à gauche ----- */}
        <div className="w-full shrink-0 space-y-4 lg:w-72">
          <Card className="overflow-hidden">
            <div className="border-b border-black/[0.06] px-4 py-3.5">
              <p className="text-sm font-semibold">Connexions</p>
              <p className="text-xs text-muted-foreground">
                {SECTIONS.filter((s) => s.branche).length} sur {SECTIONS.length} en service
              </p>
            </div>
            <nav className="space-y-1 p-2">
              {SECTIONS.map((s) => {
                const on = s.id === choisie
                return (
                  <button
                    key={s.id}
                    onClick={() => choisir(s.id)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left transition-colors',
                      on ? 'border border-blue-100 bg-blue-50 text-blue-700' : 'text-neutral-600 hover:bg-black/[0.03] hover:text-neutral-900',
                    )}
                  >
                    <s.icone className="h-4 w-4 shrink-0" />
                    <span className={cn('min-w-0 flex-1 truncate text-sm', on ? 'font-semibold' : 'font-medium')}>{s.label}</span>
                    <span className={cn('flex shrink-0 items-center gap-1.5 text-[11px]', s.branche ? 'text-emerald-700' : 'text-muted-foreground')}>
                      <span className={cn('h-1.5 w-1.5 rounded-full', s.branche ? 'bg-emerald-500' : 'bg-neutral-300')} />{s.etat}
                    </span>
                  </button>
                )
              })}
            </nav>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-black/[0.06] px-4 py-3.5">
              <p className="text-sm font-semibold">Documentation</p>
              <p className="text-xs text-muted-foreground">API REST v1, décrite en OpenAPI</p>
            </div>
            <div className="space-y-1 p-2">
              <a href={`${API_BASE}/docs`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-black/[0.03] hover:text-neutral-900">
                <BookOpen className="h-4 w-4 shrink-0" /><span className="flex-1">Documentation interactive</span><ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
              </a>
              <a href={`${API_BASE}/openapi.json`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-black/[0.03] hover:text-neutral-900">
                <FileJson className="h-4 w-4 shrink-0" /><span className="flex-1">Spécification OpenAPI</span><ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
              </a>
            </div>
          </Card>
        </div>

        {/* ----- Le contenu, à droite ----- */}
        <Card className={cn('min-w-0 flex-1 overflow-hidden', !isMobile && 'flex max-h-full flex-col')}>
          <CardHeader className="shrink-0 space-y-0 border-b border-black/[0.06] px-5 py-3.5">
            <CardTitle className="text-base">{section.label}</CardTitle>
            <p className="mt-0.5 text-sm text-muted-foreground">{section.aide}</p>
          </CardHeader>
          <CardContent key={choisie} className={cn('space-y-5 p-5', !isMobile && 'min-h-0 flex-1 overflow-y-auto overscroll-contain')}>
            {choisie === 'apikeys' && <SectionCles keys={keys} onChange={loadKeys} />}
            {choisie === 'webhooks' && <SectionWebhooks endpoints={endpoints} onChange={loadEndpoints} />}
            {choisie === 'mcp' && <SectionMcp aUneCle={activeKeys.length > 0} onCreerCle={() => choisir('apikeys')} />}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- briques

function Bloc({ titre, aide, children, action }: { titre: string; aide?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="border-t border-black/[0.06] pt-5 first:border-0 first:pt-0">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{titre}</h3>
          {aide && <p className="mt-0.5 text-sm text-muted-foreground">{aide}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}

function useCopie() {
  const [copie, setCopie] = useState<string | null>(null)
  const copier = async (v: string) => {
    try { await navigator.clipboard.writeText(v); setCopie(v); setTimeout(() => setCopie(null), 2000) } catch { /* presse-papiers refusé */ }
  }
  return { copie, copier }
}

/** Un exemple prêt à coller, avec son bouton de copie. */
function Code({ texte, langue }: { texte: string; langue?: string }) {
  const { copie, copier } = useCopie()
  return (
    <div className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-neutral-50">
      <div className="flex items-center justify-between border-b border-black/[0.06] px-3 py-1.5">
        <span className="text-[11px] font-medium text-muted-foreground">{langue ?? 'Exemple'}</span>
        <button onClick={() => copier(texte)} className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-black/[0.04] hover:text-foreground">
          {copie === texte ? <><Check className="h-3 w-3" />Copié</> : <><Copy className="h-3 w-3" />Copier</>}
        </button>
      </div>
      <pre className="overflow-x-auto px-3 py-2.5 font-mono text-xs leading-relaxed text-neutral-800">{texte}</pre>
    </div>
  )
}

function Vide({ titre, texte }: { titre: string; texte: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-black/[0.1] px-4 py-10 text-center">
      <p className="text-sm font-medium">{titre}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{texte}</p>
    </div>
  )
}

const Chargement = () => <div className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>

// ---------------------------------------------------------------- clés d'API

function SectionCles({ keys, onChange }: { keys: ApiKey[] | null; onChange: () => Promise<void> }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { copie, copier } = useCopie()

  const create = async () => {
    if (!name.trim()) return
    setBusy(true); setError(null); setCreated(null)
    try { const r = await api.apiKeys.create(name.trim()); setCreated(r.key); setName(''); await onChange() }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Erreur') } finally { setBusy(false) }
  }
  const revoke = async (k: ApiKey) => {
    if (!confirm(`Révoquer la clé « ${k.name} » ? Les outils qui l’utilisent perdront l’accès immédiatement.`)) return
    await api.apiKeys.revoke(k.id); await onChange()
  }
  const actives = (keys ?? []).filter((k) => !k.revokedAt)
  const revoquees = (keys ?? []).filter((k) => k.revokedAt)

  return (
    <>
      <Bloc titre="Créer une clé" aide="Une clé par outil : vous pourrez couper l’accès d’un partenaire sans toucher aux autres. Vos clés sont personnelles.">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input placeholder="Nom de la clé (ex. ERP Quorum)" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} />
          <Button onClick={create} disabled={busy || !name.trim()} className="shrink-0">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Créer la clé</Button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        {created && (
          <div className="mt-3 space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm font-medium text-amber-900">Copiez cette clé maintenant : elle ne sera plus jamais affichée.</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded-lg border border-black/[0.06] bg-white px-2 py-1.5 text-xs">{created}</code>
              <Button size="sm" variant="outline" onClick={() => copier(created)}>{copie === created ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</Button>
            </div>
          </div>
        )}
      </Bloc>

      <Bloc titre="Vos clés" aide={revoquees.length ? `${revoquees.length} clé${revoquees.length > 1 ? 's' : ''} révoquée${revoquees.length > 1 ? 's' : ''} masquée${revoquees.length > 1 ? 's' : ''}.` : undefined}>
        {keys === null ? <Chargement /> : actives.length === 0 ? (
          <Vide titre="Aucune clé active" texte="Créez-en une pour donner accès à vos données à un autre logiciel." />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-black/[0.06]">
            <div className="hidden grid-cols-[minmax(0,1fr)_140px_150px_170px_40px] gap-3 border-b border-black/[0.06] bg-neutral-50/70 px-4 py-2.5 text-xs font-medium text-muted-foreground md:grid">
              <span>Nom</span><span>Préfixe</span><span>Créée le</span><span>Dernière utilisation</span><span />
            </div>
            <div className="divide-y divide-black/[0.05]">
              {actives.map((k) => (
                <div key={k.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_140px_150px_170px_40px]">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><KeyRound className="h-4 w-4" /></span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{k.name}</p>
                      <p className="text-xs text-muted-foreground md:hidden">{k.lastUsedAt ? `Utilisée le ${formatDate(new Date(k.lastUsedAt))}` : 'Jamais utilisée'}</p>
                    </div>
                  </div>
                  <code className="hidden font-mono text-xs text-muted-foreground md:block">{k.keyPrefix}…</code>
                  <span className="hidden text-xs text-muted-foreground md:block">{formatDate(new Date(k.createdAt))}</span>
                  <span className={cn('hidden items-center gap-1.5 text-xs md:flex', k.lastUsedAt ? 'text-foreground' : 'text-muted-foreground')}>
                    <span className={cn('h-1.5 w-1.5 rounded-full', k.lastUsedAt ? 'bg-emerald-500' : 'bg-neutral-300')} />
                    {k.lastUsedAt ? formatDate(new Date(k.lastUsedAt)) : 'Jamais utilisée'}
                  </span>
                  <div className="flex justify-end">
                    <button title="Révoquer" onClick={() => revoke(k)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Bloc>

      <Bloc titre="Ce que l’API donne" aide="Toutes les routes sont en lecture seule et limitées aux diagnostics de votre compte.">
        <div className="grid gap-3 sm:grid-cols-3">
          {RESSOURCES.map((r) => (
            <div key={r.chemin} className="rounded-2xl border border-black/[0.06] bg-white/50 p-4">
              <p className="text-sm font-semibold">{r.label}</p>
              <code className="mt-0.5 block font-mono text-xs text-blue-700">/api/v1{r.chemin}</code>
              <p className="mt-1.5 text-xs text-muted-foreground">{r.aide}</p>
            </div>
          ))}
        </div>
      </Bloc>

      <Bloc titre="Premier appel" aide="La clé se passe dans l’en-tête Authorization.">
        <Code langue="Terminal" texte={`curl ${API_BASE}/diagnostics \\\n  -H "Authorization: Bearer dgly_live_…"`} />
      </Bloc>
    </>
  )
}

// ---------------------------------------------------------------- webhooks

function SectionWebhooks({ endpoints, onChange }: { endpoints: WebhookEndpoint[] | null; onChange: () => Promise<void> }) {
  const [url, setUrl] = useState('')
  const [events, setEvents] = useState<WebhookEventType[]>([...ALL_EVENTS])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const create = async () => {
    if (!url.trim() || events.length === 0) return
    setBusy(true); setError(null)
    try { await api.webhooks.create({ url: url.trim(), events }); setUrl(''); await onChange() }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Erreur') } finally { setBusy(false) }
  }
  const toggleEvent = (ev: WebhookEventType) => setEvents((s) => s.includes(ev) ? s.filter((x) => x !== ev) : [...s, ev])

  return (
    <>
      <Bloc titre="Ajouter une adresse de réception" aide="Diagly envoie une requête POST signée à cette adresse à chaque événement choisi. Le message est court : votre système rappelle l’API pour l’état à jour.">
        <div className="space-y-3">
          <Input placeholder="https://votre-systeme.ch/webhooks/diagly" value={url} onChange={(e) => setUrl(e.target.value)} />
          <div className="grid gap-2 sm:grid-cols-2">
            {ALL_EVENTS.map((ev) => {
              const on = events.includes(ev)
              return (
                <button
                  key={ev}
                  type="button"
                  onClick={() => toggleEvent(ev)}
                  className={cn('flex items-start gap-3 rounded-2xl border p-3 text-left transition-colors', on ? 'border-blue-200 bg-blue-50/70' : 'border-black/[0.06] bg-white/50 hover:bg-white')}
                >
                  <span className={cn('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border', on ? 'border-blue-600 bg-blue-600 text-white' : 'border-black/20 bg-white')}>
                    {on && <Check className="h-3 w-3" />}
                  </span>
                  <span className="min-w-0">
                    <span className={cn('block text-sm font-medium', on ? 'text-blue-800' : 'text-foreground')}>{EVENT_LABELS[ev]}</span>
                    <span className="block text-xs text-muted-foreground">{EVENT_AIDE[ev]}</span>
                    <code className="mt-1 block font-mono text-[11px] text-muted-foreground">{ev}</code>
                  </span>
                </button>
              )
            })}
          </div>
          <div className="flex justify-end">
            <Button onClick={create} disabled={busy || !url.trim() || events.length === 0}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Ajouter l’adresse</Button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </Bloc>

      <Bloc titre="Adresses enregistrées">
        {endpoints === null ? <Chargement /> : endpoints.length === 0 ? (
          <Vide titre="Aucune adresse" texte="Ajoutez-en une pour recevoir les événements en temps réel." />
        ) : <div className="space-y-3">{endpoints.map((ep) => <EndpointRow key={ep.id} ep={ep} onChange={onChange} />)}</div>}
      </Bloc>

      <Bloc titre="Vérifier la signature" aide="Chaque envoi porte les en-têtes X-Diagly-Event, X-Diagly-Delivery, X-Diagly-Timestamp et X-Diagly-Signature. Recalculez la signature avec le secret de l’adresse avant de faire confiance au message.">
        <Code langue="Node.js" texte={`import { createHmac, timingSafeEqual } from 'node:crypto'

// body = corps brut de la requête, tel que reçu
const attendu = 'sha256=' + createHmac('sha256', SECRET)
  .update(\`\${req.headers['x-diagly-timestamp']}.\${body}\`)
  .digest('hex')
const recu = req.headers['x-diagly-signature']
const valide = recu.length === attendu.length
  && timingSafeEqual(Buffer.from(recu), Buffer.from(attendu))`} />
      </Bloc>
    </>
  )
}

function EndpointRow({ ep, onChange }: { ep: WebhookEndpoint; onChange: () => Promise<void> }) {
  const [showSecret, setShowSecret] = useState(false)
  const [testing, setTesting] = useState(false)
  const [tested, setTested] = useState(false)
  const [open, setOpen] = useState(false)
  const [deliveries, setDeliveries] = useState<WebhookDelivery[] | null>(null)
  const { copie, copier } = useCopie()

  const toggleActive = async () => { await api.webhooks.update(ep.id, { active: !ep.active }); await onChange() }
  const remove = async () => { if (!confirm('Supprimer cette adresse ? Elle ne recevra plus aucun événement.')) return; await api.webhooks.remove(ep.id); await onChange() }
  const rotate = async () => { if (!confirm('Générer un nouveau secret ? L’ancien cessera de fonctionner tout de suite.')) return; await api.webhooks.rotateSecret(ep.id); await onChange() }
  const test = async () => { setTesting(true); try { await api.webhooks.test(ep.id); setTested(true); setTimeout(() => setTested(false), 2500) } finally { setTesting(false) } }
  const loadDeliveries = async () => { const r = await api.webhooks.deliveries(ep.id); setDeliveries(r.deliveries) }
  const openLog = async () => { const next = !open; setOpen(next); if (next) await loadDeliveries() }
  const replay = async (id: string) => { await api.webhooks.replay(id); await loadDeliveries() }

  return (
    <div className={cn('overflow-hidden rounded-2xl border border-black/[0.06] bg-white/50', !ep.active && 'opacity-70')}>
      <div className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><Webhook className="h-4 w-4" /></span>
          <div className="min-w-0 flex-1">
            <p className="break-all text-sm font-medium">{ep.url}</p>
            <p className="text-xs text-muted-foreground">Ajoutée le {formatDate(new Date(ep.createdAt))}</p>
          </div>
          <span className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', ep.active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500')}>
            <span className={cn('h-1.5 w-1.5 rounded-full', ep.active ? 'bg-emerald-500' : 'bg-gray-400')} />{ep.active ? 'Active' : 'En pause'}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {ep.events.map((e) => (
            <span key={e} className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] text-neutral-600">{EVENT_LABELS[e as WebhookEventType] ?? e}</span>
          ))}
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Secret de signature</p>
          <div className="flex items-center gap-1.5">
            <code className="flex-1 break-all rounded-lg bg-neutral-100 px-2 py-1.5 font-mono text-xs">{showSecret ? ep.secret : `${ep.secret.slice(0, 10)}${'•'.repeat(16)}`}</code>
            <Button size="icon" variant="ghost" className="h-8 w-8" title={showSecret ? 'Masquer' : 'Afficher'} onClick={() => setShowSecret((s) => !s)}>{showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" title="Copier" onClick={() => copier(ep.secret)}>{copie === ep.secret ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}</Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" title="Générer un nouveau secret" onClick={rotate}><RefreshCw className="h-3.5 w-3.5" /></Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 border-t border-black/[0.06] pt-3">
          <Button size="sm" variant="outline" onClick={test} disabled={testing}>{tested ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Send className="h-3.5 w-3.5" />}{tested ? 'Envoyé' : 'Envoyer un test'}</Button>
          <Button size="sm" variant="outline" onClick={openLog}><ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />Historique des envois</Button>
          <Button size="sm" variant="outline" onClick={toggleActive}>{ep.active ? 'Mettre en pause' : 'Réactiver'}</Button>
          <button title="Supprimer" onClick={remove} className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>

      {open && (
        <div className="border-t border-black/[0.06] bg-neutral-50/70 p-3">
          {deliveries === null ? <Chargement /> : deliveries.length === 0 ? <p className="py-2 text-xs text-muted-foreground">Aucun envoi pour l’instant.</p> : (
            <div className="space-y-1">
              {deliveries.map((d) => (
                <div key={d.id} className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-xs">
                  <StatusDot status={d.status} />
                  <span className="w-44 truncate font-medium">{EVENT_LABELS[d.eventType as WebhookEventType] ?? d.eventType}</span>
                  <span className="text-muted-foreground">{new Date(d.createdAt).toLocaleString('fr-CH')}</span>
                  <span className="text-muted-foreground">{d.responseStatus ? `HTTP ${d.responseStatus}` : d.error ? d.error.slice(0, 24) : ''}{d.attempts > 1 ? ` · ${d.attempts} essais` : ''}</span>
                  <Button size="icon" variant="ghost" className="ml-auto h-6 w-6" title="Renvoyer" onClick={() => replay(d.id)}><RotateCcw className="h-3.5 w-3.5" /></Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StatusDot({ status }: { status: WebhookDelivery['status'] }) {
  const map = { DELIVERED: 'bg-emerald-500', PENDING: 'bg-amber-500', FAILED: 'bg-red-500' }
  const label = { DELIVERED: 'Livré', PENDING: 'En attente', FAILED: 'Échec' }
  return <span className={cn('h-2 w-2 shrink-0 rounded-full', map[status])} title={label[status]} />
}

// ---------------------------------------------------------------- MCP

function SectionMcp({ aUneCle, onCreerCle }: { aUneCle: boolean; onCreerCle: () => void }) {
  const { copie, copier } = useCopie()
  return (
    <>
      {!aUneCle && (
        <p className="flex w-fit max-w-2xl items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <KeyRound className="mt-px h-3.5 w-3.5 shrink-0 text-amber-600" />
          <span>Il vous faut d’abord une clé d’API : l’assistant s’authentifie avec elle. <button onClick={onCreerCle} className="font-semibold underline">Créer une clé</button></span>
        </p>
      )}

      <Bloc titre="Ce que fait l’assistant" aide="Branchez votre propre assistant IA (Claude ou un autre client MCP) sur vos diagnostics. Il répond en langage naturel, en lecture seule, et ne voit que vos dossiers.">
        <div className="grid gap-3 sm:grid-cols-3">
          {['« Budget fenêtres en 2028 »', '« Bâtiments en priorité I »', '« Écart de coûts par canton »'].map((q) => (
            <div key={q} className="flex items-center gap-2.5 rounded-2xl border border-black/[0.06] bg-white/50 p-3 text-sm">
              <img src="/diagly-mark.svg" alt="" className="h-4 w-4 shrink-0" />{q}
            </div>
          ))}
        </div>
      </Bloc>

      <Bloc titre="Adresse du serveur" aide="Transport « Streamable HTTP », authentification par clé d’API dans l’en-tête Authorization.">
        <div className="flex items-center gap-2">
          <code className="flex-1 break-all rounded-xl border border-black/[0.06] bg-neutral-50 px-3 py-2 font-mono text-xs">{MCP_URL}</code>
          <Button size="sm" variant="outline" onClick={() => copier(MCP_URL)}>{copie === MCP_URL ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}Copier</Button>
        </div>
      </Bloc>

      <Bloc titre="Brancher Claude Code" aide="Une commande suffit. Remplacez la clé par la vôtre.">
        <Code langue="Terminal" texte={`claude mcp add --transport http diagly ${MCP_URL} \\\n  --header "Authorization: Bearer dgly_live_…"`} />
      </Bloc>

      <Bloc titre="Outils exposés" aide="Ce que l’assistant peut appeler. Aucun ne modifie vos données.">
        <div className="overflow-hidden rounded-2xl border border-black/[0.06]">
          <div className="divide-y divide-black/[0.05]">
            {OUTILS_MCP.map(([nom, desc]) => (
              <div key={nom} className="flex items-center gap-3 px-4 py-2.5">
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                <code className="w-44 shrink-0 font-mono text-xs text-blue-700">{nom}</code>
                <span className="text-sm text-muted-foreground">{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </Bloc>
    </>
  )
}
