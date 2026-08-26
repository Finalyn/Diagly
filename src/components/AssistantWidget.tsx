import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { MessageSquare, Home, Send, X, Loader2, Trash2, PenLine, ChevronRight } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/stores/auth'
import { useIsMobile } from '@/lib/use-mobile'
import { cn } from '@/lib/utils'

type Msg = { role: 'user' | 'assistant'; content: string }

const SUGGESTIONS = [
  'Résume ce diagnostic',
  'Quels travaux sont prioritaires ?',
  'Explique le CFC 221',
  'Aide-moi à présenter le budget au client',
]

/** id du projet ouvert (URL) pour donner le contexte à l'IA. */
function useProjectId(): string | undefined {
  const { pathname } = useLocation()
  const m = pathname.match(/\/app\/projects\/([^/]+)/)
  return m && m[1] !== 'new' ? m[1] : undefined
}

export function AssistantWidget({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [view, setView] = useState<'home' | 'chat'>('home')
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const projectId = useProjectId()
  const { pathname } = useLocation()
  const isMobile = useIsMobile()
  const firstName = useAuth((s) => s.user?.firstName)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Sur l'éditeur mobile du diagnostic, on masque l'assistant : il chevaucherait le
  // bouton flottant "Suivant". (Reste disponible partout ailleurs et sur PC.)
  const onMobileEditor = isMobile && pathname.startsWith('/app/diagnostic/')

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading, view])

  const send = async (text: string) => {
    const content = text.trim()
    if (!content || loading) return
    setError(null)
    setView('chat')
    const next = [...messages, { role: 'user' as const, content }]
    setMessages(next)
    setInput('')
    setLoading(true)
    try {
      const r = await api.assistant.chat({ messages: next, projectId })
      setMessages((m) => [...m, { role: 'assistant', content: r.reply }])
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "L'assistant est momentanément indisponible.")
    } finally {
      setLoading(false)
    }
  }

  if (onMobileEditor) return null

  return (
    <>
      {/* Panneau */}
      {open && (
        <div className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] z-50 flex h-[74vh] w-auto flex-col overflow-hidden rounded-[28px] border border-black/[0.06] bg-white shadow-2xl sm:inset-x-auto sm:bottom-5 sm:right-5 sm:h-[620px] sm:w-[380px] sm:rounded-[28px]">
          {view === 'home' ? (
            <div className="flex flex-1 flex-col overflow-hidden">
              {/* En-tête épuré */}
              <div className="flex shrink-0 items-center gap-3 border-b border-black/[0.06] px-5 py-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100">
                  <img src="/diagly-mark.svg" alt="" className="h-6 w-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold leading-tight text-neutral-900">Diagly Assistant</p>
                  <p className="flex items-center gap-1.5 text-[12px] text-neutral-500"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />En ligne</p>
                </div>
                <button onClick={() => onOpenChange(false)} aria-label="Fermer" className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"><X className="h-[18px] w-[18px]" /></button>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                <p className="px-1 pb-1 text-[22px] font-medium leading-snug tracking-tight">
                  <span className="text-neutral-900">Bonjour{firstName ? ` ${firstName}` : ''} 👋</span><br />
                  <span className="text-neutral-400">Comment puis-je vous aider&nbsp;?</span>
                </p>
                <button
                  onClick={() => setView('chat')}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl border border-black/[0.06] bg-white p-4 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-shadow hover:shadow-md"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-900">Poser une question</p>
                    <p className="text-xs text-neutral-500">Diagly Assistant vous répond</p>
                  </div>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white"><PenLine className="h-4 w-4" /></div>
                </button>

                <div className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white">
                  <p className="px-4 pb-1.5 pt-3 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Pour commencer</p>
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => send(s)} className="flex w-full items-center justify-between gap-2 border-t border-black/[0.05] px-4 py-3 text-left text-sm text-neutral-700 hover:bg-neutral-50">
                      <span className="min-w-0">{s}</span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-neutral-300" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="flex shrink-0 items-center gap-3 border-b border-black/[0.06] px-4 py-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-100"><img src="/diagly-mark.svg" alt="" className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold leading-tight text-neutral-900">Diagly Assistant</p>
                  <p className="flex items-center gap-1.5 text-[11px] text-neutral-500"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />En ligne</p>
                </div>
                {messages.length > 0 && (
                  <button onClick={() => { setMessages([]); setError(null) }} aria-label="Effacer" className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100"><Trash2 className="h-4 w-4" /></button>
                )}
                <button onClick={() => onOpenChange(false)} aria-label="Fermer" className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100"><X className="h-[18px] w-[18px]" /></button>
              </div>

              <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-neutral-50 px-4 py-4">
                {messages.length === 0 && (
                  <div className="flex gap-2.5">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-neutral-100"><img src="/diagly-mark.svg" alt="" className="h-4 w-4" /></span>
                    <div className="max-w-[82%] rounded-2xl rounded-tl-md bg-white px-4 py-3 text-[13.5px] leading-relaxed text-neutral-700 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">Bonjour{firstName ? ` ${firstName}` : ''} 👋 Posez votre question, je vous réponds.</div>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                    <div className={cn('max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed', m.role === 'user' ? 'rounded-br-md bg-neutral-900 text-white' : 'rounded-bl-md bg-white text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)]')}>{m.content}</div>
                  </div>
                ))}
                {loading && (<div className="flex justify-start"><div className="rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 shadow-sm"><Loader2 className="h-4 w-4 animate-spin text-neutral-400" /></div></div>)}
                {error && <p className="text-xs text-red-600">{error}</p>}
              </div>

              <form onSubmit={(e) => { e.preventDefault(); send(input) }} className="flex shrink-0 items-end gap-2 border-t border-black/[0.06] bg-white p-3">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
                  placeholder="Écrivez votre message…"
                  rows={1}
                  className="max-h-28 flex-1 resize-none rounded-2xl bg-neutral-100 px-4 py-2.5 text-sm text-neutral-800 outline-none placeholder:text-neutral-400 focus:ring-2 focus:ring-black/10"
                />
                <button type="submit" disabled={loading || !input.trim()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white transition-transform hover:scale-105 active:scale-95 disabled:opacity-40" aria-label="Envoyer"><Send className="h-[18px] w-[18px]" /></button>
              </form>
            </div>
          )}

          {/* Navigation basse */}
          <div className="flex shrink-0 border-t border-black/[0.06] bg-white">
            <NavItem icon={Home} label="Accueil" active={view === 'home'} onClick={() => setView('home')} />
            <NavItem icon={MessageSquare} label="Chat" active={view === 'chat'} onClick={() => setView('chat')} />
          </div>
        </div>
      )}
    </>
  )
}

function NavItem({ icon: Icon, label, active, onClick }: { icon: typeof Home; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors',
        active ? 'text-neutral-900' : 'text-neutral-400 hover:text-neutral-700',
      )}
    >
      <Icon className="h-5 w-5" />
      {label}
    </button>
  )
}
