import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, Layers, Loader2, AlertCircle, Building2 } from 'lucide-react'
import { Button, Card, CardContent, Badge } from '@/components/ui'
import { api } from '@/lib/api'

const modeLabels: Record<string, string> = {
  TOTAL: 'Total cumulé',
  PER_BUILDING: 'Bâtiment par bâtiment',
}

export function OperationsList() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['operations'],
    queryFn: () => api.operations.list(),
  })

  const operations = data?.operations ?? []

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Opérations</h1>
          <p className="text-muted-foreground text-sm">
            {isLoading ? 'Chargement…' : `${operations.length} opération${operations.length > 1 ? 's' : ''} regroupant plusieurs bâtiments`}
          </p>
        </div>
        <Link to="/app/operations/new">
          <Button className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" />Nouvelle opération</Button>
        </Link>
      </div>

      {isLoading && (
        <Card><CardContent className="py-16 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />Chargement…</CardContent></Card>
      )}

      {isError && (
        <Card><CardContent className="py-16 text-center"><AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" /><p className="text-sm text-red-700">{(error as Error)?.message ?? 'Erreur de chargement'}</p></CardContent></Card>
      )}

      {!isLoading && !isError && operations.length === 0 && (
        <Card>
          <CardContent className="py-16 md:py-20 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Layers className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-lg font-semibold mb-2">Aucune opération</h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              Une opération regroupe plusieurs bâtiments d'un même chantier (parc immobilier) et permet de raisonner en total ou bâtiment par bâtiment.
            </p>
            <Link to="/app/operations/new">
              <Button size="lg" className="px-8"><Plus className="mr-2 h-5 w-5" />Créer une opération</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 md:gap-4">
        {operations.map(op => (
          <Link key={op.id} to={`/app/operations/${op.id}`}>
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="flex flex-col sm:flex-row sm:items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                  <Layers className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-sm md:text-base">{op.name}</h3>
                    <Badge variant="outline" className="text-[10px] md:text-xs">{modeLabels[op.aggregationMode]}</Badge>
                  </div>
                  {op.clientName && <p className="text-xs md:text-sm text-muted-foreground">{op.clientName}</p>}
                </div>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground shrink-0">
                  <Building2 className="h-4 w-4" />
                  {op._count?.projects ?? 0} bâtiment{(op._count?.projects ?? 0) > 1 ? 's' : ''}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
