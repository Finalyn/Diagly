import { useEffect, useRef, useState } from 'react'
import { ScanSearch, Loader2, Check, AlertTriangle, Camera, RefreshCw, Send, MessageSquare } from 'lucide-react'
import { api } from '@/lib/api'
import { stateLabels, stateColors, priorityColors } from '@/data/mock'
import { cn } from '@/lib/utils'
import type { ElementState, GuideAnalysis, GuideConfidence } from '@/lib/api-types'

type ChatMsg = { role: 'user' | 'assistant'; content: string }

interface Props {
  /** Toutes les photos de l'élément : analysées ENSEMBLE (angles/détails d'un même sujet). */
  photos: string[]
  item: { cfcCode: string; cfcLabel: string; state: ElementState | null }
  projectId?: string
  /** 'ask' = bouton, 'always' = analyse auto à chaque changement de photos. */
  mode: 'ask' | 'always'
  onApplyState: (s: ElementState) => void
  onApplyNote: (note: string) => void
}

const CONF_LABEL: Record<GuideConfidence, string> = { high: 'confiance élevée', medium: 'confiance moyenne', low: 'confiance faible' }
const CONF_COLOR: Record<GuideConfidence, string> = {
  high: 'bg-green-100 text-green-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-red-100 text-red-700',
}

/** Signature des photos pour détecter un changement (nombre + fin de la dernière). */
function photosKey(photos: string[]): string {
  return `${photos.length}|${photos[photos.length - 1]?.slice(-24) ?? ''}`
}

export function DiagnosticGuide({ photos, item, projectId, mode, onApplyState, onApplyNote }: Props) {
  const [loading, setLoading] = useState(false)
  const [analysis, setAnalysis] = useState<GuideAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notConfigured, setNotConfigured] = useState(false)
  const analyzedRef = useRef<string | null>(null)

  // « Répondre à l'analyse » : fil de discussion de suivi.
  const [chat, setChat] = useState<ChatMsg[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)

  const key = photosKey(photos)
  const count = photos.length

  const run = async () => {
    if (count === 0) return
    setLoading(true); setError(null); setChat([]); setChatInput('')
    analyzedRef.current = key
    try {
      const r = await api.assistant.vision({ images: photos.slice(-8), cfcCode: item.cfcCode, cfcLabel: item.cfcLabel, projectId })
      if (!r.configured) { setNotConfigured(true); setAnalysis(null) }
      else { setAnalysis(r.analysis); setNotConfigured(false) }
    } catch {
      setError('Analyse impossible pour le moment.')
    } finally {
      setLoading(false)
    }
  }

  const sendChat = async (text: string) => {
    const content = text.trim()
    if (!content || chatLoading) return
    const next: ChatMsg[] = [...chat, { role: 'user', content }]
    setChat(next); setChatInput(''); setChatLoading(true)
    try {
      const r = await api.assistant.analysisChat({
        images: photos.slice(-8), cfcCode: item.cfcCode, cfcLabel: item.cfcLabel, projectId, analysis, messages: next,
      })
      setChat((c) => [...c, { role: 'assistant', content: r.reply }])
    } catch {
      setChat((c) => [...c, { role: 'assistant', content: "Réponse impossible pour le moment." }])
    } finally {
      setChatLoading(false)
    }
  }

  // Mode "toujours" : analyse AUTOMATIQUEMENT une seule fois (à l'arrivée de la 1re photo).
  // Ensuite on ne relance rien tout seul : si une nouvelle photo est ajoutée, on PROPOSE de revoir.
  useEffect(() => {
    if (mode === 'always' && count > 0 && analyzedRef.current === null && !loading) run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, mode])

  const attempted = analyzedRef.current !== null
  const stale = attempted && count > 0 && key !== analyzedRef.current // nouvelle photo depuis la dernière analyse
  const conf = analysis?.confidence
  const analyzeLabel = count > 1 ? `Analyser les ${count} photos` : 'Analyser la photo'

  return (
    <div className="rounded-xl border border-primary/25 bg-primary/[0.03] overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-primary/15 bg-primary/[0.06]">
        <ScanSearch className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-primary">Guide IA</span>
        {conf && <span className={cn('ml-auto text-[10px] px-2 py-0.5 rounded-full font-medium', CONF_COLOR[conf])}>{CONF_LABEL[conf]}</span>}
      </div>

      <div className="p-3 space-y-3">
        {notConfigured && (
          <p className="text-xs text-muted-foreground">
            Guide IA non activé sur ce serveur (clé API manquante).
          </p>
        )}

        {!notConfigured && count === 0 && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Camera className="h-3.5 w-3.5" />Prenez une photo pour lancer l'analyse.
          </p>
        )}

        {/* Bouton : "Analyser" si jamais fait (mode à la demande), "Revoir" seulement si une nouvelle photo a été ajoutée. */}
        {!notConfigured && count > 0 && !loading && (!attempted ? mode === 'ask' : stale) && (
          <button
            onClick={run}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-white text-sm font-medium py-2 hover:bg-primary/90"
          >
            {attempted ? <RefreshCw className="h-4 w-4" /> : <ScanSearch className="h-4 w-4" />}
            {attempted ? "Revoir l'analyse (nouvelle photo)" : analyzeLabel}
          </button>
        )}

        {loading && (
          <p className="text-sm text-muted-foreground flex items-center gap-2 py-1">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />Analyse {count > 1 ? `des ${count} photos` : 'de la photo'}…
          </p>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}

        {analysis && !loading && (
          <div className="space-y-3">
            {analysis.element && <p className="text-sm"><span className="text-muted-foreground">Je vois :</span> {analysis.element}</p>}

            <CfcVerdict analysis={analysis} currentCode={item.cfcCode} />

            {analysis.state && (
              <div className="flex items-start gap-2 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">État suggéré :</span>
                    <span className={cn('inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold text-white', stateColors[analysis.state])}>
                      {stateLabels[analysis.state]}
                    </span>
                    {analysis.priority && (
                      <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold', priorityColors[analysis.priority])}>
                        P{analysis.priority}
                      </span>
                    )}
                  </div>
                  {analysis.stateReason && <p className="text-[11px] text-muted-foreground mt-0.5">{analysis.stateReason}</p>}
                </div>
                {analysis.state === item.state ? (
                  <span className="text-[11px] text-green-600 flex items-center gap-1 shrink-0"><Check className="h-3.5 w-3.5" />Déjà défini</span>
                ) : (
                  <button onClick={() => onApplyState(analysis.state!)} className="text-xs font-medium text-primary border border-primary/30 rounded-md px-2 py-1 hover:bg-primary/5 shrink-0">
                    Appliquer
                  </button>
                )}
              </div>
            )}

            {analysis.note && (
              <div className="rounded-lg bg-muted/40 p-2.5">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Note proposée</p>
                <p className="text-sm">{analysis.note}</p>
                <button onClick={() => onApplyNote(analysis.note!)} className="mt-2 text-xs font-medium text-primary hover:underline">
                  Utiliser cette note
                </button>
              </div>
            )}

            {analysis.needMorePhoto && analysis.morePhotoReason && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-amber-800">
                <Camera className="h-4 w-4 mt-0.5 shrink-0" />
                <p className="text-xs">Photo complémentaire conseillée : {analysis.morePhotoReason}</p>
              </div>
            )}

            {(analysis.state !== item.state || analysis.note) && (
              <button
                onClick={() => { if (analysis.state) onApplyState(analysis.state); if (analysis.note) onApplyNote(analysis.note) }}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-primary/30 text-primary text-sm font-medium py-2 hover:bg-primary/5"
              >
                <Check className="h-4 w-4" />Valider les suggestions
              </button>
            )}

            {/* Répondre à l'analyse : dialogue de suivi avec l'IA */}
            <div className="border-t border-primary/15 pt-3 space-y-2">
              <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <MessageSquare className="h-3.5 w-3.5" />Répondre à l'analyse
              </p>
              {chat.map((m, i) => (
                <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={cn('max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-sm leading-relaxed',
                    m.role === 'user' ? 'rounded-br-md bg-primary text-white' : 'rounded-bl-md bg-muted text-foreground')}>
                    {m.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start"><div className="rounded-2xl rounded-bl-md bg-muted px-3 py-2"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div></div>
              )}
              {chat.length === 0 && !chatLoading && (
                <div className="flex flex-wrap gap-1.5">
                  {['Pourquoi cet état ?', 'Non, je pense plutôt le contraire', 'Le bâtiment a été rénové récemment'].map((s) => (
                    <button key={s} onClick={() => sendChat(s)} className="rounded-full border border-primary/20 bg-white px-2.5 py-1 text-xs text-primary hover:bg-primary/5">
                      {s}
                    </button>
                  ))}
                </div>
              )}
              <form onSubmit={(e) => { e.preventDefault(); sendChat(chatInput) }} className="flex items-end gap-2">
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(chatInput) } }}
                  placeholder="Réagir, corriger, demander un détail…"
                  rows={1}
                  className="max-h-24 flex-1 resize-none rounded-xl border bg-white px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20"
                />
                <button type="submit" disabled={chatLoading || !chatInput.trim()} aria-label="Envoyer"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-transform hover:scale-105 active:scale-95 disabled:opacity-40">
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function CfcVerdict({ analysis, currentCode }: { analysis: GuideAnalysis; currentCode: string }) {
  const cfc = analysis.cfc
  if (analysis.matchesSelected === true) {
    return (
      <p className="text-sm flex items-center gap-1.5 text-green-700">
        <Check className="h-4 w-4 shrink-0" />Cohérent avec le CFC {currentCode}.
      </p>
    )
  }
  if (analysis.matchesSelected === false) {
    return (
      <div className="flex items-start gap-1.5 text-amber-800 rounded-lg border border-amber-200 bg-amber-50 p-2.5">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <p className="text-xs">
          Ne semble pas correspondre au CFC {currentCode}.
          {cfc?.code && <> Plutôt <span className="font-semibold">{cfc.code}{cfc.label ? ` · ${cfc.label}` : ''}</span>.</>}
          {cfc?.known === false && <span className="text-muted-foreground"> (code absent du catalogue)</span>}
        </p>
      </div>
    )
  }
  if (cfc?.code) {
    return <p className="text-sm"><span className="text-muted-foreground">CFC probable :</span> {cfc.code}{cfc.label ? ` · ${cfc.label}` : ''}</p>
  }
  return null
}
