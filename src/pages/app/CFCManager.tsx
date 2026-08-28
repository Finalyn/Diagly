import { Fragment, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Loader2, AlertCircle, ChevronRight, ChevronDown, Plus, Pencil, Trash2, X, Check, RotateCcw } from 'lucide-react'
import {
  Card, CardContent, Input, Textarea, Button, Badge,
  Tabs, TabsList, TabsTrigger, TabsContent,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui'
import { api } from '@/lib/api'
import type { ApiCatalogItem, ApiCfcEntry } from '@/lib/api-types'
import { groupItemsByCategory } from '@/lib/cfc'
import { cn } from '@/lib/utils'

export function CFCManager() {
  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold">Ma base de données CFC et prix</h1>
        <p className="text-muted-foreground text-sm">Modifiez vos prix unitaires, unités et travaux par état. Vos modifications ne concernent que votre compte.</p>
      </div>

      <Tabs defaultValue="items">
        <TabsList>
          <TabsTrigger value="items">Items avec prix</TabsTrigger>
          <TabsTrigger value="catalog">Nomenclature CFC suisse</TabsTrigger>
        </TabsList>

        <TabsContent value="items">
          <CatalogItemsTab />
        </TabsContent>

        <TabsContent value="catalog">
          <CfcCatalogTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ============================================================================
// Tab 1 : items opérationnels avec prix par état (catalog_items)
// ============================================================================

function CatalogItemsTab() {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [editing, setEditing] = useState<ApiCatalogItem | 'new' | null>(null)
  const [resetting, setResetting] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['cfc-items'],
    queryFn: () => api.cfc.items(),
    staleTime: 60 * 60 * 1000,
  })

  const resetDefaults = async () => {
    if (!window.confirm('Réinitialiser tout le catalogue au défaut ? Vos personnalisations de prix et de travaux seront supprimées.')) return
    setResetting(true)
    try {
      await api.cfc.resetToDefault()
      await queryClient.invalidateQueries({ queryKey: ['cfc-items'] })
    } finally {
      setResetting(false)
    }
  }

  // Référence stable : `?? []` produirait un tableau neuf à chaque rendu et casserait les mémorisations en aval.
  const items = useMemo(() => data?.items ?? [], [data])

  // Catégories dans l'ordre de la Feuil2 (= ordre de visite du diagnostiqueur).
  const allCategories = useMemo(() => groupItemsByCategory(items), [items])

  const filteredItems = useMemo(() => {
    const q = search.toLowerCase().trim()
    return items.filter(it => {
      if (categoryFilter && (it.category ?? 'Autres') !== categoryFilter) return false
      if (!q) return true
      return (
        it.description.toLowerCase().includes(q) ||
        (it.cfcCode?.toLowerCase().includes(q) ?? false) ||
        (it.category?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [items, search, categoryFilter])

  const groups = useMemo(() => groupItemsByCategory(filteredItems), [filteredItems])
  const totalResults = filteredItems.length

  if (isLoading) return <LoadingCard />
  if (isError) return <ErrorCard />

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_1fr] mt-4">
      {/* Navigation par catégorie : pastilles horizontales sur mobile, liste verticale sur desktop */}
      <Card className="self-start min-w-0">
        <CardContent className="p-2">
          <div className="no-scrollbar scroll-fade-r flex gap-1 overflow-x-auto pr-6 lg:flex-col lg:overflow-visible lg:pr-0">
            <button
              onClick={() => setCategoryFilter(null)}
              className={cn(
                'shrink-0 lg:w-full whitespace-nowrap text-left px-3 py-2 rounded-full lg:rounded text-sm transition-colors',
                !categoryFilter ? 'bg-primary/10 text-primary font-medium' : 'border lg:border-0 hover:bg-muted',
              )}
            >
              Toutes ({items.length})
            </button>
            {allCategories.map(g => (
              <button
                key={g.category}
                onClick={() => setCategoryFilter(g.category)}
                className={cn(
                  'shrink-0 lg:w-full whitespace-nowrap text-left px-3 py-2 rounded-full lg:rounded text-sm transition-colors flex items-center lg:justify-between gap-2',
                  categoryFilter === g.category ? 'bg-primary/10 text-primary font-medium' : 'border lg:border-0 hover:bg-muted',
                )}
              >
                <span className="truncate">{g.category}</span>
                <span className="text-xs text-muted-foreground shrink-0">{g.items.length}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Liste items groupés par catégorie */}
      <div className="space-y-3 min-w-0">
        <div className="flex flex-wrap gap-2">
          <div className="relative w-full sm:flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par description, code CFC…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" onClick={resetDefaults} disabled={resetting} className="shrink-0" title="Restaurer les prix et travaux par défaut">
            {resetting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
            <span className="hidden sm:inline">Réinitialiser</span>
          </Button>
          <Button onClick={() => { setEditing('new'); setExpandedId(null) }} className="shrink-0">
            <Plus className="mr-2 h-4 w-4" />Nouvel item
          </Button>
        </div>
        <p className="text-xs text-muted-foreground -mt-1">
          « Réinitialiser » restaure le catalogue par défaut.
        </p>

        {editing && (
          <EditItemForm
            initial={editing === 'new' ? null : editing}
            onDone={() => setEditing(null)}
          />
        )}

        <p className="text-xs text-muted-foreground">{totalResults} résultat{totalResults !== 1 ? 's' : ''}</p>

        {totalResults === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Aucun résultat
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Desktop : tableau */}
            <Card className="hidden md:block">
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">CFC</TableHead>
                      <TableHead>Élément</TableHead>
                      <TableHead className="w-28">Unité</TableHead>
                      <TableHead className="text-right">Prix moyen</TableHead>
                      <TableHead className="text-right">Mauvais</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groups.map(g => (
                      <Fragment key={g.category}>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                          <TableCell colSpan={6} className="py-1.5 text-xs font-bold uppercase tracking-wider text-foreground">
                            {g.category}
                          </TableCell>
                        </TableRow>
                        {g.items.map(item => (
                          <ItemRow
                            key={item.id}
                            item={item}
                            expanded={expandedId === item.id}
                            onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
                            onEdit={() => { setEditing(item); setExpandedId(null) }}
                          />
                        ))}
                      </Fragment>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Mobile : cartes lisibles */}
            <div className="md:hidden space-y-4">
              {groups.map(g => (
                <div key={g.category} className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">{g.category}</p>
                  {g.items.map(item => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      expanded={expandedId === item.id}
                      onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
                      onEdit={() => { setEditing(item); setExpandedId(null) }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </>
        )}

        {expandedId !== null && !editing && (() => {
          const it = items.find(i => i.id === expandedId)
          return it ? <div className="hidden md:block"><ItemDetail item={it} onEdit={() => { setEditing(it); setExpandedId(null) }} /></div> : null
        })()}
      </div>
    </div>
  )
}

function ItemRow({ item, expanded, onToggle, onEdit }: { item: ApiCatalogItem; expanded: boolean; onToggle: () => void; onEdit: () => void }) {
  return (
    <TableRow onClick={onToggle} className="cursor-pointer hover:bg-muted/50">
      <TableCell className="font-mono text-xs">{item.cfcCode ?? '—'}</TableCell>
      <TableCell className="font-medium text-sm">
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
          <span>{item.description}</span>
        </div>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">{item.unit ?? '—'}</TableCell>
      <TableCell className="text-right text-sm">{item.priceMoyen ?? '—'}</TableCell>
      <TableCell className="text-right text-sm font-semibold">{item.priceMauvais ?? '—'}</TableCell>
      <TableCell className="w-10 p-1 text-right">
        <Button
          variant="ghost" size="icon" className="h-7 w-7"
          onClick={(e) => { e.stopPropagation(); onEdit() }}
          title="Éditer cet item"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </TableCell>
    </TableRow>
  )
}

function ItemCard({ item, expanded, onToggle, onEdit }: { item: ApiCatalogItem; expanded: boolean; onToggle: () => void; onEdit: () => void }) {
  return (
    <div className="rounded-xl border bg-card">
      {/* Deux actions distinctes (deplier / editer) : elles doivent etre cote a cote,
          un <button> imbrique dans un <button> est du HTML invalide et le clic sur
          le crayon devenait ambigu. */}
      <div className="flex w-full items-start gap-2 p-3 text-left">
        <button onClick={onToggle} className="flex min-w-0 flex-1 items-start gap-2 text-left">
        {expanded ? <ChevronDown className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-muted-foreground">{item.cfcCode ?? '—'}</span>
            {item.unit && <span className="text-[11px] text-muted-foreground">· {item.unit}</span>}
          </div>
          <p className="text-sm font-medium leading-snug">{item.description}</p>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
            <span className="text-muted-foreground">Moyen <span className="font-medium text-foreground">{item.priceMoyen ?? '—'}</span></span>
            <span className="text-muted-foreground">Mauvais <span className="font-semibold text-primary">{item.priceMauvais ?? '—'}</span></span>
          </div>
        </div>
        </button>
        <button
          onClick={onEdit}
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
          title="Éditer cet item"
        >
          <Pencil className="h-4 w-4" />
        </button>
      </div>
      {expanded && (
        <div className="border-t p-3">
          <ItemDetailBody item={item} />
        </div>
      )}
    </div>
  )
}

function ItemDetail({ item, onEdit }: { item: ApiCatalogItem; onEdit: () => void }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="font-mono text-sm text-muted-foreground">{item.cfcCode ?? '—'}</span>
          <h3 className="font-semibold">{item.description}</h3>
          {item.category && <Badge variant="outline" className="text-[10px]">{item.category}</Badge>}
          <Button variant="outline" size="sm" onClick={onEdit} className="ml-auto shrink-0">
            <Pencil className="mr-2 h-3.5 w-3.5" />Éditer
          </Button>
        </div>
        <ItemDetailBody item={item} />
      </CardContent>
    </Card>
  )
}

function ItemDetailBody({ item }: { item: ApiCatalogItem }) {
  return (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Travaux par état</h4>
            <dl className="text-xs space-y-1.5">
              {[
                ['Très bon',     item.workTbe,         item.priceTbe],
                ['Bon',          item.workBon,         item.priceBon],
                ['Moyen',        item.workMoyen,       item.priceMoyen],
                ['Mauvais',      item.workMauvais,     item.priceMauvais],
                ['Amélioration', item.workImprovement, item.priceImprovement],
                ['Normes',       item.workNorms,       item.priceNorms],
              ].filter(([, work, price]) => work || price).map(([label, work, price]) => (
                <div key={label as string} className="flex gap-3">
                  <dt className="font-medium w-28 shrink-0">{label}</dt>
                  <dd className="flex-1">
                    {work && <span>{work}</span>}
                    {price && <span className="text-primary font-semibold ml-2">· {price} {item.unit ?? ''}</span>}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Métadonnées</h4>
            <dl className="text-xs space-y-1.5">
              <div className="flex gap-3">
                <dt className="font-medium w-28 shrink-0">Unité</dt>
                <dd>{item.unit ?? '—'}</dd>
              </div>
              <div className="flex gap-3">
                <dt className="font-medium w-28 shrink-0">Quantité</dt>
                <dd>{item.quantityFormula ?? '—'}</dd>
              </div>
              {item.scaffoldingNote && (
                <div className="flex gap-3">
                  <dt className="font-medium w-28 shrink-0">Échafaudage</dt>
                  <dd className="text-orange-700">{item.scaffoldingNote}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
  )
}

// ============================================================================
// Édition d'un item de catalogue (open source : modifiable)
// ============================================================================

const STATE_FIELDS = [
  { key: 'Tbe', label: 'Très bon' },
  { key: 'Bon', label: 'Bon' },
  { key: 'Moyen', label: 'Moyen' },
  { key: 'Mauvais', label: 'Mauvais' },
  { key: 'Improvement', label: 'Amélioration' },
  { key: 'Norms', label: 'Normes' },
] as const

function EditItemForm({ initial, onDone }: { initial: ApiCatalogItem | null; onDone: () => void }) {
  const qc = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [f, setF] = useState<Record<string, string>>(() => ({
    description: initial?.description ?? '',
    cfcCode: initial?.cfcCode ?? '',
    category: initial?.category ?? '',
    unit: initial?.unit ?? '',
    quantityFormula: initial?.quantityFormula ?? '',
    scaffoldingNote: initial?.scaffoldingNote ?? '',
    workTbe: initial?.workTbe ?? '', workBon: initial?.workBon ?? '', workMoyen: initial?.workMoyen ?? '',
    workMauvais: initial?.workMauvais ?? '', workImprovement: initial?.workImprovement ?? '', workNorms: initial?.workNorms ?? '',
    priceTbe: initial?.priceTbe ?? '', priceBon: initial?.priceBon ?? '', priceMoyen: initial?.priceMoyen ?? '',
    priceMauvais: initial?.priceMauvais ?? '', priceImprovement: initial?.priceImprovement ?? '', priceNorms: initial?.priceNorms ?? '',
  }))
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }))
  const toNull = (s: string) => (s.trim() === '' ? null : s.trim())

  const buildBody = (): Partial<ApiCatalogItem> => ({
    description: f.description.trim(),
    cfcCode: toNull(f.cfcCode), category: toNull(f.category), unit: toNull(f.unit),
    quantityFormula: toNull(f.quantityFormula), scaffoldingNote: toNull(f.scaffoldingNote),
    workTbe: toNull(f.workTbe), workBon: toNull(f.workBon), workMoyen: toNull(f.workMoyen),
    workMauvais: toNull(f.workMauvais), workImprovement: toNull(f.workImprovement), workNorms: toNull(f.workNorms),
    priceTbe: toNull(f.priceTbe), priceBon: toNull(f.priceBon), priceMoyen: toNull(f.priceMoyen),
    priceMauvais: toNull(f.priceMauvais), priceImprovement: toNull(f.priceImprovement), priceNorms: toNull(f.priceNorms),
  })

  const save = useMutation({
    mutationFn: () => (initial ? api.cfc.updateItem(initial.id, buildBody()) : api.cfc.createItem(buildBody())),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cfc-items'] }); onDone() },
    onError: (e) => setError((e as Error)?.message ?? 'Erreur'),
  })
  const del = useMutation({
    mutationFn: () => api.cfc.deleteItem(initial!.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cfc-items'] }); onDone() },
    onError: (e) => setError((e as Error)?.message ?? 'Erreur'),
  })
  const busy = save.isPending || del.isPending

  return (
    <Card className="border-primary/40">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{initial ? "Éditer l'item" : 'Nouvel item'}</h3>
          <Button variant="ghost" size="icon" onClick={onDone}><X className="h-4 w-4" /></Button>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="text-xs font-medium mb-1 block">Description</label>
            <Input value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="Ex: Charpente bois" />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Code CFC</label>
            <Input value={f.cfcCode} onChange={(e) => set('cfcCode', e.target.value)} placeholder="214" />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Catégorie</label>
            <Input value={f.category} onChange={(e) => set('category', e.target.value)} placeholder="STRUCTURE" />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Unité</label>
            <Input value={f.unit} onChange={(e) => set('unit', e.target.value)} placeholder="CHF/m²" />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Formule de quantité</label>
            <Input value={f.quantityFormula} onChange={(e) => set('quantityFormula', e.target.value)} placeholder="Surface bâtie x 1,35" />
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Travaux et prix par état</p>
          <div className="space-y-2">
            {STATE_FIELDS.map(s => (
              <div key={s.key} className="grid grid-cols-[5.5rem_1fr_7rem] gap-2 items-start">
                <span className="text-xs font-medium pt-2">{s.label}</span>
                <Textarea rows={1} value={f['work' + s.key]} onChange={(e) => set('work' + s.key, e.target.value)} placeholder="Travaux…" className="text-sm min-h-9" />
                <Input value={f['price' + s.key]} onChange={(e) => set('price' + s.key, e.target.value)} placeholder="prix" />
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium mb-1 block">Note échafaudage</label>
          <Input value={f.scaffoldingNote} onChange={(e) => set('scaffoldingNote', e.target.value)} />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center justify-between gap-2">
          {initial ? (
            <Button variant="outline" disabled={busy} onClick={() => { if (confirm('Supprimer cet item du catalogue ?')) del.mutate() }} className="text-red-600 hover:text-red-700">
              {del.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onDone} disabled={busy}>Annuler</Button>
            <Button
              disabled={busy}
              onClick={() => { setError(null); if (!f.description.trim()) { setError('La description est requise.'); return } save.mutate() }}
            >
              {save.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />…</> : <><Check className="mr-2 h-4 w-4" />Enregistrer</>}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// Tab 2 : nomenclature CFC suisse complète (cfc_catalog, 645 entrées)
// ============================================================================

function CfcCatalogTab() {
  const [search, setSearch] = useState('')
  const { data, isLoading, isError } = useQuery({
    queryKey: ['cfc-catalog'],
    queryFn: () => api.cfc.catalog(),
    staleTime: 60 * 60 * 1000,
  })

  // Référence stable : `?? []` produirait un tableau neuf à chaque rendu et casserait les mémorisations en aval.
  const entries = useMemo(() => data?.entries ?? [], [data])
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return entries
    return entries.filter(e =>
      e.code.toLowerCase().includes(q) || e.label.toLowerCase().includes(q),
    )
  }, [entries, search])

  if (isLoading) return <LoadingCard />
  if (isError) return <ErrorCard />

  return (
    <div className="space-y-3 mt-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher par code ou libellé…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>
      <p className="text-xs text-muted-foreground">{filtered.length} entrée{filtered.length !== 1 ? 's' : ''} (sur {entries.length})</p>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Aucun résultat
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 max-h-[70vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Code</TableHead>
                  <TableHead>Désignation</TableHead>
                  <TableHead className="w-20">Niveau</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(e => <CfcRow key={e.code} entry={e} />)}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function CfcRow({ entry }: { entry: ApiCfcEntry }) {
  const indent = entry.level === 1 ? '' : entry.level === 2 ? 'pl-6' : 'pl-12'
  return (
    <TableRow>
      <TableCell className={cn('font-mono text-xs', indent)}>{entry.code}</TableCell>
      <TableCell className={cn(entry.level === 1 ? 'font-bold uppercase text-xs tracking-wider' : entry.level === 2 ? 'font-semibold text-sm' : 'text-sm')}>
        {entry.label}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="text-[10px]">{entry.level === 1 ? 'Chapitre' : entry.level === 2 ? 'Groupe' : 'Position'}</Badge>
      </TableCell>
    </TableRow>
  )
}

// ============================================================================
// helpers
// ============================================================================

function LoadingCard() {
  return (
    <Card>
      <CardContent className="py-12 text-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
      </CardContent>
    </Card>
  )
}

function ErrorCard() {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
        <p className="text-sm text-red-700">Impossible de charger le catalogue CFC.</p>
      </CardContent>
    </Card>
  )
}
