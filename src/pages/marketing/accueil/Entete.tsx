import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronDown, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NAV, type OutilNav } from './contenu'
import { FOCUS, LienSite } from './ui'

/**
 * La barre du haut, à la manière d'inview.ch : posée en haut de la page, sans
 * fond ni cadre, et elle ne suit pas la lecture (on la retrouve en remontant).
 * Le logo à gauche, les ancres au centre, le compte à droite.
 *
 * Fonctionnalités ouvre, au survol ou par sa flèche, la liste des outils
 * (MenuOutils). Sous 1024 px, tout passe dans un menu, qu'Échap ou un choix
 * referment ; les outils y sont listés sous Fonctionnalités.
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
    <header className="relative z-50 px-4 pt-4 sm:px-6">
      <a href="#contenu" className={cn('sr-only rounded-full bg-white px-4 py-2 text-[14px] font-medium focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50', FOCUS)}>
        Aller au contenu
      </a>
      <div className="mx-auto flex h-[76px] w-full max-w-[1200px] items-center gap-4 px-1 sm:px-2 lg:px-4">
        <LienSite to="/#haut" aria-label="Diagly, accueil" className={cn('flex min-h-11 shrink-0 items-center rounded-md', FOCUS)}>
          <img src="/diagly-logo.svg" alt="Diagly" width={101} height={32} className="h-8 w-auto sm:h-10" />
        </LienSite>

        <nav aria-label="Le site" className="hidden flex-1 justify-center lg:flex">
          <ul className="flex items-center gap-0.5">
            {NAV.map((n) => n.outils ? <MenuOutils key={n.href} href={n.href} label={n.label} outils={n.outils} /> : (
              <li key={n.href}>
                <LienSite to={n.href} className={LIEN_BARRE}>
                  {n.label}
                </LienSite>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2 lg:ml-0">
          <Link to="/login" className={cn('hidden min-h-12 items-center rounded-full px-4 text-[16px] font-medium text-[#3f4654] hover:text-[#0b1f44] sm:inline-flex', FOCUS)}>
            Se connecter
          </Link>
          <LienSite
            to="/#demo"
            className={cn(
              'group inline-flex min-h-12 items-center gap-2 whitespace-nowrap rounded-xl bg-[#0167EA] px-4 text-[14px] font-medium text-white transition-colors hover:bg-[#0154c4] sm:px-6 sm:text-[15px]',
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
            className={cn('flex h-12 w-12 items-center justify-center rounded-full text-[#0b1f44] hover:bg-black/[0.05] lg:hidden', FOCUS)}
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
              {n.outils && (
                <ul className="mb-2 grid grid-cols-2 gap-x-2 pl-2">
                  {n.outils.map((o) => (
                    <li key={o.href}>
                      <LienSite to={o.href} onClick={() => setOuvert(false)} className={cn('flex min-h-11 items-center gap-2 rounded-lg px-2 text-[14px] text-[#4b5563]', FOCUS)}>
                        <o.icone className="h-4 w-4 shrink-0 text-[#0167EA]" aria-hidden="true" />{o.label}
                      </LienSite>
                    </li>
                  ))}
                </ul>
              )}
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

const LIEN_BARRE = cn('block rounded-full px-4 py-2 text-[16px] font-medium text-[#3f4654] transition-colors hover:bg-[#eef4ff] hover:text-[#0b1f44]', FOCUS)

/**
 * Fonctionnalités et sa liste d'outils, sur ordinateur. Le mot mène à la
 * page ; le survol, ou la flèche à côté (clavier, écran tactile), ouvre la
 * liste. Elle se referme quand la souris ou le focus la quittent, sur Échap,
 * ou d'un clic ailleurs. La marge du haut du panneau fait partie de la zone
 * survolée : la souris peut descendre de la barre au panneau sans le fermer.
 */
function MenuOutils({ href, label, outils }: { href: string; label: string; outils: OutilNav[] }) {
  const [ouvert, setOuvert] = useState(false)
  const zone = useRef<HTMLLIElement>(null)
  const fleche = useRef<HTMLButtonElement>(null)
  const idPanneau = useId()

  useEffect(() => {
    if (!ouvert) return
    const echap = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOuvert(false); fleche.current?.focus() } }
    const ailleurs = (e: PointerEvent) => { if (!zone.current?.contains(e.target as Node)) setOuvert(false) }
    window.addEventListener('keydown', echap)
    document.addEventListener('pointerdown', ailleurs)
    return () => { window.removeEventListener('keydown', echap); document.removeEventListener('pointerdown', ailleurs) }
  }, [ouvert])

  return (
    <li
      ref={zone}
      className="relative flex items-center"
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') setOuvert(true) }}
      onPointerLeave={(e) => { if (e.pointerType === 'mouse') setOuvert(false) }}
      onBlur={(e) => { if (!zone.current?.contains(e.relatedTarget as Node)) setOuvert(false) }}
    >
      <LienSite to={href} className={cn(LIEN_BARRE, 'pr-1.5')}>{label}</LienSite>
      <button
        ref={fleche}
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        aria-controls={idPanneau}
        aria-label={ouvert ? 'Fermer la liste des fonctionnalités' : 'Voir la liste des fonctionnalités'}
        className={cn('-ml-1 flex h-9 w-7 items-center justify-center rounded-full text-[#3f4654] hover:text-[#0b1f44]', FOCUS)}
      >
        <ChevronDown className={cn('h-4 w-4 transition-transform duration-200', ouvert && 'rotate-180')} aria-hidden="true" />
      </button>

      <div id={idPanneau} hidden={!ouvert} className="absolute left-1/2 top-full w-[620px] -translate-x-1/2 pt-3">
        <div className="rounded-2xl border border-black/[0.06] bg-white p-2 shadow-[0_24px_60px_-20px_rgba(11,31,68,0.35)]">
          <ul className="grid grid-cols-2 gap-0.5">
            {outils.map((o) => (
              <li key={o.href}>
                <LienSite to={o.href} onClick={() => setOuvert(false)} className={cn('group flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-[#f3f7fe]', FOCUS)}>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#eef5ff] text-[#0167EA]">
                    <o.icone className="h-[18px] w-[18px]" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-[14px] font-semibold text-[#0b1220]">{o.label}</span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-[#6b7280]">{o.detail}</span>
                  </span>
                </LienSite>
              </li>
            ))}
            <li>
              <LienSite to={href} onClick={() => setOuvert(false)} className={cn('flex h-full items-center justify-center gap-1.5 rounded-xl bg-[#f3f7fe] p-3 text-[14px] font-semibold text-[#0167EA] hover:bg-[#e8f0fd]', FOCUS)}>
                Tout voir<ArrowRight className="h-4 w-4" aria-hidden="true" />
              </LienSite>
            </li>
          </ul>
        </div>
      </div>
    </li>
  )
}
