import { Link } from 'react-router-dom'
import { PanelLeft } from 'lucide-react'
import { SearchBar } from './SearchBar'
import { NotificationsBell } from './NotificationsBell'
import { useMenuDeLaPage } from '@/stores/menu-lateral'

export function TopBar() {
  const menu = useMenuDeLaPage()
  return (
    <header className="flex shrink-0 items-center gap-3 justify-between">
      {/* Logo Diagly : visible sur mobile (pas de sidebar) */}
      <Link to="/app/projects" aria-label="Diagly" className="flex items-center gap-2 shrink-0 md:hidden">
        <img src="/diagly-mark.svg" alt="" className="h-8 w-auto" />
        <span className="text-xl font-semibold leading-none tracking-tight text-neutral-900">Diagly</span>
      </Link>
      {/* Replier ou rouvrir le menu de gauche (stores/menu-lateral.ts) : sur
          iPad, il prend un quart de l'écran. */}
      <button
        type="button"
        onClick={menu.basculer}
        aria-label={menu.visible ? 'Masquer le menu' : 'Afficher le menu'}
        aria-pressed={!menu.visible}
        className="liquid-glass lg-55 hidden h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl text-neutral-600 transition-colors hover:text-neutral-900 md:flex"
      >
        <PanelLeft className="h-5 w-5" strokeWidth={1.8} />
      </button>
      <div className="flex min-w-0 items-center gap-3">
        {/* Recherche : desktop uniquement (inutile sur mobile) */}
        <div className="hidden md:block" data-visite="recherche">
          <SearchBar />
        </div>
        <NotificationsBell />
      </div>
    </header>
  )
}
