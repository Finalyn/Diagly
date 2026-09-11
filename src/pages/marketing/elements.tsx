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

/**
 * Le badge de l'App Store.
 *
 * Redessine plutot qu'importe : une image matricielle se voit sur un ecran
 * Retina, et le badge doit rester net a toutes les tailles. Le trace de la
 * pomme est celui d'Apple, la mise en page aussi : petite ligne au-dessus,
 * nom du magasin en dessous, filet clair autour du noir.
 *
 * L'application iOS n'existe pas encore. Le badge ne pointe donc nulle part et
 * porte sa mention : annoncer un telechargement qui n'aboutit pas ferait perdre
 * au visiteur la confiance que tout le reste de la page cherche a etablir.
 */
export function BadgeAppStore({ mention = 'Bientôt', sombre, className }: { mention?: string; sombre?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex flex-col items-center gap-2', className)}>
      <span
        role="img"
        aria-label="Télécharger dans l'App Store, bientôt disponible"
        className="inline-flex items-center gap-2.5 rounded-[11px] border border-white/45 bg-black px-4 py-2 text-white"
      >
        <svg viewBox="0 0 384 512" className="h-[30px] w-[30px] shrink-0 fill-current" aria-hidden="true">
          <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
        </svg>
        <span className="text-left leading-none">
          <span className="block text-[10px] tracking-[0.01em] text-white/90">Télécharger dans</span>
          <span className="mt-[3px] block text-[19px] font-semibold leading-none tracking-[-0.02em]">l’App Store</span>
        </span>
      </span>
      {mention && <span className={cn('text-[12px]', sombre ? 'text-white/45' : 'text-[#86868b]')}>{mention}</span>}
    </span>
  )
}
