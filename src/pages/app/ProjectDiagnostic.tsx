import { useState, lazy, Suspense } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ClipboardCheck, Plus, AlertTriangle, Building2, ArrowRight, Loader2, AlertCircle, Trash2 } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardContent, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui'
import { stateLabels, stateColors, priorityColors } from '@/data/mock'
import { formatCHF, formatDate } from '@/lib/utils'
import { api, ApiError } from '@/lib/api'

// recharts pese ~375 Ko : on ne le charge qu'une fois la page affichee.
const DiagnosticCharts = lazy(() => import('@/components/charts/DiagnosticCharts'))

const priorityCircleColors: Record<string, { bg: string; ring: string }> = {
  I: { bg: 'bg-red-500', ring: 'ring-red-200' },
  II: { bg: 'bg-orange-500', ring: 'ring-orange-200' },
  III: { bg: 'bg-green-500', ring: 'ring-green-200' },
}

const toNum = (v: string | null | undefined): number => (v ? Number(v) : 0)

export function ProjectDiagnostic() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const projectQuery = useQuery({
    queryKey: ['project', id],
    queryFn: () => api.projects.get(id!),
    enabled: !!id,
  })

  const diagnostic = projectQuery.data?.diagnostics[0]

  const itemsQuery = useQuery({
    queryKey: ['diagnostic-items', diagnostic?.id],
    queryFn: () => api.diagnostics.listItems(diagnostic!.id),
    enabled: !!diagnostic,
  })

  const createDiag = useMutation({
    mutationFn: () => api.projects.createDiagnostic(id!, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project', id] }),
  })

  const deleteDiag = useMutation({
    mutationFn: () => api.diagnostics.delete(diagnostic!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] })
      queryClient.invalidateQueries({ queryKey: ['diagnostic-items', diagnostic?.id] })
      navigate(`/app/projects/${id}`)
    },
  })

  if (projectQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />Chargement…
      </div>
    )
  }
  if (projectQuery.isError || !projectQuery.data) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-red-700">
            {(projectQuery.error as ApiError | null)?.message ?? 'Projet introuvable'}
          </p>
        </CardContent>
      </Card>
    )
  }

  if (!diagnostic) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <ClipboardCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-1">Aucun diagnostic</h3>
          <p className="text-sm text-muted-foreground mb-4">Commencez par créer un diagnostic du bâtiment.</p>
          <Button onClick={() => createDiag.mutate()} disabled={createDiag.isPending}>
            {createDiag.isPending
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Création…</>
              : <><Plus className="mr-2 h-4 w-4" />Démarrer un diagnostic</>}
          </Button>
        </CardContent>
      </Card>
    )
  }

  const items = itemsQuery.data?.items ?? []
  const totalDiag = items.reduce((s, i) => s + toNum(i.estimatedCost), 0)
  const pI   = items.filter(i => i.priority === 'I')
  const pII  = items.filter(i => i.priority === 'II')
  const pIII = items.filter(i => i.priority === 'III')

  const stateDistribution = [
    { name: 'Mauvais',  value: items.filter(i => i.state === 'MAUVAIS').length,  color: '#ef4444' },
    { name: 'Moyen',    value: items.filter(i => i.state === 'MOYEN').length,    color: '#fb923c' },
    { name: 'Bon',      value: items.filter(i => i.state === 'BON').length,      color: '#4ade80' },
    { name: 'Très bon', value: items.filter(i => i.state === 'TRES_BON').length, color: '#22c55e' },
  ].filter(s => s.value > 0)

  const priorityData = [
    { name: 'I',   fullName: 'Priorité I',   count: pI.length,   cost: pI.reduce((s, i) => s + toNum(i.estimatedCost), 0),   color: '#ef4444' },
    { name: 'II',  fullName: 'Priorité II',  count: pII.length,  cost: pII.reduce((s, i) => s + toNum(i.estimatedCost), 0),  color: '#fb923c' },
    { name: 'III', fullName: 'Priorité III', count: pIII.length, cost: pIII.reduce((s, i) => s + toNum(i.estimatedCost), 0), color: '#22c55e' },
  ]

  const topCFC = [...items].sort((a, b) => toNum(b.estimatedCost) - toNum(a.estimatedCost)).slice(0, 5)

  const statCards = [
    { label: 'Éléments',    value: items.length,            icon: ClipboardCheck,  color: 'text-blue-600 bg-blue-50' },
    { label: 'Priorité I',  value: pI.length,               icon: AlertTriangle,   color: 'text-red-600 bg-red-50' },
    { label: 'Coût estimé', value: formatCHF(totalDiag),    icon: Building2,       color: 'text-green-600 bg-green-50' },
  ]

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Diagnostic</h1>
          <p className="text-muted-foreground text-sm">
            {items.length} élément{items.length !== 1 ? 's' : ''}
            {diagnostic.visitDate ? ` · visite du ${formatDate(new Date(diagnostic.visitDate))}` : ' · visite non planifiée'}
          </p>
        </div>
        <Link to={`/app/diagnostic/${diagnostic.id}`}>
          <Button className="w-full sm:w-auto"><ClipboardCheck className="mr-2 h-4 w-4" />Ouvrir l'éditeur</Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 md:flex md:flex-wrap gap-3 md:gap-6">
        {statCards.map((stat, i) => (
          <div key={stat.label} className="flex items-baseline gap-2 p-3 md:p-0 rounded-lg bg-white md:bg-transparent border md:border-0">
            <span className="text-base md:text-lg font-bold">{stat.value}</span>
            <span className="text-[10px] md:text-xs text-muted-foreground">{stat.label}</span>
            {i < statCards.length - 1 && <span className="text-border ml-4 hidden md:inline">|</span>}
          </div>
        ))}
      </div>

      {itemsQuery.isLoading && (
        <Card><CardContent className="py-12 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></CardContent></Card>
      )}

      {!itemsQuery.isLoading && items.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <ClipboardCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-1">Aucun élément observé</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Ouvrez l'éditeur pour ajouter des éléments CFC depuis le catalogue.
            </p>
            <Link to={`/app/diagnostic/${diagnostic.id}`}>
              <Button><ClipboardCheck className="mr-2 h-4 w-4" />Ouvrir l'éditeur</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {items.length > 0 && (
        <>
          <Suspense fallback={<div className="h-[260px] rounded-xl border bg-muted/30 animate-pulse" />}>
            <DiagnosticCharts priorityData={priorityData} stateDistribution={stateDistribution} />
          </Suspense>

          {topCFC.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Éléments les plus coûteux</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {topCFC.map((item, i) => {
                    const pc = item.priority ? priorityCircleColors[item.priority] : { bg: 'bg-gray-400', ring: 'ring-gray-200' }
                    return (
                      <Link key={item.id} to={`/app/diagnostic/${diagnostic.id}`} className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                        <span className="text-sm font-bold text-muted-foreground w-5">{i + 1}</span>
                        <div className={`h-7 w-7 rounded-full ${pc.bg} ring-2 ${pc.ring} flex items-center justify-center shrink-0`}>
                          <span className="text-[10px] font-bold text-white">{item.priority ?? '—'}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{item.cfcLabel}</p>
                          <p className="text-xs text-muted-foreground">CFC {item.cfcCode}</p>
                        </div>
                        <span className="font-bold text-sm">{formatCHF(toNum(item.estimatedCost))}</span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                      </Link>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="md:hidden space-y-3">
            {items.map(item => (
              <Card key={item.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs text-muted-foreground">{item.cfcCode}</span>
                    {item.priority
                      ? <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${priorityColors[item.priority]}`}>{item.priority}</span>
                      : <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">À évaluer</span>}
                  </div>
                  <p className="font-medium text-sm mb-2">{item.cfcLabel}</p>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${item.state ? stateColors[item.state] : 'bg-gray-300'}`} />
                      <span className="text-muted-foreground">{item.state ? stateLabels[item.state] : 'À évaluer'}</span>
                    </div>
                    <span className="font-bold">{formatCHF(toNum(item.estimatedCost))}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="hidden md:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code CFC</TableHead>
                    <TableHead>Élément</TableHead>
                    <TableHead>État</TableHead>
                    <TableHead>Priorité</TableHead>
                    <TableHead>Quantité</TableHead>
                    <TableHead className="text-right">Coût estimé</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map(item => (
                    <TableRow key={item.id} className="hover:bg-muted/50">
                      <TableCell className="font-mono text-sm">{item.cfcCode}</TableCell>
                      <TableCell className="font-medium">{item.cfcLabel}</TableCell>
                      <TableCell>
                        <span className={`inline-block h-2.5 w-2.5 rounded-full ${item.state ? stateColors[item.state] : 'bg-gray-300'} mr-2`} />
                        {item.state ? stateLabels[item.state] : 'À évaluer'}
                      </TableCell>
                      <TableCell>
                        {item.priority
                          ? <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${priorityColors[item.priority]}`}>{item.priority}</span>
                          : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>{item.area ? `${item.area} ${item.unit ?? ''}` : '-'}</TableCell>
                      <TableCell className="text-right font-medium">{formatCHF(toNum(item.estimatedCost))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="flex flex-wrap justify-end gap-4 md:gap-8">
            {(['I', 'II', 'III'] as const).map(p => {
              const pItems = items.filter(i => i.priority === p)
              const total = pItems.reduce((s, i) => s + toNum(i.estimatedCost), 0)
              return (
                <div key={p} className="text-right">
                  <p className="text-xs text-muted-foreground">Priorité {p}</p>
                  <p className="font-bold text-sm md:text-base">{formatCHF(total)}</p>
                </div>
              )
            })}
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-base md:text-lg font-bold">{formatCHF(totalDiag)}</p>
            </div>
          </div>
        </>
      )}

      {/* Zone de danger : suppression du diagnostic */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600 flex items-center gap-2 text-base">
            <AlertTriangle className="h-5 w-5" />Zone de danger
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Supprimer ce diagnostic</p>
              <p className="text-xs text-muted-foreground">
                Supprime définitivement le diagnostic et ses {items.length} élément{items.length !== 1 ? 's' : ''} (observations, photos, coûts).
                Le bâtiment, lui, n'est pas supprimé. Action irréversible.
              </p>
            </div>
            {!confirmDelete ? (
              <Button
                variant="outline"
                onClick={() => setConfirmDelete(true)}
                className="text-red-600 border-red-200 hover:bg-red-50 shrink-0"
              >
                <Trash2 className="mr-2 h-4 w-4" />Supprimer
              </Button>
            ) : (
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="ghost" onClick={() => setConfirmDelete(false)} disabled={deleteDiag.isPending}>Annuler</Button>
                <Button
                  onClick={() => deleteDiag.mutate()}
                  disabled={deleteDiag.isPending}
                  className="bg-red-600 hover:bg-red-700 text-white shrink-0"
                >
                  {deleteDiag.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                  Confirmer la suppression
                </Button>
              </div>
            )}
          </div>
          {deleteDiag.isError && (
            <p className="text-xs text-red-600 mt-2">
              {(deleteDiag.error as ApiError | null)?.message ?? 'Échec de la suppression.'}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
