import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Search, ChevronDown, ChevronRight, Loader2, Sparkles, Plus, MessageSquare, ArrowRight,
  Rocket, ClipboardCheck, Banknote, Ruler, FileText, Database, Users, Clock, BookOpen,
  GraduationCap, HelpCircle, LifeBuoy, CornerDownRight, Compass, FolderPlus, LayoutGrid,
  Check, Play,
} from 'lucide-react'
import { Card, CardContent, Input, Button, Badge } from '@/components/ui'
import { api } from '@/lib/api'
import { FAQ } from '@/data/support'
import { ARTICLES, CATEGORIES, TUTORIELS, type Article, type CategorieDoc, type Tutoriel } from '@/data/documentation'
import { chercherDansLAide, minutesDeLecture, type ResultatAide } from '@/lib/recherche-aide'
import { VISITES, type Visite } from '@/data/visites'
import { useVisite } from '@/stores/visite'
import type { SupportStatus } from '@/lib/api-types'
import { cn } from '@/lib/utils'

const STATUS: Record<SupportStatus, { label: string; cls: string }> = {
  OPEN: { label: 'Ouvert', cls: 'bg-blue-50 text-blue-700' },
  ANSWERED: { label: 'Répondu', cls: 'bg-emerald-50 text-emerald-700' },
  CLOSED: { label: 'Clos', cls: 'bg-gray-100 text-gray-500' },
}

/** Les données ne connaissent pas React : la clé d'icône se résout ici. */
const ICONES: Record<CategorieDoc['icone'], typeof Rocket> = {
  depart: Rocket, releve: ClipboardCheck, argent: Banknote, plan: Ruler,
  rapport: FileText, donnees: Database, compte: Users,
}

const ICONES_VISITE: Record<Visite['icone'], typeof Compass> = {
  boussole: Compass, dossier: FolderPlus, onglets: LayoutGrid, aide: LifeBuoy,
}

const NIVEAUX: Record<Tutoriel['niveau'], string> = {
  'Débutant': 'bg-emerald-50 text-emerald-700',
  'Intermédiaire': 'bg-blue-50 text-blue-700',
  'Avancé': 'bg-violet-50 text-violet-700',
}

type Onglet = 'doc' | 'tuto' | 'faq' | 'demandes'

const ONGLETS: { id: Onglet; label: string; icon: typeof BookOpen }[] = [
  { id: 'doc', label: 'Documentation', icon: BookOpen },
  { id: 'tuto', label: 'Tutoriels', icon: GraduationCap },
  { id: 'faq', label: 'Questions fréquentes', icon: HelpCircle },
  { id: 'demandes', label: 'Mes demandes', icon: MessageSquare },
]

export function Support() {
  const [onglet, setOnglet] = useState<Onglet>('doc')
  const [recherche, setRecherche] = useState('')
  const resultats = useMemo(
    () => chercherDansLAide(recherche, { articles: ARTICLES, tutoriels: TUTORIELS, faq: FAQ }),
    [recherche],
  )
  const enRecherche = recherche.trim().length >= 2

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-bold">Centre d’aide</h1>
        <p className="text-sm text-muted-foreground">
          La documentation, les tutoriels pas à pas et les réponses aux questions courantes. Et notre équipe, si rien de tout cela ne suffit.
        </p>
      </div>

      {/* La barre de recherche passe avant les catégories : personne ne parcourt
          un sommaire quand il a une question précise. */}
      <div className="relative" data-visite="aide-recherche">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher : étalonnage, TVA, EGID, webhook…"
          className="h-12 rounded-xl pl-11 text-[15px]"
          aria-label="Rechercher dans l’aide"
        />
      </div>

      {enRecherche ? (
        <Resultats requete={recherche} resultats={resultats} onEffacer={() => setRecherche('')} />
      ) : (
        <>
          <nav data-visite="aide-onglets" className="flex gap-1 overflow-x-auto rounded-[20px] border border-black/[0.05] bg-neutral-100/70 p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Sections de l’aide">
            {ONGLETS.map((o) => {
              const on = o.id === onglet
              return (
                <button
                  key={o.id}
                  onClick={() => setOnglet(o.id)}
                  aria-current={on ? 'page' : undefined}
                  className={cn(
                    'flex shrink-0 items-center gap-2.5 rounded-2xl px-4 py-2.5 text-[14.5px] font-semibold transition-all',
                    on ? 'bg-white text-neutral-900 shadow-[0_1px_3px_rgba(0,0,0,0.12),0_1px_1px_rgba(0,0,0,0.04)]' : 'text-neutral-500 hover:text-neutral-900',
                  )}
                >
                  <o.icon className={cn('h-[19px] w-[19px] shrink-0 transition-colors', on ? 'text-blue-600' : 'text-neutral-400')} strokeWidth={1.9} />
                  <span className="whitespace-nowrap">{o.label}</span>
                </button>
              )
            })}
          </nav>

          {onglet === 'doc' && <><Presentation /><Documentation /></>}
          {onglet === 'tuto' && <Tutoriels />}
          {onglet === 'faq' && <QuestionsFrequentes />}
          {onglet === 'demandes' && <MesDemandes />}
        </>
      )}

      <BesoinDAide />
    </div>
  )
}

// ------------------------------------------------------------------ recherche

/**
 * L'offre de visite, en haut du centre d'aide.
 *
 * Elle se présente avant qu'on ait cherché quoi que ce soit : une visite sert
 * surtout à qui ne sait pas encore quoi chercher.
 */
function Presentation() {
  const demarrer = useVisite((s) => s.demarrer)
  const terminees = useVisite((s) => s.terminees)

  return (
    <Card className="overflow-hidden bg-gradient-to-br from-blue-50/80 to-white">
      <CardContent className="flex flex-col items-center gap-4 p-5 sm:flex-row sm:items-center sm:gap-5">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm">
          <Compass className="h-6 w-6" strokeWidth={1.9} />
        </span>
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <p className="font-semibold">Faire le tour de l’application</p>
          <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
            Une visite guidée ouvre chaque écran, entoure le bouton dont elle parle, et vous laisse cliquer dessus en chemin. Les autres visites se lancent depuis l’onglet Tutoriels.
          </p>
        </div>
        <Button className="shrink-0" onClick={() => demarrer('decouverte')}>
          <Play className="mr-2 h-4 w-4" />
          {terminees.includes('decouverte') ? 'Refaire le tour' : 'Faire le tour'}
        </Button>
      </CardContent>
    </Card>
  )
}

function Resultats({ requete, resultats, onEffacer }: { requete: string; resultats: ResultatAide[]; onEffacer: () => void }) {
  if (resultats.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm font-medium">Rien ne correspond à « {requete.trim()} »</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Essayez un mot plus court, ou décrivez votre question à notre équipe : nous répondons et nous ajoutons la réponse à cette documentation.
          </p>
          <Button variant="outline" className="mt-4" onClick={onEffacer}>Revenir à l’aide</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        {resultats.length} résultat{resultats.length > 1 ? 's' : ''} pour « {requete.trim()} »
      </p>
      <Card>
        <div className="divide-y">
          {resultats.map((r) => (r.lien ? <ResultatLien key={`${r.type}-${r.cle}`} r={r} /> : <ResultatFaq key={`${r.type}-${r.cle}`} r={r} />))}
        </div>
      </Card>
    </div>
  )
}

function ResultatLien({ r }: { r: ResultatAide }) {
  return (
    <Link to={r.lien!} className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{r.titre}</p>
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{r.extrait}</p>
        <span className="mt-1 inline-block text-[11px] font-medium text-blue-700">{r.contexte}</span>
      </div>
      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  )
}

function ResultatFaq({ r }: { r: ResultatAide }) {
  const [ouvert, setOuvert] = useState(false)
  return (
    <div>
      <button onClick={() => setOuvert((o) => !o)} className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/40">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{r.titre}</p>
          {!ouvert && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{r.extrait}</p>}
          <span className="mt-1 inline-block text-[11px] font-medium text-muted-foreground">{r.contexte}</span>
        </div>
        <ChevronDown className={cn('mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform', ouvert && 'rotate-180')} />
      </button>
      {ouvert && <p className="px-4 pb-4 text-sm leading-relaxed text-muted-foreground">{r.reponse}</p>}
    </div>
  )
}

// -------------------------------------------------------------- documentation

function Documentation() {
  return (
    <div className="space-y-4">
      {CATEGORIES.map((c) => {
        const articles = ARTICLES.filter((a) => a.categorie === c.id)
        if (articles.length === 0) return null
        const Icon = ICONES[c.icone]
        return (
          <Card key={c.id}>
            <div className="flex items-center gap-3 border-b px-5 py-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Icon className="h-5 w-5" strokeWidth={1.9} />
              </span>
              <div className="min-w-0">
                <p className="font-semibold leading-tight">{c.label}</p>
                <p className="truncate text-xs text-muted-foreground">{c.description}</p>
              </div>
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">{articles.length} article{articles.length > 1 ? 's' : ''}</span>
            </div>
            <div className="divide-y">
              {articles.map((a) => <LigneArticle key={a.slug} article={a} />)}
            </div>
          </Card>
        )
      })}
    </div>
  )
}

function LigneArticle({ article }: { article: Article }) {
  return (
    <Link to={`/app/support/doc/${article.slug}`} className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-muted/40">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{article.titre}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{article.resume}</p>
      </div>
      <span className="mt-0.5 flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
        <Clock className="h-3 w-3" />{minutesDeLecture(article)} min
      </span>
      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  )
}

// ------------------------------------------------------------------ tutoriels

function Tutoriels() {
  return (
    <div className="space-y-7">
      <VisitesGuidees />

      <div className="space-y-3">
        <div>
          <h2 className="font-semibold">Tutoriels à lire</h2>
          <p className="text-sm text-muted-foreground">
            Les mêmes parcours, écrits. Chaque étape se coche : vous pouvez interrompre et reprendre plus tard.
          </p>
        </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {TUTORIELS.map((t) => (
          <Link
            key={t.slug}
            to={`/app/support/tuto/${t.slug}`}
            className="group flex flex-col rounded-2xl border border-black/[0.06] bg-card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-shadow hover:shadow-[0_1px_2px_rgba(0,0,0,0.03),0_12px_32px_-16px_rgba(0,0,0,0.18)]"
          >
            <div className="mb-2 flex items-center gap-2">
              <Badge className={cn('text-[10px]', NIVEAUX[t.niveau])}>{t.niveau}</Badge>
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground"><Clock className="h-3 w-3" />{t.duree}</span>
              <span className="text-[11px] text-muted-foreground">· {t.etapes.length} étapes</span>
            </div>
            <p className="font-semibold leading-tight">{t.titre}</p>
            <p className="mt-1 flex-1 text-xs leading-relaxed text-muted-foreground">{t.objectif}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-blue-700">
              Lire<ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
        </div>
      </div>
    </div>
  )
}

/** Les visites menées dans l'application même. */
function VisitesGuidees() {
  const demarrer = useVisite((s) => s.demarrer)
  const terminees = useVisite((s) => s.terminees)

  return (
    <div className="space-y-3" data-visite="aide-visites">
      <div>
        <h2 className="font-semibold">Visites guidées</h2>
        <p className="text-sm text-muted-foreground">
          Elles vous emmènent dans l’application et désignent les écrans au fur et à mesure. Vous gardez la main : l’élément entouré reste cliquable.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {VISITES.map((v) => {
          const Icon = ICONES_VISITE[v.icone]
          const faite = terminees.includes(v.id)
          return (
            <div key={v.id} className="flex flex-col rounded-2xl border border-blue-100 bg-blue-50/40 p-5">
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-blue-600 shadow-sm">
                  <Icon className="h-4 w-4" strokeWidth={2} />
                </span>
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground"><Clock className="h-3 w-3" />{v.duree}</span>
                <span className="text-[11px] text-muted-foreground">· {v.etapes.length} étapes</span>
                {faite && (
                  <span className="ml-auto flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                    <Check className="h-3 w-3" strokeWidth={3} />Faite
                  </span>
                )}
              </div>
              <p className="font-semibold leading-tight">{v.titre}</p>
              <p className="mt-1 flex-1 text-xs leading-relaxed text-muted-foreground">{v.objectif}</p>
              <Button size="sm" className="mt-3 self-start" onClick={() => demarrer(v.id)}>
                <Play className="mr-2 h-3.5 w-3.5" />{faite ? 'Refaire' : 'Me guider'}
              </Button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// --------------------------------------------------------- questions fréquentes

function QuestionsFrequentes() {
  const [cat, setCat] = useState(FAQ[0].id)
  const courante = FAQ.find((c) => c.id === cat) ?? FAQ[0]

  return (
    <div className="grid items-start gap-5 md:grid-cols-[220px_1fr]">
      <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 md:mx-0 md:flex-col md:overflow-visible md:px-0">
        {FAQ.map((c) => {
          const on = c.id === cat
          return (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              className={cn('flex shrink-0 items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors md:w-full',
                on ? 'bg-blue-50 text-blue-700' : 'text-neutral-600 hover:bg-black/[0.03] hover:text-neutral-900')}
            >
              <span className="truncate">{c.label}</span>
              <span className={cn('shrink-0 text-[11px]', on ? 'text-blue-700/70' : 'text-muted-foreground/60')}>{c.items.length}</span>
            </button>
          )
        })}
      </nav>

      <Card className="min-w-0">
        <div className="divide-y">
          {courante.items.map((it, i) => <Question key={i} q={it.q} a={it.a} />)}
        </div>
      </Card>
    </div>
  )
}

function Question({ q, a }: { q: string; a: string }) {
  const [ouvert, setOuvert] = useState(false)
  return (
    <div>
      <button onClick={() => setOuvert((o) => !o)} className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-muted/40">
        <p className="min-w-0 flex-1 text-sm font-medium">{q}</p>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', ouvert && 'rotate-180')} />
      </button>
      {ouvert && <p className="px-5 pb-4 text-sm leading-relaxed text-muted-foreground">{a}</p>}
    </div>
  )
}

// ---------------------------------------------------------------- mes demandes

function MesDemandes() {
  const navigate = useNavigate()
  const demandes = useQuery({ queryKey: ['support-tickets'], queryFn: () => api.support.tickets() })
  const tickets = demandes.data?.tickets ?? []

  if (demandes.isLoading) {
    return <div className="py-12 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {tickets.length === 0 ? 'Vous n’avez encore écrit à notre équipe.' : `${tickets.length} demande${tickets.length > 1 ? 's' : ''}.`}
        </p>
        <Button onClick={() => navigate('/app/support/new')}><Plus className="mr-2 h-4 w-4" />Nouvelle demande</Button>
      </div>

      {tickets.length > 0 && (
        <Card>
          <div className="divide-y">
            {tickets.map((t) => (
              <button key={t.id} onClick={() => navigate(`/app/support/${t.id}`)} className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-muted/40">
                <Badge className={cn('shrink-0 text-[10px]', STATUS[t.status].cls)}>{STATUS[t.status].label}</Badge>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.subject}</p>
                  <p className="truncate text-xs text-muted-foreground">{t.lastIsSupport ? '↩ Réponse du support · ' : ''}{t.lastMessage}</p>
                </div>
                <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">{new Date(t.updatedAt ?? t.createdAt).toLocaleDateString('fr-CH')}</span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

// ------------------------------------------------------------------- contact

/** Le recours, quand la documentation n'a pas suffi. Discret, mais toujours là. */
function BesoinDAide() {
  const navigate = useNavigate()
  return (
    <Card data-visite="aide-contact">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <LifeBuoy className="h-5 w-5" strokeWidth={1.9} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Vous ne trouvez pas votre réponse ?</p>
          <p className="text-sm text-muted-foreground">
            Écrivez à notre équipe, captures d’écran comprises, et suivez l’avancement depuis Mes demandes.
          </p>
          <p className="mt-1.5 flex items-start gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600" />
            Pour une réponse immédiate, l’assistant Diagly, en bas du menu, répond en direct sur vos diagnostics.
          </p>
        </div>
        <Button variant="outline" className="shrink-0" onClick={() => navigate('/app/support/new')}>
          <CornerDownRight className="mr-2 h-4 w-4" />Nous écrire
        </Button>
      </CardContent>
    </Card>
  )
}
