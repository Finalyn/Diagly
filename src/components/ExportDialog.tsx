import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Download, Save, ArrowUp, ArrowDown, FileSpreadsheet, FileJson, FileText } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button, Select, Input } from '@/components/ui'
import { api, saveBlob } from '@/lib/api'
import { useAuth } from '@/stores/auth'
import type { ExportTemplate, ExportFormat } from '@/lib/api-types'
import { cn } from '@/lib/utils'

const clone = (t: ExportTemplate): ExportTemplate => JSON.parse(JSON.stringify(t))

export function ExportDialog({ open, onOpenChange, projectId }: { open: boolean; onOpenChange: (o: boolean) => void; projectId: string }) {
  const user = useAuth((s) => s.user)
  const saved = useMemo<ExportTemplate[]>(() => user?.preferences?.exportTemplates ?? [], [user])

  const defQuery = useQuery({ queryKey: ['export-default-template'], queryFn: () => api.export.defaultTemplate(), enabled: open, staleTime: 60 * 60 * 1000 })
  const defaultTemplate = defQuery.data?.template

  const [format, setFormat] = useState<ExportFormat>('xlsx')
  const [csvSheet, setCsvSheet] = useState<'items' | 'workplan' | 'building'>('items')
  const [templateId, setTemplateId] = useState<string>('default')
  const [draft, setDraft] = useState<ExportTemplate | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Charge le brouillon éditable depuis le modèle sélectionné.
  useEffect(() => {
    const base = templateId === 'default' ? defaultTemplate : saved.find((t) => t.id === templateId) ?? defaultTemplate
    if (base) setDraft(clone(base))
  }, [templateId, defaultTemplate, saved])

  if (!open) return null

  const toggleCol = (sheetId: string, key: string) =>
    setDraft((d) => d && ({ ...d, sheets: d.sheets.map((s) => s.id === sheetId ? { ...s, columns: s.columns.map((c) => c.key === key ? { ...c, active: !c.active } : c) } : s) }))
  const renameCol = (sheetId: string, key: string, label: string) =>
    setDraft((d) => d && ({ ...d, sheets: d.sheets.map((s) => s.id === sheetId ? { ...s, columns: s.columns.map((c) => c.key === key ? { ...c, label } : c) } : s) }))
  const moveCol = (sheetId: string, idx: number, dir: -1 | 1) =>
    setDraft((d) => {
      if (!d) return d
      return { ...d, sheets: d.sheets.map((s) => {
        if (s.id !== sheetId) return s
        const cols = [...s.columns]
        const j = idx + dir
        if (j < 0 || j >= cols.length) return s
        ;[cols[idx], cols[j]] = [cols[j], cols[idx]]
        return { ...s, columns: cols }
      }) }
    })

  const download = async () => {
    if (!draft) return
    setBusy(true); setError(null)
    try {
      if (format === 'json') {
        const payload = await api.export.getJson(projectId)
        saveBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), 'diagly-export.json')
      } else {
        const { blob, filename } = await api.export.download(projectId, { format, template: draft, sheet: format === 'csv' ? csvSheet : undefined })
        saveBlob(blob, filename)
      }
    } catch (e) {
      setError((e as Error)?.message ?? 'Erreur lors de l\'export')
    } finally {
      setBusy(false)
    }
  }

  const persist = async (templates: ExportTemplate[], newId?: string) => {
    const res = await api.auth.updatePreferences({ exportTemplates: templates })
    const { accessToken, refreshToken } = useAuth.getState()
    if (accessToken && refreshToken) useAuth.getState().setAuth(res.user, accessToken, refreshToken)
    if (newId) setTemplateId(newId)
  }

  const saveAsNew = async () => {
    if (!draft) return
    const name = window.prompt('Nom du nouveau modèle ?', 'Mon modèle')?.trim()
    if (!name) return
    setBusy(true); setError(null)
    try {
      const id = crypto.randomUUID()
      await persist([...saved, { id, name, sheets: draft.sheets }], id)
    } catch (e) { setError((e as Error)?.message ?? 'Erreur') } finally { setBusy(false) }
  }

  const saveChanges = async () => {
    if (!draft || templateId === 'default') return
    setBusy(true); setError(null)
    try {
      await persist(saved.map((t) => t.id === templateId ? { ...t, sheets: draft.sheets } : t))
    } catch (e) { setError((e as Error)?.message ?? 'Erreur') } finally { setBusy(false) }
  }

  const editableSheets = draft?.sheets.filter((s) => format !== 'csv' || s.id === csvSheet) ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Exporter les données du diagnostic</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Format + modèle */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium mb-1 block">Format</label>
              <div className="flex gap-1">
                {([['xlsx', 'Excel', FileSpreadsheet], ['csv', 'CSV', FileText], ['json', 'JSON', FileJson]] as const).map(([f, lbl, Icon]) => (
                  <button
                    key={f}
                    onClick={() => setFormat(f)}
                    className={cn('flex-1 flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-sm transition-colors',
                      format === f ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-input hover:bg-muted')}
                  >
                    <Icon className="h-4 w-4" />{lbl}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Modèle</label>
              <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                <option value="default">Modèle standard Diagly</option>
                {saved.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            </div>
          </div>

          {format === 'csv' && (
            <div>
              <label className="text-xs font-medium mb-1 block">Onglet à exporter (CSV = une table)</label>
              <Select value={csvSheet} onChange={(e) => setCsvSheet(e.target.value as typeof csvSheet)}>
                <option value="items">Éléments</option>
                <option value="workplan">Plan de travaux</option>
                <option value="building">Bâtiment</option>
              </Select>
            </div>
          )}

          {format === 'json' ? (
            <p className="text-sm text-muted-foreground border rounded-md p-3">
              JSON : payload canonique complet (bâtiment, éléments, plan de travaux, chiffrage). Le mapping de colonnes ne s'applique qu'aux formats tabulaires (Excel/CSV).
            </p>
          ) : (
            <div className="space-y-3 max-h-[46vh] overflow-y-auto pr-1">
              <p className="text-xs text-muted-foreground">Colonnes : (dé)cocher pour activer, glisser avec les flèches pour réordonner, éditer l'intitulé. EGID reste en tête de chaque onglet.</p>
              {editableSheets.map((sheet) => (
                <div key={sheet.id} className="rounded-md border">
                  <div className="bg-muted/50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider">{sheet.title}</div>
                  <div className="divide-y">
                    {sheet.columns.map((col, idx) => (
                      <div key={col.key} className="flex items-center gap-2 px-3 py-1.5">
                        <input type="checkbox" checked={col.active} onChange={() => toggleCol(sheet.id, col.key)} className="h-4 w-4 shrink-0 accent-primary" />
                        <Input value={col.label} onChange={(e) => renameCol(sheet.id, col.key, e.target.value)} className={cn('h-7 text-sm', !col.active && 'opacity-50')} />
                        <span className="text-[10px] font-mono text-muted-foreground w-24 truncate shrink-0" title={col.key}>{col.key}</span>
                        <div className="flex shrink-0">
                          <Button variant="ghost" size="icon" className="h-6 w-6" disabled={idx === 0} onClick={() => moveCol(sheet.id, idx, -1)}><ArrowUp className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6" disabled={idx === sheet.columns.length - 1} onClick={() => moveCol(sheet.id, idx, 1)}><ArrowDown className="h-3.5 w-3.5" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-between">
          <div className="flex gap-2">
            {format !== 'json' && (
              <>
                <Button variant="outline" size="sm" onClick={saveAsNew} disabled={busy}>
                  <Save className="mr-1.5 h-3.5 w-3.5" />Enregistrer comme modèle
                </Button>
                {templateId !== 'default' && (
                  <Button variant="ghost" size="sm" onClick={saveChanges} disabled={busy}>Mettre à jour le modèle</Button>
                )}
              </>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Fermer</Button>
            <Button onClick={download} disabled={busy || !draft}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Télécharger
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
