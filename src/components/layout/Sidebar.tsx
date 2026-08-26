import { NavLink, Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Home, ClipboardCheck, Database, Users, Building2, Settings, Plus, ChevronRight, Plug, LifeBuoy } from 'lucide-react'
import { useAuth } from '@/stores/auth'

type NavEntry = {
  to?: string
  label: string
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  end?: boolean
  soon?: boolean
}

const NAV: NavEntry[] = [
  { to: '/app/dashboard', label: 'Accueil', icon: Home, end: true },
  { to: '/app/projects', label: 'Diagnostics', icon: ClipboardCheck },
  { to: '/app/cfc', label: 'Base de données', icon: Database },
  { to: '/app/team', label: 'Gestion équipe', icon: Users },
  { to: '/app/integrations', label: 'Intégrations', icon: Plug },
  { to: '/app/buildings', label: 'Parc immobilier', icon: Building2 },
  { to: '/app/settings', label: 'Paramètres', icon: Settings },
  { to: '/app/support', label: 'Aide & support', icon: LifeBuoy },
]

/** Panneau de navigation (carte unique) : nav + profil + assistant intégrés. */
export function Sidebar({ onOpenAssistant }: { onOpenAssistant: () => void }) {
  const user = useAuth((s) => s.user)
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'Mon compte'
  const initials = ((user?.firstName?.[0] ?? '') + (user?.lastName?.[0] ?? '')).toUpperCase() || (user?.email?.[0] ?? 'U').toUpperCase()

  return (
    <aside className="flex h-full flex-col overflow-hidden rounded-2xl border border-black/[0.06] bg-white p-3.5 text-sidebar-foreground shadow-[0_1px_2px_rgba(0,0,0,0.03),0_12px_32px_-16px_rgba(0,0,0,0.10)]">
      {/* Logo */}
      <NavLink to="/app/dashboard" className="flex items-center gap-2.5 rounded-xl px-2 py-2 transition-colors hover:bg-muted/50">
        <img src="/diagly-mark.svg" alt="" className="h-10 w-auto" />
        <span className="relative top-[1px] text-[27px] font-semibold leading-none tracking-tight text-neutral-900">Diagly</span>
      </NavLink>

      {/* Nouveau diagnostic */}
      <NavLink
        to="/app/projects/new"
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-black/[0.10] bg-white px-3 py-2.5 text-sm font-medium text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-colors hover:bg-muted/60"
      >
        <Plus className="h-4 w-4" />Nouveau diagnostic
      </NavLink>

      {/* Navigation principale */}
      <nav className="mt-4 space-y-1.5">
        {NAV.map((n) => {
          const inner = (
            <>
              <n.icon className="h-5 w-5 shrink-0" strokeWidth={1.7} />
              <span className="flex-1 whitespace-nowrap">{n.label}</span>
              {n.soon && (
                <span className="shrink-0 rounded-full bg-neutral-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-neutral-400">
                  Bientôt
                </span>
              )}
            </>
          )
          if (n.soon || !n.to) {
            return (
              <div key={n.label} aria-disabled title="Bientôt disponible" className="flex cursor-default items-center gap-3 rounded-2xl px-3.5 py-3 text-[14px] font-medium text-neutral-400">
                {inner}
              </div>
            )
          }
          return (
            <NavLink
              key={n.label}
              to={n.to}
              end={n.end}
              className={({ isActive }) => cn(
                'flex items-center gap-3 rounded-2xl px-3.5 py-3 text-[14px] transition-colors',
                isActive
                  ? 'border border-blue-100 bg-blue-50 font-semibold text-blue-700'
                  : 'font-medium text-neutral-600 hover:bg-black/[0.03] hover:text-neutral-900',
              )}
            >
              {inner}
            </NavLink>
          )
        })}
      </nav>

      <div className="flex-1" />

      {/* Bas de carte : profil + assistant intégrés (comme la maquette) */}
      <div className="space-y-1 border-t border-black/[0.06] pt-3">
        <Link to="/app/settings" className="flex items-center gap-3 rounded-2xl px-2 py-2 transition-colors hover:bg-black/[0.03]">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/[0.06] bg-secondary text-sm font-semibold text-foreground">{initials}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight text-neutral-900">{name}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.companyName || user?.email}</p>
          </div>
        </Link>

        <button
          onClick={onOpenAssistant}
          className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-black/[0.03]"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight text-neutral-900">Diagly Assistant</p>
            <p className="truncate text-xs text-muted-foreground">Poser une question</p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </div>
    </aside>
  )
}
