/**
 * Diago, le guide de chantier.
 *
 * Dessiné plutôt qu'importé : une illustration tierce vieillit mal, pèse, et ne
 * change pas de pose. Celle-ci est en SVG, dans les bleus de l'app, et son bras
 * suit vraiment ce qu'elle désigne.
 *
 * Il est bleu de la tête aux pieds, casque compris : un personnage de chantier
 * sans teint de peau à choisir, qui reste à sa place dans une interface sobre.
 *
 * Les bras sont des traits épais à bout rond, pivotés autour de l'épaule. Ils
 * sont bleus et non blancs : la bulle de la visite est blanche, et un bras blanc
 * y disparaissait, ce qui ôtait au personnage le seul geste qui compte, montrer.
 */

import { cn } from '@/lib/utils'

export type Pose = 'salue' | 'montre' | 'explique' | 'bravo' | 'reflechit'
export type Vers = 'gauche' | 'droite' | 'haut' | 'bas'

const CASQUE = '#2563eb'
const CASQUE_OMBRE = '#1d4ed8'
const PEAU = '#bfdbfe'
const TRAIT = '#1e3a8a'
const TENUE = '#3b82f6'
const TEE = '#dbeafe'
const BOTTE = '#1e40af'

/**
 * Épaules, dans le repère du dessin.
 *
 * Elles sont posées sur le bord du torse, et non en son milieu : un bras qui
 * part du centre du corps reste caché derrière lui quel que soit son angle.
 */
const EPAULE_G = { x: 38, y: 100 }
const EPAULE_D = { x: 82, y: 100 }

/** Angle du bras tendu, en degrés, selon ce qu'il désigne. Zéro = vers le bas. */
const ANGLES: Record<Vers, { droite: number; gauche: number }> = {
  droite: { droite: -115, gauche: 0 },
  gauche: { droite: 0, gauche: 115 },
  haut: { droite: -155, gauche: 0 },
  bas: { droite: -60, gauche: 0 },
}

export function Mascotte({ pose = 'explique', vers, taille = 96, anime = true, className }: {
  pose?: Pose
  /** Direction désignée, pour la pose « montre ». */
  vers?: Vers | null
  /** Hauteur en pixels. */
  taille?: number
  anime?: boolean
  className?: string
}) {
  const direction: Vers = vers ?? 'droite'
  const angles = ANGLES[direction]
  // Une cible à gauche se désigne du bras gauche : un personnage qui montre en
  // travers de son propre corps ne désigne plus rien.
  const brasQuiMontre = pose === 'montre' ? (direction === 'gauche' ? 'gauche' : 'droite') : null

  return (
    <svg
      viewBox="0 0 120 150"
      height={taille}
      width={(taille * 120) / 150}
      role="img"
      aria-label="Diago, votre guide"
      className={cn('shrink-0 overflow-visible', anime && 'visite-flotte', className)}
    >
      <ellipse cx="60" cy="144" rx="25" ry="4.5" fill={TRAIT} opacity="0.1" />

      {/* Jambes et bottes */}
      <rect x="46" y="120" width="12" height="20" rx="6" fill={TENUE} />
      <rect x="62" y="120" width="12" height="20" rx="6" fill={TENUE} />
      <rect x="42" y="132" width="18" height="10" rx="5" fill={BOTTE} />
      <rect x="60" y="132" width="18" height="10" rx="5" fill={BOTTE} />

      {/* Corps : tee bleu pâle, salopette bleue */}
      <rect x="35" y="88" width="50" height="38" rx="15" fill={TEE} />
      <path d="M35 103h50v8a15 15 0 0 1-15 15H50a15 15 0 0 1-15-15v-8z" fill={TENUE} />
      <rect x="52" y="92" width="16" height="13" rx="4" fill={TENUE} />
      <rect x="45" y="89" width="5" height="15" rx="2.5" fill={TENUE} />
      <rect x="70" y="89" width="5" height="15" rx="2.5" fill={TENUE} />
      <rect x="55" y="110" width="10" height="8" rx="2.5" fill={CASQUE_OMBRE} opacity="0.35" />

      {/* Les bras passent devant le corps : c'est le seul endroit d'où ils se
          voient en entier, quel que soit l'angle. */}
      <Bras cote="gauche" pose={pose} montre={brasQuiMontre === 'gauche'} angle={angles.gauche} anime={anime} />
      <Bras cote="droite" pose={pose} montre={brasQuiMontre === 'droite'} angle={angles.droite} anime={anime} />

      {/* Tête */}
      <g className={anime && pose === 'reflechit' ? 'visite-penche' : undefined} style={{ transformOrigin: '60px 92px' }}>
        <rect x="35" y="42" width="50" height="46" rx="18" fill={PEAU} />

        {/* Casque : calotte, nervure, visière */}
        <path d="M31 47a29 29 0 0 1 58 0z" fill={CASQUE} />
        <path d="M56 20.5a29 29 0 0 1 8 0V47h-8z" fill={CASQUE_OMBRE} opacity="0.5" />
        <rect x="23" y="44" width="74" height="9" rx="4.5" fill={CASQUE} />
        <rect x="23" y="44.5" width="74" height="3.5" rx="1.75" fill="#ffffff" opacity="0.2" />

        {/* Visage */}
        <circle cx="50" cy="65" r="4.3" fill={TRAIT} />
        <circle cx="70" cy="65" r="4.3" fill={TRAIT} />
        <circle cx="51.5" cy="63.5" r="1.5" fill="#ffffff" />
        <circle cx="71.5" cy="63.5" r="1.5" fill="#ffffff" />
        <path d="M51 75c3.6 4.2 14.4 4.2 18 0" stroke={TRAIT} strokeWidth="3.2" strokeLinecap="round" fill="none" />
      </g>
    </svg>
  )
}

/**
 * Un bras : un trait épais depuis l'épaule, une main au bout.
 *
 * Le pivot est l'épaule, si bien qu'un même dessin sert au repos, au salut et à
 * l'index tendu : seul l'angle change.
 */
function Bras({ cote, pose, montre, angle, anime }: {
  cote: 'gauche' | 'droite'
  pose: Pose
  montre: boolean
  angle: number
  anime: boolean
}) {
  const epaule = cote === 'gauche' ? EPAULE_G : EPAULE_D
  // Une rotation positive, en SVG, ramène le bras vers l'intérieur : le bras
  // droit s'écarte donc en négatif, et le gauche en positif.
  const sens = cote === 'gauche' ? 1 : -1

  // Au repos le bras pend, écarté du corps : collé, il se confond avec le torse.
  let rotation = sens * 26
  let longueur = 24
  let classe: string | undefined

  if (montre) {
    rotation = angle
    longueur = 27
  } else if (pose === 'salue' && cote === 'droite') {
    rotation = -150
    longueur = 24
    classe = anime ? 'visite-salue' : undefined
  } else if (pose === 'bravo' && cote === 'droite') {
    rotation = -140
    longueur = 20
  } else if (pose === 'reflechit' && cote === 'droite') {
    rotation = -118
    longueur = 17
  } else if (pose === 'explique') {
    rotation = sens * 40
    classe = anime ? 'visite-respire' : undefined
  }

  // Le bras est dessiné vers le bas puis pivoté : un seul repère à tenir.
  const bout = { x: epaule.x, y: epaule.y + longueur }

  return (
    <g transform={`rotate(${rotation} ${epaule.x} ${epaule.y})`}>
      <g className={classe} style={{ transformOrigin: `${epaule.x}px ${epaule.y}px` }}>
      <line x1={epaule.x} y1={epaule.y} x2={bout.x} y2={bout.y} stroke={TENUE} strokeWidth="11" strokeLinecap="round" />
      <circle cx={bout.x} cy={bout.y + 4} r="7" fill={PEAU} />

      {/* L'index, qui prolonge le bras : c'est lui qui fait le geste de montrer. */}
      {montre && <rect x={bout.x - 2.4} y={bout.y + 8} width="4.8" height="9" rx="2.4" fill={PEAU} />}

      {/* Les doigts du salut */}
      {pose === 'salue' && cote === 'droite' && !montre && (
        <path
          d={`M${bout.x - 5} ${bout.y + 10}v4M${bout.x} ${bout.y + 11}v5M${bout.x + 5} ${bout.y + 10}v4`}
          stroke={PEAU}
          strokeWidth="3.4"
          strokeLinecap="round"
        />
      )}

      {/* Le pouce levé */}
      {pose === 'bravo' && cote === 'droite' && !montre && (
        <rect x={bout.x + 3} y={bout.y + 1} width="5" height="10" rx="2.5" fill={PEAU} transform={`rotate(25 ${bout.x + 5.5} ${bout.y + 6})`} />
      )}
      </g>
    </g>
  )
}
