import { useMemo, useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Loader2, AlertCircle, Search, Plus, Check, ImagePlus, X, ArrowRight, ScanSearch, Trash2, ChevronDown, RefreshCw,
} from 'lucide-react'
import {
  Button, Card, CardHeader, CardTitle, CardContent, Badge, Textarea, Input,
} from '@/components/ui'
import { useGuideMode, GUIDE_MODE_LABELS, type GuideMode } from '@/lib/use-guide-mode'
import { DiagnosticGuide } from '@/components/DiagnosticGuide'
import { stateLabels, stateColors, priorityColors, priorityDescriptions } from '@/data/mock'
import { formatCHF, cn } from '@/lib/utils'
import { groupItemsByVisitStep } from '@/lib/visit-steps'
import {
  STATE_PRIORITY, workForState, priceForState, computeQuantity, resolveQuantity, computeCost, computeCostFromPrice,
  buildQuantityContext, appliedUnitPrice, getMarketCoeff, priceBasisNote, priceToNumber, type QuantityContext,
} from '@/lib/diagnostic-auto'
import { api, ApiError } from '@/lib/api'
import { ProjectSectionsMenu } from '@/components/ProjectSectionsMenu'
import { CameraCapture } from '@/components/CameraCapture'
import { useIsMobile } from '@/lib/use-mobile'
import type {
  ApiCatalogItem, ApiDiagnosticItem, ElementState, Priority,
} from '@/lib/api-types'

/**
 * Réindexation des coûts au marché du jour.
 *
 * Les coûts sont figés à la saisie. Quand l'indice de construction change, ce
 * bouton les ramène tous au coefficient courant, sans ressaisir le dossier.
 * On montre l'effet avant de l'appliquer : un chiffrage qui bouge tout seul
 * derrière le dos de celui qui l'a remis n'est pas acceptable.
 */
function ReindexPanel({ diagnosticId }: { diagnosticId: string }) {
  const qc = useQueryClient()
  const [apercu, setApercu] = useState<Awaited<ReturnType<typeof api.diagnostics.reindex>> | null>(null)

  const simuler = useMutation({
    mutationFn: () => api.diagnostics.reindex(diagnosticId, true),
    onSuccess: setApercu,
  })
  const appliquer = useMutation({
    mutationFn: () => api.diagnostics.reindex(diagnosticId, false),
    onSuccess: () => {
      setApercu(null)
      qc.invalidateQueries({ queryKey: ['diagnostic', diagnosticId] })
      qc.invalidateQueries({ queryKey: ['diagnostic-items', diagnosticId] })
      qc.invalidateQueries({ queryKey: ['projects'] })
    },
  })

  if (!apercu) {
    return (
      <button
        onClick={() => simuler.mutate()}
        disabled={simuler.isPending}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        {simuler.isPending
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : <RefreshCw className="h-3.5 w-3.5" />}
        Actualiser les prix au marché du jour
      </button>
    )
  }

  const rien = apercu.items.updated === 0
  return (
    <div className="rounded-lg border bg-muted/40 p-3 text-xs space-y-2">
      {rien ? (
        <p>Les coûts sont déjà au coefficient du jour (×{apercu.market.coeff}). Rien à changer.</p>
      ) : (
        <>
          <p>
            {apercu.items.updated} poste{apercu.items.updated > 1 ? 's' : ''} sur {apercu.items.total} passerai
            {apercu.items.updated > 1 ? 'ent' : 't'} au coefficient ×{apercu.market.coeff}.
            {apercu.items.manual > 0 && ` ${apercu.items.manual} coût${apercu.items.manual > 1 ? 's' : ''} repris à la main ${apercu.items.manual > 1 ? 'restent' : 'reste'} inchangé${apercu.items.manual > 1 ? 's' : ''}.`}
          </p>
          <p className="tabular-nums">
            Total {formatCHF(apercu.before)} → <strong>{formatCHF(apercu.after)}</strong>{' '}
            <span className={apercu.delta >= 0 ? 'text-amber-600' : 'text-green-600'}>
              ({apercu.delta >= 0 ? '+' : ''}{formatCHF(apercu.delta)})
            </span>
          </p>
        </>
      )}
      <div className="flex gap-2">
        {!rien && (
          <Button size="sm" onClick={() => appliquer.mutate()} disabled={appliquer.isPending}>
            {appliquer.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Appliquer
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => setApercu(null)}>Fermer</Button>
      </div>
      <p className="text-[11px] text-muted-foreground border-t pt-2">{priceBasisNote()}</p>
    </div>
  )
}

// ---------- Helpers ----------

const STATES: ElementState[] = ['TRES_BON', 'BON', 'MOYEN', 'MAUVAIS']
const PRIORITIES: Priority[] = ['I', 'II', 'III']

// Année d'intervention par défaut (déduite de la priorité), utilisée comme placeholder tant
// que le diagnostiqueur ne l'a pas saisie. Doit rester en phase avec deriveInterventionYear() serveur.
function deriveInterventionYearClient(priority: Priority | null): number {
  const base = new Date().getFullYear()
  return priority === 'I' ? base : priority === 'II' ? base + 3 : priority === 'III' ? base + 7 : base + 5
}

/** Coût numérique à partir d'un champ Decimal stocké en string (ou null). */
const toNum = (v: string | null | undefined): number => (v ? Number(v) : 0)

/** Forme du cache de la liste d'éléments (queryKey ['diagnostic-items', id]). */
type ItemsData = { items: ApiDiagnosticItem[]; count: number }

// ---------- Component ----------

export function DiagnosticDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isMobile = useIsMobile()

  // ----- queries -----
  const diagQuery = useQuery({
    queryKey: ['diagnostic', id],
    queryFn: () => api.diagnostics.get(id!),
    enabled: !!id,
  })

  const itemsQuery = useQuery({
    queryKey: ['diagnostic-items', id],
    queryFn: () => api.diagnostics.listItems(id!),
    enabled: !!id,
  })

  const catalogQuery = useQuery({
    queryKey: ['cfc-items'],
    queryFn: () => api.cfc.items(),
    staleTime: 60 * 60 * 1000, // 1h — catalogue stable
  })

  // Projet (pour les surfaces qui servent au calcul auto des quantités).
  const projectId = diagQuery.data?.diagnostic.projectId
  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.projects.get(projectId!),
    enabled: !!projectId,
  })

  // Contexte de quantités : construit une seule fois, par la couche de calcul partagée.
  const qtyCtx = useMemo(() => buildQuantityContext(projectQuery.data?.project ?? {}), [projectQuery.data])

  // ----- local UI state -----
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [guideMode, setGuideMode] = useGuideMode()

  // ----- mutations -----
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['diagnostic', id] })
    queryClient.invalidateQueries({ queryKey: ['diagnostic-items', id] })
    queryClient.invalidateQueries({ queryKey: ['project'] }) // garde le compteur du résumé à jour
  }

  // Cache de la liste affichée : mis à jour de façon optimiste pour que la saisie
  // apparaisse instantanément (et fonctionne hors-ligne, la mutation partant en file).
  const itemsKey = ['diagnostic-items', id] as const
  const setItemsCache = (fn: (d: ItemsData) => ItemsData) =>
    queryClient.setQueryData<ItemsData>(itemsKey, (old) => (old ? fn(old) : old))
  const snapshotItems = () => queryClient.getQueryData<ItemsData>(itemsKey)

  const addItem = useMutation({
    mutationFn: (input: { catalog: ApiCatalogItem; state?: ElementState | null }) => {
      const { catalog, state } = input
      const quantity = computeQuantity(catalog, qtyCtx)
      // Ajout « non évalué » par défaut : ni état, ni coût tant que le diagnostiqueur n'a pas choisi.
      const cost = state ? computeCost(catalog, state, quantity) : undefined
      const work = state ? workForState(catalog, state) : null
      return api.diagnostics.createItem(id!, {
        cfcCode: catalog.cfcCode ?? 'N/A',
        cfcLabel: catalog.description,
        catalogItemId: catalog.id,
        state: state ?? null,
        priority: state ? STATE_PRIORITY[state] : null,
        works: work && work !== 'Néant' ? [work] : [],
        photos: [],
        area: quantity,                              // quantité auto (surfaces) conservée
        unit: catalog.unit ?? undefined,
        estimatedCost: (cost ?? undefined) as unknown as string | undefined,
      })
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: itemsKey })
      const prev = snapshotItems()
      const { catalog, state } = input
      const quantity = computeQuantity(catalog, qtyCtx)
      const cost = state ? computeCost(catalog, state, quantity) : undefined
      const work = state ? workForState(catalog, state) : null
      const now = new Date().toISOString()
      const temp: ApiDiagnosticItem = {
        id: `temp-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
        diagnosticId: id!,
        cfcCode: catalog.cfcCode ?? 'N/A',
        cfcLabel: catalog.description,
        catalogItemId: catalog.id,
        state: state ?? null,
        priority: state ? STATE_PRIORITY[state] : null,
        notes: null,
        works: work && work !== 'Néant' ? [work] : [],
        photos: [],
        area: quantity ?? null,
        unit: catalog.unit ?? null,
        yearInstalled: null,
        interventionYear: null,
        estimatedCost: cost != null ? String(cost) : null,
        improvement: null,
        improvementCost: null,
        norms: null,
        normsCost: null,
        createdAt: now,
        updatedAt: now,
      }
      setItemsCache((d) => ({ items: [...d.items, temp], count: d.count + 1 }))
      setSelectedItemId(temp.id)
      return { prev }
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) queryClient.setQueryData(itemsKey, ctx.prev) },
    onSuccess: (res) => {
      invalidateAll()
      setSelectedItemId(res.item.id)
    },
  })

  const updateItem = useMutation({
    mutationFn: (input: { itemId: string; data: Partial<ApiDiagnosticItem> }) =>
      api.diagnostics.updateItem(input.itemId, input.data),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: itemsKey })
      const prev = snapshotItems()
      setItemsCache((d) => ({
        ...d,
        items: d.items.map((it) => (it.id === input.itemId ? { ...it, ...input.data } : it)),
      }))
      return { prev }
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) queryClient.setQueryData(itemsKey, ctx.prev) },
    onSuccess: () => invalidateAll(),
  })

  const deleteItem = useMutation({
    mutationFn: (itemId: string) => api.diagnostics.deleteItem(itemId),
    onMutate: async (itemId) => {
      await queryClient.cancelQueries({ queryKey: itemsKey })
      const prev = snapshotItems()
      setItemsCache((d) => ({ items: d.items.filter((it) => it.id !== itemId), count: Math.max(0, d.count - 1) }))
      setSelectedItemId(null)
      return { prev }
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) queryClient.setQueryData(itemsKey, ctx.prev) },
    onSuccess: () => {
      invalidateAll()
      setSelectedItemId(null)
    },
  })

  // Suppression du diagnostic entier (depuis le menu Sections).
  const deleteDiagnostic = useMutation({
    mutationFn: () => api.diagnostics.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      navigate(projectId ? `/app/projects/${projectId}` : '/app/dashboard')
    },
  })
  const handleDeleteDiagnostic = () => {
    if (window.confirm('Supprimer définitivement ce diagnostic et tous ses éléments ? Le bâtiment ne sera pas supprimé.')) {
      deleteDiagnostic.mutate()
    }
  }

  // ----- derived data -----
  // Référence stable : `?? []` produirait un tableau neuf à chaque rendu et casserait les mémorisations en aval.
  const items = useMemo(() => itemsQuery.data?.items ?? [], [itemsQuery.data])
  const catalogItems = useMemo(() => catalogQuery.data?.items ?? [], [catalogQuery.data])

  // map for fast lookup
  const itemsByCatalogId = useMemo(() => {
    const m = new Map<number, ApiDiagnosticItem>()
    for (const it of items) {
      if (it.catalogItemId != null) m.set(it.catalogItemId, it)
    }
    return m
  }, [items])

  // groupe le catalogue par catégorie (ordre de visite Feuil2), avec recherche
  const grouped = useMemo(() => {
    const q = search.toLowerCase().trim()
    const filtered = q
      ? catalogItems.filter(c =>
          c.description.toLowerCase().includes(q)
          || (c.cfcCode?.toLowerCase().includes(q) ?? false)
          || (c.category?.toLowerCase().includes(q) ?? false))
      : catalogItems
    return groupItemsByVisitStep(filtered)
  }, [catalogItems, search])

  // Parcours de visite : une étape à la fois, comme sur le terrain. null = tout voir.
  const [etape, setEtape] = useState<number | null>(null)
  const etapesVisibles = etape == null ? grouped : grouped.filter(g => g.step === etape)
  const rangEtape = grouped.findIndex(g => g.step === etape)
  const etapeSuivante = rangEtape >= 0 ? grouped[rangEtape + 1] ?? null : null

  // selected
  const selectedDiagItem = items.find(i => i.id === selectedItemId) ?? null
  const selectedCatalog = selectedDiagItem?.catalogItemId
    ? catalogItems.find(c => c.id === selectedDiagItem.catalogItemId) ?? null
    : null

  // Pas d'auto-sélection : au chargement, l'éditeur reste vide tant qu'on ne
  // choisit pas un élément (évite de retomber toujours sur le premier).

  // ----- totals -----
  const totalCost = items.reduce((s, i) => s + toNum(i.estimatedCost), 0)
  const costByPriority: Record<Priority, number> = {
    I:   items.filter(i => i.priority === 'I').reduce((s, i) => s + toNum(i.estimatedCost), 0),
    II:  items.filter(i => i.priority === 'II').reduce((s, i) => s + toNum(i.estimatedCost), 0),
    III: items.filter(i => i.priority === 'III').reduce((s, i) => s + toNum(i.estimatedCost), 0),
  }

  // ----- loading / error states -----
  if (diagQuery.isLoading || itemsQuery.isLoading || catalogQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />Chargement…
      </div>
    )
  }
  if (diagQuery.isError || !diagQuery.data) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-red-700">
            {(diagQuery.error as ApiError | null)?.message ?? 'Diagnostic introuvable'}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="h-[calc(100vh-7rem)] flex flex-col gap-4">
      {/* Header (masqué sur mobile pendant l'édition d'un élément) */}
      <div className={cn('space-y-3 shrink-0', isMobile && selectedItemId && 'hidden')}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5 text-muted-foreground hover:text-foreground" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate">Diagnostic</h1>
            <p className="text-sm text-muted-foreground truncate">
              {items.length} élément{items.length !== 1 ? 's' : ''} diagnostiqué{items.length !== 1 ? 's' : ''}
            </p>
          </div>
          {projectId && !isMobile && <ProjectSectionsMenu projectId={projectId} onDeleteDiagnostic={handleDeleteDiagnostic} />}
        </div>
        <div className="flex gap-4 text-sm overflow-x-auto pb-1">
          {PRIORITIES.map(p => (
            <div key={p} className="text-center shrink-0">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${priorityColors[p]}`}>{p}</span>
              <p className="font-semibold mt-1">{formatCHF(costByPriority[p])}</p>
            </div>
          ))}
          <div className="text-center pl-4 border-l shrink-0">
            <span className="text-xs text-muted-foreground">Total</span>
            <p className="text-lg font-bold">{formatCHF(totalCost)}</p>
          </div>
        </div>

        <ReindexPanel diagnosticId={id!} />

        <GuideModeToggle mode={guideMode} onChange={setGuideMode} />
      </div>

      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
        {/* ===== Catalogue : plein écran sur mobile (masqué pendant l'édition), colonne à gauche sur desktop ===== */}
        <Card className={cn(
          'w-full overflow-hidden flex flex-col',
          isMobile ? (selectedItemId ? 'hidden' : 'flex-1 min-h-0') : 'lg:w-96 shrink-0',
        )}>
          <CardHeader className="py-3 px-4 shrink-0 border-b">
            <CardTitle className="text-sm">Catalogue CFC</CardTitle>
            <div className="relative mt-2">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="pl-7 h-8 text-sm"
                placeholder="Rechercher un élément…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="px-2 py-0 pb-4 overflow-y-auto flex-1">
            {grouped.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Aucun résultat</p>
            )}

            {/* Étapes de la visite : cliquer en isole une, comme un parcours guidé. */}
            {grouped.length > 1 && (
              <div className="no-scrollbar -mx-2 mb-2 flex gap-1.5 overflow-x-auto px-2 pb-1">
                <button
                  onClick={() => setEtape(null)}
                  className={cn('shrink-0 rounded-full border px-2.5 py-1 text-[11px]',
                    etape == null ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground')}
                >Tout</button>
                {grouped.map(g => (
                  <button
                    key={g.label}
                    onClick={() => setEtape(g.step)}
                    className={cn('shrink-0 rounded-full border px-2.5 py-1 text-[11px]',
                      etape === g.step ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground')}
                  >{g.label}</button>
                ))}
              </div>
            )}

            {etapesVisibles.map((etapeGroup) => (
              <div key={etapeGroup.label}>
                {etape == null && (
                  <div className="px-2 pt-2 pb-1 text-[11px] font-semibold text-foreground">
                    {etapeGroup.label} <span className="font-normal text-muted-foreground">({etapeGroup.count})</span>
                  </div>
                )}
                {etapeGroup.categories.map((group) => (
              <div key={group.category} className="mb-3">
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sticky top-0 bg-card">
                  {group.category}
                </div>
                {group.items.map(c => {
                  const existing = itemsByCatalogId.get(c.id)
                  const isAdded = !!existing
                  const isSelected = existing?.id === selectedItemId
                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        if (existing) setSelectedItemId(existing.id)
                        else addItem.mutate({ catalog: c })
                      }}
                      disabled={addItem.isPending}
                      className={cn(
                        'flex items-start gap-2 w-full text-left rounded hover:bg-muted/50 transition-colors',
                        isMobile ? 'px-3 py-2.5 text-sm' : 'px-2 py-1.5 text-xs',
                        isSelected && 'bg-primary/10 text-primary',
                      )}
                    >
                      <span className={cn(
                        'h-2 w-2 rounded-full shrink-0 mt-1.5',
                        isAdded ? 'bg-green-500' : 'bg-gray-300',
                      )} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          {c.cfcCode && <span className="font-mono text-muted-foreground">{c.cfcCode}</span>}
                          <span className="truncate font-medium">{c.description}</span>
                        </div>
                        {existing && (
                          <div className="flex gap-1 mt-0.5">
                            {existing.state ? (
                              <>
                                <span className={cn('text-[10px] px-1.5 rounded text-white', stateColors[existing.state])}>{stateLabels[existing.state]}</span>
                                {existing.priority && <span className={cn('text-[10px] px-1.5 rounded', priorityColors[existing.priority])}>{existing.priority}</span>}
                              </>
                            ) : (
                              <span className="text-[10px] px-1.5 rounded bg-muted text-muted-foreground">À évaluer</span>
                            )}
                          </div>
                        )}
                      </div>
                      {!isAdded && <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                      {isAdded && !isSelected && <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />}
                    </button>
                  )
                })}
              </div>
                ))}
              </div>
            ))}

            {/* Étape terminée : on passe à la suivante sans revenir chercher dans la liste. */}
            {etape != null && etapeSuivante && (
              <button
                onClick={() => setEtape(etapeSuivante.step)}
                className="mt-1 flex w-full items-center justify-between rounded-lg border px-3 py-2 text-xs hover:bg-muted/50"
              >
                <span className="text-muted-foreground">Étape suivante</span>
                <span className="flex items-center gap-1 font-medium">
                  {etapeSuivante.label}<ArrowRight className="h-3.5 w-3.5" />
                </span>
              </button>
            )}
          </CardContent>
        </Card>

        {/* ===== Éditeur : plein écran sur mobile (visible quand un élément est sélectionné) ===== */}
        <div className={cn('flex-1 overflow-y-auto overflow-x-hidden min-w-0', isMobile && !selectedItemId && 'hidden')}>
          {selectedDiagItem ? (
            <ItemEditor
              item={selectedDiagItem}
              catalog={selectedCatalog}
              qtyCtx={qtyCtx}
              mobile={isMobile}
              guideMode={guideMode}
              projectId={projectId}
              onBack={() => setSelectedItemId(null)}
              onUpdate={(data) => updateItem.mutate({ itemId: selectedDiagItem.id, data })}
              onDelete={() => {
                // L'élément peut porter des photos, des notes de terrain, une quantité
                // relevée ou un coût forcé : on ne supprime pas tout cela en un clic.
                const it = selectedDiagItem
                const aPerdre = [
                  it.photos.length > 0 && `${it.photos.length} photo${it.photos.length > 1 ? 's' : ''}`,
                  it.notes && 'des notes de terrain',
                  it.quantityManual && 'une quantité relevée',
                  it.costManual && 'un coût forcé',
                ].filter(Boolean) as string[]
                if (aPerdre.length > 0 && !window.confirm(`Retirer « ${it.cfcLabel} » ? Vous perdez ${aPerdre.join(', ')}.`)) return
                deleteItem.mutate(it.id)
              }}
              isMutating={updateItem.isPending}
              isDeleting={deleteItem.isPending}
            />
          ) : (
            !isMobile && (
              <Card>
                <CardContent className="py-16 text-center">
                  <p className="text-muted-foreground">
                    Cliquez sur un élément du catalogue à gauche pour l'ajouter au diagnostic.
                  </p>
                </CardContent>
              </Card>
            )
          )}
        </div>
      </div>
    </div>
  )
}

// ---------- ItemEditor ----------

/** Réduit une image (photo terrain) en data URL JPEG compacte (sous la limite API). */
function downscaleImage(file: File, maxDim = 1280, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('canvas'))
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = reject
    img.src = url
  })
}

/** En-tête d'étape mobile : pastille numérotée + libellé, pour guider pas à pas. */
function StepHeader({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{n}</span>
      <p className="text-sm font-semibold">{label}</p>
    </div>
  )
}

interface ItemEditorProps {
  item: ApiDiagnosticItem
  catalog: ApiCatalogItem | null
  qtyCtx: QuantityContext
  guideMode: GuideMode
  projectId?: string
  onUpdate: (data: Partial<ApiDiagnosticItem>) => void
  onDelete: () => void
  isMutating: boolean
  isDeleting: boolean
  mobile?: boolean
  onBack?: () => void
}

/** Sélecteur d'état guidé : chaque état avec sa description (Feuille 3). Fallback = boutons simples. */
function StateGuide({ item, catalog, onApply, isMutating }: {
  item: ApiDiagnosticItem; catalog: ApiCatalogItem | null
  onApply: (s: ElementState) => void; isMutating: boolean
}) {
  const descOf = (s: ElementState) => s === 'TRES_BON' ? catalog?.descTbe : s === 'BON' ? catalog?.descBon : s === 'MOYEN' ? catalog?.descMoyen : catalog?.descMauvais
  const hasDesc = !!(catalog && (catalog.descTbe || catalog.descBon || catalog.descMoyen || catalog.descMauvais))
  if (!hasDesc) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {STATES.map(state => (
          <button key={state} onClick={() => onApply(state)} disabled={isMutating}
            className={cn('py-3 rounded-xl text-sm font-medium border-2 transition-colors',
              item.state === state ? `${stateColors[state]} text-white border-transparent` : 'bg-background border-muted hover:border-primary/30')}>
            {stateLabels[state]}
          </button>
        ))}
      </div>
    )
  }
  return (
    <div className="space-y-2">
      {STATES.map(state => {
        const desc = descOf(state)
        const selected = item.state === state
        return (
          <button key={state} onClick={() => onApply(state)} disabled={isMutating}
            className={cn('w-full rounded-xl border-2 p-3 text-left transition-colors',
              selected ? `${stateColors[state]} border-transparent` : 'bg-background border-muted hover:border-primary/30')}>
            <div className="flex items-center gap-2">
              <span className={cn('inline-block h-2.5 w-2.5 rounded-full', selected ? 'bg-white' : stateColors[state])} />
              <span className={cn('text-sm font-semibold', selected && 'text-white')}>{stateLabels[state]}</span>
            </div>
            {desc && <p className={cn('mt-1 text-xs leading-snug', selected ? 'text-white/90' : 'text-muted-foreground')}>{desc}</p>}
          </button>
        )
      })}
    </div>
  )
}

/** Saisie guidée « ajout d'isolation d'épaisseur à définir » : épaisseur (cm) + prix au m² -> coût = surface × prix. */
function InsulationInputs({ value, quantity, onChange }: {
  value: string | null; quantity: number | undefined
  onChange: (work: string | null, cost: number | null) => void
}) {
  const ep = value?.match(/([\d.,]+)\s*cm/i)?.[1] ?? ''
  const prix = value?.match(/([\d.,]+)\s*CHF\s*\/\s*m/i)?.[1] ?? ''
  const surface = quantity ?? 0
  const n = (s: string) => { const v = Number(String(s).replace(',', '.')); return Number.isFinite(v) ? v : NaN }
  const compose = (epv: string, prixv: string) => {
    const p = n(prixv)
    const c = Number.isFinite(p) && surface > 0 ? Math.round(p * surface) : null
    const text = `Ajout d'isolation${epv ? `, épaisseur ${epv} cm` : ''}${prixv ? `, à ${prixv} CHF/m²` : ''}`
    onChange(text, c)
  }
  const p = n(prix)
  const preview = Number.isFinite(p) && surface > 0 ? Math.round(p * surface) : null
  return (
    <div className="mt-2 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Épaisseur d'isolation (cm)</label>
          <Input type="number" step="0.5" defaultValue={ep} placeholder="ex. 16" onBlur={(e) => compose(e.target.value, prix)} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Prix (CHF/m²)</label>
          <Input type="number" defaultValue={prix} placeholder="ex. 120" onBlur={(e) => compose(ep, e.target.value)} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Surface {surface > 0 ? `${surface} m²` : '— (à saisir sur l’élément)'}{preview != null ? ` → coût estimé ${preview.toLocaleString('fr-CH')} CHF` : ''}
      </p>
    </div>
  )
}

/** Un bloc d'enveloppe (Amélioration ou Remise aux normes) : retenable, éditable, chiffré. */
function PerfBlock({ label, catalogWork, catalogPrice, value, cost, quantity, onChange, isMutating }: {
  label: string; catalogWork: string | null; catalogPrice: string | null
  value: string | null; cost: string | null; quantity: number | undefined
  onChange: (work: string | null, cost: number | null) => void; isMutating: boolean
}) {
  const has = !!catalogWork && catalogWork !== 'Néant'
  const retained = value != null
  if (!has && !retained) return null
  const costNum = cost != null ? Number(cost) : null
  const isInsulation = /isolation|isolant|épaisseur/i.test(`${catalogWork ?? ''} ${value ?? ''}`)
  const toggle = () => {
    if (retained) onChange(null, null)
    else onChange(has ? catalogWork! : '', computeCostFromPrice(catalogPrice, quantity) ?? null)
  }
  return (
    <div className={cn('rounded-lg border p-3', retained ? 'border-primary/30 bg-primary/[0.03]' : 'bg-muted/10')}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{label}</p>
        <button type="button" onClick={toggle} disabled={isMutating}
          className={cn('rounded-full px-3 py-1 text-xs font-semibold transition-colors',
            retained ? 'bg-primary/10 text-primary hover:bg-primary/15' : 'bg-muted text-muted-foreground hover:bg-muted/70')}>
          {retained ? 'Retenu · retirer' : 'Ajouter'}
        </button>
      </div>
      {!retained && has && <p className="mt-1 text-xs text-muted-foreground">{catalogWork}{catalogPrice ? ` · ${catalogPrice}` : ''}</p>}
      {retained && (isInsulation
        ? <InsulationInputs value={value} quantity={quantity} onChange={onChange} />
        : (
          <div className="mt-2 space-y-2">
            <Textarea key={`w-${label}-${value === '' ? 'e' : 'f'}`} defaultValue={value ?? ''} rows={2} placeholder="Travaux à réaliser…"
              onBlur={(e) => { if ((e.target.value || '') !== (value ?? '')) onChange(e.target.value || '', costNum) }} />
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-xs text-muted-foreground">Coût (CHF)</span>
              <Input type="number" className="w-36" key={`c-${label}-${cost}`} defaultValue={cost ?? ''}
                onBlur={(e) => { const v = e.target.value ? Number(e.target.value) : null; if (v !== costNum) onChange(value ?? '', v) }} />
            </div>
          </div>
        ))}
    </div>
  )
}

/** Enveloppes distinctes Amélioration + Remise aux normes (dimension « performance » du diag). */
function PerformanceEnvelopes({ item, catalog, quantity, onUpdate, isMutating }: {
  item: ApiDiagnosticItem; catalog: ApiCatalogItem | null; quantity: number | undefined
  onUpdate: (data: Partial<ApiDiagnosticItem>) => void; isMutating: boolean
}) {
  const anyImp = (!!catalog?.workImprovement && catalog.workImprovement !== 'Néant') || item.improvement != null
  const anyNorms = (!!catalog?.workNorms && catalog.workNorms !== 'Néant') || item.norms != null
  if (!anyImp && !anyNorms) return null
  return (
    <div className="space-y-2.5">
      <p className="text-sm font-medium">Amélioration &amp; remise aux normes</p>
      <PerfBlock key={`imp-${item.id}`} label="Amélioration" catalogWork={catalog?.workImprovement ?? null} catalogPrice={catalog?.priceImprovement ?? null}
        value={item.improvement} cost={item.improvementCost} quantity={quantity} isMutating={isMutating}
        onChange={(w, c) => onUpdate({ improvement: w, improvementCost: (c as unknown as string | null) })} />
      <PerfBlock key={`norm-${item.id}`} label="Remise aux normes" catalogWork={catalog?.workNorms ?? null} catalogPrice={catalog?.priceNorms ?? null}
        value={item.norms} cost={item.normsCost} quantity={quantity} isMutating={isMutating}
        onChange={(w, c) => onUpdate({ norms: w, normsCost: (c as unknown as string | null) })} />
    </div>
  )
}

function ItemEditor({ item, catalog, qtyCtx, guideMode, projectId, onUpdate, onDelete, isMutating, isDeleting, mobile, onBack }: ItemEditorProps) {
  const [notes, setNotes] = useState(item.notes ?? '')
  const [showManual, setShowManual] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false) // options expertes repliées (mobile)
  const [viewer, setViewer] = useState<string | null>(null) // photo affichée en grand

  // Si on change d'item, reset l'état local
  useEffect(() => { setNotes(item.notes ?? ''); setShowManual(false); setShowAdvanced(false) }, [item.id, item.notes])

  // Applique une note suggérée par le guide (ajoute à la suite si une note existe déjà).
  const applyGuideNote = (n: string) => {
    const merged = notes.trim() ? `${notes.trim()}\n${n}` : n
    setNotes(merged)
    onUpdate({ notes: merged })
  }

  const suggestedPrice = catalog && item.state ? priceForState(catalog, item.state) : null
  const appliedPrice = appliedUnitPrice(suggestedPrice)
  // Quantité dérivée du dossier + d'où elle vient (pour l'expliquer et la justifier).
  const qtyResolution = useMemo(
    () => (catalog ? resolveQuantity(catalog, qtyCtx) : { quantity: undefined, origin: 'manuelle' as const, basis: null }),
    [catalog, qtyCtx],
  )
  const autoQty = qtyResolution.quantity
  /** Unité affichée à côté d'une quantité (« CHF/m² fenêtres » -> « m² fenêtres »). */
  const qtyUnit = catalog?.unit?.replace(/^CHF\s*\/?\s*/i, '') ?? ''
  const [qtyError, setQtyError] = useState<string | null>(null)
  /** Un prix au mètre courant appelle une longueur, pas une « quantité ». */
  const estLongueur = /ml$|metre|mètre/i.test(catalog?.unit ?? '')
  /**
   * Pourquoi un coût reste vide. Le tableau de référence ne chiffre que les états qui
   * appellent des travaux : 81 items sur 102 n'ont aucun prix en « Bon », et la quasi
   * totalité n'en a pas en « Très bon ». Un écran vide laissait croire à une panne.
   */
  const raisonCoutVide = !item.state
    ? 'Choisissez un état'
    : !catalog
      ? 'Élément hors catalogue : coût à saisir'
      : !suggestedPrice
        ? `Aucun travail chiffré pour l'état « ${stateLabels[item.state]} »`
        : priceToNumber(suggestedPrice) == null
          ? `Prix au catalogue non numérique (${suggestedPrice})`
          : item.area == null
            ? 'Quantité à saisir'
            : '—'


  // Synchronisation de la quantité automatique. Corriger le périmètre, les étages ou le
  // type de toiture du dossier doit se répercuter sur les éléments qui en dépendent.
  // Une quantité reprise à la main est verrouillée et n'est jamais touchée ici.
  useEffect(() => {
    if (!catalog || item.quantityManual) return
    if (autoQty == null || autoQty === item.area) return
    const patch: Partial<ApiDiagnosticItem> = { area: autoQty }
    if (!item.costManual && item.state) {
      patch.estimatedCost = (computeCost(catalog, item.state, autoQty) ?? 0) as unknown as string
      patch.costIndex = getMarketCoeff()
    }
    onUpdate(patch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, autoQty, item.quantityManual])

  // Changer l'état recalcule automatiquement travaux, priorité et coût.
  const applyState = (state: ElementState) => {
    const quantity = item.area ?? autoQty ?? undefined
    const patch: Partial<ApiDiagnosticItem> = { state, priority: STATE_PRIORITY[state] }
    if (quantity != null && item.area == null) patch.area = quantity
    if (catalog) {
      const work = workForState(catalog, state)
      patch.works = work && work !== 'Néant' ? [work as string] : []
      // Coût = prix de l'état × quantité (indépendant du texte de travail ; états sans prix -> coût 0).
      // Un coût repris à la main n'est jamais écrasé.
      if (!item.costManual) {
        const cost = computeCost(catalog, state, quantity)
        patch.estimatedCost = (cost ?? 0) as unknown as string
        patch.costIndex = getMarketCoeff()
      }
    }
    onUpdate(patch)
  }

  // Changer la quantité recalcule le coût, et verrouille la quantité : le dossier peut
  // ensuite évoluer (périmètre, étages…) sans écraser ce que le terrain a relevé.
  const applyQuantity = (v: number | undefined, manual = true) => {
    const patch: Partial<ApiDiagnosticItem> = { area: v ?? null, quantityManual: manual }
    if (!item.costManual) {
      const cost = item.state ? computeCost(catalog, item.state, v) : undefined
      patch.estimatedCost = (cost ?? null) as unknown as string | null
      patch.costIndex = getMarketCoeff()
    }
    onUpdate(patch)
  }

  /** Rend la quantité au calcul automatique (et le coût avec, s'il n'est pas forcé). */
  const restoreAutoQuantity = () => {
    const cost = item.state ? computeCost(catalog, item.state, autoQty) : undefined
    onUpdate({
      area: autoQty ?? null,
      quantityManual: false,
      costManual: false,
      estimatedCost: (cost ?? null) as unknown as string | null,
      costIndex: getMarketCoeff(),
    })
  }

  /** Coût repris à la main : verrouillé jusqu'à ce qu'on le rende au calcul. */
  // Coût forcé à la main : pas d'indice, il ne sera pas réindexé.
  const applyCost = (v: number | undefined) => onUpdate({
    estimatedCost: (v ?? null) as unknown as string | null,
    costManual: v != null,
    costIndex: v != null ? null : getMarketCoeff(),
  })

  // Part (%) d'une surface partagée : commande ponctuelle appliquée à la quantité
  // automatique. Rien n'est stocké, et la valeur n'est jamais recalculée depuis la
  // quantité (c'est ce qui affichait « 288 % » après une correction du périmètre).
  const applyPercent = (pct: number | undefined) => {
    if (autoQty == null || pct == null || pct <= 0) return
    const area = Math.round((autoQty * pct) / 100)
    applyQuantity(area > 0 ? area : undefined)
  }

  const addPhotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const urls = await Promise.all(Array.from(files).map(f => downscaleImage(f)))
    onUpdate({ photos: [...item.photos, ...urls] })
  }
  const removePhoto = (i: number) => onUpdate({ photos: item.photos.filter((_, idx) => idx !== i) })

  // Panneau du guide IA (rendu identique mobile / desktop), masqué si mode "off".
  const guide = guideMode !== 'off'
    ? (
      <DiagnosticGuide
        photos={item.photos}
        item={{ cfcCode: item.cfcCode, cfcLabel: item.cfcLabel, state: item.state }}
        projectId={projectId}
        mode={guideMode}
        onApplyState={applyState}
        onApplyNote={applyGuideNote}
      />
    )
    : null

  // ----- Rendu mobile : flux terrain ultra simple (photo -> état -> suivant) -----
  if (mobile) {
    const anyImp = (!!catalog?.workImprovement && catalog.workImprovement !== 'Néant') || item.improvement != null
    const anyNorms = (!!catalog?.workNorms && catalog.workNorms !== 'Néant') || item.norms != null
    return (
      <div className="flex flex-col h-full relative">
        <div className="flex items-center gap-2 mb-3 shrink-0">
          <button onClick={onBack} className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground shrink-0">
            <ArrowLeft className="h-5 w-5" />Retour
          </button>
          <div className="flex-1 min-w-0 text-center">
            <p className="text-base font-semibold truncate leading-tight">{item.cfcLabel}</p>
            {catalog?.category && <p className="text-[11px] text-muted-foreground truncate">{catalog.category}</p>}
          </div>
          <button onClick={onDelete} disabled={isDeleting} title="Retirer cet élément" className="shrink-0 rounded-lg p-2 text-red-600 hover:bg-red-50">
            {isDeleting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Trash2 className="h-5 w-5" />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-6 pb-28 px-0.5">
          {/* Étape 1 — photo */}
          <section className="space-y-3">
            <StepHeader n={1} label="Prendre une photo" />
            <CameraCapture onCapture={(url) => onUpdate({ photos: [...item.photos, url] })} />
            {item.photos.length > 0 && (
              <div className="flex gap-2 overflow-x-auto -mx-1 px-1">
                {item.photos.map((src, i) => (
                  <div key={i} className="relative h-16 w-16 rounded-lg overflow-hidden border shrink-0">
                    <button type="button" onClick={() => setViewer(src)} className="block h-full w-full">
                      <img src={src} alt="" className="h-full w-full object-cover" />
                    </button>
                    <button onClick={() => removePhoto(i)} className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded p-0.5 z-10">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Aide IA (facultative) */}
          {guide}

          {/* Étape 2 — état : le seul vrai choix */}
          <section className="space-y-3">
            <StepHeader n={2} label="Évaluer l'état" />
            <StateGuide item={item} catalog={catalog} onApply={applyState} isMutating={isMutating} />
          </section>

          {/* Étape 3 — métré, seulement quand il ne se déduit pas du bâtiment.
              Sans ce champ, un élément facturé au mètre (garde-corps, modénature) ou à
              la pièce restait sans quantité, donc sans coût, et rien sur l'écran mobile
              ne permettait de le saisir. */}
          {qtyResolution.origin === 'manuelle' && (
            <section className="space-y-3">
              <StepHeader n={3} label={estLongueur ? 'Mesurer la longueur' : 'Saisir la quantité'} />
              <div className="flex items-center gap-2">
                <Input
                  type="number" inputMode="decimal" min="1" className="w-32 text-lg"
                  key={`mq-${item.id}-${item.area}`}
                  defaultValue={item.area ?? ''}
                  placeholder={estLongueur ? 'ex. 24' : 'ex. 4'}
                  onBlur={(e) => {
                    const raw = e.target.value.trim()
                    const v = raw ? Number(raw) : undefined
                    if (raw && (!isFinite(v!) || v! <= 0)) { setQtyError('Valeur minimale : 1'); e.target.value = String(item.area ?? ''); return }
                    setQtyError(null)
                    if (v !== (item.area ?? undefined)) applyQuantity(v)
                  }}
                />
                <span className="text-sm font-medium text-muted-foreground">{qtyUnit || 'unités'}</span>
              </div>
              {qtyError
                ? <p className="text-xs text-red-600">{qtyError}</p>
                : <p className="text-xs text-muted-foreground">{qtyResolution.reason ?? 'Ne se déduit pas des dimensions du bâtiment.'}</p>}
            </section>
          )}

          {/* Résultat automatique (priorité + coût) */}
          <div className="rounded-xl border bg-muted/20 p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Priorité · coût (auto)</p>
              <div className="flex items-center gap-2 mt-1">
                {item.priority
                  ? <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold', priorityColors[item.priority])}>P{item.priority}</span>
                  : <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Non évalué</span>}
                {item.works.length > 0 && <span className="text-xs text-muted-foreground truncate">{item.works.join(' · ')}</span>}
              </div>
            </div>
            <p className="text-lg font-bold text-primary shrink-0">{item.estimatedCost ? formatCHF(toNum(item.estimatedCost)) : '—'}</p>
          </div>

          {/* Options avancées repliées : l'écran reste simple par défaut */}
          <div className="border-t pt-3">
            <button type="button" onClick={() => setShowAdvanced(v => !v)} className="flex w-full items-center justify-between text-sm font-medium text-muted-foreground">
              <span>Options avancées{(anyImp || anyNorms) ? ' · amélioration, normes, notes' : ' · notes'}</span>
              <ChevronDown className={cn('h-4 w-4 transition-transform', showAdvanced && 'rotate-180')} />
            </button>
            {showAdvanced && (
              <div className="mt-4 space-y-5">
                <PerformanceEnvelopes item={item} catalog={catalog} quantity={item.area ?? autoQty ?? undefined} onUpdate={onUpdate} isMutating={isMutating} />
                <div>
                  <p className="text-sm font-medium mb-2">Notes</p>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    onBlur={() => { if (notes !== (item.notes ?? '')) onUpdate({ notes: notes || null }) }}
                    placeholder="Observations terrain…"
                    rows={2}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bouton posé au ras du bas : les 96 px d'écart d'avant servaient à dégager la
            barre de navigation, qui n'est plus affichée dans l'éditeur. Il ne reste que
            la marge de sécurité du bord d'écran (barre d'accueil iOS). */}
        <button
          type="button"
          onClick={onBack}
          className="absolute bottom-[calc(env(safe-area-inset-bottom)+1rem)] right-4 flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg active:scale-95 transition-transform z-10"
        >
          Suivant <ArrowRight className="h-5 w-5" />
        </button>

        {viewer && (
          <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setViewer(null)}>
            <img src={viewer} alt="" className="max-h-full max-w-full object-contain rounded-lg" />
            <button
              type="button"
              onClick={() => setViewer(null)}
              aria-label="Fermer"
              className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/20 text-white flex items-center justify-center"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="font-mono text-lg text-muted-foreground">{item.cfcCode}</span>
            <CardTitle>{item.cfcLabel}</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onDelete}
            disabled={isDeleting}
            title="Retirer cet élément du diagnostic"
            className="shrink-0 text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            {isDeleting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1.5 h-4 w-4" />}
            Retirer
          </Button>
        </div>
        {catalog?.category && (
          <Badge variant="outline" className="w-fit mt-1">{catalog.category}</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 1. État — le seul vrai choix du diagnostiqueur */}
        <div>
          <p className="text-sm font-medium mb-3">État constaté</p>
          <StateGuide item={item} catalog={catalog} onApply={applyState} isMutating={isMutating} />
        </div>

        {/* 2. Photos */}
        <div>
          <p className="text-sm font-medium mb-2">Photos</p>
          <div className="flex flex-wrap gap-2">
            {item.photos.map((src, i) => (
              <div key={i} className="relative h-20 w-20 rounded-lg overflow-hidden border group">
                <img src={src} alt="" className="h-full w-full object-cover" />
                <button
                  onClick={() => removePhoto(i)}
                  className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <label className="h-20 w-20 rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-primary/40 text-muted-foreground">
              <ImagePlus className="h-5 w-5" />
              <span className="text-[10px]">Ajouter</span>
              <input type="file" accept="image/*" capture="environment" multiple className="hidden"
                onChange={(e) => { addPhotos(e.target.files); e.target.value = '' }} />
            </label>
          </div>
        </div>

        {/* Guide IA */}
        {guide}

        {/* 3. Résultat automatique (travaux, priorité, coût) */}
        <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">
                {item.quantityManual || item.costManual ? 'Repris à la main' : 'Calculé automatiquement'}
              </p>
              {item.quantityManual && <Badge variant="outline" className="text-[10px]">Quantité saisie</Badge>}
              {item.costManual && <Badge variant="outline" className="text-[10px]">Coût forcé</Badge>}
            </div>
            <div className="flex items-center gap-3">
              {(item.quantityManual || item.costManual) && (
                <button
                  onClick={() => { setQtyError(null); restoreAutoQuantity() }}
                  className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                >
                  Rétablir le calcul
                </button>
              )}
              <button onClick={() => setShowManual(v => !v)} className="text-xs text-primary hover:underline">
                {showManual ? 'Masquer' : 'Modifier'}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Priorité</p>
              {item.priority
                ? <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold mt-0.5', priorityColors[item.priority])}>{item.priority}</span>
                : <span className="mt-0.5 inline-block text-xs font-medium text-muted-foreground">—</span>}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Quantité</p>
              {item.area != null ? (
                <p className="font-semibold mt-0.5">{item.area} {catalog?.unit?.replace(/^CHF\s*\/?\s*/i, '') ?? ''}</p>
              ) : (
                <p className="font-medium text-amber-600 mt-0.5 text-xs">à saisir</p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Coût estimé</p>
              {item.estimatedCost && toNum(item.estimatedCost) > 0 ? (
                <p className="font-semibold text-primary mt-0.5">{formatCHF(toNum(item.estimatedCost))}</p>
              ) : (
                /* Un coût vide n'est pas une panne : le catalogue ne chiffre pas tous les
                   états, et certaines quantités ne se déduisent pas. On dit lequel des deux. */
                <p className="font-medium text-amber-700 mt-0.5 text-xs">{raisonCoutVide}</p>
              )}
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Travaux</p>
            <p className="text-sm mt-0.5">{item.works.length > 0 ? item.works.join(' · ') : '—'}</p>
          </div>

          {/* Réglages manuels (repliés par défaut) */}
          {showManual && (
            <div className="pt-3 border-t space-y-4">
              <div>
                <p className="text-xs font-medium mb-2">Forcer la priorité</p>
                <div className="flex gap-2">
                  {PRIORITIES.map(p => (
                    <button
                      key={p}
                      onClick={() => onUpdate({ priority: p })}
                      disabled={isMutating}
                      className={cn(
                        'px-4 py-2 rounded-lg text-sm font-bold border-2 transition-colors',
                        item.priority === p ? `${priorityColors[p]} border-transparent` : 'bg-background border-muted hover:border-primary/30',
                      )}
                    >Priorité {p}</button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">{item.priority ? priorityDescriptions[item.priority] : 'Non évalué'}</p>
              </div>

              {/* Part d'une surface partagée : commande ponctuelle, rien n'est mémorisé ici. */}
              {autoQty != null && (
                <div>
                  <p className="text-xs font-medium mb-1">
                    Appliquer une part de {qtyResolution.basis ?? 'la quantité calculée'} · {autoQty} {qtyUnit} au total
                  </p>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number" min="1" max="100" className="w-24" placeholder="100"
                      onBlur={(e) => { const v = e.target.value ? Number(e.target.value) : undefined; if (v != null) { applyPercent(v); e.target.value = '' } }}
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                    <span className="text-xs text-muted-foreground">
                      → utile si plusieurs éléments se partagent cette surface (bois / métal / synthétique…)
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs font-medium mb-1">Quantité {qtyUnit && <span className="font-normal text-muted-foreground">({qtyUnit})</span>}</p>
                  <Input type="number" min="1" key={`qty-${item.id}-${item.area}`} defaultValue={item.area ?? ''}
                    onBlur={(e) => {
                      const raw = e.target.value.trim()
                      const v = raw ? Number(raw) : undefined
                      if (raw && (!isFinite(v!) || v! <= 0)) { setQtyError('Quantité minimale : 1'); e.target.value = String(item.area ?? ''); return }
                      setQtyError(null)
                      if (v !== (item.area ?? undefined)) applyQuantity(v)
                    }} />
                  {qtyError && <p className="text-[11px] text-red-600 mt-1">{qtyError}</p>}
                </div>
                <div>
                  <p className="text-xs font-medium mb-1">Année d'installation</p>
                  <Input type="number" defaultValue={item.yearInstalled ?? ''}
                    onBlur={(e) => { const v = e.target.value ? Number(e.target.value) : undefined; if (v !== (item.yearInstalled ?? undefined)) onUpdate({ yearInstalled: v ?? null }) }} />
                </div>
                <div>
                  <p className="text-xs font-medium mb-1">Année d'intervention</p>
                  <Input type="number" key={`iy-${item.id}-${item.interventionYear}`} defaultValue={item.interventionYear ?? ''}
                    placeholder={String(deriveInterventionYearClient(item.priority))}
                    onBlur={(e) => { const v = e.target.value ? Number(e.target.value) : undefined; if (v !== (item.interventionYear ?? undefined)) onUpdate({ interventionYear: v ?? null }) }} />
                </div>
                <div>
                  <p className="text-xs font-medium mb-1">Coût estimé (CHF)</p>
                  <Input type="number" min="0" key={`cost-${item.id}-${item.estimatedCost}`} defaultValue={item.estimatedCost ?? ''}
                    onBlur={(e) => { const v = e.target.value ? Number(e.target.value) : undefined; if (v !== (item.estimatedCost ? Number(item.estimatedCost) : undefined)) applyCost(v) }} />
                </div>
              </div>
              {catalog && (
                <div className="text-[11px] text-muted-foreground space-y-0.5">
                  <p>
                    Catalogue : {catalog.quantityFormula ?? 'aucune formule'}
                    {qtyResolution.basis && qtyResolution.origin !== 'manuelle' && <> · quantité prise sur {qtyResolution.basis}</>}
                    {qtyResolution.origin === 'manuelle' && qtyResolution.reason && <> · à saisir ({qtyResolution.reason})</>}
                  </p>
                  {suggestedPrice && (
                    <p>
                      Prix : {suggestedPrice} {catalog.unit ?? ''}
                      {appliedPrice != null && <> × indice {getMarketCoeff()} = <strong>{appliedPrice} {catalog.unit ?? ''}</strong></>}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Amélioration & remise aux normes */}
        <PerformanceEnvelopes item={item} catalog={catalog} quantity={item.area ?? autoQty ?? undefined} onUpdate={onUpdate} isMutating={isMutating} />

        {/* 4. Notes */}
        <div>
          <p className="text-sm font-medium mb-2">Notes</p>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => { if (notes !== (item.notes ?? '')) onUpdate({ notes: notes || null }) }}
            placeholder="Observations terrain, remarques…"
            rows={3}
          />
        </div>
      </CardContent>
    </Card>
  )
}

// ---------- Sélecteur du mode de guide ----------

function GuideModeToggle({ mode, onChange }: { mode: GuideMode; onChange: (m: GuideMode) => void }) {
  const opts: GuideMode[] = ['off', 'ask', 'always']
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <ScanSearch className="h-3.5 w-3.5 text-primary" />Guide IA
      </span>
      <div className="inline-flex rounded-lg border bg-muted/40 p-0.5">
        {opts.map((m) => (
          <button
            key={m}
            onClick={() => onChange(m)}
            className={cn(
              'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
              mode === m ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {GUIDE_MODE_LABELS[m]}
          </button>
        ))}
      </div>
    </div>
  )
}
