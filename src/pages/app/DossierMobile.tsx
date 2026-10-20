/**
 * Le sommaire d'un dossier, sur téléphone.
 *
 * Sur ordinateur, le dossier a sa barre de gauche. Sur téléphone, il n'y a pas
 * la place : l'éditeur occupe l'écran, et son bouton « Dossier » ouvre ce
 * sommaire. On y trouve ce qui sert sur le terrain, d'abord : reprendre le
 * relevé, appeler l'interlocuteur, se faire guider jusqu'au bâtiment. Puis les
 * outils qui tiennent sur un petit écran. Les plans et les variantes, qui
 * demandent la place d'un ordinateur, n'y sont pas.
 */
import { Link, Navigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ChevronLeft, ChevronRight, ClipboardCheck, Phone, Navigation, CalendarCheck, MapPin, Zap, Calculator, Image, FileText, Loader2,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useDevisDuDossier } from '@/components/report/use-devis-du-dossier'
import { useIsMobile } from '@/lib/use-mobile'
import { statusLabels } from '@/data/mock'
import { cn, formatCHF } from '@/lib/utils'
import { dateLongue, heure, aAppeler, lienItineraire } from '@/lib/visite-mails'
import { lettreDeClasse } from '@/lib/demarrage'
import type { ProjectStatus } from '@/lib/api-types'
import { PreparerTerrain } from '@/components/PreparerTerrain'

const POINT: Record<ProjectStatus, string> = {
  NON_PLANIFIE: 'bg-gray-400', PLANIFIE: 'bg-blue-400', EN_COURS: 'bg-blue-500',
  EN_REVUE: 'bg-amber-500', TERMINE: 'bg-emerald-500', ARCHIVE: 'bg-gray-400',
}

export function DossierMobile() {
  const { id } = useParams<{ id: string }>()
  const isMobile = useIsMobile()
  const projetQ = useQuery({ queryKey: ['project', id], queryFn: () => api.projects.get(id!), enabled: !!id })
  const visiteQ = useQuery({ queryKey: ['visite', id], queryFn: () => api.visite.get(id!), enabled: !!id })
  const diagId = projetQ.data?.diagnostics?.[0]?.id
  const diagQ = useQuery({ queryKey: ['diagnostic', diagId], queryFn: () => api.diagnostics.get(diagId!), enabled: !!diagId })
  const { devis } = useDevisDuDossier(id)

  // Sur ordinateur, la barre du dossier tient lieu de sommaire, et la fiche du
  // bâtiment porte l'itinéraire et l'appel : une adresse de téléphone y mène.
  if (!isMobile) return <Navigate to={`/app/projects/${id}/fiche`} replace />
  if (projetQ.isLoading) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  const projet = projetQ.data?.project
  if (!projet) return <p className="py-16 text-center text-sm text-muted-foreground">Dossier introuvable.</p>

  const items = diagQ.data?.items ?? []
  const urgents = items.filter((i) => i.priority === 'I').length
  const photos = items.reduce((n, i) => n + (i.photos?.length ?? 0), 0)
  // Le même total que le devis et le rapport : toutes enveloppes, postes de chantier compris.
  const coutHT = devis?.ht ?? 0
  const plan = visiteQ.data?.plan
  const rdv = plan?.startAt ? new Date(plan.startAt) : null
  const contact = aAppeler(visiteQ.data?.contacts ?? [])
  const adresse = [projet.address, [projet.postalCode, projet.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  const base = `/app/projects/${projet.id}`
  const classes = [lettreDeClasse(projet.energyClassEnvelope), lettreDeClasse(projet.energyClassGlobal)].filter(Boolean)

  const GROUPES: { titre: string; entrees: { to: string; icone: typeof MapPin; label: string; detail: string }[] }[] = [
    { titre: 'Bâtiment', entrees: [
      { to: `${base}/visite`, icone: CalendarCheck, label: 'Visite', detail: rdv ? `Rendez-vous le ${dateLongue(rdv)} à ${heure(rdv)}` : 'À organiser' },
      { to: `${base}/fiche`, icone: MapPin, label: 'Fiche du bâtiment', detail: [projet.yearBuilt, projet.nbFloors && `${projet.nbFloors} étages`, projet.floorArea && `${projet.floorArea} m²`].filter(Boolean).join(' · ') || 'Adresse, surfaces, données publiques' },
      { to: `${base}/cecb`, icone: Zap, label: 'Étiquette énergétique', detail: classes.length ? `Classes ${classes.join(' et ')}` : 'Aucun certificat importé' },
    ] },
    { titre: 'Analyse', entrees: [
      { to: `${base}/couts`, icone: Calculator, label: 'Coûts', detail: coutHT ? `${formatCHF(coutHT)} HT, ${items.length} élément${items.length > 1 ? 's' : ''}` : 'Rien de chiffré pour l’instant' },
    ] },
    { titre: 'Documents', entrees: [
      { to: `${base}/photos`, icone: Image, label: 'Photos', detail: photos ? `${photos} photo${photos > 1 ? 's' : ''}` : 'Aucune photo' },
      { to: `${base}/rapports`, icone: FileText, label: 'Rapports', detail: 'Consulter, partager au client' },
    ] },
  ]

  const action = 'flex flex-1 flex-col items-center gap-1.5 rounded-2xl border border-black/[0.08] bg-white px-2 py-3 text-center text-xs font-medium transition-colors active:bg-neutral-50'

  return (
    <div className="space-y-4 pb-4">
      <Link to="/app/projects" className="inline-flex items-center gap-1 text-[13px] text-muted-foreground">
        <ChevronLeft className="h-4 w-4" />Diagnostics
      </Link>

      {/* Le bâtiment */}
      <div>
        <h1 className="text-xl font-bold leading-tight">{projet.name}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{adresse}</p>
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={cn('h-1.5 w-1.5 rounded-full', POINT[projet.status])} />{statusLabels[projet.status]}
        </p>
      </div>

      {/* Le relevé, devant tout le reste */}
      <Link to={diagId ? `/app/diagnostic/${diagId}` : base} className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4 text-blue-800">
        <ClipboardCheck className="h-6 w-6 shrink-0" strokeWidth={1.7} />
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold">Relevé</span>
          <span className="block text-xs text-blue-700/80">
            {items.length ? `${items.length} élément${items.length > 1 ? 's' : ''}${urgents ? `, dont ${urgents} urgent${urgents > 1 ? 's' : ''}` : ''}` : 'À commencer'}
          </span>
        </span>
        <span className="text-sm font-semibold">Reprendre</span>
        <ChevronRight className="h-4 w-4 shrink-0" />
      </Link>

      {/* Sur le terrain */}
      <div className="flex gap-2">
        {contact ? (
          <a href={`tel:${contact.phone!.replace(/\s/g, '')}`} className={action}>
            <Phone className="h-5 w-5 text-blue-600" strokeWidth={1.7} />
            <span className="w-full truncate">Appeler</span>
            <span className="w-full truncate text-[11px] font-normal text-muted-foreground">{contact.name}</span>
          </a>
        ) : (
          <Link to={`${base}/visite`} className={action}>
            <Phone className="h-5 w-5 text-muted-foreground" strokeWidth={1.7} />
            <span>Appeler</span>
            <span className="text-[11px] font-normal text-muted-foreground">Aucun numéro</span>
          </Link>
        )}
        <a href={lienItineraire(adresse)} target="_blank" rel="noopener noreferrer" className={action}>
          <Navigation className="h-5 w-5 text-blue-600" strokeWidth={1.7} />
          <span>Itinéraire</span>
          <span className="w-full truncate text-[11px] font-normal text-muted-foreground">{projet.city}</span>
        </a>
        <Link to={`${base}/visite`} className={action}>
          <CalendarCheck className="h-5 w-5 text-blue-600" strokeWidth={1.7} />
          <span>Visite</span>
          <span className="w-full truncate text-[11px] font-normal text-muted-foreground">
            {rdv ? rdv.toLocaleDateString('fr-CH', { day: 'numeric', month: 'short' }) : 'À fixer'}
          </span>
        </Link>
      </div>

      {/* Avant de partir : le dossier sur l'appareil, pour le sous-sol. */}
      <PreparerTerrain projetId={projet.id} />

      {/* Les outils qui tiennent sur un téléphone */}
      {GROUPES.map((g) => (
        <section key={g.titre}>
          <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g.titre}</p>
          <div className="divide-y divide-black/[0.05] overflow-hidden rounded-2xl border border-black/[0.06] bg-white">
            {g.entrees.map((e) => (
              <Link key={e.to} to={e.to} className="flex items-center gap-3 px-4 py-3.5 active:bg-neutral-50">
                <e.icone className="h-5 w-5 shrink-0 text-muted-foreground" strokeWidth={1.7} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{e.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{e.detail}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
              </Link>
            ))}
          </div>
        </section>
      ))}

      <p className="px-1 text-xs text-muted-foreground">Les plans et les variantes se travaillent sur ordinateur.</p>
    </div>
  )
}
