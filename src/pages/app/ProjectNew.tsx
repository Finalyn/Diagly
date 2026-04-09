import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, MapPin } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select, Badge } from '@/components/ui'
import { computeProjectMetrics } from '@/lib/formulas'
import { formatCHF } from '@/lib/utils'

export function ProjectNew() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    name: '', address: '', city: '', canton: 'VD', yearBuilt: 1980, buildingType: 'LOGEMENT',
    nbApartments: 12, nbFloors: 4, floorHeight: 2.7, nbStaircases: 1,
    honoraryPct: 12, reservePct: 5, windowPct: 0.30,
    floorArea: 1800, builtArea: 450, perimeter: 90, terrainArea: 800,
  })

  const metrics = computeProjectMetrics({
    perimeter: form.perimeter, nbFloors: form.nbFloors, floorHeight: form.floorHeight,
    builtArea: form.builtArea, floorArea: form.floorArea, windowPct: form.windowPct, nbApartments: form.nbApartments,
  })

  const update = (field: string, value: string | number) => setForm(prev => ({ ...prev, [field]: value }))

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <div>
          <h1 className="text-2xl font-bold">Nouveau projet</h1>
          <p className="text-muted-foreground">Etape {step} sur 3</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        {[1, 2, 3].map(s => (
          <div key={s} className="flex items-center gap-2">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${s < step ? 'bg-green-500 text-white' : s === step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              {s < step ? <Check className="h-4 w-4" /> : s}
            </div>
            <span className={`text-sm ${s === step ? 'font-medium' : 'text-muted-foreground'}`}>
              {s === 1 ? 'Informations' : s === 2 ? 'Metres' : 'Recapitulatif'}
            </span>
            {s < 3 && <div className="w-12 h-0.5 bg-muted mx-1" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <Card>
          <CardHeader><CardTitle>Informations du projet</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-sm font-medium mb-1 block">Nom du projet</label>
                <Input value={form.name} onChange={e => update('name', e.target.value)} placeholder="Ex: Renovation Residence du Lac" />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium mb-1 block">Adresse</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={form.address} onChange={e => update('address', e.target.value)} placeholder="Rechercher une adresse..." className="pl-10" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Ville</label>
                <Input value={form.city} onChange={e => update('city', e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Canton</label>
                <Select value={form.canton} onChange={e => update('canton', e.target.value)}>
                  {['VD', 'GE', 'FR', 'NE', 'VS', 'BE', 'JU'].map(c => <option key={c}>{c}</option>)}
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Annee de construction</label>
                <Input type="number" value={form.yearBuilt} onChange={e => update('yearBuilt', +e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Type de batiment</label>
                <Select value={form.buildingType} onChange={e => update('buildingType', e.target.value)}>
                  <option value="LOGEMENT">Logement</option>
                  <option value="SCOLAIRE">Scolaire</option>
                  <option value="ADMINISTRATIF">Administratif</option>
                  <option value="INDUSTRIEL">Industriel</option>
                  <option value="HOTEL">Hotel</option>
                  <option value="COMMERCIAL">Commercial</option>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Nombre d'appartements</label>
                <Input type="number" value={form.nbApartments} onChange={e => update('nbApartments', +e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Nombre d'etages</label>
                <Input type="number" value={form.nbFloors} onChange={e => update('nbFloors', +e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Hauteur d'etage (m)</label>
                <Input type="number" step="0.1" value={form.floorHeight} onChange={e => update('floorHeight', +e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Nombre de cages</label>
                <Input type="number" value={form.nbStaircases} onChange={e => update('nbStaircases', +e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Honoraires (%)</label>
                <Input type="number" value={form.honoraryPct} onChange={e => update('honoraryPct', +e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Reserve (%)</label>
                <Input type="number" value={form.reservePct} onChange={e => update('reservePct', +e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Surfaces et metres</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Surface de plancher (m2)</label>
                  <Input type="number" value={form.floorArea} onChange={e => update('floorArea', +e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Surface batie (m2)</label>
                  <Input type="number" value={form.builtArea} onChange={e => update('builtArea', +e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Perimetre (ml)</label>
                  <Input type="number" value={form.perimeter} onChange={e => update('perimeter', +e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Surface terrain (m2)</label>
                  <Input type="number" value={form.terrainArea} onChange={e => update('terrainArea', +e.target.value)} />
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
            <CardHeader><CardTitle>Calculs automatiques</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Facade', value: `${metrics.facade.toFixed(0)} m2` },
                  { label: 'Fenetres', value: `${metrics.windows.toFixed(0)} m2` },
                  { label: 'Toiture plate', value: `${metrics.flatRoof.toFixed(0)} m2` },
                  { label: 'Toiture pente', value: `${metrics.slopedRoof.toFixed(0)} m2` },
                  { label: 'Echafaudage', value: `${metrics.scaffolding.toFixed(0)} m2` },
                  { label: 'Communs', value: `${metrics.commons.toFixed(0)} m2` },
                  { label: 'Carrelage SDB', value: `${metrics.tilesBathrooms} m2` },
                  { label: 'Carrelage cuisine', value: `${metrics.tilesKitchens} m2` },
                  { label: 'Portes palieres', value: `${metrics.entranceDoors} pce` },
                  { label: 'Portes interieures', value: `${metrics.interiorDoors} pce` },
                ].map(m => (
                  <div key={m.label} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="text-sm">{m.label}</span>
                    <span className="text-sm font-semibold">{m.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {step === 3 && (
        <Card>
          <CardHeader><CardTitle>Recapitulatif</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium">Informations generales</h4>
                <div className="space-y-1 text-sm">
                  <p><span className="text-muted-foreground">Nom :</span> {form.name || 'Non renseigne'}</p>
                  <p><span className="text-muted-foreground">Adresse :</span> {form.address || 'Non renseigne'}, {form.city} ({form.canton})</p>
                  <p><span className="text-muted-foreground">Annee :</span> {form.yearBuilt}</p>
                  <p><span className="text-muted-foreground">Type :</span> <Badge variant="secondary">{form.buildingType}</Badge></p>
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

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => step > 1 ? setStep(step - 1) : navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />{step > 1 ? 'Precedent' : 'Annuler'}
        </Button>
        <Button onClick={() => step < 3 ? setStep(step + 1) : navigate('/app/projects')}>
          {step < 3 ? <>Suivant<ArrowRight className="ml-2 h-4 w-4" /></> : <><Check className="mr-2 h-4 w-4" />Creer le projet</>}
        </Button>
      </div>
    </div>
  )
}
