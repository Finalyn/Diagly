import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Building2, Loader2, AlertCircle, Trash2 } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui'
import { statusLabels, statusColors, buildingTypeLabels } from '@/data/mock'
import { formatCHF, cn } from '@/lib/utils'
import { api, ApiError } from '@/lib/api'
import type { AggregationMode } from '@/lib/api-types'

const MODES: { value: AggregationMode; label: string }[] = [
  { value: 'PER_BUILDING', label: 'Bâtiment par bâtiment' },
  { value: 'TOTAL', label: 'Total cumulé' },
]

export function OperationDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['operation', id],
    queryFn: () => api.operations.get(id!),
    enabled: !!id,
  })

  const updateMode = useMutation({
    mutationFn: (aggregationMode: AggregationMode) => api.operations.update(id!, { aggregationMode }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['operation', id] }),
  })

  const remove = useMutation({
    mutationFn: () => api.operations.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operations'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      navigate('/app/projects')
    },
  })

  if (isLoading) {
    return <div className="flex items-center justify-center py-32 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mr-2" />Chargement…</div>
  }
  if (isError || !data) {
    return (
      <Card><CardContent className="py-16 text-center">
        <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
        <p className="text-sm text-red-700">{(error as ApiError | null)?.message ?? 'Diagnostic introuvable'}</p>
        <Link to="/app/projects"><Button variant="outline" className="mt-4">Retour aux diagnostics</Button></Link>
      </CardContent></Card>
    )
  }

  const { operation, projects } = data
  const totalBudget = projects.reduce((s, p) => s + (p.totalBudget ? Number(p.totalBudget) : 0), 0)
  const isTotal = operation.aggregationMode === 'TOTAL'

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/app/projects')}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl md:text-2xl font-bold truncate">{operation.name}</h1>
          {operation.clientName && <p className="text-sm text-muted-foreground">{operation.clientName}</p>}
        </div>
        <Button
          variant="outline" size="icon"
          className="text-red-600 hover:text-red-700 shrink-0"
          disabled={remove.isPending}
          onClick={() => { if (confirm('Supprimer ce diagnostic groupé ? Les bâtiments seront détachés (non supprimés).')) remove.mutate() }}
        >
          {remove.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </Button>
      </div>

      {/* Mode de calcul */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">Mode :</span>
        <div className="inline-flex rounded-lg bg-muted p-1">
          {MODES.map(m => (
            <button
              key={m.value}
              onClick={() => updateMode.mutate(m.value)}
              disabled={updateMode.isPending}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                operation.aggregationMode === m.value ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >{m.label}</button>
          ))}
        </div>
        {updateMode.isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {/* Stats épurées */}
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold tabular-nums">{projects.length}</span>
          <span className="text-sm text-muted-foreground">Bâtiment{projects.length > 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold tabular-nums">{formatCHF(totalBudget)}</span>
          <span className="text-sm text-muted-foreground">{isTotal ? 'Budget total opération' : 'Cumul des bâtiments'}</span>
        </div>
      </div>

      {/* Bâtiments */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Bâtiments</CardTitle>
          <Link to={`/app/projects/new?operationId=${operation.id}`}>
            <Button size="sm"><Plus className="mr-2 h-4 w-4" />Ajouter un bâtiment</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground mb-4">Aucun bâtiment dans cette opération.</p>
              <Link to={`/app/projects/new?operationId=${operation.id}`}>
                <Button><Plus className="mr-2 h-4 w-4" />Ajouter le premier bâtiment</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-1">
              {projects.map(p => (
                <Link key={p.id} to={`/app/projects/${p.id}`} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted shrink-0">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-sm truncate">{p.name}</p>
                      <Badge variant="outline" className="text-[10px]">{buildingTypeLabels[p.buildingType]}</Badge>
                      <span className={cn('text-[10px] text-white px-1.5 py-0.5 rounded', statusColors[p.status])}>{statusLabels[p.status]}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{p.address}, {p.postalCode ? `${p.postalCode} ` : ''}{p.city}</p>
                  </div>
                  {!isTotal && p.totalBudget && (
                    <span className="text-sm font-semibold shrink-0">{formatCHF(Number(p.totalBudget))}</span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
