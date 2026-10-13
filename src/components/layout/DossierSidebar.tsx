/**
 * La barre de gauche, à l'intérieur d'un dossier.
 *
 * Le dossier était le seul écran à mettre sa navigation en haut, en neuf
 * onglets de même poids : le relevé, qui fait tout le travail, se perdait entre
 * l'étiquette énergétique et les variantes. En entrant dans un dossier, la
 * barre de gauche devient la sienne, comme les autres écrans à menu (réglages,
 * intégrations) : le bâtiment en tête, le relevé mis en avant, puis les outils
 * rangés par sujet. L'éditeur garde toute la largeur.
 */
import { NavLink, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ChevronLeft, ClipboardCheck, MapPin, CalendarCheck, Ruler, Calculator, Layers, Zap, Image, FileText,
} from 'lucide-react'
import { api } from '@/lib/api'
import { statusLabels } from '@/data/mock'
import { cn } from '@/lib/utils'
import type { ProjectStatus } from '@/lib/api-types'
import { PiedDeBarre } from './Sidebar'

const STATUT: Record<ProjectStatus, string> = {
  NON_PLANIFIE: 'bg-gray-400', PLANIFIE: 'bg-blue-400', EN_COURS: 'bg-blue-500',
  EN_REVUE: 'bg-amber-500', TERMINE: 'bg-emerald-500', ARCHIVE: 'bg-gray-400',
}

type Entree = { segment: string; label: string; icone: typeof MapPin }

/** Les outils, rangés par sujet : le bâtiment, l'analyse chiffrée, les documents remis. */
const GROUPES: { titre: string; entrees: Entree[] }[] = [
  { titre: 'Bâtiment', entrees: [
    { segment: 'fiche', label: 'Fiche du bâtiment', icone: MapPin },
    { segment: 'visite', label: 'Visite', icone: CalendarCheck },
    { segment: 'plans', label: 'Plans', icone: Ruler },
    { segment: 'cecb', label: 'Étiquette énergétique', icone: Zap },
  ] },
  { titre: 'Analyse', entrees: [
    { segment: 'couts', label: 'Coûts', icone: Calculator },
    { segment: 'variantes', label: 'Variantes', icone: Layers },
  ] },
  { titre: 'Documents', entrees: [
    { segment: 'photos', label: 'Photos', icone: Image },
    { segment: 'rapports', label: 'Rapports', icone: FileText },
  ] },
]

export function DossierSidebar({ projectId }: { projectId: string }) {
  const { data } = useQuery({ queryKey: ['project', projectId], queryFn: () => api.projects.get(projectId) })
  const projet = data?.project
  const releves = data?.diagnostics?.[0]?._count?.items
  const base = `/app/projects/${projectId}`

  return (
    <aside className="flex h-full flex-col overflow-hidden rounded-2xl border border-black/[0.06] bg-white p-3.5 text-sidebar-foreground shadow-[0_1px_2px_rgba(0,0,0,0.03),0_12px_32px_-16px_rgba(0,0,0,0.10)]">
      {/* Le logo reste, même sur écran bas (iPad couché) : on reconnaît l'app
          en entrant dans un dossier. Le menu en dessous défile s'il manque de place. */}
      <Link to="/app/dashboard" className="flex shrink-0 items-center gap-2.5 rounded-xl px-2 py-2 transition-colors hover:bg-muted/50 short:py-1">
        <img src="/diagly-mark.svg" alt="" className="h-8 w-auto" />
        <span className="text-[22px] font-semibold leading-none tracking-tight text-neutral-900">Diagly</span>
      </Link>

      <Link to="/app/projects" className="mt-2 flex items-center gap-1.5 rounded-xl px-2 py-1.5 short:mt-0 text-[13px] text-muted-foreground transition-colors hover:bg-black/[0.03] hover:text-foreground">
        <ChevronLeft className="h-4 w-4" />Tous les diagnostics
      </Link>

      {/* Le bâtiment */}
      <div className="mt-2 rounded-2xl border border-black/[0.06] bg-neutral-50/70 px-3.5 py-3 short:py-2.5">
        {projet ? (
          <>
            <p className="line-clamp-2 text-[15px] font-semibold leading-snug text-foreground">{projet.name}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {[projet.address, [projet.postalCode, projet.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')}
            </p>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={cn('h-1.5 w-1.5 rounded-full', STATUT[projet.status])} />{statusLabels[projet.status]}
            </p>
          </>
        ) : (
          <div className="space-y-2 py-1"><div className="h-4 w-3/4 animate-pulse rounded bg-black/[0.06]" /><div className="h-3 w-1/2 animate-pulse rounded bg-black/[0.05]" /></div>
        )}
      </div>

      <nav className="mt-3 min-h-0 flex-1 space-y-4 overflow-y-auto pb-2 short:mt-2 short:space-y-2.5">
        {/* Le relevé : l'écran du travail, devant tous les outils. */}
        <NavLink
          to={`${base}/diagnostic`}
          data-visite="onglet-diagnostic"
          className={({ isActive }) => cn(
            'flex items-center gap-3 rounded-2xl px-3.5 py-3 transition-colors short:py-2',
            isActive ? 'border border-blue-100 bg-blue-50 text-blue-700' : 'border border-black/[0.08] text-foreground hover:bg-black/[0.03]',
          )}
        >
          <ClipboardCheck className="h-5 w-5 shrink-0" strokeWidth={1.7} />
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold leading-tight">Relevé</span>
            <span className="block text-xs opacity-75">
              {releves === undefined ? 'Éditeur du diagnostic' : releves ? `${releves} élément${releves > 1 ? 's' : ''}` : 'À commencer'}
            </span>
          </span>
        </NavLink>

        {GROUPES.map((g) => (
          <div key={g.titre}>
            <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g.titre}</p>
            <div className="space-y-0.5">
              {g.entrees.map((e) => (
                <NavLink
                  key={e.segment}
                  to={`${base}/${e.segment}`}
                  data-visite={`onglet-${e.segment}`}
                  className={({ isActive }) => cn(
                    'flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13.5px] transition-colors short:py-1.5',
                    isActive ? 'bg-blue-50 font-semibold text-blue-700' : 'font-medium text-neutral-600 hover:bg-black/[0.03] hover:text-neutral-900',
                  )}
                >
                  <e.icone className="h-4 w-4 shrink-0" strokeWidth={1.7} />
                  <span className="truncate">{e.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <PiedDeBarre />
    </aside>
  )
}
