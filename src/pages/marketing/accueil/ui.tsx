import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { typo } from './typo'

/**
 * Le vocabulaire de la page d'accueil : boutons, titres de section,
 * apparition au défilement et mise à l'échelle des maquettes.
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

/** Lien texte suivi d'une flèche, pour l'action secondaire d'un bloc. */
export function LienFleche({ children, href, to, className }: { children: ReactNode; href?: string; to?: string; className?: string }) {
  const styles = cn('group inline-flex min-h-11 items-center gap-1.5 text-[15px] font-medium text-[#0167EA] hover:text-[#0154c4]', FOCUS, className)
  const contenu = <>{children}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></>
  return to ? <Link to={to} className={styles}>{contenu}</Link> : <a href={href} className={styles}>{contenu}</a>
}

/** Le petit intitulé bleu au-dessus d'un titre de section. */
export function Surtitre({ children, sombre, className }: { children: ReactNode; sombre?: boolean; className?: string }) {
  return (
    <p className={cn('text-[13px] font-semibold uppercase tracking-[0.14em]', sombre ? 'text-[#7ab4ff]' : 'text-[#0167EA]', className)}>
      {children}
    </p>
  )
}

/** Titre de section (h2) : grand, serré, à la mesure de l'écran. */
export function TitreSection({ children, sombre, className, id }: { children: ReactNode; sombre?: boolean; className?: string; id?: string }) {
  return (
    <h2
      id={id}
      className={cn(
        'mt-3 text-balance text-[clamp(1.9rem,4.4vw,3.1rem)] font-semibold leading-[1.08] tracking-[-0.03em]',
        sombre ? 'text-white' : 'text-[#1d1d1f]',
        className,
      )}
    >
      {typo(children)}
    </h2>
  )
}

/** Le paragraphe d'introduction d'une section. */
export function Chapo({ children, sombre, className }: { children: ReactNode; sombre?: boolean; className?: string }) {
  return (
    <p className={cn('mt-5 max-w-[42rem] text-pretty text-[17px] leading-[1.6] sm:text-[19px]', sombre ? 'text-white/70' : 'text-[#545458]', className)}>
      {typo(children)}
    </p>
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
 * Une maquette dessinée à une taille fixe, réduite à la largeur de sa place.
 *
 * Les écrans de Diagly sont reproduits à leur vraie taille (1440 px pour un
 * ordinateur, 393 px pour un iPhone) puis réduits d'un bloc : les
 * proportions restent celles de l'application, et le texte se redessine net à
 * chaque taille, là où une capture deviendrait floue. La hauteur est réservée
 * par le rapport largeur sur hauteur : rien ne saute pendant le chargement.
 */
export function Echelle({ largeur, hauteur, children, className }: {
  largeur: number
  hauteur: number
  children: ReactNode
  className?: string
}) {
  const boite = useRef<HTMLDivElement>(null)
  const [k, setK] = useState(1)
  useLayoutEffect(() => {
    const el = boite.current
    if (!el) return
    const maj = () => { if (el.clientWidth) setK(el.clientWidth / largeur) }
    maj()
    if (typeof ResizeObserver === 'undefined') return
    const o = new ResizeObserver(maj)
    o.observe(el)
    return () => o.disconnect()
  }, [largeur])
  return (
    <div ref={boite} className={cn('relative w-full', className)} style={{ aspectRatio: `${largeur} / ${hauteur}` }}>
      <div className="absolute left-0 top-0 origin-top-left" style={{ width: largeur, height: hauteur, transform: `scale(${k})` }}>
        {children}
      </div>
    </div>
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
