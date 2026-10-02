import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Volume2, VolumeX, X } from 'lucide-react'
import { useVisite } from '@/stores/visite'
import { visiteParId } from '@/data/visites'
import { placerBulle, trouDuProjecteur, pointeDeLaBulle, type Rect } from '@/lib/visite'
import { useIsMobile } from '@/lib/use-mobile'
import { cn } from '@/lib/utils'

const LARGEUR_BULLE = 372

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
  const place = placerBulle(cible, bulle, fenetre, pas.cote ?? 'auto')
  const trou = cible ? trouDuProjecteur(cible, 8, fenetre) : null
  const pointe = cible && place.cote
    ? pointeDeLaBulle(cible, { x: place.x, y: place.y, w: bulle.w, h: bulle.h }, place.cote)
    : null

  return (
    <div className="js-print-hide pointer-events-none fixed inset-0 z-[70]" role="dialog" aria-label={`Visite guidée : ${visite.titre}`}>
      {/* Le voile, en quatre bandes : le trou reste cliquable, donc le geste
          montré reste faisable pendant qu'on l'explique. */}
      {trou ? (
        <>
          <Voile style={{ left: 0, top: 0, width: fenetre.w, height: Math.max(0, trou.y) }} />
          <Voile style={{ left: 0, top: trou.y + trou.h, width: fenetre.w, height: Math.max(0, fenetre.h - trou.y - trou.h) }} />
          <Voile style={{ left: 0, top: trou.y, width: Math.max(0, trou.x), height: trou.h }} />
          <Voile style={{ left: trou.x + trou.w, top: trou.y, width: Math.max(0, fenetre.w - trou.x - trou.w), height: trou.h }} />
          <div
            className="visite-halo pointer-events-none absolute rounded-xl ring-2 ring-blue-500"
            style={{ left: trou.x, top: trou.y, width: trou.w, height: trou.h }}
          />
        </>
      ) : (
        <Voile style={{ inset: 0 }} />
      )}

      <div
        ref={bulleRef}
        className="pointer-events-auto absolute rounded-2xl border border-black/[0.06] bg-white shadow-[0_8px_40px_-12px_rgba(0,0,0,0.35)]"
        style={{ left: place.x, top: place.y, width: bulle.w }}
      >
        {/* La pointe : elle dit de quoi on parle, quand la bulle est posée à côté. */}
        {pointe && place.cote && (
          <span
            className="absolute h-3.5 w-3.5 rotate-45 border border-black/[0.06] bg-white"
            style={{
              left: place.cote === 'droite' ? -7 : place.cote === 'gauche' ? bulle.w - 7 : pointe.x - 7,
              top: place.cote === 'bas' ? -7 : place.cote === 'haut' ? hauteurBulle - 7 : pointe.y - 7,
              clipPath: place.cote === 'droite' ? 'polygon(0 0, 100% 0, 0 100%)'
                : place.cote === 'gauche' ? 'polygon(100% 0, 100% 100%, 0 100%)'
                  : place.cote === 'bas' ? 'polygon(0 0, 100% 0, 100% 100%)'
                    : 'polygon(0 0, 100% 100%, 0 100%)',
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

/**
 * Une bande du voile.
 *
 * Sans transition CSS, et c'est important : les quatre bandes se déduisent du
 * même rectangle, donc elles pavent l'écran exactement. Animées, chacune
 * rejoignait sa nouvelle valeur à son propre rythme, et il s'ouvrait entre
 * elles des brèches larges comme un tiers de l'écran à chaque défilement. Le
 * mouvement, lui, ne manque pas : les bandes sont recalculées à chaque image.
 */
function Voile({ style }: { style: React.CSSProperties }) {
  return <div className="pointer-events-auto absolute bg-neutral-900/50" style={style} />
}
