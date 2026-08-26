import { useMemo, useRef, useState, useEffect, type Dispatch, type SetStateAction } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, Search, Filter, Loader2, AlertCircle, ClipboardCheck, Layers, Settings2, ChevronRight, MoreHorizontal, ChevronLeft } from 'lucide-react'
import {
  Button, Card, CardContent, Input, Select,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui'
import { api } from '@/lib/api'
import type { ApiProject, ApiOperation, ProjectStatus, BuildingType } from '@/lib/api-types'
import { statusLabels, buildingTypeLabels } from '@/data/mock'
import { cn } from '@/lib/utils'

const TABS = ['Tous', 'En cours', 'À traiter', 'Terminés', 'Archivés'] as const

function statusInTab(status: ProjectStatus, tab: string): boolean {
  switch (tab) {
    case 'En cours': return ['EN_COURS', 'PLANIFIE', 'EN_REVUE'].includes(status)
    case 'À traiter': return status === 'NON_PLANIFIE'
    case 'Terminés': return status === 'TERMINE'
    case 'Archivés': return status === 'ARCHIVE'
    default: return true
  }
}

const STATUS_PILL: Record<ProjectStatus, { dot: string; pill: string }> = {
  NON_PLANIFIE: { dot: 'bg-gray-400', pill: 'bg-gray-100 text-gray-600' },
  PLANIFIE: { dot: 'bg-blue-400', pill: 'bg-blue-50 text-blue-700' },
  EN_COURS: { dot: 'bg-blue-500', pill: 'bg-blue-50 text-blue-700' },
  EN_REVUE: { dot: 'bg-amber-500', pill: 'bg-amber-50 text-amber-700' },
  TERMINE: { dot: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700' },
  ARCHIVE: { dot: 'bg-gray-400', pill: 'bg-gray-100 text-gray-500' },
}
const TINTS = ['bg-violet-100 text-violet-600', 'bg-emerald-100 text-emerald-600', 'bg-rose-100 text-rose-600', 'bg-blue-100 text-blue-600', 'bg-amber-100 text-amber-600', 'bg-cyan-100 text-cyan-600']

const dateFmt = new Intl.DateTimeFormat('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' })
const timeFmt = new Intl.DateTimeFormat('fr-CH', { hour: '2-digit', minute: '2-digit' })

type Cols = { type: boolean; surface: boolean; created: boolean; modified: boolean }
type ColKey = keyof Cols

interface Row {
  id: string
  kind: 'project' | 'operation'
  seq: number
  ref: string
  name: string
  status: ProjectStatus
  createdAt: string
  updatedAt: string
  buildingLabel: string
  subLabel: string
  street: string
  place: string
  typeLabel: string
  buildingType?: BuildingType
  surface: number | null
  detailPath: string
}

function toProjectRow(p: ApiProject): Omit<Row, 'seq' | 'ref'> {
  const n = p.nbApartments ?? 0
  return {
    id: p.id, kind: 'project', name: p.name, status: p.status, createdAt: p.createdAt, updatedAt: p.updatedAt,
    buildingLabel: buildingTypeLabels[p.buildingType],
    subLabel: n > 0 ? `${n} appartement${n > 1 ? 's' : ''}` : '—',
    street: p.address,
    place: `${p.postalCode ? `${p.postalCode} ` : ''}${p.city}${p.canton ? ` (${p.canton})` : ''}`,
    typeLabel: buildingTypeLabels[p.buildingType],
    buildingType: p.buildingType,
    surface: p.floorArea,
    detailPath: `/app/projects/${p.id}`,
  }
}
function toOperationRow(o: ApiOperation): Omit<Row, 'seq' | 'ref'> {
  const n = o._count?.projects ?? 0
  return {
    id: o.id, kind: 'operation', name: o.name, status: o.status, createdAt: o.createdAt, updatedAt: o.updatedAt,
    buildingLabel: 'Multi-bâtiments', subLabel: `${n} bâtiment${n > 1 ? 's' : ''}`,
    street: o.clientName ?? '—', place: '', typeLabel: 'Multi', surface: null,
    detailPath: `/app/diagnostics-multi/${o.id}`,
  }
}

export function ProjectsList() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<string>('Tous')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [cols, setCols] = useState<Cols>({ type: true, surface: true, created: true, modified: true })

  const { data, isLoading, isError, error } = useQuery({ queryKey: ['projects'], queryFn: () => api.projects.list() })
  const { data: opData } = useQuery({ queryKey: ['operations'], queryFn: () => api.operations.list() })

  const rows = useMemo<Row[]>(() => {
    const projects = (data?.projects ?? []).filter(p => !p.operationId).map(toProjectRow)
    const ops = (opData?.operations ?? []).map(toOperationRow)
    const all = [...projects, ...ops]
    // Numérotation #DIAG-année-#### par ordre de création croissant.
    all.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    return all.map((r, i) => ({
      ...r, seq: i + 1,
      ref: `#DIAG-${new Date(r.createdAt).getFullYear()}-${String(i + 1).padStart(4, '0')}`,
    }))
  }, [data, opData])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return rows
      .filter(r => statusInTab(r.status, activeTab))
      .filter(r => typeFilter === 'all' || r.buildingType === typeFilter)
      .filter(r => !q || r.name.toLowerCase().includes(q) || r.street.toLowerCase().includes(q) || r.place.toLowerCase().includes(q) || r.ref.toLowerCase().includes(q))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)) // plus récent en haut
  }, [rows, activeTab, typeFilter, search])

  // Réinitialise la page quand les filtres changent.
  useEffect(() => { setPage(1) }, [activeTab, typeFilter, search, pageSize])

  const total = filtered.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const start = (page - 1) * pageSize
  const pageRows = filtered.slice(start, start + pageSize)

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Diagnostics</h1>
          <p className="text-muted-foreground text-sm">
            {isLoading ? 'Chargement…' : `${rows.length} diagnostic${rows.length > 1 ? 's' : ''} au total`}
          </p>
        </div>
        <Link to="/app/projects/new">
          <Button className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" />Nouveau diagnostic</Button>
        </Link>
      </div>

      {/* Recherche + filtres */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher un diagnostic..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <div className="flex gap-2">
          <Select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="flex-1 sm:w-48">
            <option value="all">Tous les types</option>
            {(Object.keys(buildingTypeLabels) as BuildingType[]).map(t => <option key={t} value={t}>{buildingTypeLabels[t]}</option>)}
          </Select>
          <Button variant="outline" size="icon" className="shrink-0"><Filter className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg overflow-x-auto w-fit max-w-full">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn('px-3 md:px-4 py-1.5 rounded-md text-xs md:text-sm font-medium transition-colors whitespace-nowrap',
              activeTab === tab ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}
          >{tab}</button>
        ))}
      </div>

      {isLoading && <Card><CardContent className="py-16 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />Chargement des diagnostics…</CardContent></Card>}
      {isError && <Card><CardContent className="py-16 text-center"><AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" /><p className="text-sm text-red-700">{(error as Error)?.message ?? 'Erreur de chargement'}</p></CardContent></Card>}

      {!isLoading && !isError && total === 0 && (
        <Card><CardContent className="py-16 text-center">
          <ClipboardCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-1">{rows.length === 0 ? 'Aucun diagnostic' : 'Aucun résultat'}</h3>
          <p className="text-sm text-muted-foreground mb-4">{rows.length === 0 ? 'Démarrez votre premier diagnostic.' : 'Aucun diagnostic ne correspond à votre recherche.'}</p>
          {rows.length === 0 && <Link to="/app/projects/new"><Button><Plus className="mr-2 h-4 w-4" />Nouveau diagnostic</Button></Link>}
        </CardContent></Card>
      )}

      {!isLoading && !isError && total > 0 && (
        <Card>
          <CardContent className="p-0">
            {/* Mobile : liste en cartes (tap → éditeur) */}
            <div className="md:hidden divide-y">
              {pageRows.map(r => (
                <button key={r.id} onClick={() => navigate(r.detailPath)} className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted/40">
                  <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', TINTS[(r.seq - 1) % TINTS.length])}><Layers className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0', STATUS_PILL[r.status].pill)}><span className={cn('h-1.5 w-1.5 rounded-full', STATUS_PILL[r.status].dot)} />{statusLabels[r.status]}</span>
                      <p className="text-sm font-semibold truncate">{r.name}</p>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{r.street}{r.place ? `, ${r.place}` : ''}</p>
                    <p className="text-[11px] text-muted-foreground">{r.buildingLabel}{r.surface != null ? ` · ${r.surface} m²` : ''}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
            {/* Desktop : tableau */}
            <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Diagnostic</TableHead>
                  <TableHead className="w-32">Statut</TableHead>
                  <TableHead>Bâtiment</TableHead>
                  <TableHead>Adresse</TableHead>
                  {cols.type && <TableHead className="w-28">Type</TableHead>}
                  {cols.surface && <TableHead className="w-24">Surface</TableHead>}
                  {cols.created && <TableHead className="w-32">Créé le</TableHead>}
                  {cols.modified && <TableHead className="w-32">Modifié le</TableHead>}
                  <TableHead className="w-16 text-right">
                    <ColumnSettings cols={cols} setCols={setCols} />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map(r => (
                  <TableRow key={r.id} className="cursor-pointer hover:bg-muted/40" onClick={() => navigate(r.detailPath)}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', TINTS[(r.seq - 1) % TINTS.length])}>
                          <Layers className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{r.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{r.ref}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', STATUS_PILL[r.status].pill)}>
                        <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_PILL[r.status].dot)} />{statusLabels[r.status]}
                      </span>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{r.buildingLabel}</p>
                      <p className="text-xs text-muted-foreground">{r.subLabel}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm truncate max-w-[13rem]">{r.street}</p>
                      {r.place && <p className="text-xs text-muted-foreground">{r.place}</p>}
                    </TableCell>
                    {cols.type && <TableCell className="text-sm text-muted-foreground">{r.typeLabel}</TableCell>}
                    {cols.surface && <TableCell className="text-sm">{r.surface != null ? `${r.surface} m²` : '—'}</TableCell>}
                    {cols.created && <TableCell><DateCell iso={r.createdAt} /></TableCell>}
                    {cols.modified && <TableCell><DateCell iso={r.updatedAt} /></TableCell>}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-0.5 text-muted-foreground">
                        <ChevronRight className="h-4 w-4" />
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/app/projects/${r.id}/edit`) }}
                          className="rounded p-1 hover:bg-muted hover:text-foreground"
                          title="Modifier"
                        ><MoreHorizontal className="h-4 w-4" /></button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </CardContent>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t px-4 py-3 text-sm">
            <p className="text-muted-foreground">
              Affichage de {total === 0 ? 0 : start + 1} à {Math.min(start + pageSize, total)} sur {total} diagnostic{total > 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-2">
              <Select value={String(pageSize)} onChange={e => setPageSize(Number(e.target.value))} className="w-28">
                {[10, 25, 50].map(n => <option key={n} value={n}>{n} / page</option>)}
              </Select>
              <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="min-w-8 text-center font-medium">{page}</span>
              <Button variant="outline" size="icon" disabled={page >= pageCount} onClick={() => setPage(p => Math.min(pageCount, p + 1))}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}

function DateCell({ iso }: { iso: string }) {
  const d = new Date(iso)
  return (
    <div className="text-sm">
      <p>{dateFmt.format(d)}</p>
      <p className="text-xs text-muted-foreground">{timeFmt.format(d)}</p>
    </div>
  )
}

/** Réglage des colonnes visibles (icône engrenage dans l'en-tête). */
function ColumnSettings({ cols, setCols }: { cols: Cols; setCols: Dispatch<SetStateAction<Cols>> }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])
  const options: [ColKey, string][] = [['type', 'Type'], ['surface', 'Surface'], ['created', 'Créé le'], ['modified', 'Modifié le']]
  return (
    <div ref={ref} className="relative inline-block">
      <button onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }} className="rounded p-1.5 hover:bg-muted text-muted-foreground" title="Colonnes">
        <Settings2 className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-40 rounded-lg border bg-background p-1 shadow-lg" onClick={e => e.stopPropagation()}>
          <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Colonnes</p>
          {options.map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted cursor-pointer">
              <input type="checkbox" checked={cols[key]} onChange={() => setCols(c => ({ ...c, [key]: !c[key] }))} className="h-4 w-4 accent-primary" />
              {label}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
