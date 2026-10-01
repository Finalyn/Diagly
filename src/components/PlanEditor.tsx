import { useEffect, useRef, useState, useCallback } from 'react'
import { spring, projeterElan, suiviVitesse, mouvementReduit, RESSORTS, type SpringHandle } from '@/lib/motion'
import { useQueryClient } from '@tanstack/react-query'
import {
  X, Hand, MousePointer2, Crosshair, Ruler, ArrowUpRight, StickyNote, Hash, Pencil,
  ZoomIn, ZoomOut, Undo2, Check, Trash2, Loader2, ChevronLeft, ChevronRight, Maximize, Download, Link2,
} from 'lucide-react'
import { api } from '@/lib/api'
import type { ApiPlan, PlanAnnotation, PlanAnnotationType, PlanPoint } from '@/lib/api-types'
import { cn } from '@/lib/utils'
import { loadPdfjs } from '@/lib/pdf'
import { airePolygone, natureDe } from '@/lib/plan-quantites'
import { ChoixOuvrage } from '@/components/plans/ChoixOuvrage'
import { useOuvragesDuProjet } from '@/components/plans/ouvrages'

type Tool = 'pan' | 'select' | 'calibrate' | 'measure' | 'arrow' | 'note' | 'hatch' | 'draw'
const TARGET_W = 1600
const MIN_ZOOM = 0.05
const MAX_ZOOM = 20
const TAP_PX = 6
const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#111827']
/* Fonds de scène : les gris de la charte, plus un blanc et un fond sombre pour
   les plans inversés. Le défaut n'est plus un anthracite isolé mais le gris que
   l'app emploie déjà pour ses bordures appuyées. */
const FONDS = ['#d1d1d6', '#f5f5f7', '#ffffff', '#1d1d1f']

let _c = 0
const uid = () => `a${Date.now()}_${_c++}`
const dist = (a: PlanPoint, b: PlanPoint) => Math.hypot(b.x - a.x, b.y - a.y)
const mid = (a: PlanPoint, b: PlanPoint) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
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

/** Nom lisible d'une annotation, pour l'entête du panneau de sélection. */
const NOMS: Record<PlanAnnotationType, string> = {
  measure: 'Cote', hatch: 'Zone', note: 'Note', arrow: 'Flèche', draw: 'Croquis',
}

/**
 * L'evenement vient-il d'un element pose PAR-DESSUS la scene ?
 *
 * Le panneau de selection et le bouton « Fermer la zone » flottent a l'interieur
 * du conteneur qui porte les gestes : sans ce garde-fou, appuyer sur « Supprimer »
 * ou sur « Rattacher a un ouvrage » commencait par un appui sur le plan, qui ne
 * touchait aucune annotation et deselectionnait donc tout. Le panneau disparaissait
 * avant que le clic n'arrive sur son bouton.
 *
 * Le test ne gene pas un geste legitime : le conteneur capture le pointeur des
 * l'appui, et les evenements d'un pointeur capture sont adresses a l'element qui
 * capture, jamais a ce qui passe dessous.
 */
function surHabillage(e: React.PointerEvent): boolean {
  const cible = e.target as HTMLElement | null
  return !!cible?.closest?.('[data-habillage]')
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
  // Miroir synchrone de la vue : les gestes ont besoin de la valeur affichée à
  // l'instant même, pas de celle du rendu précédent.
  const viewRef = useRef(view)
  useEffect(() => { viewRef.current = view }, [view])
  // Un ressort par axe : un seul ressort sur la distance se désynchronise dès que
  // les deux axes n'ont pas la même vitesse.
  const elan = useRef<{ x: SpringHandle | null; y: SpringHandle | null }>({ x: null, y: null })
  const vitX = useRef(suiviVitesse())
  const vitY = useRef(suiviVitesse())
  const stopElan = () => { elan.current.x?.stop(); elan.current.y?.stop(); elan.current = { x: null, y: null } }
  useEffect(() => stopElan, [])
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
  const [bgColor, setBgColor] = useState(FONDS[0])
  const [selectedAnn, setSelectedAnn] = useState<string | null>(null)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [choixOuvrage, setChoixOuvrage] = useState(false)

  const isPdf = plan.mimeType === 'application/pdf'

  // ---- Chargement (image ou PDF -> canvas) ----
  useEffect(() => {
    let cancelled = false
    setLoading(true); setLoadError(null)
    const url = api.plans.fileUrl(plan)
    ;(async () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')!
      if (isPdf) {
        const buf = await (await fetch(url)).arrayBuffer()
        if (cancelled) return
        const pdfjsLib = await loadPdfjs()
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
    // Le rendu ne dépend que du plan affiché et de la page : l'URL signée du fichier
    // est renouvelée à chaque rafraîchissement de la liste, sans que le contenu change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.id, isPdf, pageNum])

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
    if (calibrateSeg || notePoint || surHabillage(e)) return
    // Le plan est peut-être encore en train de glisser : on le rattrape là où il est
    // affiché, sans attendre la fin de sa course. C'est ce qui distingue un mouvement
    // qu'on peut reprendre d'une animation qu'on subit.
    stopElan()
    vitX.current.reset()
    vitY.current.reset()
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
      const suivante = { ...viewRef.current, tx: viewRef.current.tx + e.movementX, ty: viewRef.current.ty + e.movementY }
      viewRef.current = suivante
      setView(suivante)
      vitX.current.ajouter(suivante.tx)
      vitY.current.ajouter(suivante.ty)
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
    if (surHabillage(e)) return
    const g = gesture.current
    const wasTap = !g.moved

    // Un lancer doit continuer après que le doigt s'est levé : on vise le point où le
    // geste allait, et on y va en partant de la vitesse de relâchement. Sans ça, le
    // plan s'arrête net sous le doigt, ce qu'aucun objet réel ne fait.
    if (g.mode === 'pan' && g.moved && !mouvementReduit()) {
      const vx = vitX.current.vitesse()
      const vy = vitY.current.vitesse()
      // Sous ce seuil, le doigt s'est posé plutôt que lancé : glisser serait un défaut.
      if (Math.abs(vx) > 60 || Math.abs(vy) > 60) {
        const departX = viewRef.current.tx
        const departY = viewRef.current.ty
        elan.current.x = spring({
          from: departX, to: departX + projeterElan(vx), velocity: vx, ...RESSORTS.glisse,
          onUpdate: (val) => { viewRef.current = { ...viewRef.current, tx: val }; setView((v) => ({ ...v, tx: val })) },
        })
        elan.current.y = spring({
          from: departY, to: departY + projeterElan(vy), velocity: vy, ...RESSORTS.glisse,
          onUpdate: (val) => { viewRef.current = { ...viewRef.current, ty: val }; setView((v) => ({ ...v, ty: val })) },
        })
      }
    }
    vitX.current.reset()
    vitY.current.reset()
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

  // Ouvrages du relevé : ils servent à nommer les zones rattachées, directement
  // sur le plan. Une zone qui n'affiche que « 142 m² » ne dit pas ce qu'elle
  // mesure, et c'est justement ce qu'on vient chercher en rouvrant le plan.
  const { items: ouvrages } = useOuvragesDuProjet(plan.projectId)
  const libelleLie = useCallback((a: PlanAnnotation): string | null => {
    if (!a.itemId) return null
    const it = ouvrages.find((o) => o.id === a.itemId)
    return it ? `${it.cfcCode} · ${it.cfcLabel}` : null
  }, [ouvrages])

  /** Choisir un outil abandonne ce qui était en cours de tracé. */
  const choisirOutil = (k: Tool) => {
    setTool(k)
    setPending(null)
    setSelectedAnn(null)
    if (k !== 'hatch') setDraft([])
  }

  const lierSelection = (itemId: string | null) => {
    if (!selectedAnn) return
    setAnnotations((l) => l.map((a) => (a.id === selectedAnn ? { ...a, itemId } : a)))
    setDirty(true)
    setChoixOuvrage(false)
  }

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
    const res = await fetch(api.plans.fileUrl(plan))
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
  /** Mesure lisible d'une annotation, ou null si elle ne mesure rien. */
  const quantiteDe = (a: PlanAnnotation): string | null => {
    const nature = natureDe(a)
    if (nature === 'surface') return fmtArea(airePolygone(a.points))
    if (nature === 'longueur') return fmtLen(dist(a.points[0], a.points[1]))
    return null
  }
  // Les pastilles de couleur agissent sur la selection quand il y en a une,
  // sinon sur le prochain trace : elles doivent montrer celle qui s'applique.
  const couleurActive = selAnn ? (selAnn.color ?? COLORS[0]) : color

  const hatchColors = Array.from(new Set(annotations.filter((a) => a.type === 'hatch').map((a) => a.color ?? '#ef4444')))
  const font = 13 / view.zoom // labels lisibles quel que soit le zoom
  const strokeW = 2 / view.zoom

  return (
    /* L'éditeur reprend la mise en page de l'app : barres claires, texte presque
       noir, coins arrondis. Il était jusqu'ici en gris anthracite avec ses propres
       gris, si bien qu'on changeait d'application en ouvrant un plan, et l'outil
       actif, posé en `bg-primary` sur un fond déjà sombre, ne se voyait pas. Seule
       la scène garde un fond neutre réglable : c'est lui qui détache la feuille. */
    <div className="fixed inset-0 z-50 flex select-none flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-2 sm:px-3">
        <button onClick={onClose} className="rounded-lg p-2 transition-colors hover:bg-muted" title="Fermer">
          <X className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{plan.name}</p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {saving
              ? <><Loader2 className="h-3 w-3 animate-spin" />Enregistrement…</>
              : dirty
                ? 'Modifications en cours…'
                : <><Check className="h-3 w-3 text-emerald-600" />Enregistré</>}
            <span aria-hidden>·</span>
            {scale ? <span>échelle définie</span> : <span className="text-amber-600">pas d’échelle</span>}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <button onClick={() => zoomButton(1 / 1.25)} className="rounded-lg p-2 transition-colors hover:bg-muted" title="Dézoomer"><ZoomOut className="h-4 w-4" /></button>
          <span className="hidden w-12 text-center text-xs tabular-nums text-muted-foreground sm:block">{Math.round(view.zoom * 100)}%</span>
          <button onClick={() => zoomButton(1.25)} className="rounded-lg p-2 transition-colors hover:bg-muted" title="Zoomer"><ZoomIn className="h-4 w-4" /></button>
          <button onClick={fitView} className="rounded-lg p-2 transition-colors hover:bg-muted" title="Ajuster"><Maximize className="h-4 w-4" /></button>
          <button onClick={undo} disabled={annotations.length === 0} className="rounded-lg p-2 transition-colors hover:bg-muted disabled:opacity-40" title="Annuler"><Undo2 className="h-4 w-4" /></button>
          <div className="relative">
            <button onClick={() => setExportOpen((o) => !o)} className="rounded-lg p-2 transition-colors hover:bg-muted" title="Exporter"><Download className="h-4 w-4" /></button>
            {exportOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setExportOpen(false)} />
                <div className="absolute right-0 top-full z-20 mt-1 w-60 overflow-hidden rounded-xl border bg-popover py-1 shadow-lg">
                  <button onClick={() => { setExportOpen(false); downloadOriginal() }} className="w-full px-3 py-2 text-left text-sm hover:bg-muted">Plan seul ({outExt} original)</button>
                  <button onClick={() => { setExportOpen(false); exportAnnotated() }} className="w-full px-3 py-2 text-left text-sm hover:bg-muted">Plan + annotations ({outExt})</button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Rail d'outils : vertical sur grand écran, il repasse en bande sous la
            scène sur mobile, à portée de pouce. */}
        <nav className="hidden w-20 shrink-0 flex-col gap-0.5 overflow-y-auto border-r p-2 sm:flex" aria-label="Outils">
          {TOOLS.map((t) => <BoutonOutil key={t.key} outil={t} actif={tool === t.key} onChoisir={choisirOutil} />)}
          <div className="mt-3 border-t pt-3">
            <p className="mb-1.5 px-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Couleur</p>
            <div className="grid grid-cols-3 gap-1.5 px-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => (selectedAnn ? recolorSelected(c) : setColor(c))}
                  className={cn('h-5 w-5 rounded-full ring-offset-2 transition-shadow', couleurActive === c && 'ring-2 ring-foreground')}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </div>
        </nav>

        <div className="relative flex min-w-0 flex-1 flex-col">
          <div
            ref={containerRef}
            style={{ background: bgColor }}
            className={cn('relative min-h-0 flex-1 touch-none overflow-hidden',
              tool === 'pan' ? 'cursor-grab active:cursor-grabbing' : tool === 'select' ? 'cursor-default' : 'cursor-crosshair')}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />Chargement du plan…
              </div>
            )}
            {loadError && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-destructive">
                Impossible de charger le plan ({loadError}).
              </div>
            )}

          <div
            style={{ width: stage.w, height: stage.h, transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.zoom})`, transformOrigin: '0 0' }}
            className={cn('absolute left-0 top-0 bg-white shadow-xl ring-1 ring-black/5', loading && 'hidden')}
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

              {annotations.map((a) => (
                <Shape key={a.id} a={a} fmtLen={fmtLen} fmtArea={fmtArea} font={font} strokeW={strokeW} lie={libelleLie(a)} />
              ))}

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

            {/* L'aide tient sur une ligne, posée sur la scène : elle suit l'outil
                choisi sans prendre une barre entière à l'écran. */}
            {!loading && (
              <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-3">
                <p className="max-w-full truncate rounded-full border bg-background/90 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur">
                  {HINTS[tool]}
                </p>
              </div>
            )}

            {tool === 'hatch' && draft.length >= 3 && (
              <button
                onClick={closeHatch}
                data-habillage
                className="absolute left-1/2 top-14 -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background shadow-lg"
              >
                Fermer la zone
              </button>
            )}

            {selAnn && (
              <PanneauSelection
                annotation={selAnn}
                lie={libelleLie(selAnn)}
                etalonne={!!scale}
                quantite={quantiteDe(selAnn)}
                onLier={() => setChoixOuvrage(true)}
                onEditerNote={editSelectedNote}
                onSupprimer={() => { setAnnotations((a) => a.filter((x) => x.id !== selectedAnn)); setSelectedAnn(null); setDirty(true) }}
              />
            )}
          </div>

          {/* Bande du bas : les outils sur mobile, puis les réglages de la scène. */}
          <div className="shrink-0 border-t">
            <div className="flex gap-1 overflow-x-auto p-2 sm:hidden">
              {TOOLS.map((t) => <BoutonOutil key={t.key} outil={t} actif={tool === t.key} onChoisir={choisirOutil} compact />)}
            </div>
            <div className="flex items-center gap-3 overflow-x-auto px-3 py-2 text-xs text-muted-foreground sm:px-4">
              <div className="flex shrink-0 items-center gap-1.5 sm:hidden">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => (selectedAnn ? recolorSelected(c) : setColor(c))}
                    className={cn('h-5 w-5 rounded-full ring-offset-2', couleurActive === c && 'ring-2 ring-foreground')}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <span className="hidden sm:inline">Unité</span>
                <div className="flex rounded-lg bg-muted p-0.5">
                  {(['m', 'cm', 'mm'] as const).map((u) => (
                    <button key={u} onClick={() => setUnit(u)}
                      className={cn('rounded-md px-2 py-1 font-medium transition-colors', unit === u ? 'bg-background text-foreground shadow-sm' : 'hover:text-foreground')}>
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <span className="hidden sm:inline">Fond</span>
                {FONDS.map((c) => (
                  <button key={c} onClick={() => setBgColor(c)}
                    className={cn('h-5 w-5 rounded-full border ring-offset-2', bgColor === c && 'ring-2 ring-foreground')}
                    style={{ backgroundColor: c }} />
                ))}
                <label className="relative h-5 w-5 cursor-pointer overflow-hidden rounded-full border" title="Autre couleur">
                  <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
                  <span className="absolute inset-0" style={{ background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' }} />
                </label>
              </div>

              {isPdf && numPages > 1 && (
                <div className="ml-auto flex shrink-0 items-center gap-1">
                  <button onClick={() => setPageNum((n) => Math.max(1, n - 1))} disabled={pageNum <= 1} className="rounded-lg p-1.5 hover:bg-muted disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                  <span className="tabular-nums">Page {pageNum} / {numPages}</span>
                  <button onClick={() => setPageNum((n) => Math.min(numPages, n + 1))} disabled={pageNum >= numPages} className="rounded-lg p-1.5 hover:bg-muted disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Rattachement de la zone sélectionnée à un ouvrage du relevé */}
      {choixOuvrage && selAnn && (
        <ChoixOuvrage
          projectId={plan.projectId}
          nature={natureDe(selAnn)}
          choisi={selAnn.itemId ?? null}
          onChoisir={lierSelection}
          onFermer={() => setChoixOuvrage(false)}
        />
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

      {/* Rattachement de la zone sélectionnée à un ouvrage du relevé */}
      {choixOuvrage && selAnn && (
        <ChoixOuvrage
          projectId={plan.projectId}
          nature={natureDe(selAnn)}
          choisi={selAnn.itemId ?? null}
          onChoisir={lierSelection}
          onFermer={() => setChoixOuvrage(false)}
        />
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

function BoutonOutil({ outil, actif, onChoisir, compact }: {
  outil: { key: Tool; icon: typeof Ruler; label: string }
  actif: boolean
  onChoisir: (k: Tool) => void
  compact?: boolean
}) {
  const Icon = outil.icon
  return (
    <button
      onClick={() => onChoisir(outil.key)}
      title={outil.label}
      aria-pressed={actif}
      className={cn('flex shrink-0 items-center rounded-lg transition-colors',
        compact ? 'gap-1.5 px-3 py-2' : 'flex-col gap-1 px-1 py-2',
        actif ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className={cn('font-medium', compact ? 'text-xs' : 'text-[10px] leading-tight')}>{outil.label}</span>
    </button>
  )
}

/**
 * Carte de l'annotation sélectionnée.
 *
 * Elle remplace la barrette de couleurs qui flottait en bas à gauche : ce qu'on
 * veut savoir d'une zone, c'est ce qu'elle mesure et à quel ouvrage elle se
 * rapporte. Les couleurs ont rejoint le rail d'outils, où elles valent aussi
 * bien pour le prochain tracé.
 */
function PanneauSelection({ annotation, lie, etalonne, quantite, onLier, onEditerNote, onSupprimer }: {
  annotation: PlanAnnotation
  lie: string | null
  etalonne: boolean
  quantite: string | null
  onLier: () => void
  onEditerNote: () => void
  onSupprimer: () => void
}) {
  return (
    <div
      data-habillage
      className="absolute inset-x-3 bottom-3 z-10 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur sm:inset-x-auto sm:left-3 sm:w-80"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {NOMS[annotation.type]}
          </p>
          {quantite
            ? <p className="text-lg font-semibold tabular-nums">{quantite}</p>
            : <p className="truncate text-sm">{annotation.text || 'Sans texte'}</p>}
        </div>
        <button
          onClick={onSupprimer}
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          title="Supprimer"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {quantite && !etalonne && (
        <p className="mt-1 text-xs text-amber-600">
          Plan non étalonné : la mesure est en pixels tant que l’échelle n’est pas définie.
        </p>
      )}

      {annotation.type === 'note' && (
        <button onClick={onEditerNote} className="mt-2 w-full rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted">
          Éditer le texte
        </button>
      )}

      {quantite && (
        <button
          onClick={onLier}
          className={cn('mt-2 flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-muted',
            lie && 'bg-muted')}
        >
          <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">{lie ?? 'Rattacher à un ouvrage'}</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      )}
    </div>
  )
}

function Modal({ title, children, onCancel, onConfirm, confirmLabel }: { title: string; children: React.ReactNode; onCancel: () => void; onConfirm: () => void; confirmLabel: string }) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-2xl border bg-background p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3 text-lg font-semibold">{title}</h3>
        {children}
        <div className="flex gap-2 mt-4">
          <button onClick={onCancel} className="h-11 flex-1 rounded-lg border text-sm font-medium transition-colors hover:bg-muted">Annuler</button>
          <button onClick={onConfirm} className="h-11 flex-1 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

function Shape({ a, fmtLen, fmtArea, font, strokeW, lie }: {
  a: PlanAnnotation; fmtLen: (px: number) => string; fmtArea: (px2: number) => string
  font: number; strokeW: number; lie: string | null
}) {
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
        {a.type === 'measure' && lie && (
          <text x={m.x} y={m.y + font * 0.9} fontSize={font * 0.8} textAnchor="middle" fill="#111827" stroke="white" strokeWidth={halo} style={{ paintOrder: 'stroke' }}>{lie}</text>
        )}
      </g>
    )
  }
  // hatch
  const c = centroid(a.points)
  return (
    <g>
      <polygon points={a.points.map((p) => `${p.x},${p.y}`).join(' ')} fill={`url(#hatch-${color.replace('#', '')})`} stroke={color} strokeWidth={strokeW} fillOpacity={0.9} />
      <text x={c.x} y={c.y} fontSize={font} fontWeight="600" textAnchor="middle" fill={color} stroke="white" strokeWidth={halo} style={{ paintOrder: 'stroke' }}>{fmtArea(airePolygone(a.points))}</text>
      {lie && (
        <text x={c.x} y={c.y + font * 1.05} fontSize={font * 0.8} textAnchor="middle" fill="#111827" stroke="white" strokeWidth={halo} style={{ paintOrder: 'stroke' }}>{lie}</text>
      )}
    </g>
  )
}
