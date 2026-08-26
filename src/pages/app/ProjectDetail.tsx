import { useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useIsMobile } from '@/lib/use-mobile'
import { Loader2, AlertCircle, ClipboardCheck, Plus } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardContent, Select, Input } from '@/components/ui'
import { Dropdown } from '@/components/Dropdown'
import { ProjectMap } from '@/components/ProjectMap'
import { TerrainConstraintsCard } from '@/components/TerrainConstraintsCard'
import { statusLabels, statusColors, buildingTypeLabels, type BuildingType } from '@/data/mock'
import type { ProjectStatus, ApiProject, RoofType } from '@/lib/api-types'
import { computeProjectMetrics, roofSurface } from '@/lib/formulas'
import { api } from '@/lib/api'

const STATUSES: ProjectStatus[] = ['NON_PLANIFIE', 'PLANIFIE', 'EN_COURS', 'EN_REVUE', 'TERMINE', 'ARCHIVE']
const STATUS_OPTIONS = STATUSES.map(s => ({ value: s, label: statusLabels[s], color: statusColors[s] }))
const BUILDING_TYPES: BuildingType[] = ['LOGEMENT', 'VILLA', 'CHALET', 'SCOLAIRE', 'BUREAU', 'ADMINISTRATIF', 'INDUSTRIEL', 'HOTEL', 'COMMERCIAL', 'AUTRE']
const RESIDENTIAL: BuildingType[] = ['LOGEMENT', 'VILLA', 'CHALET']

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
      {children}
    </div>
  )
}

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['project', id],
    queryFn: () => api.projects.get(id!),
    enabled: !!id,
  })

  const update = useMutation({
    mutationFn: (body: Partial<ApiProject>) => api.projects.update(id!, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })

  const createDiag = useMutation({
    mutationFn: () => api.projects.createDiagnostic(id!, {}),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['project', id] })
      navigate(`/app/diagnostic/${res.diagnostic.id}`)
    },
  })

  // Sur mobile : ouvrir un diagnostic mène DIRECTEMENT à l'éditeur, jamais à la page projet.
  // S'il n'existe pas encore de diagnostic, on en crée un puis on bascule sur l'éditeur.
  const isMobile = useIsMobile()
  const firstDiagId = data?.diagnostics?.[0]?.id
  const autoDiag = useRef(false)
  useEffect(() => {
    if (!isMobile || !data) return
    if (firstDiagId) { navigate(`/app/diagnostic/${firstDiagId}`, { replace: true }); return }
    if (!autoDiag.current && !createDiag.isPending) { autoDiag.current = true; createDiag.mutate() }
  }, [isMobile, data, firstDiagId, navigate, createDiag])

  // Mobile : on n'affiche jamais la page projet (onglets, cartes…), seulement un chargement le temps de basculer.
  if (isMobile && (isLoading || data)) {
    return <div className="flex items-center justify-center py-32 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mr-2" />Ouverture de l'éditeur…</div>
  }

  if (isLoading) {
    return <div className="flex items-center justify-center py-32 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mr-2" />Chargement…</div>
  }
  if (isError || !data) {
    return (
      <Card><CardContent className="py-16 text-center">
        <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
        <p className="text-sm text-red-700">{(error as Error)?.message ?? 'Projet introuvable'}</p>
        <Link to="/app/projects"><Button variant="outline" className="mt-4">Retour aux diagnostics</Button></Link>
      </CardContent></Card>
    )
  }

  const { project, diagnostics } = data
  const diagnostic = diagnostics[0]
  const metrics = computeProjectMetrics({
    perimeter: project.perimeter ?? 0,
    nbFloors: project.nbFloors ?? 1,
    floorHeight: project.floorHeight ?? 2.7,
    builtArea: project.builtArea ?? 0,
    floorArea: project.floorArea ?? 0,
    facadeArea: project.facadeArea ?? undefined,
    windowPct: project.windowPct / 100,
    nbApartments: project.nbApartments ?? 0,
  })

  // Sauvegarde au blur (seulement si la valeur a changé).
  const saveText = (key: keyof ApiProject, current: string | null, required = false) =>
    (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
      const v = e.target.value.trim()
      if (v === (current ?? '')) return
      if (required && v === '') return
      update.mutate({ [key]: v === '' ? null : v } as Partial<ApiProject>)
    }
  const saveNum = (key: keyof ApiProject, current: number | null) =>
    (e: React.FocusEvent<HTMLInputElement>) => {
      const raw = e.target.value.trim()
      const v = raw === '' ? null : Number(raw)
      if (v === (current ?? null)) return
      update.mutate({ [key]: v } as Partial<ApiProject>)
    }

  const isResidential = RESIDENTIAL.includes(project.buildingType)

  return (
    <div className="space-y-6">
      {/* Header : nom + statut + action diagnostic */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <Input
            defaultValue={project.name}
            onBlur={saveText('name', project.name, true)}
            className="text-xl md:text-2xl font-bold h-auto border-0 px-0 shadow-none focus-visible:ring-0 bg-transparent"
          />
          <div className="flex items-center gap-2 mt-1">
            <Dropdown
              value={project.status}
              options={STATUS_OPTIONS}
              disabled={update.isPending}
              onChange={(v) => update.mutate({ status: v as ProjectStatus })}
            />
            {update.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </div>
        </div>
        {diagnostic ? (
          <Link to={`/app/diagnostic/${diagnostic.id}`} className="shrink-0">
            <Button className="w-full sm:w-auto"><ClipboardCheck className="mr-2 h-4 w-4" />Ouvrir le diagnostic</Button>
          </Link>
        ) : (
          <Button onClick={() => createDiag.mutate()} disabled={createDiag.isPending} className="w-full shrink-0 sm:w-auto">
            {createDiag.isPending
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Création…</>
              : <><Plus className="mr-2 h-4 w-4" />Démarrer un diagnostic</>}
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
        {/* Informations principales — éditables */}
        <Card className="flex flex-col">
          <CardHeader><CardTitle>Informations</CardTitle></CardHeader>
          <CardContent className="flex flex-1 flex-col">
            <div className="grid flex-1 grid-cols-2 gap-4 content-between">
              <div className="col-span-2">
                <Field label="Adresse">
                  <Input defaultValue={project.address} onBlur={saveText('address', project.address, true)} />
                </Field>
              </div>
              <Field label="NPA"><Input defaultValue={project.postalCode ?? ''} maxLength={4} onBlur={saveText('postalCode', project.postalCode)} /></Field>
              <Field label="Ville"><Input defaultValue={project.city} onBlur={saveText('city', project.city, true)} /></Field>
              <Field label="Canton"><Input defaultValue={project.canton} maxLength={2} onBlur={saveText('canton', project.canton, true)} /></Field>
              <Field label="Parcelle"><Input defaultValue={project.parcelNumber ?? ''} onBlur={saveText('parcelNumber', project.parcelNumber)} /></Field>
              <Field label="Année construction"><Input type="number" defaultValue={project.yearBuilt ?? ''} onBlur={saveNum('yearBuilt', project.yearBuilt)} /></Field>
              <Field label="Année rénovation"><Input type="number" defaultValue={project.renovationYear ?? ''} placeholder="Si rénové" onBlur={saveNum('renovationYear', project.renovationYear)} /></Field>
              <Field label="Type de bâtiment">
                <Select value={project.buildingType} onChange={(e) => update.mutate({ buildingType: e.target.value as BuildingType })}>
                  {BUILDING_TYPES.map(t => <option key={t} value={t}>{buildingTypeLabels[t]}</option>)}
                </Select>
              </Field>
              <Field label="Type de toiture">
                <Select value={project.roofType ?? ''} onChange={(e) => update.mutate({ roofType: (e.target.value || null) as RoofType | null })}>
                  <option value="">Non précisé</option>
                  <option value="PLATE">Plate</option>
                  <option value="PENTE">En pente</option>
                  <option value="MIXTE">Mixte</option>
                </Select>
              </Field>
              {isResidential && (
                <Field label="Appartements"><Input type="number" defaultValue={project.nbApartments ?? ''} onBlur={saveNum('nbApartments', project.nbApartments)} /></Field>
              )}
              <Field label="Étages"><Input type="number" defaultValue={project.nbFloors ?? ''} onBlur={saveNum('nbFloors', project.nbFloors)} /></Field>
              <Field label="Hauteur étage (m)"><Input type="number" step="0.1" defaultValue={project.floorHeight ?? ''} onBlur={saveNum('floorHeight', project.floorHeight)} /></Field>
            </div>
          </CardContent>
        </Card>

        {/* Colonne droite : surfaces + carte compacte */}
        <div className="flex flex-col gap-4 md:gap-6">

          {/* Surfaces — saisies éditables + estimations calculées */}
          <Card>
            <CardHeader><CardTitle>Surfaces</CardTitle></CardHeader>
            <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Field label="Plancher (m²)"><Input type="number" defaultValue={project.floorArea ?? ''} onBlur={saveNum('floorArea', project.floorArea)} /></Field>
              <Field label="Bâtie (m²)"><Input type="number" defaultValue={project.builtArea ?? ''} onBlur={saveNum('builtArea', project.builtArea)} /></Field>
              <Field label="Périmètre (ml)"><Input type="number" defaultValue={project.perimeter ?? ''} onBlur={saveNum('perimeter', project.perimeter)} /></Field>
              <Field label="Terrain (m²)"><Input type="number" defaultValue={project.terrainArea ?? ''} onBlur={saveNum('terrainArea', project.terrainArea)} /></Field>
              <Field label="% fenêtres"><Input type="number" defaultValue={project.windowPct} onBlur={saveNum('windowPct', project.windowPct)} /></Field>
            </div>

            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-4 mb-2">Estimations (formules)</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { l: 'Façade',      v: `${metrics.facade.toFixed(0)} m²` },
                { l: 'Fenêtres',    v: `${metrics.windows.toFixed(0)} m²` },
                { l: 'Toiture',     v: roofSurface(project.roofType, project.builtArea) != null ? `${roofSurface(project.roofType, project.builtArea)} m²` : `${metrics.flatRoof.toFixed(0)}–${metrics.slopedRoof.toFixed(0)} m² (à préciser)` },
                { l: 'Échafaudage', v: `${metrics.scaffolding.toFixed(0)} m²` },
              ].map(m => (
                <div key={m.l} className="flex justify-between p-2 rounded bg-muted/50 text-sm">
                  <span className="text-muted-foreground">{m.l}</span>
                  <span className="font-medium">{m.v}</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-3">
              Estimations à vérifier sur place.{!project.roofType && ' Toiture non présumée tant que le type n\'est pas précisé (ci-dessus).'}
            </p>
          </CardContent>
        </Card>
          {/* Localisation — carte compacte, libellés flottants */}
          <Card className="relative h-60 shrink-0 overflow-hidden sm:h-64">
            <ProjectMap
              address={project.address}
              postalCode={project.postalCode}
              city={project.city}
              canton={project.canton}
            />
          </Card>
        </div>
      </div>

      <TerrainConstraintsCard project={project} />
    </div>
  )
}
