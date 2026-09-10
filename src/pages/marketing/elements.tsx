import { Link } from 'react-router-dom'
import { ChevronRight, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Le vocabulaire visuel de la page publique.
 *
 * Ces quelques pièces reviennent d'une section à l'autre : un bouton, un lien,
 * un titre, un chapô, une capture. Les tenir au même endroit évite qu'une
 * section dérive et que la page se mette à parler deux langues.
 */

/** Bouton plein avec la flèche en pastille claire, la signature de la maison. */
export function BoutonFleche({ children, to, className }: { children: React.ReactNode; to: string; className?: string }) {
  return (
    <Link
      to={to}
      className={cn(
        'group inline-flex items-center gap-2.5 rounded-full bg-[#0167EA] py-3 pl-6 pr-2 text-[15px] text-white',
        'transition-colors hover:bg-[#0154c4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0167EA]',
        className,
      )}
    >
      {children}
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20 transition-transform group-hover:translate-x-0.5">
        <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
      </span>
    </Link>
  )
}

export function Pilule({ children, to, className }: { children: React.ReactNode; to: string; className?: string }) {
  return (
    <Link
      to={to}
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-[#0167EA] px-6 py-3 text-[15px] text-white',
        'transition-colors hover:bg-[#0154c4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0167EA]',
        className,
      )}
    >
      {children}
    </Link>
  )
}

export function LienFleche({ children, href, to }: { children: React.ReactNode; href?: string; to?: string }) {
  const contenu = <>{children}<ChevronRight className="h-4 w-4" aria-hidden="true" /></>
  const styles = 'inline-flex items-center gap-0.5 text-[15px] text-[#0167EA] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0167EA]'
  return to ? <Link to={to} className={styles}>{contenu}</Link> : <a href={href} className={styles}>{contenu}</a>
}

/** Titre de section : très grand, très serré, centré. La règle de la maison. */
export function GrandTitre({ children, sombre, className }: { children: React.ReactNode; sombre?: boolean; className?: string }) {
  return (
    <h2 className={cn(
      'text-balance text-center text-[clamp(2rem,5.2vw,3.5rem)] font-semibold leading-[1.06] tracking-[-0.028em]',
      sombre ? 'text-white' : 'text-[#1d1d1f]',
      className,
    )}>
      {children}
    </h2>
  )
}

export function Chapo({ children, sombre }: { children: React.ReactNode; sombre?: boolean }) {
  return (
    <p className={cn('mx-auto mt-5 max-w-2xl text-balance text-center text-[clamp(1.05rem,1.9vw,1.35rem)] leading-[1.4]',
      sombre ? 'text-white/65' : 'text-[#6e6e73]')}>
      {children}
    </p>
  )
}

/** Petit intitulé au-dessus d'un titre, pour situer la section d'un mot. */
export function Surtitre({ children, sombre }: { children: React.ReactNode; sombre?: boolean }) {
  return (
    <p className={cn('mb-4 text-center text-[12px] font-semibold uppercase tracking-[0.16em]',
      sombre ? 'text-[#4d9bff]' : 'text-[#0167EA]')}>
      {children}
    </p>
  )
}

/** Capture de l'application, présentée comme un objet posé sur la page. */
export function Capture({ src, alt, className, sombre }: {
  src: string; alt: string; className?: string; sombre?: boolean
}) {
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={cn('mx-auto block w-full rounded-[22px]',
        sombre ? 'shadow-[0_24px_80px_-30px_rgba(0,0,0,0.9)]' : 'shadow-[0_24px_70px_-30px_rgba(0,0,0,0.35)]',
        className)}
    />
  )
}
