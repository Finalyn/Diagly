/**
 * Une photo en grand, et les suivantes au doigt.
 *
 * Sur un chantier, la vignette de quatre-vingts pixels ne sert qu'à repérer la
 * photo : pour juger une fissure ou lire une plaque de chaudière, il faut
 * l'ouvrir. Et comme on prend rarement une seule photo d'un ouvrage, on passe à
 * la suivante sans repasser par la liste : au doigt, aux flèches du clavier, ou
 * par la bande de vignettes en bas.
 *
 * La visionneuse est montée dans le corps du document plutôt que là où on
 * l'appelle : posée dans une carte, elle aurait hérité de ses découpes et de
 * ses contextes d'empilement, et serait sortie rognée.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Visionneuse({ photos, index, onIndex, onFermer, titre, sousTitre, action }: {
  photos: string[]
  /** Photo montrée, par son rang dans `photos`. */
  index: number
  onIndex: (i: number) => void
  onFermer: () => void
  titre?: ReactNode
  sousTitre?: ReactNode
  /** Boutons propres à l'écran appelant, posés à côté de la fermeture. */
  action?: ReactNode
}) {
  const [glisse, setGlisse] = useState(0)
  const depart = useRef<{ x: number; y: number } | null>(null)
  const aller = useCallback((pas: number) => {
    if (photos.length < 2) return
    onIndex((index + pas + photos.length) % photos.length)
  }, [photos.length, index, onIndex])

  // Le clavier fait ce qu'on attend d'une visionneuse.
  useEffect(() => {
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFermer()
      else if (e.key === 'ArrowLeft') aller(-1)
      else if (e.key === 'ArrowRight') aller(1)
    }
    window.addEventListener('keydown', auClavier)
    return () => window.removeEventListener('keydown', auClavier)
  }, [aller, onFermer])

  // La page cesse de défiler derrière : sans cela, la molette fait glisser le
  // formulaire sous l'image.
  useEffect(() => {
    const avant = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = avant }
  }, [])

  if (photos.length === 0) return null
  const src = photos[Math.min(index, photos.length - 1)]

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photo en grand"
      className="fixed inset-0 z-[60] flex flex-col bg-black/92 backdrop-blur-sm print:hidden"
      onClick={(e) => { if (e.target === e.currentTarget) onFermer() }}
    >
      <div className="safe-top flex shrink-0 items-start justify-between gap-3 px-4 py-3 text-white">
        <div className="min-w-0">
          {titre && <p className="truncate text-sm font-semibold">{titre}</p>}
          <p className="text-xs text-white/70">
            {sousTitre}
            {sousTitre && photos.length > 1 && ' · '}
            {photos.length > 1 && `photo ${index + 1} sur ${photos.length}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {action}
          <button
            onClick={onFermer}
            title="Fermer (Échap)"
            className="rounded-lg bg-white/15 p-2 transition-colors hover:bg-white/25"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* L'image, et les deux flèches posées dessus plutôt qu'en dessous : la
          main qui tient le téléphone est déjà au bord de l'écran. */}
      <div
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-2 pb-2"
        onClick={(e) => { if (e.target === e.currentTarget) onFermer() }}
        onTouchStart={(e) => { depart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }}
        onTouchMove={(e) => {
          if (!depart.current) return
          const dx = e.touches[0].clientX - depart.current.x
          const dy = e.touches[0].clientY - depart.current.y
          // Un geste vertical n'est pas un changement de photo.
          if (Math.abs(dx) > Math.abs(dy)) setGlisse(dx)
        }}
        onTouchEnd={() => {
          const d = glisse
          depart.current = null
          setGlisse(0)
          if (Math.abs(d) > 60) aller(d < 0 ? 1 : -1)
        }}
      >
        <img
          src={src}
          alt=""
          draggable={false}
          className="max-h-full max-w-full select-none object-contain"
          style={{
            transform: glisse ? `translateX(${glisse}px)` : undefined,
            transition: glisse ? 'none' : 'transform 150ms ease-out',
          }}
        />
        {photos.length > 1 && (
          <>
            <Fleche cote="gauche" onClick={() => aller(-1)} />
            <Fleche cote="droite" onClick={() => aller(1)} />
          </>
        )}
      </div>

      {photos.length > 1 && (
        <div className="safe-bottom flex shrink-0 justify-center gap-2 overflow-x-auto px-4 py-3">
          {photos.map((p, i) => (
            <button
              key={i}
              onClick={() => onIndex(i)}
              aria-label={`Photo ${i + 1}`}
              className={cn('h-12 w-12 shrink-0 overflow-hidden rounded-lg border-2 transition-opacity',
                i === index ? 'border-white' : 'border-transparent opacity-60 hover:opacity-100')}
            >
              <img src={p} alt="" className="h-full w-full object-cover" draggable={false} />
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body,
  )
}

function Fleche({ cote, onClick }: { cote: 'gauche' | 'droite'; onClick: () => void }) {
  const Icone = cote === 'gauche' ? ChevronLeft : ChevronRight
  return (
    <button
      onClick={onClick}
      title={cote === 'gauche' ? 'Photo précédente' : 'Photo suivante'}
      className={cn(
        'absolute top-1/2 -translate-y-1/2 rounded-full bg-white/15 p-3 text-white transition-colors hover:bg-white/30',
        cote === 'gauche' ? 'left-2' : 'right-2',
      )}
    >
      <Icone className="h-5 w-5" />
    </button>
  )
}
