import { NavLink } from 'react-router-dom'
import { ClipboardCheck, MessageCircle, Settings, Database } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Barre de navigation mobile « liquid glass » (réf. iOS 26).
 *
 * La pilule ne porte que la navigation (Diagnostics · Base de données · Paramètres),
 * centrée. L'assistant garde son bouton rond détaché à droite, pour ne pas se
 * confondre avec les onglets, mais il ouvre désormais sa propre page plutôt qu'une
 * fenêtre posée sur l'application : sur un téléphone, une conversation se lit en
 * plein écran.
 */
export function MobileNav() {
  const item = 'relative z-10 flex h-11 w-11 items-center justify-center rounded-full transition-colors'
  const icon = (Icon: LucideIcon, active: boolean) => (
    <>
      {active && <span className="absolute inset-0 rounded-full bg-[#DBEFFF]/80 shadow-[0_2px_10px_-2px_rgba(120,180,255,0.7)]" />}
      <Icon className={cn('relative h-[22px] w-[22px]', active ? 'text-primary' : 'text-neutral-700')} strokeWidth={active ? 2.2 : 1.8} />
    </>
  )

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
        <NavLink
          to="/app/assistant"
          aria-label="Assistant IA"
          className="liquid-nav pointer-events-auto flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full"
        >
          {({ isActive }) => icon(MessageCircle, isActive)}
        </NavLink>
      </div>
    </nav>
  )
}
