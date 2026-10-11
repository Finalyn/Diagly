/**
 * Les valeurs par défaut du chiffrage.
 *
 * Elles vivent avec la base de données, et non dans les réglages du compte :
 * ce sont des règles de chiffrage, au même titre que les prix des articles et
 * les postes automatiques, et on vient les relire au même endroit. Un
 * diagnostiqueur qui ouvre un dossier et se demande d'où sortent les douze
 * pour cent d'honoraires les trouve ici, à côté des prix.
 *
 * L'aperçu est la raison d'être de l'écran : trois pourcentages dans un
 * formulaire ne disent rien, les mêmes appliqués à cent mille francs se lisent
 * d'un coup. Et c'est la cascade du devis qui est appelée, pas une copie : ce
 * qu'annonce le réglage est ce que le devis calculera.
 */
import { useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select } from '@/components/ui'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/stores/auth'
import { apercuDesValeurs } from '@/lib/reglages'
import { cn, formatCHF } from '@/lib/utils'
import type { UserPreferences } from '@/lib/api-types'

export function ValeursParDefaut() {
  const user = useAuth((s) => s.user)
  const setAuth = useAuth((s) => s.setAuth)
  const accessToken = useAuth((s) => s.accessToken)
  const refreshToken = useAuth((s) => s.refreshToken)
  const d = user?.preferences?.defaults ?? {}

  const depart = useMemo(() => ({
    honoraryPct: String(d.honoraryPct ?? 12),
    reservePct: String(d.reservePct ?? 10),
    vatPct: String(d.vatPct ?? 8.1),
    unit: (d.unit ?? 'm') as 'm' | 'cm' | 'mm',
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [user])
  const [f, setF] = useState(depart)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const modifie = JSON.stringify(f) !== JSON.stringify(depart)
  const poser = (p: Partial<typeof f>) => setF((v) => ({ ...v, ...p }))

  const nombre = (v: string, defaut: number) => {
    const n = Number(v.replace(',', '.'))
    return Number.isFinite(n) && n >= 0 ? n : defaut
  }
  const etapes = apercuDesValeurs({
    honoraryPct: nombre(f.honoraryPct, 0),
    reservePct: nombre(f.reservePct, 0),
    vatPct: nombre(f.vatPct, 0),
  })

  const enregistrer = async () => {
    setEnCours(true); setErreur(null)
    try {
      const patch: Partial<UserPreferences> = {
        defaults: {
          honoraryPct: nombre(f.honoraryPct, 12),
          reservePct: nombre(f.reservePct, 10),
          vatPct: nombre(f.vatPct, 8.1),
          unit: f.unit,
        },
      }
      const r = await api.auth.updatePreferences(patch)
      if (accessToken && refreshToken) setAuth(r.user, accessToken, refreshToken)
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Enregistrement impossible.')
    } finally { setEnCours(false) }
  }

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <CardHeader className="shrink-0 border-b px-4 py-3">
        <CardTitle className="text-sm">Valeurs appliquées aux nouveaux diagnostics</CardTitle>
        <p className="text-xs text-muted-foreground">
          Un dossier déjà ouvert garde les siennes : les changer ici ne rouvre aucun chiffrage.
        </p>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-5">
        <div className="max-w-2xl space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <Champ label="Honoraires (%)">
              <Input
                type="number" min="0" step="0.5" value={f.honoraryPct}
                onChange={(e) => poser({ honoraryPct: e.target.value })}
              />
            </Champ>
            <Champ label="Réserve (%)">
              <Input
                type="number" min="0" step="0.5" value={f.reservePct}
                onChange={(e) => poser({ reservePct: e.target.value })}
              />
            </Champ>
            <Champ label="TVA (%)">
              <Input
                type="number" min="0" step="0.1" value={f.vatPct}
                onChange={(e) => poser({ vatPct: e.target.value })}
              />
            </Champ>
          </div>

          <div className="rounded-xl bg-muted/50 p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Sur 100 000 francs de travaux
            </p>
            <dl className="space-y-1 text-sm">
              {etapes.map((e, i) => (
                <div
                  key={e.libelle}
                  className={cn('flex justify-between gap-4', i === etapes.length - 1 && 'border-t pt-1 font-semibold')}
                >
                  <dt className={cn(i > 0 && i < etapes.length - 1 && 'text-muted-foreground')}>{e.libelle}</dt>
                  <dd className="tabular-nums">{formatCHF(e.montant)}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-[11px] text-muted-foreground">
              La réserve se calcule sur le montant déjà majoré des honoraires, comme au devis.
            </p>
          </div>

          <Champ label="Unité de mesure des plans">
            <Select
              value={f.unit}
              onChange={(e) => poser({ unit: e.target.value as 'm' | 'cm' | 'mm' })}
              className="sm:w-48"
            >
              <option value="m">Mètres</option>
              <option value="cm">Centimètres</option>
              <option value="mm">Millimètres</option>
            </Select>
          </Champ>

          {erreur && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-800">{erreur}</p>
          )}
        </div>
      </CardContent>

      {modifie && (
        <div className="shrink-0 border-t bg-card px-5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">Modifications non enregistrées.</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setF(depart); setErreur(null) }} disabled={enCours}>
                Annuler
              </Button>
              <Button size="sm" onClick={enregistrer} disabled={enCours}>
                {enCours ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Enregistrement</> : 'Enregistrer'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}

function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}
