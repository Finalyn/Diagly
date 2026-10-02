import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Volume2, VolumeX, X } from 'lucide-react'
import { useVisite } from '@/stores/visite'
import { visiteParId } from '@/data/visites'
import { placerBulle, trouDuProjecteur, pointeDeLaBulle, type Rect } from '@/lib/visite'
import { useIsMobile } from '@/lib/use-mobile'
import { cn } from '@/lib/utils'

const LARGEUR_BULLE = 372
/** La même bordure que la bulle, pour que la pointe en soit le prolongement. */
const BORDURE = '1px solid rgb(0 0 0 / 0.06)'

/**
 * La visite guidée : le projecteur et la bulle qui explique.
 *
 * Elle est montée une fois pour toute l'application, parce qu'une visite
 * traverse les écrans : elle commence dans le centre d'aide et finit dans un
 * diagnostic. Le trou du projecteur est laissé libre au clic : on apprend un
 * geste en le faisant, pas en regardant un calque qui l'empêche.
 */
export function VisiteGuidee() {
  const visiteId = useVisite((s) => s.visite)
  const etape = useVisite((s) => s.etape)
  const parole = useVisite((s) => s.parole)
  const aller = useVisite((s) => s.aller)
  const quitter = useVisite((s) => s.quitter)
  const terminer = useVisite((s) => s.terminer)
  const basculerParole = useVisite((s) => s.basculerParole)

  const navigate = useNavigate()
  const location = useLocation()
  const isMobile = useIsMobile()

  const visite = visiteParId(visiteId)
  const pas = visite?.etapes[etape]
  const dernier = visite ? etape >= visite.etapes.length - 1 : false

  const bulleRef = useRef<HTMLDivElement>(null)
  const [cible, setCible] = useState<Rect | null>(null)
  const [hauteurBulle, setHauteurBulle] = useState(220)
  const [fenetre, setFenetre] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }))

  // La route d'abord : inutile de chercher un bouton sur un écran qu'on n'a pas
  // encore ouvert.
  useEffect(() => {
    if (!pas?.route) return
    if (location.pathname !== pas.route) navigate(pas.route)
  }, [pas, location.pathname, navigate])

  /*
   * La cible est relue à chaque image.
   *
   * Elle apparaît tard (une route qui charge), elle bouge (un défilement, un
   * panneau qui s'ouvre), elle disparaît. Une mesure unique au montage serait
   * fausse la moitié du temps ; un rectangle relu chaque image suit tout, pour
   * le prix d'un getBoundingClientRect.
   */
  useEffect(() => {
    if (!pas) return
    let brut = 0
    let amene = false
    const lire = () => {
      const el = pas.cible ? document.querySelector(pas.cible) : null
      if (el) {
        const r = el.getBoundingClientRect()
        // Une cible hors de l'écran est ramenée une fois, pas à chaque image :
        // sinon le défilement se bat avec l'utilisateur.
        if (!amene && (r.top < 0 || r.bottom > window.innerHeight)) {
          amene = true
          el.scrollIntoView({ block: 'center', behavior: 'smooth' })
        }
        setCible((p) => (p && p.x === r.left && p.y === r.top && p.w === r.width && p.h === r.height
          ? p
          : { x: r.left, y: r.top, w: r.width, h: r.height }))
      } else {
        setCible(null)
      }
      setFenetre((p) => (p.w === window.innerWidth && p.h === window.innerHeight ? p : { w: window.innerWidth, h: window.innerHeight }))
      brut = requestAnimationFrame(lire)
    }
    brut = requestAnimationFrame(lire)
    return () => cancelAnimationFrame(brut)
  }, [pas])

  // La bulle grandit avec son texte : on mesure ce qu'elle occupe vraiment.
  useLayoutEffect(() => {
    const el = bulleRef.current
    if (!el) return
    const obs = new ResizeObserver(() => setHauteurBulle(el.offsetHeight))
    obs.observe(el)
    return () => obs.disconnect()
  }, [pas])

  // L'étape qui attend un geste : c'est le clic sur l'élément désigné qui fait
  // avancer, et non le bouton « Suivant ».
  useEffect(() => {
    if (!pas?.avanceAuClic || !pas.cible) return
    const el = document.querySelector(pas.cible)
    if (!el) return
    const auClic = () => {
      // On laisse l'application réagir avant de montrer la suite.
      window.setTimeout(() => useVisite.getState().aller(useVisite.getState().etape + 1), 450)
    }
    el.addEventListener('click', auClic, { once: true })
    return () => el.removeEventListener('click', auClic)
  }, [pas, cible])

  // La lecture à voix haute, si elle a été demandée.
  useEffect(() => {
    if (!pas || !parole || typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const mot = new SpeechSynthesisUtterance(`${pas.titre}. ${pas.texte}`)
    mot.lang = 'fr-FR'
    mot.rate = 1.02
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(mot)
    return () => window.speechSynthesis.cancel()
  }, [pas, parole])

  useEffect(() => {
    if (!visite) return
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === 'Escape') quitter()
      else if (e.key === 'ArrowRight') {
        const s = useVisite.getState()
        if (s.etape >= visite.etapes.length - 1) terminer()
        else s.aller(s.etape + 1)
      } else if (e.key === 'ArrowLeft') {
        const s = useVisite.getState()
        s.aller(Math.max(0, s.etape - 1))
      }
    }
    window.addEventListener('keydown', auClavier)
    return () => window.removeEventListener('keydown', auClavier)
  }, [visite, quitter, terminer])

  if (!visite || !pas || isMobile) return null

  const bulle = { w: Math.min(LARGEUR_BULLE, fenetre.w - 32), h: hauteurBulle }
  const trou = cible ? trouDuProjecteur(cible, 8, fenetre) : null
  // La bulle s'écarte du trou, et non de la cible : mesurée sur la cible, elle
  // laissait sa pointe se planter dans l'anneau, qui passe huit pixels plus loin.
  const place = placerBulle(trou, bulle, fenetre, pas.cote ?? 'auto')
  const pointe = trou && place.cote
    ? pointeDeLaBulle(trou, { x: place.x, y: place.y, w: bulle.w, h: bulle.h }, place.cote)
    : null

  return (
    <div className="js-print-hide pointer-events-none fixed inset-0 z-[70]" role="dialog" aria-label={`Visite guidée : ${visite.titre}`}>
      {/*
        Le voile et l'anneau tiennent dans une seule ombre, portée par le trou
        lui-même.

        Le voile était fait de quatre bandes autour du trou. Un rectangle n'a
        pas de coins arrondis : il restait aux quatre angles un triangle clair
        à l'extérieur de l'anneau, et pendant un défilement les bandes se
        désynchronisaient et laissaient des brèches. Une ombre de neuf mille
        pixels d'étalement épouse l'arrondi de son élément et ne peut pas se
        fendre.

        L'anneau est la première ombre, parce que l'anneau de Tailwind est lui
        aussi une `box-shadow` : sur le même élément, la seconde aurait
        remplacé la première et l'anneau aurait disparu. L'onde qui bat garde
        donc son propre élément.

        Le trou n'est plus bloqué au clic, le voile n'étant plus un élément :
        c'est sans conséquence, les étapes qui attendent un geste écoutent
        l'élément désigné, et les autres se suivent au bouton.
      */}
      {trou ? (
        <>
          <div
            className="pointer-events-none absolute rounded-xl"
            style={{
              left: trou.x, top: trou.y, width: trou.w, height: trou.h,
              boxShadow: '0 0 0 2px #3b82f6, 0 0 0 9999px rgb(23 23 23 / 0.5)',
            }}
          />
          <div
            className="visite-halo pointer-events-none absolute rounded-xl"
            style={{ left: trou.x, top: trou.y, width: trou.w, height: trou.h }}
          />
        </>
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-neutral-900/50" />
      )}

      <div
        ref={bulleRef}
        className="pointer-events-auto absolute rounded-2xl border border-black/[0.06] bg-white shadow-[0_8px_40px_-12px_rgba(0,0,0,0.35)]"
        style={{ left: place.x, top: place.y, width: bulle.w }}
      >
        {/*
          La pointe : elle dit de quoi on parle, quand la bulle est posée à côté.

          C'est un carré tourné d'un huitième de tour, posé à cheval sur le bord
          de la bulle, et non un triangle découpé dans ce carré. Découpé, il ne
          restait que la moitié extérieure : elle ne recouvrait pas la bordure
          de la bulle, qui continuait donc tout droit derrière la pointe comme
          une couture, et son sommet partait de biais au lieu de viser la cible.
          À cheval, la moitié intérieure masque la bordure et seules les deux
          faces extérieures en portent une.
        */}
        {pointe && place.cote && (
          <span
            className="absolute h-3 w-3 rotate-45 bg-white"
            style={{
              left: place.cote === 'droite' ? -6 : place.cote === 'gauche' ? bulle.w - 6 : pointe.x - 6,
              top: place.cote === 'bas' ? -6 : place.cote === 'haut' ? hauteurBulle - 6 : pointe.y - 6,
              borderLeft: place.cote === 'droite' || place.cote === 'bas' ? BORDURE : undefined,
              borderBottom: place.cote === 'droite' || place.cote === 'haut' ? BORDURE : undefined,
              borderRight: place.cote === 'gauche' || place.cote === 'haut' ? BORDURE : undefined,
              borderTop: place.cote === 'gauche' || place.cote === 'bas' ? BORDURE : undefined,
            }}
          />
        )}

        <div className="flex items-start gap-1 p-4 pb-0">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">{visite.titre}</p>
            <p className="mt-0.5 font-semibold leading-snug">{pas.titre}</p>
          </div>
          <button
            onClick={() => (typeof window !== 'undefined' && 'speechSynthesis' in window ? basculerParole() : undefined)}
            title={parole ? 'Couper la lecture à voix haute' : 'Lire l’étape à voix haute'}
            aria-pressed={parole}
            className={cn('shrink-0 rounded-lg p-1.5 transition-colors', parole ? 'bg-blue-50 text-blue-700' : 'text-muted-foreground hover:bg-muted')}
          >
            {parole ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
          <button onClick={quitter} title="Quitter la visite" className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="px-4 pt-2 text-[13.5px] leading-relaxed text-neutral-700">{pas.texte}</p>

        {pas.avanceAuClic && (
          <p className="mx-4 mt-2 rounded-lg bg-blue-50 px-3 py-2 text-[12px] font-medium text-blue-700">
            À vous : cliquez sur l’élément entouré. Je continue juste après.
          </p>
        )}

        <div className="mt-3 flex items-center gap-2 border-t px-4 py-3">
          <div className="flex flex-1 items-center gap-1.5" aria-label={`Étape ${etape + 1} sur ${visite.etapes.length}`}>
            {visite.etapes.map((_, i) => (
              <button
                key={i}
                onClick={() => aller(i)}
                title={`Étape ${i + 1}`}
                className={cn('h-1.5 rounded-full transition-all', i === etape ? 'w-5 bg-blue-600' : i < etape ? 'w-1.5 bg-blue-300' : 'w-1.5 bg-neutral-200')}
              />
            ))}
          </div>
          <button
            onClick={() => aller(etape - 1)}
            disabled={etape === 0}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
            title="Étape précédente"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => (dernier ? terminer() : aller(etape + 1))}
            className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            {dernier ? 'Terminer' : 'Suivant'}
            {!dernier && <ChevronRight className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}
