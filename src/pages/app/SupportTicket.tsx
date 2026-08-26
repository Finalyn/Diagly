import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, Loader2, AlertCircle, Send, Headset, User as UserIcon } from 'lucide-react'
import { Card, CardContent, Textarea, Button, Badge } from '@/components/ui'
import { api, ApiError } from '@/lib/api'
import { ScreenshotUploader } from '@/components/ScreenshotUploader'
import type { SupportStatus, SupportMessage } from '@/lib/api-types'
import { cn } from '@/lib/utils'

const STATUS: Record<SupportStatus, { label: string; cls: string }> = {
  OPEN: { label: 'Ouvert', cls: 'bg-blue-50 text-blue-700' },
  ANSWERED: { label: 'Répondu', cls: 'bg-emerald-50 text-emerald-700' },
  CLOSED: { label: 'Clos', cls: 'bg-gray-100 text-gray-500' },
}
const fmt = new Intl.DateTimeFormat('fr-CH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export function SupportTicket() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const ticketQuery = useQuery({ queryKey: ['support-ticket', id], queryFn: () => api.support.ticket(id!), enabled: !!id })
  const [body, setBody] = useState('')
  const [attachments, setAttachments] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reply = async () => {
    if (!body.trim()) return
    setBusy(true); setError(null)
    try {
      await api.support.reply(id!, { body: body.trim(), attachments })
      setBody(''); setAttachments([])
      await qc.invalidateQueries({ queryKey: ['support-ticket', id] })
      qc.invalidateQueries({ queryKey: ['support-tickets'] })
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Erreur') } finally { setBusy(false) }
  }

  if (ticketQuery.isLoading) return <div className="flex justify-center py-32"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  if (ticketQuery.isError || !ticketQuery.data) return (
    <Card><CardContent className="py-16 text-center"><AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" /><p className="text-sm text-red-700">Ticket introuvable</p></CardContent></Card>
  )
  const t = ticketQuery.data.ticket

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Link to="/app/support" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" />Aide & support</Link>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">{t.subject}</h1>
          <p className="text-xs text-muted-foreground">Demande #{t.id.slice(-6)}{t.category ? ` · ${t.category}` : ''}</p>
        </div>
        <Badge className={cn(STATUS[t.status].cls)}>{STATUS[t.status].label}</Badge>
      </div>

      <div className="space-y-3">
        {t.messages.map((m) => <MessageBubble key={m.id} m={m} />)}
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium">Répondre</p>
          <Textarea placeholder="Votre message…" rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
          <ScreenshotUploader urls={attachments} onChange={setAttachments} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end">
            <Button onClick={reply} disabled={busy || !body.trim()}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Envoyer</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function MessageBubble({ m }: { m: SupportMessage }) {
  const support = m.isSupport
  return (
    <div className={cn('flex gap-2.5', support ? '' : 'flex-row-reverse')}>
      <div className={cn('h-8 w-8 rounded-full flex items-center justify-center shrink-0', support ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
        {support ? <Headset className="h-4 w-4" /> : <UserIcon className="h-4 w-4" />}
      </div>
      <div className={cn('max-w-[80%] rounded-2xl px-3.5 py-2.5', support ? 'bg-primary/5 border border-primary/10' : 'bg-muted')}>
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className="text-xs font-medium">{support ? 'Support Diagly' : m.authorName}</span>
          <span className="text-[10px] text-muted-foreground">{fmt.format(new Date(m.createdAt))}</span>
        </div>
        <p className="text-sm whitespace-pre-wrap">{m.body}</p>
        {m.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {m.attachments.map((u) => (
              <a key={u} href={api.support.attachmentUrl(u)} target="_blank" rel="noopener noreferrer">
                <img src={api.support.attachmentUrl(u)} alt="" className="h-20 w-20 object-cover rounded border hover:opacity-90" />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
