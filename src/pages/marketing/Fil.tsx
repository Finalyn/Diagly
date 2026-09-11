import { useEffect, useRef } from 'react'

/**
 * Le fil qui relie deux étapes.
 *
 * Six sections numérotées peuvent se lire comme six pages sans rapport. Un trait
 * qui descend d'une section à la suivante dit que c'est le même mouvement, et ses
 * détours donnent à l'oeil de quoi suivre au lieu d'un simple séparateur.
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
 * traverser la couture entre deux fonds de couleurs différentes. Sa hauteur tient
 * dans le plus étroit des espaces libres mesurés de part et d'autre d'une couture,
 * 128 px sur écran large et 96 px sur téléphone : au-delà, il mordrait sur le
 * dernier paragraphe de la section précédente. Le dessin s'y adapte tout seul,
 * l'image vectorielle étant mise à l'échelle de sa hauteur.
 */

/**
 * Le trait : il part du centre, s'écarte à gauche, revient à droite, repart à
 * gauche, et se recentre pour rejoindre le titre suivant. Quatre courbes, jamais
 * un aplomb : une ligne droite entre deux sections ferait séparateur, alors qu'on
 * veut le geste de quelqu'un qui relie deux idées à la main.
 *
 * Les points de contrôle prolongent chaque courbe dans la suivante, sinon un
 * angle apparaît à chaque raccord et le geste devient une succession de traits.
 */
const TRACE = 'M100 0 C100 34 46 48 44 92 C42 138 142 150 144 196 C146 244 58 256 60 300 C61 326 100 322 100 340'

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
      className={`pointer-events-none absolute -top-[88px] left-1/2 h-[176px] w-[200px] -translate-x-1/2 md:-top-[116px] md:h-[232px] ${className ?? ''}`}
    >
      <svg viewBox="0 0 200 340" className="h-full w-full overflow-visible" fill="none">
        <path ref={trait} d={TRACE} stroke="#0167EA" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  )
}
