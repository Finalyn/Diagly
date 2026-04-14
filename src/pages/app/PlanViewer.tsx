import { useState } from 'react'
import {
  ArrowLeft, MousePointer2, Square, Ruler, Type, Maximize2, ZoomIn, ZoomOut,
  RotateCcw, Download, Upload, Trash2, Eye, EyeOff, Copy, Move,
  Circle, Pen, ArrowUpRight, Settings2, Crosshair, Grid3x3, Minus, Plus,
  Lock, Unlock
} from 'lucide-react'
import { Button, Card, Input, Badge, Select } from '@/components/ui'
import { cn } from '@/lib/utils'

const toolGroups = [
  { label: 'Selection', tools: [
    { id: 'select', icon: MousePointer2, label: 'Selection', shortcut: 'V' },
    { id: 'move', icon: Move, label: 'Deplacer', shortcut: 'H' },
  ]},
  { label: 'Mesures', tools: [
    { id: 'area', icon: Square, label: 'Zone (m2)', shortcut: 'A' },
    { id: 'length', icon: Ruler, label: 'Longueur (ml)', shortcut: 'L' },
    { id: 'volume', icon: Maximize2, label: 'Volume (m3)', shortcut: 'M' },
    { id: 'calibrate', icon: Crosshair, label: 'Calibration echelle', shortcut: 'C' },
  ]},
  { label: 'Annotations', tools: [
    { id: 'annotate', icon: Type, label: 'Texte', shortcut: 'T' },
    { id: 'dimension', icon: ArrowUpRight, label: 'Cotation', shortcut: 'D' },
    { id: 'draw', icon: Pen, label: 'Dessin libre', shortcut: 'P' },
    { id: 'circle', icon: Circle, label: 'Cercle / Ellipse', shortcut: 'O' },
    { id: 'line', icon: Minus, label: 'Ligne', shortcut: 'I' },
  ]},
]

const mockMeasures = [
  { id: 1, type: 'Zone', label: 'Salon', value: '24.5 m2', color: '#3b82f6', locked: false },
  { id: 2, type: 'Zone', label: 'Chambre 1', value: '14.2 m2', color: '#10b981', locked: false },
  { id: 3, type: 'Zone', label: 'Cuisine', value: '11.8 m2', color: '#f59e0b', locked: true },
  { id: 4, type: 'Zone', label: 'SDB', value: '6.9 m2', color: '#8b5cf6', locked: false },
  { id: 5, type: 'Longueur', label: 'Mur nord', value: '8.30 ml', color: '#ef4444', locked: false },
  { id: 6, type: 'Longueur', label: 'Mur est', value: '5.20 ml', color: '#ef4444', locked: false },
  { id: 7, type: 'Longueur', label: 'Cloison SDB', value: '2.40 ml', color: '#ef4444', locked: true },
  { id: 8, type: 'Volume', label: 'Piece principale', value: '66.2 m3', color: '#06b6d4', locked: false },
]

const mockAnnotations = [
  { id: 1, type: 'Texte', label: 'Fissure mur porteur', visible: true },
  { id: 2, type: 'Texte', label: 'Trace humidite', visible: true },
  { id: 3, type: 'Cotation', label: 'Largeur baie', visible: true },
  { id: 4, type: 'Dessin', label: 'Zone degradee', visible: false },
]

const mockLevels = [
  { id: 'ss', label: 'Sous-sol', type: 'FLOOR', hasplan: true },
  { id: 'rdc', label: 'Rez-de-chaussee', type: 'FLOOR', hasplan: true },
  { id: 'e1', label: '1er etage', type: 'FLOOR', hasplan: true },
  { id: 'e2', label: '2e etage', type: 'FLOOR', hasplan: false },
  { id: 'e3', label: '3e etage', type: 'FLOOR', hasplan: false },
  { id: 'toit', label: 'Toiture', type: 'FLOOR', hasplan: true },
]

const mockFacades = [
  { id: 'fn', label: 'Facade Nord', type: 'FACADE', hasplan: true },
  { id: 'fs', label: 'Facade Sud', type: 'FACADE', hasplan: true },
  { id: 'fe', label: 'Facade Est', type: 'FACADE', hasplan: false },
  { id: 'fo', label: 'Facade Ouest', type: 'FACADE', hasplan: false },
]

const mockCoupes = [
  { id: 'ca', label: 'Coupe A-A', type: 'SECTION', hasplan: true },
  { id: 'cb', label: 'Coupe B-B', type: 'SECTION', hasplan: false },
]

export function PlanViewer() {
  const [activeTool, setActiveTool] = useState('select')
  const [scale, setScale] = useState(100)
  const [activeLevel, setActiveLevel] = useState('rdc')
  const [showGrid, setShowGrid] = useState(false)
  const [planScale, setPlanScale] = useState('1:100')
  const [rightTab, setRightTab] = useState<'params' | 'measures' | 'annotations'>('measures')
  const [bottomTab, setBottomTab] = useState<'levels' | 'facades' | 'coupes'>('levels')
  const [calibrating, setCalibrating] = useState(false)

  const totalArea = mockMeasures.filter(m => m.type === 'Zone').reduce((s, m) => s + parseFloat(m.value), 0)
  const totalLength = mockMeasures.filter(m => m.type === 'Longueur').reduce((s, m) => s + parseFloat(m.value), 0)

  return (
    <div className="h-[calc(100vh-7rem)] flex flex-col gap-2">
      {/* Top bar */}
      <div className="flex items-center gap-3 shrink-0">
        <button onClick={() => window.history.back()}><ArrowLeft className="h-5 w-5 text-muted-foreground hover:text-foreground" /></button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold truncate">Plan RDC - Residence du Lac</h1>
          <p className="text-xs text-muted-foreground">Av. de Cour 42, Lausanne</p>
        </div>
        <div className="flex items-center gap-1 px-2 py-1 rounded bg-muted text-xs">
          <span className="text-muted-foreground">Echelle:</span>
          <Select value={planScale} onChange={e => setPlanScale(e.target.value)} className="h-6 text-xs border-0 bg-transparent w-16 p-0">
            <option>1:50</option><option>1:100</option><option>1:200</option><option>1:500</option>
          </Select>
        </div>
        <Button variant={showGrid ? 'secondary' : 'outline'} size="sm" onClick={() => setShowGrid(!showGrid)}><Grid3x3 className="mr-1 h-3.5 w-3.5" />Grille</Button>
        <Button variant="outline" size="sm"><Upload className="mr-1 h-3.5 w-3.5" />Charger plan</Button>
        <Button variant="outline" size="sm"><Download className="mr-1 h-3.5 w-3.5" />Export PDF annote</Button>
      </div>

      <div className="flex gap-2 flex-1 min-h-0">
        {/* Left toolbar */}
        <div className="flex flex-col gap-0.5 shrink-0 bg-background border rounded-lg p-1.5">
          {toolGroups.map((group, gi) => (
            <div key={group.label}>
              {gi > 0 && <div className="h-px bg-border my-1.5" />}
              <p className="text-[9px] uppercase text-muted-foreground font-semibold px-1 mb-0.5">{group.label}</p>
              {group.tools.map(tool => (
                <button
                  key={tool.id}
                  onClick={() => { setActiveTool(tool.id); if (tool.id === 'calibrate') setCalibrating(true) }}
                  className={cn(
                    'h-9 w-9 rounded flex items-center justify-center transition-colors relative group',
                    activeTool === tool.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                  )}
                  title={`${tool.label} (${tool.shortcut})`}
                >
                  <tool.icon className="h-4 w-4" />
                  <span className="absolute left-full ml-2 px-2 py-1 rounded bg-foreground text-background text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50">{tool.label} ({tool.shortcut})</span>
                </button>
              ))}
            </div>
          ))}
          <div className="h-px bg-border my-1.5" />
          <p className="text-[9px] uppercase text-muted-foreground font-semibold px-1 mb-0.5">Zoom</p>
          <button onClick={() => setScale(s => Math.min(300, s + 25))} className="h-9 w-9 rounded flex items-center justify-center hover:bg-muted"><ZoomIn className="h-4 w-4" /></button>
          <button onClick={() => setScale(s => Math.max(25, s - 25))} className="h-9 w-9 rounded flex items-center justify-center hover:bg-muted"><ZoomOut className="h-4 w-4" /></button>
          <button onClick={() => setScale(100)} className="h-9 w-9 rounded flex items-center justify-center hover:bg-muted"><RotateCcw className="h-4 w-4" /></button>
          <div className="text-[10px] text-center text-muted-foreground mt-1">{scale}%</div>
        </div>

        {/* Canvas */}
        <div className="flex-1 flex flex-col gap-2 min-w-0">
          <div className="flex-1 bg-white border rounded-lg overflow-hidden relative cursor-crosshair">
            {/* Grid */}
            {showGrid && (
              <div className="absolute inset-0 opacity-10" style={{
                backgroundImage: 'linear-gradient(#1e40af 1px, transparent 1px), linear-gradient(90deg, #1e40af 1px, transparent 1px)',
                backgroundSize: '20px 20px'
              }} />
            )}

            {/* Plan placeholder with drawn elements */}
            <div className="absolute inset-0 flex items-center justify-center" style={{ transform: `scale(${scale / 100})`, transformOrigin: 'center' }}>
              <div className="w-[900px] h-[650px] bg-gray-50 relative">
                {/* Simulated floor plan lines */}
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 900 650">
                  {/* Outer walls */}
                  <rect x="50" y="50" width="800" height="550" fill="none" stroke="#374151" strokeWidth="3" />
                  {/* Rooms */}
                  <rect x="50" y="50" width="350" height="300" fill="rgba(59,130,246,0.05)" stroke="#6b7280" strokeWidth="1.5" />
                  <rect x="400" y="50" width="220" height="300" fill="rgba(16,185,129,0.05)" stroke="#6b7280" strokeWidth="1.5" />
                  <rect x="620" y="50" width="230" height="300" fill="rgba(245,158,11,0.05)" stroke="#6b7280" strokeWidth="1.5" />
                  <rect x="50" y="350" width="400" height="250" fill="rgba(139,92,246,0.05)" stroke="#6b7280" strokeWidth="1.5" />
                  <rect x="450" y="350" width="200" height="250" fill="rgba(6,182,212,0.05)" stroke="#6b7280" strokeWidth="1.5" />
                  <rect x="650" y="350" width="200" height="250" fill="rgba(239,68,68,0.05)" stroke="#6b7280" strokeWidth="1.5" />
                  {/* Doors */}
                  <path d="M 350 200 Q 380 200 380 170" fill="none" stroke="#374151" strokeWidth="1" />
                  <path d="M 400 150 Q 430 150 430 120" fill="none" stroke="#374151" strokeWidth="1" />
                  <path d="M 620 200 Q 650 200 650 170" fill="none" stroke="#374151" strokeWidth="1" />
                  {/* Labels */}
                  <text x="200" y="200" textAnchor="middle" className="text-xs" fill="#374151" fontSize="14" fontWeight="500">Salon</text>
                  <text x="200" y="220" textAnchor="middle" fill="#6b7280" fontSize="11">24.5 m2</text>
                  <text x="510" y="200" textAnchor="middle" fill="#374151" fontSize="14" fontWeight="500">Chambre 1</text>
                  <text x="510" y="220" textAnchor="middle" fill="#6b7280" fontSize="11">14.2 m2</text>
                  <text x="735" y="200" textAnchor="middle" fill="#374151" fontSize="14" fontWeight="500">Cuisine</text>
                  <text x="735" y="220" textAnchor="middle" fill="#6b7280" fontSize="11">11.8 m2</text>
                  <text x="250" y="480" textAnchor="middle" fill="#374151" fontSize="14" fontWeight="500">Chambre 2</text>
                  <text x="250" y="500" textAnchor="middle" fill="#6b7280" fontSize="11">18.3 m2</text>
                  <text x="550" y="480" textAnchor="middle" fill="#374151" fontSize="14" fontWeight="500">SDB</text>
                  <text x="550" y="500" textAnchor="middle" fill="#6b7280" fontSize="11">6.9 m2</text>
                  <text x="750" y="480" textAnchor="middle" fill="#374151" fontSize="14" fontWeight="500">Entree</text>
                  {/* Dimension lines */}
                  <line x1="50" y1="30" x2="850" y2="30" stroke="#ef4444" strokeWidth="1" strokeDasharray="4 2" />
                  <text x="450" y="25" textAnchor="middle" fill="#ef4444" fontSize="11">8.30 ml</text>
                  <line x1="870" y1="50" x2="870" y2="600" stroke="#ef4444" strokeWidth="1" strokeDasharray="4 2" />
                  <text x="885" y="325" fill="#ef4444" fontSize="11" transform="rotate(90,885,325)">5.20 ml</text>
                  {/* Annotation markers */}
                  <circle cx="180" cy="280" r="8" fill="#ef4444" opacity="0.8" />
                  <text x="180" y="284" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">1</text>
                  <circle cx="700" cy="120" r="8" fill="#f59e0b" opacity="0.8" />
                  <text x="700" y="124" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">2</text>
                </svg>
              </div>
            </div>

            {/* Calibration overlay */}
            {calibrating && (
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-10">
                <div className="bg-white rounded-lg p-6 shadow-xl max-w-sm">
                  <h3 className="font-bold mb-2">Calibration de l'echelle</h3>
                  <p className="text-sm text-muted-foreground mb-4">Tracez une ligne sur le plan dont vous connaissez la longueur reelle, puis indiquez la mesure.</p>
                  <div className="flex gap-3 mb-4">
                    <Input placeholder="Longueur reelle" type="number" />
                    <Select className="w-20"><option>m</option><option>cm</option><option>mm</option></Select>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => { setCalibrating(false); setActiveTool('select') }}>Annuler</Button>
                    <Button size="sm" onClick={() => { setCalibrating(false); setActiveTool('select') }}>Appliquer</Button>
                  </div>
                </div>
              </div>
            )}

            {/* Status bar */}
            <div className="absolute bottom-0 left-0 right-0 h-7 bg-background/95 backdrop-blur border-t flex items-center px-3 gap-4 text-[11px] text-muted-foreground">
              <span>Zoom: {scale}%</span>
              <span>Echelle: {planScale}</span>
              <span>Outil: {toolGroups.flatMap(g => g.tools).find(t => t.id === activeTool)?.label}</span>
              <span className="ml-auto">Surfaces totales: {totalArea.toFixed(1)} m2</span>
              <span>Longueurs totales: {totalLength.toFixed(2)} ml</span>
            </div>
          </div>

          {/* Bottom panel - Levels / Facades / Coupes */}
          <div className="h-24 border rounded-lg bg-background shrink-0 flex flex-col">
            <div className="flex gap-1 px-2 pt-1.5 border-b">
              {(['levels', 'facades', 'coupes'] as const).map(tab => (
                <button key={tab} onClick={() => setBottomTab(tab)} className={cn(
                  'px-3 py-1 rounded-t text-xs font-medium transition-colors',
                  bottomTab === tab ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}>
                  {tab === 'levels' ? 'Niveaux' : tab === 'facades' ? 'Facades' : 'Coupes'}
                </button>
              ))}
            </div>
            <div className="flex-1 flex items-center gap-2 px-3 overflow-x-auto">
              {(bottomTab === 'levels' ? mockLevels : bottomTab === 'facades' ? mockFacades : mockCoupes).map(item => (
                <button key={item.id} onClick={() => setActiveLevel(item.id)} className={cn(
                  'px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap border transition-colors shrink-0',
                  activeLevel === item.id ? 'border-primary bg-primary/10 text-primary' : item.hasplan ? 'border-border hover:border-primary/50' : 'border-dashed border-muted-foreground/30 text-muted-foreground'
                )}>
                  {item.label}
                  {!item.hasplan && <span className="block text-[10px] text-muted-foreground mt-0.5">Aucun plan</span>}
                </button>
              ))}
              <button className="px-4 py-2 rounded-lg text-xs font-medium border-2 border-dashed border-muted-foreground/20 text-muted-foreground hover:border-primary/50 hover:text-primary shrink-0">
                <Plus className="h-3.5 w-3.5 inline mr-1" />Ajouter
              </button>
            </div>
          </div>
        </div>

        {/* Right panel */}
        <Card className="w-72 shrink-0 flex flex-col overflow-hidden">
          <div className="flex border-b shrink-0">
            {(['params', 'measures', 'annotations'] as const).map(tab => (
              <button key={tab} onClick={() => setRightTab(tab)} className={cn(
                'flex-1 px-2 py-2.5 text-xs font-medium transition-colors',
                rightTab === tab ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'
              )}>
                {tab === 'params' ? 'Parametres' : tab === 'measures' ? 'Mesures' : 'Annotations'}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {rightTab === 'params' && (
              <div className="p-3 space-y-4">
                <div>
                  <label className="text-xs font-medium mb-1 block">Echelle du plan</label>
                  <Select value={planScale} onChange={e => setPlanScale(e.target.value)} className="h-8 text-sm">
                    <option>1:50</option><option>1:100</option><option>1:200</option><option>1:500</option>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Format</label>
                  <Select className="h-8 text-sm"><option>A0</option><option>A1</option><option>A2</option><option>A3</option><option>A4</option></Select>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Rotation</label>
                  <div className="flex gap-2">
                    <Input type="number" defaultValue={0} className="h-8 text-sm" />
                    <span className="text-sm self-center text-muted-foreground">deg</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Opacite</label>
                  <input type="range" min="20" max="100" defaultValue={100} className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                </div>
                <div className="pt-2 border-t">
                  <Button variant="outline" size="sm" className="w-full" onClick={() => setCalibrating(true)}>
                    <Crosshair className="mr-2 h-3.5 w-3.5" />Recalibrer l'echelle
                  </Button>
                </div>
                <div>
                  <Button variant="outline" size="sm" className="w-full"><Settings2 className="mr-2 h-3.5 w-3.5" />Preferences d'affichage</Button>
                </div>
              </div>
            )}

            {rightTab === 'measures' && (
              <div className="p-3 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded bg-blue-50 text-center">
                    <p className="text-[10px] text-blue-600">Zones</p>
                    <p className="text-sm font-bold text-blue-700">{totalArea.toFixed(1)} m2</p>
                  </div>
                  <div className="p-2 rounded bg-red-50 text-center">
                    <p className="text-[10px] text-red-600">Longueurs</p>
                    <p className="text-sm font-bold text-red-700">{totalLength.toFixed(2)} ml</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {mockMeasures.map(m => (
                    <div key={m.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 group text-sm">
                      <div className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: m.color }} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-xs truncate">{m.label}</p>
                        <p className="text-[10px] text-muted-foreground">{m.type}</p>
                      </div>
                      <span className="font-semibold text-xs">{m.value}</span>
                      <button className="opacity-0 group-hover:opacity-100">{m.locked ? <Lock className="h-3 w-3 text-muted-foreground" /> : <Unlock className="h-3 w-3 text-muted-foreground" />}</button>
                      <button className="opacity-0 group-hover:opacity-100"><Trash2 className="h-3 w-3 text-red-400" /></button>
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" className="w-full"><Copy className="mr-2 h-3.5 w-3.5" />Copier les mesures</Button>
              </div>
            )}

            {rightTab === 'annotations' && (
              <div className="p-3 space-y-3">
                <div className="space-y-1.5">
                  {mockAnnotations.map(a => (
                    <div key={a.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 group text-sm">
                      <Badge variant="outline" className="text-[10px] shrink-0">{a.type}</Badge>
                      <span className="flex-1 text-xs truncate">{a.label}</span>
                      <button>{a.visible ? <Eye className="h-3 w-3 text-muted-foreground" /> : <EyeOff className="h-3 w-3 text-muted-foreground" />}</button>
                      <button className="opacity-0 group-hover:opacity-100"><Trash2 className="h-3 w-3 text-red-400" /></button>
                    </div>
                  ))}
                </div>
                <div className="pt-2 border-t">
                  <p className="text-xs font-medium mb-2">Style annotation</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><label className="text-[10px] text-muted-foreground">Couleur</label>
                      <div className="flex gap-1 mt-1">
                        {['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#374151'].map(c => (
                          <button key={c} className="h-5 w-5 rounded-full border-2 border-white ring-1 ring-border" style={{ backgroundColor: c }} />
                        ))}
                      </div>
                    </div>
                    <div><label className="text-[10px] text-muted-foreground">Epaisseur</label>
                      <Select className="h-7 text-xs mt-1"><option>1px</option><option>2px</option><option>3px</option><option>5px</option></Select>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
