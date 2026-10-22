import { cn } from '@/lib/utils'

/**
 * Un iPad Pro à l'horizontale, avec un vrai écran de Diagly.
 *
 * Les images viennent des maquettes d'appareil faites sur les captures de
 * l'application (dossier d'exemple Résidence Les Tilleuls ; le relevé guidé
 * est une vraie capture prise sur iPad), exportées en WebP dans
 * public/accueil/ipad/ : le cadre et l'écran, sans Apple Pencil. Toutes ont
 * la même toile, le haut du cadre au même endroit : deux iPad côte à côte
 * restent alignés.
 *
 * L'ombre est portée par le dessin lui-même (drop-shadow) : elle suit le
 * cadre arrondi et détache un iPad posé sur un autre.
 */

export type NomIPad =
  | 'accueil' | 'metres-plan' | 'metres-tableau' | 'releve-guide-ia' | 'releve-etapes'
  | 'couts' | 'variantes' | 'presentation-reperage' | 'presentation-titre'
  | 'rapport-couverture' | 'rapport-devis' | 'assistant' | 'base-article' | 'base-liste'

/** Seul l'accueil, montré en très grand, a une version 2200 px. */
const TRES_GRAND: NomIPad[] = ['accueil']

export function IPad({ nom, alt, sizes, priorite, className }: {
  nom: NomIPad
  alt: string
  /** La largeur affichée, pour que le navigateur choisisse la bonne image. */
  sizes: string
  priorite?: boolean
  className?: string
}) {
  const base = `/accueil/ipad/ipad-${nom}`
  const srcSet = [`${base}-900.webp 900w`, `${base}-1600.webp 1600w`]
  if (TRES_GRAND.includes(nom)) srcSet.push(`${base}-2200.webp 2200w`)
  return (
    <img
      src={`${base}-1600.webp`}
      srcSet={srcSet.join(', ')}
      sizes={sizes}
      alt={alt}
      width={1382}
      height={1090}
      loading={priorite ? 'eager' : 'lazy'}
      decoding="async"
      className={cn('block h-auto w-full select-none [filter:drop-shadow(0_28px_36px_rgba(11,31,68,0.28))_drop-shadow(0_4px_8px_rgba(11,31,68,0.12))]', className)}
      draggable={false}
    />
  )
}
