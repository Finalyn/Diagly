import { useEffect, useRef, useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import {
  X, Hand, MousePointer2, Crosshair, Ruler, ArrowUpRight, StickyNote, Hash, Pencil,
  ZoomIn, ZoomOut, Undo2, Check, Trash2, Loader2, ChevronLeft, ChevronRight, Maximize, Download,
} from 'lucide-react'
import { api } from '@/lib/api'
import type { ApiPlan, PlanAnnotation, PlanPoint } from '@/lib/api-types'
import { cn } from '@/lib/utils'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

type Tool = 'pan' | 'select' | 'calibrate' | 'measure' | 'arrow' | 'note' | 'hatch' | 'draw'
const TARGET_W = 1600
const MIN_ZOOM = 0.05
const MAX_ZOOM = 20
const TAP_PX = 6
const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#111827']

let _c = 0
const uid = () => `a${Date.now()}_${_c++}`
const dist = (a: PlanPoint, b: PlanPoint) => Math.hypot(b.x - a.x, b.y - a.y)
const mid = (a: PlanPoint, b: PlanPoint) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
function polyArea(pts: PlanPoint[]) {
  let s = 0
  for (let i = 0; i < pts.length; i++) { const j = (i + 1) % pts.length; s += pts[i].x * pts[j].y - pts[j].x * pts[i].y }
  return Math.abs(s) / 2
}
function centroid(pts: PlanPoint[]) {
  return { x: pts.reduce((a, p) => a + p.x, 0) / pts.length, y: pts.reduce((a, p) => a + p.y, 0) / pts.length }
}
/** Distance d'un point au segment [a,b] (pour sélectionner une annotation). */
function pointSegDist(p: PlanPoint, a: PlanPoint, b: PlanPoint) {
  const dx = b.x - a.x, dy = b.y - a.y
  const l2 = dx * dx + dy * dy
  if (l2 === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}
function pointInPoly(p: PlanPoint, pts: PlanPoint[]) {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    if (((pts[i].y > p.y) !== (pts[j].y > p.y)) && (p.x < ((pts[j].x - pts[i].x) * (p.y - pts[i].y)) / (pts[j].y - pts[i].y) + pts[i].x)) inside = !inside
  }
  return inside
}

const TOOLS: { key: Tool; icon: typeof Ruler; label: string }[] = [
  { key: 'pan', icon: Hand, label: 'Déplacer' },
  { key: 'select', icon: MousePointer2, label: 'Sélection' },
  { key: 'calibrate', icon: Crosshair, label: 'Étalonner' },
  { key: 'measure', icon: Ruler, label: 'Mesurer' },
  { key: 'draw', icon: Pencil, label: 'Dessiner' },
  { key: 'arrow', icon: ArrowUpRight, label: 'Flèche' },
  { key: 'note', icon: StickyNote, label: 'Note' },
  { key: 'hatch', icon: Hash, label: 'Zone' },
]

const HINTS: Record<Tool, string> = {
  pan: 'Glisse pour déplacer le plan, molette/pincer pour zoomer.',
  select: 'Touche une annotation pour la sélectionner : déplace-la, glisse ses poignées, change sa couleur / son texte, ou supprime (Suppr).',
  calibrate: 'Trace un trait sur une distance connue (glisse), puis saisis sa longueur réelle.',
  measure: 'Glisse d’un point à l’autre pour mesurer une distance.',
  arrow: 'Glisse pour tracer une flèche.',
  note: 'Touche le plan pour poser une note.',
  hatch: 'Glisse pour une zone rectangulaire, ou touche chaque sommet puis « Fermer la zone ».',
  draw: 'Dessine à main levée en gardant le doigt / la souris appuyé.',
}

interface View { zoom: number; tx: number; ty: number }

export function PlanEditor({ plan, onClose }: { plan: ApiPlan; onClose: () => void }) {
  const queryClient = useQueryClient()
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const [stage, setStage] = useState({ w: 0, h: 0 })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tool, setTool] = useState<Tool>('pan')
  const [color, setColor] = useState(COLORS[0])
  const [unit, setUnit] = useState<'m' | 'cm' | 'mm'>('m')
  const [view, setView] = useState<View>({ zoom: 1, tx: 0, ty: 0 })
  const [scale, setScale] = useState<number | null>(plan.scalePxPerM)
  const [annotations, setAnnotations] = useState<PlanAnnotation[]>(plan.annotations ?? [])
  const [pending, setPending] = useState<PlanPoint | null>(null)
  const [draft, setDraft] = useState<PlanPoint[]>([])
  const [cursor, setCursor] = useState<PlanPoint | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pageNum, setPageNum] = useState(1)
  const [numPages, setNumPages] = useState(1)
  const [calibrateSeg, setCalibrateSeg] = useState<[PlanPoint, PlanPoint] | null>(null)
  const [calibrateVal, setCalibrateVal] = useState('')
  const [notePoint, setNotePoint] = useState<PlanPoint | null>(null)
  const [noteVal, setNoteVal] = useState('')
  const [exportOpen, setExportOpen] = useState(false)
  const [bgColor, setBgColor] = useState('#404040')
  const [selectedAnn, setSelectedAnn] = useState<string | null>(null)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)

  const isPdf = plan.mimeType === 'application/pdf'

  // ---- Chargement (image ou PDF -> canvas) ----
  useEffect(() => {
    let cancelled = false
    setLoading(true); setLoadError(null)
    const url = api.plans.fileUrl(plan.fileName)
    ;(async () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')!
      if (isPdf) {
        const buf = await (await fetch(url)).arrayBuffer()
        if (cancelled) return
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise
        if (cancelled) return
        setNumPages(pdf.numPages)
        const page = await pdf.getPage(pageNum)
        const base = page.getViewport({ scale: 1 })
        const viewport = page.getViewport({ scale: TARGET_W / base.width })
        canvas.width = viewport.width; canvas.height = viewport.height
        await page.render({ canvasContext: ctx, viewport }).promise
        if (cancelled) return
        setStage({ w: viewport.width, h: viewport.height })
      } else {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('img')); img.src = url })
        if (cancelled) return
        const s = Math.min(1, TARGET_W / img.width)
        const w = Math.round(img.width * s), h = Math.round(img.height * s)
        canvas.width = w; canvas.height = h
        ctx.drawImage(img, 0, 0, w, h)
        setStage({ w, h })
      }
      setLoading(false)
    })().catch((e) => { if (!cancelled) { setLoadError(e?.message ?? 'Erreur de rendu'); setLoading(false) } })
    return () => { cancelled = true }
  }, [plan.fileName, isPdf, pageNum])

  // ---- Ajuster le plan à l'écran ----
  const fitView = useCallback(() => {
    const el = containerRef.current
    if (!el || !stage.w) return
    const r = el.getBoundingClientRect()
    const z = Math.min(r.width / stage.w, r.height / stage.h) * 0.95
    setView({ zoom: z, tx: (r.width - stage.w * z) / 2, ty: (r.height - stage.h * z) / 2 })
  }, [stage.w, stage.h])

  useEffect(() => { fitView() }, [fitView])

  // ---- Conversions écran <-> plan ----
  const toStage = useCallback((clientX: number, clientY: number): PlanPoint => {
    const r = containerRef.current!.getBoundingClientRect()
    return { x: (clientX - r.left - view.tx) / view.zoom, y: (clientY - r.top - view.ty) / view.zoom }
  }, [view])

  const zoomAt = useCallback((factor: number, cx: number, cy: number) => {
    setView((v) => {
      const z = clamp(v.zoom * factor, MIN_ZOOM, MAX_ZOOM)
      const k = z / v.zoom
      return { zoom: z, tx: cx - (cx - v.tx) * k, ty: cy - (cy - v.ty) * k }
    })
  }, [])

  const zoomButton = (factor: number) => {
    const el = containerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    zoomAt(factor, r.width / 2, r.height / 2)
  }

  // ---- Gestion des pointeurs (pan / pinch / dessin) ----
  const ptrs = useRef<Map<number, { x: number; y: number }>>(new Map())
  const gesture = useRef<{ mode: 'none' | 'pan' | 'pinch' | 'segment' | 'draw' | 'hatch' | 'dragAnn' | 'dragPoint'; startX: number; startY: number; moved: boolean; lastDist: number; lastMidX: number; lastMidY: number }>(
    { mode: 'none', startX: 0, startY: 0, moved: false, lastDist: 0, lastMidX: 0, lastMidY: 0 },
  )
  const dragRef = useRef<{ id: string; lastX: number; lastY: number; pointIndex?: number } | null>(null)

  const addAnn = (a: Omit<PlanAnnotation, 'id'>) => { setAnnotations((l) => [...l, { id: uid(), ...a }]); setDirty(true) }

  const onPointerDown = (e: React.PointerEvent) => {
    if (calibrateSeg || notePoint) return
    const el = containerRef.current!
    el.setPointerCapture(e.pointerId)
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    // Bouton du milieu (molette) maintenu = déplacer, quel que soit l'outil.
    if (e.button === 1) {
      e.preventDefault()
      gesture.current = { mode: 'pan', startX: e.clientX, startY: e.clientY, moved: false, lastDist: 0, lastMidX: 0, lastMidY: 0 }
      return
    }

    const n = ptrs.current.size

    if (n === 2) {
      const [a, b] = [...ptrs.current.values()]
      gesture.current.mode = 'pinch'
      gesture.current.lastDist = Math.hypot(a.x - b.x, a.y - b.y)
      gesture.current.lastMidX = (a.x + b.x) / 2
      gesture.current.lastMidY = (a.y + b.y) / 2
      setPending(null)
      return
    }
    if (n !== 1) return

    gesture.current.startX = e.clientX
    gesture.current.startY = e.clientY
    gesture.current.moved = false
    const sp = toStage(e.clientX, e.clientY)

    if (tool === 'pan') { gesture.current.mode = 'pan' }
    else if (tool === 'select') {
      const tol = 12 / view.zoom
      // 1. Poignée de l'annotation déjà sélectionnée -> déplace ce point seul.
      if (selectedAnn) {
        const a = annotations.find((x) => x.id === selectedAnn)
        const idx = a ? a.points.findIndex((p) => dist(sp, p) < tol) : -1
        if (a && idx >= 0) { dragRef.current = { id: a.id, lastX: sp.x, lastY: sp.y, pointIndex: idx }; gesture.current.mode = 'dragPoint'; return }
      }
      // 2. Sinon, sélectionne l'annotation touchée -> déplace l'ensemble ; si rien, on déplace le plan.
      let hitId: string | null = null
      for (let i = annotations.length - 1; i >= 0 && !hitId; i--) {
        const a = annotations[i]
        if (a.type === 'note') { if (dist(sp, a.points[0]) < tol * 2) hitId = a.id }
        else if (a.type === 'measure' || a.type === 'arrow') { if (pointSegDist(sp, a.points[0], a.points[1]) < tol) hitId = a.id }
        else if (a.type === 'draw') { for (let j = 0; j < a.points.length - 1 && !hitId; j++) if (pointSegDist(sp, a.points[j], a.points[j + 1]) < tol) hitId = a.id }
        else if (a.type === 'hatch') { if (pointInPoly(sp, a.points)) hitId = a.id; else for (let j = 0; j < a.points.length && !hitId; j++) if (pointSegDist(sp, a.points[j], a.points[(j + 1) % a.points.length]) < tol) hitId = a.id }
      }
      if (hitId) { setSelectedAnn(hitId); dragRef.current = { id: hitId, lastX: sp.x, lastY: sp.y }; gesture.current.mode = 'dragAnn' }
      else { setSelectedAnn(null); gesture.current.mode = 'pan' }
    }
    else if (tool === 'draw') { gesture.current.mode = 'draw'; setDraft([sp]) }
    else if (tool === 'measure' || tool === 'arrow' || tool === 'calibrate') { gesture.current.mode = 'segment'; setPending(sp); setCursor(sp) }
    else if (tool === 'hatch') { gesture.current.mode = 'hatch'; setPending(sp); setCursor(sp) }
    else { gesture.current.mode = 'none' } // note : géré au relâchement (tap)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!ptrs.current.has(e.pointerId)) {
      if (ptrs.current.size === 0 && tool !== 'pan') setCursor(toStage(e.clientX, e.clientY))
      return
    }
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gesture.current
    if (Math.hypot(e.clientX - g.startX, e.clientY - g.startY) > TAP_PX) g.moved = true

    if (g.mode === 'pinch' && ptrs.current.size >= 2) {
      const [a, b] = [...ptrs.current.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2
      const r = containerRef.current!.getBoundingClientRect()
      if (g.lastDist > 0) zoomAt(d / g.lastDist, mx - r.left, my - r.top)
      setView((v) => ({ ...v, tx: v.tx + (mx - g.lastMidX), ty: v.ty + (my - g.lastMidY) }))
      g.lastDist = d; g.lastMidX = mx; g.lastMidY = my
      return
    }
    if (g.mode === 'pan') {
      setView((v) => ({ ...v, tx: v.tx + e.movementX, ty: v.ty + e.movementY }))
      return
    }
    if (g.mode === 'draw') { setDraft((d) => [...d, toStage(e.clientX, e.clientY)]); return }
    if (g.mode === 'segment' || g.mode === 'hatch') { setCursor(toStage(e.clientX, e.clientY)); return }
    if (g.mode === 'dragAnn' && dragRef.current) {
      const sp = toStage(e.clientX, e.clientY)
      const d = dragRef.current
      const dx = sp.x - d.lastX, dy = sp.y - d.lastY
      setAnnotations((list) => list.map((a) => (a.id === d.id ? { ...a, points: a.points.map((pt) => ({ x: pt.x + dx, y: pt.y + dy })) } : a)))
      d.lastX = sp.x; d.lastY = sp.y
      setDirty(true)
      return
    }
    if (g.mode === 'dragPoint' && dragRef.current && dragRef.current.pointIndex != null) {
      const sp = toStage(e.clientX, e.clientY)
      const d = dragRef.current
      setAnnotations((list) => list.map((a) => (a.id === d.id ? { ...a, points: a.points.map((pt, i) => (i === d.pointIndex ? sp : pt)) } : a)))
      setDirty(true)
      return
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const g = gesture.current
    const wasTap = !g.moved
    const sp = toStage(e.clientX, e.clientY)
    ptrs.current.delete(e.pointerId)

    if (g.mode === 'segment' && pending) {
      if (dist(pending, sp) > 4) {
        if (tool === 'calibrate') { setCalibrateSeg([pending, sp]); setCalibrateVal('') }
        else if (tool === 'measure') addAnn({ type: 'measure', points: [pending, sp], color })
        else if (tool === 'arrow') addAnn({ type: 'arrow', points: [pending, sp], color })
      }
      setPending(null)
    } else if (g.mode === 'draw') {
      if (draft.length >= 2) addAnn({ type: 'draw', points: draft, color })
      setDraft([])
    } else if (g.mode === 'hatch' && pending) {
      if (g.moved && dist(pending, sp) > 4) {
        // glisser = zone rectangulaire
        addAnn({ type: 'hatch', points: [pending, { x: sp.x, y: pending.y }, sp, { x: pending.x, y: sp.y }], color })
        setDraft([])
      } else {
        // tap = sommet (zone point par point)
        setDraft((d) => [...d, sp])
      }
      setPending(null)
    } else if (g.mode === 'dragAnn' || g.mode === 'dragPoint') {
      dragRef.current = null
    } else if (wasTap && ptrs.current.size === 0) {
      if (tool === 'note') { setNotePoint(sp); setNoteVal('') }
    }

    if (ptrs.current.size === 0) gesture.current.mode = 'none'
    else if (ptrs.current.size === 1) {
      // repasse en pan avec le doigt restant
      const [only] = [...ptrs.current.values()]
      gesture.current = { mode: tool === 'pan' ? 'pan' : 'none', startX: only.x, startY: only.y, moved: true, lastDist: 0, lastMidX: 0, lastMidY: 0 }
    }
  }

  const closeHatch = () => { if (draft.length >= 3) { addAnn({ type: 'hatch', points: draft, color }); setDraft([]) } }
  const undo = () => { setAnnotations((a) => a.slice(0, -1)); setDirty(true) }

  const confirmCalibrate = () => {
    if (!calibrateSeg) return
    const m = parseFloat(calibrateVal.replace(',', '.'))
    const px = dist(calibrateSeg[0], calibrateSeg[1])
    if (m > 0 && px > 0) { setScale(px / m); setDirty(true) }
    setCalibrateSeg(null); setCalibrateVal('')
  }
  const confirmNote = () => {
    const text = noteVal.trim()
    if (editingNoteId) {
      if (text) { setAnnotations((l) => l.map((a) => (a.id === editingNoteId ? { ...a, text } : a))); setDirty(true) }
    } else if (notePoint && text) {
      addAnn({ type: 'note', points: [notePoint], text, color })
    }
    setNotePoint(null); setNoteVal(''); setEditingNoteId(null)
  }

  // Modifier l'annotation sélectionnée : couleur, texte (note).
  const recolorSelected = (c: string) => {
    if (!selectedAnn) return
    setAnnotations((l) => l.map((a) => (a.id === selectedAnn ? { ...a, color: c } : a))); setDirty(true)
  }
  const editSelectedNote = () => {
    const a = annotations.find((x) => x.id === selectedAnn)
    if (a?.type === 'note') { setEditingNoteId(a.id); setNoteVal(a.text ?? ''); setNotePoint(a.points[0]) }
  }
  const selAnn = annotations.find((a) => a.id === selectedAnn) ?? null

  const onSave = async () => {
    setSaving(true)
    try {
      await api.plans.update(plan.id, { scalePxPerM: scale, annotations })
      queryClient.invalidateQueries({ queryKey: ['plans', plan.projectId] })
      setDirty(false)
    } finally { setSaving(false) }
  }

  // Auto-save : enregistre automatiquement 1s après la dernière modification.
  useEffect(() => {
    if (!dirty) return
    const t = setTimeout(() => { onSave() }, 1000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, annotations, scale])

  // Format de sortie = format d'entrée (PDF -> PDF, JPG -> JPG, sinon PNG).
  const outExt = plan.mimeType === 'application/pdf' ? 'PDF' : plan.mimeType === 'image/jpeg' ? 'JPG' : 'PNG'

  // « Plan seul » : télécharge le fichier original tel quel.
  const downloadOriginal = async () => {
    const res = await fetch(api.plans.fileUrl(plan.fileName))
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = plan.name
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  }

  // « Plan + annotations » : composé, exporté dans le format d'entrée.
  const exportAnnotated = async () => {
    const base = canvasRef.current
    if (!base) return
    const out = document.createElement('canvas')
    out.width = base.width; out.height = base.height
    const ctx = out.getContext('2d')!
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, out.width, out.height)
    ctx.drawImage(base, 0, 0)
    if (svgRef.current) {
      const svgStr = new XMLSerializer().serializeToString(svgRef.current)
      const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr)
      await new Promise<void>((res) => {
        const img = new Image()
        img.onload = () => { ctx.drawImage(img, 0, 0, out.width, out.height); res() }
        img.onerror = () => res()
        img.src = url
      })
    }
    const baseName = plan.name.replace(/\.[^.]+$/, '')
    if (plan.mimeType === 'application/pdf') {
      const { jsPDF } = await import('jspdf')
      const w = out.width, h = out.height
      const pdf = new jsPDF({ orientation: w > h ? 'landscape' : 'portrait', unit: 'px', format: [w, h] })
      pdf.addImage(out.toDataURL('image/png'), 'PNG', 0, 0, w, h)
      pdf.save(`${baseName}-annote.pdf`)
    } else {
      const jpg = plan.mimeType === 'image/jpeg'
      const a = document.createElement('a')
      a.href = out.toDataURL(jpg ? 'image/jpeg' : 'image/png', 0.92)
      a.download = `${baseName}-annote.${jpg ? 'jpg' : 'png'}`
      a.click()
    }
  }

  // Zoom molette (listener natif non-passif pour pouvoir empêcher le scroll).
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  // Suppr / Retour arrière : supprime l'annotation sélectionnée. Échap : désélectionne.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedAnn) {
        setAnnotations((a) => a.filter((x) => x.id !== selectedAnn)); setSelectedAnn(null); setDirty(true)
      } else if (e.key === 'Escape') setSelectedAnn(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedAnn])

  const UNIT_F = { m: 1, cm: 100, mm: 1000 } as const
  const LEN_DEC = { m: 2, cm: 1, mm: 0 } as const
  const AREA_DEC = { m: 2, cm: 0, mm: 0 } as const
  const fmtLen = (px: number) => {
    if (!scale) return `${Math.round(px)} px`
    return `${(px / scale * UNIT_F[unit]).toFixed(LEN_DEC[unit])} ${unit}`
  }
  const fmtArea = (px2: number) => {
    if (!scale) return `${Math.round(px2)} px²`
    return `${(px2 / (scale * scale) * UNIT_F[unit] ** 2).toFixed(AREA_DEC[unit])} ${unit}²`
  }
  const hatchColors = Array.from(new Set(annotations.filter((a) => a.type === 'hatch').map((a) => a.color ?? '#ef4444')))
  const font = 13 / view.zoom // labels lisibles quel que soit le zoom
  const strokeW = 2 / view.zoom

  return (
    <div className="fixed inset-0 z-50 bg-neutral-800 flex flex-col select-none">
      {/* Barre d'outils */}
      <div className="flex items-center gap-2 px-2 sm:px-3 py-2 bg-neutral-900 text-white shrink-0">
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded shrink-0" title="Fermer"><X className="h-5 w-5" /></button>
        <p className="font-medium truncate max-w-[8rem] sm:max-w-[14rem] hidden sm:block">{plan.name}</p>

        <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1 overflow-x-auto">
          {TOOLS.map((t) => {
            const Icon = t.icon
            return (
              <button
                key={t.key}
                onClick={() => { setTool(t.key); setPending(null); setSelectedAnn(null); if (t.key !== 'hatch') setDraft([]) }}
                title={t.label}
                className={cn('flex items-center gap-1.5 px-2.5 py-2 rounded-lg transition-colors shrink-0', tool === t.key ? 'bg-primary text-white' : 'hover:bg-white/10')}
              >
                <Icon className="h-4 w-4" /><span className="text-xs font-medium hidden md:inline">{t.label}</span>
              </button>
            )
          })}
        </div>

        {tool !== 'pan' && tool !== 'select' && (
          <div className="flex items-center gap-1 shrink-0">
            {COLORS.map((c) => (
              <button key={c} onClick={() => setColor(c)} className={cn('h-6 w-6 rounded-full border-2', color === c ? 'border-white' : 'border-transparent')} style={{ backgroundColor: c }} />
            ))}
          </div>
        )}

        {tool === 'hatch' && draft.length >= 3 && (
          <button onClick={closeHatch} className="px-3 py-1.5 rounded-lg bg-primary text-xs font-semibold shrink-0">Fermer la zone</button>
        )}

        <div className="ml-auto flex items-center gap-1 shrink-0">
          <button onClick={() => zoomButton(1 / 1.25)} className="p-2 hover:bg-white/10 rounded" title="Dézoomer"><ZoomOut className="h-4 w-4" /></button>
          <span className="text-xs tabular-nums w-11 text-center hidden sm:block">{Math.round(view.zoom * 100)}%</span>
          <button onClick={() => zoomButton(1.25)} className="p-2 hover:bg-white/10 rounded" title="Zoomer"><ZoomIn className="h-4 w-4" /></button>
          <button onClick={fitView} className="p-2 hover:bg-white/10 rounded" title="Ajuster"><Maximize className="h-4 w-4" /></button>
          <button onClick={undo} disabled={annotations.length === 0} className="p-2 hover:bg-white/10 rounded disabled:opacity-40" title="Annuler"><Undo2 className="h-4 w-4" /></button>
          <div className="relative">
            <button onClick={() => setExportOpen((o) => !o)} className="p-2 hover:bg-white/10 rounded" title="Exporter"><Download className="h-4 w-4" /></button>
            {exportOpen && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-white text-slate-800 rounded-lg shadow-lg py-1 z-20">
                <button onClick={() => { setExportOpen(false); downloadOriginal() }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100">Plan seul ({outExt} original)</button>
                <button onClick={() => { setExportOpen(false); exportAnnotated() }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100">Plan + annotations ({outExt})</button>
              </div>
            )}
          </div>
          <span className="text-xs text-white/60 flex items-center gap-1.5 px-2 hidden sm:flex">
            {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Enregistrement…</> : dirty ? 'Modifications…' : <><Check className="h-3.5 w-3.5 text-green-400" />Enregistré</>}
          </span>
        </div>
      </div>

      {/* Aide contextuelle + unité + échelle */}
      <div className="bg-neutral-900/80 text-white/80 text-xs px-3 py-1.5 flex items-center justify-between gap-3 shrink-0">
        <span className="truncate">{HINTS[tool]}</span>
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1">
            <span className="text-white/50 hidden sm:inline">Fond</span>
            {['#404040', '#ffffff', '#000000', '#0f2f6b'].map((c) => (
              <button key={c} onClick={() => setBgColor(c)} className={cn('h-4 w-4 rounded border', bgColor === c ? 'border-white ring-1 ring-white' : 'border-white/20')} style={{ backgroundColor: c }} />
            ))}
            <label className="relative h-4 w-4 rounded border border-white/20 overflow-hidden cursor-pointer" title="Autre couleur">
              <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
              <span className="absolute inset-0" style={{ background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' }} />
            </label>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-white/50 hidden sm:inline">Unité</span>
            {(['m', 'cm', 'mm'] as const).map((u) => (
              <button key={u} onClick={() => setUnit(u)} className={cn('px-1.5 py-0.5 rounded font-medium', unit === u ? 'bg-primary text-white' : 'bg-white/10 hover:bg-white/20')}>{u}</button>
            ))}
          </div>
          <span className="hidden sm:inline">{scale ? 'Échelle ✓' : 'Non étalonné'}</span>
        </div>
      </div>

      {/* Zone plan */}
      <div
        ref={containerRef}
        style={{ background: bgColor }}
        className={cn('flex-1 min-h-0 overflow-hidden relative touch-none', tool === 'pan' ? 'cursor-grab active:cursor-grabbing' : tool === 'select' ? 'cursor-default' : 'cursor-crosshair')}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {loading && <div className="absolute inset-0 text-white flex items-center gap-2 justify-center"><Loader2 className="h-6 w-6 animate-spin" />Chargement du plan…</div>}
        {loadError && <div className="absolute inset-0 text-red-300 flex items-center justify-center">Impossible de charger le plan ({loadError}).</div>}

        <div
          style={{ width: stage.w, height: stage.h, transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.zoom})`, transformOrigin: '0 0' }}
          className={cn('absolute top-0 left-0 shadow-2xl bg-white', loading && 'hidden')}
        >
          <canvas ref={canvasRef} className="block pointer-events-none" />
          <svg ref={svgRef} viewBox={`0 0 ${stage.w} ${stage.h}`} width={stage.w} height={stage.h} className="absolute inset-0 pointer-events-none">
            <defs>
              {hatchColors.map((c) => (
                <pattern key={c} id={`hatch-${c.replace('#', '')}`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <line x1="0" y1="0" x2="0" y2="8" stroke={c} strokeWidth="1.5" />
                </pattern>
              ))}
            </defs>

            {annotations.map((a) => <Shape key={a.id} a={a} fmtLen={fmtLen} fmtArea={fmtArea} font={font} strokeW={strokeW} />)}

            {/* Poignées de l'annotation sélectionnée */}
            {selectedAnn && (() => {
              const a = annotations.find((x) => x.id === selectedAnn)
              if (!a) return null
              return <g>{a.points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={6 / view.zoom} fill="#fff" stroke="#2563eb" strokeWidth={2.5 / view.zoom} />)}</g>
            })()}

            {pending && cursor && (
              <line x1={pending.x} y1={pending.y} x2={cursor.x} y2={cursor.y} stroke={color} strokeWidth={strokeW} strokeDasharray={`${6 / view.zoom} ${4 / view.zoom}`} />
            )}
            {tool === 'draw' && draft.length > 0 && (
              <polyline points={draft.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={color} strokeWidth={strokeW} strokeLinecap="round" strokeLinejoin="round" />
            )}
            {tool === 'hatch' && pending && cursor && dist(pending, cursor) > 5 / view.zoom && (
              <rect
                x={Math.min(pending.x, cursor.x)} y={Math.min(pending.y, cursor.y)}
                width={Math.abs(cursor.x - pending.x)} height={Math.abs(cursor.y - pending.y)}
                fill={color} fillOpacity={0.15} stroke={color} strokeWidth={strokeW} strokeDasharray={`${6 / view.zoom} ${4 / view.zoom}`}
              />
            )}
            {tool === 'hatch' && draft.length > 0 && (
              <>
                <polyline points={draft.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={color} strokeWidth={strokeW} />
                {cursor && <line x1={draft[draft.length - 1].x} y1={draft[draft.length - 1].y} x2={cursor.x} y2={cursor.y} stroke={color} strokeWidth={strokeW} strokeDasharray={`${6 / view.zoom} ${4 / view.zoom}`} />}
                {draft.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={5 / view.zoom} fill={color} />)}
              </>
            )}
          </svg>
        </div>

        {selAnn && (
          <div className="absolute bottom-4 left-4 z-10 bg-neutral-900/90 backdrop-blur text-white rounded-xl shadow-lg px-3 py-2 flex items-center gap-1.5 max-w-[calc(100%-2rem)] overflow-x-auto">
            <span className="text-xs text-white/60 mr-1 hidden sm:inline">Couleur</span>
            {COLORS.map((c) => <button key={c} onClick={() => recolorSelected(c)} className={cn('h-6 w-6 rounded-full border-2 shrink-0', (selAnn.color ?? COLORS[0]) === c ? 'border-white' : 'border-white/20')} style={{ backgroundColor: c }} />)}
            {selAnn.type === 'note' && <button onClick={editSelectedNote} className="text-xs px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 whitespace-nowrap shrink-0">Éditer le texte</button>}
          </div>
        )}
        {selectedAnn && (
          <button
            type="button"
            onClick={() => { setAnnotations((a) => a.filter((x) => x.id !== selectedAnn)); setSelectedAnn(null); setDirty(true) }}
            className="absolute bottom-4 right-4 z-10 h-12 px-4 rounded-full bg-red-600 text-white shadow-lg flex items-center gap-2 text-sm font-medium active:scale-95"
          >
            <Trash2 className="h-4 w-4" />Supprimer
          </button>
        )}
      </div>

      {/* Pagination PDF */}
      {isPdf && numPages > 1 && (
        <div className="flex items-center justify-center gap-3 bg-neutral-900 text-white py-2 shrink-0">
          <button onClick={() => setPageNum((n) => Math.max(1, n - 1))} disabled={pageNum <= 1} className="p-1.5 hover:bg-white/10 rounded disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
          <span className="text-sm">Page {pageNum} / {numPages}</span>
          <button onClick={() => setPageNum((n) => Math.min(numPages, n + 1))} disabled={pageNum >= numPages} className="p-1.5 hover:bg-white/10 rounded disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
        </div>
      )}

      {/* Modale étalonnage */}
      {calibrateSeg && (
        <Modal title="Étalonner l'échelle" onCancel={() => setCalibrateSeg(null)} onConfirm={confirmCalibrate} confirmLabel="Définir l'échelle">
          <p className="text-sm text-muted-foreground mb-3">Longueur réelle du trait tracé, en mètres :</p>
          <input
            autoFocus type="number" inputMode="decimal" step="0.01" value={calibrateVal}
            onChange={(e) => setCalibrateVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') confirmCalibrate() }}
            placeholder="ex. 5.20"
            className="w-full h-11 px-3 rounded-lg border text-base outline-none focus:ring-2 focus:ring-primary"
          />
        </Modal>
      )}

      {/* Modale note */}
      {notePoint && (
        <Modal title={editingNoteId ? 'Modifier la note' : 'Ajouter une note'} onCancel={() => { setNotePoint(null); setEditingNoteId(null) }} onConfirm={confirmNote} confirmLabel={editingNoteId ? 'Enregistrer' : 'Ajouter'}>
          <textarea
            autoFocus value={noteVal} onChange={(e) => setNoteVal(e.target.value)} rows={3}
            placeholder="Votre note…"
            className="w-full px-3 py-2 rounded-lg border text-base outline-none focus:ring-2 focus:ring-primary resize-none"
          />
        </Modal>
      )}
    </div>
  )
}

function Modal({ title, children, onCancel, onConfirm, confirmLabel }: { title: string; children: React.ReactNode; onCancel: () => void; onConfirm: () => void; confirmLabel: string }) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-slate-900 mb-3">{title}</h3>
        {children}
        <div className="flex gap-2 mt-4">
          <button onClick={onCancel} className="flex-1 h-11 rounded-lg border text-sm font-medium hover:bg-muted/50">Annuler</button>
          <button onClick={onConfirm} className="flex-1 h-11 rounded-lg bg-primary text-primary-foreground text-sm font-semibold">{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

function Shape({ a, fmtLen, fmtArea, font, strokeW }: { a: PlanAnnotation; fmtLen: (px: number) => string; fmtArea: (px2: number) => string; font: number; strokeW: number }) {
  const color = a.color ?? '#ef4444'
  const halo = 3 * strokeW
  if (a.type === 'note') {
    const p = a.points[0]
    return (
      <g>
        <circle cx={p.x} cy={p.y} r={6 * strokeW} fill={color} />
        <text x={p.x + 10 * strokeW} y={p.y + 4 * strokeW} fontSize={font} fill="#111827" stroke="white" strokeWidth={halo} style={{ paintOrder: 'stroke' }}>{a.text}</text>
      </g>
    )
  }
  if (a.type === 'draw') {
    return <polyline points={a.points.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={color} strokeWidth={strokeW} strokeLinecap="round" strokeLinejoin="round" />
  }
  if (a.type === 'measure' || a.type === 'arrow') {
    const [s, e] = a.points
    const m = mid(s, e)
    let head = null
    if (a.type === 'arrow') {
      const ang = Math.atan2(e.y - s.y, e.x - s.x)
      const L = 12 * strokeW
      const p1 = { x: e.x - L * Math.cos(ang - 0.4), y: e.y - L * Math.sin(ang - 0.4) }
      const p2 = { x: e.x - L * Math.cos(ang + 0.4), y: e.y - L * Math.sin(ang + 0.4) }
      head = <polygon points={`${e.x},${e.y} ${p1.x},${p1.y} ${p2.x},${p2.y}`} fill={color} />
    }
    return (
      <g>
        <line x1={s.x} y1={s.y} x2={e.x} y2={e.y} stroke={color} strokeWidth={strokeW} />
        {head}
        {a.type === 'measure' && (
          <text x={m.x} y={m.y - 6 * strokeW} fontSize={font} fontWeight="600" textAnchor="middle" fill={color} stroke="white" strokeWidth={halo} style={{ paintOrder: 'stroke' }}>{fmtLen(dist(s, e))}</text>
        )}
      </g>
    )
  }
  // hatch
  const c = centroid(a.points)
  return (
    <g>
      <polygon points={a.points.map((p) => `${p.x},${p.y}`).join(' ')} fill={`url(#hatch-${color.replace('#', '')})`} stroke={color} strokeWidth={strokeW} fillOpacity={0.9} />
      <text x={c.x} y={c.y} fontSize={font} fontWeight="600" textAnchor="middle" fill={color} stroke="white" strokeWidth={halo} style={{ paintOrder: 'stroke' }}>{fmtArea(polyArea(a.points))}</text>
    </g>
  )
}
