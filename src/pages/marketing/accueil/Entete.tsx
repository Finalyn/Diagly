import { useEffect, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NAV } from './contenu'
import { FOCUS, LienSite } from './ui'

/**
 * La barre du haut, collée en haut de l'écran pendant toute la lecture.
 *
 * Une seule barre blanche arrondie, posée sur le fond quadrillé du héros
 * comme une carte de l'application : le logo à gauche, les ancres au centre,
 * le compte à droite. Dès qu'on défile, son ombre se renforce pour la
 * détacher des sections qui passent dessous.
 *
 * Sous 1024 px, les ancres passent dans un menu, qu'Échap ou un choix referment.
 */
export function Entete() {
  const [ouvert, setOuvert] = useState(false)
  const [defile, setDefile] = useState(false)
  const idMenu = useId()

  useEffect(() => {
    if (!ouvert) return
    const fermer = (e: KeyboardEvent) => { if (e.key === 'Escape') setOuvert(false) }
    window.addEventListener('keydown', fermer)
    return () => window.removeEventListener('keydown', fermer)
  }, [ouvert])

  useEffect(() => {
    const suivre = () => setDefile(window.scrollY > 8)
    suivre()
    window.addEventListener('scroll', suivre, { passive: true })
    return () => window.removeEventListener('scroll', suivre)
  }, [])

  return (
    <header className="sticky top-0 z-50 px-3 pt-3 sm:px-4">
      <a href="#contenu" className={cn('sr-only rounded-full bg-white px-4 py-2 text-[14px] font-medium focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50', FOCUS)}>
        Aller au contenu
      </a>
      <div
        className={cn(
          'mx-auto flex h-[60px] w-full max-w-[1200px] items-center gap-4 rounded-2xl border border-black/[0.06] bg-white/90 pl-4 pr-2 backdrop-blur-xl backdrop-saturate-150 transition-shadow duration-200 sm:pl-5 lg:rounded-full lg:pl-6',
          defile || ouvert
            ? 'shadow-[0_1px_2px_rgba(15,23,42,0.06),0_12px_32px_-12px_rgba(15,23,42,0.22)]'
            : 'shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-14px_rgba(15,23,42,0.14)]',
        )}
      >
        <LienSite to="/#haut" aria-label="Diagly, accueil" className={cn('flex min-h-11 shrink-0 items-center rounded-md', FOCUS)}>
          <img src="/diagly-logo.svg" alt="Diagly" width={101} height={32} className="h-8 w-auto" />
        </LienSite>

        <nav aria-label="Le site" className="hidden flex-1 justify-center lg:flex">
          <ul className="flex items-center gap-0.5">
            {NAV.map((n) => (
              <li key={n.href}>
                <LienSite to={n.href} className={cn('block rounded-full px-4 py-2 text-[14px] font-medium text-[#3f4654] transition-colors hover:bg-[#eef4ff] hover:text-[#0b1f44]', FOCUS)}>
                  {n.label}
                </LienSite>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2 lg:ml-0">
          <Link to="/login" className={cn('hidden min-h-11 items-center rounded-full px-3 text-[14px] font-medium text-[#3f4654] hover:text-[#0b1f44] sm:inline-flex', FOCUS)}>
            Se connecter
          </Link>
          <LienSite
            to="/#demo"
            className={cn(
              'group inline-flex min-h-11 items-center gap-2 rounded-full border border-[#0167EA]/35 bg-[#e6f0ff] px-4 text-[14px] font-semibold text-[#0b3d8f] transition-colors hover:bg-[#d8e8ff] sm:px-5',
              FOCUS,
            )}
          >
            Réserver une démo
            <ArrowRight className="hidden h-4 w-4 transition-transform group-hover:translate-x-0.5 sm:block" aria-hidden="true" />
          </LienSite>
          <button
            type="button"
            onClick={() => setOuvert((o) => !o)}
            aria-expanded={ouvert}
            aria-controls={idMenu}
            aria-label={ouvert ? 'Fermer le menu' : 'Ouvrir le menu'}
            className={cn('flex h-11 w-11 items-center justify-center rounded-full text-[#0b1f44] hover:bg-black/[0.05] lg:hidden', FOCUS)}
          >
            {ouvert ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      <nav id={idMenu} aria-label="Menu" hidden={!ouvert} className="mx-auto mt-2 w-full max-w-[1200px] rounded-2xl border border-black/[0.06] bg-white shadow-[0_12px_32px_-12px_rgba(15,23,42,0.22)] lg:hidden">
        <ul className="px-3 py-2">
          {NAV.map((n) => (
            <li key={n.href}>
              <LienSite to={n.href} onClick={() => setOuvert(false)} className={cn('flex min-h-12 items-center rounded-lg px-2 text-[16px] font-medium text-[#0b1f44]', FOCUS)}>
                {n.label}
              </LienSite>
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
