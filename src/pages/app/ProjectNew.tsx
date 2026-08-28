import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Check, Loader2, AlertCircle, Plus, X } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select, Badge } from '@/components/ui'
import { AddressAutocomplete, type AddressSelection } from '@/components/AddressAutocomplete'
import { fetchRegistryInfo } from '@/lib/geoadmin'
import { computeProjectMetrics, perimeterWarning } from '@/lib/formulas'
import { buildingTypeLabels, type BuildingType } from '@/data/mock'
import { cn } from '@/lib/utils'
import { api, ApiError } from '@/lib/api'
import type { AggregationMode, RoofType } from '@/lib/api-types'

const buildingTypeOrder: BuildingType[] = ['LOGEMENT', 'VILLA', 'CHALET', 'SCOLAIRE', 'BUREAU', 'ADMINISTRATIF', 'INDUSTRIEL', 'HOTEL', 'COMMERCIAL', 'AUTRE']

const CANTONS = ['VD', 'GE', 'FR', 'NE', 'VS', 'BE', 'JU', 'ZH', 'LU', 'TI', 'SG', 'AG', 'GR', 'BL', 'BS', 'SO', 'TG', 'SZ', 'ZG', 'SH', 'AR', 'AI', 'NW', 'OW', 'UR', 'GL']

// Types d'habitation : seuls eux ont un « nombre d'appartements ».
const RESIDENTIAL: BuildingType[] = ['LOGEMENT', 'VILLA', 'CHALET']
const isResidential = (t: BuildingType) => RESIDENTIAL.includes(t)

// Bâtiment supplémentaire ajouté sur la même fiche (rempli auto depuis l'adresse).
interface ExtraBuilding {
  address: string
  postalCode: string
  city: string
  canton: string
  parcelNumber: string
  buildingType: BuildingType
  yearBuilt: Num
  renovationYear: Num
  nbApartments: Num
  nbFloors: Num
  builtArea: Num
  perimeter: Num
  floorArea: Num
  terrainArea: Num
}

const emptyBuilding = (): ExtraBuilding => ({
  address: '', postalCode: '', city: '', canton: 'VD', parcelNumber: '', buildingType: 'LOGEMENT',
  yearBuilt: '', renovationYear: '', nbApartments: '', nbFloors: '', builtArea: '', perimeter: '', floorArea: '', terrainArea: '',
})

type Num = number | ''

interface FormState {
  name: string
  address: string
  postalCode: string
  city: string
  canton: string
  buildingType: BuildingType
  roofType: '' | RoofType
  parcelNumber: string
  yearBuilt: Num
  renovationYear: Num
  nbApartments: Num
  nbFloors: Num
  floorHeight: Num
  nbStaircases: Num
  honoraryPct: Num
  reservePct: Num
  windowPct: number
  floorArea: Num
  builtArea: Num
  perimeter: Num
  terrainArea: Num
}

// Champs requis par étape : c'est ce qui déclenche la notification avant de passer à la suite.
const REQUIRED: Record<number, { key: keyof FormState; label: string }[]> = {
  1: [
    { key: 'name', label: 'Nom du diagnostic' },
    { key: 'address', label: 'Adresse' },
    { key: 'postalCode', label: 'Code postal' },
    { key: 'city', label: 'Ville' },
    { key: 'canton', label: 'Canton' },
    { key: 'yearBuilt', label: 'Année de construction' },
    { key: 'nbApartments', label: "Nombre d'appartements" },
    { key: 'nbFloors', label: "Nombre d'étages" },
  ],
  2: [
    { key: 'floorArea', label: 'Surface de plancher' },
    { key: 'builtArea', label: 'Surface bâtie' },
    { key: 'perimeter', label: 'Périmètre' },
  ],
}

const isEmpty = (v: unknown) => v === '' || v === null || v === undefined

export function ProjectNew() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const operationId = searchParams.get('operationId')
  const [step, setStep] = useState(1)
  const [error, setError] = useState<string | null>(null)
  // Bâtiments supplémentaires ajoutés sur la même fiche (multi-bâtiments).
  const [extras, setExtras] = useState<ExtraBuilding[]>([])
  const [aggregationMode, setAggregationMode] = useState<AggregationMode>('PER_BUILDING')
  const [stepError, setStepError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Set<string>>(new Set())

  const [enriching, setEnriching] = useState(false)
  const [enrichNote, setEnrichNote] = useState<string | null>(null)

  const [form, setForm] = useState<FormState>({
    name: '', address: '', postalCode: '', city: '', canton: 'VD',
    buildingType: 'LOGEMENT', roofType: '', parcelNumber: '',
    yearBuilt: '', renovationYear: '', nbApartments: '', nbFloors: '', floorHeight: 2.7, nbStaircases: 1,
    honoraryPct: 12, reservePct: 5, windowPct: 0.30,
    floorArea: '', builtArea: '', perimeter: '', terrainArea: '',
  })

  const n = (v: Num) => (v === '' ? 0 : v)

  const metrics = computeProjectMetrics({
    perimeter: n(form.perimeter), nbFloors: n(form.nbFloors), floorHeight: n(form.floorHeight),
    builtArea: n(form.builtArea), floorArea: n(form.floorArea), windowPct: form.windowPct, nbApartments: n(form.nbApartments),
  })

  const create = useMutation({
    mutationFn: async (): Promise<{ kind: 'single'; projectId: string } | { kind: 'multi'; operationId: string }> => {
      const num = (v: Num) => (v === '' ? undefined : v)
      const primary = {
        name: form.name,
        address: form.address,
        postalCode: form.postalCode || undefined,
        city: form.city,
        canton: form.canton,
        parcelNumber: form.parcelNumber || undefined,
        buildingType: form.buildingType,
        roofType: form.roofType || undefined,
        yearBuilt: num(form.yearBuilt),
        renovationYear: num(form.renovationYear),
        nbApartments: num(form.nbApartments),
        nbFloors: num(form.nbFloors),
        floorHeight: num(form.floorHeight),
        nbStaircases: num(form.nbStaircases),
        floorArea: num(form.floorArea),
        builtArea: num(form.builtArea),
        terrainArea: num(form.terrainArea),
        perimeter: num(form.perimeter),
        windowPct: form.windowPct * 100, // form 0-1, API attend 0-100
        honoraryPct: num(form.honoraryPct),
        reservePct: num(form.reservePct),
      }
      const validExtras = extras.filter(b => b.address && b.city)

      // Multi-bâtiments : on crée un regroupement (invisible) + tous les bâtiments.
      if (validExtras.length > 0) {
        const grp = await api.operations.create({ name: form.name, aggregationMode })
        const opId = grp.operation.id
        await api.projects.create({ ...primary, operationId: opId })
        for (let i = 0; i < validExtras.length; i++) {
          const b = validExtras[i]
          await api.projects.create({
            name: b.address || `Bâtiment ${i + 2}`,
            address: b.address,
            postalCode: b.postalCode || undefined,
            city: b.city,
            canton: b.canton,
            parcelNumber: b.parcelNumber || undefined,
            operationId: opId,
            buildingType: b.buildingType,
            yearBuilt: num(b.yearBuilt),
            renovationYear: num(b.renovationYear),
            nbApartments: num(b.nbApartments),
            nbFloors: num(b.nbFloors),
            floorArea: num(b.floorArea),
            builtArea: num(b.builtArea),
            terrainArea: num(b.terrainArea),
            perimeter: num(b.perimeter),
          })
        }
        return { kind: 'multi', operationId: opId }
      }

      // Bâtiment unique (éventuellement rattaché à un groupe existant via l'URL).
      const res = await api.projects.create({ ...primary, operationId: operationId ?? undefined })
      return { kind: 'single', projectId: res.project.id }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      if (data.kind === 'multi') {
        navigate(`/app/diagnostics-multi/${data.operationId}`)
      } else if (operationId) {
        queryClient.invalidateQueries({ queryKey: ['operation', operationId] })
        navigate(`/app/diagnostics-multi/${operationId}`)
      } else {
        navigate(`/app/projects/${data.projectId}`)
      }
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Erreur de création')
    },
  })

  const clearError = (...keys: string[]) =>
    setErrors(prev => {
      if (!keys.some(k => prev.has(k))) return prev
      const next = new Set(prev)
      keys.forEach(k => next.delete(k))
      return next
    })

  const update = (field: keyof FormState, value: string | number) => {
    setForm(prev => ({ ...prev, [field]: value }))
    clearError(field as string)
  }
  const updateNum = (field: keyof FormState, raw: string) =>
    update(field, raw === '' ? '' : Number(raw))

  // Sélection d'une adresse : on remplit adresse/NPA/ville/canton, puis on
  // enrichit avec les registres (parcelle, terrain, année, surface bâtie…).
  const handleAddressSelect = async (sel: AddressSelection) => {
    setForm(prev => ({
      ...prev,
      address: sel.address || prev.address,
      postalCode: sel.postalCode || prev.postalCode,
      city: sel.city || prev.city,
      canton: sel.canton || prev.canton,
    }))
    clearError('address', 'postalCode', 'city', 'canton')
    setEnrichNote(null)
    if (sel.east == null || sel.north == null) return

    setEnriching(true)
    try {
      const info = await fetchRegistryInfo(sel.east, sel.north)
      const filled: string[] = []
      if (info.parcelNumber) filled.push(`parcelle n°${info.parcelNumber}`)
      if (info.terrainArea) filled.push('terrain')
      if (info.yearBuilt) filled.push('année')
      if (info.builtArea) filled.push('surface bâtie')
      if (info.perimeter) filled.push('périmètre')
      if (info.floorArea) filled.push(info.floorAreaEstimated ? 'surface de plancher (estimée)' : 'surface de plancher')
      if (info.buildingType) filled.push('type de bâtiment')
      if (info.nbFloors) filled.push('étages')
      if (info.nbApartments != null) filled.push('logements')

      setForm(prev => ({
        ...prev,
        parcelNumber: info.parcelNumber ?? prev.parcelNumber,
        terrainArea: info.terrainArea ?? prev.terrainArea,
        yearBuilt: info.yearBuilt ?? prev.yearBuilt,
        builtArea: info.builtArea ?? prev.builtArea,
        perimeter: info.perimeter ?? prev.perimeter,
        floorArea: info.floorArea ?? prev.floorArea,
        buildingType: (info.buildingType as BuildingType) ?? prev.buildingType,
        nbFloors: info.nbFloors ?? prev.nbFloors,
        nbApartments: info.nbApartments ?? prev.nbApartments,
      }))
      clearError('yearBuilt', 'nbApartments', 'nbFloors', 'floorArea', 'builtArea', 'perimeter')
      setEnrichNote(
        filled.length
          ? `Pré-rempli automatiquement (registre fédéral RegBL + cadastre) : ${filled.join(', ')}. Vérifiez et ajustez si besoin.`
          : 'Adresse trouvée, mais aucune donnée registre disponible pour ce bâtiment.',
      )
    } catch {
      setEnrichNote(null)
    } finally {
      setEnriching(false)
    }
  }

  const addExtra = () => setExtras(p => [...p, emptyBuilding()])
  const updateExtra = (i: number, patch: Partial<ExtraBuilding>) =>
    setExtras(p => p.map((b, idx) => (idx === i ? { ...b, ...patch } : b)))
  const removeExtra = (i: number) => setExtras(p => p.filter((_, idx) => idx !== i))

  const validateStep = (s: number): boolean => {
    const required = (REQUIRED[s] ?? []).filter(f => f.key !== 'nbApartments' || isResidential(form.buildingType))
    const missing = required.filter(f => isEmpty(form[f.key]))
    if (missing.length > 0) {
      setErrors(new Set(missing.map(m => m.key as string)))
      setStepError(`Merci de compléter : ${missing.map(m => m.label).join(', ')}.`)
      return false
    }
    setStepError(null)
    return true
  }

  const goNext = () => {
    if (step < 3) {
      if (validateStep(step)) setStep(step + 1)
    } else {
      setError(null)
      create.mutate()
    }
  }

  const errCls = (key: keyof FormState) =>
    errors.has(key as string) ? 'border-red-400 focus-visible:ring-red-300' : ''

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <div>
          <h1 className="text-2xl font-bold">{operationId ? 'Ajouter un bâtiment' : 'Nouveau diagnostic'}</h1>
          <p className="text-muted-foreground">Étape {step} sur 3{operationId ? " · rattaché à l'opération" : ''}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-6">
        {[1, 2, 3].map(s => (
          <div key={s} className="flex shrink-0 items-center gap-2">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${s < step ? 'bg-green-500 text-white' : s === step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              {s < step ? <Check className="h-4 w-4" /> : s}
            </div>
            <span className={`hidden text-sm sm:inline ${s === step ? 'font-medium' : 'text-muted-foreground'}`}>
              {s === 1 ? 'Informations' : s === 2 ? 'Surfaces' : 'Récapitulatif'}
            </span>
            {s < 3 && <div className="h-0.5 w-6 shrink-0 bg-muted mx-1 sm:w-12" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <>
        <Card>
          <CardHeader><CardTitle>Informations du diagnostic</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 items-end gap-4">
              <div className="col-span-2">
                <label className="text-sm font-medium mb-1 block">Nom du diagnostic</label>
                <Input value={form.name} onChange={e => update('name', e.target.value)} placeholder="Ex: Rénovation Résidence du Lac" className={errCls('name')} />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium mb-1 block">Adresse</label>
                <AddressAutocomplete
                  value={form.address}
                  onChange={v => update('address', v)}
                  onSelect={handleAddressSelect}
                  invalid={errors.has('address')}
                />
                {enriching ? (
                  <p className="text-xs text-primary mt-1 flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />Récupération des infos du bâtiment…
                  </p>
                ) : enrichNote ? (
                  <p className="text-xs text-emerald-700 mt-1">{enrichNote}</p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">Commencez à taper, puis choisissez l'adresse : NPA, ville, canton, parcelle, terrain, année et surface se remplissent automatiquement.</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Code postal</label>
                <Input value={form.postalCode} onChange={e => update('postalCode', e.target.value)} placeholder="1006" maxLength={4} className={errCls('postalCode')} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Ville</label>
                <Input value={form.city} onChange={e => update('city', e.target.value)} placeholder="Lausanne" className={errCls('city')} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Canton</label>
                <Select value={form.canton} onChange={e => update('canton', e.target.value)} className={errCls('canton')}>
                  {CANTONS.map(c => <option key={c}>{c}</option>)}
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Année de construction</label>
                <Input type="number" value={form.yearBuilt} onChange={e => updateNum('yearBuilt', e.target.value)} placeholder="Ex: 1980" className={errCls('yearBuilt')} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Année de rénovation</label>
                <Input type="number" value={form.renovationYear} onChange={e => updateNum('renovationYear', e.target.value)} placeholder="Si déjà rénové" />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium mb-1 block">Type de bâtiment</label>
                <Select
                  value={form.buildingType}
                  onChange={e => {
                    const t = e.target.value as BuildingType
                    update('buildingType', t)
                    if (!isResidential(t)) update('nbApartments', '')
                  }}
                >
                  {buildingTypeOrder.map(t => <option key={t} value={t}>{buildingTypeLabels[t]}</option>)}
                </Select>
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium mb-1 block">Type de toiture</label>
                <Select value={form.roofType} onChange={e => update('roofType', e.target.value)}>
                  <option value="">Non précisé</option>
                  <option value="PLATE">Plate</option>
                  <option value="PENTE">En pente</option>
                  <option value="MIXTE">Mixte</option>
                </Select>
                <p className="text-[11px] text-muted-foreground mt-1">Sert au calcul de la surface de toiture. Si non précisé, elle n'est pas présumée.</p>
              </div>
              {isResidential(form.buildingType) && (
                <div>
                  <label className="text-sm font-medium mb-1 block">Nombre d'appartements</label>
                  <Input type="number" value={form.nbApartments} onChange={e => updateNum('nbApartments', e.target.value)} placeholder="Ex: 12" className={errCls('nbApartments')} />
                </div>
              )}
              <div>
                <label className="text-sm font-medium mb-1 block">Nombre d'etages</label>
                <Input type="number" value={form.nbFloors} onChange={e => updateNum('nbFloors', e.target.value)} placeholder="Ex: 4" className={errCls('nbFloors')} />
                <p className="text-[11px] text-muted-foreground mt-1">Valeur du registre fédéral — combles/sous-sol parfois comptés, ajustez si besoin.</p>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Hauteur d'etage (m)</label>
                <Input type="number" step="0.1" value={form.floorHeight} onChange={e => updateNum('floorHeight', e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Nombre de cages</label>
                <Input type="number" value={form.nbStaircases} onChange={e => updateNum('nbStaircases', e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Honoraires (%)</label>
                <Input type="number" value={form.honoraryPct} onChange={e => updateNum('honoraryPct', e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Reserve (%)</label>
                <Input type="number" value={form.reservePct} onChange={e => updateNum('reservePct', e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {!operationId && extras.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Bâtiments supplémentaires</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {extras.map((b, i) => (
                <ExtraBuildingCard key={i} index={i} value={b} onChange={(patch) => updateExtra(i, patch)} onRemove={() => removeExtra(i)} />
              ))}

              {extras.some(b => b.address && b.city) && (
                <div className="pt-3 border-t">
                  <p className="text-sm font-medium mb-1">Comment traiter ces bâtiments ?</p>
                  <p className="text-xs text-muted-foreground mb-2">Ensemble : coûts et rapport cumulés. Séparé : un par bâtiment.</p>
                  <div className="inline-flex rounded-lg bg-muted p-1">
                    {([['TOTAL', 'Ensemble'], ['PER_BUILDING', 'Séparé']] as const).map(([v, label]) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setAggregationMode(v)}
                        className={cn('px-4 py-1.5 rounded-md text-sm font-medium transition-colors', aggregationMode === v ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}
                      >{label}</button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {!operationId && (
          <Button type="button" variant="outline" className="w-full" onClick={addExtra}>
            <Plus className="mr-2 h-4 w-4" />Ajouter une adresse
          </Button>
        )}
        </>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Surfaces</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Surface de plancher (m2)</label>
                  <Input type="number" value={form.floorArea} onChange={e => updateNum('floorArea', e.target.value)} placeholder="Ex: 1800" className={errCls('floorArea')} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Surface batie (m2)</label>
                  <Input type="number" value={form.builtArea} onChange={e => updateNum('builtArea', e.target.value)} placeholder="Ex: 450" className={errCls('builtArea')} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Perimetre (ml)</label>
                  <Input type="number" value={form.perimeter} onChange={e => updateNum('perimeter', e.target.value)} placeholder="Ex: 90" className={errCls('perimeter')} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Surface terrain (m2)</label>
                  <Input type="number" value={form.terrainArea} onChange={e => updateNum('terrainArea', e.target.value)} placeholder="Ex: 800" />
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium mb-1 block">Pourcentage fenetres : {Math.round(form.windowPct * 100)}%</label>
                  <input type="range" min="10" max="60" value={form.windowPct * 100} onChange={e => update('windowPct', +e.target.value / 100)}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                  <div className="flex justify-between text-xs text-muted-foreground"><span>10%</span><span>60%</span></div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Calculs automatiques</CardTitle>
              {metrics.facade === 0 && (
                <p className="text-xs text-muted-foreground">
                  Renseignez les surfaces ci-dessus pour calculer façade, fenêtres, toitures et échafaudage.
                </p>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Facade', value: metrics.facade, unit: 'm2' },
                  { label: 'Fenetres', value: metrics.windows, unit: 'm2' },
                  // Tant que le type de toiture n'est pas précisé, on affiche les deux
                  // hypothèses comme telles : elles ne servent à aucun chiffrage.
                  { label: 'Toiture (si plate)', value: metrics.flatRoof, unit: 'm2, à préciser' },
                  { label: 'Toiture (si en pente)', value: metrics.slopedRoof, unit: 'm2, à préciser' },
                  { label: 'Echafaudage', value: metrics.scaffolding, unit: 'm2' },
                  { label: 'Communs', value: metrics.commons, unit: 'm2' },
                  { label: 'Carrelage SDB', value: metrics.tilesBathrooms, unit: 'm2' },
                  { label: 'Carrelage cuisine', value: metrics.tilesKitchens, unit: 'm2' },
                  { label: 'Portes palieres', value: metrics.entranceDoors, unit: 'pce' },
                  { label: 'Portes interieures', value: metrics.interiorDoors, unit: 'pce' },
                ].map(m => (
                  <div key={m.label} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="text-sm">{m.label}</span>
                    <span className={cn('text-sm font-semibold', m.value > 0 ? '' : 'text-muted-foreground font-normal')}>
                      {m.value > 0 ? `${m.value.toFixed(0)} ${m.unit}` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {step === 3 && (
        <Card>
          <CardHeader><CardTitle>Récapitulatif</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium">Informations generales</h4>
                <div className="space-y-1 text-sm">
                  <p><span className="text-muted-foreground">Nom :</span> {form.name}</p>
                  <p><span className="text-muted-foreground">Adresse :</span> {form.address}, {form.postalCode} {form.city} ({form.canton})</p>
                  <p><span className="text-muted-foreground">Année :</span> {form.yearBuilt}{form.renovationYear ? `, rénové en ${form.renovationYear}` : ''}</p>
                  <p><span className="text-muted-foreground">Type :</span> <Badge variant="secondary">{buildingTypeLabels[form.buildingType]}</Badge></p>
                  {form.parcelNumber && <p><span className="text-muted-foreground">Parcelle :</span> n°{form.parcelNumber}</p>}
                  <p><span className="text-muted-foreground">Appartements :</span> {form.nbApartments}</p>
                  <p><span className="text-muted-foreground">Etages :</span> {form.nbFloors}</p>
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Surfaces</h4>
                <div className="space-y-1 text-sm">
                  <p><span className="text-muted-foreground">Plancher :</span> {form.floorArea} m2</p>
                  <p><span className="text-muted-foreground">Batie :</span> {form.builtArea} m2</p>
                  <p><span className="text-muted-foreground">Facade :</span> {metrics.facade.toFixed(0)} m2</p>
                  <p><span className="text-muted-foreground">Fenetres :</span> {metrics.windows.toFixed(0)} m2 ({Math.round(form.windowPct * 100)}%)</p>
                  <p><span className="text-muted-foreground">Terrain :</span> {form.terrainArea} m2</p>
                  <p><span className="text-muted-foreground">Perimetre :</span> {form.perimeter} ml</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {stepError && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />{stepError}
        </div>
      )}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" disabled={create.isPending} onClick={() => step > 1 ? setStep(step - 1) : navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />{step > 1 ? 'Précédent' : 'Annuler'}
        </Button>
        <Button disabled={create.isPending} onClick={goNext} className={cn(step === 3 && 'min-w-44')}>
          {step < 3
            ? <>Suivant<ArrowRight className="ml-2 h-4 w-4" /></>
            : create.isPending
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Création…</>
              : <><Check className="mr-2 h-4 w-4" />Créer le diagnostic</>}
        </Button>
      </div>
    </div>
  )
}

// ---------- Carte d'un bâtiment supplémentaire (auto-rempli depuis l'adresse) ----------

function ExtraBuildingCard({ index, value, onChange, onRemove }: {
  index: number
  value: ExtraBuilding
  onChange: (patch: Partial<ExtraBuilding>) => void
  onRemove: () => void
}) {
  const [enriching, setEnriching] = useState(false)
  // Garde-fou : les données de registre couvrent parfois un îlot entier, pas le bâtiment.
  const perimetreDouteux = perimeterWarning(Number(value.perimeter) || null, Number(value.builtArea) || null)

  const onSelect = async (sel: AddressSelection) => {
    onChange({
      address: sel.address || value.address,
      postalCode: sel.postalCode || '',
      city: sel.city || '',
      canton: sel.canton || value.canton,
    })
    if (sel.east == null || sel.north == null) return
    setEnriching(true)
    try {
      const info = await fetchRegistryInfo(sel.east, sel.north)
      onChange({
        parcelNumber: info.parcelNumber ?? value.parcelNumber,
        terrainArea: info.terrainArea ?? '',
        yearBuilt: info.yearBuilt ?? '',
        builtArea: info.builtArea ?? '',
        perimeter: info.perimeter ?? '',
        floorArea: info.floorArea ?? '',
        nbFloors: info.nbFloors ?? '',
        nbApartments: info.nbApartments ?? '',
        buildingType: (info.buildingType as BuildingType) ?? value.buildingType,
      })
    } catch {
      /* réseau : on ignore */
    } finally {
      setEnriching(false)
    }
  }

  const setNum = (k: keyof ExtraBuilding) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ [k]: e.target.value === '' ? '' : Number(e.target.value) } as Partial<ExtraBuilding>)

  return (
    <div className="rounded-lg border p-4 space-y-3 bg-muted/20">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Bâtiment {index + 2}</span>
        <Button type="button" variant="ghost" size="icon" onClick={onRemove} className="h-8 w-8 text-muted-foreground hover:text-red-600">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div>
        <label className="text-sm font-medium mb-1 block">Adresse</label>
        <AddressAutocomplete value={value.address} onChange={(v) => onChange({ address: v })} onSelect={onSelect} />
        {enriching && (
          <p className="text-xs text-primary mt-1 flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" />Récupération des infos…</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium mb-1 block">Code postal</label>
          <Input value={value.postalCode} onChange={(e) => onChange({ postalCode: e.target.value })} placeholder="1006" maxLength={4} />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Ville</label>
          <Input value={value.city} onChange={(e) => onChange({ city: e.target.value })} placeholder="Lausanne" />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Canton</label>
          <Select value={value.canton} onChange={(e) => onChange({ canton: e.target.value })}>
            {CANTONS.map(c => <option key={c}>{c}</option>)}
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Année</label>
          <Input type="number" value={value.yearBuilt} onChange={setNum('yearBuilt')} placeholder="Ex: 1980" />
        </div>
        <div className="col-span-2">
          <label className="text-sm font-medium mb-1 block">Type de bâtiment</label>
          <Select
            value={value.buildingType}
            onChange={(e) => {
              const t = e.target.value as BuildingType
              onChange(isResidential(t) ? { buildingType: t } : { buildingType: t, nbApartments: '' })
            }}
          >
            {buildingTypeOrder.map(t => <option key={t} value={t}>{buildingTypeLabels[t]}</option>)}
          </Select>
        </div>
        {isResidential(value.buildingType) && (
          <div>
            <label className="text-sm font-medium mb-1 block">Appartements</label>
            <Input type="number" value={value.nbApartments} onChange={setNum('nbApartments')} placeholder="Ex: 12" />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium mb-1 block">Surface bâtie (m²)</label>
          <Input type="number" value={value.builtArea} onChange={setNum('builtArea')} />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Surface plancher (m²)</label>
          <Input type="number" value={value.floorArea} onChange={setNum('floorArea')} />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Périmètre (ml)</label>
          <Input type="number" value={value.perimeter} onChange={setNum('perimeter')} />
          {perimetreDouteux && <p className="mt-1 text-[11px] text-amber-700">{perimetreDouteux}</p>}
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Terrain (m²)</label>
          <Input type="number" value={value.terrainArea} onChange={setNum('terrainArea')} />
        </div>
      </div>
    </div>
  )
}
