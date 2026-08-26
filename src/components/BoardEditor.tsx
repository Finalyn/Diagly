import { useEffect, useRef, useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  X, Hand, Pencil, StickyNote, ZoomIn, ZoomOut, Maximize, Undo2, Check, Download,
  Loader2, Plus, Trash2, Layers, ArrowUp,
} from 'lucide-react'
import { api } from '@/lib/api'
import type { ApiBoard, ApiPlan, BoardLayer, PlanAnnotation, PlanPoint } from '@/lib/api-types'
import { cn } from '@/lib/utils'
import { loadPdfjs } from '@/lib/pdf'

const MIN_ZOOM = 0.02
const MAX_ZOOM = 8
const TAP_PX = 6
const TINTS: (string | null)[] = [null, '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#a855f7']
const DRAW_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#111827']

let _c = 0
const uid = () => `b${Date.now()}_${_c++}`
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** Rend un plan (image directe, PDF -> 1re page en image) pour l'utiliser comme calque. */
function LayerImg({ plan }: { plan: ApiPlan }) {
  // Une image s'affiche directement : pas d'état. Seul le rendu de la 1re page d'un
  // PDF en bitmap doit passer par un état, une fois le rendu asynchrone terminé.
  const isImage = plan.mimeType.startsWith('image/')
  const [pdfSrc, setPdfSrc] = useState<string | null>(null)
  const src = isImage ? api.plans.fileUrl(plan) : pdfSrc
  useEffect(() => {
    if (isImage) return
    let cancelled = false
    ;(async () => {
      const buf = await (await fetch(api.plans.fileUrl(plan))).arrayBuffer()
      const pdfjsLib = await loadPdfjs()
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise
      const page = await pdf.getPage(1)
      const base = page.getViewport({ scale: 1 })
      const vp = page.getViewport({ scale: 1400 / base.width })
      const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height
      await page.render({ canvasContext: c.getContext('2d')!, viewport: vp }).promise
      if (!cancelled) setPdfSrc(c.toDataURL('image/png'))
    })().catch(() => undefined)
    return () => { cancelled = true }
    // Idem PlanEditor : on ne re-rend pas la page PDF quand seule la signature d'URL change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isImage, plan.id])
  if (!src) return <div className="w-72 h-48 bg-white/70 flex items-center justify-center rounded"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
  return <img src={src} alt={plan.name} draggable={false} crossOrigin="anonymous" className="block max-w-none select-none" />
}

export function BoardEditor({ board, plans, onClose }: { board: ApiBoard; plans: ApiPlan[]; onClose: () => void }) {
  const queryClient = useQueryClient()
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const planById = new Map(plans.map((p) => [p.id, p]))

  const [layers, setLayers] = useState<BoardLayer[]>(board.data.layers ?? [])
  const [annotations, setAnnotations] = useState<PlanAnnotation[]>(board.data.annotations ?? [])
  const [bgColor, setBgColor] = useState(board.data.bgColor ?? '#e5e7eb')
  const [selected, setSelected] = useState<string | null>(null)
  const [tool, setTool] = useState<'move' | 'draw' | 'note'>('move')
  const [color, setColor] = useState(DRAW_COLORS[0])
  const [view, setView] = useState({ zoom: 0.2, tx: 60, ty: 60 })
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<PlanPoint[]>([])
  const [notePoint, setNotePoint] = useState<PlanPoint | null>(null)
  const [noteVal, setNoteVal] = useState('')
  const [addOpen, setAddOpen] = useState(false)

  const patchLayer = (id: string, p: Partial<BoardLayer>) => { setLayers((ls) => ls.map((l) => (l.id === id ? { ...l, ...p } : l))); setDirty(true) }
  const selLayer = layers.find((l) => l.id === selected) ?? null

  const toStage = useCallback((cx: number, cy: number): PlanPoint => {
    const r = containerRef.current!.getBoundingClientRect()
    return { x: (cx - r.left - view.tx) / view.zoom, y: (cy - r.top - view.ty) / view.zoom }
  }, [view])

  const zoomAt = useCallback((f: number, cx: number, cy: number) => {
    setView((v) => { const z = clamp(v.zoom * f, MIN_ZOOM, MAX_ZOOM); const k = z / v.zoom; return { zoom: z, tx: cx - (cx - v.tx) * k, ty: cy - (cy - v.ty) * k } })
  }, [])

  const zoomBtn = (f: number) => { const r = containerRef.current!.getBoundingClientRect(); zoomAt(f, r.width / 2, r.height / 2) }
  const fit = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    if (!layers.length) { setView({ zoom: 0.3, tx: r.width / 2, ty: r.height / 2 }); return }
    setView({ zoom: 0.25, tx: 60, ty: 60 })
  }, [layers.length])

  // Pointeurs
  const ptrs = useRef<Map<number, { x: number; y: number }>>(new Map())
  const g = useRef<{ mode: 'none' | 'pan' | 'pinch' | 'moveLayer' | 'draw' | 'note'; sx: number; sy: number; moved: boolean; ld: number; lmx: number; lmy: number }>(
    { mode: 'none', sx: 0, sy: 0, moved: false, ld: 0, lmx: 0, lmy: 0 },
  )

  const onDown = (e: React.PointerEvent) => {
    if (notePoint) return
    const el = containerRef.current!
    el.setPointerCapture(e.pointerId)
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (e.button === 1) { e.preventDefault(); g.current.mode = 'pan'; return }
    if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()]
      g.current.mode = 'pinch'; g.current.ld = Math.hypot(a.x - b.x, a.y - b.y); g.current.lmx = (a.x + b.x) / 2; g.current.lmy = (a.y + b.y) / 2
      setDraft([]); return
    }
    if (ptrs.current.size !== 1) return
    g.current.sx = e.clientX; g.current.sy = e.clientY; g.current.moved = false
    const sp = toStage(e.clientX, e.clientY)
    if (tool === 'draw') { g.current.mode = 'draw'; setDraft([sp]) }
    else if (tool === 'note') { g.current.mode = 'note' }
    else { g.current.mode = selLayer ? 'moveLayer' : 'pan' } // move : déplace le calque sélectionné, sinon le canvas
  }

  const onMove = (e: React.PointerEvent) => {
    if (!ptrs.current.has(e.pointerId)) return
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (Math.hypot(e.clientX - g.current.sx, e.clientY - g.current.sy) > TAP_PX) g.current.moved = true
    if (g.current.mode === 'pinch' && ptrs.current.size >= 2) {
      const [a, b] = [...ptrs.current.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2
      const r = containerRef.current!.getBoundingClientRect()
      if (g.current.ld > 0) zoomAt(d / g.current.ld, mx - r.left, my - r.top)
      setView((v) => ({ ...v, tx: v.tx + (mx - g.current.lmx), ty: v.ty + (my - g.current.lmy) }))
      g.current.ld = d; g.current.lmx = mx; g.current.lmy = my; return
    }
    if (g.current.mode === 'pan') { setView((v) => ({ ...v, tx: v.tx + e.movementX, ty: v.ty + e.movementY })); return }
    if (g.current.mode === 'moveLayer' && selLayer) { patchLayer(selLayer.id, { x: selLayer.x + e.movementX / view.zoom, y: selLayer.y + e.movementY / view.zoom }); return }
    if (g.current.mode === 'draw') { setDraft((d) => [...d, toStage(e.clientX, e.clientY)]); return }
  }

  const onUp = (e: React.PointerEvent) => {
    const tap = !g.current.moved
    const sp = toStage(e.clientX, e.clientY)
    ptrs.current.delete(e.pointerId)
    if (g.current.mode === 'draw') { if (draft.length >= 2) { setAnnotations((a) => [...a, { id: uid(), type: 'draw', points: draft, color }]); setDirty(true) } setDraft([]) }
    else if (g.current.mode === 'note' && tap) { setNotePoint(sp); setNoteVal('') }
    if (ptrs.current.size === 0) g.current.mode = 'none'
  }

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => { e.preventDefault(); const r = el.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top) }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  const addLayer = (plan: ApiPlan) => {
    const n = layers.length
    setLayers((ls) => [...ls, { id: uid(), planId: plan.id, x: 100 + n * 60, y: 100 + n * 60, scale: 1, opacity: 1, tint: null }])
    setDirty(true); setAddOpen(false)
  }
  const removeLayer = (id: string) => { setLayers((ls) => ls.filter((l) => l.id !== id)); if (selected === id) setSelected(null); setDirty(true) }
  const toFront = (id: string) => { setLayers((ls) => { const l = ls.find((x) => x.id === id); if (!l) return ls; return [...ls.filter((x) => x.id !== id), l] }); setDirty(true) }

  const save = async () => {
    setSaving(true)
    try {
      await api.boards.update(board.id, { data: { layers, annotations, bgColor } })
      queryClient.invalidateQueries({ queryKey: ['boards', board.projectId] })
      setDirty(false)
    } finally { setSaving(false) }
  }

  // Auto-save : 1s après la dernière modification.
  useEffect(() => {
    if (!dirty) return
    const t = setTimeout(() => { save() }, 1000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, layers, annotations, bgColor])

  const exportPng = async () => {
    const { default: html2canvas } = await import('html2canvas')
    const el = containerRef.current
    if (!el) return
    const canvas = await html2canvas(el, { backgroundColor: bgColor, useCORS: true, logging: false })
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png'); a.download = `${board.name}.png`; a.click()
  }

  const strokeW = 2 / view.zoom

  return (
    <div className="fixed inset-0 z-50 bg-neutral-800 flex flex-col select-none">
      {/* Barre */}
      <div className="flex items-center gap-2 px-2 sm:px-3 py-2 bg-neutral-900 text-white shrink-0">
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded" title="Fermer"><X className="h-5 w-5" /></button>
        <p className="font-medium truncate max-w-[8rem] sm:max-w-[12rem] hidden sm:block">{board.name}</p>

        <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1">
          {([['move', Hand, 'Déplacer'], ['draw', Pencil, 'Dessiner'], ['note', StickyNote, 'Note']] as const).map(([k, Icon, label]) => (
            <button key={k} onClick={() => { setTool(k); setDraft([]) }} title={label}
              className={cn('flex items-center gap-1.5 px-2.5 py-2 rounded-lg', tool === k ? 'bg-primary text-white' : 'hover:bg-white/10')}>
              <Icon className="h-4 w-4" /><span className="text-xs font-medium hidden md:inline">{label}</span>
            </button>
          ))}
        </div>

        {tool === 'draw' && (
          <div className="flex items-center gap-1">
            {DRAW_COLORS.map((c) => <button key={c} onClick={() => setColor(c)} className={cn('h-6 w-6 rounded-full border-2', color === c ? 'border-white' : 'border-transparent')} style={{ backgroundColor: c }} />)}
          </div>
        )}

        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => zoomBtn(1 / 1.25)} className="p-2 hover:bg-white/10 rounded"><ZoomOut className="h-4 w-4" /></button>
          <span className="text-xs tabular-nums w-11 text-center hidden sm:block">{Math.round(view.zoom * 100)}%</span>
          <button onClick={() => zoomBtn(1.25)} className="p-2 hover:bg-white/10 rounded"><ZoomIn className="h-4 w-4" /></button>
          <button onClick={fit} className="p-2 hover:bg-white/10 rounded" title="Ajuster"><Maximize className="h-4 w-4" /></button>
          <button onClick={() => { setAnnotations((a) => a.slice(0, -1)); setDirty(true) }} disabled={!annotations.length} className="p-2 hover:bg-white/10 rounded disabled:opacity-40"><Undo2 className="h-4 w-4" /></button>
          <button onClick={exportPng} className="p-2 hover:bg-white/10 rounded" title="Exporter PNG"><Download className="h-4 w-4" /></button>
          <span className="text-xs text-white/60 flex items-center gap-1.5 px-2 hidden sm:flex">
            {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Enreg…</> : dirty ? 'Modifs…' : <><Check className="h-3.5 w-3.5 text-green-400" />Enregistré</>}
          </span>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex">
        {/* Canvas */}
        <div
          ref={containerRef}
          style={{ background: bgColor }}
          className={cn('flex-1 min-h-0 overflow-hidden relative touch-none', tool === 'move' ? (selLayer ? 'cursor-move' : 'cursor-grab active:cursor-grabbing') : 'cursor-crosshair')}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        >
          <div ref={contentRef} style={{ transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.zoom})`, transformOrigin: '0 0' }} className="absolute top-0 left-0">
            {layers.map((l) => {
              const plan = planById.get(l.planId)
              if (!plan) return null
              return (
                <div
                  key={l.id}
                  onPointerDown={() => { if (tool === 'move') setSelected(l.id) }}
                  style={{ position: 'absolute', left: l.x, top: l.y, transform: `scale(${l.scale})`, transformOrigin: '0 0', opacity: l.opacity, isolation: 'isolate' }}
                  className={cn('shadow-xl', selected === l.id && tool === 'move' && 'outline outline-2 outline-primary')}
                >
                  <LayerImg plan={plan} />
                  {l.tint && <div className="absolute inset-0 pointer-events-none" style={{ background: l.tint, mixBlendMode: 'multiply' }} />}
                </div>
              )
            })}

            {/* Annotations */}
            <svg viewBox="0 0 6000 4000" width={6000} height={4000} className="absolute top-0 left-0 pointer-events-none overflow-visible">
              {annotations.map((a) => {
                if (a.type === 'note') { const p = a.points[0]; return (
                  <g key={a.id}>
                    <circle cx={p.x} cy={p.y} r={6 * strokeW} fill={a.color ?? '#ef4444'} />
                    <text x={p.x + 10 * strokeW} y={p.y + 4 * strokeW} fontSize={13 / view.zoom} fill="#111827" stroke="white" strokeWidth={3 * strokeW} style={{ paintOrder: 'stroke' }}>{a.text}</text>
                  </g>
                ) }
                if (a.type === 'draw') return <polyline key={a.id} points={a.points.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={a.color ?? '#ef4444'} strokeWidth={strokeW} strokeLinecap="round" strokeLinejoin="round" />
                return null
              })}
              {tool === 'draw' && draft.length > 0 && <polyline points={draft.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={color} strokeWidth={strokeW} strokeLinecap="round" strokeLinejoin="round" />}
            </svg>
          </div>

          {layers.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70 pointer-events-none">
              <Layers className="h-10 w-10 mb-2" />Ajoute des plans depuis le panneau à droite →
            </div>
          )}
        </div>

        {/* Panneau calques */}
        <div className="w-64 shrink-0 bg-neutral-900 text-white flex flex-col border-l border-white/10">
          <div className="p-3 border-b border-white/10 flex items-center justify-between">
            <span className="text-sm font-semibold flex items-center gap-2"><Layers className="h-4 w-4" />Calques</span>
            <div className="relative">
              <button onClick={() => setAddOpen((o) => !o)} className="p-1.5 rounded bg-primary hover:bg-primary/90"><Plus className="h-4 w-4" /></button>
              {addOpen && (
                <div className="absolute right-0 top-full mt-1 w-56 max-h-64 overflow-y-auto bg-white text-slate-800 rounded-lg shadow-lg py-1 z-20">
                  {plans.length === 0 && <p className="px-3 py-2 text-xs text-slate-400">Aucun plan. Ajoute d'abord des plans.</p>}
                  {plans.map((p) => <button key={p.id} onClick={() => addLayer(p)} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 truncate">{p.name}</button>)}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {[...layers].reverse().map((l) => {
              const plan = planById.get(l.planId)
              return (
                <button key={l.id} onClick={() => setSelected(l.id)} className={cn('w-full text-left px-2 py-2 rounded-lg text-sm flex items-center gap-2', selected === l.id ? 'bg-primary/20 ring-1 ring-primary' : 'hover:bg-white/5')}>
                  <span className="truncate flex-1">{plan?.name ?? 'Plan'}</span>
                  <span onClick={(e) => { e.stopPropagation(); toFront(l.id) }} className="p-1 hover:bg-white/10 rounded" title="Devant"><ArrowUp className="h-3.5 w-3.5" /></span>
                  <span onClick={(e) => { e.stopPropagation(); removeLayer(l.id) }} className="p-1 hover:bg-red-500/20 text-red-300 rounded" title="Retirer"><Trash2 className="h-3.5 w-3.5" /></span>
                </button>
              )
            })}
            {layers.length === 0 && <p className="text-xs text-white/40 text-center py-4">Aucun calque</p>}
          </div>

          {/* Réglages du calque sélectionné */}
          {selLayer && (
            <div className="p-3 border-t border-white/10 space-y-3">
              <p className="text-xs font-semibold text-white/70">Calque sélectionné</p>
              <div>
                <label className="text-[11px] text-white/60 flex justify-between mb-1"><span>Opacité</span><span>{Math.round(selLayer.opacity * 100)}%</span></label>
                <input type="range" min={0.1} max={1} step={0.05} value={selLayer.opacity} onChange={(e) => patchLayer(selLayer.id, { opacity: Number(e.target.value) })} className="w-full accent-primary" />
              </div>
              <div>
                <label className="text-[11px] text-white/60 flex justify-between mb-1"><span>Taille</span><span>{Math.round(selLayer.scale * 100)}%</span></label>
                <input type="range" min={0.2} max={3} step={0.05} value={selLayer.scale} onChange={(e) => patchLayer(selLayer.id, { scale: Number(e.target.value) })} className="w-full accent-primary" />
              </div>
              <div>
                <p className="text-[11px] text-white/60 mb-1">Teinte (référence)</p>
                <div className="flex items-center gap-1.5">
                  {TINTS.map((t, i) => (
                    <button key={i} onClick={() => patchLayer(selLayer.id, { tint: t })}
                      className={cn('h-6 w-6 rounded-full border-2 flex items-center justify-center', (selLayer.tint ?? null) === t ? 'border-white' : 'border-white/20')}
                      style={{ backgroundColor: t ?? 'transparent' }}>
                      {t === null && <X className="h-3 w-3 text-white/60" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Fond */}
          <div className="p-3 border-t border-white/10 flex items-center gap-2">
            <span className="text-[11px] text-white/60">Fond</span>
            {['#e5e7eb', '#ffffff', '#404040', '#0f2f6b'].map((c) => (
              <button key={c} onClick={() => { setBgColor(c); setDirty(true) }} className={cn('h-5 w-5 rounded border', bgColor === c ? 'border-white' : 'border-white/20')} style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>
      </div>

      {/* Modale note */}
      {notePoint && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={() => setNotePoint(null)}>
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900 mb-3">Ajouter une note</h3>
            <textarea autoFocus value={noteVal} onChange={(e) => setNoteVal(e.target.value)} rows={3} placeholder="Votre note…" className="w-full px-3 py-2 rounded-lg border text-base outline-none focus:ring-2 focus:ring-primary resize-none" />
            <div className="flex gap-2 mt-4">
              <button onClick={() => setNotePoint(null)} className="flex-1 h-11 rounded-lg border text-sm font-medium hover:bg-muted/50">Annuler</button>
              <button onClick={() => { if (notePoint && noteVal.trim()) { setAnnotations((a) => [...a, { id: uid(), type: 'note', points: [notePoint], text: noteVal.trim(), color }]); setDirty(true) } setNotePoint(null) }} className="flex-1 h-11 rounded-lg bg-primary text-primary-foreground text-sm font-semibold">Ajouter</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
