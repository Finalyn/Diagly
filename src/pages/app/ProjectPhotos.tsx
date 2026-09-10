import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Loader2, AlertCircle, Download, X, Camera, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button, Card, CardContent } from '@/components/ui'
import { DiagnosticTabs } from '@/components/layout/DiagnosticTabs'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { stateLabels, stateColors } from '@/data/mock'
import { vibrer } from '@/lib/motion'
import type { ElementState } from '@/lib/api-types'

/**
 * Toutes les photos d'un diagnostic, au même endroit.
 *
 * Sur le terrain on photographie beaucoup, et ces images finissent dans le dossier
 * du client ou dans un rapport rédigé ailleurs. Jusqu'ici elles restaient prisonnières
 * de leur poste : il fallait les rouvrir un par un pour les revoir, et rien ne
 * permettait de les récupérer.
 *
 * Les photos sont stockées avec le poste, en JPEG réduit. L'enregistrement est donc
 * immédiat, sans passer par le serveur : sur téléphone le navigateur propose de garder
 * l'image, sur ordinateur elle tombe dans les téléchargements.
 */

interface PhotoTrouvee {
  src: string
  itemId: string
  cfcCode: string
  cfcLabel: string
  state: ElementState | null
  /** Rang de la photo dans son poste, pour nommer le fichier. */
  rang: number
}

/** Nom de fichier lisible et triable : le dossier, le code CFC, puis le rang. */
function nomFichier(projet: string, p: PhotoTrouvee): string {
  const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  return `${slug(projet) || 'diagnostic'}-${slug(p.cfcCode) || 'cfc'}-${p.rang}.jpg`
}

function enregistrer(nom: string, src: string) {
  const a = document.createElement('a')
  a.href = src
  a.download = nom
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export function ProjectPhotos() {
  const { id } = useParams<{ id: string }>()
  const [ouverte, setOuverte] = useState<number | null>(null)

  const projectQuery = useQuery({ queryKey: ['project', id], queryFn: () => api.projects.get(id!), enabled: !!id })
  const project = projectQuery.data?.project
  const diagnostic = projectQuery.data?.diagnostics[0]

  const itemsQuery = useQuery({
    queryKey: ['diagnostic-items', diagnostic?.id],
    queryFn: () => api.diagnostics.listItems(diagnostic!.id),
    enabled: !!diagnostic,
  })

  /** Toutes les photos, dans l'ordre des postes, à plat pour la visionneuse. */
  const photos = useMemo<PhotoTrouvee[]>(() => {
    const out: PhotoTrouvee[] = []
    for (const it of itemsQuery.data?.items ?? []) {
      it.photos.forEach((src, i) => out.push({
        src, itemId: it.id, cfcCode: it.cfcCode, cfcLabel: it.cfcLabel, state: it.state, rang: i + 1,
      }))
    }
    return out
  }, [itemsQuery.data])

  /** Les mêmes, regroupées par poste : c'est ainsi qu'on les cherche. */
  const groupes = useMemo(() => {
    const map = new Map<string, PhotoTrouvee[]>()
    photos.forEach((p) => {
      if (!map.has(p.itemId)) map.set(p.itemId, [])
      map.get(p.itemId)!.push(p)
    })
    return [...map.values()]
  }, [photos])

  const toutEnregistrer = () => {
    if (!project) return
    vibrer('succes')
    // Un déclenchement par photo : le navigateur les enchaîne, un léger décalage
    // évite qu'il n'en ignore une partie.
    photos.forEach((p, i) => {
      setTimeout(() => enregistrer(nomFichier(project.name, p), p.src), i * 250)
    })
  }

  if (projectQuery.isLoading || itemsQuery.isLoading) {
    return <div className="flex items-center justify-center py-32 text-muted-foreground"><Loader2 className="mr-2 h-6 w-6 animate-spin" />Chargement…</div>
  }
  if (projectQuery.isError || !project) {
    return (
      <div className="py-32 text-center">
        <AlertCircle className="mx-auto mb-3 h-10 w-10 text-red-500" />
        <p className="text-muted-foreground">Ce diagnostic est introuvable.</p>
      </div>
    )
  }

  const active = ouverte != null ? photos[ouverte] : null

  return (
    <div className="space-y-4">
      <DiagnosticTabs projectId={project.id} />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold md:text-2xl">Photos</h1>
          <p className="text-sm text-muted-foreground">
            {photos.length === 0
              ? 'Aucune photo pour ce diagnostic.'
              : `${photos.length} photo${photos.length > 1 ? 's' : ''} sur ${groupes.length} élément${groupes.length > 1 ? 's' : ''}.`}
          </p>
        </div>
        {photos.length > 0 && (
          <Button onClick={toutEnregistrer}>
            <Download className="mr-2 h-4 w-4" />Tout enregistrer
          </Button>
        )}
      </div>

      {photos.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Camera className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">
              Les photos prises pendant la visite apparaîtront ici, regroupées par élément.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {groupes.map((groupe) => (
            <section key={groupe[0].itemId}>
              <div className="mb-2 flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-xs text-muted-foreground">{groupe[0].cfcCode}</span>
                <h2 className="text-sm font-semibold">{groupe[0].cfcLabel}</h2>
                {groupe[0].state && (
                  <span className={cn('rounded px-1.5 text-[10px] font-medium text-white', stateColors[groupe[0].state])}>
                    {stateLabels[groupe[0].state]}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {groupe.length} photo{groupe.length > 1 ? 's' : ''}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {groupe.map((p) => {
                  const index = photos.indexOf(p)
                  return (
                    <div key={`${p.itemId}-${p.rang}`} className="group relative">
                      <button
                        onClick={() => setOuverte(index)}
                        className="block w-full overflow-hidden rounded-lg border bg-muted/30"
                      >
                        <img src={p.src} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover transition-transform group-hover:scale-[1.02]" />
                      </button>
                      <button
                        onClick={() => enregistrer(nomFichier(project.name, p), p.src)}
                        title="Enregistrer cette photo"
                        className="absolute right-1.5 top-1.5 rounded-lg bg-black/55 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-black/75"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Visionneuse : l'image en grand, avec de quoi passer à la suivante et l'enregistrer. */}
      {active && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/92 backdrop-blur-sm">
          <div className="safe-top flex items-center justify-between gap-3 px-4 py-3 text-white">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{active.cfcLabel}</p>
              <p className="text-xs text-white/70">
                <span className="font-mono">{active.cfcCode}</span> · photo {ouverte! + 1} sur {photos.length}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => enregistrer(nomFichier(project.name, active), active.src)}
                className="rounded-lg bg-white/15 p-2 transition-colors hover:bg-white/25"
                title="Enregistrer"
              >
                <Download className="h-5 w-5" />
              </button>
              <button onClick={() => setOuverte(null)} className="rounded-lg bg-white/15 p-2 transition-colors hover:bg-white/25" title="Fermer">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center px-2">
            <img src={active.src} alt="" className="max-h-full max-w-full object-contain" />
          </div>

          <div className="safe-bottom flex items-center justify-center gap-6 py-4 text-white">
            <button
              onClick={() => setOuverte((n) => (n! - 1 + photos.length) % photos.length)}
              disabled={photos.length < 2}
              className="rounded-full bg-white/15 p-3 transition-colors hover:bg-white/25 disabled:opacity-40"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => setOuverte((n) => (n! + 1) % photos.length)}
              disabled={photos.length < 2}
              className="rounded-full bg-white/15 p-3 transition-colors hover:bg-white/25 disabled:opacity-40"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
