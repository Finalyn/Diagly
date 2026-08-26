import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, Loader2 } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@/components/ui'
import { cn } from '@/lib/utils'
import { api, ApiError } from '@/lib/api'
import type { AggregationMode } from '@/lib/api-types'

const MODES: { value: AggregationMode; label: string; desc: string }[] = [
  { value: 'PER_BUILDING', label: 'Bâtiment par bâtiment', desc: 'Chaque bâtiment a ses propres coûts et son rapport.' },
  { value: 'TOTAL', label: 'Total cumulé', desc: 'Les coûts et rapports sont agrégés sur l’ensemble des bâtiments.' },
]

export function OperationNew() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [clientName, setClientName] = useState('')
  const [mode, setMode] = useState<AggregationMode>('PER_BUILDING')
  const [error, setError] = useState<string | null>(null)

  const create = useMutation({
    mutationFn: () => api.operations.create({
      name,
      clientName: clientName || undefined,
      aggregationMode: mode,
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['operations'] })
      navigate(`/app/diagnostics-multi/${data.operation.id}`)
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Erreur de création'),
  })

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <div>
          <h1 className="text-2xl font-bold">Nouveau diagnostic — plusieurs bâtiments</h1>
          <p className="text-muted-foreground">Regroupez plusieurs adresses dans un même diagnostic</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Informations</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Nom du diagnostic</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Parc Riviera — rénovation 2026" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Client / régie <span className="text-muted-foreground font-normal">(optionnel)</span></label>
            <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Ex: Régie du Léman SA" />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Mode de calcul</label>
            <div className="grid sm:grid-cols-2 gap-3">
              {MODES.map(m => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMode(m.value)}
                  className={cn(
                    'text-left p-3 rounded-lg border-2 transition-colors',
                    mode === m.value ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/30',
                  )}
                >
                  <p className="font-medium text-sm">{m.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{m.desc}</p>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Modifiable à tout moment.</p>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" disabled={create.isPending} onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />Annuler
        </Button>
        <Button disabled={create.isPending || !name.trim()} onClick={() => { setError(null); create.mutate() }}>
          {create.isPending
            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Création…</>
            : <><Check className="mr-2 h-4 w-4" />Créer l'opération</>}
        </Button>
      </div>
    </div>
  )
}
