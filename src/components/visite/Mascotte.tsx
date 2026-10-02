/**
 * Diago, le guide de chantier.
 *
 * Une boule bleue, deux yeux, un casque. Rien d'autre : à la taille où il
 * apparaît, dans une bulle ou sur une carte, un personnage entier n'était qu'un
 * amas de petites formes, et ses bras se lisaient mal.
 *
 * Sans bras, c'est le regard qui désigne : les pupilles vont vers la cible et la
 * boule se penche du même côté. Un regard porte aussi loin qu'un index, et il
 * reste lisible à quarante pixels de haut.
 */

import { cn } from '@/lib/utils'

export type Pose = 'salue' | 'montre' | 'explique' | 'bravo' | 'reflechit'
export type Vers = 'gauche' | 'droite' | 'haut' | 'bas'

const CASQUE = '#2563eb'
const CASQUE_OMBRE = '#1d4ed8'
const BOULE = '#93c5fd'
const BOULE_OMBRE = '#60a5fa'
const TRAIT = '#1e3a8a'

/** Décalage des pupilles et inclinaison de la boule, selon ce qu'on désigne. */
const REGARDS: Record<Vers, { x: number; y: number; penche: number }> = {
  droite: { x: 4.5, y: 0, penche: 8 },
  gauche: { x: -4.5, y: 0, penche: -8 },
  haut: { x: 0, y: -4, penche: 0 },
  bas: { x: 0, y: 3.5, penche: 0 },
}

export function Mascotte({ pose = 'explique', vers, taille = 96, anime = true, className }: {
  pose?: Pose
  /** Direction désignée : la boule regarde par là. */
  vers?: Vers | null
  /** Hauteur en pixels. */
  taille?: number
  anime?: boolean
  className?: string
}) {
  const regard = pose === 'montre'
    ? REGARDS[vers ?? 'droite']
    : { x: 0, y: pose === 'reflechit' ? -4 : 0, penche: 0 }
  // Content, il ferme les yeux : c'est tout ce qu'il faut pour sourire.
  const content = pose === 'bravo' || pose === 'salue'

  const mouvement = !anime ? undefined
    : pose === 'salue' ? 'visite-salue'
      : pose === 'reflechit' ? 'visite-penche'
        : undefined

  return (
    <svg
      viewBox="0 0 120 120"
      height={taille}
      width={taille}
      role="img"
      aria-label="Diago, votre guide"
      className={cn('shrink-0 overflow-visible', anime && 'visite-flotte', className)}
    >
      <ellipse cx="60" cy="110" rx="26" ry="4.5" fill={TRAIT} opacity="0.1" />

      <g className={mouvement} style={{ transformOrigin: '60px 76px' }}>
        <g transform={`rotate(${regard.penche} 60 76)`}>
          <circle cx="60" cy="72" r="34" fill={BOULE} />
          {/* Une ombre posée en bas : sans elle, la boule n'est qu'un disque. */}
          <ellipse cx="60" cy="100" rx="18" ry="5" fill={BOULE_OMBRE} opacity="0.4" />

          {/* Le casque, porté et non posé : la visière coupe la boule au quart
              de sa hauteur, et la calotte épouse sa courbe. Plus haut, il avait
              l'air d'un chapeau melon en équilibre. */}
          <path d="M30 55a30 29 0 0 1 60 0z" fill={CASQUE} />
          <path d="M56 26.3a30 29 0 0 1 8 0V55h-8z" fill={CASQUE_OMBRE} opacity="0.5" />
          <ellipse cx="60" cy="56" rx="44" ry="6.5" fill={CASQUE} />
          <path d="M16 55a44 6.5 0 0 1 88 0 44 6.5 0 0 0-88 0z" fill="#ffffff" opacity="0.18" />

          {content ? (
            <>
              <path d="M40 81c3.5-6 10.5-6 14 0" stroke={TRAIT} strokeWidth="4.2" strokeLinecap="round" fill="none" />
              <path d="M66 81c3.5-6 10.5-6 14 0" stroke={TRAIT} strokeWidth="4.2" strokeLinecap="round" fill="none" />
            </>
          ) : (
            <>
              <circle cx="47" cy="78" r="7.5" fill="#ffffff" />
              <circle cx="73" cy="78" r="7.5" fill="#ffffff" />
              <circle cx={47 + regard.x} cy={78 + regard.y} r="4.4" fill={TRAIT} />
              <circle cx={73 + regard.x} cy={78 + regard.y} r="4.4" fill={TRAIT} />
            </>
          )}

          <path
            d={content ? 'M50 91c4 6.5 16 6.5 20 0' : 'M53 91c2.8 3.6 11.2 3.6 14 0'}
            stroke={TRAIT}
            strokeWidth="3.4"
            strokeLinecap="round"
            fill="none"
          />
        </g>
      </g>
    </svg>
  )
}
