import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, ChevronDown, BookOpen, Loader2, Sparkles, Plus, MessageSquare, ArrowRight, LifeBuoy } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Input, Button, Badge } from '@/components/ui'
import { api } from '@/lib/api'
import { FAQ, GUIDES } from '@/data/support'
import type { SupportStatus } from '@/lib/api-types'
import { cn } from '@/lib/utils'

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const STATUS: Record<SupportStatus, { label: string; cls: string }> = {
  OPEN: { label: 'Ouvert', cls: 'bg-blue-50 text-blue-700' },
  ANSWERED: { label: 'Répondu', cls: 'bg-emerald-50 text-emerald-700' },
  CLOSED: { label: 'Clos', cls: 'bg-gray-100 text-gray-500' },
}

export function Support() {
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState<string>(FAQ[0].id)
  const q = norm(search.trim())
  const searching = q.length > 0

  // En recherche : résultats de toutes les catégories (avec étiquette). Sinon : la catégorie choisie.
  const results = useMemo(() => {
    if (searching) return FAQ.flatMap((c) => c.items.filter((it) => norm(it.q).includes(q) || norm(it.a).includes(q)).map((it) => ({ ...it, tag: c.label as string | undefined })))
    return (FAQ.find((c) => c.id === cat)?.items ?? []).map((it) => ({ ...it, tag: undefined as string | undefined }))
  }, [q, cat, searching])
  const currentLabel = FAQ.find((c) => c.id === cat)?.label ?? ''

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold">Aide & support</h1>
        <p className="text-sm text-muted-foreground">Trouvez une réponse dans la FAQ et les guides, ou contactez notre support.</p>
      </div>

      {/* Contacter le support — pleine largeur, bien visible */}
      <SupportSection />

      {/* Questions fréquentes — menu de catégories + questions */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Questions fréquentes</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher une question…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>

        <div className="grid md:grid-cols-[220px_1fr] gap-5 items-start">
          {/* Menu catégories */}
          <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible -mx-1 px-1 md:mx-0 md:px-0 md:sticky md:top-4">
            {FAQ.map((c) => {
              const on = !searching && c.id === cat
              return (
                <button key={c.id} onClick={() => { setSearch(''); setCat(c.id) }}
                  className={cn('flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors shrink-0 md:w-full text-left',
                    on ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
                  <span className="truncate">{c.label}</span>
                  <span className={cn('text-[11px] shrink-0', on ? 'text-primary/70' : 'text-muted-foreground/60')}>{c.items.length}</span>
                </button>
              )
            })}
          </nav>

          {/* Questions */}
          <Card className="min-w-0">
            <CardHeader className="py-3 border-b">
              <CardTitle className="text-base">{searching ? `Résultats pour « ${search.trim()} »` : currentLabel}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {results.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Aucune réponse trouvée. Contactez le support ci-dessus.</p>
              ) : (
                <div className="divide-y">
                  {results.map((it, i) => <FaqRow key={i} q={it.q} a={it.a} tag={it.tag} defaultOpen={searching} />)}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Guides */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2"><BookOpen className="h-5 w-5" />Guides pas-à-pas</h2>
        <div className="grid sm:grid-cols-2 gap-3">{GUIDES.map((g) => <GuideCard key={g.id} guide={g} />)}</div>
      </div>
    </div>
  )
}

function SupportSection() {
  const navigate = useNavigate()
  const ticketsQuery = useQuery({ queryKey: ['support-tickets'], queryFn: () => api.support.tickets() })
  const tickets = ticketsQuery.data?.tickets ?? []

  return (
    <Card className="border-primary/20">
      <CardContent className="p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><LifeBuoy className="h-6 w-6" /></div>
          <div className="flex-1">
            <p className="font-semibold">Contacter le support</p>
            <p className="text-sm text-muted-foreground">Notre équipe vous répond. Joignez des captures d'écran et suivez l'avancement de votre demande.</p>
          </div>
          <Button size="lg" className="shrink-0" onClick={() => navigate('/app/support/new')}><Plus className="mr-2 h-4 w-4" />Nouvelle demande</Button>
        </div>

        {/* Mes demandes */}
        {ticketsQuery.isLoading ? (
          <div className="py-4 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
        ) : tickets.length > 0 && (
          <div className="border-t pt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" />Mes demandes</p>
            <div className="divide-y border rounded-lg">
              {tickets.map((t) => (
                <button key={t.id} onClick={() => navigate(`/app/support/${t.id}`)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40">
                  <Badge className={cn('text-[10px] shrink-0', STATUS[t.status].cls)}>{STATUS[t.status].label}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{t.subject}</p>
                    <p className="text-xs text-muted-foreground truncate">{t.lastIsSupport ? '↩ Réponse du support · ' : ''}{t.lastMessage}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">{new Date(t.updatedAt ?? t.createdAt).toLocaleDateString('fr-CH')}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="border-t pt-4 flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">Besoin d'une réponse immédiate ? L'assistant IA Diagly (en bas du menu) répond en direct sur vos diagnostics et les fonctionnalités.</p>
        </div>
      </CardContent>
    </Card>
  )
}

function FaqRow({ q, a, tag, defaultOpen }: { q: string; a: string; tag?: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/40">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{q}</p>
          {tag && <span className="text-[11px] text-muted-foreground">{tag}</span>}
        </div>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && <p className="px-4 pb-4 -mt-1 text-sm text-muted-foreground leading-relaxed">{a}</p>}
    </div>
  )
}

function GuideCard({ guide }: { guide: (typeof GUIDES)[number] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-lg border p-3">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-start gap-2 text-left">
        <div className="min-w-0 flex-1"><p className="text-sm font-medium">{guide.title}</p><p className="text-xs text-muted-foreground">{guide.summary}</p></div>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform mt-0.5', open && 'rotate-180')} />
      </button>
      {open && <ol className="mt-3 space-y-1.5 list-decimal list-inside text-xs text-muted-foreground">{guide.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>}
    </div>
  )
}
