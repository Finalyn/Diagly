import { useParams } from 'react-router-dom'
import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, AlertCircle, Zap, Upload, Check, AlertTriangle, FileText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { buildingTypeLabels } from '@/data/mock'
import { cn, formatDate } from '@/lib/utils'
import { api } from '@/lib/api'
import type { ApiProject, CecbExtraction } from '@/lib/api-types'

const CLASSES = [
  { c: 'A', color: 'bg-green-600', note: 'Très efficient' },
  { c: 'B', color: 'bg-green-500', note: '' },
  { c: 'C', color: 'bg-lime-500', note: '' },
  { c: 'D', color: 'bg-yellow-400', note: '' },
  { c: 'E', color: 'bg-orange-400', note: '' },
  { c: 'F', color: 'bg-orange-600', note: '' },
  { c: 'G', color: 'bg-red-600', note: 'Peu efficient' },
] as const

function estimateClass(year: number | null): string | null {
  if (!year) return null
  if (year >= 2015) return 'A'
  if (year >= 2010) return 'B'
  if (year >= 2001) return 'C'
  if (year >= 1991) return 'D'
  if (year >= 1981) return 'E'
  if (year >= 1971) return 'F'
  return 'G'
}

/** Normalise une classe extraite en une lettre A–G. */
function normClass(v?: string | null): string | null {
  if (!v) return null
  const c = v.trim().charAt(0).toUpperCase()
  return 'ABCDEFG'.includes(c) ? c : null
}

const fmtNum = (v?: number | null, unit?: string) => (v == null ? '—' : `${v}${unit ? ` ${unit}` : ''}`)

// Champs proposés à la validation : clé extraction → champ bâtiment.
type Row = { key: keyof CecbExtraction; proj: keyof ApiProject; label: string; unit?: string; isClass?: boolean }
const ROWS: Row[] = [
  { key: 'classGlobal', proj: 'energyClassGlobal', label: 'Classe énergétique globale', isClass: true },
  { key: 'classEnvelope', proj: 'energyClassEnvelope', label: "Classe de l'enveloppe", isClass: true },
  { key: 'sre', proj: 'sre', label: 'Surface de référence énergétique (SRE)', unit: 'm²' },
  { key: 'consumptionHeat', proj: 'energyConsumptionHeat', label: 'Consommation chaleur', unit: 'kWh/m²·an' },
  { key: 'consumptionElec', proj: 'energyConsumptionElec', label: 'Consommation électricité', unit: 'kWh/m²·an' },
  { key: 'energyAgent', proj: 'energyAgent', label: 'Agent énergétique' },
  { key: 'refYear', proj: 'energyRefYear', label: 'Année de référence du certificat' },
]

const extractedValue = (ext: CecbExtraction, r: Row): string | number | null => {
  const raw = ext[r.key] as string | number | null | undefined
  if (raw == null || raw === '') return null
  if (r.isClass) return normClass(String(raw))
  return raw
}

export function ProjectCECB() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const { data, isLoading, isError } = useQuery({ queryKey: ['project', id], queryFn: () => api.projects.get(id!), enabled: !!id })
  const project = data?.project

  const fileInput = useRef<HTMLInputElement>(null)
  const [extraction, setExtraction] = useState<CecbExtraction | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [msg, setMsg] = useState<string | null>(null)

  const importMut = useMutation({
    mutationFn: (file: File) => api.assistant.certificateImport(id!, file),
    onSuccess: (r) => {
      if (!r.configured) { setMsg("L'assistant IA n'est pas configuré sur ce serveur."); return }
      if (!r.extraction) { setMsg("Impossible de lire ce PDF comme un certificat énergétique."); return }
      if (r.extraction.isCertificate === false) { setMsg("Ce PDF ne semble pas être un certificat énergétique."); return }
      const ext = r.extraction
      // pré-sélectionne les champs réellement extraits
      const pre = new Set(ROWS.filter((row) => extractedValue(ext, row) != null).map((row) => String(row.key)))
      setSelected(pre)
      setExtraction(ext)
    },
    onError: (e) => setMsg(e instanceof Error ? e.message : 'Échec de la lecture du certificat.'),
  })

  const applyMut = useMutation({
    mutationFn: (body: Partial<ApiProject>) => api.projects.update(id!, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setExtraction(null)
    },
  })

  if (isLoading) return <div className="flex items-center justify-center py-32 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mr-2" />Chargement…</div>
  if (isError || !project) return <Card><CardContent className="py-16 text-center"><AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" /><p className="text-sm text-red-700">Projet introuvable</p></CardContent></Card>

  const effectiveYear = project.renovationYear ?? project.yearBuilt ?? null
  const fromReno = project.renovationYear != null
  const measured = normClass(project.energyClassGlobal)
  const klass = measured ?? estimateClass(effectiveYear)
  const current = CLASSES.find(c => c.c === klass)
  const hasImport = !!(project.energySource || project.energyClassGlobal || project.sre != null)
  const measures = project.energyData?.measures ?? []

  const toggle = (k: string) => setSelected((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })

  const applySelection = () => {
    if (!extraction) return
    const patch: Partial<ApiProject> = {}
    for (const row of ROWS) {
      if (!selected.has(String(row.key))) continue
      const v = extractedValue(extraction, row)
      if (v == null) continue
      ;(patch as Record<string, unknown>)[row.proj] = v
    }
    if (Object.keys(patch).length === 0 && !(extraction.measures?.length)) { setExtraction(null); return }
    patch.energySource = 'Certificat énergétique (import)'
    patch.energyCertDate = new Date().toISOString()
    patch.energyData = { measures: extraction.measures ?? [], confidence: extraction.confidence ?? null }
    applyMut.mutate(patch)
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Étiquette énergétique</h1>
          <p className="text-muted-foreground text-sm">
            {measured ? 'Classe issue du certificat importé' : 'Classe énergétique estimée du bâtiment'}
          </p>
        </div>
        <div className="shrink-0">
          <Button variant="outline" onClick={() => fileInput.current?.click()} disabled={importMut.isPending}>
            {importMut.isPending
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Lecture…</>
              : <><Upload className="mr-2 h-4 w-4" />Importer un certificat énergétique</>}
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) { setMsg(null); importMut.mutate(f) } e.target.value = '' }}
          />
        </div>
      </div>

      {msg && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />{msg}
        </div>
      )}

      <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
        {/* Classe (mesurée ou estimée) */}
        <Card>
          <CardHeader><CardTitle>{measured ? 'Classe mesurée' : 'Estimation'}</CardTitle></CardHeader>
          <CardContent className="text-center py-6">
            {klass ? (
              <>
                <div className={cn('mx-auto h-24 w-24 rounded-2xl flex items-center justify-center text-white text-5xl font-bold', current?.color)}>
                  {klass}
                </div>
                <p className="text-sm text-muted-foreground mt-3">
                  {measured
                    ? <>Certificat importé{project.energyCertDate ? <> le <strong>{formatDate(new Date(project.energyCertDate))}</strong></> : ''}</>
                    : <>Estimée d'après {fromReno ? 'la rénovation' : 'la construction'} de <strong>{effectiveYear}</strong></>}
                </p>
              </>
            ) : (
              <div className="py-8">
                <Zap className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Importez un certificat, ou renseignez l'année de construction/rénovation sur le résumé pour estimer la classe.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Échelle A–G */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Échelle énergétique</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {CLASSES.map(c => (
                <div key={c.c} className="flex items-center gap-3">
                  <div className={cn('h-8 rounded text-white font-bold flex items-center justify-center transition-all',
                    c.color, c.c === klass ? 'w-full ring-2 ring-offset-2 ring-foreground/40' : 'w-2/3')}>
                    {c.c}{c.c === klass && ' — votre bâtiment'}
                  </div>
                  {c.note && <span className="text-xs text-muted-foreground shrink-0">{c.note}</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Données énergétiques importées */}
      {hasImport && (
        <Card>
          <CardHeader><CardTitle>Données énergétiques importées</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <Info l="Classe globale" v={project.energyClassGlobal ?? '—'} />
              <Info l="Classe enveloppe" v={project.energyClassEnvelope ?? '—'} />
              <Info l="SRE" v={fmtNum(project.sre, 'm²')} />
              <Info l="Agent énergétique" v={project.energyAgent ?? '—'} />
              <Info l="Consommation chaleur" v={fmtNum(project.energyConsumptionHeat, 'kWh/m²·an')} />
              <Info l="Consommation électricité" v={fmtNum(project.energyConsumptionElec, 'kWh/m²·an')} />
              <Info l="Année de référence" v={project.energyRefYear ? String(project.energyRefYear) : '—'} />
              <Info l="Source" v={project.energySource ?? '—'} />
            </div>
            {measures.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Mesures d'amélioration recommandées</p>
                <ul className="space-y-1.5">
                  {measures.map((m, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold">{i + 1}</span>
                      <span className="flex-1">{m.label}{m.priority ? <span className="text-muted-foreground"> · priorité {m.priority}</span> : null}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Données bâtiment */}
      <Card>
        <CardHeader><CardTitle>Données prises en compte</CardTitle></CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <Info l="Année de construction" v={project.yearBuilt ? String(project.yearBuilt) : '—'} />
            <Info l="Année de rénovation" v={project.renovationYear ? String(project.renovationYear) : '—'} />
            <Info l="Type" v={buildingTypeLabels[project.buildingType]} />
            <Info l="Surface de plancher" v={project.floorArea ? `${project.floorArea} m²` : '—'} />
          </div>
        </CardContent>
      </Card>

      <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-800">
        <strong>Lecture, pas émission.</strong> Diagly lit un certificat énergétique existant pour reprendre ses données ; il n'en émet pas.
        Une étiquette énergétique officielle nécessite l'intervention d'un expert agréé.
      </div>

      {/* Dialog de validation de l'extraction */}
      <Dialog open={!!extraction} onOpenChange={(o) => { if (!o) setExtraction(null) }}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-blue-600" />Valider l'import du certificat</DialogTitle>
          </DialogHeader>
          <p className="mt-1 text-sm text-muted-foreground">
            Vérifiez les données lues avant de les appliquer au bâtiment. Décochez ce que vous ne souhaitez pas reprendre.
            {extraction?.confidence && <> Confiance de lecture : <strong>{extraction.confidence}</strong>.</>}
          </p>

          <div className="mt-4 divide-y divide-border">
            {extraction && ROWS.map((row) => {
              const v = extractedValue(extraction, row)
              const currentVal = project[row.proj] as string | number | null
              const hasCurrent = currentVal != null && currentVal !== ''
              const differs = hasCurrent && v != null && String(currentVal) !== String(v)
              const disabled = v == null
              return (
                <label key={String(row.key)} className={cn('flex items-center gap-3 py-2.5', disabled && 'opacity-50')}>
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 accent-blue-600"
                    checked={selected.has(String(row.key))}
                    disabled={disabled}
                    onChange={() => toggle(String(row.key))}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{row.label}</p>
                    {hasCurrent && (
                      <p className="text-xs text-muted-foreground">Actuel : {String(currentVal)}{row.unit ? ` ${row.unit}` : ''}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold">{v == null ? 'Non lu' : `${v}${row.unit ? ` ${row.unit}` : ''}`}</p>
                    {differs && <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600"><AlertTriangle className="h-3 w-3" />écart</span>}
                    {hasCurrent && !differs && v != null && <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600"><Check className="h-3 w-3" />identique</span>}
                  </div>
                </label>
              )
            })}
          </div>

          {!!extraction?.measures?.length && (
            <div className="mt-3 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              {extraction.measures.length} mesure(s) d'amélioration seront enregistrées avec le bâtiment.
            </div>
          )}

          <DialogFooter className="mt-5 gap-2">
            <Button variant="outline" onClick={() => setExtraction(null)}>Annuler</Button>
            <Button onClick={applySelection} disabled={applyMut.isPending}>
              {applyMut.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Application…</> : <><Check className="mr-2 h-4 w-4" />Appliquer au bâtiment</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Info({ l, v }: { l: string; v: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{l}</p>
      <p className="font-medium">{v}</p>
    </div>
  )
}
