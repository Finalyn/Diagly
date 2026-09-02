import { useMemo, type CSSProperties } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight, ChevronRight, Plus, ClipboardCheck, Calendar, FileText, Layers,
  FilePlus, AlertTriangle, FolderKanban, CheckCircle2, Wallet,
} from 'lucide-react'
import { formatDate, formatCHF, cn } from '@/lib/utils'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'
import { useAuth } from '@/stores/auth'

const toNum = (v: string | null | undefined) => (v ? Number(v) : 0)
const glass = (alpha: number): CSSProperties => ({ background: `rgba(255,255,255,${alpha})` })

const QUICK = [
  { icon: Plus, title: 'Nouveau diagnostic', desc: 'Créer un diagnostic de bâtiment', to: '/app/projects/new' },
  { icon: ClipboardCheck, title: 'Mes diagnostics', desc: 'Consulter tous vos diagnostics', to: '/app/projects' },
  { icon: Calendar, title: 'Calendrier', desc: 'Planifier vos visites sur site', to: '/app/planning' },
  { icon: FileText, title: 'Catalogue CFC', desc: 'Gérer les positions et prix', to: '/app/cfc' },
]

// Teintes colorées des icônes (option « colorIcons » de la maquette)
const TINTS = [
  'bg-violet-100/80 text-violet-600',
  'bg-emerald-100/80 text-emerald-600',
  'bg-sky-100/80 text-sky-600',
  'bg-amber-100/80 text-amber-600',
  'bg-rose-100/80 text-rose-600',
]

function ProgressRing({ pct }: { pct: number }) {
  const r = 46
  const c = 2 * Math.PI * r
  return (
    <div className="relative h-[138px] w-[138px] shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth="8" />
        <circle cx="60" cy="60" r={r} fill="none" stroke="#2563eb" strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[30px] font-medium leading-none tracking-tight text-neutral-900">{pct}%</span>
        <span className="mt-1.5 text-[11px] leading-tight text-neutral-400">avancement</span>
      </div>
    </div>
  )
}

export function Dashboard() {
  const user = useAuth((s) => s.user)
  const { data } = useQuery({ queryKey: ['projects'], queryFn: () => api.projects.list() })
  const { data: itemsData } = useQuery({ queryKey: ['recent-items'], queryFn: () => api.diagnostics.recentItems() })

  // Références stables : sans useMemo, `?? []` crée un tableau neuf à chaque rendu,
  // ce qui invalide toutes les mémorisations en aval (fil d'activité, KPI).
  const projects = useMemo(() => data?.projects ?? [], [data])
  const recentItems = useMemo(() => itemsData?.items ?? [], [itemsData])

  const totalProjects = projects.length
  const inProgress = projects.filter((p) => ['PLANIFIE', 'EN_COURS', 'EN_REVUE'].includes(p.status)).length
  const completed = projects.filter((p) => p.status === 'TERMINE').length
  const budget = projects.reduce((s, p) => s + toNum(p.totalBudget), 0)
  const urgents = recentItems.filter((it) => it.priority === 'I').length
  const avancement = totalProjects ? Math.round((completed / totalProjects) * 100) : 0

  const greeting = user?.firstName ? `Bonjour ${user.firstName}` : 'Bonjour'

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
      acc.push({ id: 'i' + it.id, ts: it.updatedAt, icon: Layers, title: it.cfcLabel, sub: it.projectName, to: `/app/projects/${it.projectId}/diagnostic` })
    }
    return acc.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()).slice(0, 6)
  }, [projects, recentItems])

  const KPIS = [
    { icon: FolderKanban, value: String(inProgress), label: 'Diagnostics en cours', tint: 'bg-violet-100/80 text-violet-600' },
    { icon: CheckCircle2, value: String(completed), label: 'Diagnostics réalisés', tint: 'bg-emerald-100/80 text-emerald-600' },
    { icon: Layers, value: String(totalProjects), label: 'Total diagnostics', tint: 'bg-sky-100/80 text-sky-600' },
    { icon: Wallet, value: budget ? formatCHF(budget) : '—', label: 'Budget estimé', tint: 'bg-amber-100/80 text-amber-600' },
  ]

  return (
    <div className="space-y-6 pb-6">
      {/* Salutation */}
      <div>
        <h1 className="text-[40px] font-normal leading-none tracking-tight text-neutral-900">{greeting}</h1>
        <p className="mt-2.5 text-[15px] text-neutral-500">Prêt à piloter vos diagnostics du jour&nbsp;?</p>
      </div>

      {/* Rangée : En cours + À traiter */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-stretch">
        <div className="liquid-glass relative overflow-hidden rounded-[26px] lg:w-fit" style={glass(0.62)}>
          <div className="relative z-10 flex h-full flex-col gap-7 p-7 sm:flex-row sm:items-center sm:gap-9 sm:p-8">
            <div className="max-w-[240px]">
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">En cours</span>
              <p className="mt-3 text-[27px] font-medium leading-[1.15] tracking-tight">
                <span className="text-neutral-900">{inProgress} diagnostic{inProgress > 1 ? 's' : ''}</span><br />
                <span className="text-neutral-400">à suivre aujourd’hui</span>
              </p>
              <Link to="/app/projects" className="mt-7 inline-flex items-center gap-2 rounded-full bg-neutral-900 px-6 py-3 text-[14px] font-medium text-white transition-transform hover:scale-[1.02] active:scale-95">
                Voir mes diagnostics <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
              </Link>
            </div>
            <div className="sm:pr-3"><ProgressRing pct={avancement} /></div>
          </div>
        </div>

        <Link to="/app/projects" className="liquid-glass relative block overflow-hidden rounded-[26px] p-6 sm:p-7 lg:w-[320px]" style={glass(0.72)}>
          <div className="relative z-10 flex h-full flex-col justify-between gap-5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100/80 text-orange-600"><AlertTriangle className="h-[18px] w-[18px]" strokeWidth={1.8} /></span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">À traiter</span>
            </div>
            <div>
              <p className="text-[32px] font-medium leading-none tracking-tight text-neutral-900">{urgents}</p>
              <p className="mt-2 text-[13.5px] text-neutral-500">{urgents > 1 ? 'éléments urgents en priorité' : 'élément urgent en priorité'}</p>
            </div>
            <span className="inline-flex w-fit items-center gap-1.5 text-[13.5px] font-semibold text-neutral-900">
              Traiter maintenant <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </span>
          </div>
        </Link>
      </div>

      {/* Grille : (Accès rapides + En bref) | Activité récente */}
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          {/* Accès rapides */}
          <section className="liquid-glass rounded-[24px] p-6" style={glass(1)}>
            <h2 className="mb-5 text-[16px] font-semibold text-neutral-800">Accès rapides</h2>
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              {QUICK.map((q) => (
                <Link key={q.title} to={q.to} className="group flex flex-col items-center gap-4 rounded-2xl border border-black/[0.05] bg-white/45 px-4 py-14 text-center transition-all hover:-translate-y-0.5 hover:bg-white/80 hover:shadow-[0_14px_40px_-16px_rgba(0,0,0,0.22)]">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-900/[0.05] text-neutral-600 transition-colors group-hover:bg-blue-100 group-hover:text-blue-600">
                    <q.icon className="h-[19px] w-[19px]" strokeWidth={1.5} />
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold leading-tight text-neutral-900">{q.title}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">{q.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* En bref */}
          <section className="liquid-glass rounded-[24px] p-5" style={glass(0.55)}>
            <h2 className="mb-4 text-[16px] font-semibold text-neutral-800">En bref</h2>
            <div className="grid grid-cols-2 divide-black/[0.06] xl:grid-cols-4 xl:divide-x">
              {KPIS.map((k) => (
                <div key={k.label} className="px-1 sm:px-4 first:sm:pl-0 last:sm:pr-0">
                  <div className="flex items-center gap-2.5">
                    <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', k.tint)}><k.icon className="h-[17px] w-[17px]" strokeWidth={1.7} /></span>
                    <p className="text-[22px] font-bold tracking-tight text-neutral-900">{k.value}</p>
                  </div>
                  <p className="mt-2 text-[12px] text-neutral-500">{k.label}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Activité récente */}
        <section className="liquid-glass flex flex-col rounded-[24px] p-5" style={glass(1)}>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[16px] font-semibold text-neutral-800">Activité récente</h2>
            <Link to="/app/projects" className="text-[12px] font-medium text-neutral-400 transition-colors hover:text-neutral-800">Voir tout</Link>
          </div>
          {activity.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-neutral-400">Aucune activité pour le moment.</p>
          ) : (
            <div className="divide-y divide-black/[0.05]">
              {activity.map((a, i) => (
                <Link key={a.id} to={a.to} className="flex w-full items-center gap-3 rounded-xl py-2.5 text-left transition-colors hover:bg-white/40">
                  <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', TINTS[i % TINTS.length])}><a.icon className="h-[17px] w-[17px]" strokeWidth={1.6} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-neutral-900">{a.title}</p>
                    <p className="truncate text-[11.5px] text-neutral-500">{a.sub}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-neutral-400">{formatDate(new Date(a.ts))}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-neutral-300" strokeWidth={1.6} />
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
