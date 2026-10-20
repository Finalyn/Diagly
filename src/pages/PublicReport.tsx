import { useCallback, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FileDown, Loader2, AlertCircle, Lock } from 'lucide-react'
import { api } from '@/lib/api'
import { cfcLabelIndex } from '@/lib/cfc'
import { imprimerLaPage } from '@/lib/impression'
import { pdfDesPages } from '@/lib/pdf-direct'
import { estAppNative } from '@/lib/plateforme'
import { setMarketInfo } from '@/lib/diagnostic-auto'
import { chiffrerLeDossier } from '@/lib/devis-du-dossier'
import type { ElementState } from '@/lib/api-types'
import { MarqueDuRapport } from '@/components/report/marque-contexte'
import { RapportComplet } from '@/components/report/RapportComplet'

/**
 * Le rapport partagé au client, en lecture seule, sans connexion.
 *
 * C'est le rapport complet, rendu par le même code que le PDF de la page
 * Rapports et chiffré par le même calcul : le serveur n'envoie que les
 * données. Le lien affichait autrefois un rapport à part, réparations seules,
 * dont le total n'était pas celui du PDF.
 */
export function PublicReport() {
  const { token } = useParams<{ token: string }>()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-report', token],
    queryFn: () => api.share.get(token!),
    enabled: !!token,
    retry: false,
  })

  // /api/market/index est public : l'indice de la construction est le même
  // que celui du PDF, et la mention de la base de prix aussi.
  const marche = useQuery({
    queryKey: ['market-index'],
    queryFn: async () => { const m = await api.market.index(); setMarketInfo(m); return m },
    staleTime: 1000 * 60 * 60,
  })

  // La feuille A4 réduite à la largeur de l'écran, sur téléphone.
  const [largeur, setLargeur] = useState<number | null>(null)
  const colonne = useRef<HTMLDivElement | null>(null)
  const mesurer = useCallback((el: HTMLDivElement | null) => {
    colonne.current = el
    if (!el) return
    const o = new ResizeObserver(([e]) => setLargeur(e.contentRect.width))
    o.observe(el)
    return () => o.disconnect()
  }, [])
  const zoom = largeur ? Math.min(1, largeur / 800) : 1
  const style = zoom !== 1 ? ({ '--zoom-feuille': String(zoom) } as CSSProperties) : undefined

  const chiffre = useMemo(() => {
    if (!data || !marche.isFetched) return null
    return chiffrerLeDossier(data.project, data.items, data.base, cfcLabelIndex(data.cfcEntries))
  }, [data, marche.isFetched])

  const etatExistant = useMemo(() => {
    const parId = new Map((data?.catalogItems ?? []).map((c) => [c.id, c]))
    return (it: { catalogItemId: number | null; state: ElementState | null }): string | null => {
      if (!it.state || it.catalogItemId == null) return null
      const c = parId.get(it.catalogItemId)
      if (!c) return null
      return it.state === 'TRES_BON' ? c.descTbe : it.state === 'BON' ? c.descBon : it.state === 'MOYEN' ? c.descMoyen : c.descMauvais
    }
  }, [data])

  // Le PDF sort directement des feuilles affichées (pdf-direct.ts) ; dans
  // l'app iPhone et iPad, il passe par la feuille d'impression du système.
  const [pdf, setPdf] = useState<string | null>(null)
  const telecharger = async () => {
    const nom = `Rapport de diagnostic - ${data?.project.name ?? 'Diagly'}`
    const pages = [...(colonne.current?.querySelectorAll<HTMLElement>('.doc-feuille') ?? [])].filter((el) => !el.closest('.doc-mesure'))
    if (estAppNative || pages.length === 0) { await imprimerLaPage(nom).catch(() => undefined); return }
    setPdf('…')
    try {
      await pdfDesPages(pages, { nom, format: 'a4', onProgres: (faites, total) => setPdf(`${faites}/${total}`) })
    } catch {
      // Si la photographie échoue, l'impression du navigateur reste un recours.
      await imprimerLaPage(nom).catch(() => undefined)
    } finally {
      setPdf(null)
    }
  }

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500"><Loader2 className="h-6 w-6 animate-spin mr-2" />Chargement du rapport…</div>
  }
  if (isError || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
          <h1 className="text-lg font-semibold mb-1">Lien indisponible</h1>
          <p className="text-sm text-gray-500">Ce lien de partage est invalide ou a été révoqué par son auteur.</p>
        </div>
      </div>
    )
  }

  const accent = data.company?.accentColor || '#3b82f6'

  return (
    <div className="min-h-screen bg-gray-100 px-3 py-6 sm:px-6">
      {/* Barre d'action (non imprimée) */}
      <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between print:hidden">
        <span className="inline-flex items-center gap-1.5 text-xs text-gray-500"><Lock className="h-3.5 w-3.5" />Lecture seule</span>
        <button onClick={() => void telecharger()} disabled={pdf !== null || !chiffre} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-70" style={{ backgroundColor: accent }}>
          {pdf !== null ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}{pdf !== null ? `PDF ${pdf}` : 'PDF'}
        </button>
      </div>

      <div ref={mesurer} className="mx-auto max-w-[210mm]" style={style}>
        {chiffre ? (
          <MarqueDuRapport bureau={data.company} auteur={data.auteur}>
            <RapportComplet
              project={data.project}
              items={chiffre.items}
              devis={chiffre.devis}
              etatExistant={etatExistant}
              base={data.base}
              catalogItems={data.catalogItems}
              variants={data.variants}
              auteur={data.auteur}
              entreprise={data.company ?? undefined}
            />
          </MarqueDuRapport>
        ) : (
          <div className="flex items-center justify-center py-32 text-gray-500"><Loader2 className="mr-2 h-6 w-6 animate-spin" />Mise en pages…</div>
        )}
      </div>
    </div>
  )
}
