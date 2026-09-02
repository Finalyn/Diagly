import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Camera, Images, Maximize2, X, ZoomIn } from 'lucide-react'

/** Capture une frame vidéo -> data URL JPEG compacte (max 1280px). `zoom` = recadrage numérique centré. */
function frameToDataUrl(video: HTMLVideoElement, zoom = 1, maxDim = 1280, quality = 0.7): string | null {
  const sw = video.videoWidth, sh = video.videoHeight
  if (!sw || !sh) return null
  const cropW = sw / zoom, cropH = sh / zoom
  const sx = (sw - cropW) / 2, sy = (sh - cropH) / 2
  const scale = Math.min(1, maxDim / Math.max(cropW, cropH))
  const w = Math.round(cropW * scale), h = Math.round(cropH * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(video, sx, sy, cropW, cropH, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', quality)
}

/** Réduit un fichier image -> data URL (fallback si la caméra live n'est pas dispo). */
function fileToDataUrl(file: File, maxDim = 1280, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('canvas'))
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = reject
    img.src = url
  })
}

const touchDist = (t: { [i: number]: { clientX: number; clientY: number } }) =>
  Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)

/**
 * Caméra live carrée + plein écran, avec zoom aux doigts (pincer) et curseur d'appoint.
 * Zoom natif de l'appareil si supporté, sinon zoom numérique. Fallback appareil photo natif.
 */
export function CameraCapture({ onCapture }: { onCapture: (dataUrl: string) => void }) {
  /**
   * Import depuis la galerie. Sans l'attribut `capture`, le téléphone propose la
   * pellicule : indispensable quand la photo a été prise avant d'ouvrir l'élément,
   * ou depuis un autre appareil.
   */
  const importer = async (files: FileList | null) => {
    if (!files?.length) return
    for (const f of Array.from(files)) {
      try { onCapture(await fileToDataUrl(f)) } catch { /* fichier illisible : on passe */ }
    }
  }

  const inlineRef = useRef<HTMLVideoElement>(null)
  const fsRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const trackRef = useRef<MediaStreamTrack | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [zoom, setZoom] = useState(1)
  const zoomRef = useRef(1)
  const [range, setRange] = useState({ min: 1, max: 4, step: 0.1, native: false })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        const track = stream.getVideoTracks()[0]
        trackRef.current = track ?? null
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const caps: any = track?.getCapabilities?.()
        if (caps?.zoom && typeof caps.zoom.max === 'number' && caps.zoom.max > (caps.zoom.min ?? 1)) {
          setRange({ min: caps.zoom.min ?? 1, max: caps.zoom.max, step: caps.zoom.step || 0.1, native: true })
        }
        if (inlineRef.current) { inlineRef.current.srcObject = stream; await inlineRef.current.play().catch(() => undefined) }
        setReady(true)
      } catch {
        setError(true)
      }
    })()
    return () => { cancelled = true; streamRef.current?.getTracks().forEach((t) => t.stop()) }
  }, [])

  useEffect(() => {
    if (fullscreen && fsRef.current && streamRef.current) {
      fsRef.current.srcObject = streamRef.current
      fsRef.current.play().catch(() => undefined)
    }
  }, [fullscreen])

  const applyZoom = (z: number) => {
    const clamped = Math.min(range.max, Math.max(range.min, Math.round(z * 100) / 100))
    zoomRef.current = clamped
    setZoom(clamped)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (range.native && trackRef.current) trackRef.current.applyConstraints({ advanced: [{ zoom: clamped }] } as any).catch(() => undefined)
  }
  const previewScale = range.native ? 1 : zoom // zoom numérique = agrandissement CSS ; natif = déjà appliqué au flux

  // Zoom aux doigts (pincer).
  const pinch = useRef<{ dist: number; zoom: number } | null>(null)
  const onTouchStart = (e: React.TouchEvent) => { if (e.touches.length === 2) pinch.current = { dist: touchDist(e.touches), zoom: zoomRef.current } }
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinch.current) { e.preventDefault(); applyZoom(pinch.current.zoom * (touchDist(e.touches) / pinch.current.dist)) }
  }
  const onTouchEnd = (e: React.TouchEvent) => { if (e.touches.length < 2) pinch.current = null }

  const shoot = (video: HTMLVideoElement | null) => {
    if (!video) return
    const url = frameToDataUrl(video, range.native ? 1 : zoomRef.current)
    if (url) onCapture(url)
  }

  // Fallback : appareil photo natif.
  if (error) {
    return (
      <div className="flex aspect-square w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-muted-foreground/30 bg-muted/30 text-muted-foreground">
        <label className="flex cursor-pointer flex-col items-center">
          <Camera className="mb-2 h-12 w-12" />
          <span className="text-sm font-medium">Prendre une photo</span>
          <input type="file" accept="image/*" capture="environment" className="hidden"
            onChange={(e) => { importer(e.target.files); e.currentTarget.value = '' }} />
        </label>
        <label className="flex cursor-pointer items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-sm font-medium text-foreground">
          <Images className="h-4 w-4" />Choisir dans la galerie
          <input type="file" accept="image/*" multiple className="hidden"
            onChange={(e) => { importer(e.target.files); e.currentTarget.value = '' }} />
        </label>
      </div>
    )
  }

  const zoomBadge = zoom > 1.05 ? `${zoom.toFixed(1)}x` : null
  const canZoom = range.native || range.max > range.min

  return (
    <>
      {/* Aperçu carré inline */}
      <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-black touch-none"
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        <video ref={inlineRef} autoPlay playsInline muted
          className="absolute inset-0 h-full w-full object-cover origin-center"
          style={{ transform: `scale(${previewScale})` }} />
        {!ready && <div className="absolute inset-0 flex items-center justify-center text-white/70 text-sm">Activation de la caméra…</div>}

        {zoomBadge && <span className="absolute top-2 left-2 text-xs font-medium text-white bg-black/40 rounded-full px-2 py-0.5">{zoomBadge}</span>}

        <button type="button" onClick={() => setFullscreen(true)} aria-label="Agrandir la caméra"
          className="absolute top-2 right-2 h-9 w-9 rounded-full bg-black/40 text-white flex items-center justify-center active:scale-90 transition">
          <Maximize2 className="h-4 w-4" />
        </button>

        <button type="button" onClick={() => shoot(inlineRef.current)} disabled={!ready} aria-label="Prendre la photo"
          className="absolute bottom-3 left-1/2 -translate-x-1/2 h-16 w-16 rounded-full bg-white/95 border-4 border-white/60 shadow-lg active:scale-90 transition-transform disabled:opacity-50 flex items-center justify-center">
          <span className="h-11 w-11 rounded-full border-2 border-gray-400" />
        </button>

        {/* Photos déjà prises : pellicule du téléphone, plusieurs à la fois */}
        <label
          title="Choisir des photos déjà prises"
          className="absolute bottom-5 left-3 flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-black/40 text-white transition active:scale-90"
        >
          <Images className="h-5 w-5" />
          <input type="file" accept="image/*" multiple className="hidden"
            onChange={(e) => { importer(e.target.files); e.currentTarget.value = '' }} />
        </label>
      </div>

      {/* Plein écran (portal sur body -> couvre vraiment tout l'écran) */}
      {fullscreen && createPortal(
        <div className="fixed inset-0 z-[100] bg-black flex flex-col" style={{ height: '100dvh', width: '100vw' }}>
          <div className="relative flex-1 overflow-hidden touch-none"
            onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
            <video ref={fsRef} autoPlay playsInline muted
              className="absolute inset-0 h-full w-full object-cover origin-center"
              style={{ transform: `scale(${previewScale})` }} />
            <button type="button" onClick={() => setFullscreen(false)} aria-label="Fermer"
              className="absolute top-4 right-4 h-11 w-11 rounded-full bg-white/15 text-white flex items-center justify-center backdrop-blur">
              <X className="h-5 w-5" />
            </button>
            {zoomBadge && <span className="absolute top-5 left-4 text-sm font-medium text-white bg-black/40 rounded-full px-2.5 py-1">{zoomBadge}</span>}
          </div>

          <div className="shrink-0 px-6 pb-10 pt-3 flex flex-col items-center gap-4 bg-black">
            {canZoom && (
              <div className="w-full max-w-xs flex items-center gap-3 text-white/80">
                <ZoomIn className="h-4 w-4 shrink-0" />
                <input type="range" min={range.min} max={range.max} step={range.step} value={zoom}
                  onChange={(e) => applyZoom(Number(e.target.value))} className="flex-1 accent-white" aria-label="Zoom" />
              </div>
            )}
            <button type="button" onClick={() => shoot(fsRef.current)} disabled={!ready} aria-label="Prendre la photo"
              className="h-[72px] w-[72px] rounded-full bg-white border-4 border-white/50 shadow-lg active:scale-90 transition-transform disabled:opacity-50 flex items-center justify-center">
              <span className="h-12 w-12 rounded-full border-2 border-gray-400" />
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
