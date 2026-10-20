import { useEffect, useRef, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { typo } from './typo'

/**
 * Le vocabulaire du site public (accueil et page Fonctionnalités) : boutons,
 * liens d'une page à l'autre, en-tête de section, apparition au défilement.
 *
 * Tout ce qui revient d'une section à l'autre vit ici, pour que la page parle
 * une seule langue visuelle.
 */

/** L'anneau de focus de la page : bleu Diagly, décalé, visible au clavier seulement. */
export const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[#0167EA]'

const BOUTON = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-[15px] font-medium transition-colors'

/** Bouton principal : plein, bleu Diagly. `to` pour une route, `href` pour une ancre ou un lien externe. */
export function Bouton({ children, to, href, variante = 'plein', className }: {
  children: ReactNode
  to?: string
  href?: string
  variante?: 'plein' | 'contour' | 'clair'
  className?: string
}) {
  const styles = cn(
    BOUTON, FOCUS,
    variante === 'plein' && 'bg-[#0167EA] text-white shadow-[0_1px_2px_rgba(1,103,234,0.25),0_8px_20px_-8px_rgba(1,103,234,0.6)] hover:bg-[#0154c4]',
    variante === 'contour' && 'bg-white text-[#1d1d1f] ring-1 ring-inset ring-black/[0.12] hover:bg-[#f5f5f7]',
    variante === 'clair' && 'bg-white text-[#0b1220] hover:bg-white/90',
    className,
  )
  if (to) return <Link to={to} className={styles}>{children}</Link>
  return <a href={href} className={styles}>{children}</a>
}

/**
 * Un lien du site public. Vers une ancre de la page où l'on est déjà, c'est
 * une ancre ordinaire : le navigateur défile. Vers une autre page, c'est un
 * lien du routeur, et la page d'arrivée descend à l'ancre (useAncre). Une
 * adresse e-mail ou un site externe restent des liens simples.
 */
export function LienSite({ to, className, children, onClick, 'aria-label': ariaLabel }: {
  to: string
  className?: string
  children: ReactNode
  onClick?: () => void
  'aria-label'?: string
}) {
  const { pathname } = useLocation()
  if (/^(mailto:|https?:)/.test(to)) return <a href={to} className={className} onClick={onClick} aria-label={ariaLabel}>{children}</a>
  const [chemin, ancre] = to.split('#')
  if (ancre !== undefined && (chemin === '' || chemin === pathname)) {
    return <a href={`#${ancre}`} className={className} onClick={onClick} aria-label={ariaLabel}>{children}</a>
  }
  return <Link to={to} className={className} onClick={onClick} aria-label={ariaLabel}>{children}</Link>
}

/** Lien texte suivi d'une flèche, pour l'action secondaire d'un bloc. */
export function LienFleche({ children, href, to, className }: { children: ReactNode; href?: string; to?: string; className?: string }) {
  const styles = cn('group inline-flex min-h-11 items-center gap-1.5 text-[15px] font-medium text-[#0167EA] hover:text-[#0154c4]', FOCUS, className)
  const contenu = <>{children}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></>
  return to ? <Link to={to} className={styles}>{contenu}</Link> : <a href={href} className={styles}>{contenu}</a>
}

/**
 * L'en-tête centré d'une section : un grand titre d'un trait fin, puis une
 * ligne de sous-titre. Le titre est en poids moyen : la page parle calmement,
 * seul le héros parle fort.
 */
export function EnTeteCentre({ titre, sousTitre, id, sombre, className }: {
  titre: ReactNode
  sousTitre?: ReactNode
  id?: string
  sombre?: boolean
  className?: string
}) {
  return (
    <Apparition className={cn('mx-auto flex max-w-3xl flex-col items-center text-center', className)}>
      <h2
        id={id}
        className={cn(
          'text-balance text-[clamp(2.1rem,4.6vw,3.4rem)] font-medium leading-[1.06] tracking-[-0.04em]',
          sombre ? 'text-white' : 'text-[#0b1220]',
        )}
      >
        {typo(titre)}
      </h2>
      {sousTitre && (
        <p className={cn('mt-4 max-w-[38rem] text-pretty text-[15.5px] leading-[1.6]', sombre ? 'text-white/60' : 'text-[#6b7280]')}>
          {typo(sousTitre)}
        </p>
      )}
    </Apparition>
  )
}

/** La largeur commune des sections, avec la gouttière de 16 px sur téléphone. */
export function Conteneur({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8', className)}>{children}</div>
}

/**
 * Fait apparaître un bloc quand il entre à l'écran : un fondu et un léger
 * glissement vers le haut, une seule fois.
 *
 * Le mouvement réduit est respecté par la feuille de style (index.css) : il
 * ne reste alors que le fondu. Sans IntersectionObserver, le bloc est
 * simplement visible.
 */
export function Apparition({ children, className, delai = 0, as: Balise = 'div' }: {
  children: ReactNode
  className?: string
  delai?: number
  as?: 'div' | 'li' | 'article' | 'section'
}) {
  const ref = useRef<HTMLElement | null>(null)
  // La classe est posée sur l'élément lui-même : apparaître ne fait pas
  // redessiner la maquette qu'il contient.
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const o = new IntersectionObserver((entrees) => {
      if (entrees.some((e) => e.isIntersecting)) { el.classList.add('est-visible'); o.disconnect() }
    }, { rootMargin: '0px 0px -8% 0px' })
    o.observe(el)
    return () => o.disconnect()
  }, [])
  return (
    <Balise
      ref={(el: HTMLElement | null) => { ref.current = el }}
      className={cn(typeof IntersectionObserver !== 'undefined' && 'accueil-apparition', className)}
      style={delai ? { transitionDelay: `${delai}ms` } : undefined}
    >
      {children}
    </Balise>
  )
}

/**
 * Une maquette pour les lecteurs d'écran : une image décrite d'une phrase.
 * Son contenu, du faux texte d'interface, leur est caché.
 */
export function Maquette({ description, children, className }: { description: string; children: ReactNode; className?: string }) {
  return (
    <figure role="img" aria-label={description} className={cn('m-0', className)}>
      <div aria-hidden="true">{children}</div>
    </figure>
  )
}

/** La coche de Diagly : elle signale ce que fait l'IA, à la place de toute icône d'étincelle. */
export function MarqueIA({ className }: { className?: string }) {
  return <img src="/diagly-mark.svg" alt="" aria-hidden="true" className={cn('shrink-0', className)} />
}
