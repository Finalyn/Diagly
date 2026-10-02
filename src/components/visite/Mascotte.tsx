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

/*
 * Le casque est jaune, et non bleu comme le reste.
 *
 * Un casque bleu sur une boule bleue n'était plus qu'un chapeau : la couleur
 * est le premier signe d'un casque de chantier, avant même la forme. Ce jaune
 * est celui que l'app emploie déjà pour ses avertissements, il ne sort donc pas
 * de la palette.
 */
const CASQUE = '#fbbf24'
const CASQUE_OMBRE = '#f59e0b'
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

          {/*
            Le casque.

            Une calotte basse posée sur une visière plate faisait un chapeau
            melon. Trois choses distinguent un casque de chantier, et elles y
            sont toutes : une calotte haute qui couvre toute la tête, les
            nervures du dessus, et une visière qui avance, plus épaisse au
            milieu qu'aux tempes. La couleur fait le reste : le jaune de
            chantier se reconnaît avant même la forme.
          */}
          <path d="M23 57a37 36 0 0 1 74 0z" fill={CASQUE} />
          <path d="M55.5 21.3a37 36 0 0 1 9 0V57h-9z" fill={CASQUE_OMBRE} />
          <path d="M38 57q-3-21 7-31M82 57q3-21-7-31" stroke={CASQUE_OMBRE} strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.6" />
          <path d="M15 55Q60 79 105 55Q60 63 15 55Z" fill={CASQUE} />
          <path d="M15 55Q60 79 105 55Q60 71 15 55Z" fill={CASQUE_OMBRE} opacity="0.5" />

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
