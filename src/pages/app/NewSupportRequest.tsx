import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, Loader2, Send, LifeBuoy } from 'lucide-react'
import { Card, CardContent, Input, Textarea, Button, Select } from '@/components/ui'
import { api, ApiError } from '@/lib/api'
import { ScreenshotUploader } from '@/components/ScreenshotUploader'
import { FAQ } from '@/data/support'

export function NewSupportRequest() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState('')
  const [body, setBody] = useState('')
  const [attachments, setAttachments] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!subject.trim() || !body.trim()) return
    setBusy(true); setError(null)
    try {
      const r = await api.support.createTicket({ subject: subject.trim(), category: category || undefined, body: body.trim(), attachments })
      qc.invalidateQueries({ queryKey: ['support-tickets'] })
      navigate(`/app/support/${r.ticket.id}`)
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Erreur'); setBusy(false) }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <Link to="/app/support" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" />Aide & support</Link>

      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><LifeBuoy className="h-5 w-5" /></div>
        <div>
          <h1 className="text-xl font-bold">Nouvelle demande de support</h1>
          <p className="text-sm text-muted-foreground">Décrivez votre demande le plus précisément possible. Vous pouvez joindre des captures d'écran.</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6 space-y-5">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Sujet</label>
            <Input placeholder="Ex. Problème lors de l'export Excel" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Catégorie</label>
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Non précisée</option>
              {FAQ.map((c) => <option key={c.id} value={c.label}>{c.label}</option>)}
              <option value="Autre">Autre</option>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Message</label>
            <Textarea placeholder="Décrivez votre demande, les étapes pour reproduire le problème, le résultat attendu…" rows={10} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Captures d'écran <span className="text-muted-foreground font-normal">(optionnel)</span></label>
            <ScreenshotUploader urls={attachments} onChange={setAttachments} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Link to="/app/support"><Button variant="outline" disabled={busy}>Annuler</Button></Link>
            <Button onClick={submit} disabled={busy || !subject.trim() || !body.trim()} size="lg">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Envoyer la demande
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
