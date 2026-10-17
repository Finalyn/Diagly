import { useEffect, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  Home, ClipboardCheck, Database, Building2, Settings, Plus, ChevronRight, Plug, LifeBuoy, Handshake,
  CircleUser, LogOut, ShieldCheck, Ruler,
} from 'lucide-react'
import { useAuth } from '@/stores/auth'
import { logout as endSession, confirmerDeconnexion } from '@/lib/session'
import { initiales, nomAffiche } from '@/lib/reglages'

type NavEntry = {
  to?: string
  label: string
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  end?: boolean
  soon?: boolean
  /** Repère désigné par les visites guidées. */
  visite?: string
}

const NAV: NavEntry[] = [
  { to: '/app/dashboard', label: 'Accueil', icon: Home, end: true, visite: 'nav-accueil' },
  { to: '/app/projects', label: 'Diagnostics', icon: ClipboardCheck, visite: 'nav-projects' },
  { to: '/app/metres', label: 'Métrés', icon: Ruler, visite: 'nav-metres' },
  { to: '/app/cfc', label: 'Base de données', icon: Database, visite: 'nav-cfc' },
  { to: '/app/integrations', label: 'Intégrations', icon: Plug, visite: 'nav-integrations' },
  { to: '/app/buildings', label: 'Parc immobilier', icon: Building2, visite: 'nav-buildings' },
  { to: '/app/prestataires', label: 'Prestataires', icon: Handshake, visite: 'nav-partenaires' },
  { to: '/app/settings', label: 'Paramètres', icon: Settings, visite: 'nav-settings' },
  { to: '/app/support', label: 'Aide & support', icon: LifeBuoy, visite: 'nav-support' },
]

/** Panneau de navigation (carte unique) : nav + profil + assistant intégrés. */
export function Sidebar() {

  return (
    <aside className="flex h-full flex-col overflow-hidden rounded-2xl border border-black/[0.06] bg-white p-3.5 text-sidebar-foreground shadow-[0_1px_2px_rgba(0,0,0,0.03),0_12px_32px_-16px_rgba(0,0,0,0.10)]">
      {/* Logo */}
      <NavLink to="/app/dashboard" className="flex items-center gap-2.5 rounded-xl px-2 py-2 transition-colors hover:bg-muted/50">
        <img src="/diagly-mark.svg" alt="" className="h-10 w-auto" />
        <span className="text-[27px] font-semibold leading-none tracking-tight text-neutral-900">Diagly</span>
      </NavLink>

      {/* Nouveau diagnostic */}
      <NavLink
        to="/app/projects/new"
        data-visite="nouveau"
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-black/[0.10] bg-white px-3 py-2.5 text-sm font-medium text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-colors hover:bg-muted/60"
      >
        <Plus className="h-4 w-4" />Nouveau diagnostic
      </NavLink>

      {/* Navigation principale */}
      {/* Sur un écran bas, la liste défile plutôt que de pousser le compte et
          l'assistant hors de la carte. */}
      <nav className="-mx-1 mt-4 min-h-0 space-y-1.5 overflow-y-auto px-1">
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
              data-visite={n.visite}
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

      <PiedDeBarre />
    </aside>
  )
}

/** Bas de barre : l'espace du compte et l'assistant. Partagé avec la barre d'un dossier. */
export function PiedDeBarre() {
  return (
    <div className="space-y-1 border-t border-black/[0.06] pt-3">
      <EspaceCompte />

      {/* L'assistant a sa page : le panneau flottant cachait l'application
          derrière lui et ne gardait rien d'une question à l'autre. */}
      <NavLink
        to="/app/assistant"
        data-visite="assistant"
        className={({ isActive }) => cn(
          'flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors',
          isActive ? 'bg-blue-50' : 'hover:bg-black/[0.03]',
        )}
      >
        {({ isActive }) => (
          <>
            <div className="min-w-0 flex-1">
              <p className={cn('truncate text-sm font-semibold leading-tight', isActive ? 'text-blue-700' : 'text-neutral-900')}>Diagly Assistant</p>
              <p className="truncate text-xs text-muted-foreground">Poser une question</p>
            </div>
            <ChevronRight className={cn('h-4 w-4 shrink-0', isActive ? 'text-blue-700' : 'text-muted-foreground')} />
          </>
        )}
      </NavLink>
    </div>
  )
}

/**
 * L'espace du compte, en bas de la barre.
 *
 * C'était un lien muet vers les réglages : on cliquait sans savoir ce qu'on
 * allait trouver, et se déconnecter demandait de traverser une page de
 * formulaires. C'est maintenant un menu, qui dit d'abord qui est connecté et
 * propose les quatre gestes qu'on vient y chercher.
 */
function EspaceCompte() {
  const user = useAuth((s) => s.user)
  const navigate = useNavigate()
  const [ouvert, setOuvert] = useState(false)
  const boite = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ouvert) return
    const dehors = (e: MouseEvent) => {
      if (boite.current && !boite.current.contains(e.target as Node)) setOuvert(false)
    }
    const touche = (e: KeyboardEvent) => { if (e.key === 'Escape') setOuvert(false) }
    document.addEventListener('mousedown', dehors)
    document.addEventListener('keydown', touche)
    return () => {
      document.removeEventListener('mousedown', dehors)
      document.removeEventListener('keydown', touche)
    }
  }, [ouvert])

  const aller = (chemin: string) => { setOuvert(false); navigate(chemin) }

  // Révoque la session côté serveur ET efface ce qui est gardé sur l'appareil.
  const seDeconnecter = async () => {
    if (!confirmerDeconnexion()) return
    setOuvert(false)
    await endSession()
    navigate('/login', { replace: true })
  }

  const entrees: { libelle: string; aide: string; icone: typeof Settings; chemin: string }[] = [
    { libelle: 'Mon compte', aide: 'Plan, organisation, session', icone: CircleUser, chemin: '/app/settings?s=compte' },
    { libelle: 'Réglages', aide: 'Profil, entreprise, valeurs', icone: Settings, chemin: '/app/settings?s=profil' },
    { libelle: 'Sécurité', aide: 'Mot de passe, double authentification', icone: ShieldCheck, chemin: '/app/settings?s=securite' },
    { libelle: 'Aide & support', aide: 'Documentation et contact', icone: LifeBuoy, chemin: '/app/support' },
  ]

  return (
    <div ref={boite} className="relative">
      {ouvert && (
        <div className="absolute bottom-full left-0 right-0 z-30 mb-2 overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-[0_12px_40px_-12px_rgba(0,0,0,0.30)]">
          <div className="border-b border-black/[0.06] px-3 py-2.5">
            <p className="truncate text-sm font-semibold leading-tight">{nomAffiche(user ?? {})}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>
          <div className="p-1">
            {entrees.map((e) => (
              <button
                key={e.libelle}
                onClick={() => aller(e.chemin)}
                className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-black/[0.04]"
              >
                <e.icone className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{e.libelle}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{e.aide}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="border-t border-black/[0.06] p-1">
            <button
              onClick={seDeconnecter}
              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
            >
              <LogOut className="h-4 w-4 shrink-0" />Se déconnecter
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOuvert((v) => !v)}
        aria-expanded={ouvert}
        data-visite="compte"
        className={cn(
          'flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors',
          ouvert ? 'bg-black/[0.04]' : 'hover:bg-black/[0.03]',
        )}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/[0.06] bg-secondary text-sm font-semibold text-foreground">
          {initiales(user ?? {})}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight text-neutral-900">{nomAffiche(user ?? {})}</p>
          <p className="truncate text-xs text-muted-foreground">
            {user?.preferences?.company?.name || user?.companyName || user?.email}
          </p>
        </div>
        <ChevronRight className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', ouvert && '-rotate-90')} />
      </button>
    </div>
  )
}
