import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Camera, Image, Trash2, Save, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardContent, Badge, Input, Textarea, Select } from '@/components/ui'
import { mockDiagnostics, mockCFCItems, stateLabels, stateColors, priorityColors } from '@/data/mock'
import { formatCHF, cn } from '@/lib/utils'

export function DiagnosticItemDetail() {
  const { id, itemId } = useParams()
  const navigate = useNavigate()
  const diagnostic = mockDiagnostics.find(d => d.id === id) ?? mockDiagnostics[0]
  const item = diagnostic.items.find(i => i.id === itemId) ?? diagnostic.items[0]
  const itemIndex = diagnostic.items.findIndex(i => i.id === item.id)
  const cfcItem = mockCFCItems.find(c => c.code === item.cfcCode)
  const prevItem = itemIndex > 0 ? diagnostic.items[itemIndex - 1] : null
  const nextItem = itemIndex < diagnostic.items.length - 1 ? diagnostic.items[itemIndex + 1] : null

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link to={`/app/diagnostic/${diagnostic.id}`}><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="font-mono text-lg text-muted-foreground">{item.cfcCode}</span>
            <h1 className="text-xl font-bold">{item.cfcLabel}</h1>
          </div>
          <p className="text-sm text-muted-foreground">Element {itemIndex + 1} sur {diagnostic.items.length}</p>
        </div>
        <div className="flex gap-2">
          {prevItem && <Button variant="outline" size="icon" onClick={() => navigate(`/app/diagnostic/${diagnostic.id}/item/${prevItem.id}`)}><ChevronLeft className="h-4 w-4" /></Button>}
          {nextItem && <Button variant="outline" size="icon" onClick={() => navigate(`/app/diagnostic/${diagnostic.id}/item/${nextItem.id}`)}><ChevronRight className="h-4 w-4" /></Button>}
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Photos</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-4 flex-wrap">
            {item.photos.map((_, i) => (
              <div key={i} className="relative group">
                <div className="h-40 w-56 rounded-lg bg-muted flex items-center justify-center border"><Image className="h-10 w-10 text-muted-foreground" /></div>
                <button className="absolute top-2 right-2 h-7 w-7 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="h-3.5 w-3.5" /></button>
                <Input placeholder="Legende..." className="mt-2 text-xs h-8" />
              </div>
            ))}
            <button className="h-40 w-40 rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors">
              <Camera className="h-8 w-8 mb-2" /><span className="text-sm font-medium">Ajouter</span><span className="text-xs">Max 6 photos</span>
            </button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Etat et priorite</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="text-sm font-medium mb-3">Etat de l'element</p>
              <div className="grid grid-cols-2 gap-2">
                {(['TRES_BON', 'BON', 'MOYEN', 'MAUVAIS'] as const).map(state => (
                  <button key={state} className={cn('py-3 rounded-lg text-sm font-medium border-2 transition-colors', item.state === state ? `${stateColors[state]} text-white border-transparent` : 'bg-background border-muted hover:border-primary/30')}>{stateLabels[state]}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-3">Priorite</p>
              <div className="flex gap-2">
                {(['I', 'II', 'III'] as const).map(p => (
                  <button key={p} className={cn('flex-1 py-3 rounded-lg text-sm font-bold border-2 transition-colors', item.priority === p ? `${priorityColors[p]} border-transparent` : 'bg-background border-muted hover:border-primary/30')}>Priorite {p}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Annee d'installation</p>
              <Input type="number" defaultValue={item.yearInstalled} placeholder="Ex: 1995" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Quantites et couts</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-sm font-medium mb-1 block">Quantite</label><Input type="number" defaultValue={item.area} /></div>
              <div><label className="text-sm font-medium mb-1 block">Unite</label>
                <Select defaultValue={item.unit || cfcItem?.unit}>
                  <option value="m2">m2</option><option value="ml">ml</option><option value="m3">m3</option><option value="pce">pce</option><option value="fft">fft</option>
                </Select>
              </div>
            </div>
            {cfcItem && (
              <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Prix unitaire CFC {cfcItem.code}</p>
                <div className="flex gap-4 text-sm">
                  <span>Min: {formatCHF(cfcItem.priceMin)}</span>
                  <span className="font-bold">Moy: {formatCHF(cfcItem.priceAvg)}</span>
                  <span>Max: {formatCHF(cfcItem.priceMax)}</span>
                </div>
              </div>
            )}
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-sm text-muted-foreground">Cout estime</p>
              <p className="text-2xl font-bold text-primary">{formatCHF(item.estimatedCost)}</p>
              <p className="text-xs text-muted-foreground mt-1">= {item.area || 1} {item.unit || 'fft'} x {cfcItem ? formatCHF(cfcItem.priceAvg) : '-'}/unite</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Travaux recommandes</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            {item.works.map((w, i) => (
              <Badge key={i} variant="secondary" className="py-1.5 px-3 text-sm">{w}<button className="ml-2 text-muted-foreground hover:text-destructive">&times;</button></Badge>
            ))}
          </div>
          {cfcItem && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Suggestions :</p>
              <div className="flex flex-wrap gap-2">
                {cfcItem.works.filter(w => !item.works.includes(w)).map((w, i) => (
                  <button key={i} className="text-xs border rounded-full px-3 py-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors">+ {w}</button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
        <CardContent><Textarea defaultValue={item.notes ?? ''} placeholder="Observations, remarques, details..." rows={4} /></CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="destructive" className="opacity-70 hover:opacity-100"><Trash2 className="mr-2 h-4 w-4" />Supprimer</Button>
        <Button onClick={() => navigate(`/app/diagnostic/${diagnostic.id}`)}><Save className="mr-2 h-4 w-4" />Enregistrer</Button>
      </div>
    </div>
  )
}
