import { useEffect, useState } from 'react'
import { KeyRound, Webhook, Loader2, Plus, Copy, Check, Trash2, ExternalLink, BookOpen, Send, RefreshCw, Eye, EyeOff, ChevronDown, RotateCcw, Bot } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Input, Button, Badge } from '@/components/ui'
import { api, ApiError, BASE_URL } from '@/lib/api'
import type { ApiKey, WebhookEndpoint, WebhookDelivery, WebhookEventType } from '@/lib/api-types'
import { cn } from '@/lib/utils'

const SECTIONS = [
  { id: 'apikeys', label: 'Clés API', icon: KeyRound, desc: 'Accès en lecture à l\'API REST v1' },
  { id: 'webhooks', label: 'Webhooks', icon: Webhook, desc: 'Notifications temps réel des événements' },
  { id: 'mcp', label: 'Assistant IA (MCP)', icon: Bot, desc: 'Branchez votre IA sur vos diagnostics' },
] as const

const EVENT_LABELS: Record<WebhookEventType, string> = {
  'diagnostic.finalise': 'Diagnostic finalisé',
  'rapport.genere': 'Rapport généré',
  'element.modifie': 'Élément modifié',
  'plan_travaux.mis_a_jour': 'Plan de travaux mis à jour',
}
const ALL_EVENTS = Object.keys(EVENT_LABELS) as WebhookEventType[]

export function Integrations() {
  const [active, setActive] = useState<(typeof SECTIONS)[number]['id']>('apikeys')
  const current = SECTIONS.find((s) => s.id === active) ?? SECTIONS[0]

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold">Intégrations</h1>
        <p className="text-sm text-muted-foreground">Clés d'API et webhooks de votre organisation.</p>
      </div>

      <div className="grid lg:grid-cols-[220px_1fr] gap-6">
        <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible -mx-1 px-1 lg:mx-0 lg:px-0 lg:sticky lg:top-2 self-start">
          {SECTIONS.map((s) => {
            const Icon = s.icon
            const on = s.id === active
            return (
              <button key={s.id} onClick={() => setActive(s.id)}
                className={cn('flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors shrink-0 lg:w-full',
                  on ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
                <Icon className="h-4 w-4 shrink-0" />{s.label}
              </button>
            )
          })}
        </nav>

        <div className="min-w-0 space-y-5">
          <div>
            <h2 className="text-lg font-semibold">{current.label}</h2>
            <p className="text-sm text-muted-foreground">{current.desc}</p>
          </div>
          {active === 'apikeys' && <ApiKeysCard />}
          {active === 'webhooks' && <WebhooksCard />}
          {active === 'mcp' && <McpCard />}
        </div>
      </div>
    </div>
  )
}

// ---------------- Clés API ----------------
function ApiKeysCard() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => { try { const r = await api.apiKeys.list(); setKeys(r.keys) } finally { setLoading(false) } }
  useEffect(() => { load() }, [])

  const create = async () => {
    if (!name.trim()) return
    setBusy(true); setError(null); setCreated(null)
    try { const r = await api.apiKeys.create(name.trim()); setCreated(r.key); setName(''); await load() }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Erreur') } finally { setBusy(false) }
  }
  const revoke = async (id: string) => { if (!confirm('Révoquer cette clé ?')) return; await api.apiKeys.revoke(id); await load() }
  const copy = async (v: string) => { try { await navigator.clipboard.writeText(v); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* ignore */ } }
  const activeKeys = keys.filter((k) => !k.revokedAt)

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" />Clés d'API</CardTitle>
          <p className="text-sm text-muted-foreground">Accès en lecture à l'API REST v1 (diagnostics, éléments, coûts, plan de travaux, bâtiments). Une clé = un accès révocable à donner à un partenaire ou un ERP.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {created && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-2">
              <p className="text-sm font-medium text-amber-800">Copiez cette clé maintenant — elle ne sera plus affichée.</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-white border rounded px-2 py-1.5 break-all">{created}</code>
                <Button size="sm" variant="outline" onClick={() => copy(created)}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</Button>
              </div>
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-2">
            <Input placeholder="Nom de la clé (ex. ERP Quorum)" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} />
            <Button onClick={create} disabled={busy || !name.trim()} className="shrink-0">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Créer une clé</Button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {loading ? <div className="py-6 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
            : activeKeys.length === 0 ? <p className="text-sm text-muted-foreground py-2">Aucune clé active.</p>
            : <div className="divide-y border rounded-lg">
                {activeKeys.map((k) => (
                  <div key={k.id} className="flex items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{k.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{k.keyPrefix}… · {k.lastUsedAt ? `utilisée le ${new Date(k.lastUsedAt).toLocaleDateString('fr-CH')}` : 'jamais utilisée'}</p>
                    </div>
                    <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700 shrink-0" onClick={() => revoke(k.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" />Documentation de l'API</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">API REST v1 (lecture seule), documentée en OpenAPI. Auth par en-tête <code className="text-xs bg-muted px-1 rounded">Authorization: Bearer dgly_live_…</code>.</p>
          <div className="flex flex-wrap gap-2">
            <a href={`${BASE_URL}/api/v1/docs`} target="_blank" rel="noopener noreferrer"><Button variant="outline" size="sm"><ExternalLink className="mr-2 h-4 w-4" />Documentation interactive</Button></a>
            <a href={`${BASE_URL}/api/v1/openapi.json`} target="_blank" rel="noopener noreferrer"><Button variant="outline" size="sm"><ExternalLink className="mr-2 h-4 w-4" />Spécification OpenAPI</Button></a>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------- Assistant IA (MCP) ----------------
function McpCard() {
  const [copied, setCopied] = useState(false)
  const endpoint = `${BASE_URL || window.location.origin}/api/mcp`
  const copy = async () => { try { await navigator.clipboard.writeText(endpoint); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* ignore */ } }
  const tools: [string, string][] = [
    ['portfolio_summary', 'Résumé des diagnostics (bâtiments, priorités, budget)'],
    ['search_diagnostics', 'Rechercher des diagnostics'],
    ['get_diagnostic', 'Détail complet d\'un bâtiment'],
    ['query_elements', 'Éléments des diagnostics par CFC / état / priorité'],
    ['aggregate_costs', 'Budget agrégé par canton / année / priorité'],
    ['work_plan', 'Plan de travaux des diagnostics par année'],
  ]
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5" />Assistant IA (serveur MCP)</CardTitle>
          <p className="text-sm text-muted-foreground">Branchez votre propre assistant IA (Claude, etc.) sur vos diagnostics via le protocole MCP. Il interroge vos diagnostics en langage naturel — « budget fenêtres en 2028 », « bâtiments en priorité I », « écart par canton » — en lecture seule, strictement limité à vos diagnostics.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs font-medium mb-1">Adresse du serveur MCP</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-muted rounded px-2 py-1.5 break-all font-mono">{endpoint}</code>
              <Button size="sm" variant="outline" onClick={copy}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">Transport « Streamable HTTP » · authentification par <b>clé d'API</b> (onglet Clés API) en en-tête <code className="text-xs bg-muted px-1 rounded">Authorization: Bearer dgly_live_…</code>.</p>
          </div>
          <div>
            <p className="text-xs font-medium mb-1.5">Outils exposés</p>
            <div className="divide-y border rounded-lg">
              {tools.map(([name, desc]) => (
                <div key={name} className="flex items-center gap-3 px-3 py-2">
                  <code className="text-xs font-mono text-primary w-40 shrink-0">{name}</code>
                  <span className="text-xs text-muted-foreground">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------- Webhooks ----------------
function WebhooksCard() {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([])
  const [loading, setLoading] = useState(true)
  const [url, setUrl] = useState('')
  const [events, setEvents] = useState<WebhookEventType[]>([...ALL_EVENTS])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => { try { const r = await api.webhooks.list(); setEndpoints(r.endpoints) } finally { setLoading(false) } }
  useEffect(() => { load() }, [])

  const create = async () => {
    if (!url.trim() || events.length === 0) return
    setBusy(true); setError(null)
    try { await api.webhooks.create({ url: url.trim(), events }); setUrl(''); await load() }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Erreur') } finally { setBusy(false) }
  }
  const toggleEvent = (ev: WebhookEventType) => setEvents((s) => s.includes(ev) ? s.filter((x) => x !== ev) : [...s, ev])

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Webhook className="h-5 w-5" />Webhooks</CardTitle>
          <p className="text-sm text-muted-foreground">Diagly notifie vos systèmes en temps réel (sans polling). Payload minimal signé HMAC : le destinataire rappelle l'API pour l'état à jour. EGID inclus.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Input placeholder="https://votre-systeme.ch/webhooks/diagly" value={url} onChange={(e) => setUrl(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              {ALL_EVENTS.map((ev) => (
                <button key={ev} onClick={() => toggleEvent(ev)}
                  className={cn('rounded-full border px-3 py-1 text-xs transition-colors', events.includes(ev) ? 'border-primary bg-primary/10 text-primary' : 'border-input text-muted-foreground hover:bg-muted')}>
                  {EVENT_LABELS[ev]}
                </button>
              ))}
            </div>
            <div className="flex justify-end">
              <Button onClick={create} disabled={busy || !url.trim() || events.length === 0}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Ajouter un endpoint</Button>
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}

          {loading ? <div className="py-6 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
            : endpoints.length === 0 ? <p className="text-sm text-muted-foreground py-2">Aucun endpoint. Ajoutez-en un pour recevoir les événements.</p>
            : <div className="space-y-3">{endpoints.map((ep) => <EndpointRow key={ep.id} ep={ep} onChange={load} />)}</div>}
        </CardContent>
      </Card>
    </div>
  )
}

function EndpointRow({ ep, onChange }: { ep: WebhookEndpoint; onChange: () => void }) {
  const [showSecret, setShowSecret] = useState(false)
  const [copied, setCopied] = useState(false)
  const [testing, setTesting] = useState(false)
  const [tested, setTested] = useState(false)
  const [open, setOpen] = useState(false)
  const [deliveries, setDeliveries] = useState<WebhookDelivery[] | null>(null)

  const copy = async (v: string) => { try { await navigator.clipboard.writeText(v); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* ignore */ } }
  const toggleActive = async () => { await api.webhooks.update(ep.id, { active: !ep.active }); onChange() }
  const remove = async () => { if (!confirm('Supprimer cet endpoint ?')) return; await api.webhooks.remove(ep.id); onChange() }
  const rotate = async () => { if (!confirm('Générer un nouveau secret ? L\'ancien cessera de fonctionner.')) return; await api.webhooks.rotateSecret(ep.id); onChange() }
  const test = async () => { setTesting(true); try { await api.webhooks.test(ep.id); setTested(true); setTimeout(() => setTested(false), 2500) } finally { setTesting(false) } }
  const loadDeliveries = async () => { const r = await api.webhooks.deliveries(ep.id); setDeliveries(r.deliveries) }
  const openLog = async () => { const next = !open; setOpen(next); if (next) await loadDeliveries() }
  const replay = async (id: string) => { await api.webhooks.replay(id); await loadDeliveries() }

  return (
    <div className={cn('rounded-lg border', !ep.active && 'opacity-60')}>
      <div className="p-3 space-y-2">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium break-all">{ep.url}</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {ep.events.map((e) => <Badge key={e} variant="outline" className="text-[10px]">{EVENT_LABELS[e as WebhookEventType] ?? e}</Badge>)}
            </div>
          </div>
          <Badge className={cn('shrink-0', ep.active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500')}>{ep.active ? 'Actif' : 'Inactif'}</Badge>
        </div>

        {/* Secret */}
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs bg-muted rounded px-2 py-1 break-all font-mono">{showSecret ? ep.secret : `${ep.secret.slice(0, 10)}${'•'.repeat(16)}`}</code>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowSecret((s) => !s)}>{showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copy(ep.secret)}>{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}</Button>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          <Button size="sm" variant="outline" onClick={test} disabled={testing}>{tested ? <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-600" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}Tester</Button>
          <Button size="sm" variant="outline" onClick={openLog}><ChevronDown className={cn('mr-1.5 h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />Livraisons</Button>
          <Button size="sm" variant="outline" onClick={toggleActive}>{ep.active ? 'Désactiver' : 'Activer'}</Button>
          <Button size="sm" variant="ghost" onClick={rotate}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Secret</Button>
          <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700 ml-auto" onClick={remove}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      </div>

      {/* Journal des livraisons */}
      {open && (
        <div className="border-t bg-muted/30 p-3">
          {deliveries === null ? <div className="py-3 text-center"><Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" /></div>
            : deliveries.length === 0 ? <p className="text-xs text-muted-foreground py-2">Aucune livraison pour l'instant.</p>
            : <div className="space-y-1">
                {deliveries.map((d) => (
                  <div key={d.id} className="flex items-center gap-2 text-xs bg-background rounded px-2 py-1.5">
                    <StatusDot status={d.status} />
                    <span className="font-medium w-40 truncate">{d.eventType}</span>
                    <span className="text-muted-foreground">{new Date(d.createdAt).toLocaleString('fr-CH')}</span>
                    <span className="text-muted-foreground">{d.responseStatus ? `HTTP ${d.responseStatus}` : d.error ? d.error.slice(0, 24) : ''}{d.attempts > 1 ? ` · ${d.attempts} essais` : ''}</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6 ml-auto" title="Rejouer" onClick={() => replay(d.id)}><RotateCcw className="h-3.5 w-3.5" /></Button>
                  </div>
                ))}
              </div>}
        </div>
      )}
    </div>
  )
}

function StatusDot({ status }: { status: WebhookDelivery['status'] }) {
  const map = { DELIVERED: 'bg-emerald-500', PENDING: 'bg-amber-500', FAILED: 'bg-red-500' }
  return <span className={cn('h-2 w-2 rounded-full shrink-0', map[status])} title={status} />
}
