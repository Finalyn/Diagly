import { useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Upload, FileText, Trash2, Maximize2, Loader2, AlertCircle, Ruler, Layers, Plus } from 'lucide-react'
import { Button, Card, CardContent } from '@/components/ui'
import { PlanEditor } from '@/components/PlanEditor'
import { BoardEditor } from '@/components/BoardEditor'
import { api } from '@/lib/api'
import type { ApiPlan, ApiBoard } from '@/lib/api-types'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`
}
const isImage = (m: string) => m.startsWith('image/')

export function ProjectPlans() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const fileInput = useRef<HTMLInputElement>(null)
  const [viewing, setViewing] = useState<ApiPlan | null>(null)
  const [viewingBoard, setViewingBoard] = useState<ApiBoard | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['plans', id],
    queryFn: () => api.plans.list(id!),
    enabled: !!id,
  })
  const plans = data?.plans ?? []

  const boardsQuery = useQuery({ queryKey: ['boards', id], queryFn: () => api.boards.list(id!), enabled: !!id })
  const boards = boardsQuery.data?.boards ?? []
  const createBoard = useMutation({
    mutationFn: () => api.boards.create({ projectId: id!, name: `Atelier ${boards.length + 1}` }),
    onSuccess: (r) => { queryClient.invalidateQueries({ queryKey: ['boards', id] }); setViewingBoard(r.board) },
  })
  const deleteBoard = useMutation({
    mutationFn: (bid: string) => api.boards.delete(bid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['boards', id] }),
  })

  const upload = useMutation({
    mutationFn: (file: File) => api.plans.upload(id!, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plans', id] }),
    onError: (e) => setError((e as Error)?.message ?? "Échec de l'upload"),
  })
  const remove = useMutation({
    mutationFn: (planId: string) => api.plans.delete(planId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plans', id] }),
  })

  const onFiles = async (files: FileList | null) => {
    if (!files) return
    setError(null)
    for (const file of Array.from(files)) await upload.mutateAsync(file).catch(() => {})
    if (fileInput.current) fileInput.current.value = ''
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Plans</h1>
          <p className="text-muted-foreground text-sm">{plans.length} plan{plans.length !== 1 ? 's' : ''} — PDF ou image, 30 Mo max</p>
        </div>
        <Button onClick={() => fileInput.current?.click()} disabled={upload.isPending} className="w-full sm:w-auto">
          {upload.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Envoi…</> : <><Upload className="mr-2 h-4 w-4" />Ajouter un plan</>}
        </Button>
        <input ref={fileInput} type="file" accept="application/pdf,image/*" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {/* Ateliers multi-plans */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Ateliers multi-plans</h2>
            </div>
            <Button size="sm" variant="outline" onClick={() => createBoard.mutate()} disabled={createBoard.isPending}>
              {createBoard.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="mr-1.5 h-4 w-4" />Nouvel atelier</>}
            </Button>
          </div>
          {boards.length === 0 ? (
            <p className="text-sm text-muted-foreground">Compose plusieurs plans sur un même canvas — calques déplaçables, teinte de référence, annotations, export.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {boards.map((b) => (
                <div key={b.id} className="flex items-center gap-1 rounded-lg border pl-3 pr-1 py-1.5">
                  <button onClick={() => setViewingBoard(b)} className="text-sm font-medium hover:text-primary flex items-center gap-1.5"><Layers className="h-3.5 w-3.5 text-muted-foreground" />{b.name}</button>
                  <button onClick={() => { if (confirm('Supprimer cet atelier ?')) deleteBoard.mutate(b.id) }} className="text-muted-foreground hover:text-red-600 p-1"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></CardContent></Card>
      ) : isError ? (
        <Card><CardContent className="py-16 text-center"><AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" /><p className="text-sm text-red-700">Erreur de chargement</p></CardContent></Card>
      ) : plans.length === 0 ? (
        <Card>
          <CardContent className="py-16 md:py-20 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Ruler className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-lg font-semibold mb-2">Aucun plan</h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">Ajoutez les plans du bâtiment (PDF ou images) pour les consulter ici.</p>
            <Button size="lg" className="px-8" onClick={() => fileInput.current?.click()}><Upload className="mr-2 h-5 w-5" />Ajouter un plan</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {plans.map(plan => (
            <Card key={plan.id} className="overflow-hidden group">
              <button onClick={() => setViewing(plan)} className="block w-full aspect-[4/3] bg-muted/40 relative">
                {isImage(plan.mimeType) ? (
                  <img src={api.plans.fileUrl(plan)} alt={plan.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center"><FileText className="h-10 w-10 text-muted-foreground" /></div>
                )}
                <span className="absolute inset-0 bg-black/0 group-hover:bg-black/10 flex items-center justify-center transition-colors">
                  <Maximize2 className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 drop-shadow" />
                </span>
              </button>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" title={plan.name}>{plan.name}</p>
                    <p className="text-xs text-muted-foreground">{plan.mimeType.split('/')[1]?.toUpperCase()} · {formatSize(plan.size)}</p>
                  </div>
                  <button
                    onClick={() => { if (confirm('Supprimer ce plan ?')) remove.mutate(plan.id) }}
                    className="text-muted-foreground hover:text-red-600 shrink-0"
                    title="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {viewing && <PlanEditor plan={viewing} onClose={() => setViewing(null)} />}
      {viewingBoard && <BoardEditor board={viewingBoard} plans={plans} onClose={() => { setViewingBoard(null); boardsQuery.refetch() }} />}
    </div>
  )
}
