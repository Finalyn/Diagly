import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, AlertCircle, ClipboardCheck, DollarSign, Download, FileDown } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardContent, Input } from '@/components/ui'
import { ExportDialog } from '@/components/ExportDialog'
import { stateLabels, stateColors, priorityColors } from '@/data/mock'
import { formatCHF, cn } from '@/lib/utils'
import { api } from '@/lib/api'

const TVA = 0.081 // TVA Suisse 8.1%
const toNum = (v: string | null | undefined) => (v ? Number(v) : 0)

export function ProjectMetres() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [exportOpen, setExportOpen] = useState(false)

  const projectQuery = useQuery({
    queryKey: ['project', id],
    queryFn: () => api.projects.get(id!),
    enabled: !!id,
  })
  const project = projectQuery.data?.project
  const diagnostic = projectQuery.data?.diagnostics[0]

  const itemsQuery = useQuery({
    queryKey: ['diagnostic-items', diagnostic?.id],
    queryFn: () => api.diagnostics.listItems(diagnostic!.id),
    enabled: !!diagnostic,
  })
  const items = itemsQuery.data?.items ?? []

  // Indice marché (OFS) appliqué aux coûts — affiché pour transparence.
  const marketQuery = useQuery({ queryKey: ['market-index'], queryFn: () => api.market.index(), staleTime: 1000 * 60 * 60 })
  const market = marketQuery.data

  const updateProject = useMutation({
    mutationFn: (body: { honoraryPct?: number; reservePct?: number }) => api.projects.update(id!, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project', id] }),
  })

  if (projectQuery.isLoading) {
    return <div className="flex items-center justify-center py-32 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mr-2" />Chargement…</div>
  }
  if (projectQuery.isError || !project) {
    return (
      <Card><CardContent className="py-16 text-center">
        <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
        <p className="text-sm text-red-700">Projet introuvable</p>
      </CardContent></Card>
    )
  }

  if (!diagnostic) {
    return (
      <Card><CardContent className="py-16 text-center">
        <ClipboardCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-1">Aucun diagnostic</h3>
        <p className="text-sm text-muted-foreground mb-4">Les coûts proviennent du diagnostic. Démarrez-le d'abord.</p>
        <Link to={`/app/projects/${id}/diagnostic`}><Button>Aller au diagnostic</Button></Link>
      </CardContent></Card>
    )
  }

  // ----- Calcul (3 enveloppes distinctes : réparation · amélioration · remise aux normes) -----
  const htRepair = items.reduce((s, i) => s + toNum(i.estimatedCost), 0)
  const htImprovement = items.reduce((s, i) => s + toNum(i.improvementCost), 0)
  const htNorms = items.reduce((s, i) => s + toNum(i.normsCost), 0)
  const ht = htRepair + htImprovement + htNorms
  const honoraryPct = project.honoraryPct ?? 0
  const reservePct = project.reservePct ?? 0
  const honoraires = ht * honoraryPct / 100
  const afterHonoraires = ht + honoraires
  const reserve = afterHonoraires * reservePct / 100
  const sousTotal = afterHonoraires + reserve
  const tva = sousTotal * TVA
  const total = sousTotal + tva

  const priorities = (['I', 'II', 'III'] as const).map(p => {
    const its = items.filter(i => i.priority === p)
    return { p, items: its, total: its.reduce((s, i) => s + toNum(i.estimatedCost), 0) }
  })

  const totals = { ht, honoraryPct, honoraires, reservePct, reserve, sousTotal, tva, total }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Coûts</h1>
          <p className="text-muted-foreground text-sm">{items.length} élément{items.length !== 1 ? 's' : ''} chiffré{items.length !== 1 ? 's' : ''} depuis le diagnostic</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {items.length > 0 && (
            <>
              <Button variant="outline" onClick={() => setExportOpen(true)}><Download className="mr-2 h-4 w-4" />Exporter</Button>
              <Button variant="outline" onClick={async () => {
                // jsPDF + autoTable pesent ~350 Ko : charges seulement au clic sur Export.
                const { exportCostsPdf } = await import('@/lib/export-costs')
                exportCostsPdf(project, items, totals)
              }}><FileDown className="mr-2 h-4 w-4" />PDF</Button>
            </>
          )}
          <Link to={`/app/diagnostic/${diagnostic.id}`}><Button variant="outline"><ClipboardCheck className="mr-2 h-4 w-4" />Ouvrir le diagnostic</Button></Link>
        </div>
        <ExportDialog open={exportOpen} onOpenChange={setExportOpen} projectId={id!} />
      </div>

      {items.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-1">Aucun coût</h3>
          <p className="text-sm text-muted-foreground mb-4">Ajoutez des éléments dans le diagnostic pour voir les coûts ici.</p>
          <Link to={`/app/diagnostic/${diagnostic.id}`}><Button><ClipboardCheck className="mr-2 h-4 w-4" />Ouvrir l'éditeur</Button></Link>
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
          {/* Détail par priorité */}
          <div className="lg:col-span-2 space-y-4">
            {priorities.map(group => group.items.length > 0 && (
              <Card key={group.p}>
                <CardHeader className="flex flex-row items-center justify-between py-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold', priorityColors[group.p])}>{group.p}</span>
                    Priorité {group.p}
                  </CardTitle>
                  <span className="font-bold">{formatCHF(group.total)}</span>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {group.items.map(item => (
                      <div key={item.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                        <span className="font-mono text-xs text-muted-foreground w-12 shrink-0">{item.cfcCode}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.cfcLabel}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <span className={cn('h-2 w-2 rounded-full', item.state ? stateColors[item.state] : 'bg-gray-300')} />
                            {item.state ? stateLabels[item.state] : 'À évaluer'}
                            {item.area != null && <span>· {item.area} {item.unit?.replace(/^CHF\s*\/?\s*/i, '') ?? ''}</span>}
                          </p>
                        </div>
                        <span className="font-semibold shrink-0">{item.estimatedCost ? formatCHF(toNum(item.estimatedCost)) : '—'}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Synthèse financière */}
          <Card className="self-start lg:sticky lg:top-4">
            <CardHeader><CardTitle>Synthèse</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="Réparation (HT)" value={formatCHF(htRepair)} />
              {htImprovement > 0 && <Row label="Amélioration (HT)" value={formatCHF(htImprovement)} />}
              {htNorms > 0 && <Row label="Remise aux normes (HT)" value={formatCHF(htNorms)} />}
              <Row label="Travaux (HT)" value={formatCHF(ht)} strong />
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground flex items-center gap-1">
                  Honoraires
                  <Input
                    type="number" defaultValue={honoraryPct} className="h-7 w-16 text-xs"
                    onBlur={(e) => { const v = Number(e.target.value); if (v !== honoraryPct) updateProject.mutate({ honoraryPct: v }) }}
                  />%
                </span>
                <span className="font-medium">{formatCHF(honoraires)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground flex items-center gap-1">
                  Réserve
                  <Input
                    type="number" defaultValue={reservePct} className="h-7 w-16 text-xs"
                    onBlur={(e) => { const v = Number(e.target.value); if (v !== reservePct) updateProject.mutate({ reservePct: v }) }}
                  />%
                </span>
                <span className="font-medium">{formatCHF(reserve)}</span>
              </div>
              <Row label="Sous-total" value={formatCHF(sousTotal)} />
              <Row label="TVA 8.1%" value={formatCHF(tva)} />
              <div className="pt-3 border-t flex items-center justify-between">
                <span className="font-semibold">Total TTC</span>
                <span className="text-xl font-bold text-primary">{formatCHF(total)}</span>
              </div>
              {updateProject.isPending && <p className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Mise à jour…</p>}
              <p className="text-[11px] text-muted-foreground pt-1">
                Total = HT × (1 + honoraires) × (1 + réserve) × 1.081. Estimation ±15%.
              </p>
              {market && (
                <p className="text-[11px] text-muted-foreground border-t pt-2">
                  Prix indexés sur le marché suisse — indice construction OFS {market.index} ({market.indexDate}), coefficient ×{market.coeff.toFixed(3)}.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? 'font-semibold' : 'font-medium'}>{value}</span>
    </div>
  )
}
