import { useEffect, useMemo, useRef, type CSSProperties } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight, ChevronRight, Plus, ClipboardCheck, FileText, Layers,
  FilePlus, History, MapPin, Ruler, type LucideIcon,
} from 'lucide-react'
import { formatDate, formatCHF, cn } from '@/lib/utils'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'
import { useAuth } from '@/stores/auth'
import { statusLabels } from '@/data/mock'
import type { ProjectStatus } from '@/lib/api-types'

const glass = (alpha: number): CSSProperties => ({ background: `rgba(255,255,255,${alpha})` })

// L'assistant porte le picto Diagly plutôt qu'une icône générique. Les Métrés
// ouvrent leur page : on y dépose un jeu de plans, l'IA en propose les
// quantités. Ils prennent la place de « Mes diagnostics », que la carte du
// même nom, juste dessous, ouvre déjà avec ses compteurs : la grille reste à
// quatre accès, et tient dans son cadre sur iPad comme sur ordinateur.
const QUICK: { icon: LucideIcon; img?: string; title: string; desc: string; to: string }[] = [
  { icon: Ruler, title: 'Métrés', desc: 'Déposer des plans', to: '/app/metres' },
  { icon: Plus, title: 'Nouveau diagnostic', desc: 'Créer un dossier', to: '/app/projects/new' },
  { icon: FileText, title: 'Base de données', desc: 'Articles et prix', to: '/app/cfc' },
  { icon: ClipboardCheck, img: '/diagly-mark.svg', title: 'Assistant Diagly', desc: 'Poser une question', to: '/app/assistant' },
]

const STATUS_PILL: Record<ProjectStatus, { dot: string; pill: string }> = {
  NON_PLANIFIE: { dot: 'bg-gray-400', pill: 'bg-gray-100 text-gray-600' },
  PLANIFIE: { dot: 'bg-blue-400', pill: 'bg-blue-50 text-blue-700' },
  EN_COURS: { dot: 'bg-blue-500', pill: 'bg-blue-50 text-blue-700' },
  EN_REVUE: { dot: 'bg-amber-500', pill: 'bg-amber-50 text-amber-700' },
  TERMINE: { dot: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700' },
  ARCHIVE: { dot: 'bg-gray-400', pill: 'bg-gray-100 text-gray-500' },
}

// Teintes colorées des icônes (option « colorIcons » de la maquette)
const TINTS = [
  'bg-violet-100/80 text-violet-600',
  'bg-emerald-100/80 text-emerald-600',
  'bg-sky-100/80 text-sky-600',
  'bg-amber-100/80 text-amber-600',
  'bg-rose-100/80 text-rose-600',
]

export function Dashboard() {
  const user = useAuth((s) => s.user)
  const { data } = useQuery({ queryKey: ['projects'], queryFn: () => api.projects.list() })
  const { data: itemsData } = useQuery({ queryKey: ['recent-items'], queryFn: () => api.diagnostics.recentItems() })

  // Références stables : sans useMemo, `?? []` crée un tableau neuf à chaque rendu,
  // ce qui invalide toutes les mémorisations en aval (fil d'activité).
  const projects = useMemo(() => data?.projects ?? [], [data])
  const recentItems = useMemo(() => itemsData?.items ?? [], [itemsData])

  const recentProjects = useMemo(
    () => [...projects].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [projects],
  )
  // Le dernier diagnostic touché : c'est presque toujours celui qu'on rouvre.
  const lastProject = recentProjects[0]

  // Ses chiffres : mêmes clés de cache que l'éditeur, qui les a souvent déjà chargés.
  const { data: lastProjectData } = useQuery({
    queryKey: ['project', lastProject?.id],
    queryFn: () => api.projects.get(lastProject!.id),
    enabled: !!lastProject,
  })
  const lastDiag = useMemo(
    () => [...(lastProjectData?.diagnostics ?? [])].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0],
    [lastProjectData],
  )
  const { data: lastDiagData } = useQuery({
    queryKey: ['diagnostic', lastDiag?.id],
    queryFn: () => api.diagnostics.get(lastDiag!.id),
    enabled: !!lastDiag,
  })
  const lastStats = useMemo(() => {
    const items = lastDiagData?.items ?? []
    return {
      releves: items.length,
      urgents: items.filter((it) => it.priority === 'I').length,
      cout: items.reduce((s, it) => s + (it.estimatedCost ? Number(it.estimatedCost) : 0), 0),
    }
  }, [lastDiagData])

  const greeting = user?.firstName ? `Bonjour ${user.firstName}` : 'Bonjour'

  // L'image de fond (AppLayout) descend jusque sous la carte « Reprendre » et
  // s'y efface : on lui donne le bas de la carte, mesuré depuis le haut de la
  // zone principale, et remesuré quand la page change de taille (iPad tourné,
  // menu replié).
  const carteReprendre = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const carte = carteReprendre.current
    const zone = carte?.closest<HTMLElement>('[data-zone-principale]')
    if (!carte || !zone) return
    const racine = document.documentElement
    const mesurer = () => {
      const defilement = carte.closest('main')?.scrollTop ?? 0
      const bas = carte.getBoundingClientRect().bottom - zone.getBoundingClientRect().top + defilement
      racine.style.setProperty('--hauteur-image', `${Math.round(bas + 24)}px`)
    }
    mesurer()
    const o = new ResizeObserver(mesurer)
    o.observe(carte)
    o.observe(zone)
    return () => {
      o.disconnect()
      racine.style.removeProperty('--hauteur-image')
    }
  }, [])

  // Fil d'activité dérivé : projets créés / diagnostics mis à jour + éléments ajoutés.
  const activity = useMemo(() => {
    type A = { id: string; ts: string; icon: typeof ClipboardCheck; title: string; sub: string; to: string }
    const acc: A[] = []
    for (const p of projects) {
      const isNew = new Date(p.updatedAt).getTime() - new Date(p.createdAt).getTime() < 5 * 60_000
      acc.push(isNew
        ? { id: 'pc' + p.id, ts: p.createdAt, icon: FilePlus, title: 'Nouveau diagnostic', sub: p.name, to: `/app/projects/${p.id}` }
        : { id: 'pu' + p.id, ts: p.updatedAt, icon: ClipboardCheck, title: 'Diagnostic mis à jour', sub: p.name, to: `/app/projects/${p.id}` })
    }
    for (const it of recentItems) {
      acc.push({ id: 'i' + it.id, ts: it.updatedAt, icon: Layers, title: it.cfcLabel, sub: it.projectName, to: `/app/projects/${it.projectId}/diagnostic?item=${it.id}` })
    }
    return acc.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()).slice(0, 10)
  }, [projects, recentItems])

  const STATS = lastProject ? [
    { label: 'Relevés', value: lastDiagData ? String(lastStats.releves) : '…' },
    { label: 'Urgents', value: lastDiagData ? String(lastStats.urgents) : '…', alert: lastStats.urgents > 0 },
    { label: 'Coût estimé HT', value: lastDiagData ? (lastStats.cout ? formatCHF(lastStats.cout) : 'n.c.') : '…' },
    { label: 'Visite', value: lastDiag?.visitDate ? formatDate(new Date(lastDiag.visitDate)) : 'Non planifiée' },
  ] : []

  // Mêmes regroupements que les onglets de la liste des diagnostics.
  const COMPTEURS = [
    { onglet: 'En cours', label: 'En cours', dot: 'bg-blue-500', value: projects.filter((p) => ['PLANIFIE', 'EN_COURS', 'EN_REVUE'].includes(p.status)).length },
    { onglet: 'À traiter', label: 'À planifier', dot: 'bg-gray-400', value: projects.filter((p) => p.status === 'NON_PLANIFIE').length },
    { onglet: 'Terminés', label: 'Terminés', dot: 'bg-emerald-500', value: projects.filter((p) => p.status === 'TERMINE').length },
    { onglet: 'Tous', label: 'Total', dot: 'bg-neutral-300', value: projects.length },
  ]

  const btn = 'inline-flex h-10 items-center gap-2 rounded-xl border border-black/10 bg-white/80 px-4 text-sm font-medium text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-colors hover:border-black/[0.14] hover:bg-white'

  // Chaque bloc garde sa hauteur naturelle : aucun cadre ne s'étire à vide, et
  // les écrans bas n'affichent que les premières lignes de chaque liste pour
  // que la page tienne sans défiler.
  return (
    <div className="flex flex-col gap-6 pb-6 short:gap-3 tablette:h-full tablette:min-h-0 tablette:pb-0 lg:h-full lg:min-h-0 lg:pb-0">
      {/* Salutation */}
      <div className="shrink-0">
        <h1 className="text-[40px] font-normal leading-none tracking-tight text-foreground short:text-[30px]">{greeting}</h1>
        <p className="mt-2.5 text-[15px] text-muted-foreground short:hidden">Prêt à piloter vos diagnostics du jour&nbsp;?</p>
      </div>

      {/* Dossier mis en avant : le dernier modifié */}
      {/* Couché, l'iPad la gardait presque pleine largeur : elle s'arrête aux
          deux tiers environ, l'image restant visible à côté. */}
      <div ref={carteReprendre} className="liquid-glass relative overflow-hidden rounded-[26px] lg:max-w-[min(720px,62%)]" style={glass(0.72)} data-visite="dash-reprendre">
        <div className="relative z-10 p-5 sm:p-6 short:sm:p-5">
          {lastProject ? (
            <>
              {/* Le bouton monte dans l'en-tête et le statut suit l'étiquette : la
                  carte tient sur une largeur réduite, chiffres sur une seule ligne. */}
              <div className="flex items-start gap-3.5">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100/80 text-blue-600"><History className="h-[18px] w-[18px]" strokeWidth={1.8} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Reprendre</span>
                    <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium', STATUS_PILL[lastProject.status].pill)}>
                      <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_PILL[lastProject.status].dot)} />{statusLabels[lastProject.status]}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[21px] font-medium leading-tight tracking-tight text-foreground">{lastProject.name}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-[13px] text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
                    <span className="truncate">{[lastProject.address, lastProject.city].filter(Boolean).join(', ') || 'Adresse non renseignée'}</span>
                  </p>
                </div>
                <Link to={`/app/projects/${lastProject.id}/diagnostic`} className={cn(btn, 'shrink-0')}>
                  Reprendre le relevé <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                </Link>
              </div>

              <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3 border-t border-black/[0.06] pt-4 short:mt-3 short:pt-3">
                {STATS.map((st) => (
                  <div key={st.label} className="shrink-0">
                    <p className="text-[11px] text-muted-foreground">{st.label}</p>
                    <p className={cn('mt-0.5 whitespace-nowrap text-[16px] font-semibold tracking-tight', st.alert ? 'text-red-600' : 'text-foreground')}>{st.value}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[20px] font-medium tracking-tight text-foreground">Aucun diagnostic pour le moment</p>
                <p className="mt-1 text-[13px] text-muted-foreground">Créez votre premier dossier pour commencer un relevé.</p>
              </div>
              <Link to="/app/projects/new" className={btn}>
                <Plus className="h-4 w-4" strokeWidth={1.8} /> Nouveau diagnostic
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Grille : Accès rapides | Activité récente */}
      <div className="grid gap-5 short:gap-3 tablette:min-h-0 tablette:flex-1 tablette:grid-rows-[auto_minmax(0,1fr)] lg:min-h-0 lg:flex-1 lg:grid-cols-[1.6fr_1fr] lg:grid-rows-[minmax(0,1fr)]">
        <div className="flex min-h-0 flex-col gap-5 short:gap-3">
          <section className="liquid-glass flex min-h-0 flex-col rounded-[24px] p-5 lg:flex-1" style={glass(1)}>
            <h2 className="mb-4 text-[16px] font-semibold text-foreground short:mb-3">Accès rapides</h2>
            <div className="grid grid-cols-2 gap-3 lg:min-h-0 lg:flex-1 2xl:grid-cols-4">
              {QUICK.map((q) => (
                <Link key={q.title} to={q.to} className="group flex items-center gap-3 rounded-2xl lg:flex-col lg:justify-center lg:text-center short:xl:flex-row short:xl:justify-start short:xl:text-left border border-black/[0.05] bg-white/45 p-3 transition-all hover:-translate-y-0.5 hover:bg-white/80 hover:shadow-[0_14px_40px_-16px_rgba(0,0,0,0.22)] short:py-2">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full lg:h-14 lg:w-14 short:lg:h-8 short:lg:w-8 bg-neutral-900/[0.05] text-muted-foreground transition-colors group-hover:bg-blue-100 group-hover:text-blue-600">
                    {q.img
                      ? <img src={q.img} alt="" className="h-[18px] w-[18px] lg:h-6 lg:w-6 short:lg:h-[18px] short:lg:w-[18px]" />
                      : <q.icon className="h-[18px] w-[18px] lg:h-6 lg:w-6 short:lg:h-[18px] short:lg:w-[18px]" strokeWidth={1.5} />}
                  </span>
                  <div className="min-w-0 max-w-full">
                    <p className="line-clamp-2 text-[13px] font-semibold leading-tight text-foreground lg:text-[15px] short:lg:text-[13px]">{q.title}</p>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground lg:mt-1 lg:text-[12.5px] short:hidden">{q.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* Mes diagnostics : les onglets de la liste, chacun ouvre la liste filtrée. */}
          <section className="liquid-glass shrink-0 rounded-[24px] p-5" style={glass(1)}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-foreground">Mes diagnostics</h2>
              <Link to="/app/projects" className="text-[12px] font-medium text-muted-foreground/70 transition-colors hover:text-foreground">Voir tout</Link>
            </div>
            {/* Écran bas : une seule rangée, le total (déjà dans « Voir tout ») s'efface. */}
            <div className="grid grid-cols-2 gap-3 2xl:grid-cols-4 short:xl:grid-cols-3 short:xl:[&>*:nth-child(4)]:hidden">
              {COMPTEURS.map((c) => (
                <Link key={c.onglet} to={`/app/projects?onglet=${encodeURIComponent(c.onglet)}`} className="group flex items-center gap-3 rounded-2xl border border-black/[0.05] bg-white/45 px-3.5 py-3 transition-all hover:-translate-y-0.5 hover:bg-white/80 hover:shadow-[0_14px_40px_-16px_rgba(0,0,0,0.22)] short:py-2">
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', c.dot)} />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">{c.label}</span>
                  <span className="text-[20px] font-semibold tracking-tight text-foreground">{c.value}</span>
                </Link>
              ))}
            </div>
          </section>
        </div>

        {/* Activité récente : h-0 + min-h-full, elle ne pèse pas sur la hauteur de
            la rangée et se cale sur la colonne de gauche. Les lignes qui ne
            tiennent pas passent dans une colonne masquée (flex-wrap), au lieu
            d'être coupées en deux. */}
        <section className="liquid-glass flex flex-col rounded-[24px] p-5 tablette:h-0 tablette:min-h-full lg:h-0 lg:min-h-full" style={glass(1)}>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[16px] font-semibold text-foreground">Activité récente</h2>
            <Link to="/app/projects" className="text-[12px] font-medium text-muted-foreground/70 transition-colors hover:text-foreground">Voir tout</Link>
          </div>
          {activity.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-muted-foreground/70">Aucune activité pour le moment.</p>
          ) : (
            <div className="flex flex-col tablette:min-h-0 tablette:flex-1 tablette:flex-wrap tablette:content-start tablette:overflow-hidden lg:min-h-0 lg:flex-1 lg:flex-wrap lg:content-start lg:overflow-hidden">
              {activity.map((a, i) => (
                <Link key={a.id} to={a.to} className="flex w-full items-center gap-3 border-b border-black/[0.05] py-2.5 text-left transition-colors last:border-0 hover:bg-white/40">
                  <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', TINTS[i % TINTS.length])}><a.icon className="h-[17px] w-[17px]" strokeWidth={1.6} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-foreground">{a.title}</p>
                    <p className="truncate text-[11.5px] text-muted-foreground">{a.sub}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground/70">{formatDate(new Date(a.ts))}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" strokeWidth={1.6} />
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
