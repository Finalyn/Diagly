import { lazy, Suspense, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowRight, ClipboardCheck, Loader2, Trash2 } from 'lucide-react'
import {
  Button, Card, CardHeader, CardTitle, CardContent,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui'
import { stateLabels, stateColors, priorityColors } from '@/data/mock'
import { formatCHF } from '@/lib/utils'
import { api, ApiError } from '@/lib/api'
import { useDevisDuDossier } from '@/components/report/use-devis-du-dossier'

/**
 * Ce qu'un diagnostic donne à lire quand on ne le remplit pas.
 *
 * Ces chiffres vivaient dans l'onglet Diagnostic, devant un bouton « Ouvrir
 * l'éditeur ». L'onglet disait donc deux choses à la fois : voici l'état du
 * dossier, et voici la porte pour le modifier. Les deux ne se consultent pas au
 * même moment. Les chiffres rejoignent le résumé du projet, où l'on vient
 * justement pour savoir où en est le bâtiment ; l'onglet Diagnostic ne porte
 * plus que l'éditeur.
 */

// recharts pese ~375 Ko : on ne le charge qu'une fois la page affichee.
const DiagnosticCharts = lazy(() => import('@/components/charts/DiagnosticCharts'))

const priorityCircleColors: Record<string, { bg: string; ring: string }> = {
  I: { bg: 'bg-red-500', ring: 'ring-red-200' },
  II: { bg: 'bg-orange-500', ring: 'ring-orange-200' },
  III: { bg: 'bg-green-500', ring: 'ring-green-200' },
}

const toNum = (v: string | null | undefined): number => (v ? Number(v) : 0)

export function StatistiquesDiagnostic({ diagnosticId, projectId }: { diagnosticId: string; projectId: string }) {
  // Le total et les compteurs par priorité viennent du devis, comme au rapport :
  // la fiche ne doit pas annoncer un autre montant que le PDF.
  const { devis } = useDevisDuDossier(projectId)
  const itemsQuery = useQuery({
    queryKey: ['diagnostic-items', diagnosticId],
    queryFn: () => api.diagnostics.listItems(diagnosticId),
  })

  if (itemsQuery.isLoading) {
    return (
      <Card><CardContent className="py-12 text-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mx-auto" />
      </CardContent></Card>
    )
  }

  const items = itemsQuery.data?.items ?? []
  // Les sections restent en place quand le dossier est vide, avec leurs zéros.
  // Un écran qui change de forme au premier relevé oblige à réapprendre où
  // regarder, et on ne voit plus que ce qui vient d'apparaître.
  const vide = items.length === 0

  const total = devis?.ht ?? items.reduce((s, i) => s + toNum(i.estimatedCost), 0)
  const duDevis = (p: 'I' | 'II' | 'III') => devis?.priorites.find((x) => x.cle === p)
  const pI = items.filter(i => i.priority === 'I')
  const pII = items.filter(i => i.priority === 'II')
  const pIII = items.filter(i => i.priority === 'III')

  const stateDistribution = [
    { name: 'Mauvais', value: items.filter(i => i.state === 'MAUVAIS').length, color: '#ef4444' },
    { name: 'Moyen', value: items.filter(i => i.state === 'MOYEN').length, color: '#fb923c' },
    { name: 'Bon', value: items.filter(i => i.state === 'BON').length, color: '#4ade80' },
    { name: 'Très bon', value: items.filter(i => i.state === 'TRES_BON').length, color: '#22c55e' },
  ].filter(s => s.value > 0)

  const priorityData = [
    { name: 'I', fullName: 'Priorité I', count: duDevis('I')?.lignes ?? pI.length, cost: duDevis('I')?.ht ?? pI.reduce((s, i) => s + toNum(i.estimatedCost), 0), color: '#ef4444' },
    { name: 'II', fullName: 'Priorité II', count: duDevis('II')?.lignes ?? pII.length, cost: duDevis('II')?.ht ?? pII.reduce((s, i) => s + toNum(i.estimatedCost), 0), color: '#fb923c' },
    { name: 'III', fullName: 'Priorité III', count: duDevis('III')?.lignes ?? pIII.length, cost: duDevis('III')?.ht ?? pIII.reduce((s, i) => s + toNum(i.estimatedCost), 0), color: '#22c55e' },
  ]

  const topCFC = [...items].sort((a, b) => toNum(b.estimatedCost) - toNum(a.estimatedCost)).slice(0, 5)

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Les trois chiffres qu'on vient chercher en premier. */}
      <div className="flex flex-wrap items-baseline gap-x-8 gap-y-3">
        <Chiffre valeur={String(items.length)} libelle={`ouvrage${items.length > 1 ? 's' : ''} relevé${items.length > 1 ? 's' : ''}`} />
        <Chiffre valeur={String(pI.length)} libelle="en priorité I" />
        <Chiffre valeur={formatCHF(total)} libelle="de travaux estimés" />
      </div>

      {vide ? (
        <Card>
          <CardContent className="flex h-[260px] flex-col items-center justify-center gap-3 text-center">
            <ClipboardCheck className="h-9 w-9 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Les graphiques apparaîtront au premier relevé.
            </p>
            <Link to={`/app/projects/${projectId}/diagnostic`}>
              <Button variant="outline"><ClipboardCheck className="mr-2 h-4 w-4" />Ouvrir le relevé</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Suspense fallback={<div className="h-[260px] rounded-xl border bg-muted/30 animate-pulse" />}>
          <DiagnosticCharts priorityData={priorityData} stateDistribution={stateDistribution} />
        </Suspense>
      )}

      <Card>
        <CardHeader><CardTitle>Ouvrages les plus coûteux</CardTitle></CardHeader>
        <CardContent>
          {vide && <p className="py-2 text-sm text-muted-foreground">Aucun ouvrage relevé.</p>}
          <div className="space-y-1">
            {topCFC.map((item, i) => {
              const pc = item.priority ? priorityCircleColors[item.priority] : { bg: 'bg-gray-400', ring: 'ring-gray-200' }
              return (
                <Link
                  key={item.id}
                  to={`/app/projects/${projectId}/diagnostic?item=${item.id}`}
                  className="flex items-center gap-4 rounded-lg p-3 transition-colors hover:bg-muted/50"
                >
                  <span className="w-5 text-sm font-bold text-muted-foreground">{i + 1}</span>
                  <div className={`h-7 w-7 shrink-0 rounded-full ${pc.bg} ring-2 ${pc.ring} flex items-center justify-center`}>
                    <span className="text-[10px] font-bold text-white">{item.priority ?? '?'}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.cfcLabel}</p>
                    <p className="text-xs text-muted-foreground">CFC {item.cfcCode}</p>
                  </div>
                  <span className="text-sm font-bold">{formatCHF(toNum(item.estimatedCost))}</span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                </Link>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Le détail : cartes sur téléphone, tableau au bureau. */}
      <div className="space-y-3 md:hidden">
        {items.map(item => (
          <Card key={item.id}>
            <CardContent className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-xs text-muted-foreground">{item.cfcCode}</span>
                {item.priority
                  ? <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${priorityColors[item.priority]}`}>{item.priority}</span>
                  : <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">À évaluer</span>}
              </div>
              <p className="mb-2 text-sm font-medium">{item.cfcLabel}</p>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${item.state ? stateColors[item.state] : 'bg-gray-300'}`} />
                  <span className="text-muted-foreground">{item.state ? stateLabels[item.state] : 'À évaluer'}</span>
                </span>
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
                <TableHead>Ouvrage</TableHead>
                <TableHead>État</TableHead>
                <TableHead>Priorité</TableHead>
                <TableHead>Quantité</TableHead>
                <TableHead className="text-right">Coût estimé</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vide && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    Aucun ouvrage relevé.
                  </TableCell>
                </TableRow>
              )}
              {items.map(item => (
                <TableRow key={item.id} className="hover:bg-muted/50">
                  <TableCell className="font-mono text-sm">{item.cfcCode}</TableCell>
                  <TableCell className="font-medium">{item.cfcLabel}</TableCell>
                  <TableCell>
                    <span className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${item.state ? stateColors[item.state] : 'bg-gray-300'}`} />
                    {item.state ? stateLabels[item.state] : 'À évaluer'}
                  </TableCell>
                  <TableCell>
                    {item.priority
                      ? <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${priorityColors[item.priority]}`}>{item.priority}</span>
                      : <span className="text-xs text-muted-foreground">n.c.</span>}
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
        {([['I', pI], ['II', pII], ['III', pIII]] as const).map(([p, liste]) => (
          <div key={p} className="text-right">
            <p className="text-xs text-muted-foreground">Priorité {p}</p>
            <p className="text-sm font-bold md:text-base">
              {formatCHF(liste.reduce((s, i) => s + toNum(i.estimatedCost), 0))}
            </p>
          </div>
        ))}
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-base font-bold md:text-lg">{formatCHF(total)}</p>
        </div>
      </div>
    </div>
  )
}

function Chiffre({ valeur, libelle }: { valeur: string; libelle: string }) {
  return (
    <span className="flex items-baseline gap-2">
      <span className="text-lg font-bold">{valeur}</span>
      <span className="text-xs text-muted-foreground">{libelle}</span>
    </span>
  )
}

/**
 * La suppression d'un diagnostic.
 *
 * Elle suivait les statistiques dans l'onglet Diagnostic. Elle les suit ici : ce
 * n'est pas un geste d'édition, c'est un geste d'administration du dossier, et il
 * n'a rien à faire sous la main de quelqu'un qui relève un ouvrage.
 */
export function ZoneDanger({ diagnosticId, onSupprime }: {
  diagnosticId: string
  onSupprime?: () => void
}) {
  const queryClient = useQueryClient()
  const [confirme, setConfirme] = useState(false)
  // Meme cle que les statistiques : react-query sert le cache, aucune requete de plus.
  const itemsQuery = useQuery({
    queryKey: ['diagnostic-items', diagnosticId],
    queryFn: () => api.diagnostics.listItems(diagnosticId),
  })
  const nombreOuvrages = itemsQuery.data?.items.length ?? 0

  const supprimer = useMutation({
    mutationFn: () => api.diagnostics.delete(diagnosticId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project'] })
      queryClient.invalidateQueries({ queryKey: ['diagnostic-items', diagnosticId] })
      onSupprime?.()
    },
  })

  return (
    <Card className="border-red-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-red-600">
          <AlertTriangle className="h-5 w-5" />Zone de danger
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <p className="text-sm font-medium">Supprimer ce diagnostic</p>
            <p className="text-xs text-muted-foreground">
              Supprime définitivement le diagnostic et ses {nombreOuvrages} ouvrage{nombreOuvrages !== 1 ? 's' : ''} (observations, photos, coûts).
              Le bâtiment, lui, n'est pas supprimé. Action irréversible.
            </p>
          </div>
          {!confirme ? (
            <Button
              variant="outline"
              onClick={() => setConfirme(true)}
              className="shrink-0 border-red-200 text-red-600 hover:bg-red-50"
            >
              <Trash2 className="mr-2 h-4 w-4" />Supprimer
            </Button>
          ) : (
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="ghost" onClick={() => setConfirme(false)} disabled={supprimer.isPending}>Annuler</Button>
              <Button
                onClick={() => supprimer.mutate()}
                disabled={supprimer.isPending}
                className="shrink-0 bg-red-600 text-white hover:bg-red-700"
              >
                {supprimer.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                Confirmer la suppression
              </Button>
            </div>
          )}
        </div>
        {supprimer.isError && (
          <p className="mt-2 text-xs text-red-600">
            {(supprimer.error as ApiError | null)?.message ?? 'Échec de la suppression.'}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
