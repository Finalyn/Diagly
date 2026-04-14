import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, ChevronRight, ChevronDown, Camera, Image } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardContent, Badge, Textarea } from '@/components/ui'
import { mockDiagnostics, cfcCategories, stateLabels, stateColors, priorityColors, type ElementState, type Priority, type DiagnosticItem } from '@/data/mock'
import { formatCHF } from '@/lib/utils'
import { cn } from '@/lib/utils'

function TreeNode({ node, level, diagnosed, onSelect, selected }: {
  node: { code: string; label: string; children?: { code: string; label: string; children?: { code: string; label: string }[] }[] }
  level: number
  diagnosed: Set<string>
  onSelect: (code: string) => void
  selected: string | null
}) {
  const [open, setOpen] = useState(level < 2)
  const hasChildren = node.children && node.children.length > 0
  const isDiagnosed = diagnosed.has(node.code)
  const isLeaf = !hasChildren

  return (
    <div>
      <button
        onClick={() => { if (hasChildren) setOpen(!open); if (isLeaf) onSelect(node.code) }}
        className={cn(
          'flex items-center gap-2 w-full text-left px-2 py-1.5 rounded text-sm hover:bg-muted/50 transition-colors',
          selected === node.code && 'bg-primary/10 text-primary',
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
      >
        {hasChildren ? (open ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />) : <span className="w-3.5" />}
        {isLeaf && isDiagnosed && <span className={`h-2 w-2 rounded-full shrink-0 ${diagnosed.has(node.code) ? 'bg-green-500' : ''}`} />}
        {isLeaf && !isDiagnosed && <span className="h-2 w-2 rounded-full shrink-0 bg-gray-300" />}
        <span className="text-xs text-muted-foreground font-mono mr-1">{node.code}</span>
        <span className="truncate">{node.label}</span>
      </button>
      {open && hasChildren && node.children!.map(child => (
        <TreeNode key={child.code} node={child} level={level + 1} diagnosed={diagnosed} onSelect={onSelect} selected={selected} />
      ))}
    </div>
  )
}

export function DiagnosticDetail() {
  const { id } = useParams()
  const diagnostic = mockDiagnostics.find(d => d.id === id) ?? mockDiagnostics[0]
  const [selectedCode, setSelectedCode] = useState<string | null>(diagnostic.items[0]?.cfcCode ?? null)

  const diagnosedCodes = new Set(diagnostic.items.map(i => i.cfcCode))
  const selectedItem = diagnostic.items.find(i => i.cfcCode === selectedCode) ?? null

  const totalCost = diagnostic.items.reduce((s, i) => s + i.estimatedCost, 0)
  const costByPriority = {
    I: diagnostic.items.filter(i => i.priority === 'I').reduce((s, i) => s + i.estimatedCost, 0),
    II: diagnostic.items.filter(i => i.priority === 'II').reduce((s, i) => s + i.estimatedCost, 0),
    III: diagnostic.items.filter(i => i.priority === 'III').reduce((s, i) => s + i.estimatedCost, 0),
  }

  return (
    <div className="h-[calc(100vh-7rem)] flex flex-col gap-4">
      <div className="flex items-center gap-4 shrink-0">
        <button onClick={() => window.history.back()}><ArrowLeft className="h-5 w-5 text-muted-foreground hover:text-foreground" /></button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Diagnostic</h1>
          <p className="text-sm text-muted-foreground">{diagnostic.items.length} elements diagnostiques</p>
        </div>
        <div className="flex gap-4 text-sm">
          {(['I', 'II', 'III'] as const).map(p => (
            <div key={p} className="text-center">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${priorityColors[p]}`}>{p}</span>
              <p className="font-semibold mt-1">{formatCHF(costByPriority[p])}</p>
            </div>
          ))}
          <div className="text-center pl-4 border-l">
            <span className="text-xs text-muted-foreground">Total</span>
            <p className="text-lg font-bold">{formatCHF(totalCost)}</p>
          </div>
        </div>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        <Card className="w-80 shrink-0 overflow-y-auto">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">Arborescence CFC</CardTitle>
          </CardHeader>
          <CardContent className="px-2 py-0 pb-4">
            {cfcCategories.map(cat => (
              <TreeNode key={cat.code} node={cat} level={0} diagnosed={diagnosedCodes} onSelect={setSelectedCode} selected={selectedCode} />
            ))}
          </CardContent>
        </Card>

        <div className="flex-1 overflow-y-auto">
          {selectedItem ? (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-lg text-muted-foreground">{selectedItem.cfcCode}</span>
                  <CardTitle>{selectedItem.cfcLabel}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <p className="text-sm font-medium mb-3">Photos</p>
                  {selectedItem.photos.length > 0 ? (
                    <div className="flex gap-3">
                      {selectedItem.photos.map((_, i) => (
                        <div key={i} className="h-32 w-44 rounded-lg bg-muted flex items-center justify-center border">
                          <Image className="h-8 w-8 text-muted-foreground" />
                        </div>
                      ))}
                      <button className="h-32 w-32 rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                        <Camera className="h-6 w-6 mb-1" />
                        <span className="text-xs">Ajouter</span>
                      </button>
                    </div>
                  ) : (
                    <button className="h-32 w-full rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                      <Camera className="h-6 w-6 mb-1" />
                      <span className="text-sm">Ajouter des photos</span>
                    </button>
                  )}
                </div>

                <div>
                  <p className="text-sm font-medium mb-3">Etat de l'element</p>
                  <div className="flex gap-2">
                    {(['TRES_BON', 'BON', 'MOYEN', 'MAUVAIS'] as const).map(state => (
                      <button key={state} className={cn(
                        'flex-1 py-3 rounded-lg text-sm font-medium border-2 transition-colors',
                        selectedItem.state === state ? `${stateColors[state]} text-white border-transparent` : 'bg-background border-muted hover:border-primary/30'
                      )}>{stateLabels[state]}</button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium mb-3">Priorite</p>
                  <div className="flex gap-2">
                    {(['I', 'II', 'III'] as const).map(p => (
                      <button key={p} className={cn(
                        'px-6 py-3 rounded-lg text-sm font-bold border-2 transition-colors',
                        selectedItem.priority === p ? `${priorityColors[p]} border-transparent` : 'bg-background border-muted hover:border-primary/30'
                      )}>Priorite {p}</button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium mb-2">Travaux recommandes</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedItem.works.map((w, i) => <Badge key={i} variant="secondary">{w}</Badge>)}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm font-medium mb-1">Annee d'installation</p>
                    <p className="text-lg font-semibold">{selectedItem.yearInstalled ?? '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1">Quantite</p>
                    <p className="text-lg font-semibold">{selectedItem.area ? `${selectedItem.area} ${selectedItem.unit}` : '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1">Cout estime</p>
                    <p className="text-lg font-bold text-primary">{formatCHF(selectedItem.estimatedCost)}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium mb-2">Notes</p>
                  <Textarea defaultValue={selectedItem.notes ?? ''} placeholder="Ajouter des notes..." rows={3} />
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-16 text-center">
                <p className="text-muted-foreground">Selectionnez un element CFC dans l'arborescence pour voir ou modifier son diagnostic.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
