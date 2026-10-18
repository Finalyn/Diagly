import { useEffect, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NAV } from './contenu'
import { Bouton, FOCUS } from './ui'

/**
 * La barre du haut, collée en haut de l'écran pendant toute la lecture.
 *
 * C'est le seul élément toujours visible : le bouton « Créer un compte » y
 * reste donc à toutes les tailles. Sous 1024 px, les ancres passent dans un
 * menu, qu'Échap ou un choix referment.
 */
export function Entete() {
  const [ouvert, setOuvert] = useState(false)
  const idMenu = useId()

  useEffect(() => {
    if (!ouvert) return
    const fermer = (e: KeyboardEvent) => { if (e.key === 'Escape') setOuvert(false) }
    window.addEventListener('keydown', fermer)
    return () => window.removeEventListener('keydown', fermer)
  }, [ouvert])

  return (
    <header className="sticky top-0 z-50 border-b border-black/[0.06] bg-white/80 backdrop-blur-xl backdrop-saturate-150">
      <a href="#contenu" className={cn('sr-only rounded-full bg-white px-4 py-2 text-[14px] font-medium focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50', FOCUS)}>
        Aller au contenu
      </a>
      <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center gap-6 px-4 sm:px-6 lg:px-8">
        <a href="#haut" aria-label="Diagly, haut de la page" className={cn('flex min-h-11 shrink-0 items-center rounded-md', FOCUS)}>
          <img src="/diagly-logo.svg" alt="Diagly" width={95} height={30} className="h-[30px] w-auto" />
        </a>

        <nav aria-label="Sections de la page" className="hidden flex-1 justify-center lg:flex">
          <ul className="flex items-center gap-1">
            {NAV.map((n) => (
              <li key={n.href}>
                <a href={n.href} className={cn('rounded-full px-3 py-2 text-[14px] font-medium text-[#3a3a3c] transition-colors hover:bg-black/[0.04] hover:text-[#1d1d1f]', FOCUS)}>
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2 lg:ml-0">
          <Link to="/login" className={cn('hidden min-h-11 items-center rounded-full px-3 text-[14px] font-medium text-[#3a3a3c] hover:text-[#1d1d1f] sm:inline-flex', FOCUS)}>
            Se connecter
          </Link>
          <Bouton to="/register" className="px-4 text-[14px]">Créer un compte</Bouton>
          <button
            type="button"
            onClick={() => setOuvert((o) => !o)}
            aria-expanded={ouvert}
            aria-controls={idMenu}
            aria-label={ouvert ? 'Fermer le menu' : 'Ouvrir le menu'}
            className={cn('flex h-11 w-11 items-center justify-center rounded-full text-[#1d1d1f] hover:bg-black/[0.05] lg:hidden', FOCUS)}
          >
            {ouvert ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      <nav id={idMenu} aria-label="Menu" hidden={!ouvert} className="border-t border-black/[0.06] bg-white lg:hidden">
        <ul className="mx-auto w-full max-w-[1200px] px-4 py-2 sm:px-6">
          {NAV.map((n) => (
            <li key={n.href}>
              <a href={n.href} onClick={() => setOuvert(false)} className={cn('flex min-h-12 items-center rounded-lg px-2 text-[16px] font-medium text-[#1d1d1f]', FOCUS)}>
                {n.label}
              </a>
            </li>
          ))}
          <li className="sm:hidden">
            <Link to="/login" onClick={() => setOuvert(false)} className={cn('flex min-h-12 items-center rounded-lg px-2 text-[16px] font-medium text-[#0167EA]', FOCUS)}>
              Se connecter
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  )
}
