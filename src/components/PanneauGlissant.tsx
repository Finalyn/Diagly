import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { spring, projeterElan, elastique, suiviVitesse, mouvementReduit, RESSORTS, type SpringHandle } from '@/lib/motion'

/**
 * Panneau plein écran qui entre par la droite et repart par la droite.
 *
 * Trois exigences, dans cet ordre d'importance :
 *
 * Il se saisit. Un glissement vers la droite le suit au doigt, 1 pour 1, y compris
 * pendant qu'il est en train de s'ouvrir ou de se fermer : le ressort en cours est
 * repris à sa valeur affichée, pas à sa cible, donc il n'y a jamais de saut.
 *
 * Il part d'où il est venu. Entrée et sortie empruntent le même chemin. Un panneau
 * qui arrive par la droite et s'efface sur place laisse le lecteur sans repère.
 *
 * Il vise là où le geste allait. Au relâchement, on projette l'élan plutôt que de
 * regarder la position : une chiquenaude franche ferme le panneau même si le doigt
 * n'a parcouru que trente pixels.
 */
export function PanneauGlissant({ ouvert, onFermer, children, className }: {
  ouvert: boolean
  onFermer: () => void
  children: ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const anim = useRef<SpringHandle | null>(null)
  const x = useRef(0)
  const geste = useRef<{ depart: number; xDepart: number; largeur: number; engage: boolean } | null>(null)
  const vitesse = useRef(suiviVitesse())
  // Le panneau reste monté le temps de sa sortie, sinon il disparaîtrait d'un coup.
  const [monte, setMonte] = useState(ouvert)

  const poser = (v: number) => {
    x.current = v
    const el = ref.current
    if (el) el.style.transform = v === 0 ? '' : `translate3d(${v}px, 0, 0)`
  }

  const largeur = () => ref.current?.offsetWidth ?? window.innerWidth

  const animerVers = (cible: number, v0 = 0, apres?: () => void) => {
    anim.current?.stop()
    anim.current = spring({
      from: x.current,
      to: cible,
      velocity: v0,
      // Le panneau a reçu de l'élan : un soupçon de rebond est mérité.
      ...RESSORTS.panneau,
      onUpdate: poser,
      onRest: () => { anim.current = null; apres?.() },
    })
  }

  useEffect(() => { if (ouvert) setMonte(true) }, [ouvert])

  useLayoutEffect(() => {
    if (!monte) return
    const el = ref.current
    if (!el) return
    if (ouvert) {
      // À la première pose, on part hors écran pour que l'entrée soit visible.
      if (anim.current == null && x.current === 0 && !el.dataset.entre) {
        el.dataset.entre = '1'
        poser(el.offsetWidth)
      }
      animerVers(0)
    } else {
      animerVers(el.offsetWidth, 0, () => { setMonte(false); poser(0); delete el.dataset.entre })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert, monte])

  useEffect(() => () => anim.current?.stop(), [])

  if (!monte) return null

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' || mouvementReduit()) return
    // On attrape le panneau où qu'il en soit : le ressort en cours est repris à sa
    // valeur affichée, ce qui rend le mouvement rattrapable en plein vol.
    anim.current?.stop()
    anim.current = null
    geste.current = { depart: e.clientX, xDepart: x.current, largeur: largeur(), engage: false }
    vitesse.current.reset()
    vitesse.current.ajouter(e.clientX)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const g = geste.current
    if (!g) return
    const dx = e.clientX - g.depart
    // Seuil avant de s'engager : sans lui, le moindre frémissement pendant un
    // défilement vertical déclencherait la fermeture.
    if (!g.engage) {
      if (Math.abs(dx) < 12) return
      g.engage = true
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    }
    vitesse.current.ajouter(e.clientX)
    const brut = g.xDepart + dx
    // Vers la gauche il n'y a rien : on résiste au lieu de bloquer net.
    poser(brut >= 0 ? brut : -elastique(-brut, g.largeur))
  }

  const onPointerUp = () => {
    const g = geste.current
    geste.current = null
    if (!g?.engage) return
    const v = vitesse.current.vitesse()
    // On vise le point où le geste allait, pas celui où le doigt s'est levé.
    const projete = x.current + projeterElan(v)
    if (projete > g.largeur / 2) animerVers(g.largeur, v, onFermer)
    else animerVers(0, v)
  }

  return (
    <div
      ref={ref}
      className={className}
      // Le glissement horizontal nous appartient, le défilement vertical reste au navigateur.
      style={{ touchAction: 'pan-y', willChange: 'transform' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {children}
    </div>
  )
}
