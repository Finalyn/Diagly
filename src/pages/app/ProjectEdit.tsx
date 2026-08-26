import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Save, Loader2, AlertCircle } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardContent, Input, Select } from '@/components/ui'
import { buildingTypeLabels, type BuildingType } from '@/data/mock'
import { api, ApiError } from '@/lib/api'
import type { ApiProject, ProjectStatus } from '@/lib/api-types'

const buildingTypeOrder: BuildingType[] = ['LOGEMENT', 'VILLA', 'CHALET', 'SCOLAIRE', 'BUREAU', 'ADMINISTRATIF', 'INDUSTRIEL', 'HOTEL', 'COMMERCIAL', 'AUTRE']

type FormState = {
  name: string
  address: string
  postalCode: string
  city: string
  canton: string
  yearBuilt: string
  buildingType: BuildingType
  status: ProjectStatus
  nbApartments: string
  nbFloors: string
  floorHeight: string
  nbStaircases: string
  floorArea: string
  builtArea: string
  facadeArea: string
  terrainArea: string
  perimeter: string
  windowPct: string
  honoraryPct: string
  reservePct: string
}

const fromProject = (p: ApiProject): FormState => ({
  name: p.name,
  address: p.address,
  postalCode: p.postalCode ?? '',
  city: p.city,
  canton: p.canton,
  yearBuilt: p.yearBuilt?.toString() ?? '',
  buildingType: p.buildingType as BuildingType,
  status: p.status,
  nbApartments: p.nbApartments?.toString() ?? '',
  nbFloors: p.nbFloors?.toString() ?? '',
  floorHeight: p.floorHeight?.toString() ?? '',
  nbStaircases: p.nbStaircases?.toString() ?? '',
  floorArea: p.floorArea?.toString() ?? '',
  builtArea: p.builtArea?.toString() ?? '',
  facadeArea: p.facadeArea?.toString() ?? '',
  terrainArea: p.terrainArea?.toString() ?? '',
  perimeter: p.perimeter?.toString() ?? '',
  windowPct: p.windowPct.toString(),
  honoraryPct: p.honoraryPct.toString(),
  reservePct: p.reservePct.toString(),
})

const toPayload = (f: FormState) => ({
  name: f.name,
  address: f.address,
  postalCode: f.postalCode || undefined,
  city: f.city,
  canton: f.canton,
  buildingType: f.buildingType,
  status: f.status,
  yearBuilt: f.yearBuilt ? Number(f.yearBuilt) : undefined,
  nbApartments: f.nbApartments ? Number(f.nbApartments) : undefined,
  nbFloors: f.nbFloors ? Number(f.nbFloors) : undefined,
  floorHeight: f.floorHeight ? Number(f.floorHeight) : undefined,
  nbStaircases: f.nbStaircases ? Number(f.nbStaircases) : undefined,
  floorArea: f.floorArea ? Number(f.floorArea) : undefined,
  builtArea: f.builtArea ? Number(f.builtArea) : undefined,
  facadeArea: f.facadeArea ? Number(f.facadeArea) : undefined,
  terrainArea: f.terrainArea ? Number(f.terrainArea) : undefined,
  perimeter: f.perimeter ? Number(f.perimeter) : undefined,
  windowPct: f.windowPct ? Number(f.windowPct) : undefined,
  honoraryPct: f.honoraryPct ? Number(f.honoraryPct) : undefined,
  reservePct: f.reservePct ? Number(f.reservePct) : undefined,
})

export function ProjectEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  // `edited` ne contient que les modifications de l'utilisateur : tant qu'il n'a rien
  // touché, le formulaire est dérivé des données du serveur. Plus besoin d'un effet
  // qui recopie la réponse dans l'état (et qui provoquait un rendu supplémentaire).
  const [edited, setEdited] = useState<FormState | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['project', id],
    queryFn: () => api.projects.get(id!),
    enabled: !!id,
  })

  const form: FormState | null = edited ?? (data?.project ? fromProject(data.project) : null)

  const update = useMutation({
    mutationFn: () => api.projects.update(id!, toPayload(form!)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      navigate(`/app/projects/${id}`)
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Erreur de sauvegarde'),
  })

  if (isLoading || !form) {
    return (
      <div className="flex items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />Chargement…
      </div>
    )
  }
  if (isError || !data) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-red-700">Projet introuvable</p>
        </CardContent>
      </Card>
    )
  }

  const set = <K extends keyof FormState>(field: K, value: FormState[K]) =>
    setEdited(prev => (prev ?? form) ? { ...(prev ?? form)!, [field]: value } : prev)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Modifier le diagnostic</h1>
          <p className="text-muted-foreground">{data.project.name}</p>
        </div>
        <Button onClick={() => { setError(null); update.mutate() }} disabled={update.isPending}>
          {update.isPending
            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enregistrement…</>
            : <><Save className="mr-2 h-4 w-4" />Enregistrer</>}
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Informations générales</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-sm font-medium mb-1 block">Nom du diagnostic</label>
              <Input value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium mb-1 block">Adresse</label>
              <Input value={form.address} onChange={e => set('address', e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Code postal</label>
              <Input value={form.postalCode} onChange={e => set('postalCode', e.target.value)} maxLength={4} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Ville</label>
              <Input value={form.city} onChange={e => set('city', e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Canton</label>
              <Select value={form.canton} onChange={e => set('canton', e.target.value)}>
                {['VD', 'GE', 'FR', 'NE', 'VS', 'BE', 'JU'].map(c => <option key={c}>{c}</option>)}
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Année de construction</label>
              <Input type="number" value={form.yearBuilt} onChange={e => set('yearBuilt', e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Type de bâtiment</label>
              <Select value={form.buildingType} onChange={e => set('buildingType', e.target.value as BuildingType)}>
                {buildingTypeOrder.map(t => <option key={t} value={t}>{buildingTypeLabels[t]}</option>)}
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Statut</label>
              <Select value={form.status} onChange={e => set('status', e.target.value as ProjectStatus)}>
                <option value="NON_PLANIFIE">Non planifié</option>
                <option value="PLANIFIE">Planifié</option>
                <option value="EN_COURS">En cours</option>
                <option value="EN_REVUE">En revue</option>
                <option value="TERMINE">Terminé</option>
                <option value="ARCHIVE">Archivé</option>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Dimensions et surfaces</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="text-sm font-medium mb-1 block">Nombre d'appartements</label><Input type="number" value={form.nbApartments} onChange={e => set('nbApartments', e.target.value)} /></div>
            <div><label className="text-sm font-medium mb-1 block">Nombre d'étages</label><Input type="number" value={form.nbFloors} onChange={e => set('nbFloors', e.target.value)} /></div>
            <div><label className="text-sm font-medium mb-1 block">Hauteur d'étage (m)</label><Input type="number" step="0.1" value={form.floorHeight} onChange={e => set('floorHeight', e.target.value)} /></div>
            <div><label className="text-sm font-medium mb-1 block">Surface plancher (m²)</label><Input type="number" value={form.floorArea} onChange={e => set('floorArea', e.target.value)} /></div>
            <div><label className="text-sm font-medium mb-1 block">Surface bâtie (m²)</label><Input type="number" value={form.builtArea} onChange={e => set('builtArea', e.target.value)} /></div>
            <div><label className="text-sm font-medium mb-1 block">Surface façade (m²)</label><Input type="number" value={form.facadeArea} onChange={e => set('facadeArea', e.target.value)} /></div>
            <div><label className="text-sm font-medium mb-1 block">Surface terrain (m²)</label><Input type="number" value={form.terrainArea} onChange={e => set('terrainArea', e.target.value)} /></div>
            <div><label className="text-sm font-medium mb-1 block">Périmètre (ml)</label><Input type="number" value={form.perimeter} onChange={e => set('perimeter', e.target.value)} /></div>
            <div><label className="text-sm font-medium mb-1 block">% fenêtres</label><Input type="number" value={form.windowPct} onChange={e => set('windowPct', e.target.value)} /></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Paramètres financiers</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="text-sm font-medium mb-1 block">Honoraires (%)</label><Input type="number" value={form.honoraryPct} onChange={e => set('honoraryPct', e.target.value)} /></div>
            <div><label className="text-sm font-medium mb-1 block">Réserve (%)</label><Input type="number" value={form.reservePct} onChange={e => set('reservePct', e.target.value)} /></div>
            <div><label className="text-sm font-medium mb-1 block">Nombre de cages</label><Input type="number" value={form.nbStaircases} onChange={e => set('nbStaircases', e.target.value)} /></div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate(-1)} disabled={update.isPending}>Annuler</Button>
        <Button onClick={() => { setError(null); update.mutate() }} disabled={update.isPending}>
          {update.isPending
            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enregistrement…</>
            : <><Save className="mr-2 h-4 w-4" />Enregistrer les modifications</>}
        </Button>
      </div>
    </div>
  )
}
