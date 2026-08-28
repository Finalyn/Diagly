import { Link } from 'react-router-dom'
import { SearchBar } from './SearchBar'
import { NotificationsBell } from './NotificationsBell'

export function TopBar() {
  return (
    <header className="flex shrink-0 items-center gap-3 justify-between lg:justify-end">
      {/* Logo Diagly : visible sur mobile (pas de sidebar) */}
      <Link to="/app/projects" aria-label="Diagly" className="flex items-center gap-2 shrink-0 lg:hidden">
        <img src="/diagly-mark.svg" alt="" className="h-8 w-auto" />
        <span className="text-xl font-semibold leading-none tracking-tight text-neutral-900">Diagly</span>
      </Link>
      {/* Recherche : desktop uniquement (inutile sur mobile) */}
      <div className="hidden lg:block">
        <SearchBar />
      </div>
      <NotificationsBell />
    </header>
  )
}
