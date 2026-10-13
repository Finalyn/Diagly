import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, AlertCircle, Download, BookmarkCheck, Bookmark } from 'lucide-react'
import { Button, Card, CardContent } from '@/components/ui'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { stateLabels, stateColors } from '@/data/mock'
import { vibrer } from '@/lib/motion'
import { creerZip, octetsDeDataUrl } from '@/lib/zip'
import { Visionneuse } from '@/components/Visionneuse'
import { referencePhoto } from '@/lib/photo-de-garde'
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

const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

/** Nom du dossier, utilisable comme nom de fichier. */
function nomDossier(projet: string): string {
  return slug(projet) || 'diagnostic'
}

/** Nom de fichier lisible et triable : le dossier, le code CFC, puis le rang. */
function nomFichier(projet: string, p: PhotoTrouvee): string {
  return `${nomDossier(projet)}-${slug(p.cfcCode) || 'cfc'}-${p.rang}.jpg`
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
  const [enCours, setEnCours] = useState(false)

  const projectQuery = useQuery({ queryKey: ['project', id], queryFn: () => api.projects.get(id!), enabled: !!id })
  const project = projectQuery.data?.project
  const diagnostic = projectQuery.data?.diagnostics[0]

  const itemsQuery = useQuery({
    queryKey: ['diagnostic-items', diagnostic?.id],
    queryFn: () => api.diagnostics.listItems(diagnostic!.id),
    enabled: !!diagnostic,
  })

  // La photo de la page de garde des rapports : celle choisie ici, sinon la
  // première venue (lib/photo-de-garde.ts). Un toucher sur « Page de garde »
  // la choisit ; un second toucher sur la même revient à la règle par défaut.
  const qc = useQueryClient()
  const garde = useMutation({
    mutationFn: (reference: string | null) => api.projects.update(id!, { photoDeGarde: reference }),
    onSuccess: () => { vibrer('succes'); void qc.invalidateQueries({ queryKey: ['project', id] }) },
  })
  const choisirGarde = (p: PhotoTrouvee) => {
    const reference = referencePhoto(p.itemId, p.src)
    garde.mutate(project?.photoDeGarde === reference ? null : reference)
  }

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

  /**
   * Tout sortir en une archive plutôt qu'en cent téléchargements : le navigateur
   * en bloque une partie, et personne ne veut trier cent fichiers dans un dossier.
   */
  const toutEnregistrer = async () => {
    if (!project || enCours) return
    setEnCours(true)
    try {
      const fichiers = await Promise.all(photos.map(async (p) => ({
        nom: nomFichier(project.name, p),
        // Les photos du diagnostic sont conservées en data URL ; on gère quand même
        // le cas d'une image servie par le serveur, pour ne pas la perdre en route.
        donnees: p.src.startsWith('data:')
          ? octetsDeDataUrl(p.src)
          : new Uint8Array(await (await fetch(p.src)).arrayBuffer()),
      })))
      const url = URL.createObjectURL(creerZip(fichiers))
      enregistrer(`${nomDossier(project.name)}-photos.zip`, url)
      // Le navigateur a besoin de l'URL le temps du téléchargement.
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
      vibrer('succes')
    } finally {
      setEnCours(false)
    }
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

  // La vignette en page de garde, par son emplacement (élément et rang) et non
  // par l'image : deux éléments peuvent porter la même photo, et toutes ses
  // copies se seraient allumées. Sans choix, la première, comme les rapports.
  const cle = (p: PhotoTrouvee) => `${p.itemId}-${p.rang}`
  const choisie = project?.photoDeGarde ? photos.find((p) => referencePhoto(p.itemId, p.src) === project.photoDeGarde) : undefined
  const cleGarde = choisie ? cle(choisie) : photos[0] ? cle(photos[0]) : null

  const active = ouverte != null ? photos[ouverte] : null

  return (
    <div className="space-y-4">
      {/* Pas de barre d'onglets ici : la mise en page l'affiche deja pour toute
          page de dossier. La reposer en donnait deux, l'une sous l'autre. */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold md:text-2xl">Photos</h1>
          <p className="text-sm text-muted-foreground">
            {photos.length === 0
              ? 'Aucune photo pour ce diagnostic.'
              : `${photos.length} photo${photos.length > 1 ? 's' : ''} sur ${groupes.length} élément${groupes.length > 1 ? 's' : ''}. Le signet d'une photo la met en page de garde des rapports.`}
          </p>
        </div>
        {photos.length > 0 && (
          <Button onClick={toutEnregistrer} disabled={enCours}>
            {enCours
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Préparation…</>
              : <><Download className="mr-2 h-4 w-4" />Tout exporter ({photos.length})</>}
          </Button>
        )}
      </div>

      {photos.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
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
                      <BoutonGarde active={cle(p) === cleGarde} onClick={() => choisirGarde(p)} />
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

      {/* La même visionneuse que dans l'éditeur : une photo s'ouvre et se fait
          suivre des autres, au doigt comme au clavier. */}
      {active && ouverte != null && (
        <Visionneuse
          photos={photos.map((p) => p.src)}
          index={ouverte}
          onIndex={setOuverte}
          onFermer={() => setOuverte(null)}
          titre={active.cfcLabel}
          sousTitre={<span className="font-mono">{active.cfcCode}</span>}
          action={(
            <>
            <button
              onClick={() => choisirGarde(active)}
              className="flex items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-2 text-sm font-medium transition-colors hover:bg-white/25"
              title={cle(active) === cleGarde ? 'Photo de la page de garde' : 'Mettre en page de garde'}
            >
              {cle(active) === cleGarde ? <BookmarkCheck className="h-5 w-5" /> : <Bookmark className="h-5 w-5" />}
              <span className="hidden sm:inline">{cle(active) === cleGarde ? 'Page de garde' : 'Mettre en page de garde'}</span>
            </button>
            <button
              onClick={() => enregistrer(nomFichier(project.name, active), active.src)}
              className="rounded-lg bg-white/15 p-2 transition-colors hover:bg-white/25"
              title="Enregistrer"
            >
              <Download className="h-5 w-5" />
            </button>
            </>
          )}
        />
      )}
    </div>
  )
}

/**
 * Sur chaque vignette, en haut à gauche : la photo de garde est marquée, les
 * autres proposent de le devenir. Toujours visible, puisqu'au doigt il n'y a
 * pas de survol pour faire apparaître le bouton.
 */
function BoutonGarde({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={active ? 'Photo de la page de garde (toucher pour revenir à la première photo)' : 'Mettre en page de garde'}
      aria-pressed={active}
      className={cn(
        'absolute left-1.5 top-1.5 flex items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] font-medium backdrop-blur-sm transition-colors',
        active ? 'bg-[#0167EA] text-white' : 'bg-black/55 text-white hover:bg-black/75',
      )}
    >
      {active ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
      {active && <span>Page de garde</span>}
    </button>
  )
}
