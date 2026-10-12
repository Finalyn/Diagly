import { NavLink, Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ClipboardCheck, MessageCircle, Settings, Database, LayoutGrid, ChevronLeft } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

/**
 * Barre de navigation mobile « liquid glass » (réf. iOS 26).
 *
 * Hors d'un dossier, la pilule porte la navigation de l'app (Diagnostics · Base
 * de données · Paramètres), centrée. Dans un dossier, elle devient celle du
 * dossier : le relevé, et « Dossier » qui ouvre le sommaire avec tout le reste. Le bouton d'accès au reste était en haut de
 * l'éditeur, loin du pouce ; il est maintenant là où l'on navigue déjà.
 *
 * L'assistant garde son bouton rond détaché à droite. Dans un dossier, un
 * bouton rond à gauche ramène à la liste des diagnostics.
 */
export function MobileNav() {
  const { pathname } = useLocation()
  // Le dossier en cours : par l'adresse, ou par le diagnostic ouvert dans l'éditeur
  // (même clé de cache que l'éditeur, qui l'a déjà chargé).
  const parAdresse = pathname.match(/^\/app\/projects\/([^/]+)\/(sommaire|fiche|visite|photos|couts|cecb|rapports|diagnostic)$/)?.[1]
  const diagnosticId = pathname.match(/^\/app\/diagnostic\/([^/]+)$/)?.[1]
  const diagQ = useQuery({ queryKey: ['diagnostic', diagnosticId], queryFn: () => api.diagnostics.get(diagnosticId!), enabled: !!diagnosticId })
  const projectId = parAdresse ?? diagQ.data?.diagnostic.projectId

  const icon = (Icon: LucideIcon, active: boolean) => (
    <>
      {active && <span className="absolute inset-0 rounded-full bg-[#DBEFFF]/80 shadow-[0_2px_10px_-2px_rgba(120,180,255,0.7)]" />}
      <Icon className={cn('relative h-[22px] w-[22px]', active ? 'text-primary' : 'text-neutral-700')} strokeWidth={active ? 2.2 : 1.8} />
    </>
  )
  const rond = 'liquid-nav pointer-events-auto flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full'

  const assistant = (
    <NavLink to="/app/assistant" aria-label="Assistant IA" className={rond}>
      {({ isActive }) => icon(MessageCircle, isActive)}
    </NavLink>
  )

  // ----- Dans un dossier -----
  if (projectId || diagnosticId) {
    const base = projectId ? `/app/projects/${projectId}` : null
    // Deux onglets seulement : le relevé, et le dossier (sommaire avec tout le reste).
    const onglets: { to: string | null; label: string; icone: LucideIcon; actif: boolean }[] = [
      { to: base && `${base}/diagnostic`, label: 'Relevé', icone: ClipboardCheck, actif: !!diagnosticId || pathname.endsWith('/diagnostic') },
      { to: base && `${base}/sommaire`, label: 'Dossier', icone: LayoutGrid, actif: /\/(sommaire|fiche|visite|photos|couts|cecb|rapports)$/.test(pathname) },
    ]
    const cls = 'relative z-10 flex h-11 w-11 items-center justify-center rounded-full transition-colors'
    return (
      <nav className="nav-dossier md:hidden fixed inset-x-0 bottom-0 z-40 pointer-events-none px-5 pb-[calc(env(safe-area-inset-bottom)+0.6rem)]">
        <div className="flex items-center gap-4">
          <Link to="/app/projects" aria-label="Tous les diagnostics" className={rond}>
            <ChevronLeft className="h-[22px] w-[22px] text-neutral-700" strokeWidth={1.8} />
          </Link>
          <div className="liquid-nav pointer-events-auto mx-auto flex items-center gap-3 overflow-hidden rounded-full px-3 py-1.5">
            {onglets.map((o) => o.to
              ? <Link key={o.label} to={o.to} aria-label={o.label} aria-current={o.actif ? 'page' : undefined} className={cls}>{icon(o.icone, o.actif)}</Link>
              : <span key={o.label} aria-label={o.label} className={cn(cls, 'opacity-50')}>{icon(o.icone, false)}</span>)}
          </div>
          {assistant}
        </div>
      </nav>
    )
  }

  // ----- Hors dossier -----
  const item = 'relative z-10 flex h-11 w-11 items-center justify-center rounded-full transition-colors'
  return (
    <nav className="md:hidden fixed inset-x-0 bottom-0 z-40 pointer-events-none px-5 pb-[calc(env(safe-area-inset-bottom)+0.6rem)]">
      <div className="flex items-center gap-4">
        {/* Navigation : les trois destinations de l'app mobile */}
        <div className="liquid-nav pointer-events-auto mx-auto flex items-center gap-3 overflow-hidden rounded-full px-3 py-1.5">
          <NavLink to="/app/projects" aria-label="Diagnostics" className={item}>
            {({ isActive }) => icon(ClipboardCheck, isActive)}
          </NavLink>
          <NavLink to="/app/cfc" aria-label="Base de données" className={item}>
            {({ isActive }) => icon(Database, isActive)}
          </NavLink>
          <NavLink to="/app/settings" aria-label="Paramètres" className={item}>
            {({ isActive }) => icon(Settings, isActive)}
          </NavLink>
        </div>

        {/* Assistant IA : page dédiée, à portée du pouce droit */}
        {assistant}
      </div>
    </nav>
  )
}
