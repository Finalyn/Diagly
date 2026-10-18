import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Apparition, Chapo, Echelle, MarqueIA, Surtitre, TitreSection } from '../ui'
import { typo } from '../typo'

/**
 * Les pièces des sections sous le héros : l'en-tête d'une section, une
 * fonctionnalité avec son icône, et la fenêtre de navigateur qui encadre une
 * maquette d'écran d'ordinateur.
 */

export function EnTeteSection({ surtitre, titre, chapo, centre, sombre, id }: {
  surtitre: string
  titre: ReactNode
  chapo?: ReactNode
  centre?: boolean
  sombre?: boolean
  /** L'identifiant du titre, pour nommer la section (aria-labelledby). */
  id?: string
}) {
  return (
    <Apparition className={cn(centre && 'mx-auto flex max-w-3xl flex-col items-center text-center')}>
      <Surtitre sombre={sombre}>{surtitre}</Surtitre>
      <TitreSection sombre={sombre} id={id}>{titre}</TitreSection>
      {chapo && <Chapo sombre={sombre}>{chapo}</Chapo>}
    </Apparition>
  )
}

/** Une fonctionnalité : son icône, ou la coche de Diagly quand c'est l'IA qui agit. */
export function Point({ icone: Icone, ia, titre, children, sombre }: { icone?: LucideIcon; ia?: boolean; titre: string; children: ReactNode; sombre?: boolean }) {
  return (
    <div className="flex gap-4">
      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', sombre ? 'bg-white/10 text-[#9cc6ff]' : 'bg-[#eef5ff] text-[#0167EA]')}>
        {ia ? <MarqueIA className="h-5 w-5" /> : Icone && <Icone className="h-5 w-5" aria-hidden="true" />}
      </span>
      <div>
        <h3 className={cn('text-[17px] font-semibold leading-snug tracking-[-0.01em]', sombre ? 'text-white' : 'text-[#1d1d1f]')}>{titre}</h3>
        <p className={cn('mt-1 text-[15px] leading-relaxed', sombre ? 'text-white/65' : 'text-[#545458]')}>{typo(children)}</p>
      </div>
    </div>
  )
}

/** Une fenêtre de navigateur, ses trois pastilles et l'adresse de la page. */
export function Fenetre({ largeur, hauteur, adresse, children, className }: {
  largeur: number
  hauteur: number
  adresse: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('overflow-hidden rounded-[14px] border border-black/[0.08] bg-white shadow-[0_30px_70px_-30px_rgba(16,36,80,0.4)]', className)}>
      <div className="flex h-9 items-center gap-2 border-b border-black/[0.06] bg-[#f6f6f8] px-3">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        </span>
        <span className="mx-auto truncate rounded-md bg-white px-3 py-0.5 text-[11px] text-[#6e6e73] ring-1 ring-black/[0.06]">{adresse}</span>
        <span className="w-[42px]" aria-hidden="true" />
      </div>
      <Echelle largeur={largeur} hauteur={hauteur}>{children}</Echelle>
    </div>
  )
}

/** Une section de fonctionnalité : le texte d'un côté, la maquette de l'autre. */
export function Fonctionnalite({ id, fond, inverse, texte, maquette, labelledBy }: {
  id: string
  fond?: 'blanc' | 'gris'
  inverse?: boolean
  texte: ReactNode
  maquette: ReactNode
  labelledBy: string
}) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={cn('scroll-mt-16 py-20 sm:py-28', fond === 'gris' ? 'bg-[#f5f7fa]' : 'bg-white')}>
      <div className="mx-auto grid w-full max-w-[1200px] items-center gap-12 px-4 sm:px-6 lg:grid-cols-12 lg:gap-14 lg:px-8">
        <div className={cn('lg:col-span-5', inverse && 'lg:order-2')}>{texte}</div>
        <Apparition className={cn('min-w-0 lg:col-span-7', inverse && 'lg:order-1')} delai={80}>{maquette}</Apparition>
      </div>
    </section>
  )
}
