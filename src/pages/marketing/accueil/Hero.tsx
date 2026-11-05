import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Play, Volume2, VolumeX } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Bouton, FOCUS } from './ui'
import { useMouvementReduit } from './mouvement'
import { VIDEO_A_DU_SON, VIDEO_PRESENTATION } from './contenu'

/**
 * Le haut de la page : ce que fait Diagly en une phrase, les deux portes
 * d'entrée, puis l'application elle-même, son accueil sur ordinateur, qui
 * devient la vidéo de présentation au défilement.
 *
 * L'écran est une vraie capture de l'application, prise sur un dossier
 * d'exemple. Le fond est celui du haut de la page Fonctionnalités : un
 * bleu très pâle qui descend vers le blanc, et le quadrillage fin.
 *
 * Le titre et le texte ne s'animent pas : ce sont eux que le navigateur
 * affiche en premier, ils ne doivent rien attendre. Seul l'ordinateur
 * monte en fondu, puis suit le défilement (Ordinateur).
 */
export function Hero() {
  return (
    // Le fond remonte sous la barre du haut, transparente en début de page.
    // overflow-clip coupe comme overflow-hidden sans faire du héros un
    // conteneur de défilement : l'ordinateur peut y rester collé (sticky).
    <section id="haut" aria-labelledby="titre-accueil" className="relative -mt-[92px] overflow-clip bg-white pt-[92px]">
      {/* Le fond couvre tout le héros, écran compris, et s'efface dans le blanc de la section suivante. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#f3f7fe] to-white">
        <Quadrillage long />
      </div>
      <div className="relative mx-auto w-full max-w-[1200px] px-4 pt-12 text-center sm:px-6 sm:pt-16 lg:px-8 lg:pt-24">
        {/* Comme sur inview.ch : d'où vient l'outil, une seule phrase, le sous-texte, deux gros boutons. */}
        <p className="inline-flex items-center gap-2.5 text-[15px] font-medium text-[#0b1f44] sm:text-[16px]">
          <DrapeauSuisse className="h-6 w-6" />
          Fait pour le bâtiment suisse
        </p>

        <h1 id="titre-accueil" className="mx-auto mt-8 text-balance text-[clamp(2.25rem,5vw,3.75rem)] font-medium leading-[1.06] tracking-[-0.045em] text-[#0b1220]">
          Diagnostic bâtiment, simplifié.
        </h1>
        <p className="mx-auto mt-7 max-w-[46rem] text-pretty text-[18px] leading-[1.6] text-[#6b7280] sm:text-[20px]">
          L’IA tire les métrés de vos plans. Vous relevez l’état sur iPad ou iPhone.
          Diagly chiffre par code CFC et sort le rapport à votre en-tête.
        </p>

        {/* Deux gros boutons ; sur téléphone, d'une même largeur, sans prendre tout l'écran. */}
        <div className="mt-12 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          <Bouton to="/register" className="min-h-14 w-full max-w-[21rem] whitespace-nowrap px-6 text-[17px] sm:w-auto sm:max-w-none sm:px-9">
            Créer un compte gratuit<ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Bouton>
          <Bouton to="/fonctionnalites" variante="contour" className="min-h-14 w-full max-w-[21rem] whitespace-nowrap px-6 text-[17px] sm:w-auto sm:max-w-none sm:px-9">Découvrir l’app</Bouton>
        </div>
      </div>

      <Ordinateur />
    </section>
  )
}

/**
 * Le drapeau suisse, dessiné : carré rouge, croix blanche aux bras un
 * sixième plus longs que larges (6 de large, 7 de long, sur 32).
 */
function DrapeauSuisse({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn('shrink-0', className)}>
      <rect width="32" height="32" rx="6" fill="#DA291C" />
      <path d="M13 6h6v7h7v6h-7v7h-6v-7H6v-6h7z" fill="#fff" />
    </svg>
  )
}

/**
 * Le quadrillage fin du fond, à la manière d'un papier millimétré : il
 * s'efface vers les bords pour laisser le titre au centre. Il sert à
 * l'accueil et aux pages Fonctionnalités et Blog.
 *
 * `long` : pour un haut de page qui descend loin (l'accueil, où l'écran
 * suit le défilement). La trame couvre alors toute la hauteur et ne
 * s'efface que vers le bas ; la tache claire reste sous le titre.
 */
export function Quadrillage({ long = false }: { long?: boolean }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <div
        className={cn(
          'absolute inset-0 [background-image:linear-gradient(to_right,rgba(1,103,234,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(1,103,234,0.08)_1px,transparent_1px)] [background-position:center_top] [background-size:72px_72px]',
          long
            ? '[mask-image:linear-gradient(to_bottom,#000_72%,transparent)]'
            : '[mask-image:radial-gradient(ellipse_75%_65%_at_50%_28%,#000_35%,transparent_100%)]',
        )}
      />
      <div className={cn('absolute left-1/2 h-[620px] w-[1100px] max-w-[160%] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,0.95),rgba(255,255,255,0))]', long ? 'top-[-60px]' : 'top-[-12%]')} />
    </div>
  )
}

/**
 * L'ordinateur, qui devient la vidéo de présentation.
 *
 * Pas de cadre d'appareil : l'écran est une carte blanche, droite, coupée
 * par le bas en haut de la page, où il se fond dans le blanc. À mesure qu'on défile, il grandit jusqu'à se
 * trouver au centre de l'écran ; il y reste collé le temps d'une course
 * (sticky, --haut), puis repart avec la page. Une fois en place, la vidéo se
 * lance dans son écran, sans le son ; si elle en a un (VIDEO_A_DU_SON), le
 * bouton du coin le rallume. Le mouvement suit le défilement par une
 * variable CSS (--p, de 0 en haut de la page à 1 quand il arrive au centre),
 * sans redessiner le héros.
 *
 * La vidéo (VIDEO_PRESENTATION, contenu.ts) ne se charge qu'au moment de
 * jouer ; d'ici là, l'écran garde l'accueil de l'application. Sans vidéo,
 * l'écran montre, une fois en place, le bouton de lecture et une ligne qui
 * dit qu'elle arrive. En mouvement réduit, l'écran est d'emblée grand, et la
 * vidéo a ses commandes.
 */
function Ordinateur() {
  const scene = useRef<HTMLDivElement>(null)
  const appareil = useRef<HTMLElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const [enPlace, setEnPlace] = useState(false)
  const [lecture, setLecture] = useState(false)
  // La vidéo ne se montre qu'une fois ses premières images arrivées : d'ici là, l'accueil de l'app reste dessous.
  const [videoPrete, setVideoPrete] = useState(false)
  const [son, setSon] = useState(false)
  const reduit = useMouvementReduit()

  useEffect(() => {
    const el = scene.current
    const fig = appareil.current
    if (!el || !fig) return
    let image = 0
    const suivre = () => {
      image = 0
      const vh = window.innerHeight
      // La figure n'est pas transformée : sa hauteur est celle de l'ordinateur à sa taille finale.
      // Collé à cette hauteur, il est au centre de l'écran, jamais sous la barre du haut.
      const haut = Math.max(88, (vh - fig.offsetHeight) / 2)
      el.style.setProperty('--haut', `${Math.round(haut)}px`)
      // La scène, elle, ne colle pas : son haut dit où l'ordinateur commence dans la page.
      const course = Math.max(1, el.getBoundingClientRect().top + window.scrollY - haut)
      const p = reduit ? 1 : Math.min(1, Math.max(0, window.scrollY / course))
      el.style.setProperty('--p', p.toFixed(3))
      const r = fig.getBoundingClientRect()
      setEnPlace(p > 0.97)
      setLecture(!reduit && p > 0.97 && r.bottom > vh * 0.35 && r.top < vh * 0.65)
    }
    const auDefilement = () => { if (!image) image = requestAnimationFrame(suivre) }
    suivre()
    window.addEventListener('scroll', auDefilement, { passive: true })
    window.addEventListener('resize', auDefilement)
    return () => {
      window.removeEventListener('scroll', auDefilement)
      window.removeEventListener('resize', auDefilement)
      cancelAnimationFrame(image)
    }
  }, [reduit])

  // La vidéo joue tant que l'écran est en place et à l'écran.
  useEffect(() => {
    const v = video.current
    if (!v) return
    if (lecture) v.play().catch(() => {})
    else v.pause()
  }, [lecture])

  return (
    <div ref={scene} className="relative mx-auto mt-12 w-full max-w-[1200px] px-4 pb-24 sm:mt-16 sm:px-6 sm:pb-28 lg:px-8">
      {/* L'ordinateur colle au centre de l'écran (--haut) jusqu'au bout de la course qui le suit. */}
      <div className="sticky z-10" style={{ top: 'var(--haut, 96px)' }}>
        {/* Au plus grand, il tient au centre de l'écran, avec de la marge sous la barre du haut. */}
        <figure ref={appareil} className="relative mx-auto w-[min(100%,calc((100svh-200px)*1.55))]" aria-label="L’application Diagly sur ordinateur">
          <div className="dp-anim">
            {/* Droit : un peu plus petit en haut de la page, à sa taille quand --p vaut 1. */}
            <div
              className="relative will-change-transform"
              style={{
                transform: 'scale(calc(0.84 + 0.16 * var(--p, 0)))',
                transformOrigin: '50% 0',
              }}
            >
              <div className="relative aspect-[1800/1125] overflow-hidden rounded-[24px] bg-white shadow-[0_40px_90px_-40px_rgba(11,31,68,0.4)] ring-1 ring-black/[0.06]">
                <img
                  src="/accueil/app-accueil.webp"
                  alt="L’accueil de Diagly : le dossier à reprendre avec ses relevés, ses urgences et son coût estimé, les accès rapides et l’activité récente."
                  width={1800}
                  height={1125}
                  fetchPriority="high"
                  className="block h-auto w-full"
                />
                {VIDEO_PRESENTATION ? (
                  <video
                    ref={video}
                    src={VIDEO_PRESENTATION}
                    muted={!son}
                    loop
                    playsInline
                    preload="none"
                    controls={reduit}
                    onPlaying={() => setVideoPrete(true)}
                    className={cn('absolute inset-0 h-full w-full object-cover transition-opacity duration-700', enPlace && (videoPrete || reduit) ? 'opacity-100' : 'pointer-events-none opacity-0')}
                  />
                ) : (
                  <div className={cn('absolute inset-0 flex flex-col items-center justify-center bg-white/45 backdrop-blur-[2px] transition-opacity duration-700', enPlace ? 'opacity-100' : 'opacity-0')}>
                    <span aria-hidden="true" className="flex h-[clamp(3.5rem,8vw,6rem)] w-[clamp(5.5rem,12.5vw,9.5rem)] items-center justify-center rounded-[clamp(0.9rem,1.8vw,1.4rem)] bg-[#0167EA] text-white shadow-[0_18px_40px_-14px_rgba(1,103,234,0.75)]">
                      <Play className="ml-1 h-[40%] w-auto fill-current" />
                    </span>
                    <p className="mt-[2.5%] text-[clamp(13px,1.5vw,17px)] font-medium text-[#0b1220]">La vidéo arrive bientôt.</p>
                  </div>
                )}
                {VIDEO_PRESENTATION && VIDEO_A_DU_SON && !reduit && (
                  <button
                    type="button"
                    onClick={() => setSon((s) => !s)}
                    aria-label={son ? 'Couper le son' : 'Activer le son'}
                    aria-pressed={son}
                    tabIndex={enPlace ? 0 : -1}
                    className={cn('absolute bottom-[3%] right-[2%] flex h-12 w-12 items-center justify-center rounded-full bg-[#0167EA] text-white shadow-[0_10px_24px_-10px_rgba(1,103,234,0.8)] transition-opacity hover:bg-[#0154c4]', enPlace ? 'opacity-100' : 'pointer-events-none opacity-0', FOCUS)}
                  >
                    {son ? <Volume2 className="h-5 w-5" aria-hidden="true" /> : <VolumeX className="h-5 w-5" aria-hidden="true" />}
                  </button>
                )}
              </div>
            </div>
          </div>
        </figure>

        {/* En haut de la page, le bas de l'écran se fond dans la page ; le voile part quand l'écran grandit. */}
        <div aria-hidden="true" className="pointer-events-none absolute -inset-x-4 top-[40%] h-[90%] bg-gradient-to-b from-transparent via-white/75 to-white" style={{ opacity: 'calc(1 - var(--p, 0) * 1.6)' }} />
      </div>

      {/* La course pendant laquelle l'écran reste au centre, le temps de regarder la vidéo. */}
      <div aria-hidden="true" className="h-[45svh]" />
    </div>
  )
}
