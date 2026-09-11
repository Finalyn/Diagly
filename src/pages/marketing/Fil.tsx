import { useEffect, useRef } from 'react'

/**
 * Le fil qui relie deux étapes.
 *
 * Six sections numérotées peuvent se lire comme six pages sans rapport. Un trait
 * qui descend d'une section à la suivante dit que c'est le même mouvement, et la
 * petite boucle donne à l'oeil un endroit où se poser au passage.
 *
 * Il se dessine au défilement : la longueur visible suit l'avancée du trait dans
 * l'écran. Le décalage de pointillés est écrit directement sur le trait plutôt
 * que rangé dans un état React : à soixante images par seconde, faire rendre un
 * composant pour déplacer un trait serait payer très cher un seul nombre.
 *
 * Rien n'est montré avant : pas de tracé pâle qui annoncerait la suite. Le fil
 * n'existe qu'à mesure qu'on descend.
 *
 * Il est posé en débordement au-dessus de la section qui le porte, ce qui le fait
 * traverser la couture entre deux fonds de couleurs différentes.
 */

/**
 * Le trait : il descend, fait un tour sur lui-même en repassant plus haut que
 * son point d'entrée, puis repart. L'arc va de 66 à 50, donc vers le haut : c'est
 * ce retour en arrière qui crée le croisement. Le drapeau de sens le fait
 * passer à gauche du trait.
 */
const TRACE = 'M30 0 L30 66 A 13 13 0 1 1 30 50 L30 150'

export function Fil({ className }: { className?: string }) {
  const trait = useRef<SVGPathElement>(null)
  const boite = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const path = trait.current
    const el = boite.current
    if (!path || !el) return

    const longueur = path.getTotalLength()
    path.style.strokeDasharray = String(longueur)

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      path.style.strokeDashoffset = '0'
      return
    }

    let demande = 0
    const relire = () => {
      demande = 0
      const { top, height } = el.getBoundingClientRect()
      // Le trait se remplit entre le moment où il entre par le bas et celui où
      // il atteint le tiers supérieur : il finit donc avant de sortir de l'écran.
      const debut = window.innerHeight
      const fin = window.innerHeight / 3
      const part = Math.min(Math.max((debut - top) / (debut - fin + height), 0), 1)
      path.style.strokeDashoffset = String(longueur * (1 - part))
    }
    const auDefilement = () => {
      if (demande) return
      demande = requestAnimationFrame(relire)
    }
    relire()
    window.addEventListener('scroll', auDefilement, { passive: true })
    window.addEventListener('resize', auDefilement)
    return () => {
      if (demande) cancelAnimationFrame(demande)
      window.removeEventListener('scroll', auDefilement)
      window.removeEventListener('resize', auDefilement)
    }
  }, [])

  return (
    <div
      ref={boite}
      aria-hidden="true"
      className={`pointer-events-none absolute -top-[86px] left-1/2 h-[176px] w-[70px] -translate-x-1/2 ${className ?? ''}`}
    >
      <svg viewBox="0 0 60 150" className="h-full w-full overflow-visible" fill="none">
        <path ref={trait} d={TRACE} stroke="#0167EA" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  )
}
