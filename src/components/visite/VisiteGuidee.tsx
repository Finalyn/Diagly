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

  /**
   * L'étape déjà faite se saute, puis la route s'ouvre.
   *
   * Une même visite se lance de deux endroits : depuis le centre d'aide, où il
   * faut d'abord ouvrir un dossier, et depuis le dossier lui-même, où c'est
   * déjà fait. L'étape qui le demande porte donc la marque de ce qu'elle
   * apporte : si elle est déjà là, on passe.
   *
   * Seulement en avançant : sinon le bouton « précédent » buterait sur elle et
   * la visite rebondirait sans fin.
   */
  const etapePrecedente = useRef(0)
  /**
   * La route d'une étape s'ouvre quand l'étape s'ouvre, et seulement alors.
   *
   * Imposée à chaque changement d'adresse, elle ramenait à la liste celui qui
   * venait justement d'ouvrir un dossier comme on le lui demandait : l'adresse
   * change avant que l'écran attendu ait fini de charger.
   */
  const routeOuverte = useRef<string | null>(null)
  /** Vrai quand on est arrivé sur l'étape en avançant (et non par « précédent »). */
  const enAvantRef = useRef(true)
  useEffect(() => {
    const enAvant = etape >= etapePrecedente.current
    etapePrecedente.current = etape
    enAvantRef.current = enAvant
    if (!pas) return
    if (enAvant && pas.sauterSi && document.querySelector(pas.sauterSi)) {
      aller(etape + 1)
      return
    }
    const cle = `${visiteId}:${etape}`
    if (pas.route && routeOuverte.current !== cle) {
      routeOuverte.current = cle
      if (location.pathname !== pas.route) navigate(pas.route)
    }
  }, [pas, etape, visiteId, location.pathname, navigate, aller])

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
      // L'écran qui rend l'étape inutile peut arriver après elle (un éditeur
      // qui charge) : on la saute dès qu'il est là, et pas seulement à l'entrée.
      if (enAvantRef.current && pas.sauterSi && document.querySelector(pas.sauterSi)) {
        const s = useVisite.getState()
        s.aller(s.etape + 1)
        return
      }
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
      // On laisse l'application réagir avant de montrer la suite. Le clic peut
      // aussi avoir fait apparaître ce qui rend l'étape inutile (sauterSi), et la
      // visite a déjà avancé : on n'avance alors pas une seconde fois.
      const depart = useVisite.getState().etape
      window.setTimeout(() => {
        const s = useVisite.getState()
        if (s.etape === depart) s.aller(depart + 1)
      }, 450)
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

  /** L'étape attend un clic, et l'élément à cliquer est bien à l'écran. */
  const attendGeste = !!pas.avanceAuClic && !!cible

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

        {attendGeste && (
          <p className="mx-4 mt-2 rounded-lg bg-blue-50 px-3 py-2 text-[12px] font-medium text-blue-700">
            À vous : cliquez sur l’élément entouré. Je continue juste après.
          </p>
        )}

        <div className="mt-3 flex items-center gap-2 border-t px-4 py-3">
          {/* Une barre plutôt qu'un point par étape : à douze étapes et plus, les
              points poussaient « Suivant » hors de la bulle. */}
          <div className="flex min-w-0 flex-1 items-center gap-2" aria-label={`Étape ${etape + 1} sur ${visite.etapes.length}`}>
            <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-neutral-200">
              <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${((etape + 1) / visite.etapes.length) * 100}%` }} />
            </div>
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{etape + 1}/{visite.etapes.length}</span>
          </div>
          {/* « Passer » en toutes lettres : une visite qui s'invite doit
              pouvoir se congédier sans chercher la croix. */}
          {!dernier && (
            <button onClick={quitter} className="shrink-0 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
              Passer
            </button>
          )}
          <button
            onClick={() => aller(etape - 1)}
            disabled={etape === 0}
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
            title="Étape précédente"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {/* Une étape qui attend un geste n'a pas de « Suivant » : c'est le clic
              sur l'élément entouré qui fait avancer. Si l'élément manque (écran
              différent, rien à ouvrir), le bouton revient pour ne pas bloquer. */}
          {!attendGeste && (
            <button
              onClick={() => (dernier ? terminer() : aller(etape + 1))}
              className="flex shrink-0 items-center gap-1 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm font-medium text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-colors hover:border-black/[0.14] hover:bg-neutral-50"
            >
              {dernier ? 'Terminer' : 'Suivant'}
              {!dernier && <ChevronRight className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
