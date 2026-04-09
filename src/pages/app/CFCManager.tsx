import { useState } from 'react'
import { Search, Edit3, Save, X, ChevronRight, ChevronDown, Download, Upload, Plus, Trash2 } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardContent, Input, Badge, Select, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui'
import { mockCFCItems, cfcCategories } from '@/data/mock'
import { formatCHF, cn } from '@/lib/utils'

export function CFCManager() {
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['2', '3', '4', '5']))

  const toggleGroup = (code: string) => {
    const next = new Set(expandedGroups)
    next.has(code) ? next.delete(code) : next.add(code)
    setExpandedGroups(next)
  }

  const filtered = mockCFCItems.filter(item => {
    if (search && !item.code.includes(search) && !item.label.toLowerCase().includes(search.toLowerCase())) return false
    if (selectedCategory && !item.category.includes(selectedCategory)) return false
    return true
  })

  const categories = [...new Set(mockCFCItems.map(i => i.category))]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Codes CFC et prix</h1>
          <p className="text-muted-foreground">{mockCFCItems.length} elements - Prix unitaires personnalisables</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline"><Upload className="mr-2 h-4 w-4" />Importer CSV</Button>
          <Button variant="outline"><Download className="mr-2 h-4 w-4" />Exporter</Button>
          <Button><Plus className="mr-2 h-4 w-4" />Ajouter un code</Button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar categories */}
        <Card className="w-72 shrink-0 self-start">
          <CardHeader className="py-3 px-4"><CardTitle className="text-sm">Categories CFC</CardTitle></CardHeader>
          <CardContent className="px-2 pb-4 pt-0">
            <button onClick={() => setSelectedCategory(null)} className={cn('w-full text-left px-3 py-2 rounded text-sm transition-colors', !selectedCategory ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted')}>
              Toutes les categories
            </button>
            {cfcCategories.map(cat => (
              <div key={cat.code}>
                <button onClick={() => toggleGroup(cat.code)} className="flex items-center gap-2 w-full text-left px-3 py-2 rounded text-sm hover:bg-muted/50 font-medium">
                  {expandedGroups.has(cat.code) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  <span className="font-mono text-xs text-muted-foreground">{cat.code}</span>
                  {cat.label}
                </button>
                {expandedGroups.has(cat.code) && cat.children.map(sub => (
                  <button key={sub.code} onClick={() => setSelectedCategory(sub.label)} className={cn('w-full text-left pl-10 pr-3 py-1.5 rounded text-sm transition-colors', selectedCategory === sub.label ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/50')}>
                    <span className="font-mono text-xs mr-2">{sub.code}</span>{sub.label}
                  </button>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Main table */}
        <div className="flex-1 space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher par code ou designation..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
            </div>
            <Select className="w-48" value={selectedCategory ?? ''} onChange={e => setSelectedCategory(e.target.value || null)}>
              <option value="">Toutes</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Code</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead className="w-16">Unite</TableHead>
                    <TableHead className="text-right w-28">Prix min</TableHead>
                    <TableHead className="text-right w-28">Prix moy</TableHead>
                    <TableHead className="text-right w-28">Prix max</TableHead>
                    <TableHead>Categorie</TableHead>
                    <TableHead className="w-24">Travaux</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(item => (
                    <TableRow key={item.id} className={editingId === item.id ? 'bg-primary/5' : ''}>
                      <TableCell className="font-mono font-bold">{item.code}</TableCell>
                      <TableCell>
                        {editingId === item.id ? <Input defaultValue={item.label} className="h-8 text-sm" /> : <span className="font-medium">{item.label}</span>}
                      </TableCell>
                      <TableCell>
                        {editingId === item.id ? (
                          <Select defaultValue={item.unit} className="h-8 text-sm w-16">
                            <option>m2</option><option>ml</option><option>m3</option><option>pce</option><option>fft</option>
                          </Select>
                        ) : <Badge variant="outline" className="text-xs">{item.unit}</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        {editingId === item.id ? <Input type="number" defaultValue={item.priceMin} className="h-8 text-sm text-right w-24" /> : <span className="text-muted-foreground">{formatCHF(item.priceMin)}</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        {editingId === item.id ? <Input type="number" defaultValue={item.priceAvg} className="h-8 text-sm text-right font-bold w-24" /> : <span className="font-semibold">{formatCHF(item.priceAvg)}</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        {editingId === item.id ? <Input type="number" defaultValue={item.priceMax} className="h-8 text-sm text-right w-24" /> : <span className="text-muted-foreground">{formatCHF(item.priceMax)}</span>}
                      </TableCell>
                      <TableCell><span className="text-xs text-muted-foreground">{item.category}</span></TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {item.works.slice(0, 1).map((w, i) => <Badge key={i} variant="secondary" className="text-[10px]">{w}</Badge>)}
                          {item.works.length > 1 && <Badge variant="secondary" className="text-[10px]">+{item.works.length - 1}</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        {editingId === item.id ? (
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingId(null)}><Save className="h-3.5 w-3.5 text-green-600" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingId(null)}><X className="h-3.5 w-3.5 text-red-500" /></Button>
                          </div>
                        ) : (
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingId(item.id)}><Edit3 className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7"><Trash2 className="h-3.5 w-3.5 text-red-400" /></Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{filtered.length} elements affiches sur {mockCFCItems.length}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled>Precedent</Button>
              <Button variant="outline" size="sm">1</Button>
              <Button variant="outline" size="sm" disabled>Suivant</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
