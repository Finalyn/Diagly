import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, RefreshCw, Landmark, AlertTriangle, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui'
import { api } from '@/lib/api'
import { geocodeLV95, fetchTerrainConstraints } from '@/lib/geoadmin'
import { formatDate } from '@/lib/utils'
import type { ApiProject } from '@/lib/api-types'

const RADON_HIGH = 20 // % de dépassement de la valeur de référence -> à surveiller

function Info({ l, v }: { l: string; v: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{l}</p>
      <p className="font-medium">{v}</p>
    </div>
  )
}

/** Enrichit le bâtiment avec les données géographiques publiques (geo.admin), automatiquement. */
export function TerrainConstraintsCard({ project }: { project: ApiProject }) {
  const queryClient = useQueryClient()
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const tried = useRef(false)

  const save = useMutation({
    mutationFn: (body: Partial<ApiProject>) => api.projects.update(project.id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', project.id] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })

  const analyze = async () => {
    if (analyzing) return
    setAnalyzing(true)
    setError(null)
    try {
      let east = project.east ?? undefined
      let north = project.north ?? undefined
      if (east == null || north == null) {
        const q = [project.address, project.postalCode, project.city].filter(Boolean).join(' ').trim()
        const geo = q ? await geocodeLV95(q) : null
        if (!geo) { setError("Adresse non localisable pour l'analyse du terrain."); return }
        east = geo.east; north = geo.north
      }
      const { egid, egrid, data } = await fetchTerrainConstraints(east, north)
      // Affectation précise (cantonale) via le backend — le service RDPPF n'a pas de CORS.
      try {
        const aff = await api.geo.affectation(east, north, project.canton, egrid)
        if (aff?.supported) {
          if (aff.affectation) data.affectationDetail = aff.affectation
          if (aff.affectations?.length) data.affectations = aff.affectations
          if (aff.noise) data.noise = aff.noise
        }
      } catch { /* garde l'affectation harmonisée */ }
      await save.mutateAsync({
        east, north,
        egid: egid ?? null,
        egrid: egrid ?? null,
        geoData: data,
        geoSource: 'geo.admin.ch',
        geoFetchedAt: new Date().toISOString(),
      })
    } catch {
      setError("Analyse du terrain momentanément indisponible.")
    } finally {
      setAnalyzing(false)
    }
  }

  // Auto-déclenchement : à la première ouverture si aucune donnée géo encore.
  useEffect(() => {
    if (tried.current) return
    if (!project.geoData && project.address) { tried.current = true; analyze() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id])

  const g = project.geoData
  const heritage = [g?.heritage?.isos && `ISOS · ${g.heritage.isos}`, g?.heritage?.unesco && `UNESCO · ${g.heritage.unesco}`, g?.heritage?.bln && `BLN · ${g.heritage.bln}`].filter(Boolean) as string[]
  const radonHigh = g?.radonPct != null && g.radonPct >= RADON_HIGH
  const alerts = [
    heritage.length ? 'Patrimoine protégé' : null,
    radonHigh ? `Radon élevé (${g?.radonPct}%)` : null,
  ].filter(Boolean) as string[]

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Contraintes &amp; données géographiques</CardTitle>
        <Button variant="ghost" size="sm" onClick={analyze} disabled={analyzing} className="h-8 px-2 text-muted-foreground">
          {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-1.5 hidden sm:inline">{g ? 'Actualiser' : 'Analyser'}</span>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-amber-700 flex items-center gap-2"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</p>}

        {!g && analyzing && (
          <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Analyse du terrain via geo.admin…</p>
        )}
        {!g && !analyzing && !error && (
          <p className="py-4 text-sm text-muted-foreground">Aucune donnée géographique pour l'instant. Lancez l'analyse.</p>
        )}

        {g && (
          <>
            {alerts.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {alerts.map((a) => (
                  <span key={a} className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                    <AlertTriangle className="h-3.5 w-3.5" />{a}
                  </span>
                ))}
              </div>
            )}

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <Info l="Parcelle" v={g.parcelNumber ?? project.parcelNumber ?? '—'} />
              <Info l="EGID" v={project.egid ?? '—'} />
              <Info l="Zone d'affectation" v={g.affectationDetail ?? g.affectation ?? '—'} />
              <Info l="Degré de sensibilité (bruit)" v={g.noise ?? '—'} />
              <Info l="Radon (dépassement)" v={g.radonPct != null ? `${g.radonPct} %` : '—'} />
              <Info l="Classe de sol sismique" v={g.seismic ?? '—'} />
              <Info l="EGRID" v={project.egrid ?? '—'} />
            </div>

            {heritage.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Patrimoine protégé / objets inventoriés</p>
                <ul className="space-y-1.5">
                  {heritage.map((h) => (
                    <li key={h} className="flex items-start gap-2 text-sm"><Landmark className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /><span>{h}</span></li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-black/[0.06] pt-3 text-xs text-muted-foreground">
              <span>
                {project.geoFetchedAt ? <>Analysé le {formatDate(new Date(project.geoFetchedAt))} · geo.admin.ch</> : 'geo.admin.ch'}
              </span>
              {g.hazardsMapUrl && (
                <a href={g.hazardsMapUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:opacity-70">
                  Dangers naturels : consulter la carte <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
